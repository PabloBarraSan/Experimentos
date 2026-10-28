/**
 * Prueba de resistencia del rodillo: recorre niveles de resistencia manual y objetivos ERG mientras
 * el usuario pedalea a cadencia constante, y compara qué potencia da cada modo.
 * Sirve para saber si el ERG nativo se queda corto (y hace falta el control por resistencia).
 */

export const PROBE_CONFIG = {
    resistanceLevels: [20, 40, 60, 80, 100],
    ergTargets: [150, 200, 250, 300, 350],
    settleMs: 12000,
    measureMs: 8000,
    restMs: 20000,
    restResistance: 10,
    minCadence: 40,          // por debajo la medida no vale
    maxInvalidSteps: 3,      // pasos seguidos sin pedaleo antes de abortar
    saturationRatio: 0.9,    // el ERG "no llega" si da menos del 90 % del objetivo
    referenceCadence: 85,    // cadencia a la que se normalizan las potencias
};

const mean = (values) => (values.length ? values.reduce((sum, v) => sum + v, 0) / values.length : null);

export function summarizeSamples(samples, minCadence = PROBE_CONFIG.minCadence) {
    const power = mean(samples.map((s) => s.power).filter(Number.isFinite));
    const cadence = mean(samples.map((s) => s.cadence).filter(Number.isFinite));
    return {
        power: power === null ? null : Math.round(power),
        cadence: cadence === null ? null : Math.round(cadence),
        samples: samples.length,
        valid: samples.length >= 3 && cadence !== null && cadence >= minCadence,
    };
}

/** Potencia equivalente a la cadencia de referencia (la potencia es ~proporcional a la cadencia). */
export function normalizePower(power, cadence, reference = PROBE_CONFIG.referenceCadence) {
    return power !== null && cadence > 0 ? Math.round((power / cadence) * reference) : null;
}

/**
 * @param {{ resistance: Array<{level, power, cadence, valid}>, erg: Array<{target, power, cadence, valid}> }} results
 */
export function analyzeProbe(results, config = PROBE_CONFIG) {
    const resistance = results.resistance.filter((row) => row.valid);
    const erg = results.erg.filter((row) => row.valid);
    const withNormalized = (rows) => rows.map((row) => ({ ...row, normalized: normalizePower(row.power, row.cadence, config.referenceCadence) }));

    const resistanceRows = withNormalized(resistance);
    const ergRows = withNormalized(erg).map((row) => ({ ...row, ratio: row.power / row.target }));

    const resistanceMax = resistanceRows.reduce((best, row) => (!best || row.normalized > best.normalized ? row : best), null);
    const saturated = ergRows.find((row) => row.ratio < config.saturationRatio) || null;
    const ergDelivered = ergRows.filter((row) => row.ratio >= config.saturationRatio);
    const ergMax = ergDelivered.reduce((best, row) => (!best || row.target > best.target ? row : best), null);
    const ergPeak = ergRows.reduce((best, row) => (!best || row.normalized > best.normalized ? row : best), null);

    let verdict;
    let message;
    if (!resistanceMax || !ergRows.length) {
        verdict = 'incomplete';
        message = 'No hay datos suficientes: pedalea de forma continua durante toda la prueba y repítela.';
    } else if (!saturated) {
        verdict = 'erg_ok';
        message = `El ERG nativo cumplió todos los objetivos (hasta ${ergMax?.target ?? '—'} W). Si el rodillo se te quedaba corto en el test, el ERG no es la causa.`;
    } else if (resistanceMax.normalized > (ergPeak?.normalized ?? 0) * 1.15) {
        verdict = 'erg_limited';
        message = `El ERG nativo se queda en unos ${ergPeak?.normalized ?? '—'} W a ${config.referenceCadence} rpm, pero con la resistencia al ${resistanceMax.level} % llegas a ${resistanceMax.normalized} W a esa cadencia. Conviene el control por resistencia.`;
    } else {
        verdict = 'trainer_limit';
        message = `Ni el ERG ni la resistencia al máximo pasan de unos ${Math.max(resistanceMax.normalized, ergPeak?.normalized ?? 0)} W a ${config.referenceCadence} rpm. El D100 declara 600 W, pero solo a mucha velocidad de volante: con un plato pequeño o un piñón grande se queda muy por debajo. Prueba con el plato más grande y el piñón más pequeño, y comprueba que la cadencia que marca es real.`;
    }

    return {
        verdict,
        message,
        referenceCadence: config.referenceCadence,
        resistance: resistanceRows,
        erg: ergRows,
        ergMax: ergMax ? ergMax.target : null,
        saturatedAt: saturated ? saturated.target : null,
    };
}

/**
 * Orquesta la prueba. Recibe el gestor Bluetooth y una función de suscripción a telemetría
 * (observer({ power, cadence })), y devuelve los resultados por paso.
 */
export class ResistanceProbeRunner {
    constructor({ manager, subscribeTelemetry, wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms)), now = () => Date.now(), onProgress = () => {}, config = PROBE_CONFIG }) {
        this.manager = manager;
        this.subscribeTelemetry = subscribeTelemetry;
        this.wait = wait;
        this.now = now;
        this.onProgress = onProgress;
        this.config = config;
        this.cancelled = false;
        this.samples = [];
        this.log = [];
    }

    cancel() {
        this.cancelled = true;
    }

    async measure(step) {
        const { settleMs, measureMs } = this.config;
        this.onProgress({ ...step, stage: 'settle', seconds: settleMs / 1000 });
        await this.sleep(settleMs);
        if (this.cancelled) return null;
        const from = this.now();
        this.onProgress({ ...step, stage: 'measure', seconds: measureMs / 1000 });
        await this.sleep(measureMs);
        return summarizeSamples(this.samples.filter((sample) => sample.timestamp >= from));
    }

    // Espera troceada para poder cancelar sin esperar al final del paso.
    async sleep(ms) {
        for (let left = ms; left > 0 && !this.cancelled; left -= 500) await this.wait(Math.min(500, left));
    }

    async run() {
        const { resistanceLevels, ergTargets, restMs, restResistance } = this.config;
        const results = { resistance: [], erg: [] };
        const unsubscribe = this.subscribeTelemetry((data) => {
            this.samples.push({ timestamp: this.now(), power: Number(data.power), cadence: Number(data.cadence) });
        });
        let invalid = 0;
        try {
            await this.manager.startTraining();
            for (const level of resistanceLevels) {
                if (this.cancelled || invalid >= this.config.maxInvalidSteps) break;
                await this.manager.setResistance(level);
                const row = await this.measure({ phase: 'resistance', value: level });
                if (!row) break;
                results.resistance.push({ level, ...row });
                invalid = row.valid ? 0 : invalid + 1;
            }
            if (!this.cancelled && invalid < this.config.maxInvalidSteps) {
                await this.manager.setResistance(restResistance);
                this.onProgress({ phase: 'rest', stage: 'rest', seconds: restMs / 1000 });
                await this.sleep(restMs);
            }
            let saturatedInARow = 0;
            for (const target of ergTargets) {
                if (this.cancelled || invalid >= this.config.maxInvalidSteps || saturatedInARow >= 2) break;
                await this.manager.setTargetPower(target);
                const row = await this.measure({ phase: 'erg', value: target });
                if (!row) break;
                results.erg.push({ target, ...row });
                invalid = row.valid ? 0 : invalid + 1;
                const short = row.valid && row.power < target * this.config.saturationRatio;
                saturatedInARow = short ? saturatedInARow + 1 : 0;
            }
        } finally {
            unsubscribe();
            await Promise.resolve(this.manager.stopTraining?.(true)).catch(() => {});
        }
        return { cancelled: this.cancelled, ...results, analysis: analyzeProbe(results, this.config) };
    }
}
