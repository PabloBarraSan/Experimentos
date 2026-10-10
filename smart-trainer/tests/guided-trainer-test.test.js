import { describe, expect, it } from 'vitest';
import { GuidedTrainerTest } from '../src/diagnostics/GuidedTrainerTest.js';
import { loadTrainerDiagnostic, saveTrainerDiagnostic } from '../src/storage/trainerDiagnostic.js';
import 'fake-indexeddb/auto';

describe('guided trainer workout', () => {
    it('advances by elapsed time, including delayed timer callbacks and exact boundaries', () => {
        let now = 1000;
        const test = new GuidedTrainerTest({ now: () => now });
        expect(test.durationSeconds).toBe(240);
        test.start();
        expect(test.snapshot()).toMatchObject({ index: 0, remaining: 20, totalRemaining: 240 });
        now += 20000;
        expect(test.snapshot()).toMatchObject({ index: 1, remaining: 30 });
        now = 115000;
        expect(test.snapshot().step.id).toBe('cadence60again');
        now = 241000;
        expect(test.snapshot().step).toBeNull();
        test.finish();
        expect(test.getReport().status).toBe('completed');
    });

    it('keeps all stage frames, excludes settling time and never certifies requested cadence', () => {
        let now = 1000;
        const test = new GuidedTrainerTest({ now: () => now });
        test.start();
        test.record({ timestamp: 500, cadence: 900 });
        test.record({ timestamp: 21000, cadence: 120, power: 100 });
        test.record({ timestamp: 32000, cadence: 60, power: 80, rawFtms: { flagsHex: '0x0040' } });
        test.record({ timestamp: 40000, cadence: 62, power: 82 });
        test.record({ timestamp: 241000, cadence: 1000 });
        now = 241000;
        test.finish();
        const report = test.getReport();
        expect(report.samples).toHaveLength(3);
        expect(report.stages[1]).toMatchObject({ sampleCount: 3, settledSampleCount: 2, measuredCadence: 61, measuredPower: 81 });
        expect(report.stages[2].measuredCadence).toBeNull();
        expect(report.referenceKind).toBe('metronome_target_not_verified_measurement');
        expect(report.powerReference).toBe('none');
    });

    it('retains partial results on cancellation and resets for a repeat', () => {
        const test = new GuidedTrainerTest({ now: () => 1000, maxSamples: 2 });
        test.start();
        for (let i = 0; i < 3; i++) test.record({ timestamp: 1000 + i, cadence: 60 });
        test.finish('Sin conexión');
        test.record({ timestamp: 1004, cadence: 60 });
        expect(test.getReport()).toMatchObject({ status: 'aborted', reason: 'Sin conexión', droppedSamples: 1 });
        expect(test.samples).toHaveLength(2);
        test.start();
        expect(test.samples).toHaveLength(0);
        expect(test.droppedSamples).toBe(0);
    });
});

describe('saved diagnostic report', () => {
    it('survives reopening and keeps real captures separate from simulator reports', async () => {
        const real = { simulated: false, guidedTest: { status: 'completed', samples: [{ cadence: 60 }] } };
        await saveTrainerDiagnostic(real);
        await saveTrainerDiagnostic({ simulated: true, guidedTest: { status: 'aborted' } });
        expect(await loadTrainerDiagnostic()).toEqual(real);
        expect((await loadTrainerDiagnostic(true)).guidedTest.status).toBe('aborted');
    });
});
