import { ResistanceErgController } from './ResistanceErgController.js';

// El control por resistencia en lazo cerrado es opcional: la prueba de resistencia del D100 mostró que su ERG
// nativo cumple hasta el tope físico del rodillo y que la resistencia manual no llega más lejos.
export const ERG_MODES = ['auto', 'native', 'resistance'];

// Resistencia (%) usada como equivalente a una simulación llana si no hay simulación.
const FLAT_RESISTANCE_PERCENT = 20;

export class TrainerAdapter {
    constructor(bluetoothManager = null, capabilities = null, { ergMode = 'auto', deviceName = '' } = {}) {
        this.manager = bluetoothManager;
        this.capabilities = capabilities || {};
        this.ergMode = ERG_MODES.includes(ergMode) ? ergMode : 'auto';
        this.deviceName = deviceName || '';
        this.ergController = null;
        this.resistanceInFlight = false;
        this.resistanceFailures = 0;
        this.controlMode = 'manual';
        this.lastTargetKey = null;
        this.commandLog = [];
    }

    /** ¿El usuario ha elegido el ERG por resistencia? Solo con el ajuste explícito. */
    usesResistanceErg() {
        if (this.capabilities.resistanceTargetSupported === false) return false;
        return this.ergMode === 'resistance';
    }

    async applyTarget(target, { force = false } = {}) {
        if (!this.manager || !target) return { mode: 'manual', applied: false };

        if (Number.isFinite(target.power) && this.usesResistanceErg()) {
            return this.applyResistanceErg(target, { force });
        }
        this.ergController = null;

        const targetKey = `${target.power ?? ''}:${target.resistance ?? ''}`;
        if (!force && targetKey === this.lastTargetKey) {
            return { mode: this.controlMode, applied: true, deduplicated: true };
        }

        if (Number.isFinite(target.power) && this.capabilities.powerTargetSupported !== false) {
            const result = await this.runCommand('erg', target.power, () => this.manager.setTargetPower(target.power));
            if (result.applied) {
                this.lastTargetKey = targetKey;
                return result;
            }
        }

        if (Number.isFinite(target.resistance)) {
            const result = await this.runCommand('resistance', target.resistance, () => this.manager.setResistance(target.resistance));
            if (result.applied) {
                this.lastTargetKey = targetKey;
                return result;
            }
        }

        return { mode: 'manual', applied: false, error: 'El rodillo no admite el objetivo de este bloque. Control manual requerido.' };
    }

    async applyResistanceErg(target, { force }) {
        const targetKey = `erg-resistance:${target.power}`;
        if (!force && targetKey === this.lastTargetKey) {
            return { mode: this.controlMode, applied: true, deduplicated: true };
        }
        if (!this.ergController) this.ergController = new ResistanceErgController();
        const level = this.ergController.setTarget(target.power);
        if (level === null) return { mode: 'manual', applied: false, error: 'Objetivo de potencia no válido' };
        const result = await this.runCommand('erg_resistance', level, () => this.manager.setResistance(level));
        if (result.applied) this.lastTargetKey = targetKey;
        return result;
    }

    /**
     * Medida de potencia/cadencia para el lazo cerrado del ERG por resistencia.
     * Llega con cada paquete del rodillo; el controlador limita el ritmo de comandos.
     */
    feedback({ power, cadence, timestamp = Date.now() }) {
        if (!this.ergController || this.controlMode !== 'erg_resistance' || this.resistanceInFlight) return;
        const level = this.ergController.update({ power, cadence, timestamp });
        if (level === null) return;
        this.resistanceInFlight = true;
        Promise.resolve()
            .then(() => this.manager.setResistance(level))
            .then(() => { this.resistanceFailures = 0; })
            .catch((error) => {
                this.resistanceFailures++;
                this.ergController.reset();
                this.commandLog.push({ timestamp: Date.now(), mode: 'erg_resistance', value: level, success: false, error: error?.message || String(error) });
            })
            .finally(() => { this.resistanceInFlight = false; });
    }

    /**
     * Pone el rodillo en simulación llana (sin ERG) para que el usuario use los cambios libremente.
     * Usa la simulación indoor bike si existe y, si no, una resistencia baja equivalente.
     */
    async applyFlatSimulation({ force = false } = {}) {
        if (!this.manager) return { mode: 'manual', applied: false };
        if (!force && this.lastTargetKey === 'sim') {
            return { mode: this.controlMode, applied: true, deduplicated: true };
        }
        const simulate = this.manager.setIndoorBikeSimulation
            ? (...args) => this.manager.setIndoorBikeSimulation(...args)
            : this.manager.commandQueue?.setIndoorBikeSimulation
                ? (...args) => this.manager.commandQueue.setIndoorBikeSimulation(...args)
                : null;
        if (simulate) {
            const result = await this.runCommand('sim', 0, () => simulate(0, 0, 0.004, 0.51));
            if (result.applied) {
                this.lastTargetKey = 'sim';
                return result;
            }
        }
        if (typeof this.manager.setResistance === 'function') {
            const result = await this.runCommand('resistance', FLAT_RESISTANCE_PERCENT, () => this.manager.setResistance(FLAT_RESISTANCE_PERCENT));
            if (result.applied) {
                this.lastTargetKey = 'sim';
                return result;
            }
        }
        return { mode: 'manual', applied: false, error: 'El rodillo no admite el modo libre. Control manual requerido.' };
    }

    async runCommand(mode, value, command) {
        let lastError = null;
        for (let attempt = 1; attempt <= 2; attempt++) {
            try {
                await command();
                this.controlMode = mode;
                const entry = { timestamp: Date.now(), mode, value, attempt, success: true };
                this.commandLog.push(entry);
                return { mode, value, applied: true, attempt };
            } catch (error) {
                lastError = error;
                this.commandLog.push({ timestamp: Date.now(), mode, value, attempt, success: false, error: error?.message || String(error) });
            }
        }
        this.controlMode = 'manual';
        return { mode: 'manual', value, applied: false, error: lastError?.message || 'El rodillo no confirmó el objetivo' };
    }

    getDiagnosticLog() {
        return this.commandLog.map((entry) => ({ ...entry }));
    }

    async pause() {
        try {
            await this.manager?.stopTraining?.(true);
        } catch {
            // La sesión local se pausa aunque el rodillo no responda.
        }
    }

    async start() {
        this.lastTargetKey = null;
        if (!this.manager) return;
        const result = await this.runCommand('start', null, () => this.manager.startTraining());
        if (!result.applied) throw new Error(`No se pudo arrancar el rodillo: ${result.error}`);
    }

    async resume() {
        this.ergController?.reset();
        this.lastTargetKey = null;
        try {
            await this.manager?.startTraining?.();
        } catch {
            // Se conserva el modo manual como fallback.
        }
    }
}
