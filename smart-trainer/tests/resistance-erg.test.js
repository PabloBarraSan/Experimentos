import { describe, expect, it, vi } from 'vitest';
import { ResistanceErgController } from '../src/session/ResistanceErgController.js';
import { TrainerAdapter } from '../src/session/TrainerAdapter.js';

// Rodillo simulado: potencia = cadencia × resistencia × k (k desconocido para el controlador).
const simulate = ({ target, cadence = 85, k = 0.03, seconds = 60 }) => {
    const controller = new ResistanceErgController();
    let level = controller.setTarget(target, 0);
    let power = cadence * level * k;
    const trace = [];
    for (let t = 1; t <= seconds; t++) {
        const next = controller.update({ power, cadence, timestamp: t * 1000 });
        if (next !== null) level = next;
        power = cadence * level * k;
        trace.push({ t, level, power });
    }
    return { level, power, trace };
};

describe('ERG por resistencia', () => {
    it('converge al objetivo sin conocer la escala del rodillo', () => {
        [120, 250, 300].forEach((target) => {
            const { power } = simulate({ target, k: 0.045 });
            expect(Math.abs(power - target) / target).toBeLessThan(0.05);
        });
    });

    it('llega a vatios altos con cadencia normal subiendo la resistencia', () => {
        const { level, power } = simulate({ target: 300, cadence: 85, k: 0.04 });
        expect(power).toBeGreaterThan(285);
        expect(level).toBeLessThanOrEqual(100);
    });

    it('no pasa del 100 % de resistencia si el objetivo es inalcanzable', () => {
        const { level } = simulate({ target: 900, cadence: 80, k: 0.03 });
        expect(level).toBe(100);
    });

    it('no toca la resistencia si no hay pedaleo', () => {
        const controller = new ResistanceErgController();
        controller.setTarget(200);
        expect(controller.update({ power: 0, cadence: 0, timestamp: 5000 })).toBeNull();
    });

    it('no envía más de un comando por segundo', () => {
        const controller = new ResistanceErgController();
        controller.setTarget(200);
        expect(controller.update({ power: 50, cadence: 80, timestamp: Date.now() + 10000 })).not.toBeNull();
        expect(controller.update({ power: 50, cadence: 80, timestamp: Date.now() + 10200 })).toBeNull();
    });

    it('reaprovecha el nivel aprendido al cambiar de escalón', () => {
        const controller = new ResistanceErgController();
        controller.setTarget(100);
        controller.resistance = 20;
        expect(controller.setTarget(200)).toBe(40);
    });
});

describe('TrainerAdapter con ERG por resistencia', () => {
    it('con el ajuste "resistance" manda resistencia y no el ERG nativo', async () => {
        const manager = { setTargetPower: vi.fn(), setResistance: vi.fn(async () => {}) };
        const trainer = new TrainerAdapter(manager, {}, { deviceName: 'Van Rysel D100', ergMode: 'resistance' });
        const result = await trainer.applyTarget({ power: 250 });
        expect(result).toMatchObject({ mode: 'erg_resistance', applied: true });
        expect(manager.setTargetPower).not.toHaveBeenCalled();
        expect(manager.setResistance).toHaveBeenCalledTimes(1);
    });

    it('en automático usa el ERG nativo, también en el D100', async () => {
        const manager = { setTargetPower: vi.fn(async () => {}), setResistance: vi.fn() };
        const trainer = new TrainerAdapter(manager, {}, { deviceName: 'VANRYSEL-HT-1210' });
        await trainer.applyTarget({ power: 250 });
        expect(manager.setTargetPower).toHaveBeenCalledWith(250);
        expect(manager.setResistance).not.toHaveBeenCalled();
    });

    it('el ajuste manual "native" gana al rodillo conocido', async () => {
        const manager = { setTargetPower: vi.fn(async () => {}), setResistance: vi.fn() };
        const trainer = new TrainerAdapter(manager, {}, { deviceName: 'D100', ergMode: 'native' });
        await trainer.applyTarget({ power: 250 });
        expect(manager.setTargetPower).toHaveBeenCalled();
    });

    it('el feedback corrige la resistencia con la potencia medida', async () => {
        const manager = { setResistance: vi.fn(async () => {}) };
        const trainer = new TrainerAdapter(manager, {}, { ergMode: 'resistance' });
        await trainer.applyTarget({ power: 250 });
        manager.setResistance.mockClear();
        trainer.feedback({ power: 150, cadence: 85, timestamp: Date.now() + 5000 });
        await new Promise((resolve) => setTimeout(resolve, 0));
        expect(manager.setResistance).toHaveBeenCalledTimes(1);
        expect(manager.setResistance.mock.calls[0][0]).toBeGreaterThan(30);
    });
});
