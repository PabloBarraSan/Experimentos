import { describe, expect, it, vi } from 'vitest';
import { reconnectWithBackoff } from '../src/bluetooth/reconnect.js';
import { HeartRateManager, HR_CONNECTION_STATE } from '../src/bluetooth/heartRate.js';
import { BluetoothManager, CONNECTION_STATE } from '../src/bluetooth/scanner.js';
import { SessionController, SESSION_STATE } from '../src/session/SessionController.js';

const noWait = () => Promise.resolve();

describe('reconnectWithBackoff', () => {
    it('reintenta con espera creciente hasta que conecta', async () => {
        const waits = [];
        const connect = vi.fn()
            .mockRejectedValueOnce(new Error('fuera de alcance'))
            .mockRejectedValueOnce(new Error('fuera de alcance'))
            .mockResolvedValue();
        const ok = await reconnectWithBackoff({
            connect,
            delays: [1000, 2000, 4000, 8000],
            wait: async (ms) => { waits.push(ms); },
        });
        expect(ok).toBe(true);
        expect(connect).toHaveBeenCalledTimes(3);
        expect(waits).toEqual([1000, 2000, 4000]);
    });

    it('se rinde al agotar los retardos si no es indefinido', async () => {
        const onFailure = vi.fn();
        const ok = await reconnectWithBackoff({
            connect: () => Promise.reject(new Error('no')),
            delays: [1, 2, 3],
            onFailure,
            wait: noWait,
        });
        expect(ok).toBe(false);
        expect(onFailure).toHaveBeenCalledTimes(3);
    });

    it('en modo indefinido repite el último retardo', async () => {
        const waits = [];
        let calls = 0;
        const ok = await reconnectWithBackoff({
            connect: async () => { if (++calls < 6) throw new Error('no'); },
            delays: [1, 2],
            forever: true,
            wait: async (ms) => { waits.push(ms); },
        });
        expect(ok).toBe(true);
        expect(waits).toEqual([1, 2, 2, 2, 2, 2]);
    });

    it('para en cuanto shouldStop lo pide (desconexión manual)', async () => {
        let stop = false;
        const connect = vi.fn(async () => { stop = true; throw new Error('no'); });
        const ok = await reconnectWithBackoff({ connect, shouldStop: () => stop, delays: [1, 1, 1], forever: true, wait: noWait });
        expect(ok).toBe(false);
        expect(connect).toHaveBeenCalledTimes(1);
    });

    it('corta un intento colgado con el tiempo límite y sigue', async () => {
        const onAttemptTimeout = vi.fn();
        const connect = vi.fn()
            .mockReturnValueOnce(new Promise(() => {})) // gatt.connect() que nunca responde
            .mockResolvedValue();
        const ok = await reconnectWithBackoff({ connect, delays: [0, 0], attemptTimeoutMs: 5, onAttemptTimeout, wait: noWait });
        expect(ok).toBe(true);
        expect(onAttemptTimeout).toHaveBeenCalledTimes(1);
        expect(connect).toHaveBeenCalledTimes(2);
    });
});

/** BluetoothDevice falso: gatt.connect() falla mientras `outOfRange` sea true. */
function fakeDevice({ characteristics = {} } = {}) {
    const listeners = new Map();
    const makeCharacteristic = () => ({
        startNotifications: vi.fn(async () => {}),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        readValue: vi.fn(async () => new DataView(new Uint8Array(8).buffer)),
    });
    const chars = new Map();
    const device = {
        name: 'Banda',
        id: 'dev-1',
        outOfRange: false,
        failuresLeft: 0,
        chars,
        gatt: {
            connected: false,
            connect: vi.fn(async () => {
                if (device.outOfRange || device.failuresLeft > 0) {
                    device.failuresLeft--;
                    throw Object.assign(new Error('Fuera de alcance'), { name: 'NetworkError' });
                }
                device.gatt.connected = true;
                return {
                    getPrimaryService: async () => ({
                        getCharacteristic: async (uuid) => {
                            if (characteristics.missing?.includes(uuid)) throw new Error('no existe');
                            if (!chars.has(uuid)) chars.set(uuid, makeCharacteristic());
                            return chars.get(uuid);
                        },
                    }),
                };
            }),
            disconnect: vi.fn(() => { device.gatt.connected = false; }),
        },
        addEventListener: (type, fn) => listeners.set(type, (listeners.get(type) || new Set()).add(fn)),
        removeEventListener: (type, fn) => listeners.get(type)?.delete(fn),
        listenerCount: (type) => listeners.get(type)?.size || 0,
        drop() {
            device.gatt.connected = false;
            return Promise.all([...(listeners.get('gattserverdisconnected') || [])].map((fn) => fn()));
        },
    };
    return device;
}

async function connectedHeartRate() {
    const states = [];
    const callbacks = {
        onStateChange: vi.fn((state) => states.push(state)),
        onDeviceConnected: vi.fn(),
        onDeviceDisconnected: vi.fn(),
        onHeartRateReceived: vi.fn(),
        onError: vi.fn(),
    };
    const manager = new HeartRateManager(callbacks);
    manager.reconnectDelays = [0, 0, 0];
    const device = fakeDevice({ characteristics: { missing: [0x2A38] } });
    manager.setDevice(device);
    await manager.connect();
    states.length = 0;
    return { manager, device, states, callbacks };
}

describe('HeartRateManager: reconexión al caerse el GATT', () => {
    it('reconecta con el mismo dispositivo, se vuelve a suscribir y no pasa por DISCONNECTED', async () => {
        const { manager, device, states, callbacks } = await connectedHeartRate();
        device.failuresLeft = 2;
        await device.drop();
        expect(manager.state).toBe(HR_CONNECTION_STATE.CONNECTED);
        expect(states[0]).toBe(HR_CONNECTION_STATE.RECONNECTING);
        expect(states).not.toContain(HR_CONNECTION_STATE.DISCONNECTED);
        expect(device.gatt.connect).toHaveBeenCalledTimes(1 + 3);
        expect(device.chars.get(0x2A37).startNotifications).toHaveBeenCalledTimes(2);
        expect(callbacks.onDeviceDisconnected).not.toHaveBeenCalled();
        expect(callbacks.onError).not.toHaveBeenCalled();
        expect(device.listenerCount('gattserverdisconnected')).toBe(1);
    });

    it('dos eventos de desconexión seguidos solo arrancan un bucle', async () => {
        const { manager, device } = await connectedHeartRate();
        device.failuresLeft = 1;
        await Promise.all([manager.handleDisconnection(), manager.handleDisconnection(), device.drop()]);
        expect(manager.state).toBe(HR_CONNECTION_STATE.CONNECTED);
        expect(device.gatt.connect).toHaveBeenCalledTimes(1 + 2);
    });

    it('tras varios fallos pide reconexión manual pero sigue reintentando', async () => {
        const { manager, device } = await connectedHeartRate();
        device.failuresLeft = 7;
        let flaggedWhileReconnecting = false;
        manager.onStateChange = (state) => {
            if (state === HR_CONNECTION_STATE.RECONNECTING && manager.needsManualReconnect) flaggedWhileReconnecting = true;
        };
        await device.drop();
        expect(flaggedWhileReconnecting).toBe(true);
        expect(manager.state).toBe(HR_CONNECTION_STATE.CONNECTED);
        expect(manager.needsManualReconnect).toBe(false);
    });

    it('si se cae justo después de reconectar a mano, arranca otro bucle y el antiguo no estorba', async () => {
        const { manager, device } = await connectedHeartRate();
        manager.reconnectDelays = [30];
        device.failuresLeft = 99;
        const staleLoop = device.drop();
        expect(manager.state).toBe(HR_CONNECTION_STATE.RECONNECTING);

        // Botón «Reconectar pulsómetro» mientras el bucle duerme.
        device.failuresLeft = 0;
        await manager.reconnect();
        expect(manager.state).toBe(HR_CONNECTION_STATE.CONNECTED);

        device.failuresLeft = 1;
        const freshLoop = device.drop();
        expect(manager.state).toBe(HR_CONNECTION_STATE.RECONNECTING);
        await Promise.all([staleLoop, freshLoop]);
        expect(manager.state).toBe(HR_CONNECTION_STATE.CONNECTED);
        expect(manager.reconnecting).toBe(false);
        expect(device.gatt.connected).toBe(true);
        const measurement = device.chars.get(0x2A37);
        expect(measurement.addEventListener.mock.calls.at(-1)[0]).toBe('characteristicvaluechanged');
        expect(measurement.startNotifications).toHaveBeenCalledTimes(3);
    });

    it('el caso real: la banda pasa un buen rato fuera de alcance y al volver reconecta sola', async () => {
        const { manager, device, callbacks } = await connectedHeartRate();
        device.outOfRange = true;
        const loop = device.drop();
        await vi.waitFor(() => expect(device.gatt.connect.mock.calls.length).toBeGreaterThan(40));
        expect(manager.state).toBe(HR_CONNECTION_STATE.RECONNECTING);
        device.outOfRange = false;
        await loop;
        expect(manager.state).toBe(HR_CONNECTION_STATE.CONNECTED);
        expect(callbacks.onError).not.toHaveBeenCalled();
    });

    it('volver a registrar el mismo dispositivo no duplica el listener ni los bucles', async () => {
        const { manager, device } = await connectedHeartRate();
        manager.setDevice(device);
        manager.setDevice(device);
        await device.drop();
        expect(device.listenerCount('gattserverdisconnected')).toBe(1);
        expect(device.gatt.connect).toHaveBeenCalledTimes(1 + 1);
    });

    it('conectado pero sin datos: fuerza la reconexión aunque no llegue el evento', async () => {
        const { manager, device } = await connectedHeartRate();
        manager.silenceTimeoutMs = 5;
        manager.armSilenceWatchdog();
        await vi.waitFor(() => expect(device.gatt.disconnect).toHaveBeenCalled());
        await vi.waitFor(() => expect(manager.state).toBe(HR_CONNECTION_STATE.CONNECTED));
        expect(device.gatt.connect.mock.calls.length).toBeGreaterThan(1);
        manager.disconnect();
    });

    it('mientras llegan latidos no salta el aviso de silencio', async () => {
        const { manager, device, callbacks } = await connectedHeartRate();
        manager.silenceTimeoutMs = 40;
        const beat = { target: { value: new DataView(new Uint8Array([0, 120]).buffer) } };
        for (let i = 0; i < 6; i++) {
            manager.handleHRData(beat);
            await new Promise((resolve) => setTimeout(resolve, 10));
        }
        expect(device.gatt.disconnect).not.toHaveBeenCalled();
        expect(callbacks.onHeartRateReceived).toHaveBeenCalledTimes(6);
        manager.disconnect();
    });

    it('retryNow acorta la espera entre intentos', async () => {
        const { manager, device } = await connectedHeartRate();
        manager.reconnectDelays = [60000];
        const loop = device.drop();
        expect(device.gatt.connect).toHaveBeenCalledTimes(1);
        manager.retryNow();
        await loop;
        expect(manager.state).toBe(HR_CONNECTION_STATE.CONNECTED);
        manager.disconnect();
    });

    it('un intento abandonado que falla tarde no rompe la conexión del siguiente', async () => {
        const { manager, device } = await connectedHeartRate();
        let failLate;
        device.gatt.connect.mockImplementationOnce(() => new Promise((_, reject) => { failLate = reject; }));
        const abandoned = manager.connect({ reconnecting: true }).catch(() => {});
        await manager.connect({ reconnecting: true });
        failLate(new Error('tarde'));
        await abandoned;
        expect(manager.characteristic).not.toBeNull();
        manager.disconnect();
    });

    it('una desconexión manual detiene los reintentos', async () => {
        const { manager, device, callbacks } = await connectedHeartRate();
        device.outOfRange = true;
        manager.reconnectDelays = [0];
        const loop = device.drop();
        await new Promise((resolve) => setTimeout(resolve, 5));
        manager.disconnect();
        await loop;
        const calls = device.gatt.connect.mock.calls.length;
        await new Promise((resolve) => setTimeout(resolve, 5));
        expect(device.gatt.connect.mock.calls.length).toBe(calls);
        expect(manager.state).toBe(HR_CONNECTION_STATE.DISCONNECTED);
        expect(manager.reconnecting).toBe(false);
        expect(callbacks.onDeviceDisconnected).toHaveBeenCalledTimes(1);
    });
});

describe('BluetoothManager (rodillo): reconexión', () => {
    function trainerManager() {
        const states = [];
        const callbacks = {
            onStateChange: (state) => states.push(state),
            onDeviceConnected: vi.fn(),
            onDeviceDisconnected: vi.fn(),
            onError: vi.fn(),
        };
        const manager = new BluetoothManager(callbacks);
        manager.reconnectDelays = [0, 0, 0];
        const device = fakeDevice();
        manager.device = device;
        manager.attachDeviceDisconnectListener();
        // La cola de comandos real espera respuestas del control point: aquí basta con que no falle.
        manager.subscribeToNotifications = vi.fn(async () => {});
        return { manager, device, states, callbacks };
    }

    it('reconecta y vuelve a pedir control al rodillo sin estados intermedios', async () => {
        const { manager, device, states, callbacks } = trainerManager();
        const { CommandQueue } = await import('../src/bluetooth/commands.js');
        vi.spyOn(CommandQueue.prototype, 'requestControl').mockResolvedValue();
        vi.spyOn(CommandQueue.prototype, 'start').mockResolvedValue();
        device.failuresLeft = 1;
        await device.drop();
        expect(manager.state).toBe(CONNECTION_STATE.CONNECTED);
        expect(states).toEqual([CONNECTION_STATE.RECONNECTING, CONNECTION_STATE.CONNECTED]);
        expect(manager.subscribeToNotifications).toHaveBeenCalledTimes(1);
        expect(CommandQueue.prototype.requestControl).toHaveBeenCalledTimes(1);
        expect(callbacks.onDeviceDisconnected).not.toHaveBeenCalled();
        vi.restoreAllMocks();
    });

    it('al agotar los intentos avisa una vez y ofrece reconexión manual', async () => {
        const { manager, device, states, callbacks } = trainerManager();
        device.outOfRange = true;
        await device.drop();
        expect(device.gatt.connect).toHaveBeenCalledTimes(3);
        expect(states.at(-1)).toBe(CONNECTION_STATE.DISCONNECTED);
        expect(states.filter((state) => state === CONNECTION_STATE.DISCONNECTED)).toHaveLength(1);
        expect(manager.needsManualReconnect).toBe(true);
        expect(callbacks.onDeviceDisconnected).toHaveBeenCalledTimes(1);
        expect(callbacks.onError).toHaveBeenCalledTimes(1);
    });
});

describe('SessionController.resume', () => {
    it('reenvía el objetivo ERG al reanudar (p. ej. tras reconectar el rodillo)', async () => {
        const manager = { setTargetPower: vi.fn(async () => {}), startTraining: vi.fn(async () => {}) };
        const controller = new SessionController({ bluetoothManager: manager });
        controller.debug = { log() {} };
        controller.session = { status: 'paused', pausedDuration: 0 };
        controller.state = SESSION_STATE.PAUSED;
        controller.rawTarget = { power: 210 };
        controller.trainer.lastTargetKey = '210:';
        await controller.resume();
        await controller.sendChain;
        expect(manager.startTraining).toHaveBeenCalled();
        expect(manager.setTargetPower).toHaveBeenCalledWith(210);
    });
});
