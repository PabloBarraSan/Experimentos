import { colors, typography } from '../utils/theme.js';
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

const glass = {
    background: 'linear-gradient(135deg, rgba(7,14,18,.86), rgba(15,36,38,.78))',
    border: '1px solid rgba(255,255,255,.12)',
};

// Perfil del entrenamiento (estilo TrainerRoad/Zwift) + qué toca ahora y después.
export function createWorkoutStrip({ workout, ftp, totalDuration, blocks: expandedBlocks = null }) {
    // `blocks` ya expandidos (p. ej. tras alargar un bloque); si no, se expanden los del workout.
    const blocks = expandedBlocks || expandBlocks(workout.blocks || []);
    const strip = div({
        styles: { position: 'relative', display: 'flex', alignItems: 'flex-end', gap: '1px', height: '38px', width: '100%' },
    });
    const segments = blocks.map((block) => {
        const { start, end } = blockPercent(block);
        const top = Math.max(start, end);
        const height = Math.max(14, Math.min(100, (top / 130) * 100));
        const startHeight = Math.max(14, Math.min(100, (start / 130) * 100));
        const endHeight = Math.max(14, Math.min(100, (end / 130) * 100));
        const el = div({
            styles: {
                flex: `${block.duration} 0 0`,
                height: `${height}%`,
                background: zoneColor((start + end) / 2),
                opacity: '.5',
                borderRadius: '3px 3px 0 0',
                transition: 'opacity .3s ease, filter .3s ease',
                clipPath: start !== end
                    ? `polygon(0 ${100 - (startHeight / height) * 100}%, 100% ${100 - (endHeight / height) * 100}%, 100% 100%, 0 100%)`
                    : 'none',
            },
        });
        strip.appendChild(el);
        return el;
    });
    const cursor = div({
        styles: {
            position: 'absolute', top: '-3px', bottom: '0', width: '2px', left: '0%',
            background: '#fff', boxShadow: '0 0 8px rgba(255,255,255,.9)', transition: 'left .6s linear',
        },
    });
    strip.appendChild(cursor);

    const lapLabel = createElement('span', {
        text: '',
        styles: { fontWeight: 800, letterSpacing: '1px', color: colors.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
    });
    const lapAverage = createElement('span', {
        text: '',
        styles: { fontFamily: typography.fontMono, fontWeight: 800, color: 'rgba(255,255,255,.7)', whiteSpace: 'nowrap' },
    });
    const nextLabel = createElement('span', {
        text: '',
        styles: { color: 'rgba(255,255,255,.62)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
    });
    const blockClock = createElement('span', {
        text: '--:--',
        attrs: { 'aria-label': 'Tiempo restante del tramo' },
        styles: { fontFamily: typography.fontMono, fontSize: '26px', fontWeight: 800, lineHeight: 1, color: '#fff', flex: '0 0 auto' },
    });
    const info = div({
        styles: {
            display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px',
            fontSize: '11px', width: '100%',
        },
        children: [
            div({
                styles: { display: 'grid', gap: '3px', minWidth: 0, flex: '1 1 auto' },
                children: [
                    div({ styles: { display: 'flex', gap: '9px', alignItems: 'baseline', minWidth: 0 }, children: [lapLabel, lapAverage] }),
                    nextLabel,
                ],
            }),
            blockClock,
        ],
    });
    const element = div({
        styles: {
            ...glass, borderRadius: '14px', padding: '9px 12px 8px', display: 'grid', gap: '6px',
            width: 'min(520px, 90vw)', boxSizing: 'border-box',
        },
        children: [info, strip],
    });

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
                nextLabel.textContent = `→ ${kind} ${formatTime(next.duration)}${watts ? ` · ${watts} W` : ''}`;
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
            lapAverage.textContent = `${Math.round(average.power)} W · ${Math.round(ratio * 100)}%`;
            lapAverage.style.color = Math.abs(ratio - 1) <= 0.05 ? '#63e0b5' : Math.abs(ratio - 1) <= 0.1 ? '#ffd379' : '#ff8a6b';
        },
        get activeIndex() { return activeIndex; },
    };
}

// Aviso al cerrar una serie/vuelta con su media y tiempo en zona.
export function createLapToast() {
    const title = createElement('div', { styles: { fontSize: '11px', letterSpacing: '1.2px', fontWeight: 800, color: 'rgba(255,255,255,.66)' } });
    const main = createElement('div', { styles: { fontSize: '22px', fontWeight: 800, fontFamily: typography.fontMono } });
    const detail = createElement('div', { styles: { fontSize: '12px', color: 'rgba(255,255,255,.72)' } });
    const element = div({
        styles: {
            ...glass, position: 'absolute', left: '50%', top: '150px', transform: 'translate(-50%, -8px)',
            padding: '10px 18px', borderRadius: '14px', textAlign: 'center', opacity: '0', pointerEvents: 'none',
            transition: 'opacity .3s ease, transform .3s ease', minWidth: '210px',
        },
        children: [title, main, detail],
    });
    let timeout = null;
    return {
        element,
        setCompact(compact) {
            element.style.top = compact ? '216px' : '150px';
        },
        show(summary) {
            title.textContent = `${summary.label} COMPLETADA`;
            main.textContent = `${summary.avgPower} W`;
            const parts = [];
            if (summary.percent != null) parts.push(`${summary.percent}% del objetivo`);
            if (summary.zonePercent != null) parts.push(`${summary.zonePercent}% en zona`);
            detail.textContent = parts.join(' · ');
            const good = summary.percent != null && Math.abs(summary.percent - 100) <= 5;
            main.style.color = good ? '#63e0b5' : Math.abs((summary.percent ?? 100) - 100) <= 10 ? '#ffd379' : '#ff8a6b';
            element.style.opacity = '1';
            element.style.transform = 'translate(-50%, 0)';
            clearTimeout(timeout);
            timeout = setTimeout(() => {
                element.style.opacity = '0';
                element.style.transform = 'translate(-50%, -8px)';
            }, 6000);
        },
        destroy() { clearTimeout(timeout); },
    };
}

const ORDINAL = (n) => `${n}º`;

// Clasificación del pelotón: chip compacto y lista completa en modo "Completa".
export function createRacePanel() {
    const rank = createElement('div', { styles: { fontSize: '26px', fontWeight: 900, lineHeight: 1 } });
    const total = createElement('span', { styles: { fontSize: '12px', color: 'rgba(255,255,255,.55)', fontWeight: 700 } });
    const rival = createElement('div', { styles: { fontSize: '11px', color: 'rgba(255,255,255,.72)', fontFamily: typography.fontMono } });
    const list = div({ styles: { display: 'grid', gap: '3px', marginTop: '8px' } });
    const element = div({
        styles: { ...glass, position: 'absolute', left: '18px', top: '64px', padding: '9px 12px', borderRadius: '14px', minWidth: '132px' },
        children: [div({ styles: { display: 'flex', alignItems: 'baseline', gap: '6px' }, children: [rank, total] }), rival, list],
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
        setCompact(compact) {
            element.style.left = compact ? '12px' : '18px';
            element.style.top = compact ? '60px' : '64px';
        },
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
                styles: {
                    display: 'grid', gridTemplateColumns: '14px 8px 1fr auto', gap: '6px', alignItems: 'center', fontSize: '11px',
                    fontWeight: entry.isPlayer ? 800 : 600, color: entry.isPlayer ? '#63e0b5' : 'rgba(255,255,255,.8)',
                },
                children: [
                    createElement('span', { text: String(position + 1), styles: { color: 'rgba(255,255,255,.45)' } }),
                    div({ styles: { width: '8px', height: '8px', borderRadius: '50%', background: `#${entry.color.toString(16).padStart(6, '0')}` } }),
                    createElement('span', { text: entry.name }),
                    createElement('span', {
                        text: entry.isPlayer ? '—' : `${entry.gap >= 0 ? '+' : '−'}${Math.abs(Math.round(entry.gap))} m`,
                        styles: { fontFamily: typography.fontMono, color: 'rgba(255,255,255,.55)' },
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

/**
 * Minimapa del circuito: contorno de la ruta visto desde arriba con un punto por ciclista (tú, rivales y fantasma).
 * El contorno se escala para caber en el lienzo; los puntos se recolocan en cada update(mapState).
 */
export function createMiniMap({ size = 132 } = {}) {
    const ratio = Math.min(2, window.devicePixelRatio || 1);
    const canvas = createElement('canvas', {
        attrs: { width: String(size * ratio), height: String(size * ratio), 'aria-hidden': 'true' },
        styles: { width: `${size}px`, height: `${size}px`, display: 'block' },
    });
    const element = div({
        attrs: { title: 'Mapa del circuito' },
        styles: {
            position: 'absolute',
            right: '18px',
            top: '124px',
            padding: '8px',
            borderRadius: '18px',
            background: 'rgba(5,12,16,.62)',
            border: '1px solid rgba(255,255,255,.1)',
            backdropFilter: 'blur(6px)',
            transition: 'opacity .25s ease',
        },
        children: [canvas],
    });
    const ctx = canvas.getContext('2d');
    let frame = null;
    let enabled = true;
    const hex = (color) => `#${color.toString(16).padStart(6, '0')}`;

    // Escala y centro para que el contorno quepa con margen (se calcula una vez por contorno).
    function fit(outline) {
        const xs = outline.map((p) => p.x);
        const zs = outline.map((p) => p.z);
        const [minX, maxX, minZ, maxZ] = [Math.min(...xs), Math.max(...xs), Math.min(...zs), Math.max(...zs)];
        const scale = (size * ratio * 0.84) / Math.max(maxX - minX, maxZ - minZ, 1);
        const cx = (minX + maxX) / 2;
        const cz = (minZ + maxZ) / 2;
        // Vista desde arriba con +z hacia arriba de la pantalla.
        return { outline, at: ({ x, z }) => [size * ratio / 2 + (x - cx) * scale, size * ratio / 2 - (z - cz) * scale] };
    }

    function pointAt(t) {
        const { outline } = frame;
        const position = (((t % 1) + 1) % 1) * outline.length;
        const index = Math.floor(position);
        const next = outline[(index + 1) % outline.length];
        const current = outline[index % outline.length];
        const u = position - index;
        return frame.at({ x: current.x + (next.x - current.x) * u, z: current.z + (next.z - current.z) * u });
    }

    function dot([x, y], radius, fill, stroke) {
        ctx.beginPath();
        ctx.arc(x, y, radius * ratio, 0, Math.PI * 2);
        ctx.fillStyle = fill;
        ctx.fill();
        if (stroke) {
            ctx.lineWidth = 2 * ratio;
            ctx.strokeStyle = stroke;
            ctx.stroke();
        }
    }

    return {
        element,
        update(mapState) {
            if (!enabled || !mapState?.outline?.length) return;
            if (!frame || frame.outline !== mapState.outline) frame = fit(mapState.outline);
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.beginPath();
            mapState.outline.forEach((point, index) => {
                const [x, y] = frame.at(point);
                if (index === 0) ctx.moveTo(x, y);
                else ctx.lineTo(x, y);
            });
            ctx.closePath();
            ctx.lineJoin = 'round';
            ctx.lineWidth = 6 * ratio;
            ctx.strokeStyle = 'rgba(255,255,255,.14)';
            ctx.stroke();
            ctx.lineWidth = 2 * ratio;
            ctx.strokeStyle = 'rgba(255,255,255,.5)';
            ctx.stroke();
            // Salida/meta del circuito.
            const [sx, sy] = pointAt(0);
            ctx.fillStyle = '#ffd379';
            ctx.fillRect(sx - 4 * ratio, sy - 1.5 * ratio, 8 * ratio, 3 * ratio);
            mapState.rivals.forEach(({ t, color }) => dot(pointAt(t), 3.2, hex(color)));
            if (mapState.ghost !== null && mapState.ghost !== undefined) dot(pointAt(mapState.ghost), 3.2, 'rgba(142,217,255,.75)');
            dot(pointAt(mapState.player), 5, colors.primary, '#ffffff');
        },
        /** Visible salvo con el HUD oculto. */
        setMode(mode) {
            enabled = mode !== 'hidden';
            element.style.opacity = enabled ? '1' : '0';
        },
    };
}

/**
 * Perfil del circuito (como el de Zwift): silueta de la vuelta con el puerto resaltado, tu posición, la pendiente
 * actual (coloreada por dureza), la velocidad y lo que falta hasta la cima.
 */
export function createClimbProfile({ width = 260, height = 58 } = {}) {
    const ratio = Math.min(2, window.devicePixelRatio || 1);
    const canvas = createElement('canvas', {
        attrs: { width: String(width * ratio), height: String(height * ratio), 'aria-hidden': 'true' },
        styles: { width: `${width}px`, height: `${height}px`, display: 'block' },
    });
    const grade = createElement('strong', {
        text: '0,0 %',
        styles: { fontFamily: typography.fontDisplay, fontSize: '22px', lineHeight: 1, fontVariantNumeric: 'tabular-nums' },
    });
    const speed = createElement('span', { text: '0 km/h', styles: { color: 'rgba(255,255,255,.75)', fontSize: '13px', fontWeight: 800, fontVariantNumeric: 'tabular-nums' } });
    const summit = createElement('span', { text: '', styles: { color: '#ffd379', fontSize: '11px', fontWeight: 800, letterSpacing: '.4px' } });
    const element = div({
        attrs: { title: 'Perfil del circuito' },
        styles: {
            position: 'absolute',
            left: '18px',
            bottom: '18px',
            display: 'flex',
            flexDirection: 'column',
            gap: '6px',
            padding: '9px 11px',
            borderRadius: '16px',
            background: 'rgba(5,12,16,.66)',
            border: '1px solid rgba(255,255,255,.1)',
            backdropFilter: 'blur(6px)',
            transition: 'opacity .25s ease',
        },
        children: [
            div({ styles: { display: 'flex', alignItems: 'baseline', gap: '10px' }, children: [grade, speed, summit] }),
            canvas,
        ],
    });
    const ctx = canvas.getContext('2d');
    let enabled = true;
    let lastText = '';

    // Color por dureza: verde en llano, amarillo, naranja y rojo en rampas; azul en bajada.
    const gradeColor = (value) => {
        if (value <= -2) return '#5cc8ff';
        if (value < 3) return '#63e0b5';
        if (value < 6) return '#ffd379';
        if (value < 9) return '#ff9a4d';
        return '#ff5a6e';
    };

    return {
        element,
        update(profile) {
            if (!enabled || !profile?.samples) return;
            const { samples, position } = profile;
            const min = Math.min(...samples);
            const max = Math.max(...samples);
            const w = canvas.width;
            const h = canvas.height;
            const pad = 4 * ratio;
            const x = (index) => (index / (samples.length - 1)) * w;
            const y = (value) => h - pad - ((value - min) / Math.max(max - min, 1)) * (h - pad * 2);
            ctx.clearRect(0, 0, w, h);
            // Silueta rellena, con cada tramo coloreado según su pendiente.
            for (let index = 0; index < samples.length - 1; index += 1) {
                const rise = ((samples[index + 1] - samples[index]) / (profile.length / (samples.length - 1))) * 100;
                ctx.beginPath();
                ctx.moveTo(x(index), h);
                ctx.lineTo(x(index), y(samples[index]));
                ctx.lineTo(x(index + 1), y(samples[index + 1]));
                ctx.lineTo(x(index + 1), h);
                ctx.closePath();
                ctx.fillStyle = `${gradeColor(rise)}55`;
                ctx.fill();
            }
            ctx.beginPath();
            samples.forEach((value, index) => (index ? ctx.lineTo(x(index), y(value)) : ctx.moveTo(x(index), y(value))));
            ctx.lineWidth = 2 * ratio;
            ctx.strokeStyle = 'rgba(255,255,255,.7)';
            ctx.stroke();
            // Tu posición en la vuelta.
            const px = position * w;
            const sample = samples[Math.min(samples.length - 1, Math.round(position * (samples.length - 1)))];
            ctx.beginPath();
            ctx.moveTo(px, 0);
            ctx.lineTo(px, h);
            ctx.lineWidth = 1.5 * ratio;
            ctx.strokeStyle = 'rgba(255,255,255,.35)';
            ctx.stroke();
            ctx.beginPath();
            ctx.arc(px, y(sample), 4.5 * ratio, 0, Math.PI * 2);
            ctx.fillStyle = colors.primary;
            ctx.fill();
            ctx.lineWidth = 2 * ratio;
            ctx.strokeStyle = '#fff';
            ctx.stroke();

            const text = `${profile.grade.toFixed(1)}|${Math.round(profile.speed * 3.6)}|${profile.toSummit === null ? '' : Math.round(profile.toSummit / 10)}`;
            if (text === lastText) return;
            lastText = text;
            grade.textContent = `${profile.grade.toFixed(1).replace('.', ',')} %`;
            grade.style.color = gradeColor(profile.grade);
            speed.textContent = `${Math.round(profile.speed * 3.6)} km/h`;
            summit.textContent = profile.toSummit === null ? '' : `CIMA ${Math.round(profile.toSummit / 10) * 10} m`;
        },
        /** Visible salvo con el HUD oculto. */
        setMode(mode) {
            enabled = mode !== 'hidden';
            element.style.opacity = enabled ? '1' : '0';
        },
    };
}
