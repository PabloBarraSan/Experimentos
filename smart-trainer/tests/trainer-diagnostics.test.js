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
});
