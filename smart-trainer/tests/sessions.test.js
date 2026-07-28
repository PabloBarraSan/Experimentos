import 'fake-indexeddb/auto';
import { beforeAll, describe, expect, it } from 'vitest';
import {
  clearActiveSession,
  createSession,
  getActiveSession,
  getSavedWorkouts,
  getProgress,
  getSyncJobs,
  initDB,
  enqueueSyncJob,
  removeSyncJob,
  saveActiveSession,
  saveProgress,
  saveWorkout,
} from '../src/storage/sessions.js';

describe('session persistence v2', () => {
  beforeAll(async () => {
    await initDB();
  });

  it('creates versioned sessions with an idempotency id', () => {
    const session = createSession({ workoutId: 'test', workoutName: 'Test', ftp: 250 });
    expect(session.schemaVersion).toBe(2);
    expect(session.clientSessionId).toBeTruthy();
    expect(session.activeDuration).toBe(0);
    expect(session.ftp).toBe(250);
  });

  it('saves, restores and clears an active draft', async () => {
    const session = createSession();
    session.dataPoints.push({ timestamp: 1, power: 100 });
    await saveActiveSession(session);
    const recovered = await getActiveSession();
    expect(recovered.clientSessionId).toBe(session.clientSessionId);
    expect(recovered.dataPoints).toHaveLength(1);
    await clearActiveSession();
    expect(await getActiveSession()).toBeNull();
  });

  it('stores custom workouts', async () => {
    await saveWorkout({ id: 'custom-1', name: 'Custom', category: 'custom', blocks: [] });
    expect(await getSavedWorkouts()).toEqual([
      expect.objectContaining({ id: 'custom-1', name: 'Custom' }),
    ]);
  });

  it('persists progression and an offline sync outbox', async () => {
    await saveProgress({ xp: 125, level: 2 });
    expect(await getProgress()).toEqual({ xp: 125, level: 2 });
    const job = await enqueueSyncJob('complete_session', { clientSessionId: 'abc' });
    expect(await getSyncJobs()).toContainEqual(expect.objectContaining({ id: job.id }));
    await removeSyncJob(job.id);
    expect(await getSyncJobs()).not.toContainEqual(expect.objectContaining({ id: job.id }));
  });
});
