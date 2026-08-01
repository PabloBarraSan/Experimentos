import { describe, expect, it } from 'vitest';
import { interpolateGhost, isGhostCompatible } from '../src/game/GhostService.js';

describe('ghost compatibility and playback', () => {
  it('rejects incompatible mission versions', () => {
    const session = { status: 'completed', missionId: 'aurora', missionVersion: 1, gameResult: { scoreAlgorithmVersion: 2, ghostTrace: [{}] } };
    expect(isGhostCompatible(session, { id: 'aurora', version: 2 })).toBe(false);
  });

  it('interpolates a deterministic trace', () => {
    expect(interpolateGhost([
      { elapsed: 0, progress: 0, flow: 0.5 },
      { elapsed: 10, progress: 0.2, flow: 0.9 },
    ], 5)).toEqual({ elapsed: 5, progress: 0.1, flow: 0.7 });
  });
});
