/**
 * TrainingView - cockpit de entrenamiento libre
 * Smart Trainer Controller
 */

import './training.css';
import { getZoneColor, getZoneName } from '../utils/theme.js';
import { createElement, div, button, formatTime, formatDistance } from '../utils/dom.js';
import { ResistanceSlider } from '../components/ResistanceSlider.js';
import { showSaveSessionDialog } from '../components/SaveSessionDialog.js';
import { navigateTo, subscribe, updateState, AppState } from '../app.js';
import { createSession, finishSession } from '../storage/sessions.js';
import { flushSyncOutbox } from '../sync/TrainingAppSync.js';
import { calculateSessionMetrics } from '../utils/calculations.js';

const STALE_AFTER_MS = 3000;
const POWER_SMOOTHING_MS = 3000;

function createMetricTile({ key, label, value, unit, unavailable = false }) {
    return div({
        attrs: {
            class: `cockpit-metric cockpit-metric--${key}${unavailable ? ' is-unavailable' : ''}`,
            'data-metric': key,
        },
        children: [
            createElement('span', {
                attrs: { class: 'cockpit-metric__label' },
                text: label,
            }),
            div({
                attrs: { class: 'cockpit-metric__reading' },
                children: [
                    createElement('span', {
                        attrs: { class: 'cockpit-metric__value' },
                        text: String(value),
                    }),
                    createElement('span', {
                        attrs: { class: 'cockpit-metric__unit' },
                        text: unit,
                    }),
                ],
            }),
        ],
    });
}

function createControlIcon(type) {
    const svgNS = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(svgNS, 'svg');
    svg.setAttribute('width', '18');
    svg.setAttribute('height', '18');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('aria-hidden', 'true');
    svg.style.fill = 'currentColor';

    if (type === 'play') {
        const polygon = document.createElementNS(svgNS, 'polygon');
        polygon.setAttribute('points', '5 3 19 12 5 21');
        svg.appendChild(polygon);
        return svg;
    }

    if (type === 'stop') {
        const rect = document.createElementNS(svgNS, 'rect');
        rect.setAttribute('x', '5');
        rect.setAttribute('y', '5');
        rect.setAttribute('width', '14');
        rect.setAttribute('height', '14');
        rect.setAttribute('rx', '2');
        svg.appendChild(rect);
        return svg;
    }

    [6, 14].forEach((x) => {
        const rect = document.createElementNS(svgNS, 'rect');
        rect.setAttribute('x', String(x));
        rect.setAttribute('y', '4');
        rect.setAttribute('width', '4');
        rect.setAttribute('height', '16');
        svg.appendChild(rect);
    });
    return svg;
}

function resetSessionState() {
    return {
        isActive: false,
        isPaused: false,
        startTime: null,
        elapsedTime: 0,
        dataPoints: [],
        accumulatedDistance: 0,
        pauseDuration: 0,
        pausedAt: null,
    };
}

export function TrainingView(state) {
    const { liveData, session, settings, bluetoothManager } = state;
    let targetResistance = liveData.resistance || 50;
    let resistanceFeedbackTimer = null;

    const refs = {
        timeValue: null,
        connectionStatus: null,
        powerValue: null,
        ftpValue: null,
        zoneName: null,
        powerPanel: null,
        powerProgress: null,
        cadenceValue: null,
        cadenceTile: null,
        heartRateValue: null,
        heartRateTile: null,
        speedValue: null,
        distanceValue: null,
        resistanceValue: null,
        resistanceFeedback: null,
        pauseButton: null,
        pauseIcon: null,
        pauseLabel: null,
        smoothBuffer: [],
    };

    const setResistanceFeedback = (message, tone = 'neutral') => {
        if (!refs.resistanceFeedback) return;
        refs.resistanceFeedback.textContent = message;
        refs.resistanceFeedback.dataset.tone = tone;
        if (resistanceFeedbackTimer) clearTimeout(resistanceFeedbackTimer);
        if (tone === 'success') {
            resistanceFeedbackTimer = setTimeout(() => {
                if (refs.resistanceFeedback) {
                    refs.resistanceFeedback.textContent = 'Objetivo';
                    refs.resistanceFeedback.dataset.tone = 'neutral';
                }
            }, 1800);
        }
    };

    const resolveDistance = (nextState) => {
        const distanceSupported = nextState.deviceCapabilities?.totalDistanceSupported !== false;
        const reportedDistance = nextState.liveData.distance;
        if (
            (reportedDistance === undefined || reportedDistance === null || !distanceSupported)
            && nextState.session.accumulatedDistance !== undefined
        ) {
            return nextState.session.accumulatedDistance;
        }
        return reportedDistance;
    };

    const updateMetrics = (nextState) => {
        const now = Date.now();
        const nextLiveData = nextState.liveData;
        const nextSession = nextState.session;
        const nextSettings = nextState.settings;

        refs.smoothBuffer.push({ timestamp: now, power: Number(nextLiveData.power) || 0 });
        while (refs.smoothBuffer.length && refs.smoothBuffer[0].timestamp < now - POWER_SMOOTHING_MS) {
            refs.smoothBuffer.shift();
        }
        const smoothedPower = refs.smoothBuffer.length
            ? Math.round(refs.smoothBuffer.reduce((sum, entry) => sum + entry.power, 0) / refs.smoothBuffer.length)
            : 0;

        let elapsedTime = nextSession.elapsedTime || 0;
        if (nextSession.isActive && nextSession.startTime) {
            const currentPauseMs = nextSession.pausedAt ? now - nextSession.pausedAt : 0;
            elapsedTime = Math.max(0, Math.floor(
                (now - nextSession.startTime - (nextSession.pauseDuration || 0) - currentPauseMs) / 1000
            ));
        }

        const zoneColor = getZoneColor(smoothedPower, nextSettings.ftp);
        const zoneName = getZoneName(smoothedPower, nextSettings.ftp);
        const ftpPercentage = nextSettings.ftp > 0 ? Math.round((smoothedPower / nextSettings.ftp) * 100) : 0;
        const powerProgress = Math.min(100, nextSettings.ftp > 0
            ? (smoothedPower / (nextSettings.ftp * 2)) * 100
            : 0);

        refs.timeValue.textContent = formatTime(elapsedTime);
        refs.powerValue.textContent = String(smoothedPower);
        refs.ftpValue.textContent = `${ftpPercentage}% FTP`;
        refs.zoneName.textContent = zoneName;
        refs.powerPanel.style.setProperty('--zone-color', zoneColor);
        refs.powerProgress.style.width = `${powerProgress}%`;

        const cadenceAvailable = Number(nextLiveData.cadence) > 0;
        refs.cadenceValue.textContent = cadenceAvailable ? String(Math.round(nextLiveData.cadence)) : '—';
        refs.cadenceTile.classList.toggle('is-unavailable', !cadenceAvailable);

        const heartRateAvailable = Number(nextLiveData.heartRate) > 0;
        refs.heartRateValue.textContent = heartRateAvailable ? String(Math.round(nextLiveData.heartRate)) : '—';
        refs.heartRateTile.classList.toggle('is-unavailable', !heartRateAvailable);

        refs.speedValue.textContent = Number(nextLiveData.speed || 0).toFixed(1);
        const distance = resolveDistance(nextState);
        refs.distanceValue.textContent = distance === undefined || distance === null
            ? '—'
            : formatDistance(distance);

        const isStale = Boolean(
            nextState.lastDataUpdateTimestamp
            && now - nextState.lastDataUpdateTimestamp > STALE_AFTER_MS
        );
        const statusText = nextSession.isPaused
            ? 'En pausa'
            : isStale
                ? 'Sin datos'
                : 'Conectado';
        refs.connectionStatus.textContent = statusText;
        refs.connectionStatus.dataset.status = nextSession.isPaused ? 'paused' : isStale ? 'stale' : 'live';

        refs.pauseButton.classList.toggle('is-resume', Boolean(nextSession.isPaused));
        refs.pauseButton.setAttribute('aria-label', nextSession.isPaused ? 'Reanudar entrenamiento' : 'Pausar entrenamiento');
        refs.pauseLabel.textContent = nextSession.isPaused ? 'Reanudar' : 'Pausar';
        refs.pauseIcon.replaceChildren(createControlIcon(nextSession.isPaused ? 'play' : 'pause'));
    };

    const container = div({
        attrs: {
            class: 'training-cockpit',
            'data-view': 'training',
        },
    });

    const sessionLabel = session.workoutName || 'Entrenamiento libre';
    refs.connectionStatus = createElement('span', {
        attrs: {
            class: 'cockpit-status',
            'data-status': session.isPaused ? 'paused' : 'live',
        },
        text: session.isPaused ? 'En pausa' : 'Conectado',
    });
    refs.timeValue = createElement('time', {
        attrs: {
            class: 'cockpit-time',
            'aria-label': 'Tiempo transcurrido',
        },
        text: formatTime(session.elapsedTime || 0),
    });

    const header = createElement('header', {
        attrs: { class: 'cockpit-header' },
        children: [
            div({
                attrs: { class: 'cockpit-heading' },
                children: [
                    createElement('p', { attrs: { class: 'cockpit-eyebrow' }, text: 'Sesión' }),
                    createElement('h1', { attrs: { class: 'cockpit-title' }, text: sessionLabel }),
                ],
            }),
            div({
                attrs: { class: 'cockpit-header__status' },
                children: [refs.connectionStatus, refs.timeValue],
            }),
        ],
    });

    refs.powerValue = createElement('span', {
        attrs: { class: 'power-reading__value', 'aria-label': 'Potencia a tres segundos' },
        text: String(Math.round(liveData.power || 0)),
    });
    refs.ftpValue = createElement('span', {
        attrs: { class: 'power-reading__ftp' },
        text: `${settings.ftp ? Math.round(((liveData.power || 0) / settings.ftp) * 100) : 0}% FTP`,
    });
    refs.zoneName = createElement('span', {
        attrs: { class: 'power-reading__zone' },
        text: getZoneName(liveData.power || 0, settings.ftp),
    });
    refs.powerProgress = div({ attrs: { class: 'power-progress__fill' } });

    refs.powerPanel = createElement('section', {
        attrs: {
            class: 'power-panel',
            'aria-label': 'Potencia actual',
        },
        children: [
            div({
                attrs: { class: 'power-panel__topline' },
                children: [
                    createElement('span', { text: 'Potencia 3 s' }),
                    refs.ftpValue,
                ],
            }),
            div({
                attrs: { class: 'power-reading' },
                children: [
                    refs.powerValue,
                    createElement('span', { attrs: { class: 'power-reading__unit' }, text: 'W' }),
                ],
            }),
            refs.zoneName,
            div({
                attrs: { class: 'power-progress', 'aria-hidden': 'true' },
                children: [refs.powerProgress],
            }),
        ],
    });
    refs.powerPanel.style.setProperty('--zone-color', getZoneColor(liveData.power || 0, settings.ftp));

    const cadenceTile = createMetricTile({
        key: 'cadence',
        label: 'Cadencia',
        value: Number(liveData.cadence) > 0 ? Math.round(liveData.cadence) : '—',
        unit: 'rpm',
        unavailable: !(Number(liveData.cadence) > 0),
    });
    refs.cadenceTile = cadenceTile;
    refs.cadenceValue = cadenceTile.querySelector('.cockpit-metric__value');

    const heartRateTile = createMetricTile({
        key: 'heart-rate',
        label: 'Pulso',
        value: Number(liveData.heartRate) > 0 ? Math.round(liveData.heartRate) : '—',
        unit: 'bpm',
        unavailable: !(Number(liveData.heartRate) > 0),
    });
    refs.heartRateTile = heartRateTile;
    refs.heartRateValue = heartRateTile.querySelector('.cockpit-metric__value');

    const speedTile = createMetricTile({
        key: 'speed',
        label: 'Velocidad',
        value: Number(liveData.speed || 0).toFixed(1),
        unit: 'km/h',
    });
    refs.speedValue = speedTile.querySelector('.cockpit-metric__value');

    const initialDistance = resolveDistance(state);
    const distanceTile = createMetricTile({
        key: 'distance',
        label: 'Distancia',
        value: initialDistance === undefined || initialDistance === null ? '—' : formatDistance(initialDistance),
        unit: '',
    });
    refs.distanceValue = distanceTile.querySelector('.cockpit-metric__value');

    const main = createElement('main', {
        attrs: { class: 'cockpit-main' },
        children: [
            refs.powerPanel,
            createElement('section', {
                attrs: {
                    class: 'cockpit-metrics',
                    'aria-label': 'Métricas de entrenamiento',
                },
                children: [cadenceTile, heartRateTile, speedTile, distanceTile],
            }),
        ],
    });

    refs.resistanceValue = createElement('span', {
        attrs: { class: 'resistance-value' },
        text: `${Math.round(targetResistance)}%`,
    });
    refs.resistanceFeedback = createElement('span', {
        attrs: {
            class: 'resistance-feedback',
            'data-tone': 'neutral',
            'aria-live': 'polite',
        },
        text: 'Objetivo',
    });

    const sliderEl = ResistanceSlider({
        value: targetResistance,
        minimal: true,
        variant: 'cockpit',
        ariaLabel: 'Resistencia objetivo',
        onChange: async (value) => {
            targetResistance = value;
            refs.resistanceValue.textContent = `${Math.round(value)}%`;
            setResistanceFeedback('Aplicando…', 'pending');
            try {
                await bluetoothManager.setResistance(value);
                const grade = -6 + (value / 100) * 12;
                if (bluetoothManager.commandQueue) {
                    bluetoothManager.commandQueue.setIndoorBikeSimulation(0, grade, 0.004, 0.51)
                        .catch(() => {});
                }
                setResistanceFeedback('Aplicada', 'success');
            } catch (error) {
                console.error('Error al cambiar resistencia:', error);
                setResistanceFeedback('No aplicada', 'error');
            }
        },
    });

    refs.pauseIcon = createElement('span', { attrs: { class: 'cockpit-action__icon' } });
    refs.pauseIcon.appendChild(createControlIcon(session.isPaused ? 'play' : 'pause'));
    refs.pauseLabel = createElement('span', { text: session.isPaused ? 'Reanudar' : 'Pausar' });
    refs.pauseButton = button({
        attrs: {
            class: `cockpit-action cockpit-action--pause${session.isPaused ? ' is-resume' : ''}`,
            type: 'button',
            'aria-label': session.isPaused ? 'Reanudar entrenamiento' : 'Pausar entrenamiento',
        },
        children: [refs.pauseIcon, refs.pauseLabel],
        events: {
            click: async () => {
                refs.pauseButton.disabled = true;
                try {
                    if (AppState.session.isPaused) {
                        await bluetoothManager.startTraining();
                        const pauseDuration = (AppState.session.pauseDuration || 0)
                            + (Date.now() - (AppState.session.pausedAt || Date.now()));
                        updateState({
                            session: {
                                ...AppState.session,
                                isPaused: false,
                                pauseDuration,
                                pausedAt: null,
                            },
                        });
                    } else {
                        await bluetoothManager.stopTraining();
                        updateState({
                            session: {
                                ...AppState.session,
                                isPaused: true,
                                pausedAt: Date.now(),
                            },
                        });
                    }
                } catch (error) {
                    console.error('Error al cambiar el estado del entrenamiento:', error);
                    setResistanceFeedback('Error de control', 'error');
                } finally {
                    refs.pauseButton.disabled = false;
                }
            },
        },
    });

    const finishButton = button({
        attrs: {
            class: 'cockpit-action cockpit-action--finish',
            type: 'button',
            'aria-label': 'Finalizar entrenamiento',
        },
        children: [
            createElement('span', {
                attrs: { class: 'cockpit-action__icon' },
                children: [createControlIcon('stop')],
            }),
            createElement('span', { text: 'Finalizar' }),
        ],
        events: {
            click: async () => {
                const duration = AppState.session.elapsedTime ?? 0;
                if (duration < 60) {
                    updateState({ session: resetSessionState() });
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
                        flushSyncOutbox().catch(() => {});
                    } catch (error) {
                        console.error('Error guardando sesión:', error);
                        alert('Error al guardar la sesión. Los datos no se han perdido.');
                    }
                }

                updateState({ session: resetSessionState() });
                navigateTo('home');
            },
        },
    });

    const controls = createElement('footer', {
        attrs: { class: 'control-dock' },
        children: [
            div({
                attrs: { class: 'resistance-control' },
                children: [
                    div({
                        attrs: { class: 'resistance-heading' },
                        children: [
                            div({
                                children: [
                                    createElement('span', {
                                        attrs: { class: 'resistance-label' },
                                        text: 'Resistencia',
                                    }),
                                    refs.resistanceFeedback,
                                ],
                            }),
                            refs.resistanceValue,
                        ],
                    }),
                    sliderEl,
                ],
            }),
            div({
                attrs: { class: 'cockpit-actions' },
                children: [refs.pauseButton, finishButton],
            }),
        ],
    });

    container.append(header, main, controls);

    const unsubscribe = subscribe((nextState) => {
        if (nextState.currentView === 'training') updateMetrics(nextState);
    });
    const statusInterval = setInterval(() => {
        if (AppState.currentView === 'training') updateMetrics(AppState);
    }, 1000);
    updateMetrics(state);

    container.cleanup = () => {
        unsubscribe?.();
        clearInterval(statusInterval);
        if (resistanceFeedbackTimer) clearTimeout(resistanceFeedbackTimer);
    };

    return container;
}
