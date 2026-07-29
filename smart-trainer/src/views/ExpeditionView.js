import { colors, spacing, typography } from '../utils/theme.js';
import { button, createElement, div, formatTime } from '../utils/dom.js';
import { SessionController, SESSION_STATE } from '../session/SessionController.js';
import { recordMissionProgress } from '../game/ProgressionService.js';
import { WakeLockManager } from '../session/WakeLockManager.js';

const EXPEDITION_VISUAL_SETTINGS_KEY = 'smartTrainer_expedition_visuals_v1';
const DEFAULT_VISUAL_SETTINGS = {
    camera: 'standard',
    hud: 'essential',
    quality: 'medium',
    reducedMotion: false,
};

export function ExpeditionView({
    state,
    workout,
    recoveredSession = null,
    subscribeToState,
    onProgress,
    onExit,
    onCompleted,
}) {
    const isDemo = state.connectionState !== 'connected';
    const visualSettings = loadVisualSettings();
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
                        text: 'CREANDO VALLE DE AURORA',
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
        text: 'VALLE DE AURORA · PREPARANDO',
        styles: {
            justifySelf: 'start',
            padding: '9px 13px',
            borderRadius: '999px',
            background: 'linear-gradient(135deg, rgba(7,14,18,.76), rgba(19,53,49,.62))',
            border: '1px solid rgba(255,255,255,.12)',
            fontSize: typography.sizes.sm,
            letterSpacing: '.6px',
            backdropFilter: 'blur(12px)',
        },
    });
    const timer = createElement('div', {
        text: '00:00',
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
    top.append(blockLabel, timer, modeLabel);
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
        },
    });
    hud.appendChild(stagePrompt);

    const routeProgress = div({
        styles: {
            position: 'absolute',
            top: '76px',
            left: '50%',
            transform: 'translateX(-50%)',
            width: 'min(420px, 52vw)',
            height: '4px',
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
    hud.appendChild(routeProgress);

    const bottom = div({
        styles: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: spacing.md },
    });
    const flowBar = div({
        styles: {
            width: 'min(560px, 88vw)',
            height: '14px',
            borderRadius: '999px',
            padding: '3px',
            background: 'rgba(7,9,14,.75)',
            border: '1px solid rgba(255,255,255,.14)',
        },
    });
    const flowFill = div({
        styles: {
            width: '0%',
            height: '100%',
            borderRadius: '999px',
            background: `linear-gradient(90deg, ${colors.error}, ${colors.warning}, ${colors.success})`,
            transition: 'width .3s ease',
        },
    });
    flowBar.appendChild(flowFill);
    const metrics = div({
        attrs: { 'data-hud-mode': visualSettings.hud },
        styles: {
            display: 'flex',
            gap: '26px',
            alignItems: 'baseline',
            padding: '12px 20px',
            borderRadius: '18px',
            background: 'linear-gradient(145deg, rgba(6,13,17,.88), rgba(11,25,28,.78))',
            border: '1px solid rgba(255,255,255,.14)',
            boxShadow: '0 12px 38px rgba(0,0,0,.35)',
            backdropFilter: 'blur(14px)',
        },
    });
    const actualPower = createElement('strong', { text: '0 W', styles: { fontSize: '30px' } });
    const targetPower = createElement('span', { text: 'Objetivo -- W', styles: { color: colors.textMuted } });
    const actualCadence = createElement('span', { text: '0 rpm', styles: { color: 'rgba(255,255,255,.78)' } });
    const combo = createElement('span', { text: 'FLOW 0%', styles: { color: colors.primary, fontWeight: 800 } });
    metrics.append(actualPower, targetPower, actualCadence, combo);
    bottom.append(flowBar, metrics);
    hud.appendChild(bottom);

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
        text: `Cámara · ${cameraLabel(visualSettings.camera)}`,
        attrs: { 'aria-label': 'Cambiar cámara' },
        styles: compactButtonStyles(),
    });
    const hudButton = button({
        text: `HUD · ${hudLabel(visualSettings.hud)}`,
        attrs: { 'aria-label': 'Cambiar información visible' },
        styles: compactButtonStyles(),
    });
    const visualControls = div({
        styles: {
            position: 'absolute',
            top: '72px',
            right: '18px',
            display: 'flex',
            gap: spacing.sm,
            flexWrap: 'wrap',
            justifyContent: 'flex-end',
            pointerEvents: 'auto',
        },
        children: [cameraButton, hudButton],
    });
    controls.append(pauseButton, finishButton);
    container.appendChild(visualControls);
    container.appendChild(controls);

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
            text: 'EXPEDICIÓN 01 · VALLE DE AURORA',
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
            briefingStat('TERRENO', 'Valle · Puerto'),
            briefingStat('MISIÓN', 'Alcanza la cima'),
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
        ['low', 'Baja'],
        ['medium', 'Equilibrada'],
        ['high', 'Alta'],
    ], visualSettings.quality);
    visualConfig.append(cameraSelect.wrapper, hudSelect.wrapper, qualitySelect.wrapper);
    card.appendChild(visualConfig);
    const startButton = button({
        text: isDemo ? 'Probar expedición' : 'Comenzar expedición',
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
    const backButton = button({
        text: 'Volver a entrenamientos',
        styles: { ...compactButtonStyles(), width: '100%', marginTop: spacing.sm },
        events: { click: onExit },
    });
    card.append(startButton, backButton);
    briefing.appendChild(card);
    container.appendChild(briefing);

    let renderer;
    let controller;
    let unsubscribe;
    let demoInterval;
    let currentTarget = null;
    let lastFlow = 0;
    let hiddenAt = null;
    const wakeLock = new WakeLockManager();

    const rendererReady = initializeRenderer();
    const applyResponsiveLayout = () => {
        const compact = window.innerWidth < 600;
        blockLabel.style.maxWidth = compact ? '126px' : '';
        blockLabel.style.fontSize = compact ? '11px' : typography.sizes.sm;
        timer.style.fontSize = compact ? '20px' : '24px';
        timer.style.padding = compact ? '9px 13px' : '10px 18px';
        modeLabel.style.maxWidth = compact ? '76px' : '';
        modeLabel.style.textAlign = compact ? 'center' : '';
        routeProgress.style.top = compact ? '126px' : '76px';
        routeProgress.style.width = compact ? '72vw' : 'min(420px, 52vw)';
        visualControls.style.top = compact ? '142px' : '72px';
        visualControls.style.left = compact ? '12px' : '';
        visualControls.style.right = compact ? '12px' : '18px';
        visualControls.style.justifyContent = compact ? 'center' : 'flex-end';
        stagePrompt.style.top = compact ? '196px' : '102px';
        stagePrompt.style.maxWidth = compact ? '82vw' : 'min(540px, 72vw)';
        controls.style.right = compact ? '12px' : '18px';
        controls.style.bottom = compact ? '190px' : '18px';
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

    async function startMission() {
        visualSettings.camera = cameraSelect.select.value;
        visualSettings.hud = hudSelect.select.value;
        visualSettings.quality = qualitySelect.select.value;
        saveVisualSettings(visualSettings);
        applyHudMode(visualSettings.hud, {
            top,
            stagePrompt,
            routeProgress,
            flowBar,
            metrics,
            actualCadence,
            combo,
        });
        await rendererReady;
        renderer?.setCameraMode?.(visualSettings.camera);
        renderer?.setQuality?.(visualSettings.quality);
        briefing.style.display = 'none';
        pauseButton.disabled = false;
        finishButton.disabled = false;
        controller = new SessionController({
            bluetoothManager: isDemo ? null : state.bluetoothManager,
            capabilities: state.deviceCapabilities,
            ftp: state.settings.ftp,
            onStateChange: (sessionState, session) => {
                renderer?.update({ paused: sessionState !== SESSION_STATE.RUNNING });
                if (sessionState === SESSION_STATE.COMPLETED) {
                    showResult(session).catch((error) => console.error('No se pudo guardar el progreso:', error));
                }
            },
            onTargetChange: (target, result) => {
                currentTarget = target;
                targetPower.textContent = target.power ? `Objetivo ${target.power} W` : 'Objetivo libre';
                modeLabel.textContent = isDemo ? 'MODO DEMO' : result.mode.toUpperCase();
            },
            onBlockChange: (block) => {
                blockLabel.textContent = `VALLE DE AURORA · ${String(block.name || 'TRAMO').toUpperCase()}`;
                stagePrompt.textContent = getStagePrompt(block.type);
                renderer?.update({ blockType: block.type });
            },
            onTick: (tick) => {
                timer.textContent = formatTime(tick.totalElapsedTime);
                const totalDuration = Math.max(1, workout?.stats?.totalDuration || 1);
                const progress = Math.max(0, Math.min(1, tick.totalElapsedTime / totalDuration));
                routeProgressFill.style.width = `${Math.round(progress * 100)}%`;
                renderer?.update({ progress });
            },
        });
        await controller.start({ workout, experienceMode: 'expedition', recoveredSession });
        await wakeLock.acquire();

        if (isDemo) {
            demoInterval = setInterval(() => {
                const target = currentTarget?.power || state.settings.ftp * 0.65;
                const wave = Math.sin(Date.now() / 2600) * target * 0.07;
                ingest({ power: Math.round(target + wave), cadence: 88, speed: 28, heartRate: 135 });
            }, 250);
        } else {
            unsubscribe = subscribeToState?.((nextState) => ingest(nextState.liveData));
        }
    }

    function ingest(data) {
        actualPower.textContent = `${Math.round(data.power || 0)} W`;
        actualCadence.textContent = `${Math.round(data.cadence || 0)} rpm`;
        const flow = controller?.ingestBikeData(data);
        if (!flow) return;
        lastFlow = lastFlow * 0.66 + flow.flow * 0.34;
        flowFill.style.width = `${Math.round(lastFlow * 100)}%`;
        combo.textContent = `FLOW ${Math.round(lastFlow * 100)}% · x${flow.combo}`;
        renderer?.update({
            flow: lastFlow,
            power: data.power || 0,
            cadence: data.cadence || 0,
            speed: data.speed || 0,
            targetPower: currentTarget?.power || 0,
            ghostProgress: Math.max(0.1, Math.min(0.95, 0.62 + (lastFlow - 0.75) * 0.5)),
            paused: false,
        });
    }

    async function showResult(session) {
        cleanupRuntime();
        await wakeLock.release();
        const result = session.gameResult || {};
        const { gainedXp, progress } = await recordMissionProgress(session);
        onProgress?.(progress);
        card.replaceChildren(
            createElement('div', {
                text: 'MISIÓN COMPLETADA',
                styles: { color: colors.success, fontWeight: 800, letterSpacing: '1.5px' },
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
                text: `+${gainedXp} XP · Nivel ${progress.level} · ${Math.round(progress.weekly.activeMinutes)}/${progress.weekly.goalMinutes} min esta semana`,
                styles: { color: colors.primary, marginBottom: spacing.lg, fontWeight: 700 },
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
        cameraButton.textContent = `Cámara · ${cameraLabel(visualSettings.camera)}`;
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
        });
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
    finishButton.addEventListener('click', () => controller?.finish());
    startButton.addEventListener('click', startMission);

    const handleVisibility = async () => {
        if (document.visibilityState === 'hidden') {
            hiddenAt = Date.now();
            return;
        }
        const wasAway = hiddenAt && Date.now() - hiddenAt > 3000;
        hiddenAt = null;
        if (wasAway && controller?.state === SESSION_STATE.RUNNING) {
            await controller.pause();
            await wakeLock.release();
            pauseButton.textContent = 'Reanudar';
        }
    };
    document.addEventListener('visibilitychange', handleVisibility);

    function cleanupRuntime() {
        if (demoInterval) clearInterval(demoInterval);
        if (unsubscribe) unsubscribe();
        demoInterval = null;
        unsubscribe = null;
    }

    container.cleanup = () => {
        cleanupRuntime();
        controller?.destroy();
        renderer?.destroy();
        document.removeEventListener('visibilitychange', handleVisibility);
        window.removeEventListener('resize', applyResponsiveLayout);
        wakeLock.release();
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
    elements.stagePrompt.style.opacity = hidden ? '0' : '1';
    elements.routeProgress.style.opacity = hidden ? '0' : '1';
    elements.flowBar.style.display = hidden ? 'none' : 'block';
    elements.metrics.style.opacity = hidden ? '0' : '1';
    elements.metrics.style.pointerEvents = 'none';
    elements.actualCadence.style.display = full ? 'inline' : 'none';
    elements.combo.style.display = hidden ? 'none' : 'inline';
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
