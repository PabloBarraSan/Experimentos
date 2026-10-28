/**
 * workoutTerrain - Altimetría de la expedición planificada a partir del entrenamiento.
 *
 * Las series duras caen en subidas, las recuperaciones en bajadas y el calentamiento en llano. Para que cada
 * serie coincida con su subida, el plan simula la sesión con la misma física que mueve al ciclista en pantalla
 * (stepSpeed, con la potencia objetivo de cada bloque) sobre el propio terreno que va generando: la pendiente
 * cambia con la distancia y la velocidad sale de la pendiente.
 *
 * El plan guarda la cota y el instante previsto cada STEP metros. Se puede replanificar en directo (bloque
 * saltado o alargado, cambio de intensidad o deriva respecto al plan) conservando todo lo ya recorrido, y
 * alargar por el final si el ciclista va por delante de lo previsto.
 * Smart Trainer - Virtual Cycling
 */

import { stepSpeed } from '../ride/RidePhysics.js';
import { getTargetAtTime, BLOCK_TYPES } from '../workouts/model.js';

export const STEP = 5;               // metros entre muestras del plan (como los puntos de RouteCurve)
const DT = 0.1;                      // s por paso de simulación (stepSpeed no integra más de 0,1 s)
const LEAD_SECONDS = 4;              // el terreno cambia unos segundos antes que el bloque: el pie de la subida coincide con la serie
const GRADE_RATE = 0.1;              // % de cambio de pendiente por metro (transiciones suaves)
const SMOOTH_RADIUS = 2;             // muestras a cada lado en el suavizado final de cotas (±10 m)
const CLIMB_INTENSITY = 0.88;        // fracción de FTP desde la que un bloque es una subida
const MIN_CLIMB_GAIN = 4;            // m de desnivel para que una subida cuente (perfil, baliza, público)

/** Pendiente (%) de una subida según la intensidad del bloque: umbral ~5 %, VO2max ~8 %, sprints hasta 10 %. */
export function climbGrade(intensity) {
    return Math.max(4.5, Math.min(10, 3 + (intensity - 0.85) * 16));
}

/**
 * Potencia objetivo (W) de un bloque en función del tiempo dentro de él, precalculada (la simulación la consulta
 * diez veces por segundo de sesión). Los bloques sin potencia se ruedan a ~60 % de FTP.
 */
function blockPowerFn(block, ftp) {
    const power = (elapsed) => {
        const target = getTargetAtTime(block, elapsed, ftp).power;
        return Number.isFinite(target) && target > 0 ? target : ftp * 0.6;
    };
    const start = power(0);
    const end = power(block.duration);
    if (start === end) return () => start;
    return (elapsed) => start + (end - start) * Math.max(0, Math.min(1, elapsed / block.duration));
}

/** Qué terreno pide un bloque: 'climb', 'flat' (calentamiento y libre), 'rolling' (tempo) o 'descent'. */
function blockTerrain(block, ftp) {
    const startPower = getTargetAtTime(block, 0, ftp).power;
    const endPower = getTargetAtTime(block, block.duration, ftp).power;
    const peak = Math.max(startPower || 0, endPower || 0) / ftp;
    if (block.type === BLOCK_TYPES.WARMUP || block.type === BLOCK_TYPES.FREE) return 'flat';
    if (block.type === BLOCK_TYPES.REST || block.type === BLOCK_TYPES.COOLDOWN) return 'descent';
    if (block.type === BLOCK_TYPES.INTERVAL || peak >= CLIMB_INTENSITY) return 'climb';
    if (peak < 0.62) return 'descent';
    return 'rolling';
}

/** Ondulación suave del llano (m), determinista por distancia. */
function rolling(distance) {
    return Math.sin(distance / 170) * 1.6 + Math.sin(distance / 61 + 1.3) * 0.5;
}

/**
 * Planifica la altimetría de un entrenamiento.
 *
 * @param {Object} options
 * @param {Array} options.blocks - Bloques expandidos (expandBlocks / WorkoutPlayer.getBlocks) con su duración real
 * @param {number} options.ftp - FTP (W)
 * @param {number} [options.powerScale=1] - Intensidad aplicada (SessionController.setIntensity / 100)
 * @param {number} options.mass - Masa total ciclista + bici (kg)
 * @param {number} options.cda - CdA de la posición del ciclista (m²)
 * @param {Object|null} [options.from] - Replanificar desde un punto: { plan, distance, time, speed }. Se conserva la
 *   altimetría del plan anterior hasta `distance` y se simula el resto desde `time` con velocidad `speed`.
 * @returns {Object} plan - { step, elevations, times, length, duration, blocks, climbs, version }
 */
export function planWorkoutTerrain({ blocks, ftp, powerScale = 1, mass, cda, from = null }) {
    const safeFtp = Math.max(50, Number(ftp) || 200);
    const list = (blocks || []).filter((block) => block && block.duration > 0);
    const starts = [];
    let duration = 0;
    for (const block of list) {
        starts.push(duration);
        duration += block.duration;
    }
    const terrains = list.map((block) => blockTerrain(block, safeFtp));
    const powers = list.map((block) => blockPowerFn(block, safeFtp));
    // El tiempo solo avanza: el bloque en curso se busca desde el último encontrado.
    const blockIndexAt = (time, from) => {
        let index = Math.max(0, from);
        while (index < list.length - 1 && time >= starts[index + 1]) index += 1;
        return index;
    };

    // Lo ya recorrido no cambia: se copian las muestras del plan anterior hasta el punto de replanificación.
    const elevations = [];
    const times = [];
    let distance = 0;
    let time = 0;
    let speed = 0;
    let elevation = 0;
    let grade = 0;
    if (from?.plan) {
        const keep = Math.min(from.plan.elevations.length - 1, Math.max(0, Math.floor(from.distance / STEP)));
        for (let index = 0; index <= keep; index += 1) {
            elevations.push(from.plan.elevations[index]);
            times.push(from.plan.times[index]);
        }
        distance = keep * STEP;
        elevation = elevations[keep];
        grade = keep > 0 ? ((elevations[keep] - elevations[keep - 1]) / STEP) * 100 : 0;
        time = Math.max(0, Number(from.time) || 0);
        times[keep] = time;
        // Si se va por delante del plan, el instante actual es anterior a los previstos: los tiempos deben crecer.
        for (let index = keep - 1; index >= 0 && times[index] > times[index + 1]; index -= 1) times[index] = times[index + 1];
        speed = Math.max(0, Number(from.speed) || 0);
    } else {
        elevations.push(0);
        times.push(0);
    }
    const frozen = elevations.length;
    const base = from?.plan ? from.plan.base : 0;

    // Simulación: la pendiente persigue la del bloque (con anticipación y límite de cambio por metro) y la velocidad
    // sale de la física con la potencia objetivo.
    const end = Math.max(time, duration);
    let nextSample = elevations.length * STEP;
    let current = 0;
    let ahead = 0;
    while (time < end) {
        current = list.length ? blockIndexAt(time, current) : -1;
        const power = current >= 0 ? powers[current](time - starts[current]) * powerScale : safeFtp * 0.6 * powerScale;
        ahead = list.length ? blockIndexAt(Math.min(end, time + LEAD_SECONDS), ahead) : -1;
        const aheadBlock = list[ahead];
        const aheadElapsed = time + LEAD_SECONDS - (starts[ahead] || 0);
        const wanted = targetGrade({
            terrain: terrains[ahead] || 'flat',
            block: aheadBlock,
            intensity: aheadBlock ? powers[ahead](Math.max(0, aheadElapsed)) / safeFtp : 0.6,
            remaining: Math.max(1, (starts[ahead] || 0) + (aheadBlock?.duration || 0) - time),
            elevation,
            base,
            distance,
            speed,
        });
        const maxChange = GRADE_RATE * Math.max(speed, 0.5) * DT;
        grade += Math.max(-maxChange, Math.min(maxChange, wanted - grade));
        speed = stepSpeed(speed, { power, grade, mass, cda, dt: DT });
        const advance = speed * DT;
        distance += advance;
        elevation += (grade / 100) * advance;
        time += DT;
        while (distance >= nextSample) {
            elevations.push(elevation);
            times.push(time);
            nextSample += STEP;
        }
    }

    smooth(elevations, frozen);
    const plan = {
        step: STEP,
        elevations,
        times,
        length: (elevations.length - 1) * STEP,
        duration,
        base,
        blocks: list,
        version: (from?.plan?.version || 0) + 1,
    };
    plan.climbs = findClimbs(plan, list, starts, terrains);
    return plan;
}

/** Pendiente que pide el terreno en este punto del plan (%). */
function targetGrade({ terrain, block, intensity, remaining, elevation, base, distance, speed }) {
    if (terrain === 'climb') return climbGrade(intensity);
    if (terrain === 'rolling') {
        // Tempo: falso llano que sube poco a poco, con ondulaciones (sin pasar de ~120 m sobre la base).
        const bias = elevation - base > 120 ? 0 : 1 + (intensity - 0.62) * 5;
        return bias + ((rolling(distance + 20) - rolling(distance)) / 20) * 100;
    }
    if (terrain === 'descent') {
        // Bajada que vuelve a la cota base justo antes de acabar el bloque; abajo, llano.
        const horizon = Math.max(80, remaining * 0.85 * Math.max(speed, 8));
        const drop = elevation - base;
        if (drop <= 0.5) return ((base + rolling(distance + 25) - elevation) / 25) * 100;
        return -Math.min(block?.type === BLOCK_TYPES.COOLDOWN ? 4 : 7, (drop / horizon) * 100);
    }
    // Llano: sigue la ondulación alrededor de la cota actual de la base (sin bajar de golpe si se viene de arriba).
    const floor = Math.max(base, elevation - 0.2 * Math.max(speed, 5));
    return Math.max(-3, Math.min(1.5, ((floor + rolling(distance + 25) - elevation) / 25) * 100));
}

/** Media móvil de las cotas planificadas (no toca lo ya recorrido). */
function smooth(elevations, frozen) {
    const source = elevations.slice();
    for (let index = Math.max(1, frozen); index < elevations.length - 1; index += 1) {
        let sum = 0;
        let count = 0;
        for (let offset = -SMOOTH_RADIUS; offset <= SMOOTH_RADIUS; offset += 1) {
            const value = source[index + offset];
            if (value === undefined) continue;
            sum += value;
            count += 1;
        }
        elevations[index] = sum / count;
    }
}

/** Subidas del plan: tramo de cada bloque de subida, del pie (cota mínima) a la cima (cota máxima). */
function findClimbs(plan, list, starts, terrains) {
    const climbs = [];
    list.forEach((block, index) => {
        if (terrains[index] !== 'climb') return;
        const from = distanceAtTime(plan, starts[index] - LEAD_SECONDS);
        const to = distanceAtTime(plan, starts[index] + block.duration);
        const first = Math.floor(from / STEP);
        const last = Math.min(plan.elevations.length - 1, Math.ceil(to / STEP));
        let top = first;
        let foot = first;
        for (let sample = first; sample <= last; sample += 1) {
            if (plan.elevations[sample] > plan.elevations[top]) top = sample;
        }
        for (let sample = first; sample <= top; sample += 1) {
            if (plan.elevations[sample] < plan.elevations[foot]) foot = sample;
        }
        const gain = plan.elevations[top] - plan.elevations[foot];
        if (gain < MIN_CLIMB_GAIN) return;
        climbs.push({ start: foot * STEP, top: top * STEP, gain, blockIndex: index });
    });
    return climbs;
}

/** Cota (m) del plan a una distancia (interpolada; fuera del plan, la del extremo). */
export function elevationAt(plan, distance) {
    const position = Math.max(0, Math.min(plan.length, distance)) / plan.step;
    const index = Math.min(plan.elevations.length - 2, Math.floor(position));
    if (index < 0) return plan.elevations[0] || 0;
    const fraction = position - index;
    return plan.elevations[index] + (plan.elevations[index + 1] - plan.elevations[index]) * fraction;
}

/** Pendiente (%) del plan a una distancia (diferencia de cotas a ±4 m, como la física del ciclista). */
export function gradeAt(plan, distance) {
    return ((elevationAt(plan, distance + 4) - elevationAt(plan, distance - 4)) / 8) * 100;
}

/** Distancia (m) a la que el plan prevé estar en un instante de la sesión. */
export function distanceAtTime(plan, time) {
    const { times } = plan;
    if (!(time > times[0])) return 0;
    const last = times.length - 1;
    if (time >= times[last]) return last * plan.step;
    let left = 0;
    let right = last;
    while (left < right - 1) {
        const mid = (left + right) >> 1;
        if (times[mid] <= time) left = mid;
        else right = mid;
    }
    const span = times[right] - times[left];
    return (left + (span > 0 ? (time - times[left]) / span : 0)) * plan.step;
}

/**
 * Alarga el plan por el final con llano ondulado (el ciclista va por delante de lo previsto o la sesión sigue).
 * Devuelve un plan nuevo; el anterior no se modifica.
 */
export function extendPlan(plan, meters) {
    const elevations = plan.elevations.slice();
    const times = plan.times.slice();
    const lastTime = times[times.length - 1];
    const lastElevation = elevations[elevations.length - 1];
    const samples = Math.ceil(meters / plan.step);
    for (let index = 1; index <= samples; index += 1) {
        const distance = (elevations.length) * plan.step;
        const settle = Math.min(1, index / 40);
        elevations.push(lastElevation + (rolling(distance) - rolling(plan.length)) * settle);
        times.push(lastTime + index * (plan.step / 9));
    }
    return { ...plan, elevations, times, length: (elevations.length - 1) * plan.step, version: plan.version + 1 };
}

/**
 * Rumbo (grados, 0 = +Z) de la carretera a una distancia: curvas amplias deterministas por semilla. Siempre entre
 * ±80°, así la ruta avanza en +Z y nunca se cruza consigo misma (el terreno se apoya en el tramo más cercano).
 */
export function headingAt(distance, seed = 0) {
    const phase = (seed % 997) * 0.37;
    const heading = 52 * Math.sin(distance / 1100 + phase)
        + 26 * Math.sin(distance / 330 + phase * 1.7)
        + 14 * Math.sin(distance / 95 + phase * 2.9);
    return Math.max(-80, Math.min(80, heading));
}
