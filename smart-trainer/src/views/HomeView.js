/**
 * HomeView — hub compacto de Smart Trainer Expeditions.
 * La portada prioriza una sola decisión: empezar la próxima expedición.
 */

import { colors, typography } from '../utils/theme.js';
import { createElement, div, button, icon } from '../utils/dom.js';
import { checkBluetoothSupport, CONNECTION_STATE } from '../bluetooth/scanner.js';
import { HR_CONNECTION_STATE } from '../bluetooth/heartRate.js';
import { navigateToGame, navigateTo, navigateToRide, subscribe } from '../app.js';
import { WORKOUT_PRESETS } from '../workouts/presets.js';

const glassBorder = 'rgba(255,255,255,.1)';

function textButton(label, onClick, attrs = {}) {
    return button({
        text: label,
        attrs: { type: 'button', ...attrs },
        styles: {
            border: 0,
            background: 'transparent',
            color: 'rgba(255,255,255,.68)',
            padding: '9px 10px',
            borderRadius: '10px',
            fontFamily: typography.fontFamily,
            fontSize: '13px',
            fontWeight: 700,
            cursor: 'pointer',
        },
        events: { click: onClick },
    });
}

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
        default: return 'Opcional';
    }
}

function compactSensor({ iconName, label, value, accent, connected, busy, onClick, sensorKey }) {
    return button({
        attrs: {
            type: 'button',
            'aria-label': `${label}: ${value}`,
            'aria-busy': busy ? 'true' : 'false',
        },
        className: 'home-sensor',
        styles: {
            border: `1px solid ${connected ? `${accent}70` : glassBorder}`,
            background: connected ? `${accent}12` : 'rgba(255,255,255,.035)',
            color: '#fff',
            cursor: busy ? 'wait' : 'pointer',
            opacity: busy ? .75 : 1,
        },
        events: { click: () => { if (!busy) onClick(); } },
        children: [
            div({
                styles: {
                    width: '32px',
                    height: '32px',
                    borderRadius: '10px',
                    display: 'grid',
                    placeItems: 'center',
                    background: connected ? `${accent}1f` : 'rgba(255,255,255,.05)',
                    flexShrink: 0,
                },
                children: [icon(iconName, 17, connected ? accent : 'rgba(255,255,255,.48)')],
            }),
            div({
                styles: { minWidth: 0, textAlign: 'left', flex: 1 },
                children: [
                    createElement('span', {
                        text: label,
                        styles: { display: 'block', fontSize: '10px', letterSpacing: '.8px', textTransform: 'uppercase', color: 'rgba(255,255,255,.42)', fontWeight: 800 },
                    }),
                    createElement('span', {
                        text: value,
                        attrs: { 'data-sensor-value': sensorKey },
                        styles: { display: 'block', marginTop: '2px', fontSize: '12px', color: connected ? accent : 'rgba(255,255,255,.72)', fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
                    }),
                ],
            }),
            div({
                attrs: { 'data-sensor-dot': sensorKey },
                styles: { width: '7px', height: '7px', borderRadius: '50%', background: connected ? accent : 'rgba(255,255,255,.18)', boxShadow: connected ? `0 0 10px ${accent}` : 'none', flexShrink: 0 },
            }),
        ],
    });
}

function navItem({ iconName, title, meta, onClick }) {
    return button({
        attrs: { type: 'button', 'aria-label': title },
        className: 'home-nav-item',
        events: { click: onClick },
        children: [
            icon(iconName, 18, 'rgba(255,255,255,.72)'),
            div({
                styles: { textAlign: 'left', minWidth: 0 },
                children: [
                    createElement('span', { text: title, styles: { display: 'block', color: '#fff', fontSize: '13px', fontWeight: 750 } }),
                    createElement('span', { text: meta, styles: { display: 'block', marginTop: '2px', color: 'rgba(255,255,255,.38)', fontSize: '10px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' } }),
                ],
            }),
        ],
    });
}

function menuItem({ iconName, title, description, onClick, disabled = false }) {
    return button({
        attrs: { type: 'button', disabled, 'aria-label': title },
        className: 'home-menu-item',
        styles: { opacity: disabled ? .42 : 1, cursor: disabled ? 'not-allowed' : 'pointer' },
        events: { click: () => { if (!disabled) onClick(); } },
        children: [
            div({ className: 'home-menu-icon', children: [icon(iconName, 18, disabled ? 'rgba(255,255,255,.32)' : colors.primary)] }),
            div({
                styles: { minWidth: 0, textAlign: 'left' },
                children: [
                    createElement('span', { text: title, styles: { display: 'block', color: '#fff', fontSize: '13px', fontWeight: 750 } }),
                    createElement('span', { text: description, styles: { display: 'block', marginTop: '2px', color: 'rgba(255,255,255,.42)', fontSize: '11px' } }),
                ],
            }),
        ],
    });
}

export function HomeView(state) {
    const bluetoothSupport = checkBluetoothSupport();
    const connectionState = state.connectionState || CONNECTION_STATE.DISCONNECTED;
    const hrState = state.hrConnectionState || HR_CONNECTION_STATE.DISCONNECTED;
    const isConnected = connectionState === CONNECTION_STATE.CONNECTED;
    const isHRConnected = hrState === HR_CONNECTION_STATE.CONNECTED;
    const trainerBusy = [
        CONNECTION_STATE.SCANNING,
        CONNECTION_STATE.CONNECTING,
        CONNECTION_STATE.CONNECTING_GATT,
        CONNECTION_STATE.DISCOVERING_SERVICES,
        CONNECTION_STATE.SUBSCRIBING,
        CONNECTION_STATE.RECONNECTING,
    ].includes(connectionState);
    const hrBusy = [HR_CONNECTION_STATE.SCANNING, HR_CONNECTION_STATE.CONNECTING, HR_CONNECTION_STATE.RECONNECTING].includes(hrState);

    const progress = state.progress || {};
    const weeklyActive = Math.round(progress.weekly?.activeMinutes || 0);
    const weeklyGoal = progress.weekly?.goalMinutes || 90;
    const weeklyPercent = Math.min(100, Math.round((weeklyActive / Math.max(1, weeklyGoal)) * 100));
    const recovered = state.recoveredSession && state.selectedWorkout;
    const featuredWorkout = recovered ? state.selectedWorkout : WORKOUT_PRESETS.AURORA_EXPEDITION;
    const featuredTitle = recovered ? 'Continúa tu expedición' : 'Valle de Aurora';
    const featuredDescription = recovered
        ? `${state.recoveredSession.workoutName || featuredWorkout.name} está guardada justo donde la dejaste.`
        : 'Una misión de 10 minutos para encontrar tu ritmo, encadenar Flow y despertar el valle.';

    let installItem = null;
    const canInstall = () => typeof window.hasPWAInstallPrompt === 'function'
        && window.hasPWAInstallPrompt()
        && !(typeof window.isPWAInstalled === 'function' && window.isPWAInstalled());
    const syncInstallVisibility = () => {
        if (installItem) installItem.style.display = canInstall() ? 'flex' : 'none';
    };
    const handleInstallable = () => syncInstallVisibility();
    const handleInstalled = () => syncInstallVisibility();
    window.addEventListener('pwa-installable', handleInstallable);
    window.addEventListener('pwa-installed', handleInstalled);

    const connectTrainer = async (forceNew = false) => {
        if (!bluetoothSupport.supported || trainerBusy) return;
        try {
            if (forceNew && state.bluetoothManager) {
                state.bluetoothManager.disconnect();
                await state.bluetoothManager.scan();
                return;
            }
            if (isConnected) return;
            const cached = state.bluetoothManager?.cachedDevice;
            if (cached) {
                const connected = await state.bluetoothManager.reconnectSilently();
                if (!connected) await state.bluetoothManager.reconnectToCachedDevice();
            } else {
                await state.bluetoothManager?.scan();
            }
            navigator.vibrate?.([45, 25, 45]);
        } catch (error) {
            if (error.name !== 'NotFoundError') console.warn('No se pudo conectar el rodillo:', error.message);
        }
    };

    const toggleHeartRate = async () => {
        if (hrBusy) return;
        if (isHRConnected) {
            state.heartRateManager?.disconnect();
            return;
        }
        try {
            const cached = state.heartRateManager?.cachedDevice;
            if (cached) {
                const connected = await state.heartRateManager.reconnectSilently();
                if (connected) return;
            }
            await state.heartRateManager?.scan();
            navigator.vibrate?.(35);
        } catch (error) {
            if (error.name !== 'NotFoundError') console.warn('No se pudo conectar el pulso:', error.message);
        }
    };

    const wrapper = div({ attrs: { 'data-view': 'home', class: 'home-view-bg' } });
    const shell = div({ attrs: { class: 'home-shell' } });
    wrapper.appendChild(shell);

    let deviceOverlay = null;
    const openDevicePanel = () => {
        state.homeDevicePanelOpen = true;
        if (deviceOverlay) deviceOverlay.style.display = 'flex';
    };
    const closeDevicePanel = () => {
        state.homeDevicePanelOpen = false;
        if (deviceOverlay) deviceOverlay.style.display = 'none';
    };

    const moreMenu = createElement('details', {
        attrs: { class: 'home-more' },
        children: [
            createElement('summary', {
                attrs: { 'aria-label': 'Abrir más opciones' },
                children: [createElement('span', { text: 'Más' }), icon('chevronDown', 14, 'rgba(255,255,255,.55)')],
            }),
            div({
                attrs: { class: 'home-menu-panel' },
                children: [
                    menuItem({ iconName: 'activity', title: 'Entrenamiento libre', description: isConnected ? 'Control manual y zonas' : 'Requiere rodillo', disabled: !isConnected, onClick: () => navigateTo('training') }),
                    menuItem({ iconName: 'game', title: 'Modo juego clásico', description: 'Experimento arcade', onClick: () => navigateToGame() }),
                    menuItem({ iconName: 'bike', title: 'Ciclismo virtual', description: isConnected ? 'Ruta y resistencia dinámica' : 'Requiere rodillo', disabled: !isConnected, onClick: () => navigateToRide() }),
                    menuItem({ iconName: 'gauge', title: 'Diagnóstico', description: 'Prueba telemetría y ERG', onClick: () => navigateTo('diagnostics') }),
                    menuItem({ iconName: 'settings', title: 'Configuración', description: 'Cuenta, FTP y preferencias', onClick: () => navigateTo('settings') }),
                ],
            }),
        ],
    });

    installItem = menuItem({
        iconName: 'download',
        title: 'Instalar aplicación',
        description: 'Acceso rápido y modo sin conexión',
        onClick: async () => { await window.installPWA?.(); syncInstallVisibility(); },
    });
    installItem.style.display = canInstall() ? 'flex' : 'none';
    moreMenu.querySelector('.home-menu-panel').appendChild(installItem);

    shell.appendChild(div({
        attrs: { class: 'home-topbar' },
        children: [
            div({
                attrs: { class: 'home-brand' },
                children: [
                    div({ attrs: { class: 'home-brand-mark' }, children: [icon('bike', 18, '#07100e')] }),
                    div({
                        children: [
                            createElement('strong', { text: 'EXPEDITIONS' }),
                            createElement('span', { text: 'SMART TRAINER' }),
                        ],
                    }),
                ],
            }),
            div({ attrs: { class: 'home-top-actions' }, children: [
                createElement('span', { text: `Nivel ${progress.level || 1}`, attrs: { class: 'home-level' } }),
                moreMenu,
            ] }),
        ],
    }));

    const missionMeta = recovered ? 'SESIÓN RECUPERADA' : '10 MIN · INICIACIÓN · 1 BIFURCACIÓN';
    const startFeatured = () => {
        const dataFresh = isConnected && state.lastDataUpdateTimestamp && Date.now() - state.lastDataUpdateTimestamp <= 5000;
        if (isConnected && !dataFresh) {
            state.homePreflightRequested = true;
            openDevicePanel();
            return;
        }
        state.homeDevicePanelOpen = false;
        state.homePreflightRequested = false;
        state.selectedWorkout = featuredWorkout;
        if (!recovered) state.recoveredSession = null;
        navigateTo('expedition');
    };

    shell.appendChild(div({
        attrs: { class: 'home-hero' },
        children: [
            div({ attrs: { class: 'home-hero-glow' } }),
            div({ attrs: { class: 'home-landscape home-landscape-far' } }),
            div({ attrs: { class: 'home-landscape home-landscape-near' } }),
            div({
                attrs: { class: 'home-hero-copy' },
                children: [
                    createElement('span', { text: recovered ? 'RETOMA EL VIAJE' : 'PRÓXIMA EXPEDICIÓN', attrs: { class: 'home-eyebrow' } }),
                    createElement('h1', { text: featuredTitle }),
                    createElement('p', { text: featuredDescription }),
                    div({ attrs: { class: 'home-hero-actions' }, children: [
                        button({
                            attrs: { type: 'button', class: 'home-primary-action' },
                            events: { click: startFeatured },
                            children: [icon(recovered ? 'activity' : 'play', 16, '#07100e'), createElement('span', { text: recovered ? 'Continuar' : (isConnected ? 'Empezar' : 'Probar en demo') })],
                        }),
                        textButton('Entrenamiento libre', () => {
                            if (!isConnected) {
                                state.homePreflightRequested = true;
                                openDevicePanel();
                                return;
                            }
                            state.homeDevicePanelOpen = false;
                            navigateTo('training');
                        }),
                    ] }),
                ],
            }),
            createElement('span', { text: missionMeta, attrs: { class: 'home-mission-meta' } }),
        ],
    }));

    const trainerValue = !bluetoothSupport.supported
        ? 'Bluetooth no disponible'
        : (isConnected ? `${state.deviceName || 'Rodillo'} · comprobando` : connectionMessage(connectionState));
    const hrValue = isHRConnected ? `${state.hrDeviceName || 'Pulso'} · comprobando` : hrConnectionMessage(hrState);

    shell.appendChild(div({
        attrs: { class: 'home-status-row' },
        children: [
            div({
                attrs: { class: 'home-sensors' },
                children: [
                    compactSensor({ iconName: 'bike', label: 'Rodillo', value: trainerValue, accent: colors.accent, connected: isConnected, busy: trainerBusy, onClick: openDevicePanel, sensorKey: 'trainer' }),
                    compactSensor({ iconName: 'heart', label: 'Pulso', value: hrValue, accent: '#ff607b', connected: isHRConnected, busy: hrBusy, onClick: openDevicePanel, sensorKey: 'heart' }),
                ],
            }),
            div({
                attrs: { class: 'home-weekly' },
                children: [
                    div({ children: [
                        createElement('span', { text: 'OBJETIVO SEMANAL' }),
                        createElement('strong', { text: `${weeklyActive} / ${weeklyGoal} min` }),
                    ] }),
                    div({ attrs: { class: 'home-progress-track', role: 'progressbar', 'aria-valuemin': '0', 'aria-valuemax': '100', 'aria-valuenow': String(weeklyPercent) }, children: [
                        div({ styles: { width: `${weeklyPercent}%` } }),
                    ] }),
                ],
            }),
        ],
    }));

    shell.appendChild(div({
        attrs: { class: 'home-secondary-nav', 'aria-label': 'Accesos principales' },
        children: [
            navItem({ iconName: 'route', title: 'Expediciones', meta: '3 mundos', onClick: () => navigateTo('workouts') }),
            navItem({ iconName: 'barChart', title: 'Progreso', meta: `${progress.xp || 0} XP`, onClick: () => navigateTo('history') }),
            navItem({ iconName: 'game', title: 'Retos', meta: 'Ghosts y amigos', onClick: () => navigateTo('challenges') }),
        ],
    }));

    const capabilities = state.deviceCapabilities || state.bluetoothManager?.capabilities || {};
    const capabilityPill = (label, supported) => createElement('span', {
        text: `${supported ? '✓' : '—'} ${label}`,
        styles: {
            color: supported ? '#75e5c5' : 'rgba(255,255,255,.34)',
            background: supported ? 'rgba(0,212,170,.09)' : 'rgba(255,255,255,.035)',
            border: `1px solid ${supported ? 'rgba(0,212,170,.22)' : 'rgba(255,255,255,.07)'}`,
        },
    });
    const detailValue = (key, initial = '—') => createElement('strong', { text: initial, attrs: { 'data-device-detail': key } });
    const detailRow = (label, valueEl) => div({
        attrs: { class: 'home-device-detail-row' },
        children: [createElement('span', { text: label }), valueEl],
    });

    const trainerDataValue = detailValue('trainer-data');
    const powerValue = detailValue('power');
    const cadenceValue = detailValue('cadence');
    const heartDataValue = detailValue('heart-data');
    const preflightValue = detailValue('preflight');
    const primaryTrainerAction = button({
        attrs: { type: 'button', class: 'home-device-primary' },
        text: isConnected ? 'Cambiar rodillo' : 'Conectar rodillo',
        events: { click: () => connectTrainer(isConnected) },
    });
    const disconnectTrainerAction = isConnected ? button({
        attrs: { type: 'button', class: 'home-device-secondary' },
        text: 'Desconectar',
        events: { click: () => state.bluetoothManager?.disconnect() },
    }) : null;
    const heartAction = button({
        attrs: { type: 'button', class: 'home-device-secondary' },
        text: isHRConnected ? 'Desconectar pulso' : 'Conectar pulso',
        events: { click: toggleHeartRate },
    });

    deviceOverlay = div({
        attrs: { class: 'home-device-overlay', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Dispositivos y preparación' },
        styles: { display: state.homeDevicePanelOpen ? 'flex' : 'none' },
        events: { click: (event) => { if (event.target === deviceOverlay) closeDevicePanel(); } },
        children: [
            div({
                attrs: { class: 'home-device-panel' },
                children: [
                    div({ attrs: { class: 'home-device-header' }, children: [
                        div({ children: [
                            createElement('span', { text: 'PREPARACIÓN', attrs: { class: 'home-eyebrow' } }),
                            createElement('h2', { text: 'Dispositivos' }),
                        ] }),
                        button({ attrs: { type: 'button', class: 'home-device-close', 'aria-label': 'Cerrar dispositivos' }, children: [icon('close', 18, 'rgba(255,255,255,.7)')], events: { click: closeDevicePanel } }),
                    ] }),
                    div({ attrs: { class: 'home-preflight-banner' }, children: [
                        div({ attrs: { class: 'home-preflight-dot', 'data-preflight-dot': 'true' } }),
                        div({ children: [createElement('span', { text: 'ESTADO PARA ENTRENAR' }), preflightValue] }),
                    ] }),
                    div({ attrs: { class: 'home-device-section' }, children: [
                        div({ attrs: { class: 'home-device-title' }, children: [
                            icon('bike', 18, colors.accent),
                            div({ children: [createElement('strong', { text: state.deviceName || 'Rodillo inteligente' }), createElement('span', { text: isConnected ? 'FTMS conectado' : connectionMessage(connectionState) })] }),
                        ] }),
                        detailRow('Telemetría', trainerDataValue),
                        detailRow('Potencia', powerValue),
                        detailRow('Cadencia', cadenceValue),
                        div({ attrs: { class: 'home-capabilities' }, children: [
                            capabilityPill('ERG', capabilities.powerTargetSupported === true),
                            capabilityPill('Resistencia', capabilities.resistanceTargetSupported === true),
                            capabilityPill('Simulación', capabilities.indoorBikeSimulationSupported === true),
                            capabilityPill('Cadencia', capabilities.cadenceSupported === true),
                        ] }),
                        div({ attrs: { class: 'home-device-actions' }, children: [primaryTrainerAction, disconnectTrainerAction] }),
                    ] }),
                    div({ attrs: { class: 'home-device-section home-device-section-small' }, children: [
                        div({ attrs: { class: 'home-device-title' }, children: [
                            icon('heart', 18, '#ff607b'),
                            div({ children: [createElement('strong', { text: state.hrDeviceName || 'Pulsómetro' }), createElement('span', { text: isHRConnected ? 'Bluetooth conectado' : 'Sensor opcional' })] }),
                        ] }),
                        detailRow('Lectura', heartDataValue),
                        div({ attrs: { class: 'home-device-actions' }, children: [heartAction] }),
                    ] }),
                    button({
                        attrs: { type: 'button', class: 'home-diagnostics-link' },
                        events: { click: () => { state.homeDevicePanelOpen = false; navigateTo('diagnostics'); } },
                        children: [icon('gauge', 15, 'rgba(255,255,255,.5)'), createElement('span', { text: 'Abrir diagnóstico avanzado' }), icon('chevronRight', 14, 'rgba(255,255,255,.3)')],
                    }),
                ],
            }),
        ],
    });
    wrapper.appendChild(deviceOverlay);

    const updateLiveIndicators = () => {
        const now = Date.now();
        const trainerAge = state.lastDataUpdateTimestamp ? now - state.lastDataUpdateTimestamp : Infinity;
        const hrAge = state.lastHeartRateUpdateTimestamp ? now - state.lastHeartRateUpdateTimestamp : Infinity;
        const trainerQuality = !isConnected ? 'missing' : (trainerAge <= 3000 ? 'fresh' : (trainerAge <= 10000 ? 'stale' : 'missing'));
        const hrQuality = !isHRConnected ? 'missing' : (hrAge <= 5000 ? 'fresh' : (hrAge <= 12000 ? 'stale' : 'missing'));
        const trainerLabel = trainerQuality === 'fresh' ? 'datos listos' : (trainerQuality === 'stale' ? 'datos lentos' : 'sin datos');
        const heartLabel = hrQuality === 'fresh' ? `${Math.round(state.liveData.heartRate || 0)} ppm` : (hrQuality === 'stale' ? 'señal débil' : (isHRConnected ? 'sin lectura' : 'opcional'));
        const trainerSensorValue = wrapper.querySelector('[data-sensor-value="trainer"]');
        const heartSensorValue = wrapper.querySelector('[data-sensor-value="heart"]');
        const trainerDot = wrapper.querySelector('[data-sensor-dot="trainer"]');
        const heartDot = wrapper.querySelector('[data-sensor-dot="heart"]');
        if (trainerSensorValue && isConnected) trainerSensorValue.textContent = `${state.deviceName || 'Rodillo'} · ${trainerLabel}`;
        if (heartSensorValue && isHRConnected) heartSensorValue.textContent = `${state.hrDeviceName || 'Pulso'} · ${heartLabel}`;
        if (trainerDot) trainerDot.style.background = trainerQuality === 'fresh' ? colors.accent : (trainerQuality === 'stale' ? '#f6b94b' : 'rgba(255,255,255,.18)');
        if (heartDot) heartDot.style.background = hrQuality === 'fresh' ? '#ff607b' : (hrQuality === 'stale' ? '#f6b94b' : 'rgba(255,255,255,.18)');
        trainerDataValue.textContent = !isConnected ? 'Desconectado' : (trainerQuality === 'fresh' ? 'Recibiendo ahora' : (trainerQuality === 'stale' ? 'Lectura retrasada' : 'Bluetooth sin datos'));
        trainerDataValue.dataset.quality = trainerQuality;
        powerValue.textContent = trainerQuality === 'fresh' ? `${Math.round(state.liveData.power || 0)} W` : '—';
        cadenceValue.textContent = trainerQuality === 'fresh' ? `${Math.round(state.liveData.cadence || 0)} rpm` : '—';
        heartDataValue.textContent = heartLabel;
        heartDataValue.dataset.quality = hrQuality;
        const ready = isConnected && trainerQuality === 'fresh';
        preflightValue.textContent = ready ? 'Rodillo y datos listos' : (!isConnected ? 'Conecta el rodillo o utiliza el modo demo' : 'Bluetooth conectado, esperando telemetría');
        preflightValue.dataset.quality = ready ? 'fresh' : 'stale';
        const preflightDot = wrapper.querySelector('[data-preflight-dot]');
        if (preflightDot) preflightDot.style.background = ready ? colors.accent : '#f6b94b';
        if (state.homePreflightRequested && ready) state.homePreflightRequested = false;
    };
    updateLiveIndicators();
    const unsubscribe = subscribe(updateLiveIndicators);
    const freshnessTimer = window.setInterval(updateLiveIndicators, 1000);

    wrapper.cleanup = () => {
        window.removeEventListener('pwa-installable', handleInstallable);
        window.removeEventListener('pwa-installed', handleInstalled);
        unsubscribe();
        window.clearInterval(freshnessTimer);
    };
    return wrapper;
}
