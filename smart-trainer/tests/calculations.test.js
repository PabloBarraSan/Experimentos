import { describe, expect, it } from 'vitest';
import {
  calculateAvgPower,
  calculateKilojoulesFromDataPoints,
  calculateSessionMetrics,
  calculateTimeInZones,
  resamplePowerAtOneHertz,
} from '../src/utils/calculations.js';

describe('cycling calculations', () => {
  it('includes zero-power samples in average power', () => {
    const power = [...Array(30).fill(200), ...Array(30).fill(0)];
    expect(calculateAvgPower(power)).toBe(100);
  });

  it('counts zero watts as zone one', () => {
    expect(calculateTimeInZones([0, 100, 200], 200)).toEqual({
      z1: 2,
      z2: 0,
      z3: 0,
      z4: 1,
      z5: 0,
      z6: 0,
      z7: 0,
    });
  });

  it('integrates energy using real timestamps', () => {
    const points = [
      { timestamp: 0, power: 200 },
      { timestamp: 2000, power: 100 },
      { timestamp: 3000, power: 0 },
    ];
    expect(calculateKilojoulesFromDataPoints(points)).toBe(1);
  });

  it('normalizes irregular samples to one hertz', () => {
    const points = [
      { timestamp: 0, power: 100 },
      { timestamp: 2100, power: 200 },
      { timestamp: 4000, power: 0 },
    ];
    expect(resamplePowerAtOneHertz(points)).toEqual([100, 100, 100, 200, 0]);
  });

  it('returns compatible cadence fields and correct session power', () => {
    const start = 1_000_000;
    const dataPoints = [...Array(60)].map((_, index) => ({
      timestamp: start + index * 1000,
      power: index < 30 ? 200 : 0,
      cadence: index < 30 ? 90 : 0,
      heartRate: index < 30 ? 140 : 0,
    }));
    const metrics = calculateSessionMetrics({ dataPoints, duration: 60 }, 200);
    expect(metrics.power.avg).toBe(100);
    expect(metrics.duration).toBe(60);
    expect(metrics.cadence.avgPedaling).toBe(90);
    expect(metrics.cadence.avgOverall).toBe(45);
    expect(Object.values(metrics.zones).reduce((sum, value) => sum + value, 0)).toBe(60);
  });
});
