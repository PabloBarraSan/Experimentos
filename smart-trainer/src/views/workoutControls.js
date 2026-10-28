import { colors, typography } from '../utils/theme.js';
import { createElement } from '../utils/dom.js';

const INTENSITY_STEP = 5;
const INTENSITY_MIN = 50;
const INTENSITY_MAX = 150;

// Botón compacto con el estilo del HUD de la expedición.
function hudButton({ text, label, onClick, minWidth = '34px' }) {
    return createElement('button', {
        text,
        attrs: { type: 'button', 'aria-label': label || text },
        styles: {
            minWidth,
            height: '34px',
            padding: '0 10px',
            border: '1px solid rgba(255,255,255,.14)',
            borderRadius: '10px',
            background: 'rgba(255,255,255,.07)',
            color: '#fff',
            fontFamily: typography.fontFamily,
            fontSize: '13px',
            fontWeight: 700,
            cursor: 'pointer',
            whiteSpace: 'nowrap',
        },
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

    const intensityLabel = createElement('div', {
        styles: {
            flex: '1 1 auto',
            textAlign: 'center',
            fontFamily: typography.fontMono,
            fontSize: '13px',
            fontWeight: 800,
            color: '#fff',
            whiteSpace: 'nowrap',
        },
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
        styles: {
            display: 'none',
            fontSize: '11px',
            fontWeight: 700,
            color: colors.warning,
            textAlign: 'center',
        },
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
        styles: {
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
            padding: '10px 12px',
            background: 'rgba(5,12,16,.8)',
            border: '1px solid rgba(255,255,255,.1)',
            borderRadius: '14px',
            color: '#fff',
            fontFamily: typography.fontFamily,
            pointerEvents: 'auto',
            boxSizing: 'border-box',
        },
        children: [intensityRow, actionsRow, spiralNotice],
    });

    function render() {
        intensityLabel.textContent = `Intensidad ${intensity} %`;
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
