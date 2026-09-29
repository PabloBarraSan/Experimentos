const STORAGE_KEY = 'smartTrainer_session_debug_v1';
const MAX_ENTRIES = 500;

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

function readEntries() {
    try {
        const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return [];
    }
}

function writeEntries(entries) {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(entries.slice(-MAX_ENTRIES)));
    } catch (error) {
        // El registro no debe interrumpir nunca el entrenamiento si el almacenamiento falla.
        console.warn('[SESSION_DEBUG] No se pudo guardar el log:', error);
    }
}

export function createSessionDebugLogger(context = {}) {
    const sessionId = context.sessionId || `debug-${Date.now()}`;
    const logger = {
        sessionId,
        log(event, details = {}) {
            const entry = {
                timestamp: new Date().toISOString(),
                epochMs: Date.now(),
                sessionId,
                event,
                ...Object.fromEntries(Object.entries(details).map(([key, value]) => [key, safeValue(value)])),
            };
            const entries = readEntries();
            entries.push(entry);
            writeEntries(entries);
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
    if (typeof window !== 'undefined') {
        window.smartTrainerDebug = {
            getLog: () => readEntries(),
            clearLog: () => localStorage.removeItem(STORAGE_KEY),
        };
    }
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
