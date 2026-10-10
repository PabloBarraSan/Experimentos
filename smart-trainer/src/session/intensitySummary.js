import { getHeartRateZone } from '../game/CoachingEngine.js';

const MAX_GAP_SECONDS = 5;

/**
 * Resume cuánta intensidad tuvo una sesión a partir de sus puntos de datos:
 * potencia/FC medias, FC máxima observada y segundos en cada zona de FC (Z1-Z5).
 */
export function summarizeIntensity(dataPoints = [], { maxHR, restingHR } = {}) {
    const zoneSeconds = [0, 0, 0, 0, 0];
    let powerSum = 0;
    let powerSeconds = 0;
    let hrSum = 0;
    let hrSeconds = 0;
    let peakHR = 0;

    dataPoints.forEach((point, index) => {
        const next = dataPoints[index + 1];
        const gap = next ? (next.timestamp - point.timestamp) / 1000 : 1;
        const seconds = Math.min(MAX_GAP_SECONDS, Math.max(0, gap)) || 1;
        if (point.power > 0) {
            powerSum += point.power * seconds;
            powerSeconds += seconds;
        }
        if (point.heartRate > 0) {
            hrSum += point.heartRate * seconds;
            hrSeconds += seconds;
            peakHR = Math.max(peakHR, point.heartRate);
            const zone = getHeartRateZone(point.heartRate, maxHR, restingHR);
            if (zone) zoneSeconds[zone.zone - 1] += seconds;
        }
    });

    return {
        hasHeartRate: hrSeconds > 0,
        avgPower: powerSeconds ? Math.round(powerSum / powerSeconds) : 0,
        avgHeartRate: hrSeconds ? Math.round(hrSum / hrSeconds) : 0,
        maxHeartRate: peakHR,
        zoneSeconds,
    };
}
