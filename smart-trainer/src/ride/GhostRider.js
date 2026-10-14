/**
 * GhostRider - Fantasma de un ride pasado en la misma ruta
 * Smart Trainer - Virtual Cycling
 *
 * Trabaja con una serie compacta [{ t, d }] (segundos, metros) ordenada por t,
 * con d no decreciente. No depende del motor ni del renderer.
 */

/**
 * Índice del último punto de `trace` cuyo `key` es <= value (búsqueda binaria)
 */
function findIndexAtOrBefore(trace, key, value) {
    let low = 0;
    let high = trace.length - 1;
    while (low < high) {
        const mid = Math.ceil((low + high) / 2);
        if (trace[mid][key] <= value) low = mid;
        else high = mid - 1;
    }
    return low;
}

/**
 * Interpolación lineal entre dos puntos de la serie
 */
function interpolate(trace, index, fromKey, toKey, value) {
    const a = trace[index];
    const b = trace[index + 1];
    if (!b || b[fromKey] === a[fromKey]) return a[toKey];
    const ratio = (value - a[fromKey]) / (b[fromKey] - a[fromKey]);
    return a[toKey] + (b[toKey] - a[toKey]) * ratio;
}

/**
 * Crear un fantasma a partir de la serie de un ride
 * @param {Array<{t: number, d: number}>} rawTrace
 */
export function createGhost(rawTrace) {
    if (!Array.isArray(rawTrace) || rawTrace.length < 2) {
        throw new Error('Traza de fantasma inválida');
    }

    // Todos los fantasmas parten de t=0, d=0 aunque la primera muestra llegara después
    const trace = rawTrace[0].t > 0 ? [{ t: 0, d: 0 }, ...rawTrace] : rawTrace;
    const end = trace[trace.length - 1];

    /** Distancia (m) del fantasma en el instante t (s); se queda en la meta al acabar */
    function getDistanceAt(t) {
        if (t <= 0) return trace[0].d;
        if (t >= end.t) return end.d;
        const index = findIndexAtOrBefore(trace, 't', t);
        return interpolate(trace, index, 't', 'd', t);
    }

    /** Instante (s) en que el fantasma llegó a la distancia d (m) */
    function getTimeAtDistance(d) {
        if (d <= trace[0].d) return trace[0].t;
        if (d >= end.d) return end.t;
        const index = findIndexAtOrBefore(trace, 'd', d);
        return interpolate(trace, index, 'd', 't', d);
    }

    /**
     * Hueco respecto al jugador. Positivo = el jugador va por delante.
     * meters: playerDistance - distancia del fantasma ahora.
     * seconds: lo que tardó el fantasma en llegar a donde está el jugador, menos t.
     */
    function getGapAt(t, playerDistance) {
        return {
            meters: playerDistance - getDistanceAt(t),
            seconds: getTimeAtDistance(playerDistance) - t,
        };
    }

    return {
        duration: end.t,
        totalDistance: end.d,
        getDistanceAt,
        getTimeAtDistance,
        getGapAt,
    };
}
