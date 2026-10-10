// Independent, strict FTMS decoding for diagnosis. Vendor extensions remain hypotheses.
export function inspectIndoorBikePacket(bytes = []) {
    const view = new DataView(Uint8Array.from(bytes).buffer);
    const fields = [];
    const warnings = [];
    if (view.byteLength < 2) return { fields, warnings: ['Paquete sin flags completos'], standard: {} };
    const flags = view.getUint16(0, true);
    let offset = 2;
    let truncated = false;
    const standard = {};
    const read = (name, size, getter, scale = 1) => {
        if (truncated) return;
        if (offset + size > view.byteLength) {
            warnings.push(`Campo ${name} truncado en byte ${offset}`);
            truncated = true;
            return;
        }
        const raw = size === 3
            ? view.getUint16(offset, true) | (view.getUint8(offset + 2) << 16)
            : view[getter](offset, true);
        const value = raw * scale;
        fields.push({ name, offset, size, raw, value });
        standard[name] = value;
        offset += size;
    };
    if (!(flags & 1)) read('speed', 2, 'getUint16', 0.01);
    const layout = [
        [1, 'averageSpeed', 2, 'getUint16', 0.01],
        [2, 'cadence', 2, 'getUint16', 0.5],
        [3, 'averageCadence', 2, 'getUint16', 0.5],
        [4, 'distance', 3, null, 1],
        [5, 'resistance', 2, 'getInt16', 1],
        [6, 'power', 2, 'getInt16', 1],
        [7, 'averagePower', 2, 'getInt16', 1],
    ];
    for (const [bit, ...field] of layout) if (flags & (1 << bit)) read(...field);
    if (flags & 0x100) {
        read('totalEnergy', 2, 'getUint16');
        read('energyPerHour', 2, 'getUint16');
        read('energyPerMinute', 1, 'getUint8');
    }
    for (const [bit, ...field] of [
        [9, 'heartRate', 1, 'getUint8', 1],
        [10, 'metabolicEquivalent', 1, 'getUint8', 0.1],
        [11, 'elapsedTime', 2, 'getUint16', 1],
        [12, 'remainingTime', 2, 'getUint16', 1],
    ]) if (flags & (1 << bit)) read(...field);
    if (flags & 0xe000) warnings.push('Flags reservados activos');
    const trailingBytes = Array.from(bytes).slice(offset);
    if (!truncated && trailingBytes.length) warnings.push(`${trailingBytes.length} bytes no descritos por los flags`);
    const vendorHypotheses = {};
    if (flags === 0x40 && view.byteLength >= 7) {
        warnings.push('Cadencia ausente en FTMS: la fórmula D100 es una hipótesis pendiente de validar');
        vendorHypotheses.legacyCadence = view.getUint8(6) / 2;
        if (view.byteLength >= 8) {
            const ticks = view.getUint16(6, true);
            vendorHypotheses.periodTicks = ticks;
            vendorHypotheses.periodCadence = ticks > 0 ? ticks / 16 : null;
        }
    }
    return { flags, fields, standard, trailingBytes, warnings, vendorHypotheses, truncated };
}
