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
        this.trainer = new TrainerAdapter(bluetoothManager, capabilities);
        this.callbacks = { onStateChange, onTick, onTargetChange, onBlockChange };
    }

    async start({ workout, experienceMode = 'expedition', recoveredSession = null }) {
        if (!workout?.blocks?.length) throw new Error('El workout no contiene bloques');
        this.workout = workout;
        this.session = recoveredSession || createSession({
            workoutId: workout.id,
            workoutName: workout.name,
            ftp: this.ftp,
        });
        this.session.experienceMode = experienceMode;
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
                this.finish().catch(() => {
                    this.state = SESSION_STATE.ERROR;
                    this.emitState();
                });
            },
        });

        if (recoveredSession) {
            for (const point of recoveredSession.dataPoints || []) {
                if (!Number.isFinite(point.targetPower) || point.targetPower <= 0) continue;
                this.flowTracker.update({
                    power: point.power,
                    targetPower: point.targetPower,
                    cadence: point.cadence,
                    targetCadence: point.targetCadence,
                    blockId: point.blockId,
                    blockIndex: point.blockIndex,
                    elapsedSeconds: point.elapsedSeconds,
                });
            }
            this.player.seekToTime(recoveredSession.elapsedTime || recoveredSession.duration || 0);
            this.session.status = 'active';
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

        const block = this.currentBlock || this.currentTick?.currentBlock || {};
        const target = this.currentTarget || this.currentTick?.currentTarget || {};
        const elapsedSeconds = this.currentTick?.totalElapsedTime || 0;
        const flow = this.flowTracker.update({
            power: Number(data.power) || 0,
            targetPower: target.power,
            cadence: Number(data.cadence) || 0,
            targetCadence: target.cadence,
            blockId: block.id,
            blockIndex: block.index,
            blockName: block.name,
            elapsedSeconds,
        });

        this.session.dataPoints.push({
            timestamp,
            elapsedSeconds,
            power: Number(data.power) || 0,
            cadence: Number(data.cadence) || 0,
            speed: Number(data.speed) || 0,
            heartRate: Number(data.heartRate) || 0,
            resistance: Number(data.resistance) || 0,
            distance: Number(data.distance) || 0,
            targetPower: target.power ?? null,
            targetCadence: target.cadence ?? null,
            blockId: block.id || null,
            blockIndex: block.index ?? null,
            flow: flow.flow,
        });
        this.session.elapsedTime = elapsedSeconds;
        return flow;
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

    async finish() {
        if (!this.session || this.state === SESSION_STATE.COMPLETED || this.state === SESSION_STATE.FINISHING) {
            return this.session;
        }
        this.state = SESSION_STATE.FINISHING;
        this.emitState();
        this.player?.stop();
        if (this.autosaveId) clearInterval(this.autosaveId);
        this.autosaveId = null;

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
        await finishSession(this.session, metrics);
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
