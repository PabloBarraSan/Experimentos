/**
 * SaveSessionDialog - Diálogo modal para guardar/descartar sesión
 * Smart Trainer Controller
 * 
 * Estilo Wahoo: resumen del entrenamiento + opciones Guardar/Descartar
 */

import { colors, spacing, typography, baseStyles, borderRadius, shadows, transitions } from '../utils/theme.js';
import { createElement, div, button, icon, formatTime } from '../utils/dom.js';

/**
 * Formatear duración en formato legible
 */
function formatDuration(seconds) {
    if (!seconds || seconds < 0) return '0:00';
    
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    
    if (hours > 0) {
        return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Diálogo modal para guardar o descartar sesión de entrenamiento
 * @param {Object} props
 * @param {Object} props.session - Datos de la sesión (dataPoints, startTime, elapsedTime)
 * @param {Object} props.metrics - Métricas calculadas (power, intensity, energy, etc.)
 * @param {number} props.ftp - FTP del usuario
 * @param {function} props.onSave - Callback al guardar: onSave(workoutName)
 * @param {function} props.onDiscard - Callback al descartar: onDiscard()
 * @param {function} props.onCancel - Callback al cancelar (volver al entreno): onCancel()
 */
export function SaveSessionDialog({ session, metrics, ftp, onSave, onDiscard, onCancel }) {
    const duration = session.elapsedTime || 0;
    const isLongSession = duration > 300; // > 5 minutos
    
    // === Estilos ===
    const overlayStyles = {
        position: 'fixed',
        top: '0',
        left: '0',
        right: '0',
        bottom: '0',
        backgroundColor: 'rgba(0, 0, 0, 0.85)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: '1000',
        padding: spacing.lg,
    };
    
    const dialogStyles = {
        backgroundColor: colors.surface,
        borderRadius: borderRadius.xl,
        padding: spacing.xl,
        maxWidth: '420px',
        width: '100%',
        boxShadow: shadows.lg,
        animation: 'slideUp 0.3s ease-out',
    };
    
    const headerStyles = {
        textAlign: 'center',
        marginBottom: spacing.xl,
    };
    
    const titleStyles = {
        fontSize: typography.sizes.xl,
        fontWeight: typography.weights.bold,
        color: colors.text,
        marginBottom: spacing.xs,
    };
    
    const subtitleStyles = {
        fontSize: typography.sizes.sm,
        color: colors.textMuted,
    };
    
    const metricsGridStyles = {
        display: 'grid',
        gridTemplateColumns: 'repeat(2, 1fr)',
        gap: spacing.md,
        marginBottom: spacing.xl,
    };
    
    const metricBoxStyles = {
        backgroundColor: colors.surfaceLight,
        borderRadius: borderRadius.md,
        padding: spacing.md,
        textAlign: 'center',
    };
    
    const metricValueStyles = {
        fontSize: typography.sizes.xl,
        fontWeight: typography.weights.bold,
        color: colors.text,
        fontFamily: typography.fontMono,
    };
    
    const metricLabelStyles = {
        fontSize: typography.sizes.xs,
        color: colors.textMuted,
        textTransform: 'uppercase',
        marginTop: spacing.xs,
    };
    
    const inputContainerStyles = {
        marginBottom: spacing.xl,
    };
    
    const labelStyles = {
        display: 'block',
        fontSize: typography.sizes.sm,
        color: colors.textMuted,
        marginBottom: spacing.sm,
    };
    
    const inputStyles = {
        width: '100%',
        padding: spacing.md,
        backgroundColor: colors.background,
        border: `1px solid ${colors.border}`,
        borderRadius: borderRadius.md,
        color: colors.text,
        fontSize: typography.sizes.md,
        outline: 'none',
        transition: transitions.fast,
        boxSizing: 'border-box',
    };
    
    const buttonsContainerStyles = {
        display: 'flex',
        gap: spacing.md,
    };
    
    const buttonBaseStyles = {
        flex: '1',
        padding: `${spacing.md} ${spacing.lg}`,
        borderRadius: borderRadius.lg,
        fontSize: typography.sizes.md,
        fontWeight: typography.weights.semibold,
        cursor: 'pointer',
        transition: transitions.normal,
        border: 'none',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: spacing.sm,
    };
    
    const discardButtonStyles = {
        ...buttonBaseStyles,
        backgroundColor: colors.surfaceLight,
        color: colors.textMuted,
    };
    
    const saveButtonStyles = {
        ...buttonBaseStyles,
        backgroundColor: colors.success,
        color: colors.background,
    };
    
    // === Construir diálogo ===
    const overlay = div({ styles: overlayStyles });
    const dialog = div({ styles: dialogStyles });
    
    // Añadir animación CSS
    const styleSheet = createElement('style', {
        text: `
            @keyframes slideUp {
                from {
                    opacity: 0;
                    transform: translateY(20px);
                }
                to {
                    opacity: 1;
                    transform: translateY(0);
                }
            }
        `
    });
    document.head.appendChild(styleSheet);
    
    // Header
    const header = div({
        styles: headerStyles,
        children: [
            createElement('h2', { text: '¡Entrenamiento completado!', styles: titleStyles }),
            createElement('p', { text: 'Revisa tu resumen y guarda la sesión', styles: subtitleStyles }),
        ]
    });
    dialog.appendChild(header);
    
    // Métricas resumen
    const metricsData = [
        { 
            value: formatDuration(duration), 
            label: 'Duración',
            icon: 'clock'
        },
        { 
            value: `${metrics?.power?.avg || 0}W`, 
            label: 'Potencia Media',
            icon: 'zap'
        },
        { 
            value: metrics?.intensity?.tss || 0, 
            label: 'TSS',
            icon: 'activity'
        },
        { 
            value: `${metrics?.energy?.calories || 0}`, 
            label: 'Calorías',
            icon: 'flame'
        },
    ];
    
    const metricsGrid = div({
        styles: metricsGridStyles,
        children: metricsData.map(metric => 
            div({
                styles: metricBoxStyles,
                children: [
                    div({
                        styles: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: spacing.xs, marginBottom: spacing.xs },
                        children: [
                            icon(metric.icon, 16, colors.primary),
                        ]
                    }),
                    createElement('div', { text: String(metric.value), styles: metricValueStyles }),
                    createElement('div', { text: metric.label, styles: metricLabelStyles }),
                ]
            })
        )
    });
    dialog.appendChild(metricsGrid);
    
    // Input para nombre
    const inputContainer = div({ styles: inputContainerStyles });
    const inputLabel = createElement('label', { text: 'Nombre del entrenamiento', styles: labelStyles });
    inputLabel.setAttribute('for', 'workout-name-input');
    
    const nameInput = createElement('input', {
        attrs: {
            type: 'text',
            id: 'workout-name-input',
            placeholder: 'Entrenamiento Libre',
            value: 'Entrenamiento Libre',
        },
        styles: inputStyles,
    });
    
    // Focus styles
    nameInput.addEventListener('focus', () => {
        nameInput.style.borderColor = colors.primary;
        nameInput.style.boxShadow = `0 0 0 2px ${colors.primary}33`;
    });
    nameInput.addEventListener('blur', () => {
        nameInput.style.borderColor = colors.border;
        nameInput.style.boxShadow = 'none';
    });
    
    inputContainer.appendChild(inputLabel);
    inputContainer.appendChild(nameInput);
    dialog.appendChild(inputContainer);
    
    // Botones
    const buttonsContainer = div({ styles: buttonsContainerStyles });
    
    const discardBtn = button({
        styles: discardButtonStyles,
        children: [
            icon('x', 18, colors.textMuted),
            createElement('span', { text: 'Descartar' }),
        ],
        events: {
            click: () => {
                if (isLongSession) {
                    // Confirmar antes de descartar sesiones largas
                    if (confirm(`¿Seguro que quieres descartar ${formatDuration(duration)} de entrenamiento?`)) {
                        cleanup();
                        onDiscard();
                    }
                } else {
                    cleanup();
                    onDiscard();
                }
            },
            mouseenter: (e) => {
                e.target.closest('button').style.backgroundColor = colors.surfaceHover;
            },
            mouseleave: (e) => {
                e.target.closest('button').style.backgroundColor = colors.surfaceLight;
            },
        }
    });
    
    const saveBtn = button({
        styles: saveButtonStyles,
        children: [
            icon('check', 18, colors.background),
            createElement('span', { text: 'Guardar' }),
        ],
        events: {
            click: () => {
                const workoutName = nameInput.value.trim() || 'Entrenamiento Libre';
                cleanup();
                onSave(workoutName);
            },
            mouseenter: (e) => {
                e.target.closest('button').style.opacity = '0.9';
                e.target.closest('button').style.transform = 'scale(1.02)';
            },
            mouseleave: (e) => {
                e.target.closest('button').style.opacity = '1';
                e.target.closest('button').style.transform = 'scale(1)';
            },
        }
    });
    
    buttonsContainer.appendChild(discardBtn);
    buttonsContainer.appendChild(saveBtn);
    dialog.appendChild(buttonsContainer);
    
    // Botón de cancelar (volver al entreno) - opcional, pequeño en la esquina
    if (onCancel) {
        const cancelLinkStyles = {
            display: 'block',
            textAlign: 'center',
            marginTop: spacing.lg,
            color: colors.textMuted,
            fontSize: typography.sizes.sm,
            cursor: 'pointer',
            textDecoration: 'underline',
        };
        
        const cancelLink = createElement('span', {
            text: 'Volver al entrenamiento',
            styles: cancelLinkStyles,
        });
        cancelLink.addEventListener('click', () => {
            cleanup();
            onCancel();
        });
        cancelLink.addEventListener('mouseenter', () => {
            cancelLink.style.color = colors.text;
        });
        cancelLink.addEventListener('mouseleave', () => {
            cancelLink.style.color = colors.textMuted;
        });
        dialog.appendChild(cancelLink);
    }
    
    overlay.appendChild(dialog);
    
    // Cerrar con Escape
    const handleEscape = (e) => {
        if (e.key === 'Escape' && onCancel) {
            cleanup();
            onCancel();
        }
    };
    document.addEventListener('keydown', handleEscape);
    
    // Cleanup function
    function cleanup() {
        document.removeEventListener('keydown', handleEscape);
        if (styleSheet.parentNode) {
            styleSheet.remove();
        }
        if (overlay.parentNode) {
            overlay.remove();
        }
    }
    
    // Exponer cleanup
    overlay.cleanup = cleanup;
    
    // Focus en el input al abrir
    setTimeout(() => {
        nameInput.focus();
        nameInput.select();
    }, 100);
    
    return overlay;
}

/**
 * Mostrar el diálogo de guardado
 * @param {Object} options - Mismas opciones que SaveSessionDialog
 * @returns {Promise<{saved: boolean, workoutName?: string}>}
 */
export function showSaveSessionDialog(options) {
    return new Promise((resolve) => {
        const dialog = SaveSessionDialog({
            ...options,
            onSave: (workoutName) => {
                resolve({ saved: true, workoutName });
            },
            onDiscard: () => {
                resolve({ saved: false });
            },
            onCancel: options.onCancel ? () => {
                resolve({ cancelled: true });
            } : null,
        });
        
        document.body.appendChild(dialog);
    });
}
