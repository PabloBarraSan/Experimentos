/**
 * HomeView — hub compacto de Smart Trainer Expeditions.
 * La portada prioriza una sola decisión: empezar la próxima expedición.
 */

import { colors, typography } from '../utils/theme.js';
import { createElement, div, button, icon } from '../utils/dom.js';
import { checkBluetoothSupport, CONNECTION_STATE } from '../bluetooth/scanner.js';
import { HR_CONNECTION_STATE } from '../bluetooth/heartRate.js';
import { navigateToGame, navigateTo, navigateToRide } from '../app.js';
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

function compactSensor({ iconName, label, value, accent, connected, busy, onClick }) {
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
                        styles: { display: 'block', marginTop: '2px', fontSize: '12px', color: connected ? accent : 'rgba(255,255,255,.72)', fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
                    }),
                ],
            }),
            div({
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

    const connectTrainer = async () => {
        if (!bluetoothSupport.supported || trainerBusy || isConnected) return;
        try {
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
                        textButton('Ver expediciones', () => navigateTo('workouts')),
                    ] }),
                ],
            }),
            createElement('span', { text: missionMeta, attrs: { class: 'home-mission-meta' } }),
        ],
    }));

    const trainerValue = !bluetoothSupport.supported
        ? 'Bluetooth no disponible'
        : (isConnected ? (state.deviceName || 'Rodillo conectado') : connectionMessage(connectionState));
    const hrValue = isHRConnected ? (state.hrDeviceName || 'Pulso conectado') : hrConnectionMessage(hrState);

    shell.appendChild(div({
        attrs: { class: 'home-status-row' },
        children: [
            div({
                attrs: { class: 'home-sensors' },
                children: [
                    compactSensor({ iconName: 'bike', label: 'Rodillo', value: trainerValue, accent: colors.accent, connected: isConnected, busy: trainerBusy, onClick: connectTrainer }),
                    compactSensor({ iconName: 'heart', label: 'Pulso', value: hrValue, accent: '#ff607b', connected: isHRConnected, busy: hrBusy, onClick: toggleHeartRate }),
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

    wrapper.cleanup = () => {
        window.removeEventListener('pwa-installable', handleInstallable);
        window.removeEventListener('pwa-installed', handleInstalled);
    };
    return wrapper;
}
