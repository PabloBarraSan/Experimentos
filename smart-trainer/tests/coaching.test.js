import { describe, expect, it } from 'vitest';
import { getCoachingState, getHeartRateZone } from '../src/game/CoachingEngine.js';

describe('expedition coaching', () => {
  it('uses adaptation, green, amber and red bands', () => {
    expect(getCoachingState({ power: 100, targetPower: 200, secondsInBlock: 2 }).status).toBe('adapting');
    expect(getCoachingState({ power: 218, targetPower: 200, secondsInBlock: 6 }).status).toBe('good');
    expect(getCoachingState({ power: 225, targetPower: 200, secondsInBlock: 6 }).status).toBe('near');
    expect(getCoachingState({ power: 240, targetPower: 200, secondsInBlock: 6 }).status).toBe('off');
  });

  it('provides direct cadence guidance and HR reserve zones', () => {
    expect(getCoachingState({ power: 200, targetPower: 200, cadence: 82, targetCadence: 90, secondsInBlock: 6 }).message).toBe('+8 RPM');
    expect(getHeartRateZone(151, 190, 60).zone).toBe(3);
  });
});
