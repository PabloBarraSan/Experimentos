import { describe, expect, it } from 'vitest';
import { getWeekKey, levelForXp } from '../src/game/ProgressionService.js';

describe('progression', () => {
  it('uses stable ISO week keys around year boundaries', () => {
    expect(getWeekKey(new Date('2026-01-01T12:00:00Z'))).toBe('2026-W01');
    expect(getWeekKey(new Date('2025-12-31T12:00:00Z'))).toBe('2026-W01');
  });

  it('levels grow sub-linearly with XP', () => {
    expect(levelForXp(0)).toBe(1);
    expect(levelForXp(150)).toBe(2);
    expect(levelForXp(600)).toBe(3);
  });
});
