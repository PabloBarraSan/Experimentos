/**
 * MetricCard - Tarjeta de métrica individual
 * Smart Trainer Controller
 */

import { colors, spacing, typography, baseStyles, borderRadius, shadows, transitions } from '../utils/theme.js';
import { createElement, div, icon as createIcon } from '../utils/dom.js';

/**
 * Tarjeta para mostrar una métrica
 * @param {Object} props
 * @param {string} props.label - Etiqueta de la métrica
 * @param {string|number} props.value - Valor a mostrar
 * @param {string} props.unit - Unidad (opcional)
 * @param {string} props.icon - Nombre del icono (opcional)
 * @param {string} props.color - Color de acento
 * @param {string} props.size - 'small', 'medium', 'large'
 * @param {string} props.zoneColor - Color de zona de potencia (borde izquierdo)
 * @param {boolean} props.isStale - Si el dato está congelado (efecto scale sutil)
 * @param {boolean} props.dimmed - Estado atenuado (ej. FC sin sensor)
 */
export function MetricCard({ label, value, unit = '', icon, color = colors.primary, size = 'medium', zoneColor, isStale = false, dimmed = false }) {
    const sizes = {
        small: {
            padding: spacing.md,
            valueFontSize: typography.sizes.xl,
            labelFontSize: typography.sizes.xs,
            unitFontSize: typography.sizes.sm,
            iconSize: 16,
        },
        medium: {
            padding: spacing.lg,
            valueFontSize: typography.sizes.xxl,
            labelFontSize: typography.sizes.sm,
            unitFontSize: typography.sizes.md,
            iconSize: 20,
        },
        large: {
            padding: spacing.xl,
            valueFontSize: typography.sizes.metric,
            labelFontSize: typography.sizes.md,
            unitFontSize: typography.sizes.lg,
            iconSize: 24,
        },
    };
    
    const sizeConfig = sizes[size] || sizes.medium;
    
    const zoneGradient = zoneColor && !dimmed
        ? `linear-gradient(135deg, ${zoneColor}12 0%, transparent 60%)`
        : 'linear-gradient(180deg, #1a1a1a 0%, #111 100%)';

    const cardStyles = {
        ...baseStyles.card,
        padding: sizeConfig.padding,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
        minWidth: size === 'large' ? '200px' : '120px',
        position: 'relative',
        overflow: 'hidden',
        transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
        transform: isStale ? 'scale(0.97)' : 'scale(1)',
        background: zoneGradient,
        ...(zoneColor && !dimmed ? {
            boxShadow: `inset 0 0 30px ${zoneColor}08, 0 4px 20px rgba(0,0,0,0.4)`,
            border: `1px solid ${zoneColor}25`,
        } : {}),
        ...(dimmed ? { opacity: 0.45, filter: 'brightness(0.8)' } : {}),
    };
    
    const glowStyles = {
        position: 'absolute',
        top: '0',
        left: '0',
        right: '0',
        height: '2px',
        background: `linear-gradient(90deg, transparent 0%, ${color} 50%, transparent 100%)`,
        boxShadow: `0 0 15px ${color}60, 0 0 30px ${color}30`,
    };
    
    const labelStyles = {
        display: 'flex',
        alignItems: 'center',
        gap: spacing.xs,
        fontSize: sizeConfig.labelFontSize,
        color: colors.textMuted,
        textTransform: 'uppercase',
        letterSpacing: '0.5px',
        marginBottom: spacing.sm,
    };
    
    const valueContainerStyles = {
        display: 'flex',
        alignItems: 'baseline',
        gap: spacing.xs,
    };
    
    const valueStyles = {
        fontSize: sizeConfig.valueFontSize,
        fontWeight: typography.weights.bold,
        color: colors.text,
        fontFamily: typography.fontMono,
        lineHeight: '1',
        letterSpacing: '-0.5px',
    };
    
    const unitStyles = {
        fontSize: sizeConfig.unitFontSize,
        color: colors.textMuted,
        fontWeight: typography.weights.normal,
    };
    
    // Construir tarjeta
    const card = div({ styles: cardStyles });
    
    // Glow superior
    card.appendChild(div({ styles: glowStyles }));
    
    // Label con icono
    const labelElement = div({
        styles: labelStyles,
        children: [
            icon ? createIcon(icon, sizeConfig.iconSize, color) : null,
            createElement('span', { text: label }),
        ].filter(Boolean)
    });
    card.appendChild(labelElement);
    
    // Valor y unidad
    const valueContainer = div({
        styles: valueContainerStyles,
        children: [
            createElement('span', { text: String(value), styles: valueStyles }),
            unit ? createElement('span', { text: unit, styles: unitStyles }) : null,
        ].filter(Boolean)
    });
    card.appendChild(valueContainer);
    
    return card;
}
