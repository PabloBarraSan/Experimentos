import { describe, expect, it } from 'vitest';
import {
  createTrainerSimulator,
  DiagnosticSafetyError,
  TrainerDiagnosticSession,
} from '../src/diagnostics/TrainerDiagnosticSession.js';

describe('trainer diagnostics', () => {
  it('runs the allowed low-intensity protocol and produces a report', async () => {
    let now = 1000;
    const simulator = createTrainerSimulator({ latencyMs: 0 });
    const diagnostic = new TrainerDiagnosticSession({
      manager: simulator,
      capabilities: simulator.capabilities,
      deviceName: 'D100 simulado',
      simulated: true,
      now: () => now++,
    });

    diagnostic.recordTelemetry({ power: 79, cadence: 86 });
    diagnostic.recordTelemetry({ power: 81, cadence: 88 });
    await diagnostic.setErg(80);
    await diagnostic.setResistance(20);
    await diagnostic.pauseAndRelease();

    const report = diagnostic.getReport();
    expect(report.simulated).toBe(true);
    expect(report.summary.sampleCount).toBe(2);
    expect(report.summary.power.average).toBe(80);
    expect(report.summary.commands).toMatchObject({ total: 3, successful: 3, failed: 0 });
    expect(report.commands.every((command) => command.success)).toBe(true);
  });

  it('rejects unsafe ERG and resistance values before they reach the trainer', async () => {
    const simulator = createTrainerSimulator({ latencyMs: 0 });
    const diagnostic = new TrainerDiagnosticSession({
      manager: simulator,
      capabilities: simulator.capabilities,
      simulated: true,
    });

    await expect(diagnostic.setErg(400)).rejects.toBeInstanceOf(DiagnosticSafetyError);
    await expect(diagnostic.setResistance(100)).rejects.toBeInstanceOf(DiagnosticSafetyError);
    expect(simulator.getState().commandLog).toHaveLength(0);
  });

  it('respects capabilities reported by the physical trainer', async () => {
    const simulator = createTrainerSimulator({ latencyMs: 0 });
    const diagnostic = new TrainerDiagnosticSession({
      manager: simulator,
      capabilities: { powerTargetSupported: false, resistanceTargetSupported: false },
    });

    await expect(diagnostic.setErg(80)).rejects.toThrow('no soporta potencia');
    await expect(diagnostic.setResistance(20)).rejects.toThrow('no soporta resistencia');
  });

  it('keeps only the latest telemetry samples', () => {
    const simulator = createTrainerSimulator({ latencyMs: 0 });
    const diagnostic = new TrainerDiagnosticSession({ manager: simulator, simulated: true });
    for (let index = 0; index < 620; index++) {
      diagnostic.recordTelemetry({ power: index });
    }
    expect(diagnostic.samples).toHaveLength(600);
    expect(diagnostic.samples[0].power).toBe(20);
    expect(diagnostic.samples.at(-1).power).toBe(619);
  });

  it('keeps raw FTMS frames and summarizes an ERG response window', async () => {
    let now = 1000;
    const simulator = createTrainerSimulator({ latencyMs: 0 });
    const diagnostic = new TrainerDiagnosticSession({
      manager: simulator,
      capabilities: simulator.capabilities,
      now: () => now,
    });

    await diagnostic.setErg(80);
    now = 5000;
    diagnostic.recordTelemetry({
      power: 76,
      cadence: 84,
      rawFtms: {
        flags: 0x0044,
        flagsHex: '0x0044',
        byteLength: 8,
        hex: '44 00 c4 09 a8 00 4c 00',
        bytes: [0x44, 0x00, 0xc4, 0x09, 0xa8, 0x00, 0x4c, 0x00],
      },
    });

    const report = diagnostic.getReport();
    expect(report.schemaVersion).toBe(3);
    expect(report.samples[0].rawFtms.flagsHex).toBe('0x0044');
    expect(report.summary.telemetry.flags).toEqual({ '0x0044': 1 });
    expect(report.summary.telemetry.ergWindows[0]).toMatchObject({
      targetPower: 80,
      averagePower: 76,
      averageAbsoluteError: 4,
    });
  });
});

describe('reference measurements', () => {
  it('uses a time window, keeps stopped references and rejects stale readings', () => {
    let now = 10000;
    const diagnostic = new TrainerDiagnosticSession({ now: () => now });
    diagnostic.recordTelemetry({ power: 300, cadence: 120 }, 4000);
    diagnostic.recordTelemetry({ power: 20, cadence: 10 }, 6000);
    diagnostic.recordTelemetry({ power: 0, cadence: 0 }, 10000);
    expect(diagnostic.markReference({ cadence: 0, power: 0 }).details).toMatchObject({
      sampleCount: 2, appPower: 10, appCadence: 5, powerError: 10, cadenceError: 5,
    });
    expect(() => diagnostic.markReference({})).toThrow('referencia');
    now = 16000;
    expect(() => diagnostic.markReference({ cadence: 80 })).toThrow('últimos 5 segundos');
  });

  it('keeps missing cadence distinct from a measured zero', () => {
    const diagnostic = new TrainerDiagnosticSession({ now: () => 1000 });
    diagnostic.recordTelemetry({ power: 100 });
    expect(diagnostic.samples[0].cadence).toBeNull();
    expect(diagnostic.getSummary().cadence.average).toBeNull();
    expect(diagnostic.markReference({ cadence: 80 }).details.cadenceError).toBeNull();
  });
});
