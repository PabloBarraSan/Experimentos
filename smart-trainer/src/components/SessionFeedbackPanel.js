/**
 * Panel opcional al terminar una sesión: esfuerzo percibido (RPE), qué limitó y una nota.
 * Los vatios y el pulso no cuentan cómo se sintió el usuario; este dato sí.
 * Los estilos viven en views/result.css (clases rs-*).
 */

import '../views/result.css';
import { button, createElement, div } from '../utils/dom.js';
import { saveSessionFeedback } from '../storage/sessions.js';
import { pushSession } from '../sync/TrainingAppSync.js';

const LIMITERS = [
    { id: 'legs', label: 'Piernas' },
    { id: 'breathing', label: 'Respiración' },
    { id: 'fatigue', label: 'Cansancio general' },
    { id: 'none', label: 'Nada, fue fácil' },
];

/** Botones de elección única; devuelve el contenedor. */
function choiceGroup(className, options, onSelect) {
    const buttons = options.map(({ id, label }) => button({
        text: label,
        attrs: { type: 'button', 'aria-pressed': 'false', 'data-value': String(id) },
        events: { click: () => select(id) },
    }));
    function select(id) {
        buttons.forEach((item) => item.setAttribute('aria-pressed', String(item.dataset.value === String(id))));
        onSelect(id);
    }
    return div({ attrs: { class: className, role: 'group' }, children: buttons });
}

export function createSessionFeedbackPanel(session) {
    const answer = { rpe: null, limiter: null };
    const status = createElement('p', { attrs: { class: 'rs-status', 'aria-live': 'polite' } });
    const note = createElement('input', {
        attrs: {
            type: 'text', maxlength: '280', class: 'rs-input',
            placeholder: 'Algo más que apuntar: calor, dolor, sueño…', 'aria-label': 'Nota de la sesión',
        },
    });
    const save = button({
        text: 'Guardar valoración',
        attrs: { type: 'button', class: 'rs-btn' },
        events: {
            click: async () => {
                save.disabled = true;
                try {
                    await saveSessionFeedback(session, { ...answer, note: note.value });
                    const sent = await pushSession(session);
                    status.textContent = sent ? 'Guardada y enviada a training-app' : 'Guardada';
                    status.className = 'rs-status is-done';
                } catch (error) {
                    status.textContent = error.message;
                    status.className = 'rs-status';
                    save.disabled = false;
                }
            },
        },
    });

    return div({
        attrs: { 'data-feedback-panel': 'true', class: 'rs-panel rs-feedback' },
        children: [
            createElement('h2', { text: '¿Cómo te has sentido?' }),
            createElement('p', { text: 'Cuenta lo que los vatios no dicen. Tarda cinco segundos.', attrs: { class: 'rs-feedback-lede' } }),
            createElement('p', { attrs: { class: 'rs-q' }, children: [createElement('span', { text: 'Esfuerzo percibido' })] }),
            choiceGroup('rs-rpe', Array.from({ length: 10 }, (_, index) => ({ id: index + 1, label: String(index + 1) })), (id) => { answer.rpe = id; }),
            div({ attrs: { class: 'rs-rpe-scale' }, children: [createElement('span', { text: '1 · paseo' }), createElement('span', { text: '10 · máximo' })] }),
            createElement('p', { text: '¿Qué te limitó?', attrs: { class: 'rs-q' } }),
            choiceGroup('rs-choices', LIMITERS, (id) => { answer.limiter = id; }),
            note,
            div({ attrs: { class: 'rs-save-row' }, children: [save, status] }),
        ],
    });
}
