/**
 * HomeView — portada de Smart Trainer Expeditions.
 * Una sola decisión: empezar la próxima sesión. El perfil del entreno ocupa el centro y a la
 * derecha queda el estado de la semana, del equipo y los accesos. Los dispositivos se conectan
 * después, en la pantalla de preparación (PrepareView).
 */

import './home.css';
import { createElement, div, button, icon, formatTime } from '../utils/dom.js';
import { CONNECTION_STATE } from '../bluetooth/scanner.js';
import { HR_CONNECTION_STATE } from '../bluetooth/heartRate.js';
import { navigateToGame, navigateTo, navigateToRide } from '../app.js';
import { WORKOUT_PRESETS } from '../workouts/presets.js';
import { fetchTodayPlan, isSyncConnected } from '../sync/TrainingAppSync.js';
import { cachePlanWorkout, planToWorkout } from '../workouts/planConverter.js';
import { createWorkoutProfileFrame } from '../components/WorkoutProfile.js';

const SESSION_LABELS = {
    endurance: 'Resistencia', climbing: 'Subidas', threshold: 'Umbral',
    long: 'Salida larga', recovery: 'Recuperación', technical: 'Técnica',
};

function describePlan(plan, ftpWatts) {
    const prescription = plan.prescription || {};
    const effort = prescription.hrZone ? `Zona ${prescription.hrZone}` : (prescription.rpe ? `Esfuerzo ${prescription.rpe} de 10` : '');
    const kind = SESSION_LABELS[plan.sessionType] || 'Sesión';
    return {
        description: plan.description || `${kind} de tu plan de training-app.`,
        note: [effort, ftpWatts ? '' : 'FTP sin calibrar'].filter(Boolean).join(' · '),
    };
}

function listRow({ iconName, iconColor = 'rgba(238,243,239,.78)', title, meta, onClick, dot = null }) {
    return button({
        attrs: { type: 'button', class: 'hp-row', 'aria-label': title },
        events: { click: onClick },
        children: [
            div({ attrs: { class: 'hp-row-icon' }, children: [icon(iconName, 18, iconColor)] }),
            div({ attrs: { class: 'hp-row-text' }, children: [createElement('strong', { text: title }), createElement('span', { text: meta })] }),
            dot,
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
            div({ className: 'home-menu-icon', children: [icon(iconName, 18, disabled ? 'rgba(255,255,255,.32)' : '#8ee9d0')] }),
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

function statusDot(on, heart = false) {
    return createElement('span', { attrs: { class: `hp-dot${heart ? ' is-heart' : ''}${on ? ' is-on' : ''}`, 'aria-hidden': 'true' } });
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
    const featured = recovered
        ? {
            state: 'Retoma el viaje',
            title: 'Continúa tu expedición',
            description: `${state.recoveredSession.workoutName || featuredWorkout.name} está guardada justo donde la dejaste.`,
            note: 'Sesión guardada',
        }
        : {
            state: 'Tu próxima sesión',
            title: 'Valle de Aurora',
            description: 'Una misión corta para encontrar tu ritmo, encadenar Flow y despertar el valle.',
            note: 'Iniciación · valle y puerto',
        };

    let installItem = null;
    const canInstall = () => typeof window.hasPWAInstallPrompt === 'function'
        && window.hasPWAInstallPrompt()
        && !(typeof window.isPWAInstalled === 'function' && window.isPWAInstalled());
    const syncInstallVisibility = () => {
        if (installItem) installItem.style.display = canInstall() ? 'flex' : 'none';
    };
    window.addEventListener('pwa-installable', syncInstallVisibility);
    window.addEventListener('pwa-installed', syncInstallVisibility);

    const wrapper = div({ attrs: { 'data-view': 'home', class: 'hp' } });
    const shell = div({ attrs: { class: 'hp-shell' } });
    wrapper.appendChild(shell);

    const goToPrepare = (workout, target = 'expedition') => {
        if (workout) state.selectedWorkout = workout;
        state.prepareTarget = target;
        if (target === 'expedition' && !recovered) state.recoveredSession = null;
        navigateTo('prepare');
    };

    // --- Barra superior ---
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
        attrs: { class: 'hp-topbar' },
        children: [
            div({
                attrs: { class: 'hp-brand' },
                children: [
                    div({ attrs: { class: 'hp-brand-mark' }, children: [icon('bike', 20, '#1d0d05')] }),
                    div({ children: [createElement('strong', { text: 'Expeditions' }), createElement('span', { text: 'Smart Trainer' })] }),
                ],
            }),
            div({ attrs: { class: 'hp-top-actions' }, children: [
                createElement('span', { text: `Nivel ${progress.level || 1}`, attrs: { class: 'hp-level' } }),
                moreMenu,
            ] }),
        ],
    }));

    // --- Héroe: la sesión y su perfil ---
    const heroState = createElement('span', { attrs: { class: 'hp-hero-state' } });
    const heroTitle = createElement('h1', { attrs: { class: 'hp-title' } });
    const heroLede = createElement('p', { attrs: { class: 'hp-lede' } });
    const heroStats = div({ attrs: { class: 'hp-stats' } });
    const heroProfile = div();
    const heroNote = createElement('span', { attrs: { class: 'hp-cta-note' } });

    const renderFeatured = () => {
        heroState.textContent = featured.state;
        heroTitle.textContent = featured.title;
        heroLede.textContent = featured.description;
        heroNote.textContent = featured.note;
        const stats = featuredWorkout.stats || {};
        const statBlock = (value, label) => div({
            attrs: { class: 'hp-stat' },
            children: [createElement('strong', { text: value }), createElement('span', { text: label })],
        });
        heroStats.replaceChildren(
            statBlock(formatTime(stats.totalDuration || 0), 'Duración'),
            statBlock(String(stats.tss ?? '—'), 'Carga (TSS)'),
            statBlock(String(stats.intensityFactor ?? '—'), 'Intensidad (IF)'),
        );
        heroProfile.replaceChildren(createWorkoutProfileFrame(featuredWorkout, { height: 230 }));
    };
    renderFeatured();

    const hero = div({
        attrs: { class: 'hp-card hp-hero' },
        children: [
            div({ children: [heroState, heroTitle, heroLede] }),
            heroStats,
            heroProfile,
            div({ attrs: { class: 'hp-cta-row' }, children: [
                button({
                    attrs: { type: 'button', class: 'hp-btn hp-btn--primary', 'data-home-cta': 'true' },
                    events: { click: () => goToPrepare(featuredWorkout) },
                    children: [icon(recovered ? 'activity' : 'play', 18, '#1d0d05'), createElement('span', { text: recovered ? 'Continuar sesión' : 'Preparar sesión' })],
                }),
                button({
                    text: 'Elegir otro entreno',
                    attrs: { type: 'button', class: 'hp-link' },
                    events: { click: () => navigateTo('workouts') },
                }),
                heroNote,
            ] }),
        ],
    });

    // --- Carril lateral ---
    const week = div({
        attrs: { class: 'hp-card hp-panel' },
        children: [
            createElement('h2', { text: 'Esta semana' }),
            div({ attrs: { class: 'hp-week-number' }, children: [
                createElement('strong', { text: String(weeklyActive) }),
                createElement('span', { text: `de ${weeklyGoal} min` }),
            ] }),
            div({
                attrs: { class: 'hp-meter', role: 'progressbar', 'aria-label': 'Objetivo semanal', 'aria-valuemin': '0', 'aria-valuemax': '100', 'aria-valuenow': String(weeklyPercent) },
                children: [div({ styles: { width: `${weeklyPercent}%` } })],
            }),
            createElement('p', { text: `${progress.xp || 0} XP · Nivel ${progress.level || 1}`, attrs: { class: 'hp-panel-foot' } }),
        ],
    });

    const equipment = div({
        attrs: { class: 'hp-card hp-panel' },
        children: [
            createElement('h2', { text: 'Equipo' }),
            div({ attrs: { class: 'hp-list' }, children: [
                listRow({
                    iconName: 'bike', iconColor: isConnected ? '#8ee9d0' : undefined,
                    title: isConnected ? (state.deviceName || 'Rodillo') : 'Rodillo',
                    meta: isConnected ? 'Conectado' : 'Sin conectar',
                    onClick: () => goToPrepare(featuredWorkout), dot: statusDot(isConnected),
                }),
                listRow({
                    iconName: 'heart', iconColor: isHRConnected ? '#ff6f8a' : undefined,
                    title: isHRConnected ? (state.hrDeviceName || 'Pulsómetro') : 'Pulsómetro',
                    meta: isHRConnected ? 'Conectado' : 'Opcional · sin conectar',
                    onClick: () => goToPrepare(featuredWorkout), dot: statusDot(isHRConnected, true),
                }),
            ] }),
        ],
    });

    const shortcuts = div({
        attrs: { class: 'hp-card hp-panel' },
        children: [
            createElement('h2', { text: 'Ir a' }),
            div({ attrs: { class: 'hp-list' }, children: [
                listRow({ iconName: 'route', title: 'Rutas', meta: 'Todas las expediciones', onClick: () => navigateTo('workouts') }),
                listRow({ iconName: 'activity', title: 'Entrenamiento libre', meta: 'Control manual', onClick: () => goToPrepare(null, 'training') }),
                listRow({ iconName: 'barChart', title: 'Historial', meta: 'Sesiones y progreso', onClick: () => navigateTo('history') }),
                listRow({ iconName: 'settings', title: 'Ajustes', meta: 'FTP, cuenta y plan', onClick: () => navigateTo('settings') }),
            ] }),
        ],
    });

    shell.appendChild(div({
        attrs: { class: 'hp-grid' },
        children: [hero, div({ attrs: { class: 'hp-rail' }, children: [week, equipment, shortcuts] })],
    }));

    // Si training-app tiene un entreno previsto para hoy, sustituye a la misión destacada.
    if (!recovered && isSyncConnected()) {
        fetchTodayPlan().then((result) => {
            const plan = result?.planned;
            if (!plan?.structure?.length || !wrapper.isConnected) return;
            featuredWorkout = planToWorkout(plan);
            cachePlanWorkout(featuredWorkout);
            const { description, note } = describePlan(plan, result.ftp);
            featured.state = 'Tu plan de hoy';
            featured.title = plan.name;
            featured.description = description;
            featured.note = note;
            renderFeatured();
        });
    }

    wrapper.cleanup = () => {
        window.removeEventListener('pwa-installable', syncInstallVisibility);
        window.removeEventListener('pwa-installed', syncInstallVisibility);
    };
    return wrapper;
}
