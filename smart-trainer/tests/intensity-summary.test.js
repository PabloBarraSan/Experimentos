import { describe, expect, it } from 'vitest';
import { summarizeIntensity } from '../src/session/intensitySummary.js';

const points = (rows) => rows.map(([power, heartRate], i) => ({ timestamp: 1000 * i, power, heartRate }));

describe('summarizeIntensity', () => {
    it('calcula medias, FC máxima y tiempo por zona', () => {
        const summary = summarizeIntensity(
            points([[100, 100], [200, 150], [200, 175], [200, 180]]),
            { maxHR: 190, restingHR: 60 },
        );
        expect(summary.hasHeartRate).toBe(true);
        expect(summary.avgPower).toBe(175);
        expect(summary.maxHeartRate).toBe(180);
        expect(summary.zoneSeconds.reduce((a, b) => a + b, 0)).toBe(4);
    });

    it('indica que no hay FC si no hay pulsómetro', () => {
        const summary = summarizeIntensity(points([[150, 0], [150, 0]]), { maxHR: 190, restingHR: 60 });
        expect(summary.hasHeartRate).toBe(false);
        expect(summary.avgHeartRate).toBe(0);
        expect(summary.avgPower).toBe(150);
    });

    it('no revienta con sesiones vacías', () => {
        expect(summarizeIntensity([]).avgPower).toBe(0);
    });
});
