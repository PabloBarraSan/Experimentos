/**
 * WorkoutProfile — el entreno dibujado como una cordillera: la altura y el color de cada tramo
 * dicen cuánta intensidad pide (% del FTP). Las rampas se dibujan inclinadas y los descansos
 * entre series, como valles.
 */

import { expandBlocks, TARGET_TYPES } from '../workouts/model.js';

const SVG_NS = 'http://www.w3.org/2000/svg';
const WIDTH = 1000;
const MAX_PERCENT = 130;

// Una escala continua de frío (suave) a cálido (máximo), pensada para el fondo pino de la app.
export const ZONE_COLORS = [
    { max: 55, key: 'z1', color: '#86aab0', label: 'Recuperación' },
    { max: 76, key: 'z2', color: '#52a9dc', label: 'Resistencia' },
    { max: 91, key: 'z3', color: '#8ee9d0', label: 'Tempo' },
    { max: 106, key: 'z4', color: '#f3c352', label: 'Umbral' },
    { max: 121, key: 'z5', color: '#ff7b46', label: 'VO2max' },
    { max: Infinity, key: 'z6', color: '#ff4f6d', label: 'Anaeróbico' },
];

export function zoneForPercent(percent) {
    return ZONE_COLORS.find((zone) => percent < zone.max);
}

function svg(tag, attrs = {}) {
    const element = document.createElementNS(SVG_NS, tag);
    Object.entries(attrs).forEach(([key, value]) => element.setAttribute(key, String(value)));
    return element;
}

function blockPercents(block) {
    if (block.targetType !== TARGET_TYPES.POWER_FTP) return [70, 70];
    const start = Number(block.targetValue) || 0;
    return [start, Number(block.targetValueEnd ?? start) || start];
}

function tickLabel(seconds) {
    const minutes = Math.round(seconds / 60);
    return minutes >= 60 && minutes % 60 === 0 ? `${minutes / 60} h` : `${minutes} min`;
}

/** Elige un paso de marcas que deje entre 4 y 8 divisiones. */
function tickStep(totalSeconds) {
    const candidates = [300, 600, 900, 1200, 1800, 3600];
    return candidates.find((step) => totalSeconds / step <= 8) || 3600;
}

/**
 * @param {Object} workout Workout del modelo (con blocks)
 * @param {Object} [options]
 * @param {number} [options.height] Alto del dibujo en px (por defecto 180)
 */
export function createWorkoutProfile(workout, { height = 180 } = {}) {
    const blocks = expandBlocks(workout?.blocks || []);
    const total = blocks.reduce((sum, block) => sum + block.duration, 0) || 1;
    const plotHeight = height;
    const yFor = (percent) => plotHeight - (Math.min(percent, MAX_PERCENT) / MAX_PERCENT) * (plotHeight - 8);

    const root = svg('svg', {
        viewBox: `0 0 ${WIDTH} ${height}`,
        preserveAspectRatio: 'none',
        role: 'img',
        class: 'hp-profile',
        'aria-label': 'Perfil de intensidad del entrenamiento',
    });
    root.style.height = `${height}px`;

    let x = 0;
    blocks.forEach((block) => {
        const width = (block.duration / total) * WIDTH;
        const [from, to] = blockPercents(block);
        const average = (from + to) / 2;
        const zone = zoneForPercent(average);
        const yFrom = yFor(from);
        const yTo = yFor(to);
        const path = svg('path', {
            d: `M${x.toFixed(2)} ${plotHeight} L${x.toFixed(2)} ${yFrom.toFixed(2)} L${(x + width).toFixed(2)} ${yTo.toFixed(2)} L${(x + width).toFixed(2)} ${plotHeight} Z`,
            fill: zone.color,
            'fill-opacity': 1,
            stroke: '#0b1517',
            'stroke-width': 1.5,
            'vector-effect': 'non-scaling-stroke',
            'stroke-linejoin': 'round',
        });
        const title = svg('title');
        title.textContent = `${block.name || 'Tramo'} · ${Math.round(average)} % FTP · ${tickLabel(block.duration)}`;
        path.appendChild(title);
        root.appendChild(path);
        x += width;
    });

    return root;
}

/**
 * Perfil con eje de tiempo en HTML (el texto no se deforma al estirar el SVG) y leyenda de zonas.
 */
export function createWorkoutProfileFrame(workout, { height = 190, legend = true } = {}) {
    const total = expandBlocks(workout?.blocks || []).reduce((sum, block) => sum + block.duration, 0) || 1;
    const frame = document.createElement('div');
    frame.className = 'hp-profile-frame';

    const plot = createWorkoutProfile(workout, { height });
    const ftpLine = document.createElement('div');
    ftpLine.className = 'hp-profile-ftp';
    ftpLine.style.bottom = `${(100 / MAX_PERCENT) * (height - 8) / height * 100}%`;
    ftpLine.innerHTML = '<span>FTP</span>';

    const plotWrap = document.createElement('div');
    plotWrap.className = 'hp-profile-plot';
    plotWrap.append(plot, ftpLine);

    const axis = document.createElement('div');
    axis.className = 'hp-profile-axis';
    const step = tickStep(total);
    for (let seconds = 0; seconds <= total; seconds += step) {
        const tick = document.createElement('span');
        tick.textContent = seconds === 0 ? '0' : tickLabel(seconds);
        tick.style.left = `${(seconds / total) * 100}%`;
        axis.appendChild(tick);
    }
    frame.append(plotWrap, axis);

    if (legend) {
        const list = document.createElement('ul');
        list.className = 'hp-profile-legend';
        ZONE_COLORS.forEach((zone) => {
            const item = document.createElement('li');
            item.innerHTML = `<i style="background:${zone.color}"></i>${zone.label}`;
            list.appendChild(item);
        });
        frame.appendChild(list);
    }
    return frame;
}
