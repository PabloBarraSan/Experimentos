import { describe, expect, it } from 'vitest';
import { planToWorkout } from '../src/workouts/planConverter.js';
import { BLOCK_TYPES, expandBlocks, validateWorkout } from '../src/workouts/model.js';

const plan = {
  id: '64b7f0f0f0f0f0f0f0f0f0f0',
  name: 'Umbral en subida',
  sessionType: 'threshold',
  description: '',
  structure: [
    { type: 'warmup', name: 'Calentamiento', durationSec: 600, target: { kind: 'ftp_pct', value: 45, valueEnd: 65 } },
    {
      type: 'interval', name: 'Umbral', durationSec: 480, target: { kind: 'ftp_pct', value: 95 },
      repeat: 3, restSec: 240, restTarget: { kind: 'ftp_pct', value: 55 },
    },
    { type: 'cooldown', name: 'Vuelta a la calma', durationSec: 300, target: { kind: 'ftp_pct', value: 45 } },
  ],
};

describe('planToWorkout', () => {
  it('convierte la estructura del plan en un workout válido y enlazable', () => {
    const workout = planToWorkout(plan);
    expect(validateWorkout(workout).valid).toBe(true);
    expect(workout.id).toBe(`plan-${plan.id}`);
    expect(workout.plannedWorkoutId).toBe(plan.id);
    expect(workout.stats.totalDuration).toBe(600 + 3 * 480 + 2 * 240 + 300);
  });

  it('modela el calentamiento progresivo como rampa para que el reproductor la interpole', () => {
    const [warmup] = planToWorkout(plan).blocks;
    expect(warmup.type).toBe(BLOCK_TYPES.RAMP);
    expect([warmup.targetValue, warmup.targetValueEnd]).toEqual([45, 65]);
  });

  it('el descanso solo aparece entre repeticiones, con su propio objetivo', () => {
    const expanded = expandBlocks(planToWorkout(plan).blocks);
    const rests = expanded.filter((block) => block.type === BLOCK_TYPES.REST);
    expect(rests).toHaveLength(2);
    expect(rests[0].targetValue).toBe(55);
  });
});
