import { colors, spacing, typography } from '../utils/theme.js';
import { button, createElement, div, formatTime } from '../utils/dom.js';
import { SessionController, SESSION_STATE } from '../session/SessionController.js';
import { recordMissionProgress } from '../game/ProgressionService.js';
import { WakeLockManager } from '../session/WakeLockManager.js';
import { installSessionDebugHooks, logActiveSessionError } from '../diagnostics/SessionDebugLogger.js';
import { clearActiveSession } from '../storage/sessions.js';
import { getCoachingState, getHeartRateZone } from '../game/CoachingEngine.js';
import { AudioCueService } from '../game/AudioCueService.js';
import { getPersonalGhost, interpolateGhost } from '../game/GhostService.js';
import { LapTracker, createLapTable, createLapToast, createRacePanel, createWorkoutStrip } from './expeditionHud.js';
import { trackProductEvent } from '../cloud/ProductAnalytics.js';

const EXPEDITION_VISUAL_SETTINGS_KEY = 'smartTrainer_expedition_visuals_v1';
const DEFAULT_VISUAL_SETTINGS = {
    camera: 'standard',
    hud: 'essential',
    quality: 'auto',
    reducedMotion: false,
    rivals: true,
};

export function ExpeditionView({
    state,
    workout,
    recoveredSession = null,
    availableWorkouts = [],
    subscribeToState,
    onProgress,
    onExit,
    onSelectWorkout,
    onCompleted,
}) {
    const isDemo = state.connectionState !== 'connected';
    const mission = workout?.mission || {
        id: workout?.missionId || workout?.id,
        version: workout?.missionVersion || 1,
        title: 'Valle de Aurora', world: 'aurora', terrain: 'Valle · Puerto',
        objective: 'Completa el entrenamiento', checkpoints: [], decisions: [],
    };
    const visualSettings = loadVisualSettings();
    const totalDuration = Math.max(1, workout?.stats?.totalDuration || 1);
    const recoveredElapsed = Number(recoveredSession?.elapsedTime || recoveredSession?.duration) || 0;
    const canResume = recoveredSession?.workoutId === workout?.id
        && recoveredElapsed > 1
        && recoveredElapsed < totalDuration - 2;
    const container = div({
        attrs: { 'data-view': 'expedition' },
        styles: {
            position: 'fixed',
            inset: 0,
            zIndex: 1000,
            background: '#090b12',
            overflow: 'hidden',
            color: colors.text,
        },
    });

    const canvas = createElement('canvas', {
        attrs: { 'aria-label': 'Valle de Aurora en tres dimensiones' },
        styles: {
            width: '100%',
            height: '100%',
            display: 'block',
            background: 'linear-gradient(#6d97b9, #abc4ad)',
        },
    });
    container.appendChild(canvas);

    const loadingScene = div({
        attrs: { role: 'status', 'aria-live': 'polite' },
        styles: {
            position: 'absolute',
            inset: 0,
            zIndex: 2,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'radial-gradient(circle at 50% 35%, rgba(63,102,98,.45), rgba(5,10,14,.96))',
            transition: 'opacity .5s ease',
            pointerEvents: 'none',
        },
        children: [
            div({
                styles: { textAlign: 'center' },
                children: [
                    createElement('strong', {
                        text: `CREANDO ${String(mission.title).toUpperCase()}`,
                        styles: { display: 'block', color: '#75ebc1', letterSpacing: '2px' },
                    }),
                    createElement('span', {
                        text: 'Preparando carretera, luz y ciclista…',
                        styles: { display: 'block', marginTop: spacing.sm, color: 'rgba(255,255,255,.66)' },
                    }),
                ],
            }),
        ],
    });
    container.appendChild(loadingScene);

    const hud = div({
        styles: {
            position: 'absolute',
            inset: 0,
            pointerEvents: 'none',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            padding: 'max(16px, env(safe-area-inset-top)) 18px max(18px, env(safe-area-inset-bottom))',
        },
    });
    container.appendChild(hud);

    const top = div({
        styles: {
            display: 'grid',
            gridTemplateColumns: '1fr auto 1fr',
            alignItems: 'start',
            gap: spacing.md,
        },
    });
    const blockLabel = createElement('div', {
        text: 'PREPARANDO RUTA',
        styles: {
            justifySelf: 'start',
            padding: '8px 12px',
            borderRadius: '999px',
            background: 'linear-gradient(135deg, rgba(7,14,18,.76), rgba(19,53,49,.62))',
            border: '1px solid rgba(255,255,255,.12)',
            fontSize: typography.sizes.xs,
            fontWeight: 800,
            letterSpacing: '1px',
            backdropFilter: 'blur(12px)',
        },
    });
    const timer = createElement('div', {
        text: formatTime(totalDuration),
        attrs: { 'aria-label': 'Tiempo restante' },
        styles: {
            padding: '10px 18px',
            borderRadius: '16px',
            background: 'rgba(7,9,14,.78)',
            border: '1px solid rgba(255,255,255,.14)',
            backdropFilter: 'blur(12px)',
            fontFamily: typography.fontMono,
            fontSize: '24px',
            fontWeight: 700,
        },
    });
    const clockStack = div({
        styles: {
            justifySelf: 'center',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '7px',
        },
        children: [timer],
    });
    const modeLabel = createElement('div', {
        text: isDemo ? 'MODO DEMO' : 'D100 · ERG',
        styles: {
            justifySelf: 'end',
            padding: '9px 13px',
            borderRadius: '999px',
            background: isDemo ? 'rgba(255,204,0,.16)' : 'rgba(0,212,170,.15)',
            color: isDemo ? colors.warning : colors.success,
            fontSize: typography.sizes.xs,
            fontWeight: 700,
        },
    });
    top.append(blockLabel, clockStack, modeLabel);
    hud.appendChild(top);

    const stagePrompt = createElement('div', {
        text: 'Alcanza al guía y entra en ritmo',
        styles: {
            position: 'absolute',
            top: '102px',
            left: '50%',
            transform: 'translateX(-50%)',
            padding: '8px 14px',
            borderRadius: '12px',
            color: 'rgba(255,255,255,.86)',
            background: 'rgba(5,12,16,.52)',
            backdropFilter: 'blur(10px)',
            fontSize: typography.sizes.sm,
            fontWeight: 700,
            letterSpacing: '.3px',
            maxWidth: 'min(540px, 72vw)',
            textAlign: 'center',
            opacity: '0',
            transition: 'opacity .28s ease, transform .28s ease',
        },
    });
    hud.appendChild(stagePrompt);

    const routeProgress = div({
        styles: {
            width: 'min(320px, 42vw)',
            height: '3px',
            borderRadius: '999px',
            overflow: 'hidden',
            background: 'rgba(5,12,16,.4)',
        },
    });
    const routeProgressFill = div({
        styles: {
            width: '0%',
            height: '100%',
            borderRadius: '999px',
            background: 'linear-gradient(90deg, #63e0b5, #ffd379)',
            boxShadow: '0 0 16px rgba(99,224,181,.6)',
            transition: 'width .5s ease',
        },
    });
    routeProgress.appendChild(routeProgressFill);
    clockStack.appendChild(routeProgress);

    const blockTimer = createElement('span', {
        text: 'BLOQUE --:--',
        styles: { color: 'rgba(255,255,255,.66)', fontFamily: typography.fontMono, fontSize: '11px', fontWeight: 800 },
    });
    clockStack.appendChild(blockTimer);

    const bottom = div({
        styles: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' },
    });
    const flowBar = div({
        attrs: {
            'aria-label': 'Potencia actual, escala hasta el doble del objetivo',
            title: 'Potencia · la marca indica el objetivo',
        },
        styles: {
            position: 'relative',
            width: '100%',
            height: '5px',
            borderRadius: '999px',
            overflow: 'hidden',
            background: 'rgba(255,255,255,.1)',
        },
    });
    const flowFill = div({
        styles: {
            width: '0%',
            height: '100%',
            borderRadius: '999px',
            background: `linear-gradient(90deg, ${colors.error}, ${colors.warning} 35%, ${colors.success} 50%, #5cc8ff 100%)`,
            transition: 'width .3s ease',
        },
    });
    const targetMarker = div({
        attrs: { title: 'Potencia objetivo' },
        styles: {
            position: 'absolute',
            zIndex: 1,
            left: '50%',
            top: '-3px',
            width: '2px',
            height: '14px',
            borderRadius: '2px',
            background: '#fff',
            boxShadow: '0 0 8px rgba(255,255,255,.85)',
        },
    });
    flowBar.append(flowFill, targetMarker);
    const metrics = div({
        attrs: { 'data-hud-mode': visualSettings.hud },
        styles: {
            width: 'min(520px, 90vw)',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
            padding: '10px 14px 11px',
            borderRadius: '16px',
            background: 'linear-gradient(145deg, rgba(6,13,17,.84), rgba(11,25,28,.7))',
            border: '1px solid rgba(255,255,255,.11)',
            boxShadow: '0 10px 30px rgba(0,0,0,.28)',
            backdropFilter: 'blur(14px)',
        },
    });
    const actualPower = createElement('strong', { text: '0 W', styles: { fontSize: '28px', lineHeight: 1 } });
    const targetPower = createElement('span', {
        text: 'Objetivo -- W',
        styles: { color: 'rgba(255,255,255,.52)', flex: '1 1 92px', fontSize: '13px', fontWeight: 750 },
    });
    const actualHeartRate = createElement('span', {
        text: '♥ -- lpm',
        styles: { color: '#ff7893', fontWeight: 800, whiteSpace: 'nowrap' },
    });
    const actualCadence = createElement('span', { text: '0 rpm', styles: { color: 'rgba(255,255,255,.78)', fontSize: '13px', fontWeight: 750 } });
    const combo = createElement('span', { text: 'FLOW 0%', styles: { color: colors.primary, fontSize: '11px', fontWeight: 800 } });
    const coach = createElement('strong', {
        text: 'Adapta el ritmo',
        attrs: { role: 'status', 'aria-live': 'polite' },
        styles: { fontSize: '16px', color: '#8ed9ff', letterSpacing: '.2px', textAlign: 'center' },
    });
    const heartZone = createElement('span', { text: 'ZONA FC --', styles: { color: 'rgba(255,255,255,.58)', fontSize: '12px' } });
    const ghostDelta = createElement('span', { text: '', styles: { color: '#8ed9ff', fontSize: '12px', fontWeight: 800 } });
    const metricValues = div({
        styles: {
            display: 'flex',
            gap: '14px',
            alignItems: 'baseline',
        },
        children: [actualPower, targetPower, actualCadence],
    });
    const contextValues = div({
        styles: { display: 'flex', justifyContent: 'center', gap: '12px', flexWrap: 'wrap', color: 'rgba(255,255,255,.5)' },
        children: [actualHeartRate, heartZone, combo, ghostDelta],
    });
    metrics.append(coach, flowBar, metricValues, contextValues);
    bottom.append(metrics);
    hud.appendChild(bottom);

    // Perfil del entrenamiento, vueltas/series y clasificación del pelotón.
    const workoutStrip = createWorkoutStrip({ workout, ftp: state.settings.ftp, totalDuration });
    const lapTracker = new LapTracker();
    const lapToast = createLapToast();
    const racePanel = createRacePanel();
    racePanel.setEnabled(visualSettings.rivals !== false);
    bottom.prepend(workoutStrip.element);
    hud.append(lapToast.element, racePanel.element);
    routeProgress.style.display = 'none'; // el perfil del entrenamiento ya muestra el avance
    const applyHudExtras = () => {
        racePanel.setMode(visualSettings.hud);
        workoutStrip.element.style.opacity = visualSettings.hud === 'hidden' ? '0' : '1';
    };
    applyHudExtras();

    const controls = div({
        styles: {
            position: 'absolute',
            right: '18px',
            bottom: '18px',
            display: 'flex',
            justifyContent: 'flex-end',
            flexWrap: 'wrap',
            gap: spacing.sm,
            maxWidth: 'calc(100vw - 36px)',
            pointerEvents: 'auto',
        },
    });
    const pauseButton = button({
        text: 'Pausar',
        attrs: { 'aria-label': 'Pausar expedición', disabled: 'true' },
        styles: compactButtonStyles(),
    });
    const finishButton = button({
        text: 'Finalizar',
        attrs: { 'aria-label': 'Finalizar expedición', disabled: 'true' },
        styles: { ...compactButtonStyles(), color: colors.error },
    });
    const cameraButton = button({
        text: `CAM · ${cameraLabel(visualSettings.camera)}`,
        attrs: { 'aria-label': 'Cambiar cámara' },
        styles: toolbarButtonStyles(),
    });
    const hudButton = button({
        text: `HUD · ${hudLabel(visualSettings.hud)}`,
        attrs: { 'aria-label': 'Cambiar información visible' },
        styles: toolbarButtonStyles(),
    });
    const visualControls = div({
        styles: {
            position: 'absolute',
            top: '72px',
            right: '18px',
            display: 'flex',
            gap: '3px',
            flexWrap: 'wrap',
            justifyContent: 'flex-end',
            pointerEvents: 'auto',
            padding: '4px',
            borderRadius: '14px',
            background: 'rgba(5,12,16,.58)',
            border: '1px solid rgba(255,255,255,.1)',
            backdropFilter: 'blur(12px)',
        },
        children: [cameraButton, hudButton],
    });
    controls.append(pauseButton, finishButton);
    container.appendChild(visualControls);
    container.appendChild(controls);

    const decisionOverlay = div({
        attrs: { role: 'dialog', 'aria-label': 'Elige una ruta' },
        styles: {
            position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%, -50%)',
            width: 'min(760px, calc(100vw - 28px))', display: 'none', zIndex: 5,
            padding: '20px', borderRadius: '24px', background: 'rgba(5,12,16,.94)',
            border: '1px solid rgba(255,255,255,.18)', boxShadow: '0 28px 90px rgba(0,0,0,.55)',
            pointerEvents: 'auto', backdropFilter: 'blur(16px)', textAlign: 'center',
        },
    });
    const decisionTitle = createElement('h2', { text: 'Elige tu ruta', styles: { margin: '0 0 6px' } });
    const decisionCountdown = createElement('p', { text: 'Ruta segura en 8 s', styles: { color: colors.textMuted, margin: '0 0 16px' } });
    const decisionButtons = div({ styles: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' } });
    decisionOverlay.append(decisionTitle, decisionCountdown, decisionButtons);
    container.appendChild(decisionOverlay);

    const briefing = div({
        styles: {
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: spacing.lg,
            background: 'rgba(5,7,12,.58)',
            backdropFilter: 'blur(9px)',
        },
    });
    const card = div({
        styles: {
            width: 'min(680px, 94vw)',
            maxHeight: '90vh',
            overflowY: 'auto',
            padding: 'clamp(22px, 4vw, 36px)',
            borderRadius: '30px',
            background: 'linear-gradient(145deg, rgba(18,34,39,.96), rgba(7,13,18,.98))',
            border: '1px solid rgba(255,255,255,.13)',
            boxShadow: '0 30px 100px rgba(0,0,0,.62)',
        },
    });
    card.append(
        createElement('div', {
            text: `${mission.title.toUpperCase()} · V${mission.version}`,
            styles: { color: '#75ebc1', fontSize: typography.sizes.xs, fontWeight: 800, letterSpacing: '1.8px' },
        }),
        createElement('h1', {
            text: workout?.name || 'Entrenamiento libre',
            styles: {
                margin: '10px 0 6px',
                fontFamily: typography.fontDisplay,
                fontSize: 'clamp(30px, 6vw, 46px)',
                lineHeight: 1,
            },
        }),
        createElement('p', {
            text: isDemo
                ? 'Cruza el valle, alcanza al guía y conquista la cima con potencia simulada.'
                : 'Tu esfuerzo mueve al ciclista. Mantén el objetivo para alcanzar al guía, superar el puerto y abrir el paso hacia la cima.',
            styles: { color: 'rgba(255,255,255,.64)', lineHeight: 1.6, marginBottom: spacing.md },
        }),
    );

    const missionStats = div({
        styles: {
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: spacing.sm,
            margin: `${spacing.md} 0 ${spacing.lg}`,
        },
        children: [
            briefingStat('DURACIÓN', formatTime(workout?.stats?.totalDuration || 0)),
            briefingStat('TERRENO', mission.terrain || 'Ruta mixta'),
            briefingStat('MISIÓN', mission.objective || 'Completar'),
        ],
    });
    card.appendChild(missionStats);

    const visualConfig = div({
        styles: {
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
            gap: spacing.sm,
            marginBottom: spacing.lg,
        },
    });
    const expeditionWorkouts = availableWorkouts.filter((candidate) => candidate?.mission && candidate.id);
    if (workout?.id && !expeditionWorkouts.some((candidate) => candidate.id === workout.id)) {
        expeditionWorkouts.unshift(workout);
    }
    if (expeditionWorkouts.length > 1) {
        const workoutSelect = configSelect(
            'Entrenamiento · duración',
            expeditionWorkouts.map((candidate) => [
                candidate.id,
                `${candidate.name} · ${formatTime(candidate.stats?.totalDuration || 0)}`,
            ]),
            workout.id,
        );
        workoutSelect.select.addEventListener('change', () => {
            const nextWorkout = expeditionWorkouts.find((candidate) => candidate.id === workoutSelect.select.value);
            if (nextWorkout && nextWorkout.id !== workout.id) onSelectWorkout?.(nextWorkout);
        });
        visualConfig.appendChild(workoutSelect.wrapper);
    }
    const cameraSelect = configSelect('Cámara', [
        ['close', 'Cercana'],
        ['standard', 'Dinámica'],
        ['wide', 'Panorámica'],
    ], visualSettings.camera);
    const hudSelect = configSelect('Datos en pantalla', [
        ['essential', 'Esenciales'],
        ['full', 'Completos'],
        ['hidden', 'Inmersivo'],
    ], visualSettings.hud);
    const qualitySelect = configSelect('Calidad', [
        ['auto', 'Automática'],
        ['low', 'Baja'],
        ['medium', 'Equilibrada'],
        ['high', 'Alta'],
    ], visualSettings.quality);
    const rivalsSelect = configSelect('Pelotón', [
        ['on', 'Con rivales'],
        ['off', 'En solitario'],
    ], visualSettings.rivals === false ? 'off' : 'on', 'Ciclistas que rueden contigo y clasificación en vivo.');
    visualConfig.append(cameraSelect.wrapper, hudSelect.wrapper, qualitySelect.wrapper, rivalsSelect.wrapper);
    card.appendChild(visualConfig);
    const startButton = button({
        text: canResume
            ? 'Empezar desde cero'
            : (isDemo ? 'Probar expedición' : 'Comenzar expedición'),
        styles: {
            width: '100%',
            minHeight: '52px',
            border: 0,
            borderRadius: '15px',
            background: `linear-gradient(135deg, ${colors.primary}, ${colors.primaryLight})`,
            color: '#101010',
            fontWeight: 800,
            cursor: 'pointer',
        },
    });
    const resumeButton = canResume ? button({
        text: `Continuar · quedan ${formatTime(totalDuration - recoveredElapsed)}`,
        styles: {
            ...compactButtonStyles(),
            width: '100%',
            minHeight: '52px',
            marginBottom: spacing.sm,
            color: colors.success,
            borderColor: 'rgba(99,224,181,.38)',
        },
    }) : null;
    const backButton = button({
        text: 'Volver a entrenamientos',
        styles: { ...compactButtonStyles(), width: '100%', marginTop: spacing.sm },
        events: { click: onExit },
    });
    if (resumeButton) card.appendChild(resumeButton);
    card.append(startButton, backButton);
    briefing.appendChild(card);
    container.appendChild(briefing);

    let renderer;
    let controller;
    const removeSessionDebugHooks = installSessionDebugHooks();
    let unsubscribe;
    let connectionLost = false;
    let connectionPausePromise = null;
    let demoInterval;
    let currentTarget = null;
    let lastFlow = 0;
    let hiddenAt = null;
    let promptTimeout = null;
    let finishConfirmTimeout = null;
    let decisionTimeout = null;
    let decisionInterval = null;
    let activeDecision = null;
    let ghostSession = null;
    let latestTick = null;
    let lastCountdownSecond = null;
    let previousCoachStatus = 'adapting';
    const reachedCheckpoints = new Set();
    const shownDecisions = new Set();
    const blockTypeCounts = new Map();
    const audio = new AudioCueService({
        enabled: state.settings.soundEnabled,
        vibrationEnabled: state.settings.vibrationEnabled,
        volume: state.settings.soundVolume ?? 0.55,
    });
    const wakeLock = new WakeLockManager();

    const rendererReady = initializeRenderer();
    const applyResponsiveLayout = () => {
        const compact = window.innerWidth < 600;
        blockLabel.style.maxWidth = compact ? '126px' : '';
        blockLabel.style.fontSize = compact ? '10px' : typography.sizes.xs;
        timer.style.fontSize = compact ? '20px' : '24px';
        timer.style.padding = compact ? '9px 13px' : '10px 18px';
        modeLabel.style.maxWidth = compact ? '76px' : '';
        modeLabel.style.textAlign = compact ? 'center' : '';
        routeProgress.style.width = compact ? '42vw' : 'min(320px, 42vw)';
        visualControls.style.top = compact ? '112px' : '72px';
        visualControls.style.left = compact ? '12px' : '';
        visualControls.style.right = compact ? '12px' : '18px';
        visualControls.style.justifyContent = compact ? 'center' : 'flex-end';
        stagePrompt.style.top = compact ? '164px' : '102px';
        racePanel.setCompact(compact);
        lapToast.setCompact(compact);
        stagePrompt.style.maxWidth = compact ? '82vw' : 'min(540px, 72vw)';
        controls.style.right = compact ? '12px' : '18px';
        controls.style.bottom = compact ? '136px' : '18px';
        metrics.style.width = compact ? 'calc(100vw - 24px)' : 'min(520px, 90vw)';
        metricValues.style.gap = compact ? '11px' : '18px';
        decisionButtons.style.gridTemplateColumns = compact ? '1fr' : 'repeat(3, 1fr)';
    };
    applyResponsiveLayout();
    window.addEventListener('resize', applyResponsiveLayout);

    async function initializeRenderer() {
        try {
            const { createExpeditionRenderer3D } = await import('../expedition/ExpeditionRenderer3D.js');
            renderer = createExpeditionRenderer3D(canvas, {
                cameraMode: visualSettings.camera,
                quality: visualSettings.quality,
                reducedMotion: visualSettings.reducedMotion,
                mission,
            });
        } catch (error) {
            console.error('No se pudo iniciar Valle de Aurora en 3D:', error);
            const { createExpeditionRenderer } = await import('../expedition/ExpeditionRenderer.js');
            renderer = createExpeditionRenderer(canvas);
            loadingScene.querySelector('span').textContent = 'Modo visual compatible activado';
        } finally {
            requestAnimationFrame(() => {
                loadingScene.style.opacity = '0';
                setTimeout(() => loadingScene.remove(), 550);
            });
        }
        return renderer;
    }

    async function startMission({ resume = false } = {}) {
        visualSettings.camera = cameraSelect.select.value;
        visualSettings.hud = hudSelect.select.value;
        visualSettings.quality = qualitySelect.select.value;
        visualSettings.rivals = rivalsSelect.select.value !== 'off';
        saveVisualSettings(visualSettings);
        applyHudMode(visualSettings.hud, {
            top,
            stagePrompt,
            routeProgress,
            flowBar,
            metrics,
            actualCadence,
            combo,
            contextValues,
        });
        applyHudExtras();
        await rendererReady;
        renderer?.setCameraMode?.(visualSettings.camera);
        renderer?.setQuality?.(visualSettings.quality);
        briefing.style.display = 'none';
        audio.unlock();
        ghostSession = await getPersonalGhost(mission).catch(() => null);
        ghostDelta.textContent = ghostSession ? 'GHOST · MEJOR MARCA' : 'SIN GHOST COMPATIBLE';
        renderer?.update({ ghostVisible: Boolean(ghostSession), raceEnabled: visualSettings.rivals !== false });
        racePanel.setEnabled(visualSettings.rivals !== false);
        trackProductEvent('mission_started', { missionId: mission.id, missionVersion: mission.version, demo: isDemo });
        trackProductEvent('render_preset', { missionId: mission.id, quality: visualSettings.quality });
        if (ghostSession) trackProductEvent('ghost_selected', { missionId: mission.id, source: 'personal_best' });
        pauseButton.disabled = false;
        finishButton.disabled = false;
        if (!resume) {
            await clearActiveSession().catch(() => null);
            state.recoveredSession = null;
        }
        controller = new SessionController({
            bluetoothManager: isDemo ? null : state.bluetoothManager,
            capabilities: state.deviceCapabilities,
            ftp: state.settings.ftp,
            onStateChange: (sessionState, session) => {
                controller?.debug?.log('view.state.change', {
                    state: sessionState,
                    elapsedSeconds: session?.elapsedTime,
                    connectionState: state.connectionState,
                    documentVisibility: document.visibilityState,
                });
                renderer?.update({ paused: sessionState !== SESSION_STATE.RUNNING });
                if (sessionState === SESSION_STATE.COMPLETED) {
                    showResult(session).catch((error) => {
                        logActiveSessionError('view.show_result.error', error);
                        console.error('No se pudo guardar el progreso:', error);
                    });
                }
            },
            onTargetChange: (target, result) => {
                currentTarget = target;
                targetPower.textContent = target.power ? `Objetivo ${target.power} W` : 'Objetivo libre';
                modeLabel.textContent = isDemo ? 'MODO DEMO' : result.mode.toUpperCase();
                if (result.error) showStagePrompt(result.error);
                if (result.error) trackProductEvent('trainer_control_error', { missionId: mission.id, mode: result.mode });
            },
            onBlockChange: (block) => {
                controller?.debug?.log('view.block.change', { block });
                blockLabel.textContent = String(block.name || 'TRAMO').toUpperCase();
                showStagePrompt(getStagePrompt(block.type));
                renderer?.update({ blockType: block.type });
                const finishedLap = lapTracker.start(block, block.index ?? 0);
                if (finishedLap?.work) lapToast.show(finishedLap);
                workoutStrip.setBlock(block, block.index ?? 0);
                lastCountdownSecond = null;
                audio.cue('block');
                const count = (blockTypeCounts.get(block.type) || 0) + 1;
                blockTypeCounts.set(block.type, count);
                const decision = (mission.decisions || []).find((candidate) => (
                    candidate.blockType === block.type
                    && (candidate.occurrence || 1) === count
                    && !shownDecisions.has(candidate.id)
                ));
                if (decision) showRouteDecision(decision);
            },
            onTick: (tick) => {
                latestTick = tick;
                timer.textContent = formatTime(Math.max(0, totalDuration - tick.totalElapsedTime));
                blockTimer.textContent = `BLOQUE ${formatTime(tick.blockRemainingTime)}`;
                const progress = Math.max(0, Math.min(1, tick.totalElapsedTime / totalDuration));
                routeProgressFill.style.width = `${Math.round(progress * 100)}%`;
                renderer?.update({ progress });
                workoutStrip.setProgress(tick.totalElapsedTime);
                racePanel.update(renderer?.getRaceStatus?.());
                const countdown = Math.ceil(tick.blockRemainingTime);
                if (countdown >= 1 && countdown <= 3 && countdown !== lastCountdownSecond) {
                    lastCountdownSecond = countdown;
                    showStagePrompt(String(countdown));
                    audio.cue('countdown');
                }
                for (const checkpoint of mission.checkpoints || []) {
                    if (progress < checkpoint.progress || reachedCheckpoints.has(checkpoint.id)) continue;
                    reachedCheckpoints.add(checkpoint.id);
                    const reached = controller?.addCheckpoint({ id: checkpoint.id, elapsedSeconds: tick.totalElapsedTime });
                    showStagePrompt(reached?.boost ? 'CHECKPOINT · IMPULSO FLOW' : 'CHECKPOINT ALCANZADO');
                    audio.cue('checkpoint');
                }
                if (ghostSession) {
                    const ghostPoint = interpolateGhost(ghostSession.gameResult.ghostTrace, tick.totalElapsedTime);
                    const ownFlow = lastFlow;
                    const difference = ownFlow - (ghostPoint?.flow || 0);
                    ghostDelta.textContent = `GHOST ${difference >= 0 ? '+' : ''}${Math.round(difference * 100)} FLOW`;
                    renderer?.update({
                        ghostVisible: true,
                        ghostRouteProgress: ghostPoint?.progress ?? progress,
                        ghostProgress: Math.max(0, Math.min(1, ghostPoint?.flow ?? 0.5)),
                    });
                }
            },
        });
        await controller.start({
            workout,
            mission,
            experienceMode: 'expedition',
            recoveredSession: resume ? recoveredSession : null,
        });
        await wakeLock.acquire();

        if (isDemo) {
            demoInterval = setInterval(() => {
                const target = currentTarget?.power || state.settings.ftp * 0.65;
                const wave = Math.sin(Date.now() / 2600) * target * 0.07;
                ingest({ power: Math.round(target + wave), cadence: 88, speed: 28, heartRate: 135 });
            }, 250);
        } else {
            unsubscribe = subscribeToState?.((nextState) => {
                if (nextState.connectionState !== 'connected') {
                    if (!connectionLost) {
                        connectionLost = true;
                        controller?.debug?.log('connection.lost', {
                            connectionState: nextState.connectionState,
                            elapsedSeconds: latestTick?.totalElapsedTime || 0,
                        });
                        showStagePrompt('Rodillo desconectado · sesión pausada');
                    }
                    if (controller?.state === SESSION_STATE.RUNNING && !connectionPausePromise) {
                        connectionPausePromise = controller.pause()
                            .catch((error) => logActiveSessionError('connection.pause.error', error))
                            .finally(() => { connectionPausePromise = null; });
                    }
                    return;
                }

                if (connectionLost) {
                    connectionLost = false;
                    controller?.debug?.log('connection.restored', {
                        elapsedSeconds: latestTick?.totalElapsedTime || 0,
                    });
                    showStagePrompt('Rodillo reconectado · pulsa Reanudar');
                }
                ingest(nextState.liveData);
            });
        }
    }

    function ingest(data) {
        const target = Math.max(0, Number(currentTarget?.power) || 0);
        const flow = controller?.ingestBikeData(data);
        if (!flow) return;
        const frame = flow.telemetry;
        const power = Math.max(0, frame.display.power || 0);
        const cadence = Math.max(0, frame.display.cadence || 0);
        const hr = frame.display.heartRate;
        actualPower.textContent = `${Math.round(power)} W`;
        actualCadence.textContent = `${Math.round(cadence)} rpm`;
        actualHeartRate.textContent = hr ? `♥ ${Math.round(hr)} lpm` : '♥ -- lpm';
        const hrZone = getHeartRateZone(hr, state.settings.maxHR, state.settings.restingHR);
        heartZone.textContent = hrZone ? `Z${hrZone.zone} · ${hrZone.name}` : (frame.quality.heartRate === 'stale' ? 'FC RECONECTANDO' : 'ZONA FC --');
        heartZone.style.color = hrZone?.color || 'rgba(255,255,255,.58)';
        const gaugeMaximum = Math.max(400, state.settings.ftp * 1.5, target * 1.5, power * 1.12);
        flowFill.style.width = `${Math.min(100, (power / gaugeMaximum) * 100)}%`;
        targetMarker.style.display = target > 0 ? 'block' : 'none';
        targetMarker.style.left = `${Math.min(100, (target / gaugeMaximum) * 100)}%`;
        flowBar.setAttribute('aria-label', `Potencia ${Math.round(power)} vatios; objetivo ${target || 'libre'}; escala ${Math.round(gaugeMaximum)}`);
        lapTracker.sample(power, target, latestTick?.blockElapsedTime || 0);
        workoutStrip.setAverage(lapTracker.average());
        lastFlow = lastFlow * 0.66 + flow.flow * 0.34;
        combo.textContent = `FLOW ${Math.round(lastFlow * 100)}%`;
        const coaching = getCoachingState({
            power: frame.control.power,
            targetPower: currentTarget?.power,
            cadence: frame.control.cadence,
            targetCadence: currentTarget?.cadence,
            secondsInBlock: latestTick?.blockElapsedTime || 0,
        });
        coach.textContent = coaching.message;
        coach.style.color = coaching.color;
        if (previousCoachStatus !== 'good' && coaching.status === 'good') audio.cue('good');
        if (previousCoachStatus !== 'off' && coaching.status === 'off' && flow.combo === 0) audio.cue('lost');
        previousCoachStatus = coaching.status;
        renderer?.update({
            flow: lastFlow,
            power,
            cadence,
            speed: frame.display.speed || 0,
            targetPower: currentTarget?.power || 0,
            ghostProgress: Math.max(0.1, Math.min(0.95, 0.62 + (lastFlow - 0.75) * 0.5)),
            paused: false,
        });
    }

    function showRouteDecision(decision) {
        if (activeDecision || shownDecisions.has(decision.id)) return;
        activeDecision = decision;
        shownDecisions.add(decision.id);
        let remaining = 8;
        decisionTitle.textContent = 'Elige tu ruta · el entrenamiento no cambia';
        decisionCountdown.textContent = `Ruta segura en ${remaining} s`;
        decisionButtons.replaceChildren();
        const routes = [
            ['safe', 'Ruta segura', 'Protege el combo'],
            ['technical', 'Atajo técnico', 'Más precisión · más prestigio'],
            ['scenic', 'Ruta panorámica', 'Exploración y coleccionables'],
        ];
        for (const [choice, label, description] of routes) {
            decisionButtons.appendChild(button({
                text: `${label}\n${description}`,
                styles: { ...compactButtonStyles(), minHeight: '76px', whiteSpace: 'pre-line', color: choice === 'safe' ? colors.success : colors.text },
                events: { click: () => resolveRouteDecision(choice, false) },
            }));
        }
        decisionOverlay.style.display = 'block';
        decisionInterval = setInterval(() => {
            remaining--;
            decisionCountdown.textContent = `Ruta segura en ${Math.max(0, remaining)} s`;
        }, 1000);
        decisionTimeout = setTimeout(() => resolveRouteDecision('safe', true), 8000);
    }

    function resolveRouteDecision(choice, automatic) {
        if (!activeDecision) return;
        const decision = controller?.chooseRoute({
            id: activeDecision.id,
            choice,
            automatic,
            elapsedSeconds: latestTick?.totalElapsedTime || 0,
        });
        clearInterval(decisionInterval);
        clearTimeout(decisionTimeout);
        decisionInterval = null;
        decisionTimeout = null;
        decisionOverlay.style.display = 'none';
        activeDecision = null;
        showStagePrompt(`${routeChoiceLabel(decision?.choice || choice)} seleccionada`);
        renderer?.update({ routeChoice: decision?.choice || choice });
        trackProductEvent('route_decision', { missionId: mission.id, choice: decision?.choice || choice, automatic });
    }

    function showStagePrompt(message) {
        if (promptTimeout) clearTimeout(promptTimeout);
        stagePrompt.textContent = message;
        if (visualSettings.hud !== 'hidden') {
            stagePrompt.style.opacity = '1';
            stagePrompt.style.transform = 'translateX(-50%) translateY(0)';
        }
        promptTimeout = setTimeout(() => {
            stagePrompt.style.opacity = '0';
            stagePrompt.style.transform = 'translateX(-50%) translateY(-6px)';
        }, 5200);
    }

    async function showResult(session) {
        cleanupRuntime();
        await wakeLock.release();
        const result = session.gameResult || {};
        const { gainedXp, progress } = await recordMissionProgress(session);
        audio.cue(session.status === 'completed' ? 'finish' : 'lost');
        trackProductEvent(session.status === 'completed' ? 'mission_completed' : 'mission_abandoned', {
            missionId: mission.id, missionVersion: mission.version, score: result.score || 0,
        });
        onProgress?.(progress);
        const completed = session.status === 'completed';
        const blockResults = div({
            styles: { display: 'grid', gap: '8px', width: '100%', marginBottom: spacing.lg },
            children: (result.blocks || []).map((block) => div({
                styles: {
                    display: 'grid', gridTemplateColumns: '1fr auto auto', gap: '12px', alignItems: 'center',
                    padding: '10px 12px', borderRadius: '12px', background: 'rgba(255,255,255,.05)',
                },
                children: [
                    createElement('strong', { text: block.name }),
                    createElement('span', { text: `${Math.round((block.powerAdherence ?? block.adherence) * 100)}% potencia`, styles: { color: colors.textMuted, fontSize: '12px' } }),
                    createElement('span', { text: `${block.stars} ★`, styles: { color: colors.warning, fontWeight: 800 } }),
                ],
            })),
        });
        card.replaceChildren(
            createElement('div', {
                text: completed ? 'MISIÓN COMPLETADA' : 'EXPEDICIÓN FINALIZADA ANTES DE TIEMPO',
                styles: { color: completed ? colors.success : colors.warning, fontWeight: 800, letterSpacing: '1.5px' },
            }),
            createElement('h1', {
                text: `${result.totalStars || 0} ★`,
                styles: { margin: '12px 0 4px', fontSize: '52px', color: colors.warning },
            }),
            createElement('p', {
                text: `${Math.round((result.adherence || 0) * 100)}% de adherencia · ${result.score || 0} puntos`,
                styles: { color: colors.textMuted, marginBottom: spacing.lg },
            }),
            createElement('p', {
                text: `${visualSettings.rivals !== false && renderer?.getRaceStatus ? `Pelotón: ${renderer.getRaceStatus().rank}º de ${renderer.getRaceStatus().total} · ` : ''}${gainedXp > 0 ? `+${gainedXp} XP · ` : ''}Nivel ${progress.level} · ${Math.round(progress.weekly.activeMinutes)}/${progress.weekly.goalMinutes} min esta semana`,
                styles: { color: colors.primary, marginBottom: spacing.lg, fontWeight: 700 },
            }),
            createLapTable(lapTracker.laps) || div(),
            blockResults,
            createElement('p', {
                text: result.adherence >= 0.9 ? 'Excelente precisión. Prueba una ruta técnica en la próxima expedición.'
                    : result.adherence >= 0.75 ? 'Buen ritmo. Tu siguiente mejora está en mantener la potencia durante los cambios.'
                        : 'Busca primero estabilidad: suaviza las transiciones y deja que el ERG se adapte.',
                styles: { color: colors.textMuted, lineHeight: 1.5, margin: `0 0 ${spacing.md}` },
            }),
            button({
                text: 'Ver historial',
                styles: { ...compactButtonStyles(), width: '100%', minHeight: '52px', color: colors.success },
                events: { click: () => onCompleted?.(session) },
            }),
        );
        briefing.style.display = 'flex';
    }

    cameraButton.addEventListener('click', () => {
        visualSettings.camera = cycleValue(
            visualSettings.camera,
            ['close', 'standard', 'wide'],
        );
        cameraButton.textContent = `CAM · ${cameraLabel(visualSettings.camera)}`;
        cameraSelect.select.value = visualSettings.camera;
        renderer?.setCameraMode?.(visualSettings.camera);
        saveVisualSettings(visualSettings);
    });

    hudButton.addEventListener('click', () => {
        visualSettings.hud = cycleValue(
            visualSettings.hud,
            ['essential', 'full', 'hidden'],
        );
        hudButton.textContent = `HUD · ${hudLabel(visualSettings.hud)}`;
        hudSelect.select.value = visualSettings.hud;
        applyHudMode(visualSettings.hud, {
            top,
            stagePrompt,
            routeProgress,
            flowBar,
            metrics,
            actualCadence,
            combo,
            contextValues,
        });
        applyHudExtras();
        saveVisualSettings(visualSettings);
    });

    pauseButton.addEventListener('click', async () => {
        if (!controller) return;
        if (controller.state === SESSION_STATE.RUNNING) {
            await controller.pause();
            await wakeLock.release();
            pauseButton.textContent = 'Reanudar';
        } else if (controller.state === SESSION_STATE.PAUSED) {
            await controller.resume();
            await wakeLock.acquire();
            pauseButton.textContent = 'Pausar';
        }
    });
    finishButton.addEventListener('click', () => {
        if (finishButton.dataset.confirmFinish === 'true') {
            if (finishConfirmTimeout) clearTimeout(finishConfirmTimeout);
            controller?.finish({ status: 'abandoned' });
            return;
        }
        finishButton.dataset.confirmFinish = 'true';
        finishButton.textContent = 'Confirmar fin';
        finishConfirmTimeout = setTimeout(() => {
            finishButton.dataset.confirmFinish = 'false';
            finishButton.textContent = 'Finalizar';
        }, 4000);
    });
    startButton.addEventListener('click', () => startMission({ resume: false }));
    resumeButton?.addEventListener('click', () => startMission({ resume: true }));

    const handleVisibility = async () => {
        if (document.visibilityState === 'hidden') {
            hiddenAt = Date.now();
            controller?.debug?.log('document.hidden', { at: hiddenAt });
            return;
        }
        const wasAway = hiddenAt && Date.now() - hiddenAt > 3000;
        controller?.debug?.log('document.visible', {
            awayMs: hiddenAt ? Date.now() - hiddenAt : 0,
            wasAway,
            controllerState: controller?.state,
        });
        hiddenAt = null;
        if (wasAway && controller?.state === SESSION_STATE.RUNNING) {
            controller.debug?.log('visibility.auto_pause', { reason: 'hidden_more_than_3s' });
            await controller.pause();
            await wakeLock.release();
            pauseButton.textContent = 'Reanudar';
        }
    };
    document.addEventListener('visibilitychange', handleVisibility);

    function cleanupRuntime() {
        controller?.debug?.log('view.cleanup_runtime', { controllerState: controller?.state });
        if (demoInterval) clearInterval(demoInterval);
        if (promptTimeout) clearTimeout(promptTimeout);
        if (finishConfirmTimeout) clearTimeout(finishConfirmTimeout);
        if (decisionTimeout) clearTimeout(decisionTimeout);
        if (decisionInterval) clearInterval(decisionInterval);
        if (unsubscribe) unsubscribe();
        lapToast.destroy();
        demoInterval = null;
        promptTimeout = null;
        finishConfirmTimeout = null;
        decisionTimeout = null;
        decisionInterval = null;
        unsubscribe = null;
    }

    container.cleanup = () => {
        cleanupRuntime();
        controller?.destroy();
        renderer?.destroy();
        document.removeEventListener('visibilitychange', handleVisibility);
        removeSessionDebugHooks();
        window.removeEventListener('resize', applyResponsiveLayout);
        wakeLock.release();
        audio.destroy();
    };
    return container;
}

function compactButtonStyles() {
    return {
        minHeight: '44px',
        padding: '10px 15px',
        borderRadius: '13px',
        border: '1px solid rgba(255,255,255,.14)',
        background: 'rgba(7,9,14,.8)',
        color: colors.text,
        cursor: 'pointer',
        fontWeight: 700,
        backdropFilter: 'blur(12px)',
    };
}

function toolbarButtonStyles() {
    return {
        minHeight: '36px',
        padding: '7px 10px',
        borderRadius: '10px',
        border: 0,
        background: 'transparent',
        color: 'rgba(255,255,255,.82)',
        cursor: 'pointer',
        fontSize: '11px',
        fontWeight: 800,
        letterSpacing: '.35px',
    };
}

function briefingStat(label, value) {
    return div({
        styles: {
            padding: '11px 12px',
            borderRadius: '13px',
            background: 'rgba(255,255,255,.055)',
            border: '1px solid rgba(255,255,255,.08)',
        },
        children: [
            createElement('span', {
                text: label,
                styles: {
                    display: 'block',
                    color: 'rgba(255,255,255,.42)',
                    fontSize: '10px',
                    fontWeight: 800,
                    letterSpacing: '1px',
                },
            }),
            createElement('strong', {
                text: value,
                styles: { display: 'block', marginTop: '4px', fontSize: typography.sizes.sm },
            }),
        ],
    });
}

function configSelect(label, options, selectedValue) {
    const select = createElement('select', {
        attrs: { 'aria-label': label },
        styles: {
            width: '100%',
            minHeight: '42px',
            marginTop: '6px',
            padding: '0 10px',
            borderRadius: '11px',
            border: '1px solid rgba(255,255,255,.12)',
            background: 'rgba(5,12,16,.82)',
            color: '#fff',
            fontWeight: 700,
        },
        children: options.map(([value, text]) => createElement('option', {
            text,
            attrs: { value, selected: value === selectedValue },
        })),
    });
    return {
        select,
        wrapper: div({
            styles: {
                padding: '10px 12px',
                borderRadius: '13px',
                background: 'rgba(255,255,255,.045)',
            },
            children: [
                createElement('span', {
                    text: label,
                    styles: { color: 'rgba(255,255,255,.5)', fontSize: typography.sizes.xs },
                }),
                select,
            ],
        }),
    };
}

function loadVisualSettings() {
    try {
        const saved = JSON.parse(localStorage.getItem(EXPEDITION_VISUAL_SETTINGS_KEY) || '{}');
        return { ...DEFAULT_VISUAL_SETTINGS, ...saved };
    } catch {
        return { ...DEFAULT_VISUAL_SETTINGS };
    }
}

function saveVisualSettings(settings) {
    try {
        localStorage.setItem(EXPEDITION_VISUAL_SETTINGS_KEY, JSON.stringify(settings));
    } catch {
        // Las preferencias visuales no deben bloquear un entrenamiento.
    }
}

function applyHudMode(mode, elements) {
    const hidden = mode === 'hidden';
    const full = mode === 'full';
    elements.top.style.opacity = hidden ? '0' : '1';
    if (hidden) elements.stagePrompt.style.opacity = '0';
    elements.routeProgress.style.opacity = hidden ? '0' : '1';
    elements.flowBar.style.display = hidden ? 'none' : 'block';
    elements.metrics.style.opacity = hidden ? '0' : '1';
    elements.metrics.style.pointerEvents = 'none';
    elements.actualCadence.style.display = hidden ? 'none' : 'inline';
    elements.contextValues.style.display = full && !hidden ? 'flex' : 'none';
    elements.combo.style.display = full && !hidden ? 'inline' : 'none';
}

function getStagePrompt(blockType) {
    const prompts = {
        warmup: 'Alcanza al guía y entra en ritmo',
        steady: 'Mantén el grupo · encuentra tu Flow',
        interval: 'Ataque en el puerto · no pierdas al rival',
        ramp: 'La cima está cerca · aumenta el esfuerzo',
        rest: 'Descenso de recuperación · suelta las piernas',
        cooldown: 'Regresa al valle · misión casi completada',
    };
    return prompts[blockType] || 'Mantén el objetivo y avanza';
}

function cameraLabel(camera) {
    return {
        close: 'Cercana',
        standard: 'Dinámica',
        wide: 'Panorámica',
    }[camera] || 'Dinámica';
}

function hudLabel(hud) {
    return {
        essential: 'Esencial',
        full: 'Completo',
        hidden: 'Inmersivo',
    }[hud] || 'Esencial';
}

function cycleValue(current, values) {
    const index = values.indexOf(current);
    return values[(index + 1) % values.length];
}

function routeChoiceLabel(choice) {
    return { safe: 'Ruta segura', technical: 'Atajo técnico', scenic: 'Ruta panorámica' }[choice] || 'Ruta segura';
}
