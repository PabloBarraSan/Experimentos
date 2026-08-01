const METRICS = ['power', 'cadence', 'heartRate', 'speed', 'resistance', 'distance'];

const numberOrNull = (value) => Number.isFinite(Number(value)) ? Number(value) : null;
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

function median(values) {
    if (!values.length) return 0;
    const sorted = [...values].sort((a, b) => a - b);
    const middle = Math.floor(sorted.length / 2);
    return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

function weightedAverage(samples, now, windowMs) {
    const valid = samples.filter((sample) => now - sample.timestamp <= windowMs);
    if (!valid.length) return 0;
    return valid.reduce((sum, sample) => sum + sample.value, 0) / valid.length;
}

export class TelemetryPipeline {
    constructor({ heartRateStaleMs = 5000, zeroHoldMs = 2000 } = {}) {
        this.heartRateStaleMs = heartRateStaleMs;
        this.zeroHoldMs = zeroHoldMs;
        this.history = { power: [], cadence: [] };
        this.lastFrameAt = 0;
        this.lastHeartRate = null;
        this.lastHeartRateAt = 0;
        this.lastNonZero = { power: 0, cadence: 0 };
        this.zeroSince = { power: null, cadence: null };
        this.displayCadence = 0;
    }

    ingest(input = {}, timestamp = Date.now()) {
        const raw = Object.fromEntries(METRICS.map((key) => [key, numberOrNull(input[key])]));
        const quality = Object.fromEntries(METRICS.map((key) => [key, raw[key] === null ? 'missing' : 'fresh']));

        for (const metric of ['power', 'cadence']) {
            const value = Math.max(0, raw[metric] ?? 0);
            if (value > 0) {
                this.lastNonZero[metric] = value;
                this.zeroSince[metric] = null;
            } else if (this.zeroSince[metric] === null) {
                this.zeroSince[metric] = timestamp;
            }
            const heldValue = value === 0 && timestamp - this.zeroSince[metric] < this.zeroHoldMs
                ? this.lastNonZero[metric]
                : value;
            this.history[metric].push({ timestamp, value: heldValue });
            this.history[metric] = this.history[metric].filter((sample) => timestamp - sample.timestamp <= 5000).slice(-30);
        }

        if (raw.heartRate > 0) {
            this.lastHeartRate = raw.heartRate;
            this.lastHeartRateAt = timestamp;
        } else if (this.lastHeartRate && timestamp - this.lastHeartRateAt <= this.heartRateStaleMs) {
            quality.heartRate = 'stale';
        } else {
            quality.heartRate = 'missing';
        }

        const powerDisplay = weightedAverage(this.history.power, timestamp, 3000);
        const powerControl = weightedAverage(this.history.power, timestamp, 3000);
        const cadenceWindow = this.history.cadence.slice(-5).map((sample) => sample.value);
        const cadenceMedian = median(cadenceWindow);
        const deltaMs = this.lastFrameAt ? clamp(timestamp - this.lastFrameAt, 0, 2000) : 1000;
        const alpha = 1 - Math.exp(-deltaMs / 1200);
        this.displayCadence += (cadenceMedian - this.displayCadence) * alpha;
        const cadenceControl = weightedAverage(this.history.cadence, timestamp, 2000);
        this.lastFrameAt = timestamp;

        const heartRate = quality.heartRate === 'missing' ? null : this.lastHeartRate;
        return {
            timestamp,
            raw,
            display: {
                power: powerDisplay,
                cadence: this.displayCadence,
                heartRate,
                speed: raw.speed ?? 0,
                resistance: raw.resistance ?? 0,
                distance: raw.distance ?? 0,
            },
            control: {
                power: powerControl,
                cadence: cadenceControl,
                heartRate,
            },
            quality,
            source: input.rawFtms ? 'ftms' : (input.source || 'simulator'),
            connection: input.connection || 'connected',
        };
    }
}

export function createTelemetryPipeline(options) {
    return new TelemetryPipeline(options);
}

