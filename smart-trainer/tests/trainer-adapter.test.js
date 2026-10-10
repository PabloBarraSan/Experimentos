import { describe, expect, it, vi } from 'vitest';
import { TrainerAdapter } from '../src/session/TrainerAdapter.js';

describe('trainer session startup', () => {
    it('starts the hardware before applying the warmup and clears stale deduplication', async () => {
        const calls = [];
        const manager = {
            startTraining: vi.fn(async () => { calls.push('start'); }),
            setTargetPower: vi.fn(async (power) => { calls.push(power); }),
        };
        const trainer = new TrainerAdapter(manager);
        await trainer.applyTarget({ power: 110 });
        calls.length = 0;
        await trainer.start();
        await trainer.applyTarget({ power: 110 });
        expect(calls).toEqual(['start', 110]);
    });

    it('reports a rejected start instead of silently continuing', async () => {
        const trainer = new TrainerAdapter({ startTraining: vi.fn().mockRejectedValue(new Error('Control denied')) });
        await expect(trainer.start()).rejects.toThrow('No se pudo arrancar el rodillo: Control denied');
    });

    it('reports unsupported power control as manual with a visible explanation', async () => {
        const manager = { setTargetPower: vi.fn() };
        const trainer = new TrainerAdapter(manager, { powerTargetSupported: false });
        expect(await trainer.applyTarget({ power: 110 })).toMatchObject({ applied: false, mode: 'manual', error: expect.any(String) });
        expect(manager.setTargetPower).not.toHaveBeenCalled();
    });

    it('allows demo sessions without a trainer', async () => {
        await expect(new TrainerAdapter().start()).resolves.toBeUndefined();
    });
});
