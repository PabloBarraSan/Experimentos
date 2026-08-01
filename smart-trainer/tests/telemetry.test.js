import { describe, expect, it } from 'vitest';
import { createTelemetryPipeline } from '../src/telemetry/TelemetryPipeline.js';

describe('telemetry pipeline', () => {
  it('keeps raw values while stabilizing cadence and power', () => {
    const pipeline = createTelemetryPipeline();
    const cadences = [60, 88, 59, 61, 60, 60, 59, 61];
    let frame;
    cadences.forEach((cadence, index) => {
      frame = pipeline.ingest({ power: 200 + (index % 2 ? 12 : -12), cadence }, index * 500);
    });
    expect(frame.raw.cadence).toBe(61);
    expect(frame.display.cadence).toBeGreaterThan(57);
    expect(frame.display.cadence).toBeLessThan(64);
    expect(frame.display.power).toBeGreaterThan(195);
    expect(frame.display.power).toBeLessThan(205);
  });

  it('does not treat an isolated zero as a stop', () => {
    const pipeline = createTelemetryPipeline();
    pipeline.ingest({ power: 180, cadence: 60 }, 1000);
    const isolated = pipeline.ingest({ power: 0, cadence: 0 }, 1500);
    expect(isolated.display.power).toBeGreaterThan(0);
    expect(isolated.control.cadence).toBeGreaterThan(0);
    const stopped = pipeline.ingest({ power: 0, cadence: 0 }, 4000);
    expect(stopped.raw.power).toBe(0);
  });

  it('marks heart rate stale before declaring it missing', () => {
    const pipeline = createTelemetryPipeline();
    pipeline.ingest({ heartRate: 140 }, 1000);
    expect(pipeline.ingest({}, 4000).quality.heartRate).toBe('stale');
    expect(pipeline.ingest({}, 7000).quality.heartRate).toBe('missing');
  });
});

