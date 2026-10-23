import { logAppEvent } from '../diagnostics/SessionDebugLogger.js';

/**
 * Sessions Storage - Gestión de sesiones de entrenamiento
 * Smart Trainer Controller
 * 
 * Usa IndexedDB para almacenar sesiones de entrenamiento
 */

const DB_NAME = 'SmartTrainerDB';
const DB_VERSION = 2;
const SESSIONS_STORE = 'sessions';
const WORKOUTS_STORE = 'workouts';
const ACTIVE_SESSION_STORE = 'activeSession';
const PROGRESS_STORE = 'progress';
const SYNC_OUTBOX_STORE = 'syncOutbox';

let db = null;

/**
 * Inicializar base de datos
 */
export async function initDB() {
    return new Promise((resolve, reject) => {
        if (db) {
            resolve(db);
            return;
        }
        
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        
        request.onerror = () => {
            console.error('Error abriendo IndexedDB:', request.error);
            reject(request.error);
        };
        
        request.onsuccess = () => {
            db = request.result;
            console.log('✅ IndexedDB inicializada');
            resolve(db);
        };
        
        request.onupgradeneeded = (event) => {
            const database = event.target.result;
            
            // Crear store de sesiones
            if (!database.objectStoreNames.contains(SESSIONS_STORE)) {
                const store = database.createObjectStore(SESSIONS_STORE, { keyPath: 'id' });
                store.createIndex('date', 'date', { unique: false });
                store.createIndex('workoutId', 'workoutId', { unique: false });
                console.log('📦 Store de sesiones creado');
            }
            if (!database.objectStoreNames.contains(WORKOUTS_STORE)) {
                const workouts = database.createObjectStore(WORKOUTS_STORE, { keyPath: 'id' });
                workouts.createIndex('updatedAt', 'updatedAt', { unique: false });
                workouts.createIndex('category', 'category', { unique: false });
            }
            if (!database.objectStoreNames.contains(ACTIVE_SESSION_STORE)) {
                database.createObjectStore(ACTIVE_SESSION_STORE, { keyPath: 'key' });
            }
            if (!database.objectStoreNames.contains(PROGRESS_STORE)) {
                database.createObjectStore(PROGRESS_STORE, { keyPath: 'key' });
            }
            if (!database.objectStoreNames.contains(SYNC_OUTBOX_STORE)) {
                const outbox = database.createObjectStore(SYNC_OUTBOX_STORE, { keyPath: 'id' });
                outbox.createIndex('createdAt', 'createdAt', { unique: false });
            }
        };
    });
}

/**
 * Crear una nueva sesión
 */
export function createSession(options = {}) {
    const {
        workoutId = null,
        plannedWorkoutId = null,
        workoutName = 'Entrenamiento Libre',
        ftp = 200,
        routeId = null,
        routeName = null,
        experienceMode = 'metrics',
    } = options;
    
    return {
        schemaVersion: 2,
        id: generateId(),
        clientSessionId: createUuid(),
        workoutId,
        plannedWorkoutId,
        workoutName,
        ftp,
        date: new Date().toISOString(),
        startTime: Date.now(),
        endTime: null,
        duration: 0,
        activeDuration: 0,
        pausedDuration: 0,
        dataPoints: [],
        status: 'active', // 'active', 'paused', 'completed', 'discarded'
        metrics: null,    // Se calculan al finalizar
        controlMode: 'manual',
        experienceMode,
        routeId,    // Ruta del ride virtual (null si no aplica o no tiene id estable)
        routeName,
        adherence: null,
        gameResult: null,
        // Campos para sincronización con plataformas externas
        syncStatus: {
            strava: {
                synced: false,
                activityId: null,
                syncedAt: null,
                error: null,
            },
            // Preparado para futuras integraciones
            // trainingPeaks: { synced: false, ... },
            // garminConnect: { synced: false, ... },
        },
    };
}

/**
 * Guardar sesión en IndexedDB
 */
export async function saveSession(session) {
    await initDB();
    
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([SESSIONS_STORE], 'readwrite');
        const store = transaction.objectStore(SESSIONS_STORE);
        
        const request = store.put(session);
        
        request.onsuccess = () => {
            console.log('💾 Sesión guardada:', session.id);
            logAppEvent('session.saved', {
                id: session.id,
                clientSessionId: session.clientSessionId,
                status: session.status,
                plannedWorkoutId: session.plannedWorkoutId ?? null,
                samples: session.dataPoints?.length ?? 0,
            });
            resolve(session);
        };
        
        request.onerror = () => {
            console.error('Error guardando sesión:', request.error);
            reject(request.error);
        };
    });
}

/**
 * Obtener sesión por ID
 */
export async function getSession(id) {
    await initDB();
    
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([SESSIONS_STORE], 'readonly');
        const store = transaction.objectStore(SESSIONS_STORE);
        
        const request = store.get(id);
        
        request.onsuccess = () => {
            resolve(request.result ? normalizeSession(request.result) : null);
        };
        
        request.onerror = () => {
            reject(request.error);
        };
    });
}

/**
 * Obtener todas las sesiones
 */
export async function getAllSessions() {
    await initDB();
    
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([SESSIONS_STORE], 'readonly');
        const store = transaction.objectStore(SESSIONS_STORE);
        const index = store.index('date');
        
        const request = index.openCursor(null, 'prev'); // Más recientes primero
        const sessions = [];
        
        request.onsuccess = (event) => {
            const cursor = event.target.result;
            if (cursor) {
                sessions.push(normalizeSession(cursor.value));
                cursor.continue();
            } else {
                resolve(sessions);
            }
        };
        
        request.onerror = () => {
            reject(request.error);
        };
    });
}

/**
 * Obtener sesiones recientes (últimas N)
 */
export async function getRecentSessions(limit = 10) {
    const all = await getAllSessions();
    return all.slice(0, limit);
}

/**
 * Sesiones completadas de una ruta (solo metadatos), más recientes primero
 * @returns {Promise<Array<{id, date, duration, totalDistance, avgPower}>>}
 */
export async function getSessionsByRoute(routeId) {
    if (!routeId) return [];
    await initDB();

    return new Promise((resolve, reject) => {
        const store = db.transaction([SESSIONS_STORE], 'readonly').objectStore(SESSIONS_STORE);
        const request = store.index('date').openCursor(null, 'prev');
        const result = [];

        request.onsuccess = (event) => {
            const cursor = event.target.result;
            if (!cursor) {
                resolve(result);
                return;
            }
            const session = cursor.value;
            if (session.routeId === routeId && session.status === 'completed') {
                const lastPoint = session.dataPoints?.[session.dataPoints.length - 1];
                result.push({
                    id: session.id,
                    date: session.date,
                    duration: session.duration || 0,
                    totalDistance: session.metrics?.distance || lastPoint?.distance || 0,
                    avgPower: session.metrics?.power?.avg || 0,
                });
            }
            cursor.continue();
        };
        request.onerror = () => reject(request.error);
    });
}

/**
 * Serie compacta [{t, d}] (segundos, metros) de una sesión, con un punto cada 2 s como máximo.
 * Siempre incluye el primer y el último punto; d nunca decrece.
 */
export async function getSessionTrace(id) {
    const session = await getSession(id);
    if (!session) return [];

    const MIN_STEP_SECONDS = 2;
    const trace = [];
    let maxDistance = 0;

    const points = (session.dataPoints || []).filter(
        (p) => Number.isFinite(p.elapsedSeconds) && Number.isFinite(p.distance)
    );
    points.forEach((point, index) => {
        maxDistance = Math.max(maxDistance, point.distance);
        const last = trace[trace.length - 1];
        const isLast = index === points.length - 1;
        if (!last || isLast || point.elapsedSeconds - last.t >= MIN_STEP_SECONDS) {
            if (last && point.elapsedSeconds <= last.t) return; // Tiempo no creciente
            trace.push({ t: Math.round(point.elapsedSeconds * 10) / 10, d: maxDistance });
        }
    });

    return trace;
}

/**
 * Eliminar sesión
 */
export async function deleteSession(id) {
    await initDB();
    
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([SESSIONS_STORE], 'readwrite');
        const store = transaction.objectStore(SESSIONS_STORE);
        
        const request = store.delete(id);
        
        request.onsuccess = () => {
            console.log('🗑️ Sesión eliminada:', id);
            resolve(true);
        };
        
        request.onerror = () => {
            reject(request.error);
        };
    });
}

/**
 * Añadir punto de datos a sesión activa
 */
export function addDataPoint(session, data) {
    session.dataPoints.push({
        timestamp: Date.now(),
        power: data.power || 0,
        cadence: data.cadence || 0,
        speed: data.speed || 0,
        heartRate: data.heartRate || 0,
        resistance: data.resistance || 0,
        distance: data.distance || 0,
    });
    
    return session;
}

/**
 * Finalizar sesión y calcular métricas
 */
export async function finishSession(session, metrics, status = session.status === 'abandoned' ? 'abandoned' : 'completed') {
    session.endTime = Date.now();
    const wallDuration = Math.max(0, (session.endTime - session.startTime) / 1000);
    session.activeDuration = metrics?.duration ?? session.elapsedTime ?? Math.max(0, wallDuration - (session.pausedDuration || 0));
    session.duration = session.activeDuration;
    session.status = status;
    session.metrics = metrics;
    
    await saveSession(session);
    await clearActiveSession();
    return session;
}

/**
 * Descartar sesión (marcar como descartada)
 */
export async function discardSession(session) {
    session.status = 'discarded';
    session.endTime = Date.now();
    
    // Opcionalmente, no guardar sesiones descartadas muy cortas
    if (session.dataPoints.length < 60) {
        // Menos de 1 minuto, eliminar
        if (session.id) {
            try {
                await deleteSession(session.id);
            } catch (e) {
                // Puede que no exista aún en la BD
            }
        }
        await clearActiveSession();
        return null;
    }
    
    await saveSession(session);
    await clearActiveSession();
    return session;
}

export async function saveActiveSession(session) {
    await initDB();
    const draft = {
        key: 'current',
        savedAt: Date.now(),
        session: {
            ...session,
            schemaVersion: 2,
            dataPoints: [...(session.dataPoints || [])],
        },
    };
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([ACTIVE_SESSION_STORE], 'readwrite');
        const request = transaction.objectStore(ACTIVE_SESSION_STORE).put(draft);
        request.onsuccess = () => resolve(draft.session);
        request.onerror = () => reject(request.error);
    });
}

export async function getActiveSession() {
    await initDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([ACTIVE_SESSION_STORE], 'readonly');
        const request = transaction.objectStore(ACTIVE_SESSION_STORE).get('current');
        request.onsuccess = () => resolve(request.result?.session || null);
        request.onerror = () => reject(request.error);
    });
}

export async function clearActiveSession() {
    await initDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([ACTIVE_SESSION_STORE], 'readwrite');
        const request = transaction.objectStore(ACTIVE_SESSION_STORE).delete('current');
        request.onsuccess = () => resolve(true);
        request.onerror = () => reject(request.error);
    });
}

export async function saveWorkout(workout) {
    await initDB();
    const value = { ...workout, updatedAt: workout.updatedAt || new Date().toISOString() };
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([WORKOUTS_STORE], 'readwrite');
        const request = transaction.objectStore(WORKOUTS_STORE).put(value);
        request.onsuccess = () => resolve(value);
        request.onerror = () => reject(request.error);
    });
}

export async function getSavedWorkouts() {
    await initDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([WORKOUTS_STORE], 'readonly');
        const request = transaction.objectStore(WORKOUTS_STORE).getAll();
        request.onsuccess = () => resolve(request.result || []);
        request.onerror = () => reject(request.error);
    });
}

/**
 * Obtener estadísticas totales del usuario
 */
export async function getTotalStats() {
    const sessions = await getAllSessions();
    const completedSessions = sessions.filter(s => s.status === 'completed' && s.metrics);
    
    if (completedSessions.length === 0) {
        return {
            totalSessions: 0,
            totalDuration: 0,
            totalDistance: 0,
            totalCalories: 0,
            totalTSS: 0,
            avgPower: 0,
            maxPower: 0,
        };
    }
    
    const stats = completedSessions.reduce((acc, session) => {
        acc.totalDuration += session.duration || 0;
        acc.totalDistance += session.metrics?.distance || 0;
        acc.totalCalories += session.metrics?.energy?.calories || 0;
        acc.totalTSS += session.metrics?.intensity?.tss || 0;
        acc.avgPowerSum += (session.metrics?.power?.avg || 0) * (session.duration || 0);
        acc.maxPower = Math.max(acc.maxPower, session.metrics?.power?.max || 0);
        return acc;
    }, {
        totalDuration: 0,
        totalDistance: 0,
        totalCalories: 0,
        totalTSS: 0,
        avgPowerSum: 0,
        maxPower: 0,
    });
    
    return {
        totalSessions: completedSessions.length,
        totalDuration: Math.round(stats.totalDuration),
        totalDurationFormatted: formatDuration(stats.totalDuration),
        totalDistance: Math.round(stats.totalDistance),
        totalCalories: Math.round(stats.totalCalories),
        totalTSS: Math.round(stats.totalTSS),
        avgPower: stats.totalDuration > 0 
            ? Math.round(stats.avgPowerSum / stats.totalDuration)
            : 0,
        maxPower: stats.maxPower,
    };
}

/**
 * Obtener estadísticas por período
 */
export async function getStatsByPeriod(period = 'week') {
    const sessions = await getAllSessions();
    const now = new Date();
    let startDate;
    
    switch (period) {
        case 'day':
            startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
            break;
        case 'week':
            const dayOfWeek = now.getDay();
            startDate = new Date(now);
            startDate.setDate(now.getDate() - dayOfWeek);
            startDate.setHours(0, 0, 0, 0);
            break;
        case 'month':
            startDate = new Date(now.getFullYear(), now.getMonth(), 1);
            break;
        case 'year':
            startDate = new Date(now.getFullYear(), 0, 1);
            break;
        default:
            startDate = new Date(0);
    }
    
    const periodSessions = sessions.filter(s => 
        s.status === 'completed' && 
        new Date(s.date) >= startDate
    );
    
    const tssPerDay = {};
    periodSessions.forEach(s => {
        const day = new Date(s.date).toDateString();
        tssPerDay[day] = (tssPerDay[day] || 0) + (s.metrics?.intensity?.tss || 0);
    });
    
    return {
        sessions: periodSessions.length,
        totalTSS: periodSessions.reduce((sum, s) => sum + (s.metrics?.intensity?.tss || 0), 0),
        totalDuration: periodSessions.reduce((sum, s) => sum + (s.duration || 0), 0),
        tssPerDay,
    };
}

/**
 * Exportar sesión a formato .fit (simplificado)
 * Nota: El formato FIT real es binario y complejo. Esto es una versión simplificada.
 */
export function exportToFIT(session) {
    void session;
    throw new Error('La exportación FIT aún no está disponible. Usa TCX o CSV.');
}

/**
 * Exportar sesión a formato .tcx (Training Center XML)
 */
/**
 * Sesiones anteriores al cálculo en vivo guardaron distancia 0 (el rodillo mini no la envía por FTMS).
 * Devuelve una copia con la distancia integrada desde la velocidad; no toca la sesión original.
 */
export function withIntegratedDistance(session) {
    const points = session?.dataPoints || [];
    if (!points.length || points.some((point) => point.distance > 0)) return session;
    let meters = 0;
    const dataPoints = points.map((point, index) => {
        if (index > 0) {
            const seconds = Math.min((point.timestamp - points[index - 1].timestamp) / 1000, 3);
            meters += ((point.speed || 0) / 3.6) * seconds;
        }
        return { ...point, distance: Math.round(meters) };
    });
    const metrics = session.metrics ? { ...session.metrics, distance: session.metrics.distance || Math.round(meters) } : session.metrics;
    return { ...session, dataPoints, metrics };
}

export const FEEDBACK_LIMITERS = ['legs', 'breathing', 'fatigue', 'none'];

/** Normaliza lo que escribe el usuario; null si no hay un RPE válido. */
export function normalizeFeedback(input) {
    const rpe = Math.round(Number(input?.rpe));
    if (!(rpe >= 1 && rpe <= 10)) return null;
    return {
        rpe,
        limiter: FEEDBACK_LIMITERS.includes(input.limiter) ? input.limiter : null,
        note: String(input.note || '').trim().slice(0, 280),
        submittedAt: new Date().toISOString(),
    };
}

/**
 * Guarda cómo se sintió el usuario (RPE, qué le limitó, nota) en la sesión.
 * Solo reescribe la sesión si sigue en el historial: una sesión descartada no debe resucitar.
 */
export async function saveSessionFeedback(session, input) {
    const feedback = normalizeFeedback(input);
    if (!feedback) throw new Error('Indica un esfuerzo percibido (RPE) de 1 a 10');
    session.feedback = feedback;
    const stored = session.id ? await getSession(session.id).catch(() => null) : null;
    if (stored) await saveSession(session);
    logAppEvent('session.feedback', {
        clientSessionId: session.clientSessionId,
        rpe: feedback.rpe,
        limiter: feedback.limiter,
        hasNote: Boolean(feedback.note),
        persisted: Boolean(stored),
    });
    return session;
}

export function exportToTCX(rawSession) {
    const session = withIntegratedDistance(rawSession);
    const startTime = new Date(session.startTime).toISOString();
    
    const trackpoints = session.dataPoints.map(p => `
        <Trackpoint>
          <Time>${new Date(p.timestamp).toISOString()}</Time>
          <DistanceMeters>${p.distance || 0}</DistanceMeters>
          <HeartRateBpm><Value>${p.heartRate || 0}</Value></HeartRateBpm>
          <Cadence>${p.cadence || 0}</Cadence>
          <Extensions>
            <TPX xmlns="http://www.garmin.com/xmlschemas/ActivityExtension/v2">
              <Watts>${p.power || 0}</Watts>
              <Speed>${(p.speed || 0) / 3.6}</Speed>
            </TPX>
            <ST xmlns="https://smart-trainer.local/tcx/v1">
              <TargetWatts>${p.targetPower ?? ''}</TargetWatts>
              <Resistance>${p.resistance ?? 0}</Resistance>
            </ST>
          </Extensions>
        </Trackpoint>`
    ).join('\n');
    
    return `<?xml version="1.0" encoding="UTF-8"?>
<TrainingCenterDatabase xmlns="http://www.garmin.com/xmlschemas/TrainingCenterDatabase/v2">
  <Activities>
    <Activity Sport="Biking">
      <Id>${startTime}</Id>
      <Lap StartTime="${startTime}">
        <TotalTimeSeconds>${session.duration}</TotalTimeSeconds>
        <DistanceMeters>${session.dataPoints[session.dataPoints.length - 1]?.distance || 0}</DistanceMeters>
        <Calories>${session.metrics?.energy?.calories || 0}</Calories>
        <Intensity>Active</Intensity>
        <TriggerMethod>Manual</TriggerMethod>
        <Track>
${trackpoints}
        </Track>
        <Extensions>
          <LX xmlns="http://www.garmin.com/xmlschemas/ActivityExtension/v2">
            <AvgWatts>${session.metrics?.power?.avg || 0}</AvgWatts>
            <MaxWatts>${session.metrics?.power?.max || 0}</MaxWatts>
          </LX>
        </Extensions>
      </Lap>
      <Creator>
        <Name>Smart Trainer Controller</Name>
      </Creator>
    </Activity>
  </Activities>
</TrainingCenterDatabase>`;
}

/**
 * Exportar sesión a CSV
 */
export function exportToCSV(rawSession) {
    const session = withIntegratedDistance(rawSession);
    const headers = ['timestamp', 'seconds', 'power', 'cadence', 'speed', 'heartRate', 'distance'];
    const rows = [headers.join(',')];
    
    session.dataPoints.forEach((p, i) => {
        rows.push([
            p.timestamp,
            // Segundos reales desde el inicio (el rodillo da ~0,9 muestras/s, así que el índice no sirve).
            Number.isFinite(p.elapsedSeconds) ? p.elapsedSeconds.toFixed(1) : i,
            p.power || 0,
            p.cadence || 0,
            (p.speed || 0).toFixed(1),
            p.heartRate || 0,
            p.distance || 0,
        ].join(','));
    });
    
    return rows.join('\n');
}

export async function getProgress() {
    await initDB();
    const record = await getStoreValue(PROGRESS_STORE, 'current');
    return record?.value || null;
}

export async function saveProgress(progress) {
    await initDB();
    await putStoreValue(PROGRESS_STORE, {
        key: 'current',
        value: progress,
        updatedAt: Date.now(),
    });
    return progress;
}

export async function enqueueSyncJob(type, payload) {
    await initDB();
    const job = {
        id: createUuid(),
        type,
        payload,
        attempts: 0,
        createdAt: Date.now(),
    };
    await putStoreValue(SYNC_OUTBOX_STORE, job);
    return job;
}

export async function getSyncJobs() {
    await initDB();
    return new Promise((resolve, reject) => {
        const request = db.transaction(SYNC_OUTBOX_STORE, 'readonly')
            .objectStore(SYNC_OUTBOX_STORE)
            .index('createdAt')
            .getAll();
        request.onsuccess = () => resolve(request.result || []);
        request.onerror = () => reject(request.error);
    });
}

export async function removeSyncJob(id) {
    await initDB();
    return new Promise((resolve, reject) => {
        const request = db.transaction(SYNC_OUTBOX_STORE, 'readwrite')
            .objectStore(SYNC_OUTBOX_STORE)
            .delete(id);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
    });
}

// === Utilidades ===

function getStoreValue(storeName, key) {
    return new Promise((resolve, reject) => {
        const request = db.transaction(storeName, 'readonly').objectStore(storeName).get(key);
        request.onsuccess = () => resolve(request.result || null);
        request.onerror = () => reject(request.error);
    });
}

function putStoreValue(storeName, value) {
    return new Promise((resolve, reject) => {
        const request = db.transaction(storeName, 'readwrite').objectStore(storeName).put(value);
        request.onsuccess = () => resolve(value);
        request.onerror = () => reject(request.error);
    });
}

function generateId() {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

function createUuid() {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
        return crypto.randomUUID();
    }
    return generateId();
}

function normalizeSession(session) {
    if (session.schemaVersion === 2) return session;
    return {
        ...session,
        schemaVersion: 2,
        clientSessionId: session.clientSessionId || session.id,
        activeDuration: session.activeDuration ?? session.duration ?? 0,
        pausedDuration: session.pausedDuration ?? 0,
        controlMode: session.controlMode || 'manual',
        experienceMode: session.experienceMode || 'metrics',
        routeId: session.routeId ?? null,
        routeName: session.routeName ?? null,
        adherence: session.adherence || null,
        gameResult: session.gameResult || null,
    };
}

function formatDuration(seconds) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    
    if (hours > 0) {
        return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
}
