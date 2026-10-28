/**
 * ERG por resistencia: lleva la potencia a un objetivo ajustando el nivel de resistencia (0-100 %)
 * en lazo cerrado, para rodillos cuyo ERG nativo se queda corto (p. ej. el D100 no endurece más de
 * ~250 W y obliga a subir la cadencia, mientras que su modo de resistencia sí llega).
 *
 * Es un controlador puro: recibe potencia y cadencia medidas y devuelve el nivel a enviar (o null).
 * La potencia es aproximadamente proporcional a la resistencia a cadencia constante, así que el
 * ajuste es multiplicativo: no necesita conocer la escala de cada rodillo.
 */

const DEFAULTS = {
    minResistance: 0,
    maxResistance: 100,
    startResistance: 30,       // nivel inicial hasta que el lazo converge
    floorWhenPedaling: 5,      // por debajo de esto no hay carga útil: el lazo no podría subir
    minCadence: 25,            // sin pedaleo real se mantiene el nivel, no se integra
    deadband: 0.03,            // error relativo que se tolera sin tocar la resistencia
    exponent: 0.6,             // 1 = corrección completa por muestra; menos = más suave
    maxUp: 1.3,                // factor máximo por ajuste
    maxDown: 0.8,
    minIntervalMs: 1000,       // el rodillo recibe como mucho un comando por segundo
    minStep: 1,                // cambios de menos de un punto no se envían
};

export class ResistanceErgController {
    constructor(options = {}) {
        this.options = { ...DEFAULTS, ...options };
        this.resistance = this.options.startResistance;
        this.target = null;
        this.lastSentAt = 0;
        this.lastSent = null;
    }

    /** Nuevo objetivo en vatios. Devuelve el nivel inicial a enviar. */
    setTarget(watts, timestamp = Date.now()) {
        const next = Number(watts);
        if (!(next > 0)) {
            this.target = null;
            return null;
        }
        // La potencia escala con la resistencia: se reaprovecha el nivel aprendido en lugar de reconverger.
        if (this.target > 0) {
            this.resistance = this.clamp(this.resistance * Math.min(2, Math.max(0.5, next / this.target)));
        }
        this.target = next;
        return this.sendable(timestamp, true);
    }

    /**
     * @param {{ power: number, cadence: number, timestamp?: number }} sample potencia y cadencia medidas
     * @returns {number|null} nivel de resistencia a enviar, o null si no hay que cambiar nada
     */
    update({ power, cadence, timestamp = Date.now() }) {
        const { minCadence, deadband, exponent, maxUp, maxDown, floorWhenPedaling } = this.options;
        if (!(this.target > 0)) return null;
        if (!(cadence >= minCadence)) return null;
        if (timestamp - this.lastSentAt < this.options.minIntervalMs) return null;

        const measured = Math.max(0, Number(power) || 0);
        const error = (this.target - measured) / this.target;
        if (Math.abs(error) <= deadband) return null;

        const ratio = measured > 1 ? this.target / measured : maxUp;
        const factor = Math.min(maxUp, Math.max(maxDown, Math.pow(ratio, exponent)));
        const base = Math.max(this.resistance, floorWhenPedaling);
        this.resistance = this.clamp(base * factor);
        return this.sendable(timestamp);
    }

    /** Tras una pausa se vuelve a enviar el nivel actual. */
    reset() {
        this.lastSent = null;
        this.lastSentAt = 0;
    }

    clamp(value) {
        return Math.min(this.options.maxResistance, Math.max(this.options.minResistance, value));
    }

    sendable(timestamp, force = false) {
        const level = Math.round(this.resistance);
        if (!force && this.lastSent !== null && Math.abs(level - this.lastSent) < this.options.minStep) return null;
        this.lastSent = level;
        this.lastSentAt = timestamp;
        return level;
    }
}
