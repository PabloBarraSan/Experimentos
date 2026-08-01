import { describe, expect, it } from 'vitest';
import {
  calculateInstantFlow,
  calculateMissionXp,
  createFlowTracker,
  starsForAdherence,
} from '../src/game/FlowEngine.js';

describe('expedition flow scoring', () => {
  it('gives full flow at the prescribed power and cadence', () => {
    expect(calculateInstantFlow({
      power: 250,
      targetPower: 250,
      cadence: 90,
      targetCadence: 90,
    }).flow).toBe(1);
  });

  it('weights cadence at twenty percent', () => {
    const result = calculateInstantFlow({
      power: 200,
      targetPower: 200,
      cadence: 70,
      targetCadence: 90,
    });
    expect(result.powerScore).toBe(1);
    expect(result.cadenceScore).toBe(0);
    expect(result.flow).toBe(0.8);
  });

  it('applies three seconds of combo grace', () => {
    const tracker = createFlowTracker({ graceSeconds: 3 });
    tracker.update({ power: 200, targetPower: 200, blockId: 'a' });
    tracker.update({ power: 0, targetPower: 200, blockId: 'a' });
    tracker.update({ power: 0, targetPower: 200, blockId: 'a' });
    tracker.update({ power: 0, targetPower: 200, blockId: 'a' });
    expect(tracker.update({ power: 0, targetPower: 200, blockId: 'a' }).combo).toBe(0);
  });

  it('produces duration-normalized score, stars and ghost trace', () => {
    const tracker = createFlowTracker();
    for (let second = 0; second < 10; second++) {
      tracker.update({
        power: 200,
        targetPower: 200,
        blockId: 'steady',
        blockIndex: 0,
        elapsedSeconds: second,
      });
    }
    const result = tracker.getResult();
    expect(result.score).toBe(10000);
    expect(result.totalStars).toBe(3);
    expect(result.ghostTrace).toHaveLength(2);
  });

  it('maps adherence and XP to fixed progression rules', () => {
    expect([0.49, 0.50, 0.75, 0.90].map(starsForAdherence)).toEqual([0, 1, 2, 3]);
    expect(calculateMissionXp({ completed: true, activeMinutes: 200, totalStars: 6 })).toBe(320);
  });

  it('stores safe route decisions and consumes energy at checkpoints', () => {
    const tracker = createFlowTracker();
    for (let second = 0; second < 40; second++) {
      tracker.update({ power: 200, targetPower: 200, elapsedSeconds: second, totalDuration: 100 });
    }
    const checkpoint = tracker.addCheckpoint({ id: 'gate', elapsedSeconds: 40 });
    expect(checkpoint.boost).toBe(true);
    expect(tracker.chooseRoute({ id: 'fork', choice: 'technical', automatic: false }).choice).toBe('technical');
    const result = tracker.getResult();
    expect(result.checkpoints).toHaveLength(1);
    expect(result.decisions).toHaveLength(1);
    expect(result.prestigeBonus).toBe(150);
  });
});
