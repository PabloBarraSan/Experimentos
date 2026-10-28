import { describe, expect, it, vi } from 'vitest';
import { analyzeProbe, normalizePower, ResistanceProbeRunner, PROBE_CONFIG } from '../src/diagnostics/ResistanceProbe.js';

const row = (extra) => ({ valid: true, samples: 8, ...extra });

describe('análisis de la prueba de resistencia', () => {
    it('detecta que el ERG limita si la resistencia manual llega mucho más lejos', () => {
        const analysis = analyzeProbe({
            resistance: [row({ level: 60, power: 200, cadence: 85 }), row({ level: 100, power: 330, cadence: 85 })],
            erg: [row({ target: 200, power: 200, cadence: 85 }), row({ target: 250, power: 248, cadence: 90 }), row({ target: 300, power: 215, cadence: 85 }), row({ target: 350, power: 210, cadence: 85 })],
        });
        expect(analysis.verdict).toBe('erg_limited');
        expect(analysis.saturatedAt).toBe(300);
        expect(analysis.message).toContain('control por resistencia');
    });

    it('da el ERG por bueno si cumple todos los objetivos', () => {
        const analysis = analyzeProbe({
            resistance: [row({ level: 100, power: 300, cadence: 85 })],
            erg: [row({ target: 200, power: 201, cadence: 85 }), row({ target: 300, power: 298, cadence: 85 })],
        });
        expect(analysis.verdict).toBe('erg_ok');
    });

    it('dice que es el rodillo si ninguno de los dos pasa de lo mismo', () => {
        const analysis = analyzeProbe({
            resistance: [row({ level: 100, power: 250, cadence: 85 })],
            erg: [row({ target: 200, power: 200, cadence: 85 }), row({ target: 300, power: 245, cadence: 85 })],
        });
        expect(analysis.verdict).toBe('trainer_limit');
    });

    it('ignora los pasos sin pedaleo y pide repetir', () => {
        const analysis = analyzeProbe({
            resistance: [row({ level: 100, power: 10, cadence: 5, valid: false })],
            erg: [],
        });
        expect(analysis.verdict).toBe('incomplete');
    });

    it('normaliza la potencia a la cadencia de referencia', () => {
        expect(normalizePower(200, 100, 85)).toBe(170);
    });
});

describe('ejecución de la prueba', () => {
    const config = { ...PROBE_CONFIG, settleMs: 1000, measureMs: 1000, restMs: 1000 };

    const setup = (powerFor) => {
        let clock = 0;
        let level = 0;
        let target = null;
        const observers = new Set();
        const manager = {
            startTraining: vi.fn(async () => {}),
            stopTraining: vi.fn(async () => {}),
            setResistance: vi.fn(async (value) => { level = value; target = null; }),
            setTargetPower: vi.fn(async (watts) => { target = watts; }),
        };
        const wait = async (ms) => {
            for (let t = 0; t < ms; t += 250) {
                clock += 250;
                observers.forEach((observer) => observer({ power: powerFor({ level, target }), cadence: 85 }));
            }
        };
        const runner = new ResistanceProbeRunner({
            manager, config, wait, now: () => clock,
            subscribeTelemetry: (observer) => { observers.add(observer); return () => observers.delete(observer); },
        });
        return { runner, manager };
    };

    it('recorre resistencia y ERG y suelta el rodillo al final', async () => {
        // ERG se satura en 250 W; la resistencia da 3,5 W por punto.
        const { runner, manager } = setup(({ level, target }) => (target ? Math.min(target, 250) : level * 3.5));
        const outcome = await runner.run();
        expect(outcome.resistance).toHaveLength(5);
        expect(outcome.erg.length).toBeGreaterThanOrEqual(3);
        expect(outcome.analysis.verdict).toBe('erg_limited');
        expect(manager.stopTraining).toHaveBeenCalledWith(true);
    });

    it('para antes y suelta el rodillo si se cancela', async () => {
        const { runner, manager } = setup(() => 100);
        const promise = runner.run();
        runner.cancel();
        const outcome = await promise;
        expect(outcome.cancelled).toBe(true);
        expect(manager.stopTraining).toHaveBeenCalledWith(true);
    });
});
