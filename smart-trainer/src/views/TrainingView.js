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
        resistanceDots: null,
        zoneDivider: null,
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
        // Actualizar color del divider de zona
        if (updateRefs.zoneDivider) {
            const zoneColor = getZoneColor(smoothedPower, newSettings.ftp);
            updateRefs.zoneDivider.style.background = `linear-gradient(90deg, transparent 0%, ${zoneColor}50 50%, transparent 100%)`;
        }
        // Botón Pausa/Reanudar: actualizar aspecto según isPaused
        if (updateRefs.pausarBtn && updateRefs.pausarBtnIcon && newSession.isPaused !== undefined) {
            updateRefs.pausarBtn.style.backgroundColor = newSession.isPaused ? colors.success : colors.warning;
            updateRefs.pausarBtn.title = newSession.isPaused ? 'Reanudar' : 'Pausar';
            // Reemplazar el SVG dentro del contenedor de icono
            const iconContainer = updateRefs.pausarBtnIcon;
            while (iconContainer.firstChild) iconContainer.removeChild(iconContainer.firstChild);
            iconContainer.appendChild(newSession.isPaused ? createPlaySVG() : createPauseSVG());
            // Actualizar el texto del botón (último span hijo directo del botón)
            const allSpans = updateRefs.pausarBtn.querySelectorAll(':scope > span');
            if (allSpans.length >= 2) {
                allSpans[1].textContent = newSession.isPaused ? 'Reanudar' : 'Pausar';
            }
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
    
    // === NUEVO LAYOUT: gauge centrado con métricas a los lados ===
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

    // Timer card -standalone con fondo glass
    const timerCardStyles = {
        background: `linear-gradient(135deg, ${colors.surface} 0%, ${colors.background} 100%)`,
        border: `1px solid ${colors.border}60`,
        borderRadius: '16px',
        padding: '14px 24px',
        margin: '0 16px 0',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexShrink: 0,
        width: 'calc(100% - 32px)',
        maxWidth: '500px',
        boxShadow: `0 4px 20px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.05)`,
    };

    const scrollContentStyles = {
        flex: 1,
        minHeight: 0,
        overflowY: 'auto',
        WebkitOverflowScrolling: 'touch',
        display: 'flex',
        flexDirection: 'column',
        padding: '0 8px',
        alignItems: 'center',
        justifyContent: 'flex-start',
    };

    // Main area: gauge centrado con métricas a los lados
    const mainAreaStyles = {
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        gap: '20px',
        padding: '0 12px 16px',
        marginTop: '40px',
        flex: '0 0 auto',
        width: '100%',
    };

    const gaugeContainerStyles = {
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        position: 'relative',
        width: '240px',
        height: '240px',
        flex: '0 0 auto',
    };

    // Columna de métricas laterales (tamaño fijo)
    const sideMetricsStyles = {
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        gap: '12px',
        flex: '0 0 auto',
        minWidth: '100px',
    };

    const metricsGridStyles = {
        display: 'grid',
        gridTemplateColumns: '1fr 1fr 1fr',
        gap: '12px',
        padding: '0 8px',
        marginBottom: '8px',
        flexShrink: 0,
    };

    const resistancePanelStyles = {
        background: 'linear-gradient(180deg, #1a1a1a 0%, #111 100%)',
        borderTop: `1px solid ${colors.primary}30`,
        padding: '12px 20px max(40px, env(safe-area-inset-bottom))',
        borderRadius: '24px 24px 0 0',
        boxShadow: `0 -10px 40px rgba(0,0,0,0.6), inset 0 1px 0 ${colors.primary}20`,
        position: 'relative',
        zIndex: 20,
        flexShrink: 0,
    };
    
    // === Construir vista ===
    const container = div({ 
        styles: containerStyles,
        attrs: { 'data-view': 'training' }
    });
    
    // Añadir estilos responsive + modo paisaje (móvil en manillar) + animaciones
    const responsiveStyles = createElement('style', {
        text: `
            @keyframes fadeSlideUp {
                from { opacity: 0; transform: translateY(20px); }
                to { opacity: 1; transform: translateY(0); }
            }
            @keyframes fadeIn {
                from { opacity: 0; }
                to { opacity: 1; }
            }
            @keyframes scaleIn {
                from { opacity: 0; transform: scale(0.9); }
                to { opacity: 1; transform: scale(1); }
            }
            [data-view="training"] .timer-card {
                animation: fadeSlideUp 0.5s cubic-bezier(0.4, 0, 0.2, 1) forwards;
                opacity: 0;
            }
            [data-view="training"] .main-area {
                animation: fadeSlideUp 0.6s 0.1s cubic-bezier(0.4, 0, 0.2, 1) forwards;
                opacity: 0;
            }
            [data-view="training"] .distance-card {
                animation: fadeSlideUp 0.6s 0.2s cubic-bezier(0.4, 0, 0.2, 1) forwards;
                opacity: 0;
            }
            [data-view="training"] .resistance-panel {
                animation: fadeSlideUp 0.5s 0.3s cubic-bezier(0.4, 0, 0.2, 1) forwards;
                opacity: 0;
            }
            [data-view="training"] .resistance-handle {
                animation: fadeIn 0.4s 0.4s forwards;
                opacity: 0;
            }
            /* Métricas laterales */
            [data-view="training"] .side-metrics {
                display: flex !important;
                flex-direction: column !important;
                justify-content: center !important;
                align-items: center !important;
                gap: 12px;
                min-width: 100px;
            }
            [data-view="training"] .side-metrics > div {
                width: 100%;
                min-width: 100px;
                padding: 14px 12px !important;
            }
            /* Gauge container */
            [data-view="training"] .gauge-container {
                width: 240px !important;
                height: 240px !important;
                flex: 0 0 auto !important;
            }
            /* Métrica distancia */
            [data-view="training"] .distance-metric {
                margin: 0 16px 20px;
                animation: fadeSlideUp 0.6s 0.25s cubic-bezier(0.4, 0, 0.2, 1) forwards;
                opacity: 0;
            }
            /* Divider con gradiente de zona */
            [data-view="training"] .zone-divider {
                height: 2px;
                margin: 0 16px 16px;
                background: linear-gradient(90deg, transparent 0%, ${colors.primary}40 50%, transparent 100%);
                border-radius: 1px;
            }
            @media (max-width: 500px) {
                [data-view="training"] .main-area {
                    gap: 12px !important;
                    padding: 0 8px 12px !important;
                }
                [data-view="training"] .gauge-container {
                    width: 200px !important;
                    height: 200px !important;
                }
                [data-view="training"] .side-metrics {
                    min-width: 80px !important;
                }
                [data-view="training"] .side-metrics > div {
                    min-width: 80px !important;
                    padding: 12px 8px !important;
                }
            }
            @media (orientation: landscape) and (max-height: 500px) {
                [data-view="training"] .timer-card {
                    padding: 8px 16px !important;
                    margin: 12px 12px 8px !important;
                }
                [data-view="training"] .main-area {
                    gap: 12px !important;
                    padding: 0 8px 8px !important;
                }
                [data-view="training"] .gauge-container {
                    width: 180px !important;
                    height: 180px !important;
                }
            }
        `
    });
    document.head.appendChild(responsiveStyles);
    
    // === TIMER CARD (standalone con glass effect) ===
    const sessionTypeLabel = session.workoutName || 'Entreno Libre';
    const timerCard = div({
        styles: timerCardStyles,
        attrs: { class: 'timer-card' },
        children: [
            createElement('div', {
                text: sessionTypeLabel,
                styles: {
                    fontSize: '11px',
                    textTransform: 'uppercase',
                    letterSpacing: '1.5px',
                    color: colors.textMuted,
                    background: `${colors.primary}12`,
                    border: `1px solid ${colors.primary}25`,
                    padding: '4px 12px',
                    borderRadius: '20px',
                    fontWeight: 600,
                },
            }),
            createElement('div', {
                text: formatTime(session.elapsedTime || liveData.elapsedTime || 0),
                styles: {
                    fontFamily: "'SF Mono', 'Monaco', 'Inconsolata', monospace",
                    fontSize: '36px',
                    fontWeight: 700,
                    letterSpacing: '-1px',
                    color: colors.text,
                    textShadow: `0 0 25px ${colors.primary}35`,
                },
            }),
        ],
    });
    const timerEl = timerCard.querySelector('div:last-child');
    if (timerEl) updateRefs.timeValue = timerEl;

    // === ÁREA PRINCIPAL: gauge centrado con métricas a los lados ===
    const scrollContent = div({
        styles: scrollContentStyles,
        attrs: { class: 'training-scroll-content' },
        children: [],
    });
    // Spacer para empujar el contenido hacia abajo
    const topSpacer = div({
        styles: {
            height: '32px',
            flexShrink: 0,
            width: '100%',
        },
    });
    scrollContent.appendChild(topSpacer);
    scrollContent.appendChild(timerCard);

    // Card de FC (izquierda del gauge)
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

    // Card de Velocidad (derecha del gauge)
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

    // === GAUGE: circular centrado ===
    const powerGaugeElement = PowerGauge({
        power: liveData.power || 0,
        ftp: settings.ftp,
        maxPower: settings.ftp * 2,
        variant: 'training',
    });
    updateRefs.powerGauge = powerGaugeElement;
    const gaugeContainer = div({
        styles: gaugeContainerStyles,
        attrs: { class: 'gauge-container' },
        children: [powerGaugeElement],
    });
    updateRefs.powerGaugeContainer = gaugeContainer;

    // Columna izquierda (FC)
    const leftMetrics = div({
        styles: { ...sideMetricsStyles },
        attrs: { class: 'side-metrics' },
        children: [heartRateCard],
    });

    // Columna derecha (Velocidad)
    const rightMetrics = div({
        styles: { ...sideMetricsStyles },
        attrs: { class: 'side-metrics' },
        children: [speedCard],
    });

    // Main area con gauge centrado
    const mainArea = div({
        styles: mainAreaStyles,
        attrs: { class: 'main-area' },
        children: [leftMetrics, gaugeContainer, rightMetrics],
    });
    scrollContent.appendChild(mainArea);

    // Divider con gradiente de zona
    const zoneDivider = div({
        styles: {
            height: '2px',
            margin: '4px 16px',
            background: `linear-gradient(90deg, transparent 0%, ${currentZoneColor}50 50%, transparent 100%)`,
            borderRadius: '1px',
            flexShrink: 0,
        },
        attrs: { class: 'zone-divider' },
    });
    updateRefs.zoneDivider = zoneDivider;
    scrollContent.appendChild(zoneDivider);

    // Card de Distancia (más abajo, pleine largeur)
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
    distanceCard.classList.add('distance-card', 'distance-metric');

    const distanceWrapper = div({
        styles: {
            display: 'flex',
            justifyContent: 'center',
            flexShrink: 0,
            width: '100%',
            maxWidth: '520px',
            margin: '0 auto',
            padding: '0 16px',
        },
        children: [distanceCard],
    });
    updateRefs.metricsContainer = distanceWrapper;
    scrollContent.appendChild(distanceWrapper);

    container.appendChild(scrollContent);

    // === PANEL RESISTENCIA (bottom sheet, siempre visible abajo) ===
    // Mostramos el valor OBJETIVO seleccionado por el usuario, no el del dispositivo
    const resistanceValueSpan = createElement('span', {
        text: `${Math.round(targetResistance)}%`,
        styles: {
            fontFamily: "'Barlow', sans-serif",
            fontSize: '22px',
            fontWeight: 700,
            color: colors.primary,
            textShadow: `0 0 15px ${colors.primary}40`,
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

    // Crear SVGs directamente para evitar problemas con innerHTML
    const createPauseSVG = () => {
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.setAttribute('width', '18');
        svg.setAttribute('height', '18');
        svg.setAttribute('viewBox', '0 0 24 24');
        svg.style.fill = 'currentColor';
        const rect1 = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        rect1.setAttribute('x', '6');
        rect1.setAttribute('y', '4');
        rect1.setAttribute('width', '4');
        rect1.setAttribute('height', '16');
        const rect2 = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        rect2.setAttribute('x', '14');
        rect2.setAttribute('y', '4');
        rect2.setAttribute('width', '4');
        rect2.setAttribute('height', '16');
        svg.appendChild(rect1);
        svg.appendChild(rect2);
        return svg;
    };
    const createPlaySVG = () => {
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.setAttribute('width', '18');
        svg.setAttribute('height', '18');
        svg.setAttribute('viewBox', '0 0 24 24');
        svg.style.fill = 'currentColor';
        const polygon = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
        polygon.setAttribute('points', '5 3 19 12 5 21 5 3');
        svg.appendChild(polygon);
        return svg;
    };
    const createStopSVG = () => {
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.setAttribute('width', '18');
        svg.setAttribute('height', '18');
        svg.setAttribute('viewBox', '0 0 24 24');
        svg.style.fill = 'currentColor';
        const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        rect.setAttribute('x', '4');
        rect.setAttribute('y', '4');
        rect.setAttribute('width', '16');
        rect.setAttribute('height', '16');
        rect.setAttribute('rx', '2');
        svg.appendChild(rect);
        return svg;
    };
    const pausarBtnIconContainer = createElement('span', {
        styles: { display: 'inline-flex', alignItems: 'center', justifyContent: 'center' },
    });
    pausarBtnIconContainer.appendChild(session.isPaused ? createPlaySVG() : createPauseSVG());
    const pausarBtn = button({
        styles: {
            height: '48px',
            borderRadius: '12px',
            border: `1px solid ${colors.warning}40`,
            background: `${colors.warning}15`,
            color: colors.warning,
            fontWeight: 600,
            fontSize: '14px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            transition: 'all 0.2s ease',
            boxShadow: `0 0 15px ${colors.warning}20`,
        },
        children: [pausarBtnIconContainer, createElement('span', { text: session.isPaused ? 'Reanudar' : 'Pausar' })],
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
    updateRefs.pausarBtnIcon = pausarBtnIconContainer;

    const finalizarBtn = button({
        styles: {
            height: '48px',
            borderRadius: '12px',
            border: `1px solid ${colors.error}40`,
            background: `${colors.error}15`,
            color: colors.error,
            fontWeight: 600,
            fontSize: '14px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            transition: 'all 0.2s ease',
            boxShadow: `0 0 15px ${colors.error}20`,
        },
        children: [
            createElement('span', {
                styles: { display: 'inline-flex', alignItems: 'center', justifyContent: 'center' },
                children: [createStopSVG()],
            }),
            createElement('span', { text: 'Fin' })
        ],
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
            marginBottom: '12px',
        },
        children: [
            createElement('span', {
                text: 'Resistencia',
                styles: {
                    fontSize: '12px',
                    textTransform: 'uppercase',
                    letterSpacing: '1.5px',
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
            marginTop: '20px',
        },
        children: [pausarBtn, finalizarBtn],
    });

    const resistancePanel = div({
        styles: resistancePanelStyles,
        attrs: { class: 'resistance-control resistance-panel' },
        children: [
            div({
                styles: {
                    width: '40px',
                    height: '4px',
                    backgroundColor: 'rgba(255,255,255,0.2)',
                    borderRadius: '2px',
                    margin: '0 auto 16px',
                },
                attrs: { class: 'resistance-handle' },
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
