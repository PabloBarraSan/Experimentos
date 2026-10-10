import { describe, expect, it } from 'vitest';
import { inspectIndoorBikePacket } from '../src/diagnostics/inspectIndoorBikePacket.js';
import { BluetoothManager } from '../src/bluetooth/scanner.js';

describe('packet inspection', () => {
  it('distinguishes FTMS power from unadvertised D100 cadence hypotheses', () => {
    const result = inspectIndoorBikePacket([0x40, 0, 0xc4, 9, 0x78, 0, 0xc0, 3]);
    expect(result.standard).toEqual({ speed: 25, power: 120 });
    expect(result.vendorHypotheses.periodCadence).toBe(60);
    expect(result.fields[1]).toMatchObject({ name: 'power', offset: 4 });
    expect(result.trailingBytes).toEqual([0xc0, 3]);
    expect(result.warnings.length).toBe(2);
  });

  it('handles MORE_DATA, average speed and signed power without shifted offsets', () => {
    const result = inspectIndoorBikePacket([0x47, 0, 0xc4, 9, 0xa0, 0, 0xf6, 0xff]);
    expect(result.standard).toEqual({ averageSpeed: 25, cadence: 80, power: -10 });
    expect(result.warnings).toEqual([]);
  });

  it('stops on truncation instead of interpreting later fields at the wrong position', () => {
    const result = inspectIndoorBikePacket([0x50, 0, 0xc4, 9, 0x78, 0]);
    expect(result.truncated).toBe(true);
    expect(result.standard.power).toBeUndefined();
    expect(result.warnings[0]).toContain('distance');
  });
});

describe('direct Bluetooth diagnosis', () => {
  it('captures each notification before debounce and unsubscribes cleanly', () => {
    const manager = new BluetoothManager();
    manager.lastDataTimestamp = Date.now();
    manager.dataDebounceMs = 100000;
    const frames = [];
    const stop = manager.subscribeTelemetry((data) => frames.push(data));
    const bytes = Uint8Array.from([0x44, 0, 0xc4, 9, 0xa0, 0, 0x78, 0]);
    const event = { target: { value: new DataView(bytes.buffer) } };
    manager.handleIndoorBikeData(event);
    manager.handleIndoorBikeData(event);
    expect(frames).toHaveLength(2);
    expect(frames[0]).toMatchObject({ power: 120, cadence: 80 });
    expect(frames[0].rawFtms.bytes).toEqual(Array.from(bytes));
    stop();
    manager.handleIndoorBikeData(event);
    expect(frames).toHaveLength(2);
  });
});
