/**
 * Heart Rate Manager - Gestión de conexión BLE con pulsómetros
 * Smart Trainer Controller
 * 
 * Servicio: Heart Rate Service (0x180D)
 * Característica: Heart Rate Measurement (0x2A37)
 */

import { reconnectWithBackoff } from './reconnect.js';
import { logActiveSessionEvent } from '../diagnostics/SessionDebugLogger.js';

// Intentos automáticos antes de ofrecer el botón de reconexión manual (se sigue reintentando).
const MANUAL_RECONNECT_AFTER_ATTEMPTS = 5;

// Espera antes de cada intento; el último valor se repite sin límite. Tope corto: la banda vuelve
// en cuanto el usuario regresa a la habitación y no debe tardar medio minuto en notarse.
const HR_RECONNECT_DELAYS_MS = [1000, 2000, 4000, 8000, 10000];

// Una banda conectada notifica cada segundo: tanto silencio es un corte del que el navegador no ha avisado.
const HR_SILENCE_TIMEOUT_MS = 15000;

// UUIDs del servicio Heart Rate
export const HR_UUIDS = {
    HEART_RATE_SERVICE: 0x180D,
    HEART_RATE_MEASUREMENT: 0x2A37,
    BODY_SENSOR_LOCATION: 0x2A38,
};

// Estados de conexión
export const HR_CONNECTION_STATE = {
    DISCONNECTED: 'disconnected',
    SCANNING: 'scanning',
    CONNECTING: 'connecting',
    CONNECTED: 'connected',
    RECONNECTING: 'reconnecting',
};

// Ubicaciones del sensor
const BODY_SENSOR_LOCATIONS = {
    0: 'Otro',
    1: 'Pecho',
    2: 'Muñeca',
    3: 'Dedo',
    4: 'Mano',
    5: 'Lóbulo oreja',
    6: 'Pie',
};

/**
 * Parsear datos de Heart Rate Measurement
 * Formato según especificación Bluetooth SIG
 */
function parseHeartRateMeasurement(dataView) {
    const flags = dataView.getUint8(0);
    let offset = 1;
    
    const result = {
        timestamp: Date.now(),
    };
    
    // Bit 0: Formato del valor HR (0 = UINT8, 1 = UINT16)
    const isUint16 = flags & 0x01;
    if (isUint16) {
        result.heartRate = dataView.getUint16(offset, true);
        offset += 2;
    } else {
        result.heartRate = dataView.getUint8(offset);
        offset += 1;
    }
    
    // Bit 1-2: Estado del contacto del sensor
    const sensorContactSupported = (flags >> 1) & 0x01;
    const sensorContactDetected = (flags >> 2) & 0x01;
    if (sensorContactSupported) {
        result.sensorContact = sensorContactDetected === 1;
    }
    
    // Bit 3: Energía expendida presente
    const energyExpendedPresent = (flags >> 3) & 0x01;
    if (energyExpendedPresent && offset + 2 <= dataView.byteLength) {
        result.energyExpended = dataView.getUint16(offset, true);
        offset += 2;
    }
    
    // Bit 4: RR-Intervals presentes
    const rrIntervalsPresent = (flags >> 4) & 0x01;
    if (rrIntervalsPresent) {
        result.rrIntervals = [];
        while (offset + 2 <= dataView.byteLength) {
            // RR-Interval en unidades de 1/1024 segundos
            const rrRaw = dataView.getUint16(offset, true);
            result.rrIntervals.push(rrRaw / 1024 * 1000); // Convertir a ms
            offset += 2;
        }
    }
    
    return result;
}

/**
 * Gestor de conexión con pulsómetro BLE
 */
export class HeartRateManager {
    constructor(callbacks = {}) {
        this.device = null;
        this.server = null;
        this.service = null;
        this.characteristic = null;
        this.state = HR_CONNECTION_STATE.DISCONNECTED;
        this.sensorLocation = null;
        this.isManualDisconnect = false;
        this.reconnecting = false;
        this.reconnectRun = 0;
        this.reconnectAttempts = 0;
        this.reconnectDelays = HR_RECONNECT_DELAYS_MS;
        this.silenceTimeoutMs = HR_SILENCE_TIMEOUT_MS;
        this.silenceTimer = null;
        this.connectRun = 0;
        // true cuando los reintentos automáticos no bastan: la UI ofrece reconectar a mano.
        this.needsManualReconnect = false;

        // Bind handlers para poder removerlos
        this.handleHRDataBound = (event) => this.handleHRData(event);
        this.handleDisconnectionBound = () => this.handleDisconnection();
        
        // Callbacks
        this.onStateChange = callbacks.onStateChange || (() => {});
        this.onDeviceConnected = callbacks.onDeviceConnected || (() => {});
        this.onDeviceDisconnected = callbacks.onDeviceDisconnected || (() => {});
        this.onHeartRateReceived = callbacks.onHeartRateReceived || (() => {});
        this.onError = callbacks.onError || console.error;
        
        // Cargar dispositivo guardado
        this.loadCachedDevice();
    }
    
    /**
     * Cargar dispositivo guardado del cache
     */
    loadCachedDevice() {
        try {
            const cached = localStorage.getItem('hr_last_device');
            if (cached) {
                this.cachedDevice = JSON.parse(cached);
                if (typeof console.debug === 'function') console.debug('[HR] Dispositivo cacheado:', this.cachedDevice?.name);
            }
        } catch (e) {
            console.warn('[HR] Error al cargar dispositivo cacheado:', e);
        }
    }
    
    /**
     * Guardar dispositivo en cache
     */
    saveCachedDevice(device) {
        try {
            const deviceInfo = {
                id: device.id,
                name: device.name,
                timestamp: Date.now(),
            };
            localStorage.setItem('hr_last_device', JSON.stringify(deviceInfo));
            this.cachedDevice = deviceInfo;
        } catch (e) {
            console.warn('[HR] Error al guardar dispositivo en cache:', e);
        }
    }
    
    /**
     * Limpiar cache de dispositivo
     */
    clearCachedDevice() {
        try {
            localStorage.removeItem('hr_last_device');
            this.cachedDevice = null;
        } catch (e) {
            console.warn('[HR] Error al limpiar cache:', e);
        }
    }
    
    /**
     * Cambiar estado y notificar
     */
    setState(newState) {
        this.state = newState;
        this.onStateChange(newState);
    }
    
    /**
     * Escanear y seleccionar pulsómetro
     */
    async scan() {
        if (!navigator.bluetooth) {
            const error = new Error('Web Bluetooth no está disponible');
            this.onError(error.message);
            throw error;
        }
        
        this.setState(HR_CONNECTION_STATE.SCANNING);
        this.isManualDisconnect = false;
        
        try {
            // Solicitar dispositivo con filtro Heart Rate Service
            const device = await navigator.bluetooth.requestDevice({
                filters: [
                    { services: [HR_UUIDS.HEART_RATE_SERVICE] },
                ],
                optionalServices: [],
            });
            this.setDevice(device);

            console.log('[HR] Pulsómetro seleccionado:', this.device.name);

            // Guardar en cache
            this.saveCachedDevice(this.device);

            // Conectar al dispositivo
            await this.connect();
            
            return this.device;
            
        } catch (error) {
            this.setState(HR_CONNECTION_STATE.DISCONNECTED);
            
            if (error.name === 'NotFoundError') {
                console.log('[HR] Búsqueda cancelada por el usuario');
                throw error;
            } else {
                this.onError(`Error al conectar pulsómetro: ${error.message}`);
                throw error;
            }
        }
    }
    
    /**
     * Intentar reconexión silenciosa
     */
    async reconnectSilently() {
        if (!this.cachedDevice) {
            return null;
        }
        
        if (!navigator.bluetooth.getDevices) {
            return null;
        }
        
        try {
            console.log('[HR] Intentando reconexión silenciosa a:', this.cachedDevice.name);
            const devices = await navigator.bluetooth.getDevices();
            
            const cachedDevice = devices.find(d => d.id === this.cachedDevice.id);
            
            if (cachedDevice) {
                console.log('[HR] Dispositivo permitido encontrado');
                this.setDevice(cachedDevice);
                this.isManualDisconnect = false;

                await this.connect();
                return this.device;
            }
            
            return null;
        } catch (error) {
            console.warn('[HR] Error en reconexión silenciosa:', error);
            return null;
        }
    }
    
    /**
     * Usar un BluetoothDevice con un único listener de desconexión
     */
    setDevice(device) {
        if (this.device && this.device !== device) {
            this.device.removeEventListener?.('gattserverdisconnected', this.handleDisconnectionBound);
        }
        this.device = device;
        this.device.removeEventListener?.('gattserverdisconnected', this.handleDisconnectionBound);
        this.device.addEventListener('gattserverdisconnected', this.handleDisconnectionBound);
    }

    /**
     * Conectar al dispositivo seleccionado.
     * Con `reconnecting` el estado sigue en RECONNECTING y un fallo no se notifica:
     * el bucle de reintentos decide cuándo rendirse.
     */
    async connect({ reconnecting = false } = {}) {
        if (!this.device) {
            throw new Error('No hay pulsómetro seleccionado');
        }

        if (!reconnecting) this.setState(HR_CONNECTION_STATE.CONNECTING);
        const connectRun = ++this.connectRun;
        
        try {
            // Conectar a GATT server
            console.log('[HR] Conectando a GATT server...');
            this.server = await this.device.gatt.connect();
            
            // Obtener servicio Heart Rate
            console.log('[HR] Obteniendo servicio Heart Rate...');
            this.service = await this.server.getPrimaryService(HR_UUIDS.HEART_RATE_SERVICE);
            
            // Obtener característica de medición
            this.characteristic = await this.service.getCharacteristic(HR_UUIDS.HEART_RATE_MEASUREMENT);
            
            // Intentar leer ubicación del sensor (opcional)
            try {
                const locationChar = await this.service.getCharacteristic(HR_UUIDS.BODY_SENSOR_LOCATION);
                const locationValue = await locationChar.readValue();
                this.sensorLocation = BODY_SENSOR_LOCATIONS[locationValue.getUint8(0)] || 'Desconocido';
                console.log('[HR] Ubicación del sensor:', this.sensorLocation);
            } catch (e) {
                // No todos los pulsómetros soportan esta característica
                console.log('[HR] Ubicación del sensor no disponible');
            }
            
            // Suscribirse a notificaciones
            await this.characteristic.startNotifications();
            this.characteristic.addEventListener('characteristicvaluechanged', this.handleHRDataBound);
            
            this.reconnectAttempts = 0;
            this.needsManualReconnect = false;
            this.setState(HR_CONNECTION_STATE.CONNECTED);
            this.armSilenceWatchdog();
            this.onDeviceConnected(this.device.name, this.sensorLocation);

            console.log('[HR] Conectado exitosamente a', this.device.name);

        } catch (error) {
            // Un intento abandonado por tiempo que falla tarde no debe romper la conexión del siguiente.
            if (connectRun === this.connectRun) this.cleanup();
            if (reconnecting) throw error;
            this.setState(HR_CONNECTION_STATE.DISCONNECTED);
            this.onError(`Error al conectar pulsómetro: ${error.message}`);
            throw error;
        }
    }
    
    /**
     * Manejar datos de frecuencia cardíaca
     */
    handleHRData(event) {
        const dataView = event.target.value;
        
        if (!dataView || dataView.byteLength < 2) {
            return;
        }
        
        try {
            const data = parseHeartRateMeasurement(dataView);
            this.armSilenceWatchdog();
            this.onHeartRateReceived(data);
        } catch (error) {
            console.error('[HR] Error al parsear datos:', error);
        }
    }
    
    /**
     * Manejar desconexión: reintenta con el mismo dispositivo y espera creciente.
     * No se rinde (la banda vuelve cuando el usuario regresa a la habitación); tras
     * unos intentos marca `needsManualReconnect` para que la UI ofrezca un botón.
     */
    async handleDisconnection() {
        if (this.isManualDisconnect) {
            console.warn('[HR] Pulsómetro desconectado');
            this.setState(HR_CONNECTION_STATE.DISCONNECTED);
            this.onDeviceDisconnected();
            this.cleanup();
            return;
        }
        // Un intento fallido o cancelado también dispara el evento: el bucle ya está en marcha.
        // Si lo que se cae es una conexión viva (p. ej. tras el botón manual), empieza un bucle nuevo.
        if ((this.reconnecting && this.state !== HR_CONNECTION_STATE.CONNECTED) || !this.device) return;

        console.warn('[HR] Pulsómetro desconectado, reconectando…');
        logActiveSessionEvent('hr.disconnected', { deviceName: this.device.name || null });
        this.cleanup();
        // Cada bucle tiene su turno: uno antiguo que despierta tarde ya no actúa.
        const run = ++this.reconnectRun;
        this.reconnecting = true;
        this.reconnectAttempts = 0;
        this.setState(HR_CONNECTION_STATE.RECONNECTING);
        const device = this.device;
        const cancelAttempt = () => {
            if (run !== this.reconnectRun || this.state === HR_CONNECTION_STATE.CONNECTED) return;
            try { device.gatt?.disconnect(); } catch { /* nada que cancelar */ }
        };

        try {
            const reconnected = await reconnectWithBackoff({
                connect: () => this.connect({ reconnecting: true }),
                // Parar si el usuario desconecta, cambia de banda o la conecta desde otra pantalla.
                shouldStop: () => run !== this.reconnectRun || this.isManualDisconnect || this.device !== device || this.state === HR_CONNECTION_STATE.CONNECTED,
                delays: this.reconnectDelays,
                forever: true,
                wait: (ms) => this.waitForRetry(ms),
                onAttempt: (attempt) => {
                    this.reconnectAttempts = attempt;
                    console.log(`[HR] Intento de reconexión ${attempt}`);
                },
                onFailure: (attempt, error) => {
                    console.warn(`[HR] Intento ${attempt} fallido:`, error?.message || error);
                    logActiveSessionEvent('hr.reconnect.failed', { attempt, error: error?.message || String(error) });
                    cancelAttempt();
                    if (attempt === MANUAL_RECONNECT_AFTER_ATTEMPTS) {
                        this.needsManualReconnect = true;
                        this.setState(HR_CONNECTION_STATE.RECONNECTING);
                    }
                },
                onAttemptTimeout: cancelAttempt,
            });
            if (reconnected) logActiveSessionEvent('hr.reconnected', { attempts: this.reconnectAttempts });
        } finally {
            if (run === this.reconnectRun) this.reconnecting = false;
        }
    }

    /** Espera entre intentos, que `retryNow` puede acortar. */
    waitForRetry(ms) {
        return new Promise((resolve) => {
            const timer = setTimeout(resolve, ms);
            this.skipRetryWait = () => {
                clearTimeout(timer);
                resolve();
            };
        });
    }

    /** Reintenta ya si hay una espera en curso: en segundo plano el navegador retrasa los temporizadores. */
    retryNow() {
        this.skipRetryWait?.();
        this.skipRetryWait = null;
    }

    armSilenceWatchdog() {
        clearTimeout(this.silenceTimer);
        this.silenceTimer = setTimeout(() => this.handleSilence(), this.silenceTimeoutMs);
    }

    /** Conectado pero mudo: el evento de desconexión no ha llegado, así que se reconecta igualmente. */
    handleSilence() {
        if (this.state !== HR_CONNECTION_STATE.CONNECTED) return;
        console.warn('[HR] Sin datos del pulsómetro, se fuerza la reconexión');
        logActiveSessionEvent('hr.silent', { timeoutMs: this.silenceTimeoutMs });
        const device = this.device;
        this.handleDisconnection();
        try { device?.gatt?.disconnect(); } catch { /* el bucle ya está en marcha */ }
    }

    /**
     * Reconexión pedida por el usuario (botón) con el mismo dispositivo, sin selector.
     * Si falla, la UI ofrece «Buscar pulsómetro» (scan) en un clic nuevo: requestDevice
     * necesita un gesto reciente y no puede ir detrás de otra espera.
     */
    async reconnect() {
        if (!this.device) return this.scan();
        this.isManualDisconnect = false;
        try {
            await this.connect({ reconnecting: this.reconnecting });
        } catch (error) {
            this.onError(`No se pudo reconectar el pulsómetro: ${error.message}`);
            throw error;
        }
        return this.device;
    }
    
    /**
     * Desconectar manualmente
     */
    disconnect() {
        console.log('[HR] Desconexión manual iniciada');
        this.isManualDisconnect = true;
        this.needsManualReconnect = false;
        this.reconnectRun++;
        this.reconnecting = false;
        
        if (this.characteristic) {
            try {
                this.characteristic.removeEventListener('characteristicvaluechanged', this.handleHRDataBound);
            } catch (e) {}
        }
        
        if (this.device && this.device.gatt && this.device.gatt.connected) {
            try {
                this.device.gatt.disconnect();
            } catch (e) {
                console.warn('[HR] Error al desconectar GATT:', e);
            }
        }
        
        this.cleanup();
        this.setState(HR_CONNECTION_STATE.DISCONNECTED);
        this.onDeviceDisconnected();
    }
    
    /**
     * Limpiar referencias
     */
    cleanup() {
        clearTimeout(this.silenceTimer);
        if (this.characteristic) {
            try {
                this.characteristic.removeEventListener('characteristicvaluechanged', this.handleHRDataBound);
            } catch (e) {}
        }
        this.server = null;
        this.service = null;
        this.characteristic = null;
    }
    
    /**
     * Verificar si está conectado
     */
    isConnected() {
        return this.state === HR_CONNECTION_STATE.CONNECTED;
    }
    
    /**
     * Obtener nombre del dispositivo
     */
    getDeviceName() {
        return this.device?.name || this.cachedDevice?.name || null;
    }
}
