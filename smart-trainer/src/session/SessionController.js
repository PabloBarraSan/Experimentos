import { createWorkoutPlayer } from '../components/WorkoutPlayer.js';
import {
    clearActiveSession,
    createSession,
    deleteSession,
    finishSession,
    saveActiveSession,
} from '../storage/sessions.js';
import { calculateSessionMetrics } from '../utils/calculations.js';
import { createFlowTracker } from '../game/FlowEngine.js';
import { TrainerAdapter } from './TrainerAdapter.js';
import { createTelemetryPipeline } from '../telemetry/TelemetryPipeline.js';
import { createSessionDebugLogger, logActiveSessionError, releaseSessionDebugLogger } from '../diagnostics/SessionDebugLogger.js';
import { summarizeSessionHealth } from '../diagnostics/sessionHealth.js';

const MIN_SAVED_SECONDS = 60;

// Límites y parámetros de los controles de entrenamiento (estilo Zwift/MyWhoosh).
export const INTENSITY_MIN = 50;
export const INTENSITY_MAX = 150;
const SPIRAL_LOW_CADENCE = 55;
const SPIRAL_RECOVER_CADENCE = 75;
const SPIRAL_HOLD_MS = 2000;
const SPIRAL_REDUCED_FACTOR = 0.5;
const SPIRAL_RAMP_MS = 5000;
const SPIRAL_RESEND_MS = 1000;

export const SESSION_STATE = {
    IDLE: 'idle',
    READY: 'ready',
    RUNNING: 'running',
    PAUSED: 'paused',
    FINISHING: 'finishing',
    COMPLETED: 'completed',
    ERROR: 'error',
};

export class SessionController {
    constructor({
        bluetoothManager = null,
        capabilities = null,
        ftp = 200,
        onStateChange = () => {},
        onTick = () => {},
        onTargetChange = () => {},
        onBlockChange = () => {},
        onPlanChange = () => {},
    } = {}) {
        this.ftp = ftp;
        this.state = SESSION_STATE.IDLE;
        this.session = null;
        this.workout = null;
        this.player = null;
        this.currentTarget = null;
        this.currentBlock = null;
        this.currentTick = null;
        this.lastSampleTimestamp = 0;
        // El rodillo mini no envía distancia por FTMS: se integra la velocidad (m).
        this.distanceMeters = 0;
        this.lastFlow = null;
        this.lastDebugTickSecond = -1;
        this.sampleCount = 0;
        this.pausedAt = null;
        this.autosaveId = null;
        this.flowTracker = createFlowTracker();
        this.telemetry = createTelemetryPipeline();
        this.trainer = new TrainerAdapter(bluetoothManager, capabilities);
        this.callbacks = { onStateChange, onTick, onTargetChange, onBlockChange, onPlanChange };

        // Controles de entrenamiento: intensidad, ERG y protección anti-espiral.
        this.intensity = 100;
        this.ergEnabled = true;
        this.rawTarget = null;
        this.sendChain = Promise.resolve();
        this.spiral = false;
        this.lowCadenceSince = null;
        this.highCadenceSince = null;
        this.rampStartedAt = null;
        this.lastSpiralSendAt = 0;
        this.lastSentFactor = 1;
    }

    // ---- Controles de entrenamiento ----

    /** Bloques expandidos con su duración actual (cambia al alargar un bloque). */
    getBlocks() {
        return this.player?.getBlocks?.() ?? [];
    }

    getTotalDuration() {
        return this.player?.getTotalDuration?.() ?? this.workout?.stats?.totalDuration ?? 0;
    }

    getAssistState() {
        return { intensity: this.intensity, ergEnabled: this.ergEnabled, spiral: this.spiral };
    }

    /** Escala un objetivo con la intensidad actual (el objetivo "oficial" que ve el usuario). */
    scaleTarget(target) {
        if (!target || !Number.isFinite(target.power)) return target;
        return { ...target, power: Math.round((target.power * this.intensity) / 100) };
    }

    /** Factor aplicado al objetivo enviado por la protección anti-espiral (1 = sin reducción). */
    getSpiralFactor(now = Date.now()) {
        if (this.spiral) return SPIRAL_REDUCED_FACTOR;
        if (this.rampStartedAt == null) return 1;
        const progress = (now - this.rampStartedAt) / SPIRAL_RAMP_MS;
        if (progress >= 1) {
            this.rampStartedAt = null;
            return 1;
        }
        return SPIRAL_REDUCED_FACTOR + (1 - SPIRAL_REDUCED_FACTOR) * progress;
    }

    setIntensity(percent) {
        const value = Math.round(Number(percent));
        if (!Number.isFinite(value)) return this.intensity;
        const next = Math.max(INTENSITY_MIN, Math.min(INTENSITY_MAX, value));
        if (next === this.intensity) return this.intensity;
        this.intensity = next;
        this.debug?.log('control.intensity', { intensity: next });
        this.dispatchTarget({ notify: true }).catch((error) => this.debug?.log('intensity.error', { error }));
        return this.intensity;
    }

    setErgEnabled(enabled) {
        const next = Boolean(enabled);
        if (next === this.ergEnabled) return this.ergEnabled;
        this.ergEnabled = next;
        this.resetSpiral();
        this.debug?.log('control.erg', { ergEnabled: next });
        // Al activarlo se reenvía el objetivo actual aunque coincida con el último.
        this.dispatchTarget({ notify: true, force: true }).catch((error) => this.debug?.log('erg.error', { error }));
        return this.ergEnabled;
    }

    skipBlock() {
        if (this.state !== SESSION_STATE.RUNNING || !this.player) return false;
        const done = this.player.skipCurrentBlock();
        if (done) this.debug?.log('control.skip', { blockIndex: this.currentBlock?.index });
        return done;
    }

    extendBlock(seconds = 60) {
        if (this.state !== SESSION_STATE.RUNNING && this.state !== SESSION_STATE.PAUSED) return false;
        if (!this.player?.extendCurrentBlock(seconds)) return false;
        const block = this.player.getCurrentBlock();
        if (this.currentBlock && block) this.currentBlock = { ...this.currentBlock, duration: block.duration };
        this.debug?.log('control.extend', { seconds, blockIndex: this.currentBlock?.index, totalDuration: this.getTotalDuration() });
        this.callbacks.onPlanChange({ totalDuration: this.getTotalDuration(), blocks: this.player.getBlocks() });
        return true;
    }

    resetSpiral() {
        this.spiral = false;
        this.lowCadenceSince = null;
        this.highCadenceSince = null;
        this.rampStartedAt = null;
    }

    /** Detecta la espiral de la muerte (cadencia baja sostenida) y reduce/recupera el objetivo enviado. */
    updateSpiral(cadence, timestamp) {
        const target = this.rawTarget;
        const active = this.ergEnabled && Number.isFinite(target?.power) && target.power > 0;
        if (!active) {
            if (this.spiral || this.rampStartedAt != null) {
                this.resetSpiral();
                this.dispatchTarget({ notify: false }).catch(() => {});
            }
            return;
        }
        if (!Number.isFinite(cadence)) return;
        let changed = false;
        if (!this.spiral) {
            if (cadence < SPIRAL_LOW_CADENCE) {
                this.lowCadenceSince ??= timestamp;
                if (timestamp - this.lowCadenceSince >= SPIRAL_HOLD_MS) {
                    this.spiral = true;
                    this.lowCadenceSince = null;
                    this.rampStartedAt = null;
                    changed = true;
                    this.debug?.log('control.spiral.start', { cadence });
                }
            } else {
                this.lowCadenceSince = null;
            }
        } else if (cadence > SPIRAL_RECOVER_CADENCE) {
            this.highCadenceSince ??= timestamp;
            if (timestamp - this.highCadenceSince >= SPIRAL_HOLD_MS) {
                this.spiral = false;
                this.highCadenceSince = null;
                this.rampStartedAt = timestamp;
                changed = true;
                this.debug?.log('control.spiral.end', { cadence });
            }
        } else {
            this.highCadenceSince = null;
        }
        // Durante la rampa de recuperación se reenvía como mucho una vez por segundo.
        const ramping = this.rampStartedAt != null;
        if (changed || (ramping && timestamp - this.lastSpiralSendAt >= SPIRAL_RESEND_MS)) {
            this.lastSpiralSendAt = timestamp;
            this.dispatchTarget({ notify: false }).catch((error) => this.debug?.log('spiral.error', { error }));
        }
    }

    /**
     * Envía al rodillo el objetivo vigente (intensidad, ERG y anti-espiral aplicados).
     * Las órdenes se encadenan para que lleguen siempre en orden.
     */
    dispatchTarget({ notify = true, force = false } = {}) {
        const run = async () => {
            const raw = this.rawTarget;
            if (!raw) return null;
            const reported = this.scaleTarget(raw);
            this.currentTarget = reported;
            let result;
            if (!this.ergEnabled && Number.isFinite(raw.power)) {
                result = await this.trainer.applyFlatSimulation({ force });
            } else {
                const factor = this.getSpiralFactor();
                this.lastSentFactor = factor;
                const sent = Number.isFinite(reported.power) && factor < 1
                    ? { ...reported, power: Math.round(reported.power * factor) }
                    : reported;
                result = await this.trainer.applyTarget(sent, { force });
            }
            this.session.controlMode = result.mode;
            this.debug?.log('target.change.result', {
                target: reported,
                mode: result.mode,
                applied: result.applied,
                error: result.error,
                intensity: this.intensity,
                ergEnabled: this.ergEnabled,
                spiral: this.spiral,
            });
            if (notify) this.callbacks.onTargetChange(reported, result);
            return result;
        };
        const next = this.sendChain.then(run, run);
        this.sendChain = next.catch(() => {});
        return next;
    }

    async start({ workout, mission = null, experienceMode = 'expedition', recoveredSession = null, startAtSeconds = 0 }) {
        if (!workout?.blocks?.length) throw new Error('El workout no contiene bloques');
        this.debug = createSessionDebugLogger({ sessionId: `session-${Date.now()}` });
        this.debug.log('controller.start', {
            workoutId: workout.id,
            plannedWorkoutId: workout.plannedWorkoutId || null,
            workoutName: workout.name,
            totalDuration: workout.stats?.totalDuration,
            blockCount: workout.blocks.length,
            ftp: this.ftp,
            recovered: Boolean(recoveredSession),
        });
        this.workout = workout;
        this.session = recoveredSession || createSession({
            workoutId: workout.id,
            plannedWorkoutId: workout.plannedWorkoutId || null,
            workoutName: workout.name,
            ftp: this.ftp,
        });
        this.session.experienceMode = experienceMode;
        this.session.missionId = mission?.id || workout.missionId || workout.id;
        this.session.missionVersion = mission?.version || workout.missionVersion || 1;
        this.session.scoreAlgorithmVersion = 2;
        this.state = SESSION_STATE.READY;

        this.player = createWorkoutPlayer({
            workout,
            ftp: this.ftp,
            onTargetChange: async (target) => {
                this.rawTarget = target;
                this.currentTarget = this.scaleTarget(target);
                this.debug.log('target.change.request', {
                    target: this.currentTarget,
                    blockIndex: this.currentBlock?.index,
                    elapsedSeconds: this.currentTick?.totalElapsedTime || 0,
                });
                try {
                    await this.dispatchTarget({ notify: true });
                } catch (error) {
                    this.debug.log('target.change.error', { target, error });
                    logActiveSessionError('target.change.unhandled', error, { target });
                    throw error;
                }
            },
            onBlockChange: (block, index, total) => {
                this.currentBlock = { ...block, index, total };
                this.debug.log('block.change', {
                    blockIndex: index,
                    totalBlocks: total,
                    blockId: block.id,
                    blockName: block.name,
                    blockType: block.type,
                    duration: block.duration,
                    elapsedSeconds: this.currentTick?.totalElapsedTime || 0,
                });
                this.callbacks.onBlockChange(this.currentBlock);
            },
            onTick: (tick) => {
                this.currentTick = tick;
                const tickSecond = Math.floor(tick.totalElapsedTime);
                if (tickSecond >= this.lastDebugTickSecond + 5) {
                    this.lastDebugTickSecond = tickSecond;
                    const last = this.session.dataPoints[this.session.dataPoints.length - 1];
                    this.debug.log('player.tick', {
                        state: tick.state,
                        elapsedSeconds: tick.totalElapsedTime,
                        remainingSeconds: tick.totalRemainingTime,
                        blockIndex: tick.currentBlockIndex,
                        blockRemainingSeconds: tick.blockRemainingTime,
                        samples: this.sampleCount,
                        power: last?.power ?? null,
                        targetPower: last?.targetPower ?? null,
                        cadence: last?.cadence ?? null,
                        heartRate: last?.heartRate || null,
                    });
                }
                this.callbacks.onTick({
                    ...tick,
                    currentTarget: this.scaleTarget(tick.currentTarget),
                    ...this.getAssistState(),
                });
            },
            onComplete: () => {
                this.debug.log('player.complete', {
                    elapsedSeconds: this.currentTick?.totalElapsedTime || 0,
                    totalDuration: this.player?.getTotalDuration?.(),
                });
                this.finish({ status: 'completed' }).catch((error) => {
                    this.debug.log('finish.error', { error });
                    this.state = SESSION_STATE.ERROR;
                    this.emitState();
                });
            },
        });

        if (recoveredSession) {
            this.distanceMeters = recoveredSession.dataPoints?.at(-1)?.distance || 0;
            for (const point of recoveredSession.dataPoints || []) {
                if (!Number.isFinite(point.targetPower) || point.targetPower <= 0) continue;
                this.flowTracker.update({
                    power: point.control?.power ?? point.power,
                    targetPower: point.targetPower,
                    cadence: point.control?.cadence ?? point.cadence,
                    targetCadence: point.targetCadence,
                    blockId: point.blockId,
                    blockIndex: point.blockIndex,
                    elapsedSeconds: point.elapsedSeconds,
                });
            }
            this.player.seekToTime(recoveredSession.elapsedTime || recoveredSession.duration || 0);
            this.session.status = 'active';
            this.flowTracker.setStatus('recovered');
        }
        if (!recoveredSession && startAtSeconds > 0) {
            this.player.seekToTime(startAtSeconds);
            this.debug.log('player.start_at', { elapsedSeconds: startAtSeconds });
        }
        try {
            await this.trainer.start();
        } catch (error) {
            this.state = SESSION_STATE.ERROR;
            this.debug.log('trainer.start.error', { error });
            this.emitState();
            throw error;
        }
        this.state = SESSION_STATE.RUNNING;
        this.autosaveId = setInterval(() => {
            this.saveDraft().catch((error) => this.debug?.log('autosave.error', { error }));
        }, 10000);
        this.player.play();
        this.debug.log('controller.running', { player: this.player.getState() });
        this.emitState();
        return this.session;
    }

    ingestBikeData(data, timestamp = Date.now()) {
        if (this.state !== SESSION_STATE.RUNNING || !this.session) {
            this.debug?.log('bike_data.ignored', { state: this.state, hasSession: Boolean(this.session) });
            return null;
        }
        // Todos los paquetes del rodillo (unos 4 por segundo) alimentan el filtro de telemetría:
        // la potencia y la cadencia que se ven son así mucho más reactivas que con 1 muestra/s.
        const frame = this.telemetry.ingest(data, timestamp);
        this.updateSpiral(frame.control?.cadence, timestamp);
        if (timestamp - this.lastSampleTimestamp < 1000) {
            // Entre muestras de 1 s solo se refresca lo que se ve en pantalla.
            return this.lastFlow ? { ...this.lastFlow, telemetry: frame, sampled: false } : null;
        }
        if (this.lastSampleTimestamp && timestamp - this.lastSampleTimestamp > 3000) {
            this.debug.log('bike_data.gap', { gapMs: timestamp - this.lastSampleTimestamp });
        }
        // Un corte largo (o una pausa) no suma distancia: se limita a 3 s entre muestras.
        const elapsedSinceSample = this.lastSampleTimestamp ? Math.min((timestamp - this.lastSampleTimestamp) / 1000, 3) : 0;
        const reportedDistance = Number(data.distance);
        if (reportedDistance > 0) this.distanceMeters = reportedDistance;
        else this.distanceMeters += ((frame.raw.speed || 0) / 3.6) * elapsedSinceSample;
        this.lastSampleTimestamp = timestamp;
        this.sampleCount++;

        const block = this.currentBlock || this.currentTick?.currentBlock || {};
        const target = this.currentTarget || this.currentTick?.currentTarget || {};
        const elapsedSeconds = this.currentTick?.totalElapsedTime || 0;
        const flow = this.flowTracker.update({
            power: frame.control.power,
            targetPower: target.power,
            cadence: frame.control.cadence,
            targetCadence: target.cadence,
            blockId: block.id,
            blockIndex: block.index,
            blockName: block.name,
            elapsedSeconds,
            totalDuration: this.player?.getTotalDuration?.() || 0,
        });

        this.session.dataPoints.push({
            timestamp,
            elapsedSeconds,
            power: frame.raw.power ?? 0,
            cadence: frame.raw.cadence ?? 0,
            speed: frame.raw.speed ?? 0,
            heartRate: frame.raw.heartRate ?? 0,
            resistance: Number(data.resistance) || 0,
            distance: Math.round(this.distanceMeters),
            targetPower: target.power ?? null,
            targetCadence: target.cadence ?? null,
            blockId: block.id || null,
            blockIndex: block.index ?? null,
            flow: flow.flow,
            display: frame.display,
            control: frame.control,
            quality: frame.quality,
        });
        this.session.elapsedTime = elapsedSeconds;
        this.lastFlow = flow;
        return { ...flow, telemetry: frame, sampled: true };
    }

    async pause() {
        if (this.state !== SESSION_STATE.RUNNING) return;
        this.debug?.log('controller.pause.request', { player: this.player?.getState() });
        this.player?.pause();
        try {
            await this.trainer.pause();
        } catch (error) {
            this.debug?.log('trainer.pause.error', { error });
        }
        this.pausedAt = Date.now();
        this.session.status = 'paused';
        this.state = SESSION_STATE.PAUSED;
        try {
            await this.saveDraft();
        } catch (error) {
            this.debug?.log('pause.autosave.error', { error });
        }
        this.emitState();
        this.debug?.log('controller.paused', { player: this.player?.getState() });
    }

    async resume() {
        if (this.state !== SESSION_STATE.PAUSED) return;
        this.debug?.log('controller.resume.request', { player: this.player?.getState() });
        if (this.pausedAt) {
            this.session.pausedDuration += (Date.now() - this.pausedAt) / 1000;
            this.pausedAt = null;
        }
        try {
            await this.trainer.resume();
        } catch (error) {
            this.debug?.log('trainer.resume.error', { error });
        }
        this.session.status = 'active';
        this.state = SESSION_STATE.RUNNING;
        if (!this.ergEnabled) {
            this.dispatchTarget({ notify: false, force: true }).catch((error) => this.debug?.log('resume.sim.error', { error }));
        }
        this.player?.resume();
        this.emitState();
        this.debug?.log('controller.running', { reason: 'resume', player: this.player?.getState() });
    }

    async saveDraft() {
        if (!this.session || this.state === SESSION_STATE.COMPLETED) return null;
        return saveActiveSession(this.session);
    }

    addCheckpoint(checkpoint) {
        return this.flowTracker.addCheckpoint(checkpoint);
    }

    chooseRoute(decision) {
        return this.flowTracker.chooseRoute(decision);
    }

    async finish({ status = 'abandoned' } = {}) {
        if (!this.session || this.state === SESSION_STATE.COMPLETED || this.state === SESSION_STATE.FINISHING) {
            return this.session;
        }
        this.state = SESSION_STATE.FINISHING;
        this.debug?.log('controller.finish', {
            status,
            elapsedSeconds: this.session.elapsedTime || this.currentTick?.totalElapsedTime || 0,
            player: this.player?.getState(),
        });
        this.emitState();
        this.player?.stop();
        if (this.autosaveId) clearInterval(this.autosaveId);
        this.autosaveId = null;

        this.flowTracker.setStatus(status);
        const gameResult = this.flowTracker.getResult();
        const metrics = calculateSessionMetrics({
            dataPoints: this.session.dataPoints,
            duration: this.session.elapsedTime || this.currentTick?.totalElapsedTime || 0,
        }, this.ftp);
        if (!metrics.distance) metrics.distance = Math.round(this.distanceMeters);
        this.session.adherence = {
            overall: gameResult.adherence,
            blocks: gameResult.blocks,
        };
        this.session.gameResult = gameResult;
        this.session.status = status;
        this.session.trainerCommands = this.trainer.getDiagnosticLog();
        const elapsed = this.session.elapsedTime || this.currentTick?.totalElapsedTime || 0;
        if (status === 'abandoned' && elapsed < MIN_SAVED_SECONDS) {
            // Un clic accidental no debe ensuciar el historial.
            this.session.metrics = metrics;
            if (this.session.id) await deleteSession(this.session.id).catch(() => {});
            await clearActiveSession();
        } else {
            await finishSession(this.session, metrics, status);
            await clearActiveSession();
        }
        this.state = SESSION_STATE.COMPLETED;
        this.emitState();
        this.debug?.log('controller.completed', { status, metrics });
        // Veredicto de la sesión: una sola entrada que dice si datos y control fueron correctos.
        this.debug?.log('session.health', summarizeSessionHealth(this.session));
        return this.session;
    }

    destroy() {
        this.debug?.log('controller.destroy', { state: this.state, player: this.player?.getState() });
        this.player?.stop();
        if (this.autosaveId) clearInterval(this.autosaveId);
        this.autosaveId = null;
        releaseSessionDebugLogger(this.debug);
    }

    emitState() {
        this.callbacks.onStateChange(this.state, this.session);
    }
}
