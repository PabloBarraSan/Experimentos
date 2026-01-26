/**
 * HistoryView - Vista del historial de sesiones
 * Smart Trainer Controller
 */

import { colors, spacing, typography, baseStyles, borderRadius, transitions } from '../utils/theme.js';
import { createElement, div, button, icon, formatTime } from '../utils/dom.js';
import { getAllSessions, deleteSession, getTotalStats, exportToTCX, exportToCSV } from '../storage/sessions.js';

/**
 * Vista del historial de entrenamientos
 */
export async function HistoryView({ state, onSelectSession }) {
    const sessions = await getAllSessions();
    const totalStats = await getTotalStats();
    
    const containerStyles = {
        padding: spacing.lg,
        maxWidth: '1200px',
        margin: '0 auto',
    };
    
    const headerStyles = {
        marginBottom: spacing.xl,
    };
    
    const titleStyles = {
        fontSize: typography.sizes.xxl,
        fontWeight: typography.weights.bold,
        color: colors.text,
        marginBottom: spacing.md,
    };
    
    const container = div({ styles: containerStyles });
    
    // Header
    const header = div({
        styles: headerStyles,
        children: [
            createElement('h1', { text: '📊 Historial de Entrenamientos', styles: titleStyles }),
        ],
    });
    container.appendChild(header);
    
    // Estadísticas totales
    const statsSection = createStatsCards(totalStats);
    container.appendChild(statsSection);
    
    // Lista de sesiones
    const sessionsSection = div({
        styles: {
            marginTop: spacing.xl,
        },
    });
    
    const sectionTitleStyles = {
        fontSize: typography.sizes.lg,
        fontWeight: typography.weights.semibold,
        color: colors.text,
        marginBottom: spacing.md,
    };
    
    sessionsSection.appendChild(createElement('h2', { 
        text: 'Sesiones Recientes', 
        styles: sectionTitleStyles 
    }));
    
    if (sessions.length === 0) {
        const emptyState = div({
            styles: {
                ...baseStyles.card,
                padding: spacing.xxl,
                textAlign: 'center',
                color: colors.textMuted,
            },
            children: [
                icon('activity', 64, colors.border),
                createElement('p', {
                    text: 'No hay sesiones guardadas aún',
                    styles: { marginTop: spacing.md, fontSize: typography.sizes.lg },
                }),
                createElement('p', {
                    text: 'Completa tu primer entrenamiento para ver el historial aquí',
                    styles: { marginTop: spacing.sm, fontSize: typography.sizes.sm },
                }),
            ],
        });
        sessionsSection.appendChild(emptyState);
    } else {
        const sessionsList = div({
            styles: {
                display: 'flex',
                flexDirection: 'column',
                gap: spacing.md,
            },
        });
        
        sessions.forEach(session => {
            const card = createSessionCard(session, {
                onView: () => onSelectSession?.(session),
                onDelete: async () => {
                    if (confirm('¿Eliminar esta sesión?')) {
                        await deleteSession(session.id);
                        window.location.reload();
                    }
                },
                onExport: (format) => exportSession(session, format),
            });
            sessionsList.appendChild(card);
        });
        
        sessionsSection.appendChild(sessionsList);
    }
    
    container.appendChild(sessionsSection);
    
    return container;
}

/**
 * Crear tarjetas de estadísticas
 */
function createStatsCards(stats) {
    const gridStyles = {
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
        gap: spacing.md,
    };
    
    const cardStyles = {
        ...baseStyles.card,
        padding: spacing.lg,
        textAlign: 'center',
    };
    
    const valueStyles = {
        fontSize: typography.sizes.xxl,
        fontWeight: typography.weights.bold,
        color: colors.primary,
        fontFamily: typography.fontMono,
    };
    
    const labelStyles = {
        fontSize: typography.sizes.sm,
        color: colors.textMuted,
        marginTop: spacing.xs,
    };
    
    const statsData = [
        { value: stats.totalSessions, label: 'Sesiones', icon: 'activity' },
        { value: stats.totalDurationFormatted || '0h', label: 'Tiempo Total', icon: 'clock' },
        { value: `${Math.round(stats.totalDistance / 1000)} km`, label: 'Distancia', icon: 'bike' },
        { value: stats.totalCalories.toLocaleString(), label: 'Calorías', icon: 'flame' },
        { value: stats.totalTSS, label: 'TSS Total', icon: 'zap' },
        { value: `${stats.avgPower}W`, label: 'Potencia Media', icon: 'gauge' },
    ];
    
    return div({
        styles: gridStyles,
        children: statsData.map(stat => 
            div({
                styles: cardStyles,
                children: [
                    icon(stat.icon, 24, colors.primary),
                    createElement('div', { text: String(stat.value), styles: valueStyles }),
                    createElement('div', { text: stat.label, styles: labelStyles }),
                ],
            })
        ),
    });
}

/**
 * Crear tarjeta de sesión
 */
function createSessionCard(session, { onView, onDelete, onExport }) {
    const cardStyles = {
        ...baseStyles.card,
        padding: spacing.md,
        display: 'flex',
        alignItems: 'center',
        gap: spacing.md,
        cursor: 'pointer',
        transition: transitions.fast,
    };
    
    const dateStyles = {
        minWidth: '100px',
        textAlign: 'center',
        padding: spacing.md,
        backgroundColor: colors.surfaceLight,
        borderRadius: borderRadius.md,
    };
    
    const dayStyles = {
        fontSize: typography.sizes.xxl,
        fontWeight: typography.weights.bold,
        color: colors.text,
    };
    
    const monthStyles = {
        fontSize: typography.sizes.sm,
        color: colors.textMuted,
        textTransform: 'uppercase',
    };
    
    const infoStyles = {
        flex: '1',
        display: 'flex',
        flexDirection: 'column',
        gap: spacing.xs,
    };
    
    const titleStyles = {
        fontSize: typography.sizes.lg,
        fontWeight: typography.weights.semibold,
        color: colors.text,
    };
    
    const metricsRowStyles = {
        display: 'flex',
        gap: spacing.lg,
        fontSize: typography.sizes.sm,
        color: colors.textMuted,
    };
    
    const actionsStyles = {
        display: 'flex',
        gap: spacing.sm,
    };
    
    const actionBtnStyles = {
        ...baseStyles.button,
        padding: spacing.sm,
        backgroundColor: 'transparent',
        border: `1px solid ${colors.border}`,
        borderRadius: borderRadius.md,
    };
    
    // Formatear fecha
    const date = new Date(session.date);
    const day = date.getDate();
    const month = date.toLocaleString('es', { month: 'short' });
    const time = date.toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' });
    
    const card = div({ styles: cardStyles });
    
    // Sección de fecha
    const dateSection = div({
        styles: dateStyles,
        children: [
            createElement('div', { text: String(day), styles: dayStyles }),
            createElement('div', { text: month, styles: monthStyles }),
        ],
    });
    card.appendChild(dateSection);
    
    // Información principal
    const info = div({
        styles: infoStyles,
        children: [
            createElement('div', { text: session.workoutName || 'Entrenamiento Libre', styles: titleStyles }),
            div({
                styles: metricsRowStyles,
                children: [
                    createElement('span', { text: `⏱️ ${formatDuration(session.duration)}` }),
                    session.metrics?.power?.avg && createElement('span', { text: `⚡ ${session.metrics.power.avg}W avg` }),
                    session.metrics?.intensity?.tss && createElement('span', { text: `📈 TSS ${session.metrics.intensity.tss}` }),
                    session.metrics?.energy?.calories && createElement('span', { text: `🔥 ${session.metrics.energy.calories} kcal` }),
                ].filter(Boolean),
            }),
            createElement('span', { 
                text: `${time} • FTP: ${session.ftp}W`,
                styles: { fontSize: typography.sizes.xs, color: colors.textDark },
            }),
        ],
    });
    card.appendChild(info);
    
    // Acciones
    const actions = div({
        styles: actionsStyles,
        children: [
            button({
                styles: actionBtnStyles,
                children: [icon('chevronRight', 20, colors.textMuted)],
                attrs: { title: 'Ver detalles' },
                events: {
                    click: (e) => {
                        e.stopPropagation();
                        onView();
                    },
                },
            }),
            createExportDropdown(session, onExport),
            button({
                styles: { ...actionBtnStyles, borderColor: colors.error },
                children: [icon('x', 20, colors.error)],
                attrs: { title: 'Eliminar' },
                events: {
                    click: (e) => {
                        e.stopPropagation();
                        onDelete();
                    },
                },
            }),
        ],
    });
    card.appendChild(actions);
    
    // Hover effect
    card.addEventListener('mouseenter', () => {
        card.style.backgroundColor = colors.surfaceHover;
    });
    card.addEventListener('mouseleave', () => {
        card.style.backgroundColor = colors.surface;
    });
    
    card.addEventListener('click', onView);
    
    return card;
}

/**
 * Crear dropdown de exportación
 */
function createExportDropdown(session, onExport) {
    const container = div({
        styles: { position: 'relative' },
    });
    
    const btn = button({
        styles: {
            ...baseStyles.button,
            padding: spacing.sm,
            backgroundColor: 'transparent',
            border: `1px solid ${colors.border}`,
            borderRadius: borderRadius.md,
        },
        text: '↓',
        attrs: { title: 'Exportar' },
        events: {
            click: (e) => {
                e.stopPropagation();
                const dropdown = container.querySelector('.export-dropdown');
                dropdown.style.display = dropdown.style.display === 'none' ? 'block' : 'none';
            },
        },
    });
    container.appendChild(btn);
    
    const dropdown = div({
        className: 'export-dropdown',
        styles: {
            position: 'absolute',
            top: '100%',
            right: '0',
            backgroundColor: colors.surface,
            border: `1px solid ${colors.border}`,
            borderRadius: borderRadius.md,
            padding: spacing.xs,
            display: 'none',
            zIndex: '100',
            minWidth: '120px',
        },
    });
    
    ['TCX', 'CSV'].forEach(format => {
        const item = button({
            styles: {
                display: 'block',
                width: '100%',
                padding: spacing.sm,
                backgroundColor: 'transparent',
                border: 'none',
                color: colors.text,
                textAlign: 'left',
                cursor: 'pointer',
                borderRadius: borderRadius.sm,
            },
            text: `Exportar ${format}`,
            events: {
                click: (e) => {
                    e.stopPropagation();
                    onExport(format.toLowerCase());
                    dropdown.style.display = 'none';
                },
                mouseenter: (e) => {
                    e.target.style.backgroundColor = colors.surfaceHover;
                },
                mouseleave: (e) => {
                    e.target.style.backgroundColor = 'transparent';
                },
            },
        });
        dropdown.appendChild(item);
    });
    
    container.appendChild(dropdown);
    
    return container;
}

/**
 * Exportar sesión a archivo
 */
function exportSession(session, format) {
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
    
    // Crear y descargar archivo
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    console.log(`📥 Exportado: ${filename}`);
}

/**
 * Formatear duración
 */
function formatDuration(seconds) {
    if (!seconds) return '0:00';
    
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    
    if (hours > 0) {
        return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
}
