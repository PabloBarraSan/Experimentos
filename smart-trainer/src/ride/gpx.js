/**
 * gpx - Parser de archivos GPX para el modo ciclismo virtual
 * Smart Trainer - Virtual Cycling
 *
 * No depende de DOMParser (se puede usar y testear en node): extrae los
 * puntos con expresiones regulares, suficiente para <trkpt> / <rtept>.
 */

const EARTH_RADIUS_M = 6371008.8;
const RESOLUTION_M = 10;          // Separación de los puntos remuestreados
const MIN_DISTANCE_M = 200;       // Longitud mínima de ruta aceptada
const MIN_POINT_SPACING_M = 1;    // Puntos más cercanos se consideran duplicados
const MAX_JUMP_M = 2000;          // Saltos mayores se tratan como posible ruido GPS
const ELEVATION_SMOOTH_HALF = 2;  // Media móvil de 5 puntos
const GRADE_HALF_WINDOW = 2;      // +-2 puntos = ventana de 40 m (>= 30 m)
const HEADING_HALF_WINDOW = 3;    // +-3 puntos = 30 m a cada lado
const MAX_GRADE = 20;             // %

const toRad = (deg) => (deg * Math.PI) / 180;
const toDeg = (rad) => (rad * 180) / Math.PI;

/**
 * Distancia haversine en metros entre dos coordenadas
 */
export function haversine(lat1, lon1, lat2, lon2) {
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a = Math.sin(dLat / 2) ** 2
        + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
    return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(a)));
}

/**
 * Rumbo inicial (grados, 0 = norte, sentido horario) entre dos coordenadas
 */
export function bearing(lat1, lon1, lat2, lon2) {
    const phi1 = toRad(lat1);
    const phi2 = toRad(lat2);
    const dLon = toRad(lon2 - lon1);
    const y = Math.sin(dLon) * Math.cos(phi2);
    const x = Math.cos(phi1) * Math.sin(phi2) - Math.sin(phi1) * Math.cos(phi2) * Math.cos(dLon);
    return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

/**
 * Decodificar entidades XML básicas y CDATA de un texto
 */
function decodeXmlText(raw) {
    return raw
        .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&apos;/g, "'")
        .replace(/&amp;/g, '&')
        .trim();
}

/**
 * Leer un atributo numérico de una cadena de atributos XML
 */
function readNumericAttr(attrs, name) {
    const match = new RegExp(`\\b${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)')`).exec(attrs);
    if (!match) return NaN;
    return parseFloat(match[1] ?? match[2]);
}

/**
 * Extraer puntos crudos {lat, lon, ele} para una etiqueta (trkpt o rtept)
 */
function extractRawPoints(text, tag) {
    const regex = new RegExp(`<${tag}\\b([^>]*?)(?:/>|>([\\s\\S]*?)</${tag}>)`, 'g');
    const points = [];
    let match;
    while ((match = regex.exec(text)) !== null) {
        const lat = readNumericAttr(match[1], 'lat');
        const lon = readNumericAttr(match[1], 'lon');
        if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
        if (Math.abs(lat) > 90 || Math.abs(lon) > 180) continue;

        let ele = null;
        if (match[2]) {
            const eleMatch = /<ele>\s*([^<\s]+)\s*<\/ele>/.exec(match[2]);
            if (eleMatch) {
                const value = parseFloat(eleMatch[1]);
                if (Number.isFinite(value)) ele = value;
            }
        }
        points.push({ lat, lon, ele });
    }
    return points;
}

/**
 * Extraer el nombre de la ruta (<name> del track/ruta, o de los metadatos)
 */
function extractName(text) {
    const containers = [/<trk\b[^>]*>([\s\S]*?)(?:<trkseg\b|<\/trk>)/, /<rte\b[^>]*>([\s\S]*?)(?:<rtept\b|<\/rte>)/, /<metadata\b[^>]*>([\s\S]*?)<\/metadata>/];
    for (const container of containers) {
        const block = container.exec(text);
        const nameMatch = block && /<name>([\s\S]*?)<\/name>/.exec(block[1]);
        if (nameMatch) {
            const name = decodeXmlText(nameMatch[1]);
            if (name) return name;
        }
    }
    return 'Ruta GPX';
}

/**
 * Descartar duplicados y saltos absurdos, devolviendo puntos con distancia acumulada
 */
function cleanAndAccumulate(rawPoints) {
    const cleaned = [];
    let accumulated = 0;

    for (let i = 0; i < rawPoints.length; i++) {
        const p = rawPoints[i];
        if (cleaned.length === 0) {
            cleaned.push({ ...p, distance: 0 });
            continue;
        }

        const last = cleaned[cleaned.length - 1];
        const step = haversine(last.lat, last.lon, p.lat, p.lon);
        if (step < MIN_POINT_SPACING_M) continue;

        if (step > MAX_JUMP_M) {
            // Pico de GPS: el siguiente punto vuelve cerca del último válido
            const next = rawPoints[i + 1];
            const nextToLast = next ? haversine(last.lat, last.lon, next.lat, next.lon) : Infinity;
            if (nextToLast < step / 2) continue;
        }

        accumulated += step;
        cleaned.push({ ...p, distance: accumulated });
    }
    return cleaned;
}

/**
 * Completar elevaciones ausentes. Devuelve false si no hay elevación fiable.
 */
function fillElevation(points) {
    const withEle = points.filter(p => p.ele !== null).length;
    if (withEle < 2 || withEle < points.length * 0.5) {
        points.forEach(p => { p.ele = 0; });
        return false;
    }

    let prev = null;
    for (let i = 0; i < points.length; i++) {
        if (points[i].ele !== null) { prev = i; continue; }
        // Buscar siguiente con elevación para interpolar
        let next = i + 1;
        while (next < points.length && points[next].ele === null) next++;
        const a = prev !== null ? points[prev] : null;
        const b = next < points.length ? points[next] : null;
        if (a && b) {
            const t = (points[i].distance - a.distance) / ((b.distance - a.distance) || 1);
            points[i].ele = a.ele + t * (b.ele - a.ele);
        } else {
            points[i].ele = (a || b).ele;
        }
    }
    return true;
}

/**
 * Remuestrear a intervalos fijos por interpolación lineal
 */
function resample(points) {
    const total = points[points.length - 1].distance;
    const count = Math.floor(total / RESOLUTION_M);
    const out = [];
    let seg = 0;

    const pushAt = (d) => {
        while (seg < points.length - 2 && points[seg + 1].distance < d) seg++;
        const a = points[seg];
        const b = points[seg + 1];
        const t = Math.min(1, Math.max(0, (d - a.distance) / ((b.distance - a.distance) || 1)));
        out.push({
            distance: d,
            lat: a.lat + t * (b.lat - a.lat),
            lon: a.lon + t * (b.lon - a.lon),
            elevation: a.ele + t * (b.ele - a.ele),
        });
    };

    for (let i = 0; i <= count; i++) pushAt(i * RESOLUTION_M);
    // Punto final exacto si queda resto
    if (total - count * RESOLUTION_M > 1) pushAt(total);
    return out;
}

/**
 * Media móvil centrada sobre una serie numérica
 */
function movingAverage(values, half) {
    return values.map((_, i) => {
        const from = Math.max(0, i - half);
        const to = Math.min(values.length - 1, i + half);
        let sum = 0;
        for (let j = from; j <= to; j++) sum += values[j];
        return sum / (to - from + 1);
    });
}

const round = (value, decimals) => {
    const f = 10 ** decimals;
    return Math.round(value * f) / f;
};

/**
 * Parsear un GPX (texto) y devolver la ruta lista para el motor de ride
 * @param {string} text - Contenido del archivo GPX
 * @returns {{name: string, points: Array, totalDistance: number, ascent: number, descent: number, hasElevation: boolean}}
 */
export function parseGpx(text) {
    if (typeof text !== 'string' || !/<gpx\b/i.test(text)) {
        throw new Error('El archivo no es un GPX válido.');
    }

    let raw = extractRawPoints(text, 'trkpt');
    if (raw.length < 2) raw = extractRawPoints(text, 'rtept');
    if (raw.length < 2) {
        throw new Error('El GPX no contiene un track ni una ruta con puntos suficientes.');
    }

    const cleaned = cleanAndAccumulate(raw);
    if (cleaned.length < 2 || cleaned[cleaned.length - 1].distance < MIN_DISTANCE_M) {
        throw new Error(`La ruta es demasiado corta (mínimo ${MIN_DISTANCE_M} m).`);
    }

    const hasElevation = fillElevation(cleaned);
    const resampled = resample(cleaned);

    // Elevación suavizada
    const elevations = hasElevation
        ? movingAverage(resampled.map(p => p.elevation), ELEVATION_SMOOTH_HALF)
        : resampled.map(() => 0);

    // Ascenso / descenso acumulados con la elevación suavizada
    let ascent = 0;
    let descent = 0;
    for (let i = 1; i < elevations.length; i++) {
        const delta = elevations[i] - elevations[i - 1];
        if (delta > 0) ascent += delta;
        else descent -= delta;
    }

    const last = resampled.length - 1;
    const points = resampled.map((p, i) => {
        // Pendiente con ventana centrada de >= 30 m
        let grade = 0;
        if (hasElevation) {
            const a = Math.max(0, i - GRADE_HALF_WINDOW);
            const b = Math.min(last, i + GRADE_HALF_WINDOW);
            const run = resampled[b].distance - resampled[a].distance;
            if (run > 0) {
                grade = ((elevations[b] - elevations[a]) / run) * 100;
                grade = Math.max(-MAX_GRADE, Math.min(MAX_GRADE, grade));
            }
        }

        // Rumbo con ventana centrada
        const ha = resampled[Math.max(0, i - HEADING_HALF_WINDOW)];
        const hb = resampled[Math.min(last, i + HEADING_HALF_WINDOW)];

        return {
            distance: round(p.distance, 2),
            elevation: round(elevations[i], 2),
            grade: round(grade, 2),
            lat: p.lat,
            lon: p.lon,
            heading: round(bearing(ha.lat, ha.lon, hb.lat, hb.lon), 1),
        };
    });

    return {
        name: extractName(text),
        points,
        totalDistance: points[last].distance,
        ascent: Math.round(ascent),
        descent: Math.round(descent),
        hasElevation,
    };
}
