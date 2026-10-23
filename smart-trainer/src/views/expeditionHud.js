import { typography } from '../utils/theme.js';
import { createElement, div, formatTime } from '../utils/dom.js';
import { BLOCK_TYPES, expandBlocks } from '../workouts/model.js';

// Bloques que cuentan como "vuelta" de trabajo (los demás solo se registran).
const WORK_TYPES = new Set([BLOCK_TYPES.INTERVAL, BLOCK_TYPES.STEADY, BLOCK_TYPES.RAMP]);

function zoneColor(percent) {
    if (percent < 55) return '#5f8fb4';
    if (percent < 76) return '#4fcf9a';
    if (percent < 91) return '#f2cc4a';
    if (percent < 106) return '#ff9a3c';
    return '#ff5a4d';
}

function blockPercent(block) {
    const start = Number(block.targetValue) || 0;
    const end = block.targetValueEnd != null && block.type === BLOCK_TYPES.RAMP ? Number(block.targetValueEnd) : start;
    return { start, end, mean: (start + end) / 2 };
}

function targetWatts(block, ftp) {
    if (block.targetType && block.targetType !== 'power_ftp') {
        return block.targetType === 'power_absolute' ? Math.round(block.targetValue) : null;
    }
    return Math.round((blockPercent(block).mean / 100) * ftp);
}

export function describeLap(block) {
    if (block.type === BLOCK_TYPES.INTERVAL && block.repeat > 1) {
        return `SERIE ${(block.repeatIndex ?? 0) + 1}/${block.repeat}`;
    }
    return String(block.name || 'TRAMO').toUpperCase();
}

// Registra la potencia media y el tiempo en zona de cada bloque (vuelta).
export class LapTracker {
    constructor() {
        this.laps = [];
        this.current = null;
    }

    start(block, index) {
        const finished = this.close();
        this.current = {
            index,
            block,
            label: describeLap(block),
            work: WORK_TYPES.has(block.type),
            powers: 0,
            samples: 0,
            zoneSamples: 0,
            zoneCounted: 0,
            targetSum: 0,
            seconds: 0,
        };
        return finished;
    }

    sample(power, targetPower, blockElapsed) {
        const lap = this.current;
        if (!lap || !Number.isFinite(power)) return;
        lap.powers += power;
        lap.targetSum += targetPower || 0;
        lap.samples += 1;
        // Los primeros segundos son transición: no penalizan el tiempo en zona.
        if (targetPower > 0 && blockElapsed > 8) {
            lap.zoneCounted += 1;
            if (Math.abs(power - targetPower) <= targetPower * 0.1) lap.zoneSamples += 1;
        }
    }

    average() {
        const lap = this.current;
        if (!lap?.samples) return null;
        return { power: lap.powers / lap.samples, target: lap.targetSum / lap.samples };
    }

    close() {
        const lap = this.current;
        this.current = null;
        if (!lap || lap.samples < 3) return null;
        const summary = {
            index: lap.index,
            label: lap.label,
            name: lap.block.name,
            type: lap.block.type,
            work: lap.work,
            avgPower: Math.round(lap.powers / lap.samples),
            avgTarget: Math.round(lap.targetSum / lap.samples),
            zonePercent: lap.zoneCounted ? Math.round((lap.zoneSamples / lap.zoneCounted) * 100) : null,
            duration: lap.samples,
        };
        summary.percent = summary.avgTarget ? Math.round((summary.avgPower / summary.avgTarget) * 100) : null;
        this.laps.push(summary);
        return summary;
    }
}

// Perfil del entrenamiento (estilo TrainerRoad/Zwift) + qué toca ahora y después.
export function createWorkoutStrip({ workout, ftp, totalDuration }) {
    const blocks = expandBlocks(workout.blocks || []);
    const strip = div({ className: 'xh-strip' });
    const segments = blocks.map((block) => {
        const { start, end } = blockPercent(block);
        const top = Math.max(start, end);
        const height = Math.max(14, Math.min(100, (top / 130) * 100));
        const startHeight = Math.max(14, Math.min(100, (start / 130) * 100));
        const endHeight = Math.max(14, Math.min(100, (end / 130) * 100));
        const el = div({
            className: 'xh-strip__seg',
            styles: {
                flex: `${block.duration} 0 0`,
                height: `${height}%`,
                background: zoneColor((start + end) / 2),
                clipPath: start !== end
                    ? `polygon(0 ${100 - (startHeight / height) * 100}%, 100% ${100 - (endHeight / height) * 100}%, 100% 100%, 0 100%)`
                    : 'none',
            },
        });
        strip.appendChild(el);
        return el;
    });
    // Línea del 100 % del FTP: referencia para ver cuánto aprietan los tramos
    strip.appendChild(div({ className: 'xh-strip__ftp', styles: { bottom: `${(100 / 130) * 100}%` } }));
    const cursor = div({ className: 'xh-strip__cursor' });
    strip.appendChild(cursor);

    const lapLabel = createElement('span', { className: 'xh-lap__name' });
    const lapAverage = createElement('span', { className: 'xh-lap__avg' });
    const nextLabel = createElement('div', { className: 'xh-lap__next' });
    const blockClock = createElement('span', {
        text: '--:--',
        className: 'xh-lap__clock',
        attrs: { 'aria-label': 'Tiempo restante del tramo' },
    });
    const info = div({
        className: 'xh-lap__head',
        children: [
            div({
                className: 'xh-lap__titles',
                children: [
                    createElement('span', { text: 'Tramo actual', className: 'xh-eyebrow' }),
                    lapLabel,
                    lapAverage,
                ],
            }),
            div({
                children: [
                    createElement('span', { text: 'Restante', className: 'xh-eyebrow xh-lap__clock-label' }),
                    blockClock,
                ],
            }),
        ],
    });
    const element = div({ className: 'xh-lap xh-glass', children: [info, strip, nextLabel] });

    let activeIndex = -1;
    return {
        element,
        setBlock(block, index) {
            activeIndex = index;
            segments.forEach((segment, position) => {
                segment.style.opacity = position === index ? '1' : position < index ? '.28' : '.55';
                segment.style.filter = position === index ? 'brightness(1.15) saturate(1.1)' : 'none';
            });
            lapLabel.textContent = describeLap(block);
            const next = blocks[index + 1];
            if (next) {
                const watts = targetWatts(next, ftp);
                const kind = next.type === BLOCK_TYPES.REST ? 'Descanso' : next.type === BLOCK_TYPES.INTERVAL ? 'Esfuerzo' : next.type === BLOCK_TYPES.COOLDOWN ? 'Vuelta a la calma' : 'Ritmo';
                nextLabel.textContent = `Siguiente → ${kind} ${formatTime(next.duration)}${watts ? ` · ${watts} W` : ''}`;
            } else {
                nextLabel.textContent = 'ÚLTIMO TRAMO';
            }
        },
        setBlockRemaining(seconds) {
            blockClock.textContent = formatTime(Math.max(0, seconds));
            blockClock.style.color = seconds <= 10 ? '#ffd379' : '#fff';
        },
        setProgress(elapsed) {
            cursor.style.left = `${Math.max(0, Math.min(100, (elapsed / totalDuration) * 100))}%`;
        },
        setAverage(average) {
            if (!average || !average.target) {
                lapAverage.textContent = '';
                return;
            }
            const ratio = average.power / average.target;
            lapAverage.textContent = `MEDIA ${Math.round(average.power)} W · ${Math.round(ratio * 100)}%`;
            lapAverage.style.color = Math.abs(ratio - 1) <= 0.05 ? '#63e0b5' : Math.abs(ratio - 1) <= 0.1 ? '#ffd379' : '#ff8a6b';
        },
        get activeIndex() { return activeIndex; },
    };
}

// Aviso al cerrar una serie/vuelta con su media y tiempo en zona.
export function createLapToast() {
    const title = createElement('div', { className: 'xh-eyebrow' });
    const main = createElement('div', { className: 'xh-toast__main' });
    const detail = createElement('div', { className: 'xh-toast__detail' });
    const element = div({ className: 'xh-toast xh-glass', children: [title, main, detail] });
    let timeout = null;
    return {
        element,
        // El alto se resuelve en CSS (media queries); se mantiene por compatibilidad.
        setCompact() {},
        show(summary) {
            title.textContent = `${summary.label} COMPLETADA`;
            main.textContent = `${summary.avgPower} W`;
            const parts = [];
            if (summary.percent != null) parts.push(`${summary.percent}% del objetivo`);
            if (summary.zonePercent != null) parts.push(`${summary.zonePercent}% en zona`);
            detail.textContent = parts.join(' · ');
            const good = summary.percent != null && Math.abs(summary.percent - 100) <= 5;
            main.style.color = good ? '#63e0b5' : Math.abs((summary.percent ?? 100) - 100) <= 10 ? '#ffd379' : '#ff8a6b';
            element.classList.add('is-visible');
            clearTimeout(timeout);
            timeout = setTimeout(() => element.classList.remove('is-visible'), 6000);
        },
        destroy() { clearTimeout(timeout); },
    };
}

const ORDINAL = (n) => `${n}º`;

// Clasificación del pelotón: chip compacto y lista completa en modo "Completa".
export function createRacePanel() {
    const rank = createElement('div', { className: 'xh-race__rank' });
    const total = createElement('span', { className: 'xh-race__total' });
    const rival = createElement('div', { className: 'xh-race__rival' });
    const list = div({ className: 'xh-race__list' });
    const element = div({
        className: 'xh-race xh-glass',
        children: [div({ className: 'xh-race__head', children: [rank, total] }), rival, list],
    });
    let showList = false;
    let lastKey = '';
    return {
        element,
        setMode(mode) {
            showList = mode === 'full';
            list.style.display = showList ? 'grid' : 'none';
            element.style.opacity = mode === 'hidden' ? '0' : '1';
            lastKey = '';
        },
        setCompact() {},
        setEnabled(enabled) {
            element.style.display = enabled ? 'block' : 'none';
        },
        update(status) {
            if (!status?.entries?.length) return;
            const key = status.entries.map((entry) => `${entry.name}${Math.round(entry.gap)}`).join('|');
            if (key === lastKey) return;
            lastKey = key;
            rank.textContent = ORDINAL(status.rank);
            total.textContent = `de ${status.total}`;
            const index = status.rank - 1;
            const ahead = status.entries[index - 1];
            const behind = status.entries[index + 1];
            rival.textContent = ahead
                ? `▲ ${ahead.name} ${Math.round(ahead.gap)} m`
                : behind ? `▼ ${behind.name} ${Math.round(-behind.gap)} m` : 'En cabeza';
            rival.style.color = ahead ? '#ffd379' : '#63e0b5';
            if (!showList) return;
            list.replaceChildren(...status.entries.map((entry, position) => div({
                className: `xh-race__row${entry.isPlayer ? ' is-player' : ''}`,
                children: [
                    createElement('span', { text: String(position + 1), className: 'xh-race__pos' }),
                    div({ className: 'xh-race__dot', styles: { background: `#${entry.color.toString(16).padStart(6, '0')}` } }),
                    createElement('span', { text: entry.name }),
                    createElement('span', {
                        text: entry.isPlayer ? '—' : `${entry.gap >= 0 ? '+' : '−'}${Math.abs(Math.round(entry.gap))} m`,
                        className: 'xh-race__gap',
                    }),
                ],
            })));
        },
    };
}

// Tabla de vueltas para la pantalla de resultados.
export function createLapTable(laps) {
    const rows = laps.filter((lap) => lap.work);
    if (!rows.length) return null;
    return div({
        styles: { display: 'grid', gap: '6px', width: '100%', marginBottom: '16px' },
        children: [
            createElement('div', { text: 'VUELTAS', styles: { fontSize: '11px', letterSpacing: '1.5px', fontWeight: 800, color: 'rgba(255,255,255,.55)' } }),
            ...rows.map((lap) => div({
                styles: {
                    display: 'grid', gridTemplateColumns: '1fr auto auto auto', gap: '12px', alignItems: 'center',
                    padding: '8px 12px', borderRadius: '10px', background: 'rgba(255,255,255,.05)', fontSize: '13px',
                },
                children: [
                    createElement('strong', { text: lap.label }),
                    createElement('span', { text: `${lap.avgPower} W`, styles: { fontFamily: typography.fontMono } }),
                    createElement('span', {
                        text: lap.percent != null ? `${lap.percent}%` : '--',
                        styles: { color: lap.percent != null && Math.abs(lap.percent - 100) <= 5 ? '#63e0b5' : '#ffd379', fontWeight: 700 },
                    }),
                    createElement('span', { text: lap.zonePercent != null ? `${lap.zonePercent}% zona` : '', styles: { color: 'rgba(255,255,255,.55)', fontSize: '12px' } }),
                ],
            })),
        ],
    });
}
