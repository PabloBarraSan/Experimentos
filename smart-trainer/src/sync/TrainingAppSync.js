/**
 * TrainingAppSync - Envía las sesiones a la API de training-app (opcional)
 * Smart Trainer Controller
 *
 * Las sesiones viven siempre en IndexedDB; esto es solo una copia remota idempotente
 * (el servidor hace upsert por clientSessionId, así que reenviar no duplica).
 */

import { getAllSessions, getSyncJobs, removeSyncJob, withIntegratedDistance } from '../storage/sessions.js';
import { logAppEvent } from '../diagnostics/SessionDebugLogger.js';

const STORAGE_KEY = 'smartTrainer_trainingApp';
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
    if (response.status === 401) {
        // Token caducado: el usuario debe volver a conectar. Se conserva la URL y el email.
        saveSyncConfig({ baseUrl: config.baseUrl, email: config.email });
        const error = new Error('La sesión con training-app ha caducado. Vuelve a conectar.');
        error.code = 'AUTH_EXPIRED';
        throw error;
    }
    if (!response.ok) throw new Error(`training-app respondió ${response.status}`);
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
    const jobs = (await getSyncJobs()).filter((job) => job.type === 'complete_session');
    let synced = 0;
    for (const job of jobs) {
        try {
            await postSession(config, job.payload.session);
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
    const handleOnline = () => flushSyncOutbox().catch(() => {});
    window.addEventListener('online', handleOnline);
    handleOnline();
    return () => window.removeEventListener('online', handleOnline);
}
