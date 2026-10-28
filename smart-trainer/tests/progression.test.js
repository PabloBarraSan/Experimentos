import { describe, expect, it } from 'vitest';
import { getWeekKey, levelForXp, migrateProgress } from '../src/game/ProgressionService.js';

describe('progression', () => {
  it('uses stable ISO week keys around year boundaries', () => {
    expect(getWeekKey(new Date('2026-01-01T12:00:00Z'))).toBe('2026-W01');
    expect(getWeekKey(new Date('2025-12-31T12:00:00Z'))).toBe('2026-W01');
  });

  it('no arrastra los minutos de una semana anterior a la actual', () => {
    const saved = { xp: 700, weekly: { week: '2026-W41', activeMinutes: 52, goalMinutes: 120 } };
    const thisWeek = migrateProgress(saved, new Date('2026-10-23T09:00:00Z')); // semana 43
    expect(thisWeek.weekly).toEqual({ week: '2026-W43', activeMinutes: 0, goalMinutes: 120 });
    expect(thisWeek.xp).toBe(700); // solo se reinicia lo semanal

    const sameWeek = migrateProgress(saved, new Date('2026-10-08T09:00:00Z')); // semana 41
    expect(sameWeek.weekly.activeMinutes).toBe(52);
  });

  it('una semana sin guardar parte de cero con el objetivo por defecto', () => {
    expect(migrateProgress({}, new Date('2026-10-23T09:00:00Z')).weekly)
      .toEqual({ week: '2026-W43', activeMinutes: 0, goalMinutes: 90 });
  });

  it('levels grow sub-linearly with XP', () => {
    expect(levelForXp(0)).toBe(1);
    expect(levelForXp(150)).toBe(2);
    expect(levelForXp(600)).toBe(3);
  });
});
