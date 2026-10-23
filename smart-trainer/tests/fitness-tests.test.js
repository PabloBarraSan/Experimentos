import { describe, expect, it } from 'vitest';
import {
    bestAveragePower,
    criticalPowerFromEfforts,
    ftpFrom20Min,
    ftpFromRamp,
    analyzeCriticalPowerTest,
    analyzeTestSession,
} from '../src/workouts/fitnessTests.js';
import { WORKOUT_PRESETS } from '../src/workouts/presets.js';
import { expandBlocks, validateWorkout } from '../src/workouts/model.js';
import { buildWorkoutForDuration, getWorkoutDurationOptions } from '../src/workouts/WorkoutConfiguration.js';

const series = (segments) => {
    const points = [];
    let t = 0;
    segments.forEach(([seconds, power]) => {
        for (let i = 0; i < seconds; i++) points.push({ elapsedSeconds: t++, power });
    });
    return points;
};

describe('análisis de tests', () => {
    it('encuentra la mejor media de 20 min y el FTP al 95 %', () => {
        const data = series([[600, 150], [1200, 300], [300, 120]]);
        expect(ftpFrom20Min(data)).toEqual({ best20: 300, ftp: 285 });
    });

    it('no da resultado si el esfuerzo no llega a la duración del test', () => {
        expect(bestAveragePower(series([[600, 300]]), 1200)).toBe(0);
    });

    it('calcula el FTP del ramp test como 75 % del mejor minuto', () => {
        const data = series([[300, 100], [60, 200], [60, 280], [60, 100]]);
        expect(ftpFromRamp(data)).toEqual({ map: 280, ftp: 210 });
    });

    it('resuelve CP y W′ con dos esfuerzos', () => {
        // CP 250 W, W′ 20 kJ → 3 min: 250 + 20000/180, 12 min: 250 + 20000/720
        const model = criticalPowerFromEfforts(
            { power: 250 + 20000 / 180, seconds: 180 },
            { power: 250 + 20000 / 720, seconds: 720 },
        );
        expect(model).toEqual({ cp: 250, wPrime: 20000 });
    });

    it('rechaza esfuerzos incoherentes', () => {
        expect(criticalPowerFromEfforts({ power: 200, seconds: 180 }, { power: 300, seconds: 720 })).toBeNull();
    });

    it('analiza el test 3+12 por posiciones', () => {
        const data = series([[300, 100], [180, 380], [900, 80], [720, 290]]);
        const result = analyzeCriticalPowerTest(data, { shortStart: 300, longStart: 1380 });
        expect(result.valid).toBe(true);
        expect(result.cp).toBeGreaterThan(250);
        expect(result.cp).toBeLessThan(290);
    });
});

describe('presets de tests', () => {
    ['FTP_TEST_20', 'FTP_TEST_8', 'RAMP_TEST', 'CP_TEST_3_12'].forEach((key) => {
        it(`${key} existe y es válido`, () => {
            const workout = WORKOUT_PRESETS[key];
            expect(workout).toBeDefined();
            expect(workout.category).toBe('ftp_test');
            expect(validateWorkout(workout).valid ?? true).toBeTruthy();
        });
    });
});

describe('resultado de un test sobre su preset', () => {
    it('el ramp test da el FTP del mejor minuto', () => {
        const data = series([[300, 100], [60, 260], [60, 300], [60, 120]]);
        const result = analyzeTestSession(WORKOUT_PRESETS.RAMP_TEST, data);
        expect(result).toMatchObject({ kind: 'ramp', valid: true, ftp: 225 });
    });

    it('el test 3+12 localiza los esfuerzos libres del preset', () => {
        const workout = WORKOUT_PRESETS.CP_TEST_3_12;
        const efforts = [];
        let t = 0;
        expandBlocks(workout.blocks).forEach((block) => {
            if (block.targetType === 'free') efforts.push(t);
            t += block.duration;
        });
        const data = series([[efforts[0], 100], [180, 380], [efforts[1] - efforts[0] - 180, 80], [720, 290]]);
        const result = analyzeTestSession(workout, data);
        expect(result.valid).toBe(true);
        expect(result.cp).toBeGreaterThan(250);
        expect(result.ftp).toBeLessThan(result.cp);
    });

    it('una sesión sin esfuerzo no da resultado válido', () => {
        expect(analyzeTestSession(WORKOUT_PRESETS.FTP_TEST_20, series([[300, 150]])).valid).toBe(false);
    });

    it('un entreno normal no es un test', () => {
        expect(analyzeTestSession(WORKOUT_PRESETS.SWEET_SPOT_2x20, series([[60, 200]]))).toBeNull();
    });

    it('la duración de un test no se puede cambiar', () => {
        const test = WORKOUT_PRESETS.FTP_TEST_20;
        expect(getWorkoutDurationOptions(test)).toHaveLength(1);
        expect(buildWorkoutForDuration(test, 45)).toBeNull();
    });
});
