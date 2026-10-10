/**
 * Resumen de salud de una sesión terminada: responde de un vistazo si los datos y el control
 * del rodillo han ido como debían (cobertura de muestras, potencia y pulso, seguimiento del objetivo).
 */

// Tras un cambio de bloque el rodillo y el ciclista tardan en llegar al objetivo; no cuenta como error.
const BLOCK_SETTLE_SECONDS = 15;
// El rodillo manda ~0,9 muestras/s; la cobertura se mide en ventanas de 5 s con al menos un dato.
const COVERAGE_WINDOW_SECONDS = 5;
const MIN_COVERAGE = 0.9;
const MAX_GAP_SECONDS = 5;
const MAX_TARGET_ERROR = 0.15;

const round = (value, digits = 2) => {
    const factor = 10 ** digits;
    return Math.round(value * factor) / factor;
};

function targetTracking(points) {
    let blockStart = null;
    let blockIndex = null;
    let counted = 0;
    let errorSum = 0;
    let within = 0;
    for (const point of points) {
        if (point.blockIndex !== blockIndex) {
            blockIndex = point.blockIndex;
            blockStart = point.elapsedSeconds;
        }
        if (!(point.targetPower > 0) || !(point.power >= 0)) continue;
        if (point.elapsedSeconds - blockStart < BLOCK_SETTLE_SECONDS) continue;
        const error = Math.abs(point.power - point.targetPower) / point.targetPower;
        counted++;
        errorSum += error;
        if (error <= 0.1) within++;
    }
    return counted
        ? { samples: counted, meanErrorPct: round((errorSum / counted) * 100, 1), within10Pct: round(within / counted) }
        : { samples: 0, meanErrorPct: null, within10Pct: null };
}

export function summarizeSessionHealth(session) {
    const points = session?.dataPoints || [];
    const elapsed = Math.round(session?.elapsedTime || session?.activeDuration || 0);
    const commands = session?.trainerCommands || [];
    const failedCommands = commands.filter((command) => !command.success);

    let maxGapSeconds = 0;
    for (let i = 1; i < points.length; i++) {
        maxGapSeconds = Math.max(maxGapSeconds, (points[i].timestamp - points[i - 1].timestamp) / 1000);
    }

    const share = (predicate) => (points.length ? round(points.filter(predicate).length / points.length) : 0);
    const windows = Math.ceil(elapsed / COVERAGE_WINDOW_SECONDS);
    const covered = new Set(points.map((point) => Math.floor((point.elapsedSeconds ?? 0) / COVERAGE_WINDOW_SECONDS)));
    const coverage = windows ? round(Math.min(1, covered.size / windows)) : 0;
    const tracking = targetTracking(points);
    const summary = {
        status: session?.status ?? null,
        plannedWorkoutId: session?.plannedWorkoutId ?? null,
        ftp: session?.ftp ?? null,
        controlMode: session?.controlMode ?? null,
        elapsedSeconds: elapsed,
        samples: points.length,
        coverage,
        maxGapSeconds: round(maxGapSeconds, 1),
        powerShare: share((point) => point.power > 0),
        heartRateShare: share((point) => point.heartRate > 0),
        commands: { total: commands.length, failed: failedCommands.length },
        targetTracking: tracking,
    };

    const warnings = [];
    if (elapsed >= 60 && coverage < MIN_COVERAGE) warnings.push(`Faltan muestras: cobertura ${Math.round(coverage * 100)} %`);
    if (maxGapSeconds > MAX_GAP_SECONDS) warnings.push(`Hubo un corte de datos de ${round(maxGapSeconds, 1)} s`);
    if (points.length && summary.powerShare < 0.5) warnings.push('Casi sin potencia en las muestras');
    if (points.length && summary.heartRateShare === 0) warnings.push('Sin pulso (¿pulsómetro sin conectar?)');
    if (failedCommands.length) warnings.push(`${failedCommands.length} comando(s) al rodillo fallaron`);
    if (summary.controlMode === 'manual' && commands.length) warnings.push('El rodillo acabó en control manual');
    if (tracking.meanErrorPct !== null && tracking.meanErrorPct > MAX_TARGET_ERROR * 100) {
        warnings.push(`El rodillo no sigue bien el objetivo (error medio ${tracking.meanErrorPct} %)`);
    }
    return { ...summary, warnings, ok: warnings.length === 0 };
}
