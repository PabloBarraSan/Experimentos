import { describe, expect, it } from 'vitest';
import { WORKOUT_PRESETS } from '../src/workouts/presets.js';
import { validateWorkout } from '../src/workouts/model.js';

describe('expedition mission catalog', () => {
  it('contains valid versioned 10, 20 and 30 minute missions', () => {
    const missions = [
      WORKOUT_PRESETS.AURORA_EXPEDITION,
      WORKOUT_PRESETS.MIST_FOREST_EXPEDITION,
      WORKOUT_PRESETS.NORTHERN_PEAKS_EXPEDITION,
    ];
    expect(missions.map((mission) => mission.stats.totalDuration)).toEqual([600, 1200, 1800]);
    for (const mission of missions) {
      expect(validateWorkout(mission)).toEqual({ valid: true, errors: [] });
      expect(mission.mission.version).toBeGreaterThan(0);
      expect(mission.mission.checkpoints.length).toBeGreaterThan(0);
    }
  });
});
