/**
 * ResistanceSlider - Control de resistencia
 * Smart Trainer Controller
 */

import { colors, spacing, typography, borderRadius, transitions } from '../utils/theme.js';
import { createElement, div, debounce } from '../utils/dom.js';

/**
 * Slider para controlar la resistencia del rodillo
 * @param {Object} props
 * @param {number} props.value - Valor actual (0-100)
 * @param {Function} props.onChange - Callback al cambiar valor
 * @param {number} props.min - Valor mínimo
 * @param {number} props.max - Valor máximo
 * @param {number} props.step - Incremento
 */
export function ResistanceSlider({ value = 50, onChange, min = 0, max = 100, step = 1 }) {
    const containerStyles = {
        width: '100%',
        padding: `${spacing.md} 0`,
    };
    
    const sliderContainerStyles = {
        position: 'relative',
        width: '100%',
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
        fontSize: typography.sizes.xs,
        fontWeight: typography.weights.bold,
        color: colors.background,
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
    
    // Actualizar UI inmediatamente, pero debounce el comando
    input.addEventListener('input', (e) => {
        const newValue = parseInt(e.target.value, 10);
        
        // Actualizar UI inmediatamente
        const fillEl = document.getElementById('resistance-fill');
        const thumbEl = document.getElementById('resistance-thumb');
        const thumbValueEl = document.getElementById('resistance-thumb-value');
        
        if (fillEl) fillEl.style.width = `${newValue}%`;
        if (thumbEl) thumbEl.style.left = `calc(${newValue}% - 16px)`;
        if (thumbValueEl) thumbValueEl.textContent = String(newValue);
        
        // Enviar comando con debounce
        debouncedOnChange(newValue);
    });
    
    // Efecto hover/active en thumb
    input.addEventListener('mousedown', () => {
        thumb.style.transform = 'scale(1.1)';
    });
    input.addEventListener('mouseup', () => {
        thumb.style.transform = 'scale(1)';
    });
    input.addEventListener('mouseleave', () => {
        thumb.style.transform = 'scale(1)';
    });
    
    sliderContainer.appendChild(input);
    container.appendChild(sliderContainer);
    
    // Labels
    const labels = div({
        styles: labelsStyles,
        children: [
            createElement('span', { text: 'Fácil', styles: labelStyles }),
            createElement('span', { text: 'Medio', styles: { ...labelStyles, color: colors.textMuted } }),
            createElement('span', { text: 'Difícil', styles: labelStyles }),
        ]
    });
    container.appendChild(labels);
    
    // Botones de ajuste rápido
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
    
    return container;
}
