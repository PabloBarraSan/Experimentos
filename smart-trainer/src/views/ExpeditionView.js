import { colors, spacing, typography } from '../utils/theme.js';
import { button, createElement, div, formatTime } from '../utils/dom.js';
import { SessionController, SESSION_STATE } from '../session/SessionController.js';
import { createExpeditionRenderer } from '../expedition/ExpeditionRenderer.js';
import { recordMissionProgress } from '../game/ProgressionService.js';
import { WakeLockManager } from '../session/WakeLockManager.js';

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
        attrs: { 'aria-label': 'Paisaje de la expedición' },
        styles: { width: '100%', height: '100%', display: 'block' },
    });
    container.appendChild(canvas);

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
        text: 'Preparando misión',
        styles: {
            justifySelf: 'start',
            padding: '9px 13px',
            borderRadius: '999px',
            background: 'rgba(7,9,14,.72)',
            border: '1px solid rgba(255,255,255,.12)',
            fontSize: typography.sizes.sm,
        },
    });
    const timer = createElement('div', {
        text: '00:00',
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
        styles: {
            display: 'flex',
            gap: '26px',
            alignItems: 'baseline',
            padding: '12px 20px',
            borderRadius: '18px',
            background: 'rgba(7,9,14,.82)',
            border: '1px solid rgba(255,255,255,.14)',
            boxShadow: '0 12px 38px rgba(0,0,0,.35)',
        },
    });
    const actualPower = createElement('strong', { text: '0 W', styles: { fontSize: '30px' } });
    const targetPower = createElement('span', { text: 'Objetivo -- W', styles: { color: colors.textMuted } });
    const combo = createElement('span', { text: 'FLOW 0%', styles: { color: colors.primary, fontWeight: 800 } });
    metrics.append(actualPower, targetPower, combo);
    bottom.append(flowBar, metrics);
    hud.appendChild(bottom);

    const controls = div({
        styles: {
            position: 'absolute',
            right: '18px',
            bottom: '18px',
            display: 'flex',
            gap: spacing.sm,
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
    controls.append(pauseButton, finishButton);
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
            width: 'min(520px, 94vw)',
            padding: '28px',
            borderRadius: '26px',
            background: 'linear-gradient(145deg, rgba(26,32,45,.96), rgba(10,13,21,.98))',
            border: '1px solid rgba(255,255,255,.13)',
            boxShadow: '0 24px 80px rgba(0,0,0,.55)',
        },
    });
    card.append(
        createElement('div', {
            text: 'EXPEDICIÓN · VALLE DE AURORA',
            styles: { color: colors.primary, fontSize: typography.sizes.xs, fontWeight: 800, letterSpacing: '1.5px' },
        }),
        createElement('h1', {
            text: workout?.name || 'Entrenamiento libre',
            styles: { margin: '8px 0', fontFamily: typography.fontDisplay, fontSize: '32px' },
        }),
        createElement('p', {
            text: isDemo
                ? 'Prueba la misión con potencia simulada. Conecta el D100 para que tu esfuerzo controle el flow.'
                : 'Mantén la potencia objetivo para seguir al rival, superar la ascensión y desbloquear la siguiente región.',
            styles: { color: colors.textMuted, lineHeight: 1.55, marginBottom: spacing.lg },
        }),
    );
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

    requestAnimationFrame(() => {
        renderer = createExpeditionRenderer(canvas);
    });

    async function startMission() {
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
                blockLabel.textContent = block.name;
                renderer?.update({ blockType: block.type });
            },
            onTick: (tick) => {
                timer.textContent = formatTime(tick.totalElapsedTime);
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
        const flow = controller?.ingestBikeData(data);
        if (!flow) return;
        lastFlow = lastFlow * 0.66 + flow.flow * 0.34;
        flowFill.style.width = `${Math.round(lastFlow * 100)}%`;
        combo.textContent = `FLOW ${Math.round(lastFlow * 100)}% · x${flow.combo}`;
        renderer?.update({
            flow: lastFlow,
            power: data.power || 0,
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
    };
}
