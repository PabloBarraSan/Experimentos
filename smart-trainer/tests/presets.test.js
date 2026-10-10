import { describe, expect, it } from 'vitest';
import { WORKOUT_PRESETS } from '../src/workouts/presets.js';
import { BLOCK_TYPES, expandBlocks, validateWorkout } from '../src/workouts/model.js';

describe('Sweet Spot 3×8 · Alfa', () => {
    const workout = WORKOUT_PRESETS.SWEET_SPOT_3X8;

    it('es un workout válido con id estable y unos 53 minutos (3160 s)', () => {
        expect(validateWorkout(workout).valid).toBe(true);
        expect(workout.id).toBe('sweet_spot_3x8');
        expect(workout.stats.totalDuration).toBe(3160);
    });

    it('tiene tres series de 8 min al 88 % con 4 min de descanso solo entre ellas', () => {
        const series = expandBlocks(workout.blocks).filter((block) => block.name === 'Sweet Spot');
        expect(series).toHaveLength(3);
        expect(series.every((block) => block.duration === 480 && block.targetValue === 88)).toBe(true);
        const sweetSpot = workout.blocks.find((block) => block.name === 'Sweet Spot');
        expect(sweetSpot.restBetween).toBe(240);
        expect(sweetSpot.restTargetValue).toBe(55);
    });

    it('el calentamiento es una rampa para que el reproductor la interpole', () => {
        const warmup = workout.blocks[0];
        expect(warmup.type).toBe(BLOCK_TYPES.RAMP);
        expect([warmup.targetValue, warmup.targetValueEnd]).toEqual([45, 65]);
    });
});
