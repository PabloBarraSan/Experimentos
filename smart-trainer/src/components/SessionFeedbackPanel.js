/**
 * Panel opcional al terminar una sesión: esfuerzo percibido (RPE), qué limitó y una nota.
 * Los vatios y el pulso no cuentan cómo se sintió el usuario; este dato sí.
 */

import { colors, spacing } from '../utils/theme.js';
import { button, createElement, div } from '../utils/dom.js';
import { saveSessionFeedback } from '../storage/sessions.js';
import { pushSession } from '../sync/TrainingAppSync.js';

const LIMITERS = [
    { id: 'legs', label: 'Piernas' },
    { id: 'breathing', label: 'Respiración' },
    { id: 'fatigue', label: 'Cansancio general' },
    { id: 'none', label: 'Nada, fácil' },
];

const chipStyles = (selected) => ({
    minHeight: '40px',
    padding: '0 12px',
    borderRadius: '10px',
    border: `1px solid ${selected ? colors.primary : 'rgba(255,255,255,.14)'}`,
    background: selected ? 'rgba(0,212,170,.18)' : 'rgba(255,255,255,.05)',
    color: '#fff',
    fontWeight: 700,
    cursor: 'pointer',
});

function chipGroup(options, onSelect) {
    const chips = options.map(({ id, label }) => button({
        text: label,
        attrs: { type: 'button', 'aria-pressed': 'false', 'data-value': String(id) },
        styles: chipStyles(false),
        events: { click: () => select(id) },
    }));
    function select(id) {
        chips.forEach((chip) => {
            const selected = chip.dataset.value === String(id);
            chip.setAttribute('aria-pressed', String(selected));
            Object.assign(chip.style, chipStyles(selected));
        });
        onSelect(id);
    }
    return div({ styles: { display: 'flex', flexWrap: 'wrap', gap: '6px' }, children: chips });
}

export function createSessionFeedbackPanel(session) {
    const answer = { rpe: null, limiter: null };
    const status = createElement('p', { styles: { margin: '8px 0 0', fontSize: '12px', color: colors.textMuted } });
    const note = createElement('input', {
        attrs: { type: 'text', maxlength: '280', placeholder: 'Nota opcional (cómo iba el cuerpo, dolor, calor…)', 'aria-label': 'Nota de la sesión' },
        styles: {
            width: '100%', boxSizing: 'border-box', minHeight: '40px', padding: '0 12px', borderRadius: '10px',
            border: '1px solid rgba(255,255,255,.14)', background: 'rgba(255,255,255,.05)', color: '#fff',
        },
    });
    const save = button({
        text: 'Guardar cómo me sentí',
        attrs: { type: 'button' },
        styles: { ...chipStyles(false), width: '100%', color: colors.success },
        events: {
            click: async () => {
                save.disabled = true;
                try {
                    await saveSessionFeedback(session, { ...answer, note: note.value });
                    const sent = await pushSession(session);
                    status.textContent = sent ? 'Guardado y enviado a training-app ✓' : 'Guardado ✓';
                } catch (error) {
                    status.textContent = error.message;
                    save.disabled = false;
                }
            },
        },
    });

    const label = (text) => createElement('div', {
        text,
        styles: { margin: `${spacing.sm} 0 6px`, color: 'rgba(255,255,255,.55)', fontSize: '11px', fontWeight: 800, letterSpacing: '1px' },
    });

    return div({
        attrs: { 'data-feedback-panel': 'true' },
        styles: { width: '100%', padding: '14px', marginBottom: spacing.lg, borderRadius: '14px', background: 'rgba(255,255,255,.05)', textAlign: 'left' },
        children: [
            createElement('div', { text: '¿CÓMO TE HAS SENTIDO?', styles: { color: '#75ebc1', fontSize: '11px', fontWeight: 800, letterSpacing: '1.4px' } }),
            label('ESFUERZO PERCIBIDO (1 = paseo · 10 = máximo)'),
            chipGroup(Array.from({ length: 10 }, (_, index) => ({ id: index + 1, label: String(index + 1) })), (id) => { answer.rpe = id; }),
            label('¿QUÉ TE LIMITÓ?'),
            chipGroup(LIMITERS, (id) => { answer.limiter = id; }),
            div({ styles: { marginTop: spacing.sm }, children: [note] }),
            div({ styles: { marginTop: spacing.sm }, children: [save] }),
            status,
        ],
    });
}
