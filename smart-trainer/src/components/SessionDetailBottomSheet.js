/**
 * SessionDetailBottomSheet - Modal bottom sheet para detalle de sesión
 * Smart Trainer Controller
 *
 * Estilo app top: panel que entra desde abajo, overlay, handle.
 */

import { colors, spacing, typography, baseStyles, borderRadius, transitions, shadows } from '../utils/theme.js';
import { createElement, div, button, icon } from '../utils/dom.js';
import { deleteSession, exportToTCX, exportToCSV } from '../storage/sessions.js';

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

function doExport(session, format) {
    let content, filename, mimeType;
    switch (format) {
        case 'tcx':
            content = exportToTCX(session);
            filename = `session_${new Date(session.date).toISOString().split('T')[0]}.tcx`;
            mimeType = 'application/vnd.garmin.tcx+xml';
            break;
        case 'csv':
            content = exportToCSV(session);
            filename = `session_${new Date(session.date).toISOString().split('T')[0]}.csv`;
            mimeType = 'text/csv';
            break;
        default:
            return;
    }
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

/**
 * @param {Object} props
 * @param {Object} props.session - Sesión (workoutName, date, duration, metrics, ftp)
 * @param {function} props.onClose - Al cerrar sin eliminar
 * @param {function} props.onDeleted - Tras eliminar (refrescar lista)
 */
export function SessionDetailBottomSheet({ session, onClose, onDeleted }) {
    const date = new Date(session.date);
    const dateStr = date.toLocaleDateString('es', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
    const timeStr = date.toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' });
    const duration = session.duration || 0;
    const m = session.metrics || {};
    const lastDp = session.dataPoints?.length ? session.dataPoints[session.dataPoints.length - 1] : null;
    const distanceM = m.distance ?? lastDp?.distance ?? null;

    const overlayStyles = {
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        zIndex: 1000,
        animation: 'bottomSheetOverlayIn 0.3s ease forwards',
    };

    const panelStyles = {
        position: 'fixed',
        left: 0,
        right: 0,
        bottom: 0,
        maxHeight: '85vh',
        backgroundColor: colors.surface,
        borderTopLeftRadius: borderRadius.xl,
        borderTopRightRadius: borderRadius.xl,
        boxShadow: shadows.lg,
        zIndex: 1001,
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        animation: 'bottomSheetPanelIn 0.35s cubic-bezier(0.32, 0.72, 0, 1) forwards',
    };

    const handleStyles = {
        paddingTop: spacing.md,
        paddingBottom: spacing.sm,
        display: 'flex',
        justifyContent: 'center',
        flexShrink: 0,
    };

    const handleBarStyles = {
        width: '40px',
        height: '4px',
        borderRadius: borderRadius.full,
        backgroundColor: colors.border,
    };

    const scrollStyles = {
        overflow: 'auto',
        overflowX: 'hidden',
        padding: spacing.lg,
        paddingTop: spacing.sm,
        WebkitOverflowScrolling: 'touch',
    };

    const styleSheet = createElement('style', {
        text: `
            .bottom-sheet-scroll {
                -ms-overflow-style: none;
                scrollbar-width: none;
            }
            .bottom-sheet-scroll::-webkit-scrollbar {
                display: none;
            }
            @keyframes bottomSheetOverlayIn {
                from { opacity: 0; }
                to { opacity: 1; }
            }
            @keyframes bottomSheetPanelIn {
                from { transform: translateY(100%); }
                to { transform: translateY(0); }
            }
            @keyframes bottomSheetOverlayOut {
                from { opacity: 1; }
                to { opacity: 0; }
            }
            @keyframes bottomSheetPanelOut {
                from { transform: translateY(0); }
                to { transform: translateY(100%); }
            }
        `,
    });
    document.head.appendChild(styleSheet);

    const overlay = div({ styles: overlayStyles });
    const panel = div({ styles: panelStyles });

    function close(animated = true) {
        if (animated) {
            overlay.style.animation = 'bottomSheetOverlayOut 0.25s ease forwards';
            panel.style.animation = 'bottomSheetPanelOut 0.25s cubic-bezier(0.32, 0.72, 0, 1) forwards';
            setTimeout(cleanup, 250);
        } else {
            cleanup();
        }
    }

    function cleanup() {
        document.removeEventListener('keydown', handleEscape);
        if (styleSheet.parentNode) styleSheet.remove();
        overlay.remove();
    }

    overlay.addEventListener('click', () => close());
    panel.addEventListener('click', (e) => e.stopPropagation());

    const handleEscape = (e) => {
        if (e.key === 'Escape') close();
    };
    document.addEventListener('keydown', handleEscape);

    // Handle
    panel.appendChild(
        div({
            styles: handleStyles,
            children: [div({ styles: handleBarStyles })],
        })
    );

    const headerRow = div({
        styles: {
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            gap: spacing.md,
            marginBottom: spacing.lg,
        },
        children: [
            div({
                styles: { flex: 1, minWidth: 0 },
                children: [
                    createElement('h2', {
                        text: session.workoutName || 'Entrenamiento Libre',
                        styles: {
                            fontSize: typography.sizes.xl,
                            fontWeight: typography.weights.bold,
                            color: colors.text,
                            marginBottom: spacing.xs,
                        },
                    }),
                    createElement('p', {
                        text: `${dateStr} · ${timeStr}`,
                        styles: { fontSize: typography.sizes.sm, color: colors.textMuted },
                    }),
                ],
            }),
            button({
                styles: {
                    ...baseStyles.button,
                    padding: spacing.sm,
                    backgroundColor: 'transparent',
                    border: 'none',
                    color: colors.textMuted,
                },
                attrs: { title: 'Cerrar' },
                children: [icon('x', 22, colors.textMuted)],
                events: { click: () => close() },
            }),
        ],
    });

    const metricsGrid = div({
        styles: {
            display: 'grid',
            gridTemplateColumns: 'repeat(2, 1fr)',
            gap: spacing.md,
            marginBottom: spacing.xl,
        },
        children: [
            { value: formatDuration(duration), label: 'Duración', icon: 'clock' },
            { value: `${m.power?.avg ?? '--'}W`, label: 'Potencia media', icon: 'zap' },
            { value: `${m.power?.max ?? '--'}W`, label: 'Potencia máx', icon: 'gauge' },
            { value: String(m.intensity?.tss ?? '--'), label: 'TSS', icon: 'activity' },
            { value: String(m.energy?.calories ?? '--'), label: 'Calorías', icon: 'flame' },
            { value: distanceM != null ? `${Math.round(distanceM / 1000)} km` : '--', label: 'Distancia', icon: 'bike' },
            { value: m.heartRate?.avg > 0 ? `${m.heartRate.avg} lpm` : '--', label: 'FC media', icon: 'heart' },
            { value: m.heartRate?.max > 0 ? `${m.heartRate.max} lpm` : '--', label: 'FC máx', icon: 'heart' },
        ].map((item) =>
            div({
                styles: {
                    backgroundColor: colors.surfaceLight,
                    borderRadius: borderRadius.md,
                    padding: spacing.md,
                    textAlign: 'center',
                },
                children: [
                    icon(item.icon, 18, colors.primary),
                    createElement('div', {
                        text: String(item.value),
                        styles: {
                            fontSize: typography.sizes.lg,
                            fontWeight: typography.weights.bold,
                            color: colors.text,
                            fontFamily: typography.fontMono,
                            marginTop: spacing.xs,
                        },
                    }),
                    createElement('div', {
                        text: item.label,
                        styles: { fontSize: typography.sizes.xs, color: colors.textMuted, marginTop: spacing.xs },
                    }),
                ],
            })
        ),
    });

    const actionRow = div({
        styles: {
            display: 'flex',
            flexDirection: 'column',
            gap: spacing.sm,
        },
        children: [
            button({
                styles: {
                    ...baseStyles.button,
                    ...baseStyles.buttonSecondary,
                    padding: `${spacing.md} ${spacing.lg}`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: spacing.sm,
                },
                children: [icon('download', 18, colors.text), createElement('span', { text: 'Exportar TCX' })],
                events: { click: () => doExport(session, 'tcx') },
            }),
            button({
                styles: {
                    ...baseStyles.button,
                    ...baseStyles.buttonSecondary,
                    padding: `${spacing.md} ${spacing.lg}`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: spacing.sm,
                },
                children: [icon('download', 18, colors.text), createElement('span', { text: 'Exportar CSV' })],
                events: { click: () => doExport(session, 'csv') },
            }),
            button({
                styles: {
                    ...baseStyles.button,
                    padding: `${spacing.md} ${spacing.lg}`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: spacing.sm,
                    backgroundColor: 'transparent',
                    border: `1px solid ${colors.error}`,
                    color: colors.error,
                },
                children: [icon('x', 18, colors.error), createElement('span', { text: 'Eliminar' })],
                events: {
                    click: () => {
                        if (!confirm('¿Eliminar esta sesión?')) return;
                        deleteSession(session.id)
                            .then(() => {
                                close(false);
                                onDeleted?.();
                            })
                            .catch((err) => {
                                console.error('Error eliminando sesión:', err);
                                alert('No se pudo eliminar la sesión.');
                            });
                    },
                },
            }),
        ],
    });

    const scroll = div({
        className: 'bottom-sheet-scroll',
        styles: scrollStyles,
        children: [headerRow, metricsGrid, actionRow],
    });
    panel.appendChild(scroll);

    overlay.appendChild(panel);
    return overlay;
}
