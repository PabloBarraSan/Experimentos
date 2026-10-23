/**
 * PrepareView — pantalla propia de preparación antes de pedalear.
 * Reúne lo que hace falta para empezar: resumen de la sesión, rodillo, pulsómetro y ajustes.
 */

import { colors } from '../utils/theme.js';
import { createElement, div, button, icon, formatTime } from '../utils/dom.js';
import { checkBluetoothSupport, CONNECTION_STATE } from '../bluetooth/scanner.js';
import { HR_CONNECTION_STATE } from '../bluetooth/heartRate.js';
import { navigateTo, subscribe } from '../app.js';
import { expandBlocks, BLOCK_TYPES } from '../workouts/model.js';
import { loadVisualSettings, saveVisualSettings } from '../expedition/visualSettings.js';
import { createWorkoutProfileFrame } from '../components/WorkoutProfile.js';
import './home.css';

const FRESH_MS = 3000;

// Último fallo de conexión por dispositivo. Sobrevive a los re-renders que provoca Bluetooth.
const connectMessages = { trainer: '', heart: '' };

function connectFailureMessage(error) {
    if (error?.name === 'NotFoundError') {
        return 'No se eligió ningún dispositivo. Si no se abrió el selector de Bluetooth, abre la app en Chrome o Edge.';
    }
    if (error?.name === 'SecurityError') return 'El navegador bloqueó Bluetooth. Pulsa de nuevo el botón (necesita un clic real) y comprueba que usas Chrome o Edge.';
    return error?.message || 'No se pudo conectar. Inténtalo de nuevo.';
}

function showConnectMessage(key, message) {
    connectMessages[key] = message;
    const el = document.querySelector(`[data-prep-msg="${key}"]`);
    if (el) {
        el.textContent = message || el.dataset.idle || '';
        el.dataset.quality = message ? 'stale' : '';
    }
}
const BUSY_STATES = [
    CONNECTION_STATE.SCANNING,
    CONNECTION_STATE.CONNECTING,
    CONNECTION_STATE.CONNECTING_GATT,
    CONNECTION_STATE.DISCOVERING_SERVICES,
    CONNECTION_STATE.SUBSCRIBING,
    CONNECTION_STATE.RECONNECTING,
];

function connectionMessage(connectionState) {
    switch (connectionState) {
        case CONNECTION_STATE.SCANNING: return 'Buscando…';
        case CONNECTION_STATE.CONNECTING:
        case CONNECTION_STATE.CONNECTING_GATT: return 'Conectando…';
        case CONNECTION_STATE.DISCOVERING_SERVICES: return 'Preparando…';
        case CONNECTION_STATE.SUBSCRIBING: return 'Configurando…';
        case CONNECTION_STATE.RECONNECTING: return 'Reconectando…';
        default: return 'Sin conectar';
    }
}

function hrConnectionMessage(connectionState) {
    switch (connectionState) {
        case HR_CONNECTION_STATE.SCANNING: return 'Buscando…';
        case HR_CONNECTION_STATE.CONNECTING: return 'Conectando…';
        case HR_CONNECTION_STATE.RECONNECTING: return 'Reconectando…';
        default: return 'Sin conectar';
    }
}

function liveStat(label, key) {
    const value = createElement('strong', { text: '—', attrs: { 'data-prep-stat': key } });
    return { value, element: div({ attrs: { class: '' }, children: [createElement('span', { text: label }), value] }) };
}

function configField(label, options, selected, onChange) {
    const select = createElement('select', {
        attrs: { 'aria-label': label },
        children: options.map(([value, text]) => createElement('option', { text, attrs: { value, selected: value === selected } })),
        events: { change: () => onChange(select.value) },
    });
    return div({ attrs: { class: 'hp-field' }, children: [createElement('span', { text: label }), select] });
}

export function PrepareView(state) {
    const isFreeTraining = state.prepareTarget === 'training';
    const workout = state.selectedWorkout;
    const mission = workout?.mission || {};
    const bluetoothSupport = checkBluetoothSupport();
    const connectionState = state.connectionState || CONNECTION_STATE.DISCONNECTED;
    const hrState = state.hrConnectionState || HR_CONNECTION_STATE.DISCONNECTED;
    const isConnected = connectionState === CONNECTION_STATE.CONNECTED;
    const isHRConnected = hrState === HR_CONNECTION_STATE.CONNECTED;
    const trainerBusy = BUSY_STATES.includes(connectionState);
    const hrBusy = [HR_CONNECTION_STATE.SCANNING, HR_CONNECTION_STATE.CONNECTING, HR_CONNECTION_STATE.RECONNECTING].includes(hrState);

    const totalDuration = Math.max(1, workout?.stats?.totalDuration || 1);
    const recoveredSession = state.recoveredSession;
    const recoveredElapsed = Number(recoveredSession?.elapsedTime || recoveredSession?.duration) || 0;
    const canResume = !isFreeTraining
        && recoveredSession?.workoutId === workout?.id
        && recoveredElapsed > 1
        && recoveredElapsed < totalDuration - 2;

    // "Conectar" abre siempre el selector de Bluetooth dentro del clic (el navegador lo exige).
    // Reconectar en silencio al último rodillo es una acción aparte: puede tardar y gastar el gesto del usuario.
    const connectTrainer = async ({ silent = false } = {}) => {
        if (!bluetoothSupport.supported || trainerBusy || !state.bluetoothManager) return;
        showConnectMessage('trainer', '');
        try {
            if (silent) {
                const connected = await state.bluetoothManager.reconnectSilently();
                if (!connected) showConnectMessage('trainer', 'No se encontró el rodillo guardado. Pulsa Conectar para elegirlo.');
                return;
            }
            if (isConnected) state.bluetoothManager.disconnect();
            await state.bluetoothManager.scan();
            navigator.vibrate?.([45, 25, 45]);
        } catch (error) {
            console.warn('No se pudo conectar el rodillo:', error.message);
            showConnectMessage('trainer', connectFailureMessage(error));
        }
    };

    const toggleHeartRate = async () => {
        if (hrBusy) return;
        if (isHRConnected) {
            state.heartRateManager?.disconnect();
            return;
        }
        try {
            await state.heartRateManager?.scan();
            navigator.vibrate?.(35);
            showConnectMessage('heart', '');
        } catch (error) {
            console.warn('No se pudo conectar el pulso:', error.message);
            showConnectMessage('heart', connectFailureMessage(error));
        }
    };

    // --- Ajustes (se guardan al cambiar; ExpeditionView los lee al arrancar) ---
    const settings = loadVisualSettings();
    const setSetting = (key, value) => {
        settings[key] = value;
        saveVisualSettings(settings);
    };
    const settingsFields = div({
        attrs: { class: 'hp-fields' },
        children: [
            configField('Cámara', [['close', 'Cercana'], ['standard', 'Dinámica'], ['wide', 'Panorámica']], settings.camera, (v) => setSetting('camera', v)),
            configField('Datos en pantalla', [['essential', 'Esenciales'], ['full', 'Completos'], ['hidden', 'Inmersivo']], settings.hud, (v) => setSetting('hud', v)),
            configField('Calidad gráfica', [['auto', 'Automática'], ['low', 'Baja'], ['medium', 'Equilibrada'], ['high', 'Alta']], settings.quality, (v) => setSetting('quality', v)),
            configField('Pelotón', [['on', 'Con rivales'], ['off', 'En solitario']], settings.rivals === false ? 'off' : 'on', (v) => setSetting('rivals', v !== 'off')),
        ],
    });

    // --- Arranque ---
    const launch = (options = {}) => {
        if (isFreeTraining) {
            navigateTo('training');
            return;
        }
        state.expeditionLaunch = options;
        if (!options.resume) state.recoveredSession = null;
        navigateTo('expedition');
    };

    let firstIntervalStart = 0;
    const firstInterval = isFreeTraining ? null : expandBlocks(workout?.blocks || []).find((block) => {
        if (block.type === BLOCK_TYPES.INTERVAL) return true;
        firstIntervalStart += block.duration;
        return false;
    });
    const canSkipToSeries = Boolean(firstInterval) && firstIntervalStart >= 30;

    // --- Cabecera / resumen ---
    const title = isFreeTraining ? 'Entrenamiento libre' : (workout?.name || 'Expedición');
    const stats = workout?.stats || {};
    const summary = div({
        attrs: { class: 'hp-card hp-card-pad hp-hero' },
        children: [
            div({ children: [
                createElement('span', { text: isFreeTraining ? 'Control manual' : 'Preparar sesión', attrs: { class: 'hp-hero-state' } }),
                createElement('h1', { text: title, attrs: { class: 'hp-prep-title' } }),
                isFreeTraining
                    ? createElement('p', { text: 'Ajusta resistencia y zonas a mano con tu rodillo.', attrs: { class: 'hp-lede' } })
                    : createElement('p', { text: `${mission.terrain || 'Ruta mixta'} · ${mission.objective || 'Completar la sesión'}`, attrs: { class: 'hp-lede' } }),
            ] }),
            isFreeTraining ? null : div({
                attrs: { class: 'hp-stats' },
                children: [
                    [formatTime(stats.totalDuration || 0), 'Duración'],
                    [String(stats.tss ?? '—'), 'Carga (TSS)'],
                    [String(stats.intensityFactor ?? '—'), 'Intensidad (IF)'],
                ].map(([value, label]) => div({ attrs: { class: 'hp-stat' }, children: [createElement('strong', { text: value }), createElement('span', { text: label })] })),
            }),
            isFreeTraining ? null : createWorkoutProfileFrame(workout, { height: 210 }),
            isFreeTraining ? null : div({ children: [button({
                text: 'Elegir otro entreno',
                attrs: { type: 'button', class: 'hp-link' },
                events: { click: () => navigateTo('workouts') },
            })] }),
        ],
    });

    // --- Dispositivos ---
    const trainerPower = liveStat('Potencia', 'power');
    const trainerCadence = liveStat('Cadencia', 'cadence');
    const trainerStatus = createElement('span', { attrs: { class: 'hp-status', 'data-prep-trainer-status': 'true' } });
    const idleTrainerText = bluetoothSupport.supported ? connectionMessage(connectionState) : 'Bluetooth no disponible en este navegador';
    const trainerCard = div({
        attrs: { class: `hp-card hp-device${isConnected ? ' is-connected' : ''}` },
        children: [
            div({ attrs: { class: 'hp-device-head' }, children: [
                div({ attrs: { class: 'hp-device-icon' }, children: [icon('bike', 20, isConnected ? colors.accent : 'rgba(255,255,255,.5)')] }),
                div({ attrs: { class: 'hp-device-title' }, children: [
                    createElement('strong', { text: isConnected ? (state.deviceName || 'Rodillo inteligente') : 'Rodillo inteligente' }),
                    isConnected ? trainerStatus : createElement('span', {
                        text: connectMessages.trainer || idleTrainerText,
                        attrs: { class: 'hp-status', 'data-prep-msg': 'trainer', 'data-idle': idleTrainerText, ...(connectMessages.trainer ? { 'data-quality': 'stale' } : {}) },
                    }),
                ] }),
                isConnected
                    ? button({ text: 'Cambiar', attrs: { type: 'button', class: 'hp-btn' }, events: { click: () => connectTrainer() } })
                    : (bluetoothSupport.supported
                        ? button({
                            text: trainerBusy ? connectionMessage(connectionState) : 'Conectar',
                            attrs: { type: 'button', class: 'hp-btn hp-btn--ember', 'aria-busy': trainerBusy ? 'true' : 'false' },
                            styles: { opacity: trainerBusy ? .6 : 1, cursor: trainerBusy ? 'wait' : 'pointer' },
                            events: { click: () => connectTrainer() },
                        })
                        : null),
            ] }),
            isConnected ? div({ attrs: { class: 'hp-live' }, children: [trainerPower.element, trainerCadence.element] }) : null,
            !isConnected && state.bluetoothManager?.cachedDevice && !trainerBusy ? button({
                text: `Reconectar ${state.bluetoothManager.cachedDevice.name || 'último rodillo'}`,
                attrs: { type: 'button', class: 'hp-link' },
                events: { click: () => connectTrainer({ silent: true }) },
            }) : null,
        ],
    });

    const heartValue = liveStat('Pulso', 'heart');
    const idleHeartText = `Opcional · ${hrConnectionMessage(hrState)}`;
    const heartCard = div({
        attrs: { class: `hp-card hp-device${isHRConnected ? ' is-connected' : ''}` },
        children: [
            div({ attrs: { class: 'hp-device-head' }, children: [
                div({ attrs: { class: 'hp-device-icon' }, children: [icon('heart', 20, isHRConnected ? '#ff607b' : 'rgba(255,255,255,.5)')] }),
                div({ attrs: { class: 'hp-device-title' }, children: [
                    createElement('strong', { text: isHRConnected ? (state.hrDeviceName || 'Pulsómetro') : 'Pulsómetro' }),
                    createElement('span', {
                        text: isHRConnected ? 'Conectado' : (connectMessages.heart || idleHeartText),
                        attrs: { class: 'hp-status', 'data-prep-msg': 'heart', 'data-idle': idleHeartText, ...(!isHRConnected && connectMessages.heart ? { 'data-quality': 'stale' } : {}) },
                    }),
                ] }),
                button({
                    text: isHRConnected ? 'Desconectar' : (hrBusy ? hrConnectionMessage(hrState) : 'Conectar'),
                    attrs: { type: 'button', class: 'hp-btn', 'aria-busy': hrBusy ? 'true' : 'false' },
                    styles: { opacity: hrBusy ? .6 : 1, cursor: hrBusy ? 'wait' : 'pointer' },
                    events: { click: toggleHeartRate },
                }),
            ] }),
            isHRConnected ? div({ attrs: { class: 'hp-live' }, children: [heartValue.element] }) : null,
        ],
    });

    // --- Acción principal ---
    const ctaLabel = createElement('span');
    const cta = button({
        attrs: { type: 'button', class: 'hp-btn hp-btn--primary', 'data-prep-cta': 'true' },
        children: [icon('play', 18, '#1d0d05'), ctaLabel],
    });
    const ctaTitle = createElement('strong');
    const ctaHint = createElement('p');
    const forceStart = button({
        text: 'Empezar de todos modos',
        attrs: { type: 'button', class: 'hp-link' },
        styles: { display: 'none' },
        events: { click: () => launch({ resume: false }) },
    });
    const resumeButton = canResume ? button({
        text: `Continuar · quedan ${formatTime(totalDuration - recoveredElapsed)}`,
        attrs: { type: 'button', class: 'hp-btn hp-btn--ready' },
        events: { click: () => launch({ resume: true }) },
    }) : null;
    const seriesButton = canSkipToSeries ? button({
        text: 'Empezar 30 s antes de la primera serie',
        attrs: { type: 'button', class: 'hp-link' },
        events: { click: () => launch({ resume: false, startAtSeconds: firstIntervalStart - 30 }) },
    }) : null;

    const wrapper = div({ attrs: { 'data-view': 'prepare', class: 'hp' } });
    const shell = div({ attrs: { class: 'hp-shell' } });
    wrapper.appendChild(shell);

    const settingsCard = createElement('details', {
        attrs: { class: 'hp-card hp-card-pad hp-settings' },
        children: [
            createElement('summary', { children: [
                createElement('span', { text: isFreeTraining ? 'Ajustes' : 'Ajustes de la sesión', styles: { display: 'inline', margin: 0, color: 'inherit', fontSize: 'inherit', fontWeight: 'inherit' } }),
                createElement('span', { text: 'Cámara, datos en pantalla, calidad gráfica y pelotón' }),
            ] }),
            settingsFields,
        ],
    });

    shell.append(
        div({ attrs: { class: 'hp-topbar' }, children: [
            button({
                attrs: { type: 'button', class: 'hp-btn hp-back', 'aria-label': 'Volver al inicio' },
                children: [icon('chevronLeft', 16, 'rgba(238,243,239,.8)'), createElement('span', { text: 'Inicio' })],
                events: { click: () => navigateTo('home') },
            }),
        ] }),
        div({ attrs: { class: 'hp-prep-grid' }, children: [
            summary,
            div({ attrs: { class: 'hp-side' }, children: [
                createElement('h2', { text: 'Equipo' }),
                trainerCard,
                heartCard,
                settingsCard,
            ] }),
        ] }),
        div({ attrs: { class: 'hp-actionbar' }, children: [
            div({ attrs: { class: 'hp-actionbar-copy' }, children: [ctaTitle, ctaHint] }),
            div({ attrs: { class: 'hp-actionbar-buttons' }, children: [seriesButton, forceStart, resumeButton, cta] }),
        ] }),
    );
    if (isFreeTraining) settingsCard.style.display = 'none';

    let ready = false;
    cta.addEventListener('click', () => {
        if (isConnected && !ready) return;
        launch({ resume: false });
    });

    const updateLive = () => {
        const now = Date.now();
        const trainerAge = state.lastDataUpdateTimestamp ? now - state.lastDataUpdateTimestamp : Infinity;
        const hrAge = state.lastHeartRateUpdateTimestamp ? now - state.lastHeartRateUpdateTimestamp : Infinity;
        const trainerFresh = isConnected && trainerAge <= FRESH_MS;
        const hrFresh = isHRConnected && hrAge <= 5000;
        ready = trainerFresh;

        trainerStatus.textContent = trainerFresh ? 'Datos en vivo' : (trainerAge <= 10000 ? 'Lectura lenta' : 'Esperando datos…');
        trainerStatus.dataset.quality = trainerFresh ? 'fresh' : 'stale';
        trainerPower.value.textContent = trainerFresh ? `${Math.round(state.liveData.power || 0)} W` : '—';
        trainerCadence.value.textContent = trainerFresh ? `${Math.round(state.liveData.cadence || 0)} rpm` : '—';
        heartValue.value.textContent = hrFresh ? `${Math.round(state.liveData.heartRate || 0)} ppm` : '—';

        const waiting = isConnected && !trainerFresh;
        const needsTrainer = isFreeTraining && !isConnected;
        cta.disabled = waiting || needsTrainer;
        cta.dataset.state = waiting ? 'waiting' : (isConnected ? 'ready' : 'demo');
        ctaLabel.textContent = waiting
            ? 'Esperando datos del rodillo…'
            : (isFreeTraining ? 'Empezar entrenamiento' : (isConnected ? 'Empezar expedición' : (needsTrainer ? 'Conecta el rodillo' : 'Probar en modo demo')));
        ctaHint.textContent = waiting
            ? 'Pedalea unos segundos para despertar el rodillo.'
            : (isConnected
                ? 'Todo listo. Sigue al guía y mantén la potencia objetivo.'
                : (isFreeTraining
                    ? 'El entrenamiento libre necesita un rodillo conectado.'
                    : 'Sin rodillo no hay resistencia real: la demo simula tu potencia.'));
        ctaTitle.textContent = waiting
            ? 'Esperando datos del rodillo'
            : (isConnected ? 'Todo listo' : (needsTrainer ? 'Falta el rodillo' : 'Modo demo'));
        ctaTitle.style.color = isConnected && !waiting ? '#8ee9d0' : '';
        forceStart.style.display = waiting && !isFreeTraining ? 'inline-block' : 'none';
    };
    updateLive();
    const unsubscribe = subscribe(updateLive);
    const timer = window.setInterval(updateLive, 1000);
    wrapper.cleanup = () => {
        unsubscribe();
        window.clearInterval(timer);
    };
    return wrapper;
}
