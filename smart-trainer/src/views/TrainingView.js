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
import { GameModeButton } from './GameView.js';
import { navigateToGame, subscribe } from '../app.js';

/**
 * Vista de entrenamiento con métricas y controles
 */
export function TrainingView(state) {
    const { liveData, session, settings, bluetoothManager } = state;
    
    // Referencias a elementos del DOM para actualización en tiempo real
    let updateRefs = {
        speedValue: null,
        timeValue: null,
        distanceValue: null,
        caloriesValue: null,
        heartRateValue: null,
        resistanceValue: null,
        powerGauge: null,
        powerChart: null,
        chartCanvas: null,
    };
    
    // Función para actualizar los valores en el DOM
    const updateMetrics = (newState) => {
        const { liveData: newLiveData, session: newSession, settings: newSettings } = newState;
        
        // Calcular tiempo transcurrido
        let elapsedTime = 0;
        if (newSession.isActive && newSession.startTime) {
            elapsedTime = Math.floor((Date.now() - newSession.startTime) / 1000);
        } else if (newSession.elapsedTime) {
            elapsedTime = newSession.elapsedTime;
        }
        
        // Las métricas de potencia y zona se actualizan a través del PowerGauge
        
        if (updateRefs.speedValue) {
            updateRefs.speedValue.textContent = (newLiveData.speed || 0).toFixed(1);
        }
        
        // Actualizar métricas secundarias
        if (updateRefs.timeValue) {
            updateRefs.timeValue.textContent = formatTime(elapsedTime);
        }
        
        if (updateRefs.distanceValue) {
            // Mostrar distancia calculada o del dispositivo
            // Si el dispositivo no la soporta, usamos la calculada desde velocidad
            const distanceSupported = newState.deviceCapabilities?.totalDistanceSupported !== false;
            let distanceToShow = newLiveData.distance;
            
            // Si no hay distancia del dispositivo pero tenemos distancia acumulada, usarla
            if ((distanceToShow === undefined || distanceToShow === null || !distanceSupported) && 
                newSession.accumulatedDistance !== undefined) {
                distanceToShow = newSession.accumulatedDistance;
            }
            
            if (distanceToShow !== undefined && distanceToShow !== null) {
                updateRefs.distanceValue.textContent = formatDistance(distanceToShow);
            } else {
                updateRefs.distanceValue.textContent = '--';
            }
        }
        
        if (updateRefs.caloriesValue) {
            updateRefs.caloriesValue.textContent = String(Math.round(newLiveData.calories || 0));
        }
        
        if (updateRefs.heartRateValue) {
            updateRefs.heartRateValue.textContent = newLiveData.heartRate || '--';
        }
        
        if (updateRefs.resistanceValue) {
            updateRefs.resistanceValue.textContent = `${Math.round(newLiveData.resistance || 0)}%`;
        }
        
        // Actualizar gauge de potencia (re-renderizar cada segundo para mejor rendimiento)
        const now = Date.now();
        if (!updateRefs.lastGaugeUpdate || now - updateRefs.lastGaugeUpdate > 1000) {
            if (updateRefs.powerGauge && updateRefs.powerGauge.parentElement) {
                const newGauge = PowerGauge({
                    power: newLiveData.power || 0,
                    ftp: newSettings.ftp,
                    maxPower: newSettings.ftp * 2,
                });
                updateRefs.powerGauge.parentElement.replaceChild(newGauge, updateRefs.powerGauge);
                updateRefs.powerGauge = newGauge;
                updateRefs.lastGaugeUpdate = now;
            }
        }
        
        // Actualizar gráfico cada 2 segundos para mejor rendimiento
        if (!updateRefs.lastChartUpdate || now - updateRefs.lastChartUpdate > 2000) {
            if (updateRefs.powerChart && newSession.dataPoints && newSession.dataPoints.length > 0) {
                const chartContainer = updateRefs.powerChart.parentElement;
                if (chartContainer) {
                    const newChart = PowerChart({
                        dataPoints: newSession.dataPoints,
                        ftp: newSettings.ftp,
                        width: '100%',
                        height: 150,
                    });
                    chartContainer.replaceChild(newChart, updateRefs.powerChart);
                    updateRefs.powerChart = newChart;
                    updateRefs.lastChartUpdate = now;
                }
            }
        }
    };
    
    // Suscribirse a cambios de estado
    const unsubscribe = subscribe((newState) => {
        if (newState.currentView === 'training') {
            updateMetrics(newState);
        }
    });
    
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
    
    // === Construir vista ===
    const container = div({ 
        styles: containerStyles,
        attrs: { 'data-view': 'training' }
    });
    
    // Añadir estilos responsive
    const responsiveStyles = createElement('style', {
        text: `
            @media (max-width: 1024px) {
                [data-view="training"] .secondary-metrics {
                    grid-template-columns: repeat(3, 1fr) !important;
                }
            }
            @media (max-width: 768px) {
                [data-view="training"] {
                    padding: ${spacing.md} !important;
                }
                [data-view="training"] .secondary-metrics {
                    grid-template-columns: repeat(3, 1fr) !important;
                }
                [data-view="training"] .action-buttons {
                    grid-template-columns: repeat(3, 1fr) !important;
                }
            }
            @media (max-width: 480px) {
                [data-view="training"] .secondary-metrics {
                    grid-template-columns: repeat(2, 1fr) !important;
                }
                [data-view="training"] .action-buttons {
                    grid-template-columns: repeat(3, 1fr) !important;
                }
            }
        `
    });
    document.head.appendChild(responsiveStyles);
    
    // === SECCIÓN HERO: PowerGauge (potencia + zona consolidados) ===
    const powerGaugeElement = PowerGauge({
        power: liveData.power || 0,
        ftp: settings.ftp,
        maxPower: settings.ftp * 2,
    });
    updateRefs.powerGauge = powerGaugeElement;
    const powerSection = div({
        styles: {
            ...powerSectionStyles,
            marginBottom: spacing.lg,
        },
        children: [powerGaugeElement]
    });
    container.appendChild(powerSection);
    
    // Velocidad y Tiempo se crearán más abajo junto con las otras métricas secundarias
    
    // === BOTONES DE ACCIÓN (solo iconos, compactos para una fila) ===
    const iconButtonStyles = {
        ...baseStyles.button,
        padding: `${spacing.xs} ${spacing.sm}`,
        minWidth: 'auto',
        width: '100%',
        height: '44px',
        minHeight: '44px',
        maxHeight: '44px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
        transition: transitions.normal,
        border: 'none',
        borderRadius: baseStyles.button.borderRadius,
    };
    
    const reiniciarBtn = button({
        styles: {
            ...iconButtonStyles,
            ...baseStyles.buttonSecondary,
        },
        children: [
            icon('refresh', 20, colors.text),
        ],
        attrs: { title: 'Reiniciar' },
        events: {
            click: async () => {
                try {
                    await bluetoothManager.reset();
                } catch (error) {
                    console.error('Error al reiniciar:', error);
                }
            }
        }
    });
    
    const pausarBtn = button({
        styles: {
            ...iconButtonStyles,
            backgroundColor: session.isPaused ? colors.success : colors.warning,
            color: colors.background,
        },
        children: [
            icon(session.isPaused ? 'play' : 'pause', 20, colors.background),
        ],
        attrs: { title: session.isPaused ? 'Reanudar' : 'Pausar' },
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
    });
    
    const finalizarBtn = button({
        styles: {
            ...iconButtonStyles,
            backgroundColor: colors.error,
            color: colors.background,
        },
        children: [
            icon('stop', 20, colors.background),
        ],
        attrs: { title: 'Finalizar' },
        events: {
            click: () => {
                if (confirm('¿Seguro que quieres finalizar el entrenamiento?')) {
                    bluetoothManager.disconnect();
                }
            }
        }
    });
    
    // Añadir efectos hover a los botones
    [reiniciarBtn, pausarBtn, finalizarBtn].forEach(btn => {
        btn.addEventListener('mouseenter', () => {
            btn.style.transform = 'scale(1.05)';
            btn.style.opacity = '0.9';
        });
        btn.addEventListener('mouseleave', () => {
            btn.style.transform = 'scale(1)';
            btn.style.opacity = '1';
        });
    });
    
    // === MÉTRICAS SECUNDARIAS (Distancia, Calorías, FC, Velocidad, Tiempo) ===
    // Usar distancia calculada si el dispositivo no la soporta
    const distanceSupported = state.deviceCapabilities?.totalDistanceSupported !== false;
    let distanceValue = liveData.distance;
    if ((distanceValue === undefined || distanceValue === null || !distanceSupported) && 
        session.accumulatedDistance !== undefined) {
        distanceValue = session.accumulatedDistance;
    }
    const distanceDisplay = (distanceValue !== undefined && distanceValue !== null)
        ? formatDistance(distanceValue)
        : '--';
    const distanceCard = MetricCard({
        label: 'Distancia',
        value: distanceDisplay,
        icon: 'bike',
        color: colors.textMuted,
        size: 'small',
    });
    const distanceDivs = distanceCard.querySelectorAll('div');
    if (distanceDivs.length >= 3) {
        const valueContainer = distanceDivs[distanceDivs.length - 1];
        const valueSpan = valueContainer.querySelector('span:first-child');
        if (valueSpan) {
            updateRefs.distanceValue = valueSpan;
        }
    }
    
    const caloriesCard = MetricCard({
        label: 'Calorías',
        value: liveData.calories || 0,
        unit: 'kcal',
        icon: 'flame',
        color: colors.accent,
        size: 'small',
    });
    const caloriesDivs = caloriesCard.querySelectorAll('div');
    if (caloriesDivs.length >= 3) {
        const valueContainer = caloriesDivs[caloriesDivs.length - 1];
        const valueSpan = valueContainer.querySelector('span:first-child');
        if (valueSpan) {
            updateRefs.caloriesValue = valueSpan;
        }
    }
    
    const heartRateCard = MetricCard({
        label: 'FC',
        value: liveData.heartRate || '--',
        unit: liveData.heartRate ? 'bpm' : '',
        icon: 'activity',
        color: colors.error,
        size: 'small',
    });
    const heartRateDivs = heartRateCard.querySelectorAll('div');
    if (heartRateDivs.length >= 3) {
        const valueContainer = heartRateDivs[heartRateDivs.length - 1];
        const valueSpan = valueContainer.querySelector('span:first-child');
        if (valueSpan) {
            updateRefs.heartRateValue = valueSpan;
        }
    }
    
    const speedCard = MetricCard({
        label: 'Velocidad',
        value: (liveData.speed || 0).toFixed(1),
        unit: 'km/h',
        icon: 'gauge',
        color: colors.primary,
        size: 'small',
    });
    const speedDivs = speedCard.querySelectorAll('div');
    if (speedDivs.length >= 3) {
        const valueContainer = speedDivs[speedDivs.length - 1];
        const valueSpan = valueContainer.querySelector('span:first-child');
        if (valueSpan) {
            updateRefs.speedValue = valueSpan;
        }
    }
    
    const timeCard = MetricCard({
        label: 'Tiempo',
        value: formatTime(session.elapsedTime || liveData.elapsedTime || 0),
        icon: 'clock',
        color: colors.textMuted,
        size: 'small',
    });
    const timeDivs = timeCard.querySelectorAll('div');
    if (timeDivs.length >= 3) {
        const valueContainer = timeDivs[timeDivs.length - 1];
        const valueSpan = valueContainer.querySelector('span:first-child');
        if (valueSpan) {
            updateRefs.timeValue = valueSpan;
        }
    }
    
    // Grid con todas las métricas secundarias (5 elementos)
    const secondaryMetrics = div({
        styles: {
            ...mainMetricsStyles,
            gridTemplateColumns: 'repeat(5, 1fr)',
            marginBottom: spacing.lg,
        },
        attrs: { class: 'secondary-metrics' },
        children: [distanceCard, caloriesCard, heartRateCard, speedCard, timeCard]
    });
    container.appendChild(secondaryMetrics);
    
    // === BOTONES DE ACCIÓN (3 columnas, solo iconos: Reiniciar, Pausar, Finalizar) ===
    const actionButtonsGrid = div({
        styles: {
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: spacing.sm,
            marginBottom: spacing.lg,
        },
        attrs: { class: 'action-buttons' },
        children: [reiniciarBtn, pausarBtn, finalizarBtn]
    });
    container.appendChild(actionButtonsGrid);
    
    // === CONTROLES: Resistencia y Modo Juego ===
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
                    (() => {
                        const resistanceSpan = createElement('span', {
                            text: `${liveData.resistance || 0}%`,
                            styles: {
                                fontSize: typography.sizes.xl,
                                fontWeight: typography.weights.bold,
                                color: colors.primary,
                            }
                        });
                        updateRefs.resistanceValue = resistanceSpan;
                        return resistanceSpan;
                    })(),
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
            // Botón de Modo Juego
            div({
                styles: {
                    marginTop: spacing.lg,
                    paddingTop: spacing.lg,
                    borderTop: `1px solid ${colors.border}`,
                    display: 'flex',
                    justifyContent: 'center',
                },
                children: [
                    GameModeButton({
                        onClick: () => {
                            navigateToGame();
                        },
                        disabled: false,
                    }),
                ]
            }),
        ]
    });
    container.appendChild(controlsSection);
    
    // Gráfico de potencia en tiempo real
    const powerChartElement = PowerChart({
        dataPoints: session.dataPoints || [],
        ftp: settings.ftp,
        width: '100%',
        height: 150,
    });
    updateRefs.powerChart = powerChartElement;
    const chartSection = div({
        styles: {
            ...chartSectionStyles,
            marginBottom: spacing.lg,
        },
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
            powerChartElement,
        ]
    });
    container.appendChild(chartSection);
    
    // Los botones ya están en el grid combinado arriba, no necesitamos esta sección
    
    // Marcar el estilo para poder limpiarlo después
    if (responsiveStyles) {
        responsiveStyles.setAttribute('data-training-responsive', 'true');
    }
    
    // Guardar función de limpieza para cuando se desmonte la vista
    container.cleanup = () => {
        if (unsubscribe) {
            unsubscribe();
        }
        // Limpiar estilos responsive si existen
        const existingStyle = document.querySelector('style[data-training-responsive]');
        if (existingStyle) {
            existingStyle.remove();
        }
    };
    
    return container;
}
