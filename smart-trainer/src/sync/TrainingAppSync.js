/**
 * TrainingAppSync - Envía las sesiones a la API de training-app (opcional)
 * Smart Trainer Controller
 *
 * Las sesiones viven siempre en IndexedDB; esto es solo una copia remota idempotente
 * (el servidor hace upsert por clientSessionId, así que reenviar no duplica).
 */

import { enqueueSyncJob, getAllSessions, getSession, getSyncJobs, removeSyncJob, saveSession, withIntegratedDistance } from '../storage/sessions.js';
import { sessionFromRemote } from './remote-session.js';
import { logAppEvent } from '../diagnostics/SessionDebugLogger.js';
import { loadSettings, updateSettings } from '../storage/settings.js';

const STORAGE_KEY = 'smartTrainer_trainingApp';
const DELETED_KEY = 'smartTrainer_deletedSessions';
const SYNCABLE_STATUSES = new Set(['completed', 'abandoned']);

let flushPromise = null;

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
    const response = await fetch(`${config.baseUrl}/api/smart-trainer/sessions`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${config.token}`,
        },
        body: JSON.stringify({ clientSessionId: session.clientSessionId, session: withIntegratedDistance(session) }),
    });
    logAppEvent('sync.post', {
        clientSessionId: session.clientSessionId,
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
    const known = new Set((await getAllSessions()).map((session) => session.clientSessionId));
    const deleted = getDeletedIds();
    const { sessions: remote = [] } = await getJson(config, '/sessions?limit=200');
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
        return true;
    } catch {
        return false;
    }
}

/** Envía los trabajos pendientes de la cola (sesiones recién terminadas). */
export function flushSyncOutbox() {
    if (!isSyncConnected() || !navigator.onLine) return Promise.resolve({ synced: 0, pending: 0 });
    if (flushPromise) return flushPromise;
    flushPromise = runFlush().finally(() => {
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
            // La cola guarda una copia del momento de terminar; el RPE se añade después, así que se envía la más reciente.
            const latest = job.payload.session.id ? await getSession(job.payload.session.id).catch(() => null) : null;
            await postSession(config, latest || job.payload.session);
        } catch (error) {
            logAppEvent('sync.post.error', { clientSessionId: job.payload.session?.clientSessionId, error: error.message, code: error.code ?? null });
            if (error.code === 'AUTH_EXPIRED') break;
            continue;
        }
        await removeSyncJob(job.id);
        synced++;
    }
    if (jobs.length) logAppEvent('sync.flush', { jobs: jobs.length, synced, pending: jobs.length - synced });
    return { synced, pending: jobs.length - synced };
}

/** Sube todo el historial local (útil para sesiones anteriores a la conexión). */
export async function syncAllSessions() {
    if (!isSyncConnected()) throw new Error('Conecta primero con training-app.');
    const config = getSyncConfig();
    const sessions = (await getAllSessions()).filter(
        (session) => SYNCABLE_STATUSES.has(session.status) && session.clientSessionId,
    );
    let synced = 0;
    let failed = 0;
    for (const session of sessions) {
        try {
            await postSession(config, session);
            synced++;
        } catch (error) {
            if (error.code === 'AUTH_EXPIRED') throw error;
            failed++;
        }
    }
    await flushSyncOutbox();
    return { total: sessions.length, synced, failed };
}

export function startBackgroundSync() {
    const handleOnline = () => {
        // Primero lo pendiente (incluye borrados) y luego lo que falte aquí, para que un borrado no se descargue de vuelta.
        flushSyncOutbox()
            .then(() => (isSyncConnected() && navigator.onLine ? pullSessions() : null))
            .catch(() => {});
    };
    window.addEventListener('online', handleOnline);
    handleOnline();
    return () => window.removeEventListener('online', handleOnline);
}
