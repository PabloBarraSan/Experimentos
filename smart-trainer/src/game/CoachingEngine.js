const STATUS_COLORS = {
    good: '#63e0b5',
    near: '#ffd166',
    off: '#ff6b7a',
    adapting: '#8ed9ff',
    free: '#a8b5bb',
};

function classify(error, green, amber) {
    const absolute = Math.abs(error);
    if (absolute <= green) return 'good';
    if (absolute <= amber) return 'near';
    return 'off';
}

export function getCoachingState({
    power = 0,
    targetPower = null,
    cadence = 0,
    targetCadence = null,
    secondsInBlock = 0,
    adaptationSeconds = 5,
} = {}) {
    if (!Number.isFinite(targetPower) || targetPower <= 0) {
        return { status: 'free', message: 'Ritmo libre', color: STATUS_COLORS.free };
    }
    if (secondsInBlock < adaptationSeconds) {
        return { status: 'adapting', message: 'Adapta el ritmo', color: STATUS_COLORS.adapting };
    }

    const powerError = Math.round(power - targetPower);
    const powerStatus = classify(powerError, targetPower * 0.10, targetPower * 0.15);
    const cadenceError = Number.isFinite(targetCadence) && targetCadence > 0
        ? Math.round(cadence - targetCadence)
        : null;
    const cadenceStatus = cadenceError === null ? 'good' : classify(cadenceError, 5, 10);
    const status = powerStatus === 'off' || cadenceStatus === 'off'
        ? 'off'
        : (powerStatus === 'near' || cadenceStatus === 'near' ? 'near' : 'good');

    let message = 'Mantén';
    if (powerStatus !== 'good') message = powerError < 0 ? `Sube ${Math.abs(powerError)} W` : `Baja ${powerError} W`;
    else if (cadenceStatus !== 'good') message = cadenceError < 0 ? `+${Math.abs(cadenceError)} RPM` : `-${cadenceError} RPM`;

    return { status, message, color: STATUS_COLORS[status], powerError, cadenceError, powerStatus, cadenceStatus };
}

export function getHeartRateZone(heartRate, maxHR, restingHR) {
    if (!Number.isFinite(heartRate) || heartRate <= 0 || !Number.isFinite(maxHR) || maxHR <= 0) return null;
    const hasReserve = Number.isFinite(restingHR) && restingHR > 0 && restingHR < maxHR;
    const effort = hasReserve ? (heartRate - restingHR) / (maxHR - restingHR) : heartRate / maxHR;
    const zones = [
        { zone: 1, min: 0, max: 0.60, name: 'Recuperación', color: '#92a4ad' },
        { zone: 2, min: 0.60, max: 0.70, name: 'Base', color: '#5ca8ff' },
        { zone: 3, min: 0.70, max: 0.80, name: 'Aeróbico', color: '#63e0b5' },
        { zone: 4, min: 0.80, max: 0.90, name: 'Umbral', color: '#ffd166' },
        { zone: 5, min: 0.90, max: Infinity, name: 'Máximo', color: '#ff6b7a' },
    ];
    return zones.find((zone) => effort < zone.max) || zones.at(-1);
}

