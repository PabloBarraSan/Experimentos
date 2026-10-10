import { describe, expect, it } from 'vitest';
import { summarizeSessionHealth } from '../src/diagnostics/sessionHealth.js';

function session({ seconds = 120, power = 200, target = 200, heartRate = 140, gapAt = null, commands = [] } = {}) {
    const dataPoints = [];
    for (let t = 0; t < seconds; t++) {
        if (gapAt !== null && t >= gapAt && t < gapAt + 10) continue;
        dataPoints.push({ timestamp: 1_000_000 + t * 1000, elapsedSeconds: t, power, targetPower: target, heartRate, blockIndex: 0 });
    }
    return { status: 'completed', elapsedTime: seconds, ftp: 200, controlMode: 'erg', trainerCommands: commands, dataPoints };
}

describe('summarizeSessionHealth', () => {
    it('una sesión limpia no genera avisos', () => {
        const health = summarizeSessionHealth(session({ commands: [{ success: true, mode: 'power' }] }));
        expect(health.ok).toBe(true);
        expect(health.coverage).toBe(1);
        expect(health.targetTracking.within10Pct).toBe(1);
        expect(health.commands).toEqual({ total: 1, failed: 0 });
    });

    it('avisa de cortes de datos y de cobertura baja', () => {
        const health = summarizeSessionHealth(session({ gapAt: 30 }));
        expect(health.maxGapSeconds).toBeGreaterThan(5);
        expect(health.warnings.some((warning) => /corte/.test(warning))).toBe(true);
        expect(health.warnings.some((warning) => /cobertura/.test(warning))).toBe(false); // 110/120 = 92 %
    });

    it('avisa si el rodillo no sigue el objetivo, si no hay pulso o fallan comandos', () => {
        const health = summarizeSessionHealth(session({
            power: 120, target: 200, heartRate: 0, commands: [{ success: false, mode: 'power' }],
        }));
        expect(health.ok).toBe(false);
        expect(health.warnings.join(' | ')).toMatch(/no sigue bien el objetivo/);
        expect(health.warnings.join(' | ')).toMatch(/Sin pulso/);
        expect(health.warnings.join(' | ')).toMatch(/comando/);
    });

    it('ignora los segundos de transición al cambiar de bloque', () => {
        const points = [];
        for (let t = 0; t < 40; t++) {
            // Bloque 1 empieza en t=20: durante 15 s la potencia aún no ha llegado al nuevo objetivo.
            const block = t < 20 ? 0 : 1;
            const target = block ? 300 : 100;
            const power = block && t < 35 ? 100 : target;
            points.push({ timestamp: t * 1000, elapsedSeconds: t, power, targetPower: target, heartRate: 130, blockIndex: block });
        }
        const health = summarizeSessionHealth({ status: 'completed', elapsedTime: 40, dataPoints: points });
        expect(health.targetTracking.meanErrorPct).toBe(0);
    });

    it('no falla con una sesión vacía', () => {
        expect(summarizeSessionHealth({}).samples).toBe(0);
        expect(summarizeSessionHealth(null).ok).toBe(true);
    });
});
