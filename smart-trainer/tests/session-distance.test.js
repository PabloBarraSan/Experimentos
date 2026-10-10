import { describe, expect, it } from 'vitest';
import { exportToCSV } from '../src/storage/sessions.js';

describe('exportToCSV', () => {
    it('usa los segundos reales y no el índice de muestra', () => {
        const csv = exportToCSV({
            dataPoints: [
                { timestamp: 1000, elapsedSeconds: 0, power: 100, cadence: 80, speed: 20, heartRate: 120, distance: 0 },
                { timestamp: 2110, elapsedSeconds: 1.11, power: 110, cadence: 81, speed: 20, heartRate: 121, distance: 6 },
            ],
        });
        const [, first, second] = csv.split('\n').map((line) => line.split(','));
        expect(first[1]).toBe('0.0');
        expect(second[1]).toBe('1.1');
        expect(second[6]).toBe('6');
    });
});

describe('SessionController: distancia', () => {
    async function runningController() {
        const { SessionController, SESSION_STATE } = await import('../src/session/SessionController.js');
        const { createSession } = await import('../src/storage/sessions.js');
        const controller = new SessionController();
        controller.debug = { log() {} };
        controller.session = createSession({ workoutId: 'x' });
        controller.state = SESSION_STATE.RUNNING;
        return controller;
    }

    it('integra la velocidad cuando el rodillo no envía distancia (FTMS sin campo)', async () => {
        const controller = await runningController();
        // 36 km/h = 10 m/s, una muestra cada 1,1 s durante 10 s
        for (let i = 0; i <= 9; i++) controller.ingestBikeData({ power: 150, cadence: 90, speed: 36 }, 1_000_000 + i * 1100);
        const points = controller.session.dataPoints;
        expect(points.length).toBe(10);
        expect(points.at(-1).distance).toBe(99); // 9 intervalos × 1,1 s × 10 m/s
        expect(controller.distanceMeters).toBeCloseTo(99, 5);
    });

    it('prefiere la distancia del rodillo si la envía y no suma durante cortes largos', async () => {
        const controller = await runningController();
        controller.ingestBikeData({ power: 100, speed: 36, distance: 500 }, 1_000_000);
        expect(controller.distanceMeters).toBe(500);
        controller.ingestBikeData({ power: 100, speed: 36 }, 1_001_100);
        expect(controller.distanceMeters).toBeCloseTo(511, 5);
        controller.ingestBikeData({ power: 100, speed: 36 }, 1_061_100); // 60 s sin datos: máximo 3 s
        expect(controller.distanceMeters).toBeCloseTo(541, 5);
    });
});

describe('withIntegratedDistance', () => {
    it('rellena la distancia de sesiones antiguas con distancia 0 sin tocar el original', async () => {
        const { withIntegratedDistance } = await import('../src/storage/sessions.js');
        const original = {
            metrics: { power: { avg: 140 } },
            dataPoints: [0, 1, 2, 3].map((i) => ({ timestamp: 1000 + i * 1000, speed: 36, distance: 0 })),
        };
        const fixed = withIntegratedDistance(original);
        expect(fixed.dataPoints.map((point) => point.distance)).toEqual([0, 10, 20, 30]);
        expect(fixed.metrics.distance).toBe(30);
        expect(original.dataPoints[3].distance).toBe(0);
    });

    it('deja igual las sesiones que ya traen distancia', async () => {
        const { withIntegratedDistance } = await import('../src/storage/sessions.js');
        const session = { dataPoints: [{ timestamp: 0, speed: 30, distance: 5 }] };
        expect(withIntegratedDistance(session)).toBe(session);
    });
});
