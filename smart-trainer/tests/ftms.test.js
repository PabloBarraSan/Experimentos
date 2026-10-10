import { describe, expect, it } from 'vitest';
import { parseIndoorBikeData } from '../src/bluetooth/ftms.js';

function view(bytes) {
  return new DataView(Uint8Array.from(bytes).buffer);
}

describe('FTMS indoor bike parser', () => {
  it('parses standard speed, cadence and power fields', () => {
    // flags 0x44: speed implicit, cadence and power present
    const parsed = parseIndoorBikeData(view([
      0x44, 0x00,
      0xC4, 0x09, // 25.00 km/h
      0xAA, 0x00, // 85 rpm at 0.5 rpm resolution
      0xFA, 0x00, // 250 W
    ]));
    expect(parsed.speed).toBe(25);
    expect(parsed.cadence).toBe(85);
    expect(parsed.power).toBe(250);
  });

  it('parses the known D100 0x40 packet shape', () => {
    const parsed = parseIndoorBikeData(view([
      0x40, 0x00,
      0xB8, 0x0B, // 30.00 km/h
      0x2C, 0x01, // 300 W
      0xB4,       // D100 cadence byte -> 90 rpm
    ]));
    expect(parsed.speed).toBe(30);
    expect(parsed.power).toBe(300);
    expect(parsed.cadence).toBe(90);
    expect(parsed.resistance).toBeUndefined();
  });

  it('uses the complete D100 cadence value without low-byte rollover jumps', () => {
    const parsed = parseIndoorBikeData(view([
      0x40, 0x00,
      0x7F, 0x06, // 16.63 km/h
      0x78, 0x00, // 120 W
      0xB5, 0x03, // 949 en 1/16 rpm -> 59 rpm
      0x62, 0x3A, 0x1D, 0x09, 0x1C, 0x00, 0x0B, 0x02,
    ]));
    expect(parsed.power).toBe(120);
    expect(parsed.cadence).toBe(59);
    expect(parsed.cadencePeriodTicks).toBe(949);
    expect(parsed.cadenceEncoding).toBe('d100-rpm-x16');
  });

  it('returns safe defaults for truncated data', () => {
    expect(parseIndoorBikeData(view([0x00]))).toMatchObject({
      power: 0,
      cadence: 0,
      speed: 0,
      resistance: 0,
    });
  });
});
