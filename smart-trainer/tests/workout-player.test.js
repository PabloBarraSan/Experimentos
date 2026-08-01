import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createWorkoutPlayer, PLAYER_STATE } from '../src/components/WorkoutPlayer.js';
import { BLOCK_TYPES, createBlock, createWorkout } from '../src/workouts/model.js';

describe('workout player timing', () => {
  let frameCallback;
  let timestamp;
  let nowSpy;

  beforeEach(() => {
    frameCallback = null;
    timestamp = 1000;
    nowSpy = vi.spyOn(performance, 'now').mockImplementation(() => timestamp);
    vi.stubGlobal('requestAnimationFrame', (callback) => {
      frameCallback = callback;
      return 1;
    });
    vi.stubGlobal('cancelAnimationFrame', () => {});
  });

  afterEach(() => {
    nowSpy.mockRestore();
    vi.unstubAllGlobals();
  });

  it('does not consume a long browser stall as workout time', () => {
    const player = createWorkoutPlayer({
      workout: shortWorkout(2),
      onTargetChange: () => {},
    });

    player.play();
    timestamp += 10_000;
    frameCallback(timestamp);

    expect(player.getState().totalElapsedTime).toBe(0.5);
    expect(player.getState().state).toBe(PLAYER_STATE.PLAYING);
    player.stop();
  });

  it('completes only after consuming the full active duration', () => {
    const onComplete = vi.fn();
    const player = createWorkoutPlayer({
      workout: shortWorkout(2),
      onTargetChange: () => {},
      onComplete,
    });

    player.play();
    for (let index = 0; index < 4; index += 1) {
      timestamp += 500;
      const nextFrame = frameCallback;
      nextFrame(timestamp);
    }

    expect(onComplete).toHaveBeenCalledOnce();
    expect(player.getState().totalElapsedTime).toBe(2);
    expect(player.getState().state).toBe(PLAYER_STATE.FINISHED);
  });
});

function shortWorkout(duration) {
  return createWorkout({
    name: 'Prueba corta',
    blocks: [createBlock({ type: BLOCK_TYPES.STEADY, duration, targetValue: 60 })],
  });
}
