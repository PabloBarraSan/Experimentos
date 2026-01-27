/**
 * TrainingView - Vista de entrenamiento activo
 * Smart Trainer Controller
 */

import { colors, spacing, typography, baseStyles, borderRadius, transitions, shadows, getZoneColor, getZoneName } from '../utils/theme.js';
import { createElement, div, button, icon, formatTime, formatDistance } from '../utils/dom.js';
import { MetricCard } from '../components/MetricCard.js';
import { PowerGauge } from '../components/PowerGauge.js';
import { ResistanceSlider } from '../components/ResistanceSlider.js';
import { PowerChart } from '../components/PowerChart.js';

/**
 * Vista de entrenamiento con métricas y controles
 */
export function TrainingView(state) {
    const { liveData, session, settings, bluetoothManager } = state;
    
    const containerStyles = {
        display: 'flex',
        flexDirection: 'column',
        padding: spacing.lg,
        gap: spacing.lg,
        maxWidth: '1200px',
        margin: '0 auto',
        width: '100%',
    };
    
    // === Sección principal de métricas ===
    const mainMetricsStyles = {
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
        gap: spacing.md,
    };
    
    // === Sección de potencia destacada ===
    const powerSectionStyles = {
        ...baseStyles.card,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: spacing.xl,
    };
    
    // === Controles ===
    const controlsSectionStyles = {
        ...baseStyles.card,
        padding: spacing.lg,
    };
    
    const controlsHeaderStyles = {
        ...baseStyles.flexBetween,
        marginBottom: spacing.md,
    };
    
    // === Gráfico de potencia ===
    const chartSectionStyles = {
        ...baseStyles.card,
        padding: spacing.lg,
        minHeight: '200px',
    };
    
    // === Botones de control ===
    const controlButtonsStyles = {
        display: 'flex',
        gap: spacing.md,
        justifyContent: 'center',
        marginTop: spacing.lg,
    };
    
    const actionButtonStyles = {
        ...baseStyles.button,
        padding: `${spacing.md} ${spacing.xl}`,
        fontSize: typography.sizes.md,
        minWidth: '140px',
        gap: spacing.sm,
    };
    
    // === Construir vista ===
    const container = div({ styles: containerStyles });
    
    // Zona actual
    const zoneColor = getZoneColor(liveData.power, settings.ftp);
    const zoneName = getZoneName(liveData.power, settings.ftp);
    
    const zoneIndicator = div({
        styles: {
            padding: `${spacing.sm} ${spacing.md}`,
            backgroundColor: zoneColor,
            color: colors.background,
            borderRadius: borderRadius.md,
            fontSize: typography.sizes.sm,
            fontWeight: typography.weights.semibold,
            textAlign: 'center',
            marginBottom: spacing.md,
        },
        text: zoneName,
    });
    container.appendChild(zoneIndicator);
    
    // Métricas principales (potencia, cadencia, velocidad)
    const mainMetrics = div({
        styles: mainMetricsStyles,
        children: [
            MetricCard({
                label: 'Potencia',
                value: liveData.power || 0,
                unit: 'W',
                icon: 'zap',
                color: zoneColor,
                size: 'large',
            }),
            MetricCard({
                label: 'Cadencia',
                value: liveData.cadence || 0,
                unit: 'rpm',
                icon: 'refresh',
                color: colors.secondary,
            }),
            MetricCard({
                label: 'Velocidad',
                value: (liveData.speed || 0).toFixed(1),
                unit: 'km/h',
                icon: 'gauge',
                color: colors.primary,
            }),
        ]
    });
    container.appendChild(mainMetrics);
    
    // Gauge de potencia
    const powerSection = div({
        styles: powerSectionStyles,
        children: [
            PowerGauge({
                power: liveData.power || 0,
                ftp: settings.ftp,
                maxPower: settings.ftp * 2,
            }),
        ]
    });
    container.appendChild(powerSection);
    
    // Métricas secundarias
    const secondaryMetrics = div({
        styles: {
            ...mainMetricsStyles,
            gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
        },
        children: [
            MetricCard({
                label: 'Tiempo',
                value: formatTime(session.elapsedTime || liveData.elapsedTime || 0),
                icon: 'clock',
                color: colors.textMuted,
                size: 'small',
            }),
            MetricCard({
                label: 'Distancia',
                value: formatDistance(liveData.distance || 0),
                icon: 'bike',
                color: colors.textMuted,
                size: 'small',
            }),
            MetricCard({
                label: 'Calorías',
                value: liveData.calories || 0,
                unit: 'kcal',
                icon: 'flame',
                color: colors.accent,
                size: 'small',
            }),
            MetricCard({
                label: 'FC',
                value: liveData.heartRate || '--',
                unit: liveData.heartRate ? 'bpm' : '',
                icon: 'activity',
                color: colors.error,
                size: 'small',
            }),
        ]
    });
    container.appendChild(secondaryMetrics);
    
    // Control de resistencia
    const controlsSection = div({
        styles: controlsSectionStyles,
        children: [
            div({
                styles: controlsHeaderStyles,
                children: [
                    createElement('h3', {
                        text: 'Control de Resistencia',
                        styles: {
                            fontSize: typography.sizes.lg,
                            fontWeight: typography.weights.semibold,
                            color: colors.text,
                        }
                    }),
                    createElement('span', {
                        text: `${liveData.resistance || 0}%`,
                        styles: {
                            fontSize: typography.sizes.xl,
                            fontWeight: typography.weights.bold,
                            color: colors.primary,
                        }
                    }),
                ]
            }),
            ResistanceSlider({
                value: liveData.resistance || 50,
                onChange: async (value) => {
                    try {
                        await bluetoothManager.setResistance(value);
                    } catch (error) {
                        console.error('Error al cambiar resistencia:', error);
                    }
                }
            }),
        ]
    });
    container.appendChild(controlsSection);
    
    // Gráfico de potencia en tiempo real
    const chartSection = div({
        styles: chartSectionStyles,
        children: [
            createElement('h3', {
                text: 'Potencia en Tiempo Real',
                styles: {
                    fontSize: typography.sizes.md,
                    fontWeight: typography.weights.semibold,
                    color: colors.text,
                    marginBottom: spacing.md,
                }
            }),
            PowerChart({
                dataPoints: session.dataPoints || [],
                ftp: settings.ftp,
                width: '100%',
                height: 150,
            }),
        ]
    });
    container.appendChild(chartSection);
    
    // Botones de control
    const controlButtons = div({
        styles: controlButtonsStyles,
        children: [
            button({
                styles: {
                    ...actionButtonStyles,
                    ...baseStyles.buttonSecondary,
                },
                children: [
                    icon('refresh', 20, colors.text),
                    createElement('span', { text: 'Reiniciar' }),
                ],
                events: {
                    click: async () => {
                        try {
                            await bluetoothManager.reset();
                        } catch (error) {
                            console.error('Error al reiniciar:', error);
                        }
                    }
                }
            }),
            button({
                styles: {
                    ...actionButtonStyles,
                    backgroundColor: session.isPaused ? colors.success : colors.warning,
                    color: colors.background,
                },
                children: [
                    icon(session.isPaused ? 'play' : 'pause', 20, colors.background),
                    createElement('span', { text: session.isPaused ? 'Reanudar' : 'Pausar' }),
                ],
                events: {
                    click: async () => {
                        try {
                            if (session.isPaused) {
                                await bluetoothManager.startTraining();
                            } else {
                                await bluetoothManager.stopTraining();
                            }
                        } catch (error) {
                            console.error('Error:', error);
                        }
                    }
                }
            }),
            button({
                styles: {
                    ...actionButtonStyles,
                    backgroundColor: colors.error,
                    color: colors.text,
                },
                children: [
                    icon('stop', 20, colors.text),
                    createElement('span', { text: 'Finalizar' }),
                ],
                events: {
                    click: () => {
                        if (confirm('¿Seguro que quieres finalizar el entrenamiento?')) {
                            bluetoothManager.disconnect();
                        }
                    }
                }
            }),
        ]
    });
    container.appendChild(controlButtons);
    
    return container;
}
