/**
 * TrainingAppSync - Envía las sesiones a la API de training-app (opcional)
 * Smart Trainer Controller
 *
 * Las sesiones viven siempre en IndexedDB; esto es solo una copia remota idempotente
 * (el servidor hace upsert por clientSessionId, así que reenviar no duplica).
 */

import {
    enqueueSyncJob,
    getAllSessions,
    getSession,
    getSyncJobs,
    isSessionSynced,
    markSessionSynced,
    queueSessionUpload,
    removeSyncJob,
    saveSession,
    sessionUploadJobId,
    compactForUpload,
} from '../storage/sessions.js';
import { sessionFromRemote } from './remote-session.js';
import { logAppEvent } from '../diagnostics/SessionDebugLogger.js';
import { loadSettings, updateSettings } from '../storage/settings.js';

const STORAGE_KEY = 'smartTrainer_trainingApp';
const DELETED_KEY = 'smartTrainer_deletedSessions';
const SYNCABLE_STATUSES = new Set(['completed', 'abandoned']);

let flushPromise = null;
// Si llega trabajo nuevo mientras se vacía la cola, se repasa otra vez al terminar (la pasada en curso ya leyó la lista).
let flushAgain = false;

export function getSyncConfig() {
    try {
        const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
        return saved && typeof saved === 'object' ? saved : {};
    } catch {
        return {};
    }
}

function saveSyncConfig(config) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
}

export function isSyncConnected() {
    const { baseUrl, token } = getSyncConfig();
    return Boolean(baseUrl && token);
}

function normalizeBaseUrl(url) {
    return String(url || '').trim().replace(/\/+$/, '');
}

export async function connectTrainingApp({ baseUrl, email, password }) {
    const base = normalizeBaseUrl(baseUrl);
    if (!/^https?:\/\//.test(base)) throw new Error('La URL debe empezar por http:// o https://');

    let response;
    try {
        response = await fetch(`${base}/api/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password }),
        });
    } catch {
        throw new Error('No se pudo conectar con training-app. ¿Está arrancada y accesible?');
    }
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data.token) throw new Error(data.error || `Error ${response.status} al iniciar sesión`);

    saveSyncConfig({ baseUrl: base, token: data.token, email: data.email || email });
    return { email: data.email || email };
}

/** Página de training-app que, con la sesión ya iniciada allí (Google incluido), devuelve un token a esta app. */
export function buildLinkUrl(baseUrl) {
    const base = normalizeBaseUrl(baseUrl);
    if (!/^https?:\/\//.test(base)) throw new Error('La URL debe empezar por http:// o https://');
    return `${base}/conectar-rodillo?return=${encodeURIComponent(window.location.origin + window.location.pathname)}`;
}

/**
 * Si la URL trae #/connect?token=… (vuelta desde training-app), guarda la conexión y deja la URL en Ajustes.
 * El token solo viaja en el fragmento: no llega a ningún servidor ni a los logs.
 */
export function consumeConnectLink() {
    const hash = window.location.hash || '';
    if (!hash.startsWith('#/connect?')) return null;
    window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}#/settings`);
    const params = new URLSearchParams(hash.slice('#/connect?'.length));
    const token = params.get('token');
    const baseUrl = normalizeBaseUrl(params.get('base'));
    if (!token || !/^(https:\/\/[^/]+|http:\/\/localhost(:\d+)?)$/.test(baseUrl)) return null;
    const email = params.get('email') || '';
    saveSyncConfig({ baseUrl, token, email });
    logAppEvent('sync.link', { baseUrl });
    return { email };
}

export function disconnectTrainingApp() {
    localStorage.removeItem(STORAGE_KEY);
}

function expireAuth(config) {
    // Token caducado: el usuario debe volver a conectar. Se conserva la URL y el email.
    saveSyncConfig({ baseUrl: config.baseUrl, email: config.email });
    const error = new Error('La sesión con training-app ha caducado. Vuelve a conectar.');
    error.code = 'AUTH_EXPIRED';
    return error;
}

async function postSession(config, session) {
    const upload = compactForUpload(session);
    const body = JSON.stringify({ clientSessionId: session.clientSessionId, session: upload });
    const details = {
        clientSessionId: session.clientSessionId,
        bytes: body.length,
        samples: upload.dataPoints.length,
        localSamples: session.dataPoints?.length ?? 0,
    };
    let response;
    try {
        response = await fetch(`${config.baseUrl}/api/smart-trainer/sessions`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${config.token}`,
            },
            body,
        });
    } catch (error) {
        logAppEvent('sync.post', { ...details, error: error.message });
        throw error;
    }
    logAppEvent('sync.post', {
        ...details,
        plannedWorkoutId: session.plannedWorkoutId ?? null,
        status: response.status,
    });
    if (response.status === 401) throw expireAuth(config);
    if (!response.ok) throw new Error(`training-app respondió ${response.status}`);
}

async function getJson(config, path) {
    const response = await fetch(`${config.baseUrl}/api/smart-trainer${path}`, {
        headers: { Authorization: `Bearer ${config.token}` },
    });
    if (response.status === 401) throw expireAuth(config);
    if (!response.ok) throw new Error(`training-app respondió ${response.status}`);
    return response.json();
}

async function deleteRemoteSession(config, clientSessionId) {
    const response = await fetch(`${config.baseUrl}/api/smart-trainer/sessions/${encodeURIComponent(clientSessionId)}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${config.token}` },
    });
    if (response.status === 401) throw expireAuth(config);
    if (!response.ok) throw new Error(`training-app respondió ${response.status}`);
}

function getDeletedIds() {
    try {
        const saved = JSON.parse(localStorage.getItem(DELETED_KEY) || '[]');
        return new Set(Array.isArray(saved) ? saved : []);
    } catch {
        return new Set();
    }
}

/**
 * Anota que el usuario borró una sesión aquí: no vuelve a bajarse y, con conexión, se borra también la copia remota
 * (sin red, el borrado queda en la cola y se envía después).
 */
export async function forgetSession(session) {
    const clientSessionId = session?.clientSessionId;
    if (!clientSessionId) return;
    try {
        const deleted = getDeletedIds().add(clientSessionId);
        localStorage.setItem(DELETED_KEY, JSON.stringify([...deleted]));
    } catch {
        // sin localStorage no hay lista de borrados: peor caso, la sesión se vuelve a descargar
    }
    if (!isSyncConnected()) return;
    // Si aún estaba pendiente de subir, ya no hay que subirla.
    await removeSyncJob(sessionUploadJobId(clientSessionId)).catch(() => {});
    await enqueueSyncJob('delete_session', { clientSessionId }).catch(() => {});
    flushSyncOutbox().catch(() => {});
}

/**
 * Baja de training-app las sesiones que no están en este dispositivo (mismo clientSessionId = misma sesión).
 * No toca las locales ni las que el usuario borró aquí.
 */
export async function pullSessions() {
    if (!isSyncConnected()) throw new Error('Conecta primero con training-app.');
    const config = getSyncConfig();
    const local = await getAllSessions();
    const known = new Set(local.map((session) => session.clientSessionId));
    const deleted = getDeletedIds();
    const { sessions: remote = [] } = await getJson(config, '/sessions?limit=200');
    // Las locales que training-app ya tiene (enviadas antes de existir la marca) no cuentan como pendientes.
    const remoteIds = new Set(remote.map((item) => item.clientSessionId));
    for (const session of local) {
        if (remoteIds.has(session.clientSessionId) && !isSessionSynced(session)) await markSessionSynced(session.id).catch(() => {});
    }
    const missing = remote.filter((item) => item.clientSessionId && !known.has(item.clientSessionId) && !deleted.has(item.clientSessionId));

    let pulled = 0;
    let failed = 0;
    for (const item of missing) {
        try {
            const { session } = await getJson(config, `/sessions/${item._id}`);
            await saveSession(sessionFromRemote(session));
            pulled++;
        } catch (error) {
            if (error.code === 'AUTH_EXPIRED') throw error;
            failed++;
        }
    }
    logAppEvent('sync.pull', { remote: remote.length, missing: missing.length, pulled, failed });
    return { remote: remote.length, pulled, failed };
}

/**
 * Adopta el FTP del perfil de training-app (vatios) como FTP local.
 * Solo si el usuario no lo ha cambiado aquí: el local sigue siendo el de fábrica (200) o el último que aplicamos del perfil.
 * Devuelve true si cambió el ajuste local.
 */
export function applyProfileFtp(profileFtp) {
    const ftp = Math.round(Number(profileFtp));
    if (!Number.isFinite(ftp) || ftp < 50 || ftp > 700) return false;
    const settings = loadSettings();
    const untouched = settings.ftp === 200 || settings.ftp === settings.ftpProfileApplied;
    if (!untouched || settings.ftp === ftp) {
        if (untouched && settings.ftpProfileApplied !== ftp) updateSettings({ ftpProfileApplied: ftp });
        return false;
    }
    updateSettings({ ftp, ftpProfileApplied: ftp });
    logAppEvent('ftp.profile.applied', { from: settings.ftp, to: ftp });
    return true;
}

/** Entreno de rodillo que el plan de training-app prevé para hoy (y el siguiente). null si no hay conexión o falla. */
export async function fetchTodayPlan() {
    if (!isSyncConnected() || !navigator.onLine) return null;
    const config = getSyncConfig();
    const now = new Date();
    const localDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    try {
        const response = await fetch(`${config.baseUrl}/api/smart-trainer/plan/today?date=${localDate}`, {
            headers: { Authorization: `Bearer ${config.token}` },
        });
        if (!response.ok) {
            logAppEvent('plan.fetch', { status: response.status, date: localDate });
            return null;
        }
        const result = await response.json();
        applyProfileFtp(result.ftp);
        logAppEvent('plan.fetch', {
            status: response.status,
            date: localDate,
            planned: result.planned ? { id: result.planned.id, name: result.planned.name, blocks: result.planned.structure?.length ?? 0, source: result.planned.structureSource } : null,
            next: result.next?.name ?? null,
            ftp: result.ftp ?? null,
        });
        return result;
    } catch (error) {
        logAppEvent('plan.fetch', { error: error.message, date: localDate });
        return null;
    }
}

/** Reenvía una sesión concreta (best-effort), p. ej. tras publicarla en Strava para enlazar ambas copias. */
export async function pushSession(session) {
    if (!isSyncConnected() || !navigator.onLine || !session?.clientSessionId) return false;
    try {
        await postSession(getSyncConfig(), session);
        await markSessionSynced(session.id).catch(() => {});
        return true;
    } catch {
        return false;
    }
}

/** Envía los trabajos pendientes de la cola (sesiones recién terminadas). */
export function flushSyncOutbox() {
    if (!isSyncConnected() || !navigator.onLine) return Promise.resolve({ synced: 0, pending: 0 });
    if (flushPromise) {
        flushAgain = true;
        return flushPromise;
    }
    flushPromise = (async () => {
        let total = { synced: 0, pending: 0 };
        do {
            flushAgain = false;
            const result = await runFlush();
            total = { synced: total.synced + result.synced, pending: result.pending };
        } while (flushAgain && isSyncConnected());
        return total;
    })().finally(() => {
        flushPromise = null;
    });
    return flushPromise;
}

async function runFlush() {
    const config = getSyncConfig();
    const jobs = (await getSyncJobs()).filter((job) => job.type === 'complete_session' || job.type === 'delete_session');
    let synced = 0;
    for (const job of jobs) {
        try {
            if (job.type === 'delete_session') {
                await deleteRemoteSession(config, job.payload.clientSessionId);
                await removeSyncJob(job.id);
                synced++;
                continue;
            }
            // Se envía la versión guardada más reciente (el RPE se añade después de terminar).
            // Los trabajos antiguos llevan una copia de la sesión; los nuevos, solo su id.
            const sessionId = job.payload.sessionId ?? job.payload.session?.id;
            const latest = sessionId ? await getSession(sessionId).catch(() => null) : null;
            const session = latest || job.payload.session;
            if (!session) {
                // Ya no está en el historial (borrada): no hay nada que enviar.
                await removeSyncJob(job.id);
                continue;
            }
            await postSession(config, session);
            await markSessionSynced(latest?.id).catch(() => {});
        } catch (error) {
            logAppEvent('sync.post.error', { clientSessionId: job.payload.clientSessionId ?? job.payload.session?.clientSessionId, error: error.message, code: error.code ?? null });
            if (error.code === 'AUTH_EXPIRED') break;
            continue;
        }
        await removeSyncJob(job.id);
        synced++;
    }
    if (jobs.length) logAppEvent('sync.flush', { jobs: jobs.length, synced, pending: jobs.length - synced });
    return { synced, pending: jobs.length - synced };
}

/**
 * Encola las sesiones terminadas de este dispositivo que training-app aún no tiene
 * (p. ej. si la app se cerró antes de enviarlas). Devuelve cuántas hay pendientes.
 */
export async function queuePendingSessions() {
    const deleted = getDeletedIds();
    const pending = (await getAllSessions()).filter((session) => SYNCABLE_STATUSES.has(session.status)
        && session.clientSessionId
        && !isSessionSynced(session)
        && !deleted.has(session.clientSessionId));
    for (const session of pending) await queueSessionUpload(session);
    if (pending.length) logAppEvent('sync.reconcile', { pending: pending.length });
    return pending.length;
}

/** Sesiones terminadas aquí que training-app aún no ha confirmado. */
export async function countPendingSessions() {
    const deleted = getDeletedIds();
    return (await getAllSessions()).filter((session) => SYNCABLE_STATUSES.has(session.status)
        && session.clientSessionId
        && !isSessionSynced(session)
        && !deleted.has(session.clientSessionId)).length;
}

/** Botón de Ajustes: encola lo que falte y lo envía ya. */
export async function syncPendingSessions() {
    if (!isSyncConnected()) throw new Error('Conecta primero con training-app.');
    if (!navigator.onLine) throw new Error('Sin conexión a internet: se enviarán al recuperarla.');
    const total = await queuePendingSessions();
    await flushSyncOutbox();
    if (!isSyncConnected()) throw expireAuth(getSyncConfig());
    const failed = await countPendingSessions();
    return { total, synced: Math.max(0, total - failed), failed };
}

export function startBackgroundSync() {
    const handleOnline = () => {
        if (!isSyncConnected()) return;
        // Primero la cola (incluye borrados), para que un borrado no se descargue de vuelta; luego la descarga,
        // que marca lo que training-app ya tiene; y al final se envían las terminadas aquí que aún falten.
        flushSyncOutbox()
            .then(() => (isSyncConnected() && navigator.onLine ? pullSessions() : null))
            .catch(() => {})
            .then(() => (isSyncConnected() ? queuePendingSessions() : 0))
            .then((pending) => (pending ? flushSyncOutbox() : null))
            .catch(() => {});
    };
    // Al volver a la pestaña se reintenta lo que quedó en cola (p. ej. tras un fallo de red al terminar).
    const handleVisible = () => {
        if (document.visibilityState === 'visible') flushSyncOutbox().catch(() => {});
    };
    window.addEventListener('online', handleOnline);
    document.addEventListener('visibilitychange', handleVisible);
    handleOnline();
    return () => {
        window.removeEventListener('online', handleOnline);
        document.removeEventListener('visibilitychange', handleVisible);
    };
}
