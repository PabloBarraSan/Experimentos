import { createTelemetryPipeline } from '../telemetry/TelemetryPipeline.js';
import { inspectIndoorBikePacket } from './inspectIndoorBikePacket.js';

const SAFE_ERG_TARGETS = new Set([80, 120, 160]);
const SAFE_RESISTANCE_TARGETS = new Set([0, 20, 35]);
const MAX_SAMPLES = 600;

export class DiagnosticSafetyError extends Error {
    constructor(message) {
        super(message);
        this.name = 'DiagnosticSafetyError';
    }
}

export class TrainerDiagnosticSession {
    constructor({
        manager,
        capabilities = {},
        deviceName = 'Rodillo desconocido',
        simulated = false,
        now = () => Date.now(),
    }) {
        this.manager = manager;
        this.capabilities = { ...(capabilities || {}) };
        this.deviceName = deviceName;
        this.simulated = simulated;
        this.now = now;
        this.startedAt = new Date(this.now()).toISOString();
        this.samples = [];
        this.totalSamples = 0;
        this.events = [];
        this.commandResults = [];
        this.activeTargetPower = null;
        this.telemetryPipeline = createTelemetryPipeline();
    }

    recordTelemetry(data, timestamp = data?.rawFtms?.timestamp ?? this.now()) {
        if (!data) return null;
        const sample = {
            timestamp,
            power: finiteOrNull(data.power),
            cadence: finiteOrNull(data.cadence),
            speed: finiteOrZero(data.speed),
            heartRate: finiteOrZero(data.heartRate),
            resistance: finiteOrZero(data.resistance),
            targetPower: this.activeTargetPower,
            cadencePeriodTicks: Number.isFinite(Number(data.cadencePeriodTicks))
                ? Number(data.cadencePeriodTicks)
                : null,
            cadenceEncoding: data.cadenceEncoding || null,
            rawFtms: data.rawFtms ? sanitizeDetails(data.rawFtms) : null,
        };
        sample.processed = this.telemetryPipeline.ingest(data, timestamp);
        sample.packetInspection = data.rawFtms?.bytes ? inspectIndoorBikePacket(data.rawFtms.bytes) : null;
        this.totalSamples += 1;
        this.samples.push(sample);
        if (this.samples.length > MAX_SAMPLES) this.samples.shift();
        return sample;
    }

    addEvent(type, details = {}) {
        const event = { timestamp: this.now(), type, details: sanitizeDetails(details) };
        this.events.push(event);
        return event;
    }

    markReference({ cadence = null, power = null } = {}) {
        const valid = (value) => value !== null && Number.isFinite(value) && value >= 0;
        if (!valid(cadence) && !valid(power)) throw new Error('Introduce al menos una referencia válida; cero también es válido.');
        const now = this.now();
        const recent = this.samples.filter((sample) => sample.timestamp >= now - 5000 && sample.timestamp <= now);
        if (!recent.length) throw new Error('No hay paquetes en los últimos 5 segundos.');
        const average = (values) => values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
        const appCadence = average(recent.map((sample) => sample.cadence).filter(Number.isFinite));
        const appPower = average(recent.map((sample) => sample.power).filter(Number.isFinite));
        return this.addEvent('reference_mark', {
            cadence: valid(cadence) ? cadence : null,
            power: valid(power) ? power : null,
            appCadence, appPower,
            cadenceError: valid(cadence) && appCadence !== null ? appCadence - cadence : null,
            powerError: valid(power) && appPower !== null ? appPower - power : null,
            periodCadence: average(recent.map((sample) => sample.packetInspection?.vendorHypotheses?.periodCadence).filter(Number.isFinite)),
            sampleCount: recent.length,
            windowMs: 5000,
            packets: recent.map((sample) => ({ timestamp: sample.timestamp, rawFtms: sample.rawFtms })),
        });
    }

    async setErg(watts) {
        if (!SAFE_ERG_TARGETS.has(watts)) {
            throw new DiagnosticSafetyError('Objetivo ERG fuera del protocolo seguro');
        }
        if (this.capabilities.powerTargetSupported === false) {
            throw new DiagnosticSafetyError('El rodillo declara que no soporta potencia objetivo');
        }
        const result = await this.runCommand('set_erg', { watts }, () => this.manager.setTargetPower(watts));
        this.activeTargetPower = watts;
        return result;
    }

    async setResistance(percent) {
        if (!SAFE_RESISTANCE_TARGETS.has(percent)) {
            throw new DiagnosticSafetyError('Resistencia fuera del protocolo seguro');
        }
        if (this.capabilities.resistanceTargetSupported === false) {
            throw new DiagnosticSafetyError('El rodillo declara que no soporta resistencia objetivo');
        }
        const result = await this.runCommand('set_resistance', { percent }, () => this.manager.setResistance(percent));
        this.activeTargetPower = null;
        return result;
    }

    async pauseAndRelease() {
        const result = await this.runCommand('pause_and_release', {}, async () => {
            await this.manager.stopTraining(true);
        });
        this.activeTargetPower = null;
        return result;
    }

    async resume() {
        return this.runCommand('resume', {}, () => this.manager.startTraining());
    }

    async runCommand(type, input, action) {
        if (!this.manager) throw new DiagnosticSafetyError('No hay un rodillo disponible');
        const startedAt = this.now();
        try {
            const response = await action();
            const result = {
                type,
                input,
                success: true,
                latencyMs: Math.max(0, this.now() - startedAt),
                timestamp: startedAt,
                response: sanitizeDetails(response),
            };
            this.commandResults.push(result);
            return result;
        } catch (error) {
            const result = {
                type,
                input,
                success: false,
                latencyMs: Math.max(0, this.now() - startedAt),
                timestamp: startedAt,
                error: error?.message || String(error),
            };
            this.commandResults.push(result);
            throw error;
        }
    }

    getSummary() {
        const powers = this.samples.map((sample) => sample.power).filter(Number.isFinite);
        const cadences = this.samples.map((sample) => sample.cadence).filter(Number.isFinite);
        const successfulCommands = this.commandResults.filter((result) => result.success);
        const rawSamples = this.samples.filter((sample) => sample.rawFtms);
        const flags = rawSamples.reduce((counts, sample) => {
            const key = sample.rawFtms.flagsHex || String(sample.rawFtms.flags);
            counts[key] = (counts[key] || 0) + 1;
            return counts;
        }, {});
        const suspiciousSamples = this.samples.filter(
            (sample) => sample.targetPower >= 80 && sample.cadence >= 100 && sample.power <= 10
        );
        return {
            sampleCount: this.samples.length,
            totalSampleCount: this.totalSamples,
            droppedSampleCount: this.totalSamples - this.samples.length,
            power: summarizeValues(powers),
            cadence: summarizeValues(cadences),
            telemetry: {
                rawSampleCount: rawSamples.length,
                flags,
                suspiciousSampleCount: suspiciousSamples.length,
                ergWindows: this.getErgWindows(),
            },
            commands: {
                total: this.commandResults.length,
                successful: successfulCommands.length,
                failed: this.commandResults.length - successfulCommands.length,
                averageLatencyMs: successfulCommands.length
                    ? Math.round(successfulCommands.reduce((sum, result) => sum + result.latencyMs, 0) / successfulCommands.length)
                    : null,
            },
        };
    }

    getReport() {
        return {
            schemaVersion: 3,
            generatedAt: new Date(this.now()).toISOString(),
            startedAt: this.startedAt,
            simulated: this.simulated,
            trainer: {
                name: this.deviceName,
                capabilities: this.capabilities,
                resistanceRange: this.manager?.resistanceRange || null,
                powerRange: this.manager?.powerRange || null,
                commandQueueMetrics: this.manager?.commandQueue?.getMetrics?.() || null,
                bluetoothLog: this.manager?.getDiagnosticLog?.() || null,
            },
            environment: {
                userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'test',
                platform: typeof navigator !== 'undefined' ? navigator.platform : 'test',
                secureContext: typeof window !== 'undefined' ? window.isSecureContext : true,
            },
            summary: this.getSummary(),
            commands: [...this.commandResults],
            events: [...this.events],
            samples: [...this.samples],
        };
    }

    getErgWindows() {
        const ergCommands = this.commandResults.filter(
            (command) => command.success && command.type === 'set_erg'
        );
        return ergCommands.map((command, index) => {
            const nextCommand = this.commandResults.find(
                (candidate) => candidate.timestamp > command.timestamp
                    && ['set_erg', 'set_resistance', 'pause_and_release'].includes(candidate.type)
            );
            const windowEnd = Math.min(
                command.timestamp + 10000,
                nextCommand?.timestamp ?? Number.POSITIVE_INFINITY
            );
            const samples = this.samples.filter(
                (sample) => sample.timestamp >= command.timestamp && sample.timestamp <= windowEnd
            );
            const settledSamples = samples.filter(
                (sample) => sample.timestamp >= command.timestamp + 3000
            );
            const measured = settledSamples.length ? settledSamples : samples;
            const powers = measured.map((sample) => sample.power).filter(Number.isFinite);
            const cadences = measured.map((sample) => sample.cadence).filter(Number.isFinite);
            const averagePower = powers.length
                ? Math.round(powers.reduce((sum, value) => sum + value, 0) / powers.length)
                : null;
            return {
                sequence: index + 1,
                targetPower: command.input.watts,
                sampleCount: samples.length,
                settledSampleCount: settledSamples.length,
                averagePower,
                averageCadence: cadences.length
                    ? Math.round(cadences.reduce((sum, value) => sum + value, 0) / cadences.length)
                    : null,
                averageAbsoluteError: averagePower === null
                    ? null
                    : Math.abs(command.input.watts - averagePower),
            };
        });
    }
}

export function createTrainerSimulator({ latencyMs = 35 } = {}) {
    const state = {
        running: true,
        targetPower: 120,
        resistance: 20,
        commandLog: [],
    };

    const respond = (type, value) => new Promise((resolve) => {
        setTimeout(() => {
            state.commandLog.push({ type, value, timestamp: Date.now() });
            resolve({ success: true, simulated: true });
        }, latencyMs);
    });

    return {
        capabilities: {
            powerMeasurementSupported: true,
            cadenceSupported: true,
            powerTargetSupported: true,
            resistanceTargetSupported: true,
            indoorBikeSimulationSupported: true,
        },
        resistanceRange: { minimum: 0, maximum: 100, increment: 1 },
        commandQueue: {
            getMetrics: () => ({
                total: state.commandLog.length,
                success: state.commandLog.length,
                failed: 0,
                timeouts: 0,
            }),
        },
        async setTargetPower(watts) {
            state.targetPower = watts;
            return respond('setTargetPower', watts);
        },
        async setResistance(percent) {
            state.resistance = percent;
            return respond('setResistance', percent);
        },
        async stopTraining() {
            state.running = false;
            return respond('stopTraining', true);
        },
        async startTraining() {
            state.running = true;
            return respond('startTraining', true);
        },
        sample(timestamp = Date.now()) {
            const wave = Math.sin(timestamp / 900) * 5;
            return {
                power: state.running ? Math.max(0, Math.round(state.targetPower + wave)) : 0,
                cadence: state.running ? 88 + Math.round(wave / 3) : 0,
                speed: state.running ? 27.5 + wave / 10 : 0,
                heartRate: state.running ? 132 + Math.round(wave / 2) : 98,
                resistance: state.resistance,
            };
        },
        getState: () => ({ ...state, commandLog: [...state.commandLog] }),
    };
}

export function createTelemetryReplay(trace, { loop = false } = {}) {
    const samples = typeof trace === 'string' ? JSON.parse(trace) : trace;
    if (!Array.isArray(samples) || !samples.length) throw new Error('La traza no contiene muestras');
    let index = 0;
    return {
        next() {
            if (index >= samples.length) {
                if (!loop) return { done: true, value: null };
                index = 0;
            }
            const value = samples[index++];
            return { done: false, value: sanitizeDetails(value.processed?.raw || value) };
        },
        reset() { index = 0; },
        get length() { return samples.length; },
    };
}

export function getDiagnosticTargets() {
    return {
        erg: [...SAFE_ERG_TARGETS],
        resistance: [...SAFE_RESISTANCE_TARGETS],
    };
}

function finiteOrZero(value) {
    return Number.isFinite(Number(value)) ? Number(value) : 0;
}

function finiteOrNull(value) {
    return value !== null && value !== undefined && Number.isFinite(Number(value)) ? Number(value) : null;
}

function summarizeValues(values) {
    if (!values.length) return { min: null, max: null, average: null };
    return {
        min: Math.min(...values),
        max: Math.max(...values),
        average: Math.round(values.reduce((sum, value) => sum + value, 0) / values.length),
    };
}

function sanitizeDetails(value) {
    if (value === undefined) return null;
    try {
        return JSON.parse(JSON.stringify(value));
    } catch {
        return String(value);
    }
}
