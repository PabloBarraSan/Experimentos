/**
 * Reconexión BLE con espera creciente - Smart Trainer Controller
 *
 * Tras un `gattserverdisconnected` se reintenta con el mismo BluetoothDevice
 * (gatt.connect() no necesita gesto del usuario; requestDevice sí).
 */

// Espera antes de cada intento. El último valor se repite si se pide seguir indefinidamente.
export const RECONNECT_DELAYS_MS = [1000, 2000, 4000, 8000, 15000, 15000, 15000, 15000, 15000, 30000];

// Un gatt.connect() a un dispositivo fuera de alcance puede quedarse colgado mucho tiempo.
export const RECONNECT_ATTEMPT_TIMEOUT_MS = 10000;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export function withTimeout(promise, ms, onTimeout = () => {}) {
    let timer;
    const timeout = new Promise((_, reject) => {
        timer = setTimeout(() => {
            onTimeout();
            reject(new Error(`Sin respuesta en ${Math.round(ms / 1000)} s`));
        }, ms);
    });
    return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

/**
 * Reintenta `connect` hasta que funcione o `shouldStop()` diga que hay que parar.
 * @param {Object} options
 * @param {() => Promise} options.connect - Un intento de conexión completo
 * @param {() => boolean} [options.shouldStop] - Cancelación (desconexión manual, ya conectado...)
 * @param {(attempt: number) => void} [options.onAttempt] - Antes de cada intento
 * @param {(attempt: number, error: Error) => void} [options.onFailure] - Tras cada intento fallido
 * @param {number[]} [options.delays] - Espera antes de cada intento
 * @param {boolean} [options.forever] - Repetir el último retardo sin límite de intentos
 * @param {number} [options.attemptTimeoutMs]
 * @param {() => void} [options.onAttemptTimeout] - Para cancelar el intento colgado
 * @param {(ms: number) => Promise} [options.wait]
 * @returns {Promise<boolean>} true si reconectó
 */
export async function reconnectWithBackoff({
    connect,
    shouldStop = () => false,
    onAttempt = () => {},
    onFailure = () => {},
    delays = RECONNECT_DELAYS_MS,
    forever = false,
    attemptTimeoutMs = RECONNECT_ATTEMPT_TIMEOUT_MS,
    onAttemptTimeout = () => {},
    wait = sleep,
}) {
    for (let attempt = 1; forever || attempt <= delays.length; attempt++) {
        await wait(delays[Math.min(attempt, delays.length) - 1]);
        if (shouldStop()) return false;
        onAttempt(attempt);
        try {
            await withTimeout(connect(), attemptTimeoutMs, onAttemptTimeout);
            return true;
        } catch (error) {
            if (shouldStop()) return false;
            onFailure(attempt, error);
        }
    }
    return false;
}
