/**
 * SessionResult — pantalla final de una sesión: veredicto, progreso, intensidad, vueltas,
 * resultado por tramo y valoración. Estilos en views/result.css (clases rs-*).
 */

import '../views/result.css';
import { button, createElement, div, formatTime } from '../utils/dom.js';
import { ZONE_COLORS } from './WorkoutProfile.js';

const HR_ZONE_COLORS = ZONE_COLORS.slice(0, 5).map((zone) => zone.color);

function progressStat(value, label, { gain = false } = {}) {
    return div({ children: [
        createElement('strong', { text: value, attrs: gain ? { class: 'is-gain' } : {} }),
        createElement('span', { text: label }),
    ] });
}

function panel(title, ...children) {
    return div({ attrs: { class: 'rs-panel' }, children: [createElement('h2', { text: title }), ...children] });
}

function metric(value, label) {
    return div({ children: [createElement('strong', { text: value }), createElement('span', { text: label })] });
}

function intensityPanel(intensity) {
    const total = intensity.zoneSeconds.reduce((sum, value) => sum + value, 0) || 1;
    const metrics = div({
        attrs: { class: 'rs-metrics' },
        children: [
            metric(intensity.avgPower ? `${intensity.avgPower} W` : '—', 'Potencia media'),
            metric(intensity.hasHeartRate ? `${intensity.avgHeartRate}` : '—', 'Pulso medio'),
            metric(intensity.hasHeartRate ? `${intensity.maxHeartRate}` : '—', 'Pulso máximo'),
        ],
    });
    if (!intensity.hasHeartRate) {
        return panel(
            'Intensidad',
            metrics,
            createElement('p', { text: 'Sin datos de pulso. Conecta un pulsómetro al preparar la sesión para medir la intensidad.', attrs: { class: 'rs-note' } }),
        );
    }
    const bar = div({
        attrs: { class: 'rs-zones', role: 'img', 'aria-label': 'Tiempo en cada zona de pulso' },
        children: intensity.zoneSeconds.map((seconds, index) => {
            const segment = createElement('i', { attrs: { title: `Z${index + 1}: ${formatTime(Math.round(seconds))}` } });
            segment.style.width = `${(seconds / total) * 100}%`;
            segment.style.background = HR_ZONE_COLORS[index];
            return segment;
        }),
    });
    const legend = createElement('ul', {
        attrs: { class: 'rs-zone-legend' },
        children: intensity.zoneSeconds.map((seconds, index) => {
            const swatch = createElement('b');
            swatch.style.background = HR_ZONE_COLORS[index];
            return createElement('li', { children: [swatch, createElement('span', { text: `Z${index + 1} ${formatTime(Math.round(seconds))}` })] });
        }),
    });
    return panel('Intensidad', metrics, bar, legend);
}

function lapsPanel(laps) {
    const rows = (laps || []).filter((lap) => lap.work);
    if (!rows.length) return null;
    return panel('Vueltas', div({
        attrs: { class: 'rs-rows' },
        children: rows.map((lap) => {
            const onTarget = lap.percent != null && Math.abs(lap.percent - 100) <= 5;
            return div({ attrs: { class: 'rs-row rs-lap' }, children: [
                createElement('strong', { text: lap.label }),
                createElement('em', { text: `${lap.avgPower} W` }),
                createElement('b', { text: lap.percent != null ? `${lap.percent} %` : '—', attrs: { class: onTarget ? 'is-on' : 'is-off' } }),
                createElement('em', { text: lap.zonePercent != null ? `${lap.zonePercent} % en zona` : '' }),
            ] });
        }),
    }));
}

function blocksPanel(blocks) {
    if (!blocks?.length) return null;
    return panel('Tramos', div({
        attrs: { class: 'rs-rows' },
        children: blocks.map((block) => {
            const adherence = Math.round((block.powerAdherence ?? block.adherence) * 100);
            const fill = createElement('i', { attrs: { class: adherence >= 85 ? '' : 'is-off' } });
            fill.style.width = `${Math.max(0, Math.min(100, adherence))}%`;
            return div({ attrs: { class: 'rs-row' }, children: [
                createElement('strong', { text: block.name, attrs: { title: `${block.name} · ${adherence} % de la potencia objetivo` } }),
                div({ attrs: { class: 'rs-bar', role: 'img', 'aria-label': `${adherence} % de la potencia objetivo` }, children: [fill] }),
                createElement('span', { text: `${block.stars} ★`, attrs: { class: 'rs-stars' } }),
            ] });
        }),
    }));
}

function coachingTip(adherence) {
    if (adherence >= 0.9) return 'Excelente precisión. Prueba una ruta técnica en la próxima expedición.';
    if (adherence >= 0.75) return 'Buen ritmo. Tu siguiente mejora está en mantener la potencia durante los cambios.';
    return 'Busca primero estabilidad: suaviza las transiciones y deja que el ERG se adapte.';
}

/**
 * @param {Object} data
 * @param {boolean} data.completed La sesión se terminó entera
 * @param {boolean} data.scored Dura lo bastante para puntuar (3 min)
 * @param {Object} data.result session.gameResult
 * @param {Object} data.intensity Resultado de summarizeIntensity
 * @param {Object} data.progress Progreso ya actualizado
 * @param {number} data.gainedXp
 * @param {string|null} data.peloton Texto como «2º de 5», si hubo pelotón
 * @param {Array} data.laps
 * @param {HTMLElement|null} data.feedback Panel de valoración
 * @param {Function} data.onHistory
 */
export function createSessionResult({ completed, scored, result, intensity, progress, gainedXp, peloton, laps, feedback, testResult, onHistory }) {
    const adherence = result.adherence || 0;
    const stats = [];
    if (gainedXp > 0) stats.push(progressStat(`+${gainedXp}`, 'XP ganados', { gain: true }));
    stats.push(progressStat(String(progress.level), 'Nivel'));
    if (peloton) stats.push(progressStat(peloton, 'Pelotón'));
    stats.push(progressStat(`${Math.round(progress.weekly.activeMinutes)}/${progress.weekly.goalMinutes}`, 'Min esta semana'));

    const head = div({
        attrs: { class: 'rs-head' },
        children: [
            div({ children: [
                createElement('span', {
                    text: completed ? 'Misión completada' : 'Terminaste antes de tiempo',
                    attrs: { class: `rs-verdict${completed ? '' : ' is-partial'}` },
                }),
                scored
                    ? createElement('h1', { attrs: { class: 'rs-score' }, children: [
                        createElement('span', { children: [
                            createElement('span', { text: String(result.totalStars || 0) }),
                            createElement('span', { text: '★', attrs: { class: 'rs-star', 'aria-label': 'estrellas' } }),
                        ] }),
                        createElement('small', { text: `${Math.round(adherence * 100)} % de precisión · ${result.score || 0} puntos` }),
                    ] })
                    : createElement('h1', { text: 'Sesión muy corta', attrs: { class: 'rs-score' } }),
                scored ? null : createElement('p', { text: 'Con menos de 3 minutos no puntúa ni da XP.', attrs: { class: 'rs-score-note is-short' } }),
            ] }),
            scored ? div({ attrs: { class: 'rs-progress' }, children: stats }) : null,
        ],
    });

    // Tramos y vueltas a la izquierda; a la derecha cómo fue el cuerpo (intensidad y valoración).
    const left = [blocksPanel(result.blocks), lapsPanel(laps)].filter(Boolean);
    const right = [testResult, intensityPanel(intensity), scored ? feedback : null].filter(Boolean);

    return div({
        attrs: { class: 'rs' },
        children: [
            head,
            div({ attrs: { class: 'rs-grid' }, children: [
                div({ attrs: { class: 'rs-col' }, children: left }),
                div({ attrs: { class: 'rs-col' }, children: right }),
            ] }),
            div({ attrs: { class: 'rs-foot' }, children: [
                scored ? createElement('p', { text: coachingTip(adherence), attrs: { class: 'rs-tip' } }) : createElement('span'),
                button({ text: 'Ver historial', attrs: { type: 'button', class: 'rs-btn rs-btn--primary' }, events: { click: onHistory } }),
            ] }),
        ],
    });
}
