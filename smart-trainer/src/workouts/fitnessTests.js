/**
 * Análisis de resultados de los tests de condición física.
 * Funciones puras: reciben los dataPoints de la sesión ({ elapsedSeconds, power }).
 */

import { TARGET_TYPES, expandBlocks } from './model.js';

/** Mejor potencia media en una ventana de `windowSec` segundos (muestras ~1 Hz). */
export function bestAveragePower(dataPoints, windowSec) {
    const points = (dataPoints || []).filter((p) => Number.isFinite(p.elapsedSeconds));
    if (!points.length || windowSec <= 0) return 0;

    let best = 0;
    let sum = 0;
    let start = 0;
    for (let end = 0; end < points.length; end++) {
        sum += points[end].power || 0;
        while (points[end].elapsedSeconds - points[start].elapsedSeconds >= windowSec) {
            sum -= points[start].power || 0;
            start++;
        }
        const covered = points[end].elapsedSeconds - points[start].elapsedSeconds;
        // Solo cuenta si la ventana está prácticamente completa (tolerancia de 3 s).
        if (covered >= windowSec - 3) {
            best = Math.max(best, sum / (end - start + 1));
        }
    }
    return Math.round(best);
}

/** Potencia media entre dos instantes de la sesión (segundos). */
export function averagePowerBetween(dataPoints, fromSec, toSec) {
    const slice = (dataPoints || []).filter((p) => p.elapsedSeconds >= fromSec && p.elapsedSeconds < toSec);
    if (!slice.length) return 0;
    return Math.round(slice.reduce((acc, p) => acc + (p.power || 0), 0) / slice.length);
}

/** FTP ≈ 95 % de la mejor media de 20 min. */
export function ftpFrom20Min(dataPoints) {
    const best = bestAveragePower(dataPoints, 20 * 60);
    return { best20: best, ftp: Math.round(best * 0.95) };
}

/** FTP ≈ 90 % de la mejor media de 8 min (protocolo 2×8). */
export function ftpFrom8Min(dataPoints) {
    const best = bestAveragePower(dataPoints, 8 * 60);
    return { best8: best, ftp: Math.round(best * 0.9) };
}

/** FTP ≈ 75 % de la mejor media de 1 min (potencia aeróbica máxima, MAP) del ramp test. */
export function ftpFromRamp(dataPoints) {
    const map = bestAveragePower(dataPoints, 60);
    return { map, ftp: Math.round(map * 0.75) };
}

/**
 * Potencia crítica con el modelo de dos parámetros: trabajo = CP·t + W′.
 * Con dos esfuerzos máximos (p. ej. 3 y 12 min) se resuelve el sistema.
 * @returns {{ cp: number, wPrime: number } | null} W′ en julios.
 */
export function criticalPowerFromEfforts(shortEffort, longEffort) {
    const { power: p1, seconds: t1 } = shortEffort;
    const { power: p2, seconds: t2 } = longEffort;
    if (!(p1 > 0 && p2 > 0 && t1 > 0 && t2 > t1)) return null;
    const cp = (p2 * t2 - p1 * t1) / (t2 - t1);
    const wPrime = (p1 - cp) * t1;
    if (!(cp > 0) || !(wPrime > 0)) return null;
    return { cp: Math.round(cp), wPrime: Math.round(wPrime) };
}

/** Test CP 3 + 12: los dos esfuerzos están separados por 15 min de recuperación. */
export function analyzeCriticalPowerTest(dataPoints, { shortStart, longStart }) {
    const shortPower = averagePowerBetween(dataPoints, shortStart, shortStart + 180);
    const longPower = averagePowerBetween(dataPoints, longStart, longStart + 720);
    const model = criticalPowerFromEfforts(
        { power: shortPower, seconds: 180 },
        { power: longPower, seconds: 720 },
    );
    return { shortPower, longPower, ...(model || {}), valid: Boolean(model) };
}

/** Metadatos de cada test: qué mide, cuándo hacerlo y cómo interpretarlo. */
export const FITNESS_TESTS = [
    {
        presetKey: 'RAMP_TEST',
        measures: 'FTP y potencia aeróbica máxima',
        whenToUse: 'Primer test y re-test cada 4-6 semanas. El más fácil de repetir.',
        rest: 'Dos días de descanso o rodaje suave antes.',
    },
    {
        presetKey: 'FTP_TEST_20',
        measures: 'FTP',
        whenToUse: 'Cuando ya sabes dosificar. Más fiable que la rampa si eres fondista.',
        rest: 'Dos días de descanso o rodaje suave antes.',
    },
    {
        presetKey: 'FTP_TEST_8',
        measures: 'FTP',
        whenToUse: 'Alternativa más corta al de 20 min; sale más alto si eres de explosividad.',
        rest: 'Dos días de descanso o rodaje suave antes.',
    },
    {
        presetKey: 'CP_TEST_3_12',
        measures: 'Potencia crítica (CP) y W′',
        whenToUse: 'Para afinar zonas y prescribir VO₂max una vez tienes el FTP.',
        rest: 'Descanso total el día anterior.',
    },
];

const TEST_KINDS = {
    ftp_test_20: 'ftp20',
    ftp_test_8: 'ftp8',
    ramp_test: 'ramp',
    cp_test_3_12: 'cp',
};

/** Identifica si un workout es un test de condición física (también sus variantes configuradas). */
export function getTestKind(workout) {
    const id = workout?.parentWorkoutId || workout?.id;
    return TEST_KINDS[id] || null;
}

/** Instantes de inicio de los esfuerzos libres del test (bloques con objetivo libre). */
function effortStarts(workout) {
    const starts = [];
    let elapsed = 0;
    expandBlocks(workout.blocks).forEach((block) => {
        if (block.targetType === TARGET_TYPES.FREE) starts.push(elapsed);
        elapsed += block.duration;
    });
    return starts;
}

/**
 * Resultado de un test a partir de la sesión grabada.
 * @returns {null | { kind, valid, ftp?, cp?, wPrime?, lines: string[] }}
 */
export function analyzeTestSession(workout, dataPoints) {
    const kind = getTestKind(workout);
    if (!kind) return null;

    if (kind === 'ftp20') {
        const { best20, ftp } = ftpFrom20Min(dataPoints);
        return { kind, valid: best20 > 0, ftp, lines: [`Mejor media de 20 min: ${best20} W`, 'FTP = 95 % de esa media'] };
    }
    if (kind === 'ftp8') {
        const { best8, ftp } = ftpFrom8Min(dataPoints);
        return { kind, valid: best8 > 0, ftp, lines: [`Mejor media de 8 min: ${best8} W`, 'FTP = 90 % de esa media'] };
    }
    if (kind === 'ramp') {
        const { map, ftp } = ftpFromRamp(dataPoints);
        return { kind, valid: map > 0, ftp, lines: [`Mejor minuto (potencia aeróbica máxima): ${map} W`, 'FTP = 75 % de ese minuto'] };
    }

    const [shortStart, longStart] = effortStarts(workout);
    const cp = analyzeCriticalPowerTest(dataPoints, { shortStart, longStart });
    return {
        kind,
        valid: cp.valid,
        cp: cp.cp,
        wPrime: cp.wPrime,
        // La CP es una cota alta del umbral sostenible: el FTP práctico queda un poco por debajo.
        ftp: cp.valid ? Math.round(cp.cp * 0.97) : undefined,
        lines: [
            `Esfuerzo de 3 min: ${cp.shortPower} W · de 12 min: ${cp.longPower} W`,
            cp.valid ? `W′ (reserva anaeróbica): ${(cp.wPrime / 1000).toFixed(1)} kJ` : 'Los dos esfuerzos no son coherentes (el de 3 min debe ser mayor que el de 12).',
        ],
    };
}
