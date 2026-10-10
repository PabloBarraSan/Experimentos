export const GUIDED_STEPS = [
    { id: 'warmup', title: 'Calienta suave', seconds: 20, cadence: 60, instruction: 'Busca una marcha cómoda. Sigue el pulso con una vuelta completa de la misma pierna.' },
    { id: 'cadence60', title: 'Mantén 60 rpm', seconds: 30, cadence: 60, instruction: 'Un golpe de pedal de la misma pierna por cada pulso. Mantén la misma marcha.' },
    { id: 'cadence80', title: 'Sube a 80 rpm', seconds: 30, cadence: 80, instruction: 'Sigue el nuevo ritmo. No uses la cadencia medida de la app para corregirte.' },
    { id: 'cadence100', title: 'Sube a 100 rpm', seconds: 30, cadence: 100, instruction: 'Pedalea ligero al ritmo del pulso. Si no estás cómodo, termina la prueba.' },
    { id: 'cadence60again', title: 'Vuelve a 60 rpm', seconds: 30, cadence: 60, instruction: 'Misma marcha: queremos ver cómo responde la lectura al bajar el ritmo.' },
    { id: 'coast', title: 'Deja de pedalear', seconds: 20, cadence: 0, instruction: 'Mantén las bielas quietas y deja que el rodillo pierda velocidad.' },
    { id: 'gear80', title: 'Otra marcha · 80 rpm', seconds: 30, cadence: 80, instruction: 'Cambia una o dos marchas y sigue el pulso. Esto nos ayuda a identificar de dónde sale la cadencia.' },
    { id: 'load80', title: 'Algo más de carga · 80 rpm', seconds: 30, cadence: 80, instruction: 'Si vas cómodo, cambia una marcha para aumentar un poco la carga. Mantén el ritmo sin forzar.' },
    { id: 'stop', title: 'Para de pedalear', seconds: 20, cadence: 0, instruction: 'Bielas quietas. Estamos guardando la respuesta final del rodillo.' },
];

export class GuidedTrainerTest {
    constructor({ now = () => Date.now(), steps = GUIDED_STEPS, maxSamples = 12000 } = {}) {
        this.now = now;
        this.steps = steps.map((step) => ({ ...step }));
        this.maxSamples = maxSamples;
        this.status = 'idle';
        this.samples = [];
        this.droppedSamples = 0;
    }

    get durationSeconds() { return this.steps.reduce((sum, step) => sum + step.seconds, 0); }

    start() {
        if (this.status === 'running') return;
        this.startedAt = this.now();
        this.endedAt = null;
        this.reason = null;
        this.samples = [];
        this.droppedSamples = 0;
        this.status = 'running';
    }

    snapshot(timestamp = this.now()) {
        const elapsed = this.status === 'idle' ? 0 : Math.max(0, ((this.endedAt ?? timestamp) - this.startedAt) / 1000);
        let start = 0;
        for (let index = 0; index < this.steps.length; index++) {
            const step = this.steps[index];
            if (elapsed < start + step.seconds) return {
                status: this.status, step, index, elapsed,
                remaining: Math.ceil(start + step.seconds - elapsed),
                totalRemaining: Math.ceil(this.durationSeconds - elapsed),
                stepStartedAt: this.startedAt + start * 1000,
            };
            start += step.seconds;
        }
        return { status: this.status, step: null, index: this.steps.length, elapsed, remaining: 0, totalRemaining: 0 };
    }

    record(sample) {
        if (this.status !== 'running' || !sample) return;
        const snapshot = this.snapshot(sample.timestamp);
        if (!snapshot.step || sample.timestamp < this.startedAt) return;
        this.samples.push({ ...sample, guidedStep: snapshot.step.id, targetCadence: snapshot.step.cadence });
        if (this.samples.length > this.maxSamples) {
            this.samples.shift();
            this.droppedSamples++;
        }
    }

    finish(reason = null) {
        if (this.status !== 'running') return;
        this.endedAt = this.now();
        this.status = reason ? 'aborted' : 'completed';
        this.reason = reason;
    }

    getReport() {
        const mean = (values) => {
            const valid = values.filter(Number.isFinite);
            return valid.length ? Math.round(valid.reduce((sum, value) => sum + value, 0) / valid.length * 10) / 10 : null;
        };
        let startSeconds = 0;
        const stages = this.steps.map((step) => {
            const all = this.samples.filter((sample) => sample.guidedStep === step.id);
            const settled = all.filter((sample) => sample.timestamp >= this.startedAt + (startSeconds + 10) * 1000);
            startSeconds += step.seconds;
            return {
                ...step, sampleCount: all.length, settledSampleCount: settled.length,
                measuredCadence: mean(settled.map((sample) => sample.cadence)),
                measuredPower: mean(settled.map((sample) => sample.power)),
                ftmsCadence: mean(settled.map((sample) => sample.packetInspection?.standard.cadence)),
                periodCadenceHypothesis: mean(settled.map((sample) => sample.packetInspection?.vendorHypotheses?.periodCadence)),
                flags: [...new Set(all.map((sample) => sample.rawFtms?.flagsHex).filter(Boolean))],
            };
        });
        return {
            status: this.status, reason: this.reason,
            startedAt: this.startedAt, endedAt: this.endedAt,
            durationSeconds: this.durationSeconds,
            referenceKind: 'metronome_target_not_verified_measurement',
            powerReference: 'none', droppedSamples: this.droppedSamples,
            stages, samples: this.samples,
        };
    }
}
