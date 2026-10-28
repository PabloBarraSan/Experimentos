import { colors } from '../utils/theme.js';
import { createElement } from '../utils/dom.js';

const INTENSITY_STEP = 5;
const INTENSITY_MIN = 50;
const INTENSITY_MAX = 150;

// Botón compacto con el estilo del HUD de la expedición (clase hud-btn de expedition-hud.css).
function hudButton({ text, label, onClick, minWidth = '34px' }) {
    return createElement('button', {
        text,
        className: 'hud-btn',
        attrs: { type: 'button', 'aria-label': label || text },
        styles: { minWidth, background: 'rgba(255,255,255,.06)', whiteSpace: 'nowrap' },
        events: { click: onClick },
    });
}

/**
 * Panel de controles de entrenamiento ERG (intensidad, saltar, alargar, ERG on/off).
 * Sin posición propia: el llamador lo coloca.
 */
export function createWorkoutControls({ onIntensityChange = () => {}, onSkip = () => {}, onExtend = () => {}, onErgToggle = () => {} } = {}) {
    let intensity = 100;
    let ergEnabled = true;
    let disabled = false;

    // Intensidad como una cifra más del HUD: etiqueta pequeña y porcentaje en grande.
    const intensityValue = createElement('strong', { className: 'hud-num hud-num--md' });
    const intensityLabel = createElement('div', {
        styles: { flex: '1 1 auto', display: 'grid', justifyItems: 'center', gap: '3px' },
        children: [
            createElement('span', { text: 'Intensidad', className: 'hud-label' }),
            createElement('div', {
                styles: { display: 'flex', alignItems: 'baseline' },
                children: [intensityValue, createElement('span', { text: '%', className: 'hud-unit' })],
            }),
        ],
    });

    const changeIntensity = (delta) => {
        const next = Math.max(INTENSITY_MIN, Math.min(INTENSITY_MAX, intensity + delta));
        if (next === intensity) return;
        intensity = next;
        render();
        onIntensityChange(next);
    };

    const minus = hudButton({ text: '−', label: 'Bajar intensidad', onClick: () => changeIntensity(-INTENSITY_STEP) });
    const plus = hudButton({ text: '+', label: 'Subir intensidad', onClick: () => changeIntensity(INTENSITY_STEP) });
    const skip = hudButton({ text: 'Saltar bloque', onClick: () => onSkip() });
    const extend = hudButton({ text: '+1 min', label: 'Alargar el bloque 1 minuto', onClick: () => onExtend(60) });
    const erg = hudButton({ text: '', onClick: () => onErgToggle(!ergEnabled) });

    const spiralNotice = createElement('div', {
        text: 'Cadencia baja · resistencia reducida',
        className: 'hud-label',
        styles: { display: 'none', color: colors.warning, textAlign: 'center' },
    });

    const intensityRow = createElement('div', {
        styles: { display: 'flex', alignItems: 'center', gap: '8px' },
        children: [minus, intensityLabel, plus],
    });
    const actionsRow = createElement('div', {
        styles: { display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' },
        children: [skip, extend, erg],
    });

    const element = createElement('div', {
        className: 'hud-panel',
        styles: {
            display: 'flex',
            flexDirection: 'column',
            gap: '9px',
            padding: '11px 12px',
            pointerEvents: 'auto',
            '--hud-accent': colors.warning,
        },
        children: [intensityRow, actionsRow, spiralNotice],
    });

    function render() {
        intensityValue.textContent = String(intensity);
        intensityValue.style.color = intensity === 100 ? '' : intensity > 100 ? '#ff9a3c' : '#5cc8ff';
        erg.textContent = `ERG: ${ergEnabled ? 'sí' : 'no'}`;
        erg.style.color = ergEnabled ? colors.success : 'rgba(255,255,255,.6)';
        for (const control of [minus, plus, skip, extend, erg]) {
            control.disabled = disabled;
            control.style.opacity = disabled ? '.45' : '1';
            control.style.cursor = disabled ? 'default' : 'pointer';
        }
        minus.disabled = disabled || intensity <= INTENSITY_MIN;
        plus.disabled = disabled || intensity >= INTENSITY_MAX;
    }

    render();

    return {
        element,
        setIntensity(percent) {
            const value = Math.round(Number(percent));
            if (!Number.isFinite(value)) return;
            intensity = Math.max(INTENSITY_MIN, Math.min(INTENSITY_MAX, value));
            render();
        },
        setErgEnabled(value) {
            ergEnabled = Boolean(value);
            render();
        },
        setSpiral(value) {
            spiralNotice.style.display = value ? 'block' : 'none';
        },
        setDisabled(value) {
            disabled = Boolean(value);
            render();
        },
    };
}
