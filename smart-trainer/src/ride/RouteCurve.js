/**
 * RouteCurve - Curva 3D de la carretera del ride, prolongada antes de la salida y después de la meta.
 *
 * La curva cubre las distancias de ruta [-LEAD_IN, longitud + LEAD_OUT]. La distancia 0 (salida)
 * y la distancia `length` (meta) caen EXACTAMENTE sobre sus puntos de ruta; antes y después la
 * carretera continúa en la dirección inicial/final con la cota (y una pendiente que se desvanece).
 *
 * Todo lo que usa "distancia del ciclista" (jugador, bots, fantasma, cámara, tramos, decorado)
 * debe pasar por `distanceToU` / `distanceToMeters`: son la única conversión distancia -> curva.
 * Smart Trainer - Virtual Cycling
 */

import * as THREE from 'three';

export const LEAD_IN = 150;   // metros de carretera antes de la salida
export const LEAD_OUT = 150;  // metros de carretera después de la meta
const SAMPLE_STEP = 5;        // separación (m) entre puntos de la curva
const EXTENSION_GRADE_DECAY = 40; // m en los que la pendiente de los extremos se desvanece a plano
const MAX_EXTENSION_GRADE = 12;   // % máximo de pendiente que se prolonga
const DIRECTION_SPAN = 20;    // m usados para estimar la dirección en los extremos de una ruta GPX
const ARC_SUBDIVISIONS = 4;   // divisiones de la tabla de arco por segmento entre puntos

/**
 * Interpolar punto de ruta a una distancia dada (búsqueda binaria O(log n)).
 * Fuera del rango devuelve el primer/último punto (elevación y pendiente acotadas).
 */
export function getPointAtDistance(points, distance) {
    if (!points || points.length === 0) {
        return { distance: 0, elevation: 0, grade: 0 };
    }

    if (!(distance > points[0].distance)) {
        return points[0];
    }
    if (distance >= points[points.length - 1].distance) {
        return points[points.length - 1];
    }

    let left = 0;
    let right = points.length - 1;

    while (left < right - 1) {
        const mid = Math.floor((left + right) / 2);
        if (points[mid].distance <= distance) {
            left = mid;
        } else {
            right = mid;
        }
    }

    const p1 = points[left];
    const p2 = points[right];
    const span = p2.distance - p1.distance;
    const t = span > 0 ? (distance - p1.distance) / span : 0;

    return {
        distance,
        elevation: p1.elevation + t * (p2.elevation - p1.elevation),
        grade: p1.grade + t * (p2.grade - p1.grade),
    };
}

/**
 * Coordenadas X,Z en el plano (curva procedural: serpentina). Three.js: Y = altura.
 * La fórmula es válida también para distancias negativas o mayores que la ruta.
 */
export function getHorizontalPositionAtDistance(distance) {
    const curveAmplitude = 50;
    const curvePeriod = 200;
    const x = curveAmplitude * Math.sin(distance / curvePeriod);
    const z = distance;
    return { x, z };
}

/**
 * Trayectoria horizontal real de una ruta importada (GPX).
 * Devuelve { distances, xs, zs } o null si los puntos no traen lat/lon ni heading
 * (rutas generadas), en cuyo caso se usa la sinusoide procedural.
 * Convención: norte = +Z y este = -X (así el mapa no queda en espejo vista desde +Y).
 */
export function buildHorizontalPath(points) {
    if (!points || points.length < 2) return null;

    const hasLatLon = points.every(p => Number.isFinite(p.lat) && Number.isFinite(p.lon));
    const hasHeading = points.every(p => Number.isFinite(p.heading));
    if (!hasLatLon && !hasHeading) return null;

    const xs = new Array(points.length);
    const zs = new Array(points.length);

    if (hasLatLon) {
        // Proyección equirectangular local respecto al primer punto
        const R = 6371008.8;
        const lat0 = points[0].lat;
        const lon0 = points[0].lon;
        const cosLat0 = Math.cos((lat0 * Math.PI) / 180);
        points.forEach((p, i) => {
            const east = ((p.lon - lon0) * Math.PI / 180) * R * cosLat0;
            const north = ((p.lat - lat0) * Math.PI / 180) * R;
            xs[i] = -east;
            zs[i] = north;
        });
    } else {
        // Integrar el rumbo a lo largo de la distancia
        xs[0] = 0;
        zs[0] = 0;
        for (let i = 1; i < points.length; i++) {
            const ds = points[i].distance - points[i - 1].distance;
            const rad = (points[i].heading * Math.PI) / 180;
            xs[i] = xs[i - 1] - Math.sin(rad) * ds;
            zs[i] = zs[i - 1] + Math.cos(rad) * ds;
        }
    }

    // Suavizado (media móvil de 5 puntos) para evitar quiebros por ruido de GPS
    const smooth = (arr) => arr.map((_, i) => {
        const from = Math.max(0, i - 2);
        const to = Math.min(arr.length - 1, i + 2);
        let sum = 0;
        for (let j = from; j <= to; j++) sum += arr[j];
        return sum / (to - from + 1);
    });

    const distances = points.map(p => p.distance);
    const path = { distances, xs: smooth(xs), zs: smooth(zs), startDir: null, endDir: null };
    path.startDir = endDirection(path, true);
    path.endDir = endDirection(path, false);
    return path;
}

/**
 * Dirección unitaria (x, z) en un extremo de la trayectoria, estimada sobre ~DIRECTION_SPAN metros.
 * Si el tramo es degenerado (puntos repetidos) devuelve la dirección procedural (+Z).
 */
function endDirection(path, atStart) {
    const { distances, xs, zs } = path;
    const last = distances.length - 1;
    const anchor = atStart ? 0 : last;
    let other = anchor;
    for (let i = atStart ? 1 : last - 1; i >= 0 && i <= last; i += atStart ? 1 : -1) {
        other = i;
        if (Math.abs(distances[i] - distances[anchor]) >= DIRECTION_SPAN) break;
    }
    let dx = atStart ? xs[other] - xs[anchor] : xs[anchor] - xs[other];
    let dz = atStart ? zs[other] - zs[anchor] : zs[anchor] - zs[other];
    const norm = Math.hypot(dx, dz);
    if (!(norm > 1e-6)) return { x: 0, z: 1 };
    dx /= norm;
    dz /= norm;
    return { x: dx, z: dz };
}

/**
 * Posición X,Z sobre una trayectoria horizontal real. Antes del primer punto y después del
 * último se prolonga en línea recta con la dirección de cada extremo (sin NaN).
 */
export function getPathPositionAtDistance(path, distance) {
    const { distances, xs, zs } = path;
    const last = distances.length - 1;
    if (distance <= distances[0]) {
        const run = distance - distances[0]; // <= 0
        return { x: xs[0] + path.startDir.x * run, z: zs[0] + path.startDir.z * run };
    }
    if (distance >= distances[last]) {
        const run = distance - distances[last]; // >= 0
        return { x: xs[last] + path.endDir.x * run, z: zs[last] + path.endDir.z * run };
    }

    let left = 0;
    let right = last;
    while (left < right - 1) {
        const mid = Math.floor((left + right) / 2);
        if (distances[mid] <= distance) left = mid;
        else right = mid;
    }
    const span = distances[right] - distances[left];
    const t = span > 0 ? (distance - distances[left]) / span : 0;
    return {
        x: xs[left] + t * (xs[right] - xs[left]),
        z: zs[left] + t * (zs[right] - zs[left]),
    };
}

/**
 * Elevación en cualquier distancia de ruta: interpolada dentro, y fuera prolongada con la pendiente
 * del extremo que se desvanece de forma exponencial (acotada, nunca NaN).
 */
export function getElevationAtDistance(points, totalLength, distance) {
    if (distance >= 0 && distance <= totalLength) return getPointAtDistance(points, distance).elevation;
    const atStart = distance < 0;
    const end = getPointAtDistance(points, atStart ? 0 : totalLength);
    const rawGrade = Number.isFinite(end.grade) ? end.grade : 0;
    const gradeFraction = Math.max(-MAX_EXTENSION_GRADE, Math.min(MAX_EXTENSION_GRADE, rawGrade)) / 100;
    const run = atStart ? -distance : distance - totalLength; // metros hacia fuera, > 0
    const k = EXTENSION_GRADE_DECAY;
    const rise = gradeFraction * k * (1 - Math.exp(-run / k));
    // Hacia atrás se baja lo que se subía; hacia delante se sigue subiendo
    return end.elevation + (atStart ? -rise : rise);
}

/**
 * Construye la curva extendida de una ruta.
 * @param {Array} points - Puntos de la ruta { distance, elevation, grade, lat?, lon?, heading? }
 * @param {number} totalLength - Longitud de la ruta (m)
 * @returns {{
 *   curve: THREE.CatmullRomCurve3, threePoints: THREE.Vector3[], horizontalPath: Object|null,
 *   routeLength: number, curveLength: number,
 *   distanceToU: (distance: number) => number,
 *   distanceToMeters: (distance: number) => number
 * }|null}
 */
export function buildRouteCurve(points, totalLength) {
    if (!points || points.length === 0 || !(totalLength > 0)) return null;

    const horizontalPath = buildHorizontalPath(points);
    const horizontalAt = (d) => (horizontalPath
        ? getPathPositionAtDistance(horizontalPath, d)
        : getHorizontalPositionAtDistance(d));

    // Distancias de ruta de cada punto de la curva (con el inicio y la meta exactos)
    const sampleDistances = [];
    for (let d = -LEAD_IN; d < 0; d += SAMPLE_STEP) sampleDistances.push(d);
    sampleDistances.push(0);
    let d = SAMPLE_STEP;
    for (; d < totalLength - 0.5; d += SAMPLE_STEP) sampleDistances.push(d);
    sampleDistances.push(totalLength);
    for (let e = SAMPLE_STEP; e < LEAD_OUT; e += SAMPLE_STEP) sampleDistances.push(totalLength + e);
    sampleDistances.push(totalLength + LEAD_OUT);

    const threePoints = sampleDistances.map((dist) => {
        const { x, z } = horizontalAt(dist);
        return new THREE.Vector3(x, getElevationAtDistance(points, totalLength, dist), z);
    });
    if (threePoints.length < 2) return null;

    const curve = new THREE.CatmullRomCurve3(threePoints);
    // La tabla de arco tiene nodos exactos en cada punto (índice * ARC_SUBDIVISIONS)
    curve.arcLengthDivisions = (threePoints.length - 1) * ARC_SUBDIVISIONS;
    const lengths = curve.getLengths();
    const curveLength = lengths[lengths.length - 1];

    // Fracción de arco (u) de cada punto de la curva
    const sampleU = sampleDistances.map((_, i) => lengths[i * ARC_SUBDIVISIONS] / curveLength);
    const first = sampleDistances[0];
    const lastIndex = sampleDistances.length - 1;

    /** Distancia de ruta (m, puede ser negativa o mayor que la ruta) -> parámetro de longitud de arco u en [0, 1] */
    const distanceToU = (distance) => {
        if (!Number.isFinite(distance) || distance <= first) return 0;
        if (distance >= sampleDistances[lastIndex]) return 1;
        let left = 0;
        let right = lastIndex;
        while (left < right - 1) {
            const mid = (left + right) >> 1;
            if (sampleDistances[mid] <= distance) left = mid;
            else right = mid;
        }
        const span = sampleDistances[right] - sampleDistances[left];
        const f = span > 0 ? (distance - sampleDistances[left]) / span : 0;
        return sampleU[left] + f * (sampleU[right] - sampleU[left]);
    };

    return {
        curve,
        threePoints,
        horizontalPath,
        routeLength: totalLength,
        curveLength,
        distanceToU,
        /** Metros de arco desde el inicio de la curva (para tramos de carretera y decorado) */
        distanceToMeters: (distance) => distanceToU(distance) * curveLength,
    };
}
