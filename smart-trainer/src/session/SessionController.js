import { createWorkoutPlayer } from '../components/WorkoutPlayer.js';
import {
    clearActiveSession,
    createSession,
    finishSession,
    saveActiveSession,
} from '../storage/sessions.js';
import { calculateSessionMetrics } from '../utils/calculations.js';
import { createFlowTracker } from '../game/FlowEngine.js';
import { TrainerAdapter } from './TrainerAdapter.js';
import { createTelemetryPipeline } from '../telemetry/TelemetryPipeline.js';

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
        this.pausedAt = null;
        this.autosaveId = null;
        this.flowTracker = createFlowTracker();
        this.telemetry = createTelemetryPipeline();
        this.trainer = new TrainerAdapter(bluetoothManager, capabilities);
        this.callbacks = { onStateChange, onTick, onTargetChange, onBlockChange };
    }

    async start({ workout, mission = null, experienceMode = 'expedition', recoveredSession = null }) {
        if (!workout?.blocks?.length) throw new Error('El workout no contiene bloques');
        this.workout = workout;
        this.session = recoveredSession || createSession({
            workoutId: workout.id,
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
                const result = await this.trainer.applyTarget(target);
                this.session.controlMode = result.mode;
                this.callbacks.onTargetChange(target, result);
            },
            onBlockChange: (block, index, total) => {
                this.currentBlock = { ...block, index, total };
                this.callbacks.onBlockChange(this.currentBlock);
            },
            onTick: (tick) => {
                this.currentTick = tick;
                this.callbacks.onTick(tick);
            },
            onComplete: () => {
                this.finish({ status: 'completed' }).catch(() => {
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
        this.state = SESSION_STATE.RUNNING;
        this.autosaveId = setInterval(() => this.saveDraft(), 10000);
        this.player.play();
        this.emitState();
        return this.session;
    }

    ingestBikeData(data, timestamp = Date.now()) {
        if (this.state !== SESSION_STATE.RUNNING || !this.session) return null;
        if (timestamp - this.lastSampleTimestamp < 1000) return null;
        this.lastSampleTimestamp = timestamp;

        const frame = this.telemetry.ingest(data, timestamp);
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
        return { ...flow, telemetry: frame };
    }

    async pause() {
        if (this.state !== SESSION_STATE.RUNNING) return;
        this.player?.pause();
        await this.trainer.pause();
        this.pausedAt = Date.now();
        this.session.status = 'paused';
        this.state = SESSION_STATE.PAUSED;
        await this.saveDraft();
        this.emitState();
    }

    async resume() {
        if (this.state !== SESSION_STATE.PAUSED) return;
        if (this.pausedAt) {
            this.session.pausedDuration += (Date.now() - this.pausedAt) / 1000;
            this.pausedAt = null;
        }
        await this.trainer.resume();
        this.session.status = 'active';
        this.state = SESSION_STATE.RUNNING;
        this.player?.resume();
        this.emitState();
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
        await finishSession(this.session, metrics, status);
        await clearActiveSession();
        this.state = SESSION_STATE.COMPLETED;
        this.emitState();
        return this.session;
    }

    destroy() {
        this.player?.stop();
        if (this.autosaveId) clearInterval(this.autosaveId);
        this.autosaveId = null;
    }

    emitState() {
        this.callbacks.onStateChange(this.state, this.session);
    }
}
