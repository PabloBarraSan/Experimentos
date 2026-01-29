/**
 * TrainingView - Vista de entrenamiento activo
 * Smart Trainer Controller
 */

import { colors, spacing, typography, baseStyles, borderRadius, transitions, shadows, getZoneColor, getZoneName } from '../utils/theme.js';
import { createElement, div, button, icon, formatTime, formatDistance } from '../utils/dom.js';
import { MetricCard } from '../components/MetricCard.js';
import { PowerGauge } from '../components/PowerGauge.js';
import { ResistanceSlider } from '../components/ResistanceSlider.js';
import { showSaveSessionDialog } from '../components/SaveSessionDialog.js';
import { navigateTo, subscribe, updateState, AppState } from '../app.js';
import { createSession, finishSession } from '../storage/sessions.js';
import { calculateSessionMetrics } from '../utils/calculations.js';

/**
 * Vista de entrenamiento con métricas y controles
 */
export function TrainingView(state) {
    const { liveData, session, settings, bluetoothManager } = state;
    
    // Valor objetivo de resistencia controlado por el usuario
    // Este es el valor que el usuario QUIERE, no el que reporta el dispositivo
    let targetResistance = liveData.resistance || 50;
    
    // Referencias a elementos del DOM para actualización en tiempo real
    let updateRefs = {
        speedValue: null,
        timeValue: null,
        distanceValue: null,
        heartRateValue: null,
        heartRateCard: null,
        resistanceValue: null,
        powerGauge: null,
        powerGaugeContainer: null,
        metricsContainer: null,
        pausarBtn: null,
        pausarBtnIcon: null,
        /** Buffer para media móvil de 3 s (potencia) */
        smoothBuffer: [],
    };
    
    const currentZoneColor = getZoneColor(liveData.power || 0, settings.ftp);
    
    // Función para actualizar los valores en el DOM
    const updateMetrics = (newState) => {
        const { liveData: newLiveData, session: newSession, settings: newSettings } = newState;
        const now = Date.now();
        const WINDOW_MS = 3000;

        // Media móvil 3 s para Potencia (evitar que los números bailen)
        const buf = updateRefs.smoothBuffer;
        buf.push({ t: now, power: newLiveData.power ?? 0 });
        while (buf.length && buf[0].t < now - WINDOW_MS) buf.shift();
        const powerEntries = buf.filter((e) => typeof e.power === 'number');
        const smoothedPower = powerEntries.length
            ? Math.round(powerEntries.reduce((a, e) => a + e.power, 0) / powerEntries.length)
            : (newLiveData.power ?? 0);

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
        
        // Frecuencia cardiaca: mostrar valor o -- si no hay sensor; atenuar tarjeta si no hay FC
        if (updateRefs.heartRateValue) {
            updateRefs.heartRateValue.textContent = newLiveData.heartRate != null && newLiveData.heartRate !== '' ? String(newLiveData.heartRate) : '--';
        }
        if (updateRefs.heartRateCard) {
            const hasHR = newLiveData.heartRate != null && newLiveData.heartRate !== '';
            updateRefs.heartRateCard.style.opacity = hasHR ? '1' : '0.6';
            updateRefs.heartRateCard.style.filter = hasHR ? 'none' : 'brightness(0.9)';
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
            const newIcon = icon(newSession.isPaused ? 'play' : 'pause', 18, 'currentColor');
            updateRefs.pausarBtnIcon.innerHTML = newIcon.innerHTML;
            const labelSpan = updateRefs.pausarBtn.querySelector('span');
            if (labelSpan) labelSpan.textContent = newSession.isPaused ? 'Reanudar' : 'Pausar';
        }
        
        // NO actualizamos el texto de resistencia desde el dispositivo
        // El usuario tiene control manual total - mostramos el valor OBJETIVO seleccionado por el usuario
        // (el valor se actualiza solo cuando el usuario mueve el slider)
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
                    variant: 'training',
                });
                updateRefs.powerGauge.parentElement.replaceChild(newGauge, updateRefs.powerGauge);
                updateRefs.powerGauge = newGauge;
                updateRefs.lastGaugeUpdate = now;
            }
        }
        
    };
    
    // Suscribirse a cambios de estado
    const unsubscribe = subscribe((newState) => {
        if (newState.currentView === 'training') {
            updateMetrics(newState);
        }
    });
    
    // Estilos alineados con mockup: columna única, gauge centrado, 3 métricas, bottom sheet resistencia
    const containerStyles = {
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        minHeight: 0,
        overflow: 'hidden',
        padding: 0,
        gap: 0,
        maxWidth: '1200px',
        margin: '0 auto',
        width: '100%',
        backgroundColor: colors.background,
    };

    const sessionHeaderStyles = {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '16px 24px 0',
        flexShrink: 0,
    };

    const scrollContentStyles = {
        flex: 1,
        minHeight: 0,
        overflowY: 'auto',
        WebkitOverflowScrolling: 'touch',
        display: 'flex',
        flexDirection: 'column',
    };

    const gaugeContainerStyles = {
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        position: 'relative',
        minHeight: '280px',
        flexShrink: 0,
    };

    const metricsGridStyles = {
        display: 'grid',
        gridTemplateColumns: '1fr 1fr 1fr',
        gap: '12px',
        padding: '0 16px',
        marginBottom: '24px',
        flexShrink: 0,
    };

    const resistancePanelStyles = {
        background: '#161616',
        borderTop: '1px solid rgba(255,255,255,0.1)',
        padding: '12px 20px max(40px, env(safe-area-inset-bottom))',
        borderRadius: '24px 24px 0 0',
        boxShadow: '0 -10px 40px rgba(0,0,0,0.5)',
        position: 'relative',
        zIndex: 20,
        flexShrink: 0,
    };
    
    // === Construir vista ===
    const container = div({ 
        styles: containerStyles,
        attrs: { 'data-view': 'training' }
    });
    
    // Añadir estilos responsive + modo paisaje (móvil en manillar)
    const responsiveStyles = createElement('style', {
        text: `
            [data-view="training"] .secondary-metrics {
                grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)) !important;
            }
            [data-view="training"] .training-swiper {
                -webkit-overflow-scrolling: touch;
            }
            [data-view="training"] .training-swiper-panel {
                scroll-snap-align: start;
                scroll-snap-stop: always;
            }
            [data-view="training"] .training-metrics-grid > div {
                background: linear-gradient(180deg, #1a1a1a 0%, #111 100%);
                border: 1px solid rgba(255,255,255,0.08);
                border-radius: 16px;
                padding: 16px 12px;
            }
            [data-view="training"] .training-metrics-grid > div.fc {
                border-color: rgba(239, 68, 68, 0.35);
                background: linear-gradient(180deg, rgba(239,68,68,0.06) 0%, #111 100%);
            }
            @media (max-width: 768px) {
                [data-view="training"] .secondary-metrics {
                    grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)) !important;
                }
            }
            @media (max-width: 480px) {
                [data-view="training"] .secondary-metrics {
                    grid-template-columns: repeat(2, 1fr) !important;
                }
            }
            @media (orientation: landscape) and (max-height: 500px) {
                [data-view="training"] .secondary-metrics {
                    grid-template-columns: repeat(auto-fit, minmax(100px, 1fr)) !important;
                }
            }
        `
    });
    document.head.appendChild(responsiveStyles);
    
    // === HEADER: tipo de sesión + timer (estilo mockup) ===
    const sessionTypeLabel = session.workoutName || 'Entreno Libre';
    const sessionHeader = div({
        styles: sessionHeaderStyles,
        children: [
            createElement('div', {
                text: sessionTypeLabel,
                styles: {
                    fontSize: '12px',
                    textTransform: 'uppercase',
                    letterSpacing: '1px',
                    color: colors.textMuted,
                    background: 'rgba(255,255,255,0.05)',
                    padding: '4px 10px',
                    borderRadius: '20px',
                },
            }),
            createElement('div', {
                text: formatTime(session.elapsedTime || liveData.elapsedTime || 0),
                styles: {
                    fontFamily: "'Barlow', sans-serif",
                    fontSize: '28px',
                    fontWeight: 700,
                    letterSpacing: '-0.5px',
                    color: colors.text,
                },
            }),
        ],
    });
    const timerEl = sessionHeader.querySelector('div:last-child');
    if (timerEl) updateRefs.timeValue = timerEl;

    // Área scrollable: header + gauge + métricas (el panel de resistencia queda fijo abajo)
    const scrollContent = div({
        styles: scrollContentStyles,
        attrs: { class: 'training-scroll-content' },
        children: [],
    });
    scrollContent.appendChild(sessionHeader);

    // === GAUGE: circular centrado (variant training, estilo mockup) ===
    const powerGaugeElement = PowerGauge({
        power: liveData.power || 0,
        ftp: settings.ftp,
        maxPower: settings.ftp * 2,
        variant: 'training',
    });
    updateRefs.powerGauge = powerGaugeElement;
    const gaugeContainer = div({
        styles: gaugeContainerStyles,
        children: [powerGaugeElement],
    });
    updateRefs.powerGaugeContainer = gaugeContainer;
    scrollContent.appendChild(gaugeContainer);

    // === MÉTRICAS (3 cards: RPM, KM/H, KM - estilo mockup) ===
    // zoneColor e isStale/dimmed para coherencia visual tipo Garmin
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
    heartRateCard.classList.add('fc');
    const heartRateDivs = heartRateCard.querySelectorAll('div');
    if (heartRateDivs.length >= 3) {
        const valueContainer = heartRateDivs[heartRateDivs.length - 1];
        const valueSpan = valueContainer.querySelector('span:first-child');
        if (valueSpan) updateRefs.heartRateValue = valueSpan;
    }

    const speedCard = MetricCard({
        label: 'KM/H',
        value: (liveData.speed || 0).toFixed(1),
        unit: '',
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
        label: 'KM',
        value: distanceDisplay,
        unit: '',
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
    
    const metricsGrid = div({
        styles: metricsGridStyles,
        attrs: { class: 'training-metrics-grid' },
        children: [heartRateCard, speedCard, distanceCard],
    });
    updateRefs.metricsContainer = metricsGrid;
    scrollContent.appendChild(metricsGrid);

    container.appendChild(scrollContent);

    // === PANEL RESISTENCIA (bottom sheet, siempre visible abajo) ===
    // Mostramos el valor OBJETIVO seleccionado por el usuario, no el del dispositivo
    const resistanceValueSpan = createElement('span', {
        text: `${Math.round(targetResistance)}%`,
        styles: {
            fontFamily: "'Barlow', sans-serif",
            fontSize: '20px',
            fontWeight: 700,
            color: colors.primary,
        },
    });
    updateRefs.resistanceValue = resistanceValueSpan;

    const sliderEl = ResistanceSlider({
        value: targetResistance,
        minimal: true,
        onChange: async (value) => {
            // Actualizar el valor objetivo local
            targetResistance = value;
            
            // Actualizar el texto mostrado inmediatamente
            if (updateRefs.resistanceValue) {
                updateRefs.resistanceValue.textContent = `${Math.round(value)}%`;
            }
            
            try {
                // Intentar múltiples métodos para controlar la resistencia
                // Método 1: SET_TARGET_RESISTANCE (estándar FTMS)
                await bluetoothManager.setResistance(value);
                
                // Método 2: Simulación de pendiente
                // 0% → -6% (bajada máxima, muy fácil)
                // 50% → 0% (llano)
                // 100% → +6% (subida máxima, muy duro)
                const grade = -6 + (value / 100) * 12; // 0-100% → -6% a +6%
                if (bluetoothManager.commandQueue) {
                    console.log(`🚴 Enviando simulación de pendiente: ${grade.toFixed(1)}%`);
                    bluetoothManager.commandQueue.setIndoorBikeSimulation(0, grade, 0.004, 0.51)
                        .catch((e) => console.warn('Simulación no soportada:', e.message));
                }
            } catch (error) {
                console.error('Error al cambiar resistencia:', error);
            }
        },
    });

    const pausarBtnIcon = icon(session.isPaused ? 'play' : 'pause', 18, 'currentColor');
    const pausarBtn = button({
        styles: {
            height: '48px',
            borderRadius: '12px',
            border: '1px solid rgba(245, 158, 11, 0.3)',
            background: 'rgba(245, 158, 11, 0.15)',
            color: '#f59e0b',
            fontWeight: 600,
            fontSize: '14px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
        },
        children: [pausarBtnIcon, createElement('span', { text: session.isPaused ? 'Reanudar' : 'Pausar' })],
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
            },
        },
    });
    updateRefs.pausarBtn = pausarBtn;
    updateRefs.pausarBtnIcon = pausarBtnIcon;

    const finalizarBtn = button({
        styles: {
            height: '48px',
            borderRadius: '12px',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            background: 'rgba(239, 68, 68, 0.15)',
            color: '#ef4444',
            fontWeight: 600,
            fontSize: '14px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
        },
        children: [icon('stop', 18, 'currentColor'), createElement('span', { text: 'Fin' })],
        attrs: { title: 'Finalizar entrenamiento' },
        events: {
            click: async () => {
                const duration = AppState.session.elapsedTime ?? 0;
                const MIN_DURATION_SECONDS = 60;
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
                const metrics = calculateSessionMetrics({
                    dataPoints: AppState.session.dataPoints,
                    duration,
                }, settings.ftp);
                const result = await showSaveSessionDialog({
                    session: AppState.session,
                    metrics,
                    ftp: settings.ftp,
                    onCancel: () => {},
                });
                if (result.cancelled) return;
                if (result.saved) {
                    try {
                        const sessionToSave = createSession({
                            workoutName: result.workoutName,
                            ftp: settings.ftp,
                        });
                        sessionToSave.dataPoints = [...AppState.session.dataPoints];
                        sessionToSave.startTime = AppState.session.startTime;
                        await finishSession(sessionToSave, metrics);
                    } catch (error) {
                        console.error('Error guardando sesión:', error);
                        alert('Error al guardar la sesión. Los datos no se han perdido.');
                    }
                }
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
            },
        },
    });

    const resHeader = div({
        styles: {
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '16px',
        },
        children: [
            createElement('span', {
                text: 'Resistencia',
                styles: {
                    fontSize: '13px',
                    textTransform: 'uppercase',
                    letterSpacing: '1px',
                    color: colors.textMuted,
                    fontWeight: 600,
                },
            }),
            resistanceValueSpan,
        ],
    });

    const bottomActions = div({
        styles: {
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '12px',
            marginTop: '24px',
        },
        children: [pausarBtn, finalizarBtn],
    });

    const resistancePanel = div({
        styles: resistancePanelStyles,
        attrs: { class: 'resistance-control' },
        children: [
            div({
                styles: {
                    width: '40px',
                    height: '4px',
                    backgroundColor: 'rgba(255,255,255,0.2)',
                    borderRadius: '2px',
                    margin: '0 auto 20px',
                },
            }),
            resHeader,
            sliderEl,
            bottomActions,
        ],
    });
    container.appendChild(resistancePanel);
    
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
