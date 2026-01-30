/**
 * Zwift Play BLE controller module
 * Connects to Zwift Play left/right pads, handshake (ECDH + HKDF + AES-CCM), decrypts button notifications.
 * Ref: https://www.makinolo.com/blog/2023/10/08/connecting-to-zwift-play-controllers/
 */

import { decryptAesCcm } from './aesCcm.js';

const ZWIFT_PLAY_SERVICE = '00000001-19ca-4651-86e5-fa29dcdd09d1';
const MEASUREMENT_UUID = '00000002-19ca-4651-86e5-fa29dcdd09d1';
const CONTROL_POINT_UUID = '00000003-19ca-4651-86e5-fa29dcdd09d1';
const COMMAND_RESPONSE_UUID = '00000004-19ca-4651-86e5-fa29dcdd09d1';

const RIDEON_PREFIX = new Uint8Array([0x52, 0x69, 0x64, 0x65, 0x4f, 0x6e]); // "RideOn"
const APP_KEY_PREFIX = new Uint8Array([0x52, 0x69, 0x64, 0x65, 0x4f, 0x6e, 0x01, 0x02]);

const OPCODE_BUTTON_STATUS = 0x07;
const OPCODE_IDLE = 0x15;

const BUTTON_TAGS = {
    0x08: 'pad',
    0x10: 'Y',
    0x18: 'Z',
    0x20: 'A',
    0x28: 'B',
    0x30: 'ONOFF',
    0x38: 'Shifter',
    0x40: 'joystick',
    0x48: 'brake',
};

export const ZWIFT_PLAY_STATE = {
    DISCONNECTED: 'disconnected',
    CONNECTING: 'connecting',
    CONNECTED: 'connected',
};

const wantDebug = typeof localStorage !== 'undefined' && localStorage.getItem('smartTrainer_debug') === '1';

function log(...args) {
    if (wantDebug) console.log('[ZwiftPlay]', ...args);
}

/**
 * Parse protobuf-style tag/value pairs from decrypted payload (after opcode 0x07)
 * Returns { pad: 0|1, Y: 0|1, Z: 0|1, A: 0|1, B: 0|1, ONOFF: 0|1, ... } (0 = pressed)
 */
function parseButtonPayload(data) {
    const result = { pad: undefined };
    let i = 0;
    while (i < data.length) {
        const tag = data[i];
        if (tag === undefined) break;
        const fieldNum = tag >> 3;
        const wireType = tag & 7;
        i += 1;
        if (wireType !== 0) continue;
        let value = 0;
        let shift = 0;
        while (i < data.length) {
            const b = data[i++];
            value |= (b & 0x7f) << shift;
            if ((b & 0x80) === 0) break;
            shift += 7;
        }
        const name = BUTTON_TAGS[tag];
        if (name) result[name] = value;
    }
    return result;
}

/**
 * Single Zwift Play device session (one left or one right pad)
 */
class ZwiftPlayDeviceSession {
    constructor(device, pad = null) {
        this.device = device;
        this.pad = pad;
        this.server = null;
        this.measurementChar = null;
        this.controlPointChar = null;
        this.commandResponseChar = null;
        this.sharedKey = null;
        this.sendCounter = 0;
        this.onButton = null;
    }

    async connect() {
        log('Connecting GATT...', this.device.name);
        this.server = await this.device.gatt.connect();
        const service = await this.server.getPrimaryService(ZWIFT_PLAY_SERVICE);
        this.measurementChar = await service.getCharacteristic(MEASUREMENT_UUID);
        this.controlPointChar = await service.getCharacteristic(CONTROL_POINT_UUID);
        this.commandResponseChar = await service.getCharacteristic(COMMAND_RESPONSE_UUID);
        await this.doHandshake();
        this.commandResponseChar.addEventListener('characteristicvaluechanged', this.handleIndicationBound = (e) => this.handleIndication(e));
        await this.commandResponseChar.startNotifications();
        await this.measurementChar.startNotifications();
        this.measurementChar.addEventListener('characteristicvaluechanged', this.handleMeasurementBound = (e) => this.handleMeasurement(e));
        log('Handshake done, subscribed to Measurement');
    }

    async doHandshake() {
        const keyPair = await crypto.subtle.generateKey(
            { name: 'ECDH', namedCurve: 'P-256' },
            true,
            ['deriveBits']
        );
        await this.commandResponseChar.startNotifications();
        const pubKeyJwk = await crypto.subtle.exportKey('jwk', keyPair.publicKey);
        const x = base64urlToUint8(pubKeyJwk.x);
        const y = base64urlToUint8(pubKeyJwk.y);
        const appPubKeyRaw = new Uint8Array(64);
        appPubKeyRaw.set(x.length >= 32 ? x.subarray(-32) : new Uint8Array(32).fill(0).set(x, 32 - x.length), 0);
        appPubKeyRaw.set(y.length >= 32 ? y.subarray(-32) : new Uint8Array(32).fill(0).set(y, 32 - y.length), 32);
        const toSend = new Uint8Array(APP_KEY_PREFIX.length + appPubKeyRaw.length);
        toSend.set(APP_KEY_PREFIX, 0);
        toSend.set(appPubKeyRaw, APP_KEY_PREFIX.length);
        await this.controlPointChar.writeValue(toSend);

        const devicePubKeyRaw = await new Promise((resolve, reject) => {
            const handler = (e) => {
                const v = e.target.value;
                if (!v || v.byteLength < 8 + 64) return;
                const buf = new Uint8Array(v.buffer, v.byteOffset, v.byteLength);
                if (buf[0] !== 0x52 || buf[1] !== 0x69) return;
                this.commandResponseChar.removeEventListener('characteristicvaluechanged', handler);
                const keyBytes = buf.subarray(8, 8 + 64);
                resolve(keyBytes);
            };
            this.commandResponseChar.addEventListener('characteristicvaluechanged', handler);
            setTimeout(() => {
                this.commandResponseChar.removeEventListener('characteristicvaluechanged', handler);
                reject(new Error('Handshake timeout waiting for device public key'));
            }, 10000);
        });

        const appPubKeyCrypto = await crypto.subtle.importKey(
            'raw',
            pointToUncompressed(appPubKeyRaw),
            { name: 'ECDH', namedCurve: 'P-256' },
            false,
            []
        );
        const devicePubKeyCrypto = await crypto.subtle.importKey(
            'raw',
            pointToUncompressed(devicePubKeyRaw),
            { name: 'ECDH', namedCurve: 'P-256' },
            false,
            []
        );
        const ecdhBits = await crypto.subtle.deriveBits(
            { name: 'ECDH', public: devicePubKeyCrypto },
            keyPair.privateKey,
            256
        );
        const salt = new Uint8Array(devicePubKeyRaw.length + appPubKeyRaw.length);
        salt.set(devicePubKeyRaw, 0);
        salt.set(appPubKeyRaw, devicePubKeyRaw.length);
        const hkdfKey = await crypto.subtle.importKey(
            'raw',
            ecdhBits,
            { name: 'HKDF' },
            false,
            ['deriveBits']
        );
        const derived = await crypto.subtle.deriveBits(
            {
                name: 'HKDF',
                hash: 'SHA-256',
                salt,
                info: new Uint8Array(0),
            },
            hkdfKey,
            36 * 8
        );
        this.sharedKey = new Uint8Array(derived);
        log('HKDF key derived, 36 bytes');
    }

    handleIndication(event) {
        const v = event.target.value;
        if (!v || v.byteLength < 8) return;
    }

    async handleMeasurement(event) {
        if (!this.sharedKey) return;
        const v = event.target.value;
        if (!v || v.byteLength < 4 + 1 + 4) return;
        const packet = new Uint8Array(v.buffer, v.byteOffset, v.byteLength);
        try {
            const { plaintext, authOk } = await decryptAesCcm(this.sharedKey, packet);
            if (!authOk) return;
            if (plaintext.length === 1 && plaintext[0] === OPCODE_IDLE) return;
            if (plaintext[0] !== OPCODE_BUTTON_STATUS) return;
            const payload = plaintext.subarray(1);
            const buttons = parseButtonPayload(payload);
            const padName = buttons.pad === 1 ? 'left' : 'right';
            if (this.pad === null) this.pad = padName;
            Object.keys(buttons).forEach((key) => {
                if (key === 'pad' || key === 'joystick' || key === 'brake') return;
                const pressed = buttons[key] === 0;
                if (this.onButton) this.onButton({ button: key, pressed, pad: padName });
            });
        } catch (err) {
            log('Decrypt error', err);
        }
    }

    disconnect() {
        if (this.measurementChar && this.handleMeasurementBound) {
            this.measurementChar.removeEventListener('characteristicvaluechanged', this.handleMeasurementBound);
        }
        if (this.commandResponseChar && this.handleIndicationBound) {
            this.commandResponseChar.removeEventListener('characteristicvaluechanged', this.handleIndicationBound);
        }
        if (this.device && this.device.gatt && this.device.gatt.connected) {
            this.device.gatt.disconnect();
        }
    }
}

function base64urlToUint8(str) {
    let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
    const pad = (4 - (base64.length % 4)) % 4;
    if (pad) base64 += '='.repeat(pad);
    const bin = atob(base64);
    const arr = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
    return arr;
}

function pointToUncompressed(xy64) {
    const out = new Uint8Array(65);
    out[0] = 0x04;
    out.set(xy64, 1);
    return out;
}

/**
 * Zwift Play manager: one or two device sessions, merged button events
 */
export class ZwiftPlayManager {
    constructor() {
        this.state = ZWIFT_PLAY_STATE.DISCONNECTED;
        this.sessions = [];
        this.onStateChange = null;
        this.onButton = null;
    }

    setState(s) {
        this.state = s;
        if (this.onStateChange) this.onStateChange(s);
    }

    isConnected() {
        return this.state === ZWIFT_PLAY_STATE.CONNECTED && this.sessions.length > 0;
    }

    async connect() {
        if (!navigator.bluetooth) {
            throw new Error('Web Bluetooth no disponible');
        }
        // Abrir selector SIN tocar la UI: si hacemos setState aquí, el re-render puede cerrar el cuadro del navegador
        const devicePromise = navigator.bluetooth.requestDevice({
            filters: [
                { name: 'Zwift Play' },
                { name: 'Zwift Click' },
                { namePrefix: 'Zwift' },
                { services: [ZWIFT_PLAY_SERVICE] },
            ],
            optionalServices: [ZWIFT_PLAY_SERVICE],
        });
        try {
            const device = await devicePromise;
            this.setState(ZWIFT_PLAY_STATE.CONNECTING);
            const session = new ZwiftPlayDeviceSession(device);
            session.onButton = (ev) => {
                if (this.onButton) this.onButton(ev);
            };
            await session.connect();
            this.sessions.push(session);
            device.addEventListener('gattserverdisconnected', () => this.handleDisconnected(session));
            this.setState(ZWIFT_PLAY_STATE.CONNECTED);
            log('One Zwift Play controller connected');
            return device;
        } catch (err) {
            this.setState(ZWIFT_PLAY_STATE.DISCONNECTED);
            throw err;
        }
    }

    /**
     * Conectar mostrando todos los dispositivos BLE (fallback si el filtro no encuentra el mando).
     * El usuario debe elegir el dispositivo "Zwift Play" de la lista.
     */
    async connectAcceptAll() {
        if (!navigator.bluetooth) {
            throw new Error('Web Bluetooth no disponible');
        }
        const devicePromise = navigator.bluetooth.requestDevice({
            acceptAllDevices: true,
            optionalServices: [ZWIFT_PLAY_SERVICE],
        });
        try {
            const device = await devicePromise;
            this.setState(ZWIFT_PLAY_STATE.CONNECTING);
            const session = new ZwiftPlayDeviceSession(device);
            session.onButton = (ev) => {
                if (this.onButton) this.onButton(ev);
            };
            await session.connect();
            this.sessions.push(session);
            device.addEventListener('gattserverdisconnected', () => this.handleDisconnected(session));
            this.setState(ZWIFT_PLAY_STATE.CONNECTED);
            log('One Zwift Play controller connected (acceptAll)');
            return device;
        } catch (err) {
            this.setState(ZWIFT_PLAY_STATE.DISCONNECTED);
            throw err;
        }
    }

    async connectSecond() {
        if (!navigator.bluetooth || this.sessions.length === 0) return null;
        const devicePromise = navigator.bluetooth.requestDevice({
            filters: [
                { name: 'Zwift Play' },
                { name: 'Zwift Click' },
                { namePrefix: 'Zwift' },
                { services: [ZWIFT_PLAY_SERVICE] },
            ],
            optionalServices: [ZWIFT_PLAY_SERVICE],
        });
        try {
            const device = await devicePromise;
            this.setState(ZWIFT_PLAY_STATE.CONNECTING);
            if (this.sessions.some((s) => s.device === device)) {
                throw new Error('Ese mando ya está conectado');
            }
            const session = new ZwiftPlayDeviceSession(device);
            session.onButton = (ev) => {
                if (this.onButton) this.onButton(ev);
            };
            await session.connect();
            this.sessions.push(session);
            device.addEventListener('gattserverdisconnected', () => this.handleDisconnected(session));
            this.setState(ZWIFT_PLAY_STATE.CONNECTED);
            log('Second Zwift Play controller connected');
            return device;
        } catch (err) {
            this.setState(ZWIFT_PLAY_STATE.CONNECTED);
            throw err;
        }
    }

    handleDisconnected(session) {
        this.sessions = this.sessions.filter((s) => s !== session);
        session.disconnect();
        if (this.sessions.length === 0) {
            this.setState(ZWIFT_PLAY_STATE.DISCONNECTED);
        }
    }

    disconnect() {
        this.sessions.forEach((s) => s.disconnect());
        this.sessions = [];
        this.setState(ZWIFT_PLAY_STATE.DISCONNECTED);
    }
}

/** Mapeo de botones Zwift Play/Click → acciones del juego. Sirve para ambos mandos (flechas y botones). */
export const PLAY_BUTTON_TO_ACTION = {
    Y: 'jump',      // flecha arriba o botón Y
    A: 'jump',      // flecha derecha o botón A
    B: 'duck',      // flecha abajo o botón B
    Z: 'duck',     // flecha izquierda o botón Z
    ONOFF: 'pause',
    Shifter: 'jump', // palanca/cambio en algunos mandos
};
