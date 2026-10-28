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
import { createWorkoutControls } from './workoutControls.js';
import './expedition-hud.css';
import { LapTracker, createClimbProfile, createLapTable, createLapToast, createMiniMap, createRacePanel, createWorkoutStrip } from './expeditionHud.js';
import { createAmbientAudio } from '../ride/AmbientAudio.js';
import { getSoundPrefs, saveSoundPrefs } from '../storage/settings.js';
import { expandBlocks, BLOCK_TYPES } from '../workouts/model.js';
import { loadVisualSettings, saveVisualSettings } from '../expedition/visualSettings.js';
import { summarizeIntensity } from '../session/intensitySummary.js';
import { createSessionFeedbackPanel } from '../components/SessionFeedbackPanel.js';

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
    let isDemo = state.connectionState !== 'connected';
    const mission = workout?.mission || {
        id: workout?.missionId || workout?.id,
        version: workout?.missionVersion || 1,
        title: 'Valle de Aurora', world: 'aurora', terrain: 'Valle · Puerto',
        objective: 'Completa el entrenamiento', checkpoints: [], decisions: [],
    };
    const visualSettings = loadVisualSettings();
    // Cambia si se salta o alarga un bloque (onPlanChange del controller).
    let totalDuration = Math.max(1, workout?.stats?.totalDuration || 1);
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
    container.classList.add('exp-hud');
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
            padding: '4px 9px',
            borderRadius: '999px',
            background: isDemo ? 'rgba(255,204,0,.12)' : 'rgba(0,212,170,.1)',
            color: isDemo ? colors.warning : colors.success,
            fontSize: '10px',
            fontWeight: 700,
            letterSpacing: '.6px',
            opacity: '.8',
        },
    });
    // El nombre del tramo ya sale en el panel del entrenamiento: arriba solo quedan las cifras.
    blockLabel.style.visibility = 'hidden';
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
            background: 'rgba(5,12,16,.76)',
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

    const bottom = div({
        styles: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' },
    });
    // Medidor de potencia (barra superior): relleno del color de la zona, banda ±5 % y marca del objetivo.
    const flowBar = div({
        className: 'hud-gauge',
        attrs: {
            'aria-label': 'Potencia actual, escala hasta el doble del objetivo',
            title: 'Potencia · la marca indica el objetivo',
        },
    });
    const flowFill = div({ className: 'hud-gauge__fill' });
    const targetMarker = div({ className: 'hud-gauge__target', attrs: { title: 'Potencia objetivo' } });
    const targetBand = div({ className: 'hud-gauge__band', attrs: { title: 'Zona objetivo ±5%' } });
    flowBar.append(targetBand, flowFill, targetMarker);
    // Panel inferior fino (consejo y barra de potencia): las cifras van arriba y el centro queda libre para la carretera.
    const metrics = div({
        attrs: { 'data-hud-mode': visualSettings.hud },
        styles: {
            width: 'min(440px, 86vw)',
            display: 'flex',
            flexDirection: 'column',
            gap: '6px',
            padding: '8px 14px 9px',
            borderRadius: '16px',
            background: 'linear-gradient(145deg, rgba(6,13,17,.84), rgba(11,25,28,.7))',
            border: '1px solid rgba(255,255,255,.11)',
            boxShadow: '0 10px 30px rgba(0,0,0,.28)',
        },
    });
    const actualPower = createElement('strong', { text: '0', className: 'hud-num hud-num--xl' });
    const targetPower = createElement('span', { text: 'Objetivo -- W', className: 'hud-sub' });
    const zoneChip = createElement('span', { text: 'Z1', className: 'hud-zone' });
    const heartIcon = createElement('span', { className: 'hud-heart', attrs: { 'aria-hidden': 'true' } });
    const actualHeartRate = createElement('strong', { text: '--', className: 'hud-num hud-num--lg', styles: { color: '#ff7893' } });
    const actualCadence = createElement('strong', { text: '0', className: 'hud-num hud-num--lg' });
    const targetCadence = createElement('span', { text: '', className: 'hud-sub' });
    const combo = createElement('span', { text: 'FLOW 0%', styles: { color: colors.primary, fontSize: '11px', fontWeight: 800 } });
    const coach = createElement('strong', {
        text: 'Adapta el ritmo',
        className: 'hud-coach',
        attrs: { role: 'status', 'aria-live': 'polite' },
    });
    const heartZone = createElement('span', { text: 'Sin pulso', className: 'hud-sub' });
    const ghostDelta = createElement('span', { text: '', styles: { color: '#8ed9ff', fontSize: '12px', fontWeight: 800 } });
    const unit = (text) => createElement('span', { text, className: 'hud-unit' });
    // Cada cifra: etiqueta, valor con su unidad y una línea de contexto.
    const stat = (label, valueRow, subEl, modifier = '') => div({
        className: `hud-stat${modifier ? ` hud-stat--${modifier}` : ''}`,
        children: [
            createElement('span', { text: label, className: 'hud-label' }),
            div({ className: 'hud-stat__value', children: valueRow }),
            subEl,
        ].filter(Boolean),
    });
    // Barra superior (como en Zwift): potencia, tiempo restante, pulso y cadencia de un vistazo.
    timer.removeAttribute('style');
    timer.className = 'hud-clock';
    const metricValues = div({
        className: 'hud-panel hud-topbar',
        styles: { '--hud-delay': '0.05s' },
        children: [
            stat('Potencia', [actualPower, unit('W'), zoneChip], div({ styles: { display: 'grid', gap: '6px' }, children: [flowBar, targetPower] }), 'power'),
            stat('Restante', [timer], null, 'clock'),
            stat('Pulso', [heartIcon, actualHeartRate, unit('lpm')], heartZone),
            stat('Cadencia', [actualCadence, unit('rpm')], targetCadence),
        ],
    });
    clockStack.prepend(metricValues);
    const contextValues = div({
        styles: { display: 'flex', justifyContent: 'center', gap: '12px', flexWrap: 'wrap', color: 'rgba(255,255,255,.5)' },
        children: [combo, ghostDelta],
    });
    metrics.append(coach, contextValues);
    bottom.append(metrics);
    hud.appendChild(bottom);

    // Perfil del entrenamiento, vueltas/series y clasificación del pelotón.
    let workoutStrip = createWorkoutStrip({ workout, ftp: state.settings.ftp, totalDuration });
    const lapTracker = new LapTracker();
    const lapToast = createLapToast();
    const racePanel = createRacePanel();
    racePanel.setEnabled(visualSettings.rivals !== false);
    const miniMap = createMiniMap();
    const climbProfile = createClimbProfile();
    // Un solo panel abajo: la barra del entrenamiento lleva debajo el consejo y la barra de potencia.
    const coachRow = div({
        styles: { display: 'grid', gap: '5px', paddingTop: '2px' },
        children: [coach, contextValues],
    });
    workoutStrip.element.append(coachRow);
    metrics.style.display = 'none';
    bottom.prepend(workoutStrip.element);
    hud.append(lapToast.element, racePanel.element, miniMap.element, climbProfile.element);
    routeProgress.style.display = 'none'; // el perfil del entrenamiento ya muestra el avance
    const applyHudExtras = () => {
        racePanel.setMode(visualSettings.hud);
        // Esencial: perfil del puerto; el minimapa solo en el modo completo.
        miniMap.setMode(visualSettings.hud === 'full' ? 'full' : 'hidden');
        climbProfile.setMode(visualSettings.hud);
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
            zIndex: 5,
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
        className: 'hud-btn',
    });
    const hudButton = button({
        text: `HUD · ${hudLabel(visualSettings.hud)}`,
        attrs: { 'aria-label': 'Cambiar información visible' },
        className: 'hud-btn',
    });
    // Sonido ambiente (viento, rodadura, rueda libre, público); la preferencia se comparte con el modo ruta.
    const ambient = createAmbientAudio();
    const soundPrefs = getSoundPrefs();
    ambient.setVolume(soundPrefs.volume);
    ambient.setEnabled(soundPrefs.enabled);
    const soundButton = button({
        text: `SONIDO · ${soundPrefs.enabled ? 'Sí' : 'No'}`,
        attrs: { 'aria-label': 'Activar o silenciar el sonido ambiente' },
        className: 'hud-btn',
    });
    const visualControls = div({
        className: 'hud-panel hud-toolbar',
        styles: {
            position: 'absolute',
            top: '72px',
            right: '18px',
            display: 'flex',
            gap: '2px',
            flexWrap: 'wrap',
            justifyContent: 'flex-end',
            pointerEvents: 'auto',
        },
        children: [cameraButton, hudButton, soundButton],
    });
    // Controles del entrenamiento (intensidad, saltar/alargar bloque, ERG), encima de pausa y finalizar.
    const changeIntensity = (percent) => {
        const applied = controller?.setIntensity(percent) ?? percent;
        workoutControls.setIntensity(applied);
        showStagePrompt(`Intensidad ${applied} %`);
    };
    const toggleErg = (enabled) => {
        const applied = controller?.setErgEnabled(enabled) ?? enabled;
        workoutControls.setErgEnabled(applied);
        showStagePrompt(applied ? 'ERG activado · el rodillo marca la potencia' : 'ERG desactivado · cambia libremente');
    };
    const workoutControls = createWorkoutControls({
        onIntensityChange: changeIntensity,
        onSkip: () => {
            if (controller?.skipBlock()) showStagePrompt('Bloque saltado');
        },
        onExtend: (seconds) => {
            if (controller?.extendBlock(seconds)) showStagePrompt(`Bloque alargado ${Math.round(seconds / 60)} min`);
        },
        onErgToggle: toggleErg,
    });
    workoutControls.setDisabled(true);
    Object.assign(controls.style, { flexDirection: 'column', alignItems: 'flex-end' });
    controls.append(workoutControls.element, div({
        styles: { display: 'flex', gap: spacing.sm, justifyContent: 'flex-end' },
        children: [pauseButton, finishButton],
    }));

    const pauseTitle = createElement('strong', {
        text: 'PAUSA',
        styles: { fontFamily: typography.fontDisplay, fontSize: 'clamp(40px, 10vw, 64px)', letterSpacing: '4px', lineHeight: 1 },
    });
    const pauseReason = createElement('p', {
        text: 'Tu sesión está detenida. El tiempo no corre.',
        styles: { margin: '10px 0 22px', color: 'rgba(255,255,255,.7)', fontSize: typography.sizes.sm },
    });
    const resumeBig = button({
        text: 'Reanudar',
        styles: { ...compactButtonStyles(), minHeight: '56px', padding: '0 34px', fontSize: '16px', color: colors.success, borderColor: 'rgba(99,224,181,.5)' },
    });
    const pauseOverlay = div({
        attrs: { role: 'dialog', 'aria-label': 'Sesión en pausa' },
        styles: {
            position: 'absolute', inset: 0, zIndex: 4, display: 'none', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center', textAlign: 'center',
            background: 'rgba(5,9,14,.62)', backdropFilter: 'blur(6px)', pointerEvents: 'auto',
        },
        children: [pauseTitle, pauseReason, resumeBig],
    });
    container.appendChild(pauseOverlay);
    container.appendChild(visualControls);
    container.appendChild(controls);

    // Como en Zwift/MyWhoosh, los controles solo aparecen un momento al mover el ratón, tocar o pulsar una tecla.
    const CHROME_VISIBLE_MS = 3000;
    const chrome = [visualControls, controls];
    let chromeTimer = null;
    let chromeHover = false;
    let chromeHintShown = false;
    const setChromeVisible = (visible) => chrome.forEach((element) => {
        element.style.opacity = visible ? '1' : '0';
        element.style.pointerEvents = visible ? 'auto' : 'none';
    });
    function showChrome() {
        clearTimeout(chromeTimer);
        setChromeVisible(true);
    }
    function revealChrome() {
        showChrome();
        if (controller?.state !== SESSION_STATE.RUNNING) return;
        chromeTimer = setTimeout(() => {
            if (!chromeHover) setChromeVisible(false);
        }, CHROME_VISIBLE_MS);
    }
    chrome.forEach((element) => {
        element.style.transition = 'opacity .3s ease';
        element.addEventListener('pointerenter', () => { chromeHover = true; showChrome(); });
        element.addEventListener('pointerleave', () => { chromeHover = false; revealChrome(); });
    });
    container.addEventListener('pointermove', revealChrome);
    container.addEventListener('pointerdown', revealChrome);

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
    const configDetails = createElement('details', {
        styles: { marginBottom: spacing.lg },
        children: [
            createElement('summary', {
                text: 'Ajustes de la sesión · cámara, datos, calidad y pelotón',
                styles: { cursor: 'pointer', color: 'rgba(255,255,255,.62)', fontSize: typography.sizes.sm, fontWeight: 700, marginBottom: spacing.sm },
            }),
            visualConfig,
        ],
    });
    visualConfig.style.marginBottom = '0';
    card.appendChild(configDetails);
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
        text: 'Volver a rutas',
        styles: { ...compactButtonStyles(), width: '100%', marginTop: spacing.sm },
        events: { click: onExit },
    });
    if (resumeButton) card.appendChild(resumeButton);
    card.appendChild(startButton);
    let firstIntervalStart = 0;
    const firstInterval = expandBlocks(workout?.blocks || []).find((block) => {
        if (block.type === BLOCK_TYPES.INTERVAL) return true;
        firstIntervalStart += block.duration;
        return false;
    });
    const seriesStartButton = firstInterval && firstIntervalStart >= 30 ? button({
        text: 'Empezar 30 s antes de la primera serie',
        styles: { ...compactButtonStyles(), width: '100%', marginTop: spacing.sm },
        events: { click: () => startMission({ startAtSeconds: firstIntervalStart - 30 }).catch(handleStartError) },
    }) : null;
    if (seriesStartButton) card.appendChild(seriesStartButton);
    card.appendChild(backButton);
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
    let lastBlock = null;
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
        // Si la barra superior de cifras llega hasta los botones (pantallas no muy anchas), estos y el minimapa bajan una fila.
        visualControls.style.top = '72px';
        const crowded = metricValues.getBoundingClientRect().right + 12 > visualControls.getBoundingClientRect().left;
        blockLabel.style.maxWidth = compact ? '126px' : '';
        blockLabel.style.fontSize = compact ? '10px' : typography.sizes.xs;
        modeLabel.style.maxWidth = compact ? '76px' : '';
        modeLabel.style.textAlign = compact ? 'center' : '';
        routeProgress.style.width = compact ? '42vw' : 'min(320px, 42vw)';
        visualControls.style.top = crowded ? '112px' : '72px';
        visualControls.style.right = compact ? '12px' : '18px';
        visualControls.style.justifyContent = 'flex-end';
        stagePrompt.style.top = compact ? '142px' : '112px';
        racePanel.setCompact(compact);
        lapToast.setCompact(compact);
        stagePrompt.style.maxWidth = compact ? '82vw' : 'min(540px, 72vw)';
        controls.style.right = compact ? '12px' : '18px';
        // Los controles (pausa y entrenamiento) suben por encima del panel inferior si se pisan con él.
        controls.style.bottom = '18px';
        const controlsRect = controls.getBoundingClientRect();
        const panels = [workoutStrip.element, metrics].map((element) => element.getBoundingClientRect());
        const overlaps = panels.some((rect) => rect.width > 0 && controlsRect.left < rect.right && controlsRect.top < rect.bottom);
        controls.style.bottom = compact || overlaps ? `${bottom.offsetHeight + 26}px` : '18px';
        metrics.style.width = compact ? 'calc(100vw - 24px)' : 'min(440px, 86vw)';
        miniMap.element.style.top = crowded ? '160px' : '124px';
        miniMap.element.style.right = compact ? '12px' : '18px';
        // En móvil el perfil comparte esquina con los botones de pausa: se oculta. Si pisa el panel del entrenamiento,
        // sube por encima de él.
        climbProfile.element.style.display = compact ? 'none' : 'flex';
        climbProfile.element.style.bottom = '18px';
        const profileRect = climbProfile.element.getBoundingClientRect();
        const stripRect = workoutStrip.element.getBoundingClientRect();
        const profileOverlaps = !compact && profileRect.right > stripRect.left && profileRect.top < stripRect.bottom;
        climbProfile.element.style.bottom = profileOverlaps ? `${bottom.offsetHeight + 26}px` : '18px';
        decisionButtons.style.gridTemplateColumns = compact ? '1fr' : 'repeat(3, 1fr)';
    };
    applyResponsiveLayout();
    window.addEventListener('resize', applyResponsiveLayout);

    // Minimapa (~10 veces por segundo) y sonido ambiente (cada frame) siguen al renderer, no al tick del entrenamiento.
    let lastCadence = 0;
    let ambienceFrame = 0;
    let lastMapDraw = 0;
    const startAmbient = () => ambient.start();
    // El navegador solo deja sonar audio tras un gesto: se intenta al entrar (venimos de un clic) y en el primer toque.
    startAmbient();
    container.addEventListener('pointerdown', startAmbient);
    const ambienceLoop = (now) => {
        const mapState = renderer?.getMapState?.();
        if (mapState && now - lastMapDraw > 100) {
            lastMapDraw = now;
            miniMap.update(mapState);
            climbProfile.update(renderer?.getProfileState?.());
        }
        const running = controller?.state !== SESSION_STATE.PAUSED;
        // Público junto a la salida/meta del circuito y en el último minuto de la sesión.
        const toLine = mapState ? Math.min(mapState.player, 1 - mapState.player) : 1;
        const remaining = latestTick ? totalDuration - latestTick.totalElapsedTime : totalDuration;
        const crowd = Math.max(toLine < 0.04 ? 1 - toLine / 0.04 : 0, remaining < 60 ? 0.6 : 0);
        ambient.update({
            speed: running ? renderer?.getPlayerSpeed?.() || 0 : 0,
            cadence: running ? lastCadence : 0,
            crowd: running ? crowd : 0,
        });
        ambienceFrame = requestAnimationFrame(ambienceLoop);
    };
    ambienceFrame = requestAnimationFrame(ambienceLoop);
    // El alto del panel inferior cambia con el contenido: los botones deben flotar siempre por encima.
    const bottomObserver = typeof window.ResizeObserver === 'function' ? new window.ResizeObserver(applyResponsiveLayout) : null;
    bottomObserver?.observe(bottom);

    async function initializeRenderer() {
        try {
            const { createExpeditionRenderer3D } = await import('../expedition/ExpeditionRenderer3D.js');
            renderer = createExpeditionRenderer3D(canvas, {
                cameraMode: visualSettings.camera,
                quality: visualSettings.quality,
                reducedMotion: visualSettings.reducedMotion,
                mission,
                riderWeight: Number(state.settings.weight) || 70,
                onQualityAdapt: () => showStagePrompt('Calidad gráfica ajustada para mantener la fluidez'),
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

    async function startMission({ resume = false, startAtSeconds = 0 } = {}) {
        isDemo = state.connectionState !== 'connected';
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
                // Pedaleando, los controles se esconden; en pausa o fuera de la sesión quedan a la vista.
                if (sessionState === SESSION_STATE.RUNNING) {
                    revealChrome();
                    if (!chromeHintShown) {
                        chromeHintShown = true;
                        showStagePrompt('Mueve el ratón o toca la pantalla para ver los controles');
                    }
                } else {
                    showChrome();
                }
                workoutControls.setDisabled(sessionState !== SESSION_STATE.RUNNING && sessionState !== SESSION_STATE.PAUSED);
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
                targetCadence.textContent = target.cadence ? `Obj. ${target.cadence}` : '';
                modeLabel.textContent = isDemo ? 'MODO DEMO' : result.mode.toUpperCase();
                if (result.error) showStagePrompt(result.error);
            },
            onPlanChange: ({ totalDuration: nextTotal, blocks }) => {
                // Bloque saltado o alargado: nuevo total, y la barra del entrenamiento se redibuja con la duración real.
                totalDuration = Math.max(1, nextTotal);
                const nextStrip = createWorkoutStrip({ workout, ftp: state.settings.ftp, totalDuration, blocks });
                nextStrip.element.append(coachRow);
                workoutStrip.element.replaceWith(nextStrip.element);
                workoutStrip = nextStrip;
                if (lastBlock) workoutStrip.setBlock(lastBlock, lastBlock.index ?? 0);
                if (latestTick) workoutStrip.setProgress(latestTick.totalElapsedTime);
                applyHudExtras();
            },
            onBlockChange: (block) => {
                lastBlock = block;
                controller?.debug?.log('view.block.change', { block });
                blockLabel.textContent = String(block.name || 'TRAMO').toUpperCase();
                showStagePrompt(block.instructions || getStagePrompt(block.type));
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
                workoutControls.setSpiral(Boolean(tick.spiral));
                timer.textContent = formatTime(Math.max(0, totalDuration - tick.totalElapsedTime));
                workoutStrip.setBlockRemaining(tick.blockRemainingTime);
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
            startAtSeconds,
        });
        await wakeLock.acquire();

        if (isDemo) {
            demoInterval = setInterval(() => {
                const ergOn = controller?.getAssistState?.().ergEnabled !== false;
                // Con ERG apagado el demo simula pedalear libre: algo más fuerte y menos constante.
                const target = (currentTarget?.power || state.settings.ftp * 0.65) * (ergOn ? 1 : 1.12);
                const wave = Math.sin(Date.now() / 2600) * target * (ergOn ? 0.07 : 0.16);
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
                            .finally(() => { connectionPausePromise = null; syncPauseUI(); });
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
                // Un pulso que lleva más de 5 s sin actualizarse no se muestra como si fuera actual.
                const heartRateFresh = Date.now() - (nextState.lastHeartRateUpdateTimestamp || 0) <= 5000;
                ingest({ ...nextState.liveData, heartRate: heartRateFresh ? nextState.liveData.heartRate : 0 });
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
        lastCadence = cadence;
        const hr = frame.display.heartRate;
        actualPower.textContent = String(Math.round(power));
        actualCadence.textContent = String(Math.round(cadence));
        actualHeartRate.textContent = hr ? String(Math.round(hr)) : '--';
        const hrZone = getHeartRateZone(hr, state.settings.maxHR, state.settings.restingHR);
        heartZone.textContent = hrZone ? `Z${hrZone.zone} · ${hrZone.name}` : (frame.quality.heartRate === 'stale' ? 'Reconectando…' : 'Sin pulso');
        heartZone.style.color = hrZone?.color || 'rgba(255,255,255,.58)';
        actualHeartRate.style.color = hrZone?.color || '#ff7893';
        // El color de la potencia dice si estás en zona: verde ±5%, ámbar ±10%, rojo fuera.
        const settled = (latestTick?.blockElapsedTime || 0) > 8;
        const deviation = target > 0 && settled ? Math.abs(power - target) / target : null;
        actualPower.style.color = deviation == null ? '#fff' : deviation <= 0.05 ? '#63e0b5' : deviation <= 0.1 ? '#ffd379' : '#ff8a6b';
        // La zona de potencia tiñe el medidor, su etiqueta y el filo de la barra superior.
        const zone = powerZone(power, state.settings.ftp);
        container.style.setProperty('--zone', zone.color);
        zoneChip.textContent = zone.label;
        // El corazón late a tu pulso real.
        heartIcon.style.animationDuration = hr ? `${(60 / Math.max(40, hr)).toFixed(2)}s` : '0s';
        heartIcon.style.color = hrZone?.color || '#ff7893';
        const gaugeMaximum = Math.max(400, state.settings.ftp * 1.5, target * 1.5, power * 1.12);
        flowFill.style.width = `${Math.min(100, (power / gaugeMaximum) * 100)}%`;
        targetMarker.style.display = target > 0 ? 'block' : 'none';
        targetMarker.style.left = `${Math.min(100, (target / gaugeMaximum) * 100)}%`;
        targetBand.style.display = target > 0 ? 'block' : 'none';
        targetBand.style.left = `${Math.min(100, (target * 0.95 / gaugeMaximum) * 100)}%`;
        targetBand.style.width = `${(target * 0.1 / gaugeMaximum) * 100}%`;
        flowBar.setAttribute('aria-label', `Potencia ${Math.round(power)} vatios; objetivo ${target || 'libre'}; escala ${Math.round(gaugeMaximum)}`);
        if (flow.sampled !== false) {
            // Las vueltas y el Flow cuentan una muestra por segundo; el resto de paquetes solo refresca los números.
            lapTracker.sample(power, target, latestTick?.blockElapsedTime || 0);
            lastFlow = lastFlow * 0.66 + flow.flow * 0.34;
        }
        workoutStrip.setAverage(lapTracker.average());
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
        }, 5200 + Math.min(4000, message.length * 35));
    }

    async function showResult(session) {
        cleanupRuntime();
        controls.style.display = 'none';
        pauseOverlay.style.display = 'none';
        await wakeLock.release();
        const result = session.gameResult || {};
        const { gainedXp, progress } = await recordMissionProgress(session);
        audio.cue(session.status === 'completed' ? 'finish' : 'lost');
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
        const scored = (session.activeDuration || session.duration || 0) >= 180;
        const intensity = summarizeIntensity(session.dataPoints, state.settings);
        const zoneColors = ['#92a4ad', '#5ca8ff', '#63e0b5', '#ffd166', '#ff6b7a'];
        const zoneTotal = intensity.zoneSeconds.reduce((sum, value) => sum + value, 0) || 1;
        const stat = (label, value) => div({
            children: [
                createElement('span', { text: label, styles: { display: 'block', color: 'rgba(255,255,255,.42)', fontSize: '10px', fontWeight: 800, letterSpacing: '1px' } }),
                createElement('strong', { text: value, styles: { display: 'block', marginTop: '3px', fontSize: '20px' } }),
            ],
        });
        const intensityPanel = div({
            styles: { width: '100%', padding: '14px', marginBottom: spacing.lg, borderRadius: '14px', background: 'rgba(255,255,255,.05)', textAlign: 'left' },
            children: [
                createElement('div', { text: 'INTENSIDAD DE LA SESIÓN', styles: { color: '#75ebc1', fontSize: '11px', fontWeight: 800, letterSpacing: '1.4px', marginBottom: '10px' } }),
                div({
                    styles: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' },
                    children: [
                        stat('POTENCIA MEDIA', intensity.avgPower ? `${intensity.avgPower} W` : '—'),
                        stat('FC MEDIA', intensity.hasHeartRate ? `${intensity.avgHeartRate} ppm` : '—'),
                        stat('FC MÁXIMA', intensity.hasHeartRate ? `${intensity.maxHeartRate} ppm` : '—'),
                    ],
                }),
                intensity.hasHeartRate
                    ? div({
                        styles: { marginTop: '12px' },
                        children: [
                            div({
                                styles: { display: 'flex', height: '10px', borderRadius: '99px', overflow: 'hidden', background: 'rgba(255,255,255,.08)' },
                                children: intensity.zoneSeconds.map((seconds, index) => div({
                                    attrs: { title: `Z${index + 1}: ${formatTime(Math.round(seconds))}` },
                                    styles: { width: `${(seconds / zoneTotal) * 100}%`, background: zoneColors[index] },
                                })),
                            }),
                            createElement('p', {
                                text: intensity.zoneSeconds.map((seconds, index) => `Z${index + 1} ${formatTime(Math.round(seconds))}`).join(' · '),
                                styles: { margin: '8px 0 0', color: 'rgba(255,255,255,.55)', fontSize: '12px' },
                            }),
                        ],
                    })
                    : createElement('p', {
                        text: 'Sin datos de pulso: conecta un pulsómetro en la pantalla de preparación para medir la intensidad.',
                        styles: { margin: '10px 0 0', color: 'rgba(255,255,255,.55)', fontSize: '12px' },
                    }),
            ],
        });
        card.replaceChildren(
            createElement('div', {
                text: completed ? 'MISIÓN COMPLETADA' : 'EXPEDICIÓN FINALIZADA ANTES DE TIEMPO',
                styles: { color: completed ? colors.success : colors.warning, fontWeight: 800, letterSpacing: '1.5px' },
            }),
            createElement('h1', {
                text: scored ? `${result.totalStars || 0} ★` : 'Sesión muy corta',
                styles: { margin: '12px 0 4px', fontSize: scored ? '52px' : '30px', color: colors.warning },
            }),
            createElement('p', {
                text: scored ? `${Math.round((result.adherence || 0) * 100)}% de adherencia · ${result.score || 0} puntos` : 'Menos de 3 minutos: no puntúa ni da XP.',
                styles: { color: colors.textMuted, marginBottom: spacing.lg },
            }),
            createElement('p', {
                text: `${visualSettings.rivals !== false && renderer?.getRaceStatus ? `Pelotón: ${renderer.getRaceStatus().rank}º de ${renderer.getRaceStatus().total} · ` : ''}${gainedXp > 0 ? `+${gainedXp} XP · ` : ''}Nivel ${progress.level} · ${Math.round(progress.weekly.activeMinutes)}/${progress.weekly.goalMinutes} min esta semana`,
                styles: { color: colors.primary, marginBottom: spacing.lg, fontWeight: 700 },
            }),
            intensityPanel,
            createLapTable(lapTracker.laps) || div(),
            blockResults,
            // Solo tiene sentido valorar una sesión que puntúa; las muy cortas se descartan.
            scored ? createSessionFeedbackPanel(session) : div(),
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

    soundButton.addEventListener('click', () => {
        const { enabled } = saveSoundPrefs({ enabled: !getSoundPrefs().enabled });
        soundButton.textContent = `SONIDO · ${enabled ? 'Sí' : 'No'}`;
        ambient.setEnabled(enabled);
        ambient.start();
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

    function syncPauseUI() {
        const paused = controller?.state === SESSION_STATE.PAUSED;
        pauseButton.textContent = paused ? 'Reanudar' : 'Pausar';
        pauseOverlay.style.display = paused ? 'flex' : 'none';
        pauseReason.textContent = connectionLost
            ? 'Rodillo desconectado. Reconéctalo y pulsa Reanudar.'
            : 'Tu sesión está detenida. El tiempo no corre.';
    }
    const togglePause = async () => {
        if (!controller) return;
        if (controller.state === SESSION_STATE.RUNNING) {
            await controller.pause();
            await wakeLock.release();
        } else if (controller.state === SESSION_STATE.PAUSED) {
            await controller.resume();
            await wakeLock.acquire();
        }
        syncPauseUI();
    };
    pauseButton.addEventListener('click', togglePause);

    // Atajos de teclado (como en Zwift): espacio pausa, +/− intensidad, E ERG, M sonido, C cámara, H información.
    const handleKeydown = (event) => {
        if (event.target?.closest?.('input, select, textarea') || event.ctrlKey || event.metaKey || event.altKey) return;
        const running = controller?.state === SESSION_STATE.RUNNING || controller?.state === SESSION_STATE.PAUSED;
        const key = event.key.toLowerCase();
        const actions = {
            ' ': () => !pauseButton.disabled && pauseButton.click(),
            '+': () => running && changeIntensity((controller.getAssistState?.().intensity || 100) + 5),
            '=': () => running && changeIntensity((controller.getAssistState?.().intensity || 100) + 5),
            '-': () => running && changeIntensity((controller.getAssistState?.().intensity || 100) - 5),
            e: () => running && toggleErg(!(controller.getAssistState?.().ergEnabled ?? true)),
            m: () => soundButton.click(),
            c: () => cameraButton.click(),
            h: () => hudButton.click(),
        };
        if (!actions[key]) return;
        event.preventDefault();
        actions[key]();
        revealChrome();
    };
    document.addEventListener('keydown', handleKeydown);
    resumeBig.addEventListener('click', togglePause);
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
    const handleStartError = (error) => {
        logActiveSessionError('view.start.error', error);
        briefing.style.display = '';
        pauseButton.disabled = true;
        finishButton.disabled = true;
        showStagePrompt(error.message || 'No se pudo arrancar el rodillo');
    };
    startButton.addEventListener('click', () => startMission({ resume: false }).catch(handleStartError));
    resumeButton?.addEventListener('click', () => startMission({ resume: true }).catch(handleStartError));

    // Si llegamos desde la pantalla de preparación, arrancamos sin repetir el briefing.
    if (state.expeditionLaunch) {
        briefing.style.display = 'none';
        // El router puede renderizar la vista dos veces seguidas: solo la que sigue en el DOM arranca.
        setTimeout(() => {
            const launch = state.expeditionLaunch;
            if (!container.isConnected || !launch) return;
            state.expeditionLaunch = null;
            startMission(launch).catch(handleStartError);
        }, 0);
    }

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
            syncPauseUI();
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
        document.removeEventListener('keydown', handleKeydown);
        container.removeEventListener('pointermove', revealChrome);
        container.removeEventListener('pointerdown', revealChrome);
        clearTimeout(chromeTimer);
        cancelAnimationFrame(ambienceFrame);
        container.removeEventListener('pointerdown', startAmbient);
        ambient.stop();
        cleanupRuntime();
        controller?.destroy();
        renderer?.destroy();
        document.removeEventListener('visibilitychange', handleVisibility);
        removeSessionDebugHooks();
        window.removeEventListener('resize', applyResponsiveLayout);
        bottomObserver?.disconnect();
        wakeLock.release();
        audio.destroy();
    };
    return container;
}

// Zonas de potencia de Coggan sobre el FTP, con el color de cada una (mismos tonos que el perfil del entrenamiento).
function powerZone(power, ftp) {
    const ratio = ftp > 0 ? power / ftp : 0;
    const zones = [
        [0.55, 'Z1', '#7e9bb4'],
        [0.75, 'Z2', '#5cc8ff'],
        [0.9, 'Z3', '#4fcf9a'],
        [1.05, 'Z4', '#f2cc4a'],
        [1.2, 'Z5', '#ff9a3c'],
        [Infinity, 'Z6', '#ff5a4d'],
    ];
    const [, label, color] = zones.find(([limit]) => ratio < limit);
    return { label, color };
}

function compactButtonStyles() {
    return {
        minHeight: '42px',
        padding: '10px 16px',
        borderRadius: '3px',
        border: '1px solid rgba(255,255,255,.12)',
        background: 'linear-gradient(180deg, rgba(22,32,38,.82), rgba(7,12,17,.86))',
        backdropFilter: 'blur(12px)',
        color: colors.text,
        cursor: 'pointer',
        fontFamily: "'Barlow', sans-serif",
        fontSize: '12px',
        fontWeight: 700,
        letterSpacing: '.1em',
        textTransform: 'uppercase',
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

function applyHudMode(mode, elements) {
    const hidden = mode === 'hidden';
    const full = mode === 'full';
    elements.top.style.opacity = hidden ? '0' : '1';
    if (hidden) elements.stagePrompt.style.opacity = '0';
    elements.routeProgress.style.opacity = hidden ? '0' : '1';
    elements.flowBar.style.display = hidden ? 'none' : 'block';
    elements.metrics.style.opacity = hidden ? '0' : '1';
    elements.metrics.style.pointerEvents = 'none';
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
