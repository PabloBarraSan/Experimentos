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
import { showSaveSessionDialog } from '../components/SaveSessionDialog.js';
import { navigateToGame, navigateTo, subscribe, updateState, AppState } from '../app.js';
import { createSession, finishSession } from '../storage/sessions.js';
import { calculateSessionMetrics } from '../utils/calculations.js';

/**
 * Vista de entrenamiento con métricas y controles
 */
export function TrainingView(state) {
    const { liveData, session, settings, bluetoothManager } = state;
    
    // Referencias a elementos del DOM para actualización en tiempo real
    const SLIDER_AUTO_UPDATE_COOLDOWN_MS = 2000;
    let updateRefs = {
        speedValue: null,
        timeValue: null,
        distanceValue: null,
        caloriesValue: null,
        heartRateValue: null,
        cadenceValue: null,
        cadenceCard: null,
        resistanceValue: null,
        resistanceSlider: null,
        lastResistanceSliderInteraction: 0,
        powerGauge: null,
        powerGaugeContainer: null,
        powerChart: null,
        chartCanvas: null,
        metricsContainer: null,
        heartRateCard: null,
        pausarBtn: null,
        pausarBtnIcon: null,
        /** Buffer para media móvil de 3 s (potencia y cadencia) */
        smoothBuffer: [],
    };
    
    const currentZoneColor = getZoneColor(liveData.power || 0, settings.ftp);
    
    // Función para actualizar los valores en el DOM
    const updateMetrics = (newState) => {
        const { liveData: newLiveData, session: newSession, settings: newSettings } = newState;
        const now = Date.now();
        const WINDOW_MS = 3000;

        // Media móvil 3 s para Potencia y Cadencia (evitar que los números bailen)
        const buf = updateRefs.smoothBuffer;
        buf.push({
            t: now,
            power: newLiveData.power ?? 0,
            cadence: newLiveData.cadence != null ? newLiveData.cadence : null,
        });
        while (buf.length && buf[0].t < now - WINDOW_MS) buf.shift();
        const powerEntries = buf.filter((e) => typeof e.power === 'number');
        const cadenceEntries = buf.filter((e) => e.cadence != null && typeof e.cadence === 'number');
        const smoothedPower = powerEntries.length
            ? Math.round(powerEntries.reduce((a, e) => a + e.power, 0) / powerEntries.length)
            : (newLiveData.power ?? 0);
        const smoothedCadence = cadenceEntries.length
            ? Math.round(cadenceEntries.reduce((a, e) => a + e.cadence, 0) / cadenceEntries.length)
            : null;

        // Calcular tiempo transcurrido (descontando tiempo en pausa)
        let elapsedTime = 0;
        if (newSession.isActive && newSession.startTime) {
            const pauseDuration = newSession.pauseDuration || 0;
            const currentPauseMs = newSession.pausedAt ? (now - newSession.pausedAt) : 0;
            elapsedTime = Math.floor((now - newSession.startTime - pauseDuration - currentPauseMs) / 1000);
        } else if (newSession.elapsedTime != null) {
            elapsedTime = newSession.elapsedTime;
        }

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
        
        // Cadencia: valor suavizado; si cadencia 0 o sin dato pero potencia > 25W → "Calculando..." con parpadeo
        const showCalculando = smoothedPower > 25 && (smoothedCadence == null || smoothedCadence === 0);
        if (updateRefs.cadenceValue) {
            if (showCalculando) {
                updateRefs.cadenceValue.textContent = 'Calculando...';
                updateRefs.cadenceValue.classList.add('cadence-calculating');
            } else {
                updateRefs.cadenceValue.textContent = smoothedCadence != null ? String(smoothedCadence) : '--';
                updateRefs.cadenceValue.classList.remove('cadence-calculating');
            }
        }
        if (updateRefs.cadenceCard) {
            updateRefs.cadenceCard.style.opacity = '1';
        }

        // Actualizar borde de zona en tarjetas de métricas (usar potencia suavizada)
        if (updateRefs.metricsContainer) {
            const zoneColor = getZoneColor(smoothedPower, newSettings.ftp);
            const cards = updateRefs.metricsContainer.querySelectorAll(':scope > div');
            cards.forEach(card => { card.style.borderLeft = `4px solid ${zoneColor}`; });
        }
        // Botón Pausa/Reanudar: actualizar aspecto según isPaused
        if (updateRefs.pausarBtn && updateRefs.pausarBtnIcon && newSession.isPaused !== undefined) {
            updateRefs.pausarBtn.style.backgroundColor = newSession.isPaused ? colors.success : colors.warning;
            updateRefs.pausarBtn.title = newSession.isPaused ? 'Reanudar' : 'Pausar';
            const newIcon = icon(newSession.isPaused ? 'play' : 'pause', 20, colors.background);
            updateRefs.pausarBtnIcon.innerHTML = newIcon.innerHTML;
        }
        // FC: atenuar si no hay sensor conectado
        if (updateRefs.heartRateCard) {
            const hasHR = newLiveData.heartRate != null && newLiveData.heartRate !== '';
            updateRefs.heartRateCard.style.opacity = hasHR ? '1' : '0.5';
            updateRefs.heartRateCard.style.filter = hasHR ? 'none' : 'brightness(0.85)';
        }
        
        if (updateRefs.resistanceValue) {
            updateRefs.resistanceValue.textContent = `${Math.round(newLiveData.resistance || 0)}%`;
        }
        // ResistanceSlider: no mover automáticamente si el usuario ha interactuado en los últimos 2 s (evita feedback loop del servo)
        if (updateRefs.resistanceSlider && typeof updateRefs.resistanceSlider.setValue === 'function') {
            const lastInteraction = updateRefs.lastResistanceSliderInteraction || 0;
            if (now - lastInteraction >= SLIDER_AUTO_UPDATE_COOLDOWN_MS) {
                updateRefs.resistanceSlider.setValue(newLiveData.resistance ?? 0);
            }
        }
        // UI Feedback: esfuerzo máximo si potencia > 400 W (glow rojo en contenedor del PowerGauge)
        if (updateRefs.powerGaugeContainer) {
            updateRefs.powerGaugeContainer.style.boxShadow = smoothedPower > 400
                ? shadows.glow(colors.error)
                : '';
        }

        // Actualizar gauge de potencia con valor suavizado (re-renderizar cada segundo)
        if (!updateRefs.lastGaugeUpdate || now - updateRefs.lastGaugeUpdate > 1000) {
            if (updateRefs.powerGauge && updateRefs.powerGauge.parentElement) {
                const newGauge = PowerGauge({
                    power: smoothedPower,
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
    
    // === Sección principal de métricas (responsive: auto-fit 140px) ===
    const mainMetricsStyles = {
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
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
    
    // Añadir estilos responsive + modo paisaje (móvil en manillar)
    const responsiveStyles = createElement('style', {
        text: `
            @keyframes cadence-blink {
                0%, 100% { opacity: 1; }
                50% { opacity: 0.45; }
            }
            [data-view="training"] .cadence-calculating {
                animation: cadence-blink 1s ease-in-out infinite;
            }
            [data-view="training"] .secondary-metrics {
                grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)) !important;
            }
            @media (max-width: 768px) {
                [data-view="training"] {
                    padding: ${spacing.md} !important;
                }
                [data-view="training"] .secondary-metrics {
                    grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)) !important;
                }
                [data-view="training"] .action-buttons {
                    grid-template-columns: repeat(3, 1fr) !important;
                }
            }
            @media (max-width: 480px) {
                [data-view="training"] .secondary-metrics {
                    grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)) !important;
                }
            }
            @media (orientation: landscape) and (max-height: 500px) {
                [data-view="training"] {
                    flex-direction: row !important;
                    flex-wrap: wrap !important;
                    padding: ${spacing.sm} !important;
                    gap: ${spacing.sm} !important;
                }
                [data-view="training"] .secondary-metrics {
                    order: 1;
                    flex: 1 1 100%;
                    grid-template-columns: repeat(auto-fit, minmax(100px, 1fr)) !important;
                }
                [data-view="training"] .action-buttons {
                    order: 2;
                    flex: 0 0 auto;
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
    updateRefs.powerGaugeContainer = powerSection;
    container.appendChild(powerSection);
    
    // Velocidad y Tiempo se crearán más abajo junto con las otras métricas secundarias
    
    // === BOTONES DE ACCIÓN (altura 56px para uso táctil bajo fatiga) ===
    const iconButtonStyles = {
        ...baseStyles.button,
        padding: `${spacing.xs} ${spacing.sm}`,
        minWidth: 'auto',
        width: '100%',
        height: '56px',
        minHeight: '56px',
        maxHeight: '56px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
        transition: transitions.normal,
        border: 'none',
        borderRadius: '16px',
        fontSize: '18px',
        boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
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
    
    const pausarBtnIcon = icon(session.isPaused ? 'play' : 'pause', 20, colors.background);
    const pausarBtn = button({
        styles: {
            ...iconButtonStyles,
            backgroundColor: session.isPaused ? colors.success : colors.warning,
            color: colors.background,
        },
        children: [pausarBtnIcon],
        attrs: { title: session.isPaused ? 'Reanudar' : 'Pausar' },
        events: {
            click: async () => {
                try {
                    if (session.isPaused) {
                        await bluetoothManager.startTraining();
                        const pauseDuration = (AppState.session.pauseDuration || 0) + (Date.now() - (AppState.session.pausedAt || Date.now()));
                        updateState({ session: { ...AppState.session, isPaused: false, pauseDuration, pausedAt: null } });
                    } else {
                        await bluetoothManager.stopTraining();
                        updateState({ session: { ...AppState.session, isPaused: true, pausedAt: Date.now() } });
                    }
                } catch (error) {
                    console.error('Error:', error);
                }
            }
        }
    });
    updateRefs.pausarBtn = pausarBtn;
    updateRefs.pausarBtnIcon = pausarBtnIcon;
    
    const finalizarBtn = button({
        styles: {
            ...iconButtonStyles,
            backgroundColor: colors.error,
            color: colors.background,
        },
        children: [
            icon('stop', 20, colors.background),
        ],
        attrs: { title: 'Finalizar entrenamiento (mantiene conexión)' },
        events: {
            click: async () => {
                const duration = AppState.session.elapsedTime || 0;
                const MIN_DURATION_SECONDS = 60; // 1 minuto mínimo
                
                // Si es muy corto, descartar automáticamente sin preguntar
                if (duration < MIN_DURATION_SECONDS) {
                    updateState({
                        session: {
                            isActive: false,
                            isPaused: false,
                            startTime: null,
                            elapsedTime: 0,
                            dataPoints: [],
                            accumulatedDistance: 0,
                            pauseDuration: 0,
                            pausedAt: null,
                        },
                    });
                    navigateTo('home');
                    return;
                }
                
                // Calcular métricas antes de mostrar el diálogo
                const metrics = calculateSessionMetrics({
                    dataPoints: AppState.session.dataPoints,
                    duration: duration,
                }, settings.ftp);
                
                // Mostrar diálogo de guardado
                const result = await showSaveSessionDialog({
                    session: AppState.session,
                    metrics,
                    ftp: settings.ftp,
                    onCancel: () => {}, // Permitir volver al entreno
                });
                
                if (result.cancelled) {
                    // Usuario quiere volver al entrenamiento
                    return;
                }
                
                if (result.saved) {
                    // Guardar sesión en IndexedDB
                    try {
                        const sessionToSave = createSession({
                            workoutName: result.workoutName,
                            ftp: settings.ftp,
                        });
                        sessionToSave.dataPoints = [...AppState.session.dataPoints];
                        sessionToSave.startTime = AppState.session.startTime;
                        
                        await finishSession(sessionToSave, metrics);
                        console.log('✅ Sesión guardada:', result.workoutName);
                    } catch (error) {
                        console.error('Error guardando sesión:', error);
                        alert('Error al guardar la sesión. Los datos no se han perdido.');
                    }
                }
                
                // Resetear sesión y navegar a home
                updateState({
                    session: {
                        isActive: false,
                        isPaused: false,
                        startTime: null,
                        elapsedTime: 0,
                        dataPoints: [],
                        accumulatedDistance: 0,
                        pauseDuration: 0,
                        pausedAt: null,
                    },
                });
                navigateTo('home');
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
    
    // === MÉTRICAS SECUNDARIAS (Cadencia primero, luego Tiempo, Velocidad, Distancia, FC, Calorías) ===
    // zoneColor e isStale/dimmed para coherencia visual tipo Garmin
    const cadenceCard = MetricCard({
        label: 'Cadencia',
        value: liveData.cadence != null ? Math.round(liveData.cadence) : '--',
        unit: 'rpm',
        icon: 'cadence',
        color: colors.primary,
        size: 'small',
        zoneColor: currentZoneColor,
    });
    updateRefs.cadenceCard = cadenceCard;
    const cadenceDivs = cadenceCard.querySelectorAll('div');
    if (cadenceDivs.length >= 3) {
        const valueContainer = cadenceDivs[cadenceDivs.length - 1];
        const valueSpan = valueContainer.querySelector('span:first-child');
        if (valueSpan) updateRefs.cadenceValue = valueSpan;
    }
    
    const timeCard = MetricCard({
        label: 'Tiempo',
        value: formatTime(session.elapsedTime || liveData.elapsedTime || 0),
        icon: 'clock',
        color: colors.textMuted,
        size: 'small',
        zoneColor: currentZoneColor,
    });
    const timeDivs = timeCard.querySelectorAll('div');
    if (timeDivs.length >= 3) {
        const valueContainer = timeDivs[timeDivs.length - 1];
        const valueSpan = valueContainer.querySelector('span:first-child');
        if (valueSpan) updateRefs.timeValue = valueSpan;
    }
    
    const speedCard = MetricCard({
        label: 'Velocidad',
        value: (liveData.speed || 0).toFixed(1),
        unit: 'km/h',
        icon: 'speedometer',
        color: colors.primary,
        size: 'small',
        zoneColor: currentZoneColor,
    });
    const speedDivs = speedCard.querySelectorAll('div');
    if (speedDivs.length >= 3) {
        const valueContainer = speedDivs[speedDivs.length - 1];
        const valueSpan = valueContainer.querySelector('span:first-child');
        if (valueSpan) updateRefs.speedValue = valueSpan;
    }
    
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
        icon: 'route',
        color: colors.textMuted,
        size: 'small',
        zoneColor: currentZoneColor,
    });
    const distanceDivs = distanceCard.querySelectorAll('div');
    if (distanceDivs.length >= 3) {
        const valueContainer = distanceDivs[distanceDivs.length - 1];
        const valueSpan = valueContainer.querySelector('span:first-child');
        if (valueSpan) updateRefs.distanceValue = valueSpan;
    }
    
    const hasHeartRate = liveData.heartRate != null && liveData.heartRate !== '';
    const heartRateCard = MetricCard({
        label: 'FC',
        value: liveData.heartRate || '--',
        unit: hasHeartRate ? 'bpm' : '',
        icon: 'activity',
        color: colors.error,
        size: 'small',
        zoneColor: currentZoneColor,
        dimmed: !hasHeartRate,
    });
    updateRefs.heartRateCard = heartRateCard;
    const heartRateDivs = heartRateCard.querySelectorAll('div');
    if (heartRateDivs.length >= 3) {
        const valueContainer = heartRateDivs[heartRateDivs.length - 1];
        const valueSpan = valueContainer.querySelector('span:first-child');
        if (valueSpan) updateRefs.heartRateValue = valueSpan;
    }
    
    const caloriesCard = MetricCard({
        label: 'Calorías',
        value: liveData.calories || 0,
        unit: 'kcal',
        icon: 'flame',
        color: colors.accent,
        size: 'small',
        zoneColor: currentZoneColor,
    });
    const caloriesDivs = caloriesCard.querySelectorAll('div');
    if (caloriesDivs.length >= 3) {
        const valueContainer = caloriesDivs[caloriesDivs.length - 1];
        const valueSpan = valueContainer.querySelector('span:first-child');
        if (valueSpan) updateRefs.caloriesValue = valueSpan;
    }
    
    // Grid responsive: repeat(auto-fit, minmax(140px, 1fr))
    const secondaryMetrics = div({
        styles: {
            ...mainMetricsStyles,
            marginBottom: spacing.lg,
        },
        attrs: { class: 'secondary-metrics' },
        children: [cadenceCard, timeCard, speedCard, distanceCard, heartRateCard, caloriesCard]
    });
    updateRefs.metricsContainer = secondaryMetrics;
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
            (() => {
                const sliderEl = ResistanceSlider({
                    value: liveData.resistance || 50,
                    onChange: async (value) => {
                        updateRefs.lastResistanceSliderInteraction = Date.now();
                        try {
                            await bluetoothManager.setResistance(value);
                        } catch (error) {
                            console.error('Error al cambiar resistencia:', error);
                        }
                    }
                });
                updateRefs.resistanceSlider = sliderEl;
                return sliderEl;
            })(),
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
