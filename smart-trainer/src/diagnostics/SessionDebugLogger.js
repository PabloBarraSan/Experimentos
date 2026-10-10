const STORAGE_KEY = 'smartTrainer_session_debug_v1';
// Una sesión de ~1 h con un tick cada 5 s ya son ~700 entradas: el tope debe dejar espacio
// para que el inicio de la sesión siga en el log cuando termina.
const MAX_ENTRIES = 3000;
const FLUSH_DELAY_MS = 2000;
const APP_SESSION_ID = 'app';

let activeLogger = null;

function safeValue(value) {
    if (value instanceof Error) {
        return { name: value.name, message: value.message, stack: value.stack };
    }
    if (value === undefined) return null;
    try {
        JSON.stringify(value);
        return value;
    } catch {
        return String(value);
    }
}

function readStoredEntries() {
    try {
        const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return [];
    }
}

// Las entradas viven en memoria y se persisten con retraso: reescribir el JSON completo en cada
// evento sería caro con miles de entradas y competiría con el bucle de la sesión.
let cache = null;
let flushTimer = null;

function readEntries() {
    if (!cache) cache = readStoredEntries();
    return cache;
}

function persistEntries() {
    flushTimer = null;
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(readEntries().slice(-MAX_ENTRIES)));
    } catch (error) {
        // El registro no debe interrumpir nunca el entrenamiento si el almacenamiento falla.
        console.warn('[SESSION_DEBUG] No se pudo guardar el log:', error);
    }
}

function appendEntry(entry) {
    const entries = readEntries();
    entries.push(entry);
    if (entries.length > MAX_ENTRIES) entries.splice(0, entries.length - MAX_ENTRIES);
    if (!flushTimer) flushTimer = setTimeout(persistEntries, FLUSH_DELAY_MS);
}

function buildEntry(sessionId, event, details) {
    return {
        timestamp: new Date().toISOString(),
        epochMs: Date.now(),
        sessionId,
        event,
        ...Object.fromEntries(Object.entries(details).map(([key, value]) => [key, safeValue(value)])),
    };
}

function installGlobalHandle() {
    if (typeof window === 'undefined') return;
    window.smartTrainerDebug = {
        getLog: () => [...readEntries()],
        clearLog: () => {
            cache = [];
            localStorage.removeItem(STORAGE_KEY);
        },
        download: downloadDebugLog,
    };
    if (!window.__smartTrainerDebugFlushHook) {
        window.__smartTrainerDebugFlushHook = true;
        window.addEventListener('pagehide', () => { if (flushTimer) persistEntries(); });
    }
}

/** Evento de la aplicación fuera de una sesión (guardado, sync, plan…). Nunca lanza. */
export function logAppEvent(event, details = {}) {
    try {
        const entry = buildEntry(APP_SESSION_ID, event, details);
        appendEntry(entry);
        console.info('[SESSION_DEBUG]', event, entry);
        installGlobalHandle();
    } catch {
        // Un fallo de logging no puede afectar a la app.
    }
}

/** Descarga el log completo como JSON, con datos del entorno para poder reproducir. */
export function downloadDebugLog() {
    if (flushTimer) persistEntries();
    const payload = {
        generatedAt: new Date().toISOString(),
        environment: {
            userAgent: navigator.userAgent,
            online: navigator.onLine,
            url: location.href,
        },
        entries: readEntries(),
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `smart-trainer-log-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(link.href), 1000);
    return payload.entries.length;
}

export function createSessionDebugLogger(context = {}) {
    const sessionId = context.sessionId || `debug-${Date.now()}`;
    const logger = {
        sessionId,
        log(event, details = {}) {
            const entry = buildEntry(sessionId, event, details);
            appendEntry(entry);
            console.info('[SESSION_DEBUG]', event, entry);
            return entry;
        },
        getEntries() {
            return readEntries().filter((entry) => entry.sessionId === sessionId);
        },
        getAllEntries() {
            return readEntries();
        },
    };

    activeLogger = logger;
    installGlobalHandle();
    return logger;
}

export function releaseSessionDebugLogger(logger) {
    if (activeLogger === logger) activeLogger = null;
}

export function logActiveSessionEvent(event, details = {}) {
    activeLogger?.log(event, details);
}

export function logActiveSessionError(event, error, details = {}) {
    activeLogger?.log(event, { ...details, error });
}

export function installSessionDebugHooks() {
    if (typeof window === 'undefined' || window.__smartTrainerSessionDebugHooks) return () => {};
    window.__smartTrainerSessionDebugHooks = true;

    const onError = (event) => {
        activeLogger?.log('window.error', {
            message: event.message,
            filename: event.filename,
            line: event.lineno,
            column: event.colno,
            error: event.error,
        });
    };
    const onUnhandledRejection = (event) => {
        activeLogger?.log('window.unhandledrejection', { reason: event.reason });
    };
    window.addEventListener('error', onError);
    window.addEventListener('unhandledrejection', onUnhandledRejection);
    // Son hooks globales de la aplicación: se mantienen instalados entre vistas.
    // El logger activo se libera al destruir el SessionController.
    return () => {};
}
