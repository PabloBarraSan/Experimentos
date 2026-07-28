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
        this.events = [];
        this.commandResults = [];
    }

    recordTelemetry(data, timestamp = this.now()) {
        if (!data) return null;
        const sample = {
            timestamp,
            power: finiteOrZero(data.power),
            cadence: finiteOrZero(data.cadence),
            speed: finiteOrZero(data.speed),
            heartRate: finiteOrZero(data.heartRate),
            resistance: finiteOrZero(data.resistance),
        };
        this.samples.push(sample);
        if (this.samples.length > MAX_SAMPLES) this.samples.shift();
        return sample;
    }

    addEvent(type, details = {}) {
        const event = { timestamp: this.now(), type, details: sanitizeDetails(details) };
        this.events.push(event);
        return event;
    }

    async setErg(watts) {
        if (!SAFE_ERG_TARGETS.has(watts)) {
            throw new DiagnosticSafetyError('Objetivo ERG fuera del protocolo seguro');
        }
        if (this.capabilities.powerTargetSupported === false) {
            throw new DiagnosticSafetyError('El rodillo declara que no soporta potencia objetivo');
        }
        return this.runCommand('set_erg', { watts }, () => this.manager.setTargetPower(watts));
    }

    async setResistance(percent) {
        if (!SAFE_RESISTANCE_TARGETS.has(percent)) {
            throw new DiagnosticSafetyError('Resistencia fuera del protocolo seguro');
        }
        if (this.capabilities.resistanceTargetSupported === false) {
            throw new DiagnosticSafetyError('El rodillo declara que no soporta resistencia objetivo');
        }
        return this.runCommand('set_resistance', { percent }, () => this.manager.setResistance(percent));
    }

    async pauseAndRelease() {
        return this.runCommand('pause_and_release', {}, async () => {
            await this.manager.stopTraining(true);
        });
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
        const powers = this.samples.map((sample) => sample.power);
        const cadences = this.samples.map((sample) => sample.cadence);
        const successfulCommands = this.commandResults.filter((result) => result.success);
        return {
            sampleCount: this.samples.length,
            power: summarizeValues(powers),
            cadence: summarizeValues(cadences),
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
            schemaVersion: 1,
            generatedAt: new Date(this.now()).toISOString(),
            startedAt: this.startedAt,
            simulated: this.simulated,
            trainer: {
                name: this.deviceName,
                capabilities: this.capabilities,
                resistanceRange: this.manager?.resistanceRange || null,
                powerRange: this.manager?.powerRange || null,
                commandQueueMetrics: this.manager?.commandQueue?.getMetrics?.() || null,
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

export function getDiagnosticTargets() {
    return {
        erg: [...SAFE_ERG_TARGETS],
        resistance: [...SAFE_RESISTANCE_TARGETS],
    };
}

function finiteOrZero(value) {
    return Number.isFinite(Number(value)) ? Number(value) : 0;
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
