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

const MIN_SAVED_SECONDS = 60;

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
        this.lastFlow = null;
        this.lastDebugTickSecond = -1;
        this.sampleCount = 0;
        this.pausedAt = null;
        this.autosaveId = null;
        this.flowTracker = createFlowTracker();
        this.telemetry = createTelemetryPipeline();
        this.trainer = new TrainerAdapter(bluetoothManager, capabilities);
        this.callbacks = { onStateChange, onTick, onTargetChange, onBlockChange };
    }

    async start({ workout, mission = null, experienceMode = 'expedition', recoveredSession = null, startAtSeconds = 0 }) {
        if (!workout?.blocks?.length) throw new Error('El workout no contiene bloques');
        this.debug = createSessionDebugLogger({ sessionId: `session-${Date.now()}` });
        this.debug.log('controller.start', {
            workoutId: workout.id,
            workoutName: workout.name,
            totalDuration: workout.stats?.totalDuration,
            blockCount: workout.blocks.length,
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
                this.currentTarget = target;
                this.debug.log('target.change.request', {
                    target,
                    blockIndex: this.currentBlock?.index,
                    elapsedSeconds: this.currentTick?.totalElapsedTime || 0,
                });
                try {
                    const result = await this.trainer.applyTarget(target);
                    this.session.controlMode = result.mode;
                    this.debug.log('target.change.result', {
                        target,
                        mode: result.mode,
                        applied: result.applied,
                        error: result.error,
                    });
                    this.callbacks.onTargetChange(target, result);
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
                    this.debug.log('player.tick', {
                        state: tick.state,
                        elapsedSeconds: tick.totalElapsedTime,
                        remainingSeconds: tick.totalRemainingTime,
                        blockIndex: tick.currentBlockIndex,
                        blockRemainingSeconds: tick.blockRemainingTime,
                        samples: this.sampleCount,
                    });
                }
                this.callbacks.onTick(tick);
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
        if (timestamp - this.lastSampleTimestamp < 1000) {
            // Entre muestras de 1 s solo se refresca lo que se ve en pantalla.
            return this.lastFlow ? { ...this.lastFlow, telemetry: frame, sampled: false } : null;
        }
        if (this.lastSampleTimestamp && timestamp - this.lastSampleTimestamp > 3000) {
            this.debug.log('bike_data.gap', { gapMs: timestamp - this.lastSampleTimestamp });
        }
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
            distance: Number(data.distance) || 0,
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
