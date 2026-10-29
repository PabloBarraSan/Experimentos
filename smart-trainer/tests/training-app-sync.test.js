import 'fake-indexeddb/auto';
import { loadSettings, updateSettings } from '../src/storage/settings.js';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { createSession, enqueueSyncJob, getAllSessions, getSession, getSyncJobs, initDB, saveSession, saveSessionFeedback, normalizeFeedback } from '../src/storage/sessions.js';
import {
  buildLinkUrl,
  connectTrainingApp,
  consumeConnectLink,
  applyProfileFtp,
  fetchTodayPlan,
  flushSyncOutbox,
  forgetSession,
  pullSessions,
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

  describe('FTP del perfil', () => {
    it('lo adopta si el local es el de fábrica y lo actualiza mientras el usuario no lo toque', () => {
      expect(loadSettings().ftp).toBe(200);
      expect(applyProfileFtp(238)).toBe(true);
      expect(loadSettings().ftp).toBe(238);
      expect(applyProfileFtp(238)).toBe(false);
      expect(applyProfileFtp(245)).toBe(true);
      expect(loadSettings().ftp).toBe(245);
    });

    it('no pisa un FTP que el usuario cambió en la app ni acepta valores absurdos', () => {
      updateSettings({ ftp: 260 });
      expect(applyProfileFtp(238)).toBe(false);
      expect(loadSettings().ftp).toBe(260);
      expect(applyProfileFtp(9000)).toBe(false);
      expect(applyProfileFtp(null)).toBe(false);
    });

    it('fetchTodayPlan aplica el FTP que devuelve el plan', async () => {
      localStorage.setItem('smartTrainer_trainingApp', JSON.stringify({ baseUrl: 'http://x', token: 't' }));
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(json(200, { planned: null, next: null, ftp: 231 })));
      await fetchTodayPlan();
      expect(loadSettings().ftp).toBe(231);
    });
  });
  describe('descarga del historial', () => {
    const remote = (n, extra = {}) => ({
      _id: `id${n}`,
      clientSessionId: `cli-${n}`,
      workoutName: `Remota ${n}`,
      status: 'completed',
      ftp: 240,
      startedAt: '2026-10-01T08:00:00.000Z',
      endedAt: '2026-10-01T09:00:00.000Z',
      activeDurationSeconds: 3600,
      metrics: { power: { avg: 180 } },
      routeId: 'ruta-1',
      dataPoints: [{ timestamp: 1, power: 180 }],
      ...extra,
    });
    const route = (list) => vi.fn(async (url) => {
      if (url.includes('/sessions?limit=')) return json(200, { sessions: list.map(({ dataPoints, ...summary }) => summary) });
      const found = list.find((item) => url.endsWith(`/sessions/${item._id}`));
      return found ? json(200, { session: found }) : json(404);
    });

    beforeEach(() => localStorage.setItem('smartTrainer_trainingApp', JSON.stringify({ baseUrl: 'http://x', token: 't' })));

    it('trae solo las sesiones que faltan y las deja como sesiones locales', async () => {
      const local = createSession({ workoutName: 'Local' });
      local.clientSessionId = 'cli-1';
      local.status = 'completed';
      await saveSession(local);

      const fetchMock = route([remote(1), remote(2)]);
      vi.stubGlobal('fetch', fetchMock);
      expect(await pullSessions()).toMatchObject({ remote: 2, pulled: 1, failed: 0 });
      expect(fetchMock.mock.calls.some(([url]) => url.endsWith('/sessions/id1'))).toBe(false);

      const pulled = (await getAllSessions()).find((session) => session.clientSessionId === 'cli-2');
      expect(pulled).toMatchObject({
        id: 'remote_cli-2', workoutName: 'Remota 2', status: 'completed', duration: 3600, ftp: 240, routeId: 'ruta-1',
      });
      expect(pulled.dataPoints).toHaveLength(1);
      expect(new Date(pulled.date).getTime()).toBe(pulled.startTime);

      // Repetir no duplica
      expect((await pullSessions()).pulled).toBe(0);
    });

    it('no vuelve a bajar lo que el usuario borró aquí y encola el borrado remoto', async () => {
      const fetchMock = route([remote(3)]);
      vi.stubGlobal('fetch', fetchMock);
      await pullSessions();
      const session = (await getAllSessions()).find((item) => item.clientSessionId === 'cli-3');

      fetchMock.mockImplementation(async (url, init) => (init?.method === 'DELETE' ? json(200, { deleted: 1 }) : route([remote(3)])(url)));
      await forgetSession(session);
      await flushSyncOutbox();
      const deleteCall = fetchMock.mock.calls.find(([, init]) => init?.method === 'DELETE');
      expect(deleteCall[0]).toBe('http://x/api/smart-trainer/sessions/cli-3');

      const { deleteSession } = await import('../src/storage/sessions.js');
      await deleteSession(session.id);
      expect((await pullSessions()).pulled).toBe(0);
      expect((await getAllSessions()).some((item) => item.clientSessionId === 'cli-3')).toBe(false);
    });

    it('con token caducado avisa y con error de servidor cuenta el fallo sin perder lo demás', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(json(401)));
      await expect(pullSessions()).rejects.toMatchObject({ code: 'AUTH_EXPIRED' });

      localStorage.setItem('smartTrainer_trainingApp', JSON.stringify({ baseUrl: 'http://x', token: 't' }));
      const list = [remote(4), remote(5)];
      vi.stubGlobal('fetch', vi.fn(async (url) => (url.endsWith('/sessions/id4') ? json(500) : route(list)(url))));
      expect(await pullSessions()).toMatchObject({ pulled: 1, failed: 1 });
    });
  });
  describe('enlace sin contraseña', () => {
    const stubLocation = (hash) => {
      const replaceState = vi.fn();
      vi.stubGlobal('window', { location: { hash, origin: 'https://rodillo.kitraining.app', pathname: '/', search: '' }, history: { replaceState } });
      return replaceState;
    };

    it('construye la URL de vuelta a esta app', () => {
      stubLocation('');
      expect(buildLinkUrl('https://app.kitraining.app/')).toBe(
        'https://app.kitraining.app/conectar-rodillo?return=https%3A%2F%2Frodillo.kitraining.app%2F',
      );
      expect(() => buildLinkUrl('app.kitraining.app')).toThrow(/http/);
    });

    it('guarda el token que llega en el fragmento y limpia la URL', () => {
      const replaceState = stubLocation('#/connect?token=jwt123&email=yo%40mail.com&base=https%3A%2F%2Fapp.kitraining.app');
      expect(consumeConnectLink()).toEqual({ email: 'yo@mail.com' });
      expect(replaceState).toHaveBeenCalledWith(null, '', '/#/settings');
      expect(getSyncConfig()).toMatchObject({ baseUrl: 'https://app.kitraining.app', token: 'jwt123', email: 'yo@mail.com' });
      expect(isSyncConnected()).toBe(true);
    });

    it('ignora otras URLs y rechaza servidores que no sean https ni localhost', () => {
      const replaceState = stubLocation('#/history');
      expect(consumeConnectLink()).toBeNull();
      expect(replaceState).not.toHaveBeenCalled();

      stubLocation('#/connect?token=jwt&base=http%3A%2F%2Fevil.example');
      expect(consumeConnectLink()).toBeNull();
      expect(isSyncConnected()).toBe(false);
    });
  });
});
