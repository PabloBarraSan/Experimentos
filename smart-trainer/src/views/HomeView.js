/**
 * HomeView — portada de Smart Trainer Expeditions.
 * Una sola decisión: empezar la próxima sesión. Los dispositivos se conectan
 * después, en la pantalla de preparación (PrepareView).
 */

import { colors } from '../utils/theme.js';
import { createElement, div, button, icon } from '../utils/dom.js';
import { CONNECTION_STATE } from '../bluetooth/scanner.js';
import { HR_CONNECTION_STATE } from '../bluetooth/heartRate.js';
import { navigateToGame, navigateTo, navigateToRide } from '../app.js';
import { WORKOUT_PRESETS } from '../workouts/presets.js';
import { fetchTodayPlan, isSyncConnected } from '../sync/TrainingAppSync.js';
import { cachePlanWorkout, planToWorkout } from '../workouts/planConverter.js';

const SESSION_LABELS = {
    endurance: 'Resistencia', climbing: 'Subidas', threshold: 'Umbral',
    long: 'Salida larga', recovery: 'Recuperación', technical: 'Técnica',
};

function describePlan(plan, ftp) {
    const prescription = plan.prescription || {};
    const effort = prescription.hrZone ? ` · Zona ${prescription.hrZone}` : (prescription.rpe ? ` · RPE ${prescription.rpe}` : '');
    return {
        description: plan.description || `${SESSION_LABELS[plan.sessionType] || 'Sesión'} de tu plan de training-app.`,
        meta: `${plan.durationMin || Math.round(plan.structure.reduce((sum, block) => sum + block.durationSec * (block.repeat || 1), 0) / 60)} min · ${SESSION_LABELS[plan.sessionType] || 'Plan'}${effort}${ftp ? '' : ' · FTP sin calibrar'}`,
    };
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

function deviceChip(label, connected, accent) {
    const chip = createElement('span', {
        text: `${connected ? '●' : '○'} ${label}`,
        attrs: { class: `home-chip${connected ? ' is-on' : ''}` },
    });
    if (connected) chip.style.setProperty('--chip', accent);
    return chip;
}

export function HomeView(state) {
    const isConnected = (state.connectionState || CONNECTION_STATE.DISCONNECTED) === CONNECTION_STATE.CONNECTED;
    const isHRConnected = (state.hrConnectionState || HR_CONNECTION_STATE.DISCONNECTED) === HR_CONNECTION_STATE.CONNECTED;

    const progress = state.progress || {};
    const weeklyActive = Math.round(progress.weekly?.activeMinutes || 0);
    const weeklyGoal = progress.weekly?.goalMinutes || 90;
    const weeklyPercent = Math.min(100, Math.round((weeklyActive / Math.max(1, weeklyGoal)) * 100));
    const recovered = state.recoveredSession && state.selectedWorkout;
    let featuredWorkout = recovered ? state.selectedWorkout : WORKOUT_PRESETS.AURORA_EXPEDITION;
    const featuredTitle = recovered ? 'Continúa tu expedición' : 'Valle de Aurora';
    const featuredDescription = recovered
        ? `${state.recoveredSession.workoutName || featuredWorkout.name} está guardada justo donde la dejaste.`
        : 'Una misión de 10 minutos para encontrar tu ritmo, encadenar Flow y despertar el valle.';
    const missionMeta = recovered ? 'Sesión guardada' : '10 min · Iniciación · Valle y puerto';

    let installItem = null;
    const canInstall = () => typeof window.hasPWAInstallPrompt === 'function'
        && window.hasPWAInstallPrompt()
        && !(typeof window.isPWAInstalled === 'function' && window.isPWAInstalled());
    const syncInstallVisibility = () => {
        if (installItem) installItem.style.display = canInstall() ? 'flex' : 'none';
    };
    window.addEventListener('pwa-installable', syncInstallVisibility);
    window.addEventListener('pwa-installed', syncInstallVisibility);

    const heroEyebrow = createElement('span', { text: recovered ? 'RETOMA EL VIAJE' : 'TU PRÓXIMA SESIÓN', attrs: { class: 'home-eyebrow' } });
    const heroTitle = createElement('h1', { text: featuredTitle });
    const heroDescription = createElement('p', { text: featuredDescription });
    const heroMeta = createElement('span', { text: missionMeta, attrs: { class: 'home-mission-meta' } });

    const wrapper = div({ attrs: { 'data-view': 'home', class: 'home-view-bg' } });
    const shell = div({ attrs: { class: 'home-shell' } });
    wrapper.appendChild(shell);

    const goToPrepare = (workout, target = 'expedition') => {
        if (workout) state.selectedWorkout = workout;
        state.prepareTarget = target;
        if (target === 'expedition' && !recovered) state.recoveredSession = null;
        navigateTo('prepare');
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
                    menuItem({ iconName: 'game', title: 'Modo juego clásico', description: 'Experimento arcade', onClick: () => navigateToGame() }),
                    menuItem({ iconName: 'bike', title: 'Ciclismo virtual', description: isConnected ? 'Ruta y resistencia dinámica' : 'Requiere rodillo', disabled: !isConnected, onClick: () => navigateToRide() }),
                    menuItem({ iconName: 'gauge', title: 'Prueba del rodillo', description: 'Mini entreno guiado de 4 minutos', onClick: () => navigateTo('diagnostics') }),
                    menuItem({ iconName: 'bike', title: 'Visor del ciclista', description: 'Mira y gira el modelo en 3D', onClick: () => navigateTo('cyclist') }),
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
                    div({ children: [createElement('strong', { text: 'EXPEDITIONS' }), createElement('span', { text: 'SMART TRAINER' })] }),
                ],
            }),
            div({ attrs: { class: 'home-top-actions' }, children: [
                createElement('span', { text: `Nivel ${progress.level || 1}`, attrs: { class: 'home-level' } }),
                moreMenu,
            ] }),
        ],
    }));

    shell.appendChild(div({
        attrs: { class: 'home-hero' },
        children: [
            div({ attrs: { class: 'home-hero-glow' } }),
            div({ attrs: { class: 'home-landscape home-landscape-far' } }),
            div({ attrs: { class: 'home-landscape home-landscape-near' } }),
            div({
                attrs: { class: 'home-hero-copy' },
                children: [
                    heroEyebrow,
                    heroTitle,
                    heroDescription,
                    heroMeta,
                ],
            }),
            div({ attrs: { class: 'home-cta-row' }, children: [
                button({
                    attrs: { type: 'button', class: 'home-primary-action', 'data-home-cta': 'true' },
                    events: { click: () => goToPrepare(featuredWorkout) }, // featuredWorkout cambia si hay plan
                    children: [icon(recovered ? 'activity' : 'play', 16, '#07100e'), createElement('span', { text: recovered ? 'Continuar' : 'Empezar' })],
                }),
                button({
                    text: 'Cambiar ruta',
                    attrs: { type: 'button', class: 'prep-link' },
                    events: { click: () => navigateTo('workouts') },
                }),
                div({ attrs: { class: 'home-chips' }, children: [
                    deviceChip(isConnected ? (state.deviceName || 'Rodillo') : 'Sin rodillo', isConnected, '#00d4aa'),
                    deviceChip(isHRConnected ? (state.hrDeviceName || 'Pulso') : 'Sin pulsómetro', isHRConnected, '#ff607b'),
                ] }),
            ] }),
        ],
    }));

    shell.appendChild(div({
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
    }));

    shell.appendChild(div({
        attrs: { class: 'home-secondary-nav', 'aria-label': 'Accesos principales' },
        children: [
            navItem({ iconName: 'route', title: 'Rutas', meta: 'Todas las expediciones', onClick: () => navigateTo('workouts') }),
            navItem({ iconName: 'activity', title: 'Libre', meta: 'Control manual', onClick: () => goToPrepare(null, 'training') }),
            navItem({ iconName: 'barChart', title: 'Progreso', meta: `${progress.xp || 0} XP`, onClick: () => navigateTo('history') }),
            navItem({ iconName: 'settings', title: 'Ajustes', meta: 'FTP, cuenta y plan', onClick: () => navigateTo('settings') }),
        ],
    }));

    // Si training-app tiene un entreno previsto para hoy, sustituye a la misión destacada.
    if (!recovered && isSyncConnected()) {
        fetchTodayPlan().then((result) => {
            const plan = result?.planned;
            if (!plan?.structure?.length || !wrapper.isConnected) return;
            featuredWorkout = planToWorkout(plan);
            cachePlanWorkout(featuredWorkout);
            const { description, meta } = describePlan(plan, result.ftp);
            heroEyebrow.textContent = 'TU PLAN DE HOY';
            heroTitle.textContent = plan.name;
            heroDescription.textContent = description;
            heroMeta.textContent = meta;
        });
    }

    wrapper.cleanup = () => {
        window.removeEventListener('pwa-installable', syncInstallVisibility);
        window.removeEventListener('pwa-installed', syncInstallVisibility);
    };
    return wrapper;
}
