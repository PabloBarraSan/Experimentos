import 'fake-indexeddb/auto';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { createSession, enqueueSyncJob, getSession, getSyncJobs, initDB, saveSession, saveSessionFeedback, normalizeFeedback } from '../src/storage/sessions.js';
import {
  connectTrainingApp,
  fetchTodayPlan,
  flushSyncOutbox,
  getSyncConfig,
  isSyncConnected,
  syncAllSessions,
} from '../src/sync/TrainingAppSync.js';

function stubBrowser() {
  const store = new Map();
  vi.stubGlobal('localStorage', {
    getItem: (key) => (store.has(key) ? store.get(key) : null),
    setItem: (key, value) => store.set(key, String(value)),
    removeItem: (key) => store.delete(key),
  });
  vi.stubGlobal('navigator', { onLine: true });
}

const json = (status, body = {}) => ({ ok: status < 400, status, json: async () => body });

describe('training-app sync', () => {
  beforeAll(async () => {
    await initDB();
  });
  beforeEach(() => stubBrowser());
  afterEach(() => vi.unstubAllGlobals());

  it('guarda el token al conectar y rechaza URLs inválidas', async () => {
    await expect(connectTrainingApp({ baseUrl: 'localhost:4000', email: 'a@b.c', password: 'x' })).rejects.toThrow(/http/);

    const fetchMock = vi.fn().mockResolvedValue(json(200, { token: 'jwt', email: 'a@b.c' }));
    vi.stubGlobal('fetch', fetchMock);
    await connectTrainingApp({ baseUrl: 'http://localhost:4000/', email: 'a@b.c', password: 'x' });
    expect(fetchMock.mock.calls[0][0]).toBe('http://localhost:4000/api/auth/login');
    expect(isSyncConnected()).toBe(true);
    expect(getSyncConfig().baseUrl).toBe('http://localhost:4000');
  });

  it('vacía la cola al enviar y conserva el trabajo si el servidor falla', async () => {
    localStorage.setItem('smartTrainer_trainingApp', JSON.stringify({ baseUrl: 'http://x', token: 't' }));
    const session = createSession({ workoutId: 'vo2', workoutName: 'VO2' });
    session.status = 'completed';
    await saveSession(session);
    await enqueueSyncJob('complete_session', { clientSessionId: session.clientSessionId, session });

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(json(500)));
    let result = await flushSyncOutbox();
    expect(result.pending).toBeGreaterThan(0);
    expect((await getSyncJobs()).length).toBeGreaterThan(0);

    const fetchMock = vi.fn().mockResolvedValue(json(200, { id: '1' }));
    vi.stubGlobal('fetch', fetchMock);
    result = await flushSyncOutbox();
    expect(result.pending).toBe(0);
    expect(await getSyncJobs()).toHaveLength(0);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('http://x/api/smart-trainer/sessions');
    expect(init.headers.Authorization).toBe('Bearer t');
    expect(JSON.parse(init.body).clientSessionId).toBe(session.clientSessionId);
  });

  it('con token caducado desconecta y avisa, sin perder las sesiones', async () => {
    localStorage.setItem('smartTrainer_trainingApp', JSON.stringify({ baseUrl: 'http://x', token: 'old', email: 'a@b.c' }));
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(json(401)));
    await expect(syncAllSessions()).rejects.toMatchObject({ code: 'AUTH_EXPIRED' });
    expect(isSyncConnected()).toBe(false);
    expect(getSyncConfig().email).toBe('a@b.c');
  });

  it('pide el plan de hoy con la fecha local y devuelve null si falla o no hay conexión', async () => {
    expect(await fetchTodayPlan()).toBeNull();

    localStorage.setItem('smartTrainer_trainingApp', JSON.stringify({ baseUrl: 'http://localhost:4000', token: 'jwt' }));
    const fetchMock = vi.fn().mockResolvedValue(json(200, { planned: { id: 'p1' }, ftp: null }));
    vi.stubGlobal('fetch', fetchMock);
    expect((await fetchTodayPlan()).planned.id).toBe('p1');
    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toMatch(/\/api\/smart-trainer\/plan\/today\?date=\d{4}-\d{2}-\d{2}$/);
    expect(options.headers.Authorization).toBe('Bearer jwt');

    fetchMock.mockResolvedValue(json(500));
    expect(await fetchTodayPlan()).toBeNull();
    fetchMock.mockRejectedValue(new Error('offline'));
    expect(await fetchTodayPlan()).toBeNull();
  });

  it('normaliza el feedback y rechaza un RPE fuera de 1-10', () => {
    expect(normalizeFeedback({ rpe: 0 })).toBeNull();
    expect(normalizeFeedback({ rpe: 11 })).toBeNull();
    expect(normalizeFeedback({})).toBeNull();
    const feedback = normalizeFeedback({ rpe: '8', limiter: 'legs', note: '  piernas cargadas  ' });
    expect(feedback).toMatchObject({ rpe: 8, limiter: 'legs', note: 'piernas cargadas' });
    expect(normalizeFeedback({ rpe: 5, limiter: 'otro' }).limiter).toBeNull();
    expect(normalizeFeedback({ rpe: 5, note: 'x'.repeat(500) }).note).toHaveLength(280);
  });

  it('guarda el feedback en la sesión y la cola envía la versión con el RPE', async () => {
    localStorage.setItem('smartTrainer_trainingApp', JSON.stringify({ baseUrl: 'http://x', token: 't' }));
    const session = createSession({ workoutId: 'ss', workoutName: 'Sweet spot' });
    session.status = 'completed';
    await saveSession(session);
    // El trabajo de la cola guarda una copia anterior, sin feedback.
    await enqueueSyncJob('complete_session', { clientSessionId: session.clientSessionId, session: { ...session } });
    await saveSessionFeedback(session, { rpe: 8, limiter: 'legs', note: 'me ardían' });
    expect((await getSession(session.id)).feedback.rpe).toBe(8);

    const fetchMock = vi.fn().mockResolvedValue(json(200, { id: '1' }));
    vi.stubGlobal('fetch', fetchMock);
    await flushSyncOutbox();
    const sent = fetchMock.mock.calls.map(([, init]) => JSON.parse(init.body)).find((body) => body.clientSessionId === session.clientSessionId);
    expect(sent.session.feedback).toMatchObject({ rpe: 8, limiter: 'legs', note: 'me ardían' });
  });

  it('no resucita una sesión que ya no está en el historial', async () => {
    const session = createSession({ workoutId: 'x' });
    session.id = 'ses_descartada';
    await saveSessionFeedback(session, { rpe: 5 });
    expect(await getSession('ses_descartada')).toBeFalsy();
  });
});
