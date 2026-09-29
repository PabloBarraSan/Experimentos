import { describe, expect, it } from 'vitest';
import { LapTracker, describeLap } from '../src/views/expeditionHud.js';

const interval = { type: 'interval', name: 'Ataques', repeat: 3, repeatIndex: 1 };
const rest = { type: 'rest', name: 'Descanso', repeat: 1 };

describe('LapTracker', () => {
    it('etiqueta las series con su contador', () => {
        expect(describeLap(interval)).toBe('SERIE 2/3');
        expect(describeLap({ type: 'steady', name: 'Ritmo', repeat: 1 })).toBe('RITMO');
    });

    it('calcula media, porcentaje del objetivo y tiempo en zona al cerrar la vuelta', () => {
        const tracker = new LapTracker();
        tracker.start(interval, 0);
        for (let second = 0; second < 20; second += 1) {
            // Los primeros 8 s son transición y no cuentan para la zona.
            tracker.sample(second < 8 ? 100 : 200, 200, second);
        }
        const summary = tracker.start(rest, 1);
        expect(summary.label).toBe('SERIE 2/3');
        expect(summary.work).toBe(true);
        expect(summary.avgPower).toBe(Math.round((8 * 100 + 12 * 200) / 20));
        expect(summary.zonePercent).toBe(100);
        expect(tracker.laps).toHaveLength(1);
    });

    it('descarta vueltas sin muestras suficientes y marca el descanso como no-trabajo', () => {
        const tracker = new LapTracker();
        tracker.start(rest, 0);
        tracker.sample(120, 100, 1);
        expect(tracker.close()).toBeNull();
        tracker.start(rest, 1);
        for (let second = 0; second < 5; second += 1) tracker.sample(100, 100, second);
        expect(tracker.close().work).toBe(false);
    });
});
