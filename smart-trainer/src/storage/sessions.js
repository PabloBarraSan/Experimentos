/**
 * Sessions Storage - Gestión de sesiones de entrenamiento
 * Smart Trainer Controller
 * 
 * Usa IndexedDB para almacenar sesiones de entrenamiento
 */

const DB_NAME = 'SmartTrainerDB';
const DB_VERSION = 1;
const SESSIONS_STORE = 'sessions';

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
        };
    });
}

/**
 * Crear una nueva sesión
 */
export function createSession(options = {}) {
    const {
        workoutId = null,
        workoutName = 'Entrenamiento Libre',
        ftp = 200,
    } = options;
    
    return {
        id: generateId(),
        workoutId,
        workoutName,
        ftp,
        date: new Date().toISOString(),
        startTime: Date.now(),
        endTime: null,
        duration: 0,
        dataPoints: [],
        status: 'active', // 'active', 'paused', 'completed', 'discarded'
        metrics: null,    // Se calculan al finalizar
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
            resolve(request.result);
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
                sessions.push(cursor.value);
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
export async function finishSession(session, metrics) {
    session.endTime = Date.now();
    session.duration = (session.endTime - session.startTime) / 1000;
    session.status = 'completed';
    session.metrics = metrics;
    
    await saveSession(session);
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
        return null;
    }
    
    await saveSession(session);
    return session;
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
    // TODO: Implementar exportación real a .fit
    // Por ahora, exportamos a un formato JSON compatible
    const fit = {
        fileId: {
            type: 'activity',
            manufacturer: 'SmartTrainer',
            product: 1,
            serialNumber: 1,
            timeCreated: session.startTime,
        },
        activity: {
            timestamp: session.startTime,
            totalTimerTime: session.duration,
            numSessions: 1,
        },
        session: {
            sport: 'cycling',
            subSport: 'indoor_cycling',
            startTime: session.startTime,
            totalElapsedTime: session.duration,
            totalTimerTime: session.duration,
            avgPower: session.metrics?.power?.avg,
            maxPower: session.metrics?.power?.max,
            normalizedPower: session.metrics?.power?.normalized,
            trainingStressScore: session.metrics?.intensity?.tss,
            intensityFactor: session.metrics?.intensity?.if,
        },
        records: session.dataPoints.map((p, i) => ({
            timestamp: p.timestamp,
            power: p.power,
            cadence: p.cadence,
            speed: p.speed,
            heartRate: p.heartRate,
            distance: p.distance,
        })),
    };
    
    return JSON.stringify(fit, null, 2);
}

/**
 * Exportar sesión a formato .tcx (Training Center XML)
 */
export function exportToTCX(session) {
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
export function exportToCSV(session) {
    const headers = ['timestamp', 'seconds', 'power', 'cadence', 'speed', 'heartRate', 'distance'];
    const rows = [headers.join(',')];
    
    session.dataPoints.forEach((p, i) => {
        rows.push([
            p.timestamp,
            i,
            p.power || 0,
            p.cadence || 0,
            (p.speed || 0).toFixed(1),
            p.heartRate || 0,
            p.distance || 0,
        ].join(','));
    });
    
    return rows.join('\n');
}

// === Utilidades ===

function generateId() {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

function formatDuration(seconds) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    
    if (hours > 0) {
        return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
}
