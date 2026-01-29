/**
 * ResistanceSlider - Control de resistencia
 * Smart Trainer Controller
 */

import { colors, spacing, typography, borderRadius, transitions, shadows } from '../utils/theme.js';
import { createElement, div, debounce } from '../utils/dom.js';

/**
 * Slider para controlar la resistencia del rodillo
 * Incluye botones +/- para uso táctil mientras se pedalea.
 * @param {Object} props
 * @param {number} props.value - Valor actual (0-100)
 * @param {Function} props.onChange - Callback al cambiar valor
 * @param {number} props.min - Valor mínimo
 * @param {number} props.max - Valor máximo
 * @param {number} props.step - Incremento
 * @param {boolean} props.minimal - Sin labels (Fácil/Medio/Difícil) ni quick buttons (25/50/75/100)
 */
export function ResistanceSlider({ value = 50, onChange, min = 0, max = 100, step = 1, minimal = false }) {
    const containerStyles = {
        width: '100%',
        padding: `${spacing.md} 0`,
    };
    
    const sliderRowStyles = {
        display: 'flex',
        alignItems: 'center',
        gap: spacing.md,
        width: '100%',
    };
    
    const sliderContainerStyles = {
        position: 'relative',
        flex: '1',
        height: '40px',
        display: 'flex',
        alignItems: 'center',
    };
    
    const trackStyles = {
        position: 'absolute',
        width: '100%',
        height: '8px',
        backgroundColor: colors.surfaceLight,
        borderRadius: borderRadius.full,
        overflow: 'hidden',
    };
    
    const fillStyles = {
        height: '100%',
        backgroundColor: colors.primary,
        borderRadius: borderRadius.full,
        width: `${value}%`,
        transition: 'width 0.1s ease',
    };
    
    const inputStyles = {
        position: 'absolute',
        width: '100%',
        height: '100%',
        opacity: '0',
        cursor: 'pointer',
        margin: '0',
        zIndex: '10',
    };
    
    const thumbStyles = {
        position: 'absolute',
        left: `calc(${value}% - 16px)`,
        width: '32px',
        height: '32px',
        backgroundColor: colors.primary,
        borderRadius: borderRadius.full,
        boxShadow: `0 2px 8px rgba(0, 212, 170, 0.4)`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        transition: 'left 0.1s ease, transform 0.15s ease',
        pointerEvents: 'none',
    };
    
    const thumbValueStyles = {
        fontSize: typography.sizes.sm,
        fontWeight: typography.weights.bold,
        color: colors.background,
        transition: 'transform 0.2s ease',
    };
    
    // Botones +/- grandes para uso táctil (redondos en minimal)
    const stepButtonStyles = {
        width: '56px',
        height: '56px',
        minWidth: '56px',
        minHeight: '56px',
        borderRadius: minimal ? '50%' : '16px',
        border: minimal ? `1px solid ${colors.border}` : 'none',
        background: minimal ? 'linear-gradient(145deg, #2a2a2a, #1a1a1a)' : colors.surfaceLight,
        color: colors.text,
        fontSize: '24px',
        fontWeight: typography.weights.bold,
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        transition: transitions.normal,
        boxShadow: shadows.md,
    };
    
    const labelsStyles = {
        display: 'flex',
        justifyContent: 'space-between',
        marginTop: spacing.sm,
    };
    
    const labelStyles = {
        fontSize: typography.sizes.xs,
        color: colors.textDark,
    };
    
    // Crear elementos
    const container = div({ styles: containerStyles });
    
    const sliderRow = div({ styles: sliderRowStyles });
    const sliderContainer = div({ styles: sliderContainerStyles });
    
    // Track
    const track = div({ styles: trackStyles });
    const fill = div({ styles: fillStyles });
    fill.id = 'resistance-fill';
    track.appendChild(fill);
    sliderContainer.appendChild(track);
    
    // Thumb visual
    const thumb = div({ styles: thumbStyles });
    thumb.id = 'resistance-thumb';
    const thumbValue = createElement('span', { 
        text: String(value), 
        styles: thumbValueStyles 
    });
    thumbValue.id = 'resistance-thumb-value';
    thumb.appendChild(thumbValue);
    sliderContainer.appendChild(thumb);
    // Referencias para setValue (actualización programática)
    const fillEl = fill;
    const thumbEl = thumb;
    const thumbValueEl = thumbValue;
    
    // Input range real
    const input = createElement('input', {
        attrs: {
            type: 'range',
            min: String(min),
            max: String(max),
            step: String(step),
            value: String(value),
        },
        styles: inputStyles,
    });
    
    // Debounce el onChange para no enviar demasiados comandos
    const debouncedOnChange = debounce((val) => {
        if (onChange) {
            onChange(val);
        }
    }, 200);
    
    // Actualizar solo la UI (sin enviar comando al rodillo). Para sincronización programática.
    function updateUIOnly(newValue) {
        const v = Math.max(min, Math.min(max, Number(newValue)));
        if (fillEl) fillEl.style.width = `${v}%`;
        if (thumbEl) thumbEl.style.left = `calc(${v}% - 16px)`;
        if (thumbValueEl) thumbValueEl.textContent = String(Math.round(v));
        input.value = String(v);
    }

    // Actualizar UI y feedback visual (brillo/pulse en thumb) y enviar comando
    function updateUIAndPulse(newValue) {
        if (fillEl) fillEl.style.width = `${newValue}%`;
        if (thumbEl) {
            thumbEl.style.left = `calc(${newValue}% - 16px)`;
            thumbEl.style.transform = 'scale(1.25)';
            thumbEl.style.boxShadow = `0 0 20px ${colors.primary}80`;
            setTimeout(() => {
                thumbEl.style.transform = 'scale(1)';
                thumbEl.style.boxShadow = '0 2px 8px rgba(0, 212, 170, 0.4)';
            }, 200);
        }
        if (thumbValueEl) {
            thumbValueEl.textContent = String(newValue);
            thumbValueEl.style.transform = 'scale(1.2)';
            setTimeout(() => { thumbValueEl.style.transform = 'scale(1)'; }, 200);
        }
        debouncedOnChange(newValue);
    }
    
    input.addEventListener('input', (e) => {
        const newValue = parseInt(e.target.value, 10);
        updateUIAndPulse(newValue);
    });
    
    input.addEventListener('mousedown', () => { thumb.style.transform = 'scale(1.1)'; });
    input.addEventListener('mouseup', () => { thumb.style.transform = 'scale(1)'; });
    input.addEventListener('mouseleave', () => { thumb.style.transform = 'scale(1)'; });
    
    // Botón menos
    const minusBtn = createElement('button', {
        text: '−',
        styles: stepButtonStyles,
        attrs: { type: 'button', title: 'Bajar resistencia 1%' },
        events: {
            click: () => {
                const newValue = Math.max(min, parseInt(input.value, 10) - step);
                input.value = newValue;
                updateUIAndPulse(newValue);
            },
        },
    });
    minusBtn.addEventListener('mouseenter', () => { minusBtn.style.backgroundColor = colors.surfaceHover; minusBtn.style.transform = 'scale(1.05)'; });
    minusBtn.addEventListener('mouseleave', () => { minusBtn.style.backgroundColor = colors.surfaceLight; minusBtn.style.transform = 'scale(1)'; });
    
    // Botón más
    const plusBtn = createElement('button', {
        text: '+',
        styles: stepButtonStyles,
        attrs: { type: 'button', title: 'Subir resistencia 1%' },
        events: {
            click: () => {
                const newValue = Math.min(max, parseInt(input.value, 10) + step);
                input.value = newValue;
                updateUIAndPulse(newValue);
            },
        },
    });
    plusBtn.addEventListener('mouseenter', () => { plusBtn.style.backgroundColor = colors.surfaceHover; plusBtn.style.transform = 'scale(1.05)'; });
    plusBtn.addEventListener('mouseleave', () => { plusBtn.style.backgroundColor = colors.surfaceLight; plusBtn.style.transform = 'scale(1)'; });
    
    sliderRow.appendChild(minusBtn);
    sliderContainer.appendChild(input);
    sliderRow.appendChild(sliderContainer);
    sliderRow.appendChild(plusBtn);
    container.appendChild(sliderRow);
    
    // Labels (ocultos en minimal)
    if (!minimal) {
        const labels = div({
            styles: labelsStyles,
            children: [
                createElement('span', { text: 'Fácil', styles: labelStyles }),
                createElement('span', { text: 'Medio', styles: { ...labelStyles, color: colors.textMuted } }),
                createElement('span', { text: 'Difícil', styles: labelStyles }),
            ]
        });
        container.appendChild(labels);
    }

    // API para actualización programática (sin disparar onChange). Evita feedback loop del servo.
    container.setValue = (newValue) => {
        updateUIOnly(newValue);
    };

    // Botones de ajuste rápido (ocultos en minimal)
    if (!minimal) {
        const quickButtonsStyles = {
            display: 'flex',
            gap: spacing.sm,
            marginTop: spacing.md,
            justifyContent: 'center',
            flexWrap: 'wrap',
        };
        const quickButtonStyle = {
            padding: `${spacing.xs} ${spacing.md}`,
            backgroundColor: colors.surfaceLight,
            border: `1px solid ${colors.border}`,
            borderRadius: borderRadius.md,
            color: colors.text,
            fontSize: typography.sizes.sm,
            cursor: 'pointer',
            transition: transitions.fast,
        };
        const quickButtons = div({
            styles: quickButtonsStyles,
            children: [25, 50, 75, 100].map(val => {
                const btn = createElement('button', {
                    text: `${val}%`,
                    styles: quickButtonStyle,
                    events: {
                        click: () => {
                            input.value = val;
                            input.dispatchEvent(new Event('input'));
                        },
                        mouseenter: (e) => {
                            e.target.style.backgroundColor = colors.primary;
                            e.target.style.color = colors.background;
                        },
                        mouseleave: (e) => {
                            e.target.style.backgroundColor = colors.surfaceLight;
                            e.target.style.color = colors.text;
                        },
                    }
                });
                return btn;
            })
        });
        container.appendChild(quickButtons);
    }
    
    return container;
}
