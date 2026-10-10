import 'fake-indexeddb/auto';
import { beforeAll, describe, expect, it } from 'vitest';
import { createSession, enqueueSyncJob, getAllSessions, initDB, saveSession, saveWorkout } from '../src/storage/sessions.js';
import { buildBackup, restoreBackup } from '../src/storage/backup.js';

describe('local backup', () => {
  beforeAll(async () => {
    await initDB();
  });

  it('exports sessions, workouts and pending sync jobs, and restores idempotently', async () => {
    const session = createSession({ workoutId: 'vo2', workoutName: 'VO2max 4x4', ftp: 250 });
    session.status = 'completed';
    session.dataPoints = [{ timestamp: 1, power: 275, cadence: 90, heartRate: 160 }];
    await saveSession(session);
    await saveWorkout({ id: 'w1', name: 'Custom' });
    await enqueueSyncJob('complete_session', { clientSessionId: session.clientSessionId });

    const backup = await buildBackup();
    expect(backup.format).toBe('smart-trainer-backup');
    expect(backup.sessions.some((s) => s.clientSessionId === session.clientSessionId)).toBe(true);
    expect(backup.syncOutbox.length).toBeGreaterThan(0);
    expect(backup.workouts.map((w) => w.id)).toContain('w1');

    const before = (await getAllSessions()).length;
    await restoreBackup(JSON.parse(JSON.stringify(backup)));
    await restoreBackup(JSON.parse(JSON.stringify(backup)));
    expect((await getAllSessions()).length).toBe(before);
  });

  it('rejects files that are not a backup', async () => {
    await expect(restoreBackup({ foo: 1 })).rejects.toThrow(/copia de seguridad/);
  });
});
