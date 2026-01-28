/**
 * Bluetooth Scanner - Gestión de conexión BLE
 * Smart Trainer Controller
 */

import { FTMS_UUIDS, parseIndoorBikeData, parseFitnessMachineFeature } from './ftms.js';

/**
 * Analizador de correlación para encontrar cadencia oculta (Van Rysel D100).
 * Imprime los 16 bytes y resalta los que podrían ser cadencia (30–120 rpm).
 * Usar solo en desarrollo (LOG_LEVEL DEBUG).
 */
function debugRawBytes(dataView) {
    if (!dataView || dataView.byteLength < 6) return;
    const raw = Array.from(new Uint8Array(dataView.buffer, dataView.byteOffset, dataView.byteLength));
    const timestamp = new Date().toLocaleTimeString();
    const hexString = raw.map(b => b.toString(16).padStart(2, '0')).join(' ');
    console.log(`[BT_RAW] ${timestamp} | Bytes: ${hexString}`);
    if (raw[6] > 0) {
        console.log(`%c Posible Cadencia (Byte 6): ${raw[6]}`, 'color: #00d4aa; font-weight: bold');
    }
    if (raw[10] > 0) {
        console.log(`%c Posible Dato Extra (Byte 10): ${raw[10]}`, 'color: #ffcc00');
    }
}
import { CommandQueue } from './commands.js';

// Estados de conexión
export const CONNECTION_STATE = {
    DISCONNECTED: 'disconnected',
    SCANNING: 'scanning',
    CONNECTING: 'connecting',
    CONNECTING_GATT: 'connecting_gatt',
    DISCOVERING_SERVICES: 'discovering_services',
    SUBSCRIBING: 'subscribing',
    CONNECTED: 'connected',
    RECONNECTING: 'reconnecting',
};

// Niveles de logging
const LOG_LEVELS = {
    DEBUG: 0,
    INFO: 1,
    WARN: 2,
    ERROR: 3,
};

// Detectar modo producción (sin localhost)
const isProduction = location.hostname !== 'localhost' && location.hostname !== '127.0.0.1';
const LOG_LEVEL = isProduction ? LOG_LEVELS.INFO : LOG_LEVELS.DEBUG;

/**
 * Sistema de logging estructurado
 */
class Logger {
    constructor(prefix = 'BT') {
        this.prefix = prefix;
    }
    
    debug(message, ...args) {
        if (LOG_LEVEL <= LOG_LEVELS.DEBUG) {
            console.log(`[${this.prefix}] DEBUG:`, message, ...args);
        }
    }
    
    info(message, ...args) {
        if (LOG_LEVEL <= LOG_LEVELS.INFO) {
            console.log(`[${this.prefix}]`, message, ...args);
        }
    }
    
    warn(message, ...args) {
        if (LOG_LEVEL <= LOG_LEVELS.WARN) {
            console.warn(`[${this.prefix}] WARN:`, message, ...args);
        }
    }
    
    error(message, ...args) {
        if (LOG_LEVEL <= LOG_LEVELS.ERROR) {
            console.error(`[${this.prefix}] ERROR:`, message, ...args);
        }
    }
}

/**
 * Categorización de errores Bluetooth
 */
class BluetoothError extends Error {
    constructor(message, code, originalError = null) {
        super(message);
        this.name = 'BluetoothError';
        this.code = code;
        this.originalError = originalError;
    }
    
    static fromError(error) {
        const errorMap = {
            'NetworkError': 'Error de red. Verifica que el dispositivo esté encendido y cerca.',
            'SecurityError': 'Error de seguridad. Asegúrate de estar en HTTPS.',
            'NotFoundError': 'Dispositivo no encontrado.',
            'InvalidStateError': 'El dispositivo no está en un estado válido.',
            'GATTError': 'Error de comunicación GATT.',
        };
        
        const userMessage = errorMap[error.name] || `Error de conexión: ${error.message}`;
        return new BluetoothError(userMessage, error.name, error);
    }
    
    getUserMessage() {
        return this.message;
    }
}

/**
 * Verificar soporte de Web Bluetooth
 * 
 * LIMITACIONES IMPORTANTES DE WEB BLUETOOTH:
 * 
 * 1. No se puede mantener la conexión entre sesiones:
 *    - Al cerrar/recargar la app, la conexión se pierde
 *    - No hay forma de mantener la conexión activa entre reinicios
 * 
 * 2. Requiere interacción del usuario:
 *    - La primera conexión SIEMPRE requiere que el usuario seleccione el dispositivo
 *    - requestDevice() siempre muestra el selector del sistema
 * 
 * 3. Reconexión automática limitada:
 *    - getDevices() (Chrome 85+) permite reconectar sin selector si el dispositivo
 *      ya fue permitido previamente
 *    - Solo funciona si el navegador tiene el dispositivo en su lista de permitidos
 *    - No funciona en todos los navegadores (solo Chrome/Edge modernos)
 * 
 * 4. PWA vs Web:
 *    - Las PWAs tienen las mismas limitaciones que las webs
 *    - No hay diferencia en el comportamiento de Bluetooth
 */
export function checkBluetoothSupport() {
    if (!navigator.bluetooth) {
        return {
            supported: false,
            reason: 'Tu navegador no soporta Web Bluetooth. Usa Chrome, Edge u Opera.',
        };
    }
    
    // Verificar si estamos en HTTPS o localhost
    if (location.protocol !== 'https:' && location.hostname !== 'localhost' && location.hostname !== '127.0.0.1') {
        return {
            supported: false,
            reason: 'Web Bluetooth requiere HTTPS. Accede desde una conexión segura.',
        };
    }
    
    return { supported: true };
}

/**
 * Gestor de conexión Bluetooth
 */
export class BluetoothManager {
    constructor(callbacks = {}) {
        this.device = null;
        this.server = null;
        this.service = null;
        this.characteristics = {};
        this.state = CONNECTION_STATE.DISCONNECTED;
        this.commandQueue = null;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5; // Aumentado para permitir más intentos
        this.reconnectDelay = 2000; // Delay inicial en ms
        this.reconnectBackoffMultiplier = 2; // Multiplicador para backoff exponencial
        this.maxReconnectDelay = 16000; // Delay máximo (16s)
        this.dataCallback = null;
        this.isManualDisconnect = false; // Flag para distinguir desconexión manual
        this.lastDataTimestamp = 0; // Para debounce de datos
        this.dataDebounceMs = 50; // Debounce de 50ms para datos
        this.lastIndoorBikeFlags = null; // Para detectar cambios de flags FTMS (p. ej. D100 0x40 -> 0x42)
        this.capabilities = null; // Capacidades del dispositivo
        
        // Logger
        this.logger = new Logger('BluetoothManager');
        
        // Bind handlers para poder removerlos correctamente
        this.handleIndoorBikeDataBound = (event) => this.handleIndoorBikeData(event);
        this.handleStatusChangeBound = (event) => this.handleStatusChange(event);
        this.handleControlPointResponseBound = (event) => this.handleControlPointResponse(event);
        
        // Callbacks
        this.onStateChange = callbacks.onStateChange || (() => {});
        this.onDeviceConnected = callbacks.onDeviceConnected || (() => {});
        this.onDeviceDisconnected = callbacks.onDeviceDisconnected || (() => {});
        this.onDataReceived = callbacks.onDataReceived || (() => {});
        this.onError = callbacks.onError || console.error;
        
        // Cargar dispositivo guardado
        this.loadCachedDevice();
    }
    
    /**
     * Cargar dispositivo guardado del cache
     */
    loadCachedDevice() {
        try {
            const cached = localStorage.getItem('bt_last_device');
            if (cached) {
                this.cachedDevice = JSON.parse(cached);
                this.logger.debug('Dispositivo cacheado encontrado:', this.cachedDevice);
            }
        } catch (e) {
            this.logger.warn('Error al cargar dispositivo cacheado:', e);
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
            localStorage.setItem('bt_last_device', JSON.stringify(deviceInfo));
            this.cachedDevice = deviceInfo;
            this.logger.debug('Dispositivo guardado en cache:', deviceInfo);
        } catch (e) {
            this.logger.warn('Error al guardar dispositivo en cache:', e);
        }
    }
    
    /**
     * Limpiar cache de dispositivo
     */
    clearCachedDevice() {
        try {
            localStorage.removeItem('bt_last_device');
            this.cachedDevice = null;
            this.logger.debug('Cache de dispositivo limpiado');
        } catch (e) {
            this.logger.warn('Error al limpiar cache:', e);
        }
    }
    
    /**
     * Intentar reconectar usando getDevices() (sin mostrar selector)
     * Solo funciona si el dispositivo ya fue permitido previamente
     */
    async reconnectSilently() {
        if (!this.cachedDevice) {
            return null;
        }
        
        // Verificar si getDevices() está disponible (Chrome 85+)
        if (!navigator.bluetooth.getDevices) {
            this.logger.debug('getDevices() no está disponible en este navegador');
            return null;
        }
        
        try {
            this.logger.info('Intentando reconexión silenciosa a:', this.cachedDevice.name);
            const devices = await navigator.bluetooth.getDevices();
            
            // Buscar el dispositivo cacheado en la lista de dispositivos permitidos
            const cachedDevice = devices.find(d => d.id === this.cachedDevice.id);
            
            if (cachedDevice) {
                this.logger.info('Dispositivo permitido encontrado, intentando conectar...');
                this.device = cachedDevice;
                this.isManualDisconnect = false;
                
                // Configurar listener de desconexión
                this.device.addEventListener('gattserverdisconnected', () => {
                    this.handleDisconnection();
                });
                
                // Intentar conectar
                await this.connect();
                return this.device;
            } else {
                this.logger.debug('Dispositivo no encontrado en la lista de permitidos');
                return null;
            }
        } catch (error) {
            this.logger.warn('Error en reconexión silenciosa:', error);
            return null;
        }
    }
    
    /**
     * Reconectar al último dispositivo conocido
     * Primero intenta reconexión silenciosa (sin selector), si falla muestra el selector
     */
    async reconnectToCachedDevice() {
        if (!this.cachedDevice) {
            throw new BluetoothError('No hay dispositivo guardado para reconectar', 'NO_CACHED_DEVICE');
        }
        
        this.logger.info('Iniciando reconexión a dispositivo guardado:', this.cachedDevice.name);
        this.isManualDisconnect = false; // Reset flag
        
        // Intentar primero reconexión silenciosa (sin mostrar selector)
        try {
            const device = await this.reconnectSilently();
            if (device) {
                this.logger.info('Reconexión silenciosa exitosa');
                return device;
            }
        } catch (error) {
            this.logger.debug('Reconexión silenciosa falló, usando selector:', error);
        }
        
        // Si la reconexión silenciosa falla, usar el método normal con selector
        // Nota: Web Bluetooth requiere interacción del usuario para la primera conexión
        // o si el dispositivo no está en la lista de permitidos
        try {
            return await this.scan();
        } catch (error) {
            // Si el usuario cancela o no encuentra el dispositivo, limpiar cache
            if (error.name === 'NotFoundError' || error.code === 'DEVICE_NOT_FOUND') {
                this.logger.warn('Dispositivo guardado no encontrado, limpiando cache');
                this.clearCachedDevice();
            }
            throw error;
        }
    }
    
    /**
     * Cambiar estado y notificar
     */
    setState(newState) {
        const oldState = this.state;
        this.state = newState;
        this.logger.debug(`Cambio de estado: ${oldState} → ${newState}`);
        this.onStateChange(newState);
    }
    
    /**
     * Escanear y seleccionar dispositivo FTMS
     */
    async scan() {
        const support = checkBluetoothSupport();
        if (!support.supported) {
            const error = new BluetoothError(support.reason, 'NOT_SUPPORTED');
            this.onError(error.getUserMessage());
            throw error;
        }
        
        this.setState(CONNECTION_STATE.SCANNING);
        this.isManualDisconnect = false; // Reset flag
        
        try {
            // Solicitar dispositivo con filtro FTMS
            this.device = await navigator.bluetooth.requestDevice({
                filters: [
                    { services: [FTMS_UUIDS.FITNESS_MACHINE_SERVICE] },
                ],
                optionalServices: [
                    FTMS_UUIDS.DEVICE_INFORMATION_SERVICE,
                    FTMS_UUIDS.BATTERY_SERVICE,
                ],
            });
            
            this.logger.info('Dispositivo seleccionado:', this.device.name);
            
            // Guardar en cache
            this.saveCachedDevice(this.device);
            
            // Configurar listener de desconexión
            this.device.addEventListener('gattserverdisconnected', () => {
                this.handleDisconnection();
            });
            
            // Conectar al dispositivo
            await this.connect();
            
            return this.device;
            
        } catch (error) {
            this.setState(CONNECTION_STATE.DISCONNECTED);
            
            if (error.name === 'NotFoundError') {
                this.logger.info('Búsqueda cancelada por el usuario');
                // No es un error real, solo el usuario canceló
                throw error;
            } else {
                const btError = BluetoothError.fromError(error);
                this.onError(btError.getUserMessage());
                throw btError;
            }
        }
    }
    
    /**
     * Conectar al dispositivo seleccionado
     */
    async connect() {
        if (!this.device) {
            throw new BluetoothError('No hay dispositivo seleccionado', 'NO_DEVICE');
        }
        
        this.setState(CONNECTION_STATE.CONNECTING);
        
        try {
            // Paso 1: Conectar a GATT server
            this.setState(CONNECTION_STATE.CONNECTING_GATT);
            this.logger.info('Conectando a GATT server...');
            this.server = await this.device.gatt.connect();
            
            // Paso 2: Obtener servicio FTMS
            this.setState(CONNECTION_STATE.DISCOVERING_SERVICES);
            this.logger.info('Obteniendo servicio FTMS...');
            this.service = await this.server.getPrimaryService(FTMS_UUIDS.FITNESS_MACHINE_SERVICE);
            
            // Paso 3: Descubrir características
            await this.discoverCharacteristics();
            
            // Validar características críticas
            if (!this.characteristics.indoorBikeData) {
                throw new BluetoothError('El dispositivo no soporta Indoor Bike Data. Característica requerida no encontrada.', 'MISSING_CHARACTERISTIC');
            }
            
            if (!this.characteristics.controlPoint) {
                throw new BluetoothError('El dispositivo no soporta Control Point. No se puede controlar el dispositivo.', 'MISSING_CHARACTERISTIC');
            }
            
            // Paso 4: Iniciar cola de comandos
            this.commandQueue = new CommandQueue(this.characteristics.controlPoint);
            
            // Paso 5: Suscribirse a notificaciones
            this.setState(CONNECTION_STATE.SUBSCRIBING);
            await this.subscribeToNotifications();
            
            // Paso 6: Solicitar control del dispositivo
            await this.commandQueue.requestControl();
            
            // Paso 7: Iniciar entrenamiento para activar el envío de datos
            try {
                await this.commandQueue.start();
                this.logger.info('Entrenamiento iniciado');
            } catch (error) {
                this.logger.warn('No se pudo iniciar el entrenamiento automáticamente:', error);
            }
            
            this.setState(CONNECTION_STATE.CONNECTED);
            this.reconnectAttempts = 0;
            this.reconnectDelay = 2000; // Reset delay
            this.onDeviceConnected(this.device.name);
            
            this.logger.info('Conectado exitosamente a', this.device.name);
            
        } catch (error) {
            this.setState(CONNECTION_STATE.DISCONNECTED);
            
            // Limpiar recursos en caso de error
            this.cleanup();
            
            const btError = error instanceof BluetoothError ? error : BluetoothError.fromError(error);
            this.onError(btError.getUserMessage());
            throw btError;
        }
    }
    
    /**
     * Descubrir características disponibles
     */
    async discoverCharacteristics() {
        const characteristicsList = [
            { name: 'indoorBikeData', uuid: FTMS_UUIDS.INDOOR_BIKE_DATA, required: true },
            { name: 'controlPoint', uuid: FTMS_UUIDS.FITNESS_MACHINE_CONTROL_POINT, required: true },
            { name: 'status', uuid: FTMS_UUIDS.FITNESS_MACHINE_STATUS, required: false },
            { name: 'feature', uuid: FTMS_UUIDS.FITNESS_MACHINE_FEATURE, required: false },
            { name: 'trainingStatus', uuid: FTMS_UUIDS.TRAINING_STATUS, required: false },
            { name: 'supportedResistance', uuid: FTMS_UUIDS.SUPPORTED_RESISTANCE_LEVEL_RANGE, required: false },
            { name: 'supportedPower', uuid: FTMS_UUIDS.SUPPORTED_POWER_RANGE, required: false },
        ];
        
        const found = [];
        const missing = [];
        
        for (const { name, uuid, required } of characteristicsList) {
            try {
                this.characteristics[name] = await this.service.getCharacteristic(uuid);
                found.push(name);
                this.logger.debug(`Característica ${name} encontrada`);
            } catch (e) {
                if (required) {
                    missing.push(name);
                    this.logger.warn(`Característica requerida ${name} no disponible`);
                } else {
                    this.logger.debug(`Característica opcional ${name} no disponible`);
                }
            }
        }
        
        if (missing.length > 0) {
            throw new BluetoothError(
                `Características requeridas no encontradas: ${missing.join(', ')}`,
                'MISSING_REQUIRED_CHARACTERISTICS'
            );
        }
        
        this.logger.info(`Características encontradas: ${found.join(', ')}`);
        
        // Leer características de capacidades
        if (this.characteristics.feature) {
            try {
                const featureValue = await this.characteristics.feature.readValue();
                this.capabilities = parseFitnessMachineFeature(featureValue);
                this.logger.info('Capacidades del dispositivo:', this.capabilities);
            } catch (e) {
                this.logger.warn('No se pudieron leer las capacidades:', e);
            }
        }
    }
    
    /**
     * Suscribirse a notificaciones de datos
     */
    async subscribeToNotifications() {
        // Indoor Bike Data - datos principales
        if (this.characteristics.indoorBikeData) {
            try {
                await this.characteristics.indoorBikeData.startNotifications();
                this.characteristics.indoorBikeData.addEventListener(
                    'characteristicvaluechanged',
                    this.handleIndoorBikeDataBound
                );
                this.logger.info('Suscrito a Indoor Bike Data');
            } catch (e) {
                this.logger.error('Error al suscribirse a Indoor Bike Data:', e);
                throw new BluetoothError('No se pudo suscribir a los datos del dispositivo', 'SUBSCRIPTION_ERROR', e);
            }
        }
        
        // Status del dispositivo
        if (this.characteristics.status) {
            try {
                await this.characteristics.status.startNotifications();
                this.characteristics.status.addEventListener(
                    'characteristicvaluechanged',
                    this.handleStatusChangeBound
                );
                this.logger.debug('Suscrito a Status');
            } catch (e) {
                this.logger.warn('No se pudo suscribir a Status:', e);
            }
        }
        
        // Control Point responses
        if (this.characteristics.controlPoint) {
            try {
                await this.characteristics.controlPoint.startNotifications();
                this.characteristics.controlPoint.addEventListener(
                    'characteristicvaluechanged',
                    this.handleControlPointResponseBound
                );
                this.logger.debug('Suscrito a Control Point');
            } catch (e) {
                this.logger.warn('No se pudo suscribir a Control Point:', e);
            }
        }
    }
    
    /**
     * Manejar datos del Indoor Bike Data con debounce
     */
    handleIndoorBikeData(event) {
        const now = Date.now();
        
        // Debounce: ignorar datos si llegaron muy rápido
        if (now - this.lastDataTimestamp < this.dataDebounceMs) {
            return;
        }
        this.lastDataTimestamp = now;
        
        const dataView = event.target.value;
        
        // Validar que el evento y los datos sean válidos
        if (!event || !event.target || !dataView) {
            this.logger.warn('Evento de datos inválido recibido');
            return;
        }
        
        // Validar tamaño mínimo de datos
        if (dataView.byteLength < 2) {
            this.logger.warn('Datos recibidos demasiado cortos:', dataView.byteLength, 'bytes');
            return;
        }
        
        const flags = dataView.getUint16(0, true);
        // Logger de cambios de flags (D100: 0x40 solo potencia, 0x42 potencia+cadencia al pedalear fuerte)
        if (this.lastIndoorBikeFlags !== null && this.lastIndoorBikeFlags !== flags) {
            this.logger.info(
                `FTMS flags cambiaron: 0x${this.lastIndoorBikeFlags.toString(16).padStart(4, '0')} → 0x${flags.toString(16).padStart(4, '0')}`
            );
        }
        this.lastIndoorBikeFlags = flags;
        
        // Logs de depuración detallados (solo en modo debug)
        if (LOG_LEVEL <= LOG_LEVELS.DEBUG) {
            const bytes = [];
            for (let i = 0; i < Math.min(dataView.byteLength, 20); i++) {
                bytes.push(dataView.getUint8(i).toString(16).padStart(2, '0'));
            }
            this.logger.debug(`Datos recibidos (${dataView.byteLength} bytes):`, bytes.join(' '), `| Flags: 0x${flags.toString(16)}`);
            if (dataView.byteLength >= 6) {
                debugRawBytes(dataView);
            }
        }
        
        try {
            const data = parseIndoorBikeData(dataView);
            
            // Validar datos parseados
            if (typeof data.power !== 'number' || isNaN(data.power)) {
                this.logger.warn('Datos de potencia inválidos:', data);
                return;
            }
            
            if (LOG_LEVEL <= LOG_LEVELS.DEBUG) {
                this.logger.debug('Datos parseados:', {
                    power: data.power,
                    cadence: data.cadence,
                    speed: data.speed,
                    resistance: data.resistance,
                    distance: data.distance,
                });
            }
            
            this.onDataReceived(data);
        } catch (error) {
            this.logger.error('Error al parsear datos:', error);
        }
    }
    
    /**
     * Manejar cambios de estado
     */
    handleStatusChange(event) {
        if (!event || !event.target || !event.target.value) {
            this.logger.warn('Evento de status inválido');
            return;
        }
        
        const dataView = event.target.value;
        if (dataView.byteLength < 1) {
            return;
        }
        
        const opCode = dataView.getUint8(0);
        this.logger.debug('Status change:', opCode);
    }
    
    /**
     * Manejar respuestas del Control Point
     */
    handleControlPointResponse(event) {
        if (!event || !event.target || !event.target.value) {
            this.logger.warn('Evento de Control Point inválido');
            return;
        }
        
        if (this.commandQueue) {
            this.commandQueue.handleResponse(event.target.value);
        }
    }
    
    /**
     * Manejar desconexión con backoff exponencial
     */
    async handleDisconnection() {
        this.logger.warn('Dispositivo desconectado');
        
        // No reconectar si fue desconexión manual
        if (this.isManualDisconnect) {
            this.logger.info('Desconexión manual, no se intentará reconectar');
            this.setState(CONNECTION_STATE.DISCONNECTED);
            this.onDeviceDisconnected();
            this.cleanup();
            return;
        }
        
        // Limpiar recursos antes de reconectar
        this.cleanup();
        
        if (this.reconnectAttempts < this.maxReconnectAttempts) {
            this.setState(CONNECTION_STATE.RECONNECTING);
            this.reconnectAttempts++;
            
            // Calcular delay con backoff exponencial
            const delay = Math.min(
                this.reconnectDelay * Math.pow(this.reconnectBackoffMultiplier, this.reconnectAttempts - 1),
                this.maxReconnectDelay
            );
            
            this.logger.info(`Intento de reconexión ${this.reconnectAttempts}/${this.maxReconnectAttempts} en ${delay}ms...`);
            
            // Esperar antes de reconectar
            await new Promise(resolve => setTimeout(resolve, delay));
            
            try {
                await this.connect();
            } catch (error) {
                this.logger.error('Error en reconexión:', error);
                // Intentar de nuevo si aún hay intentos disponibles
                if (this.reconnectAttempts < this.maxReconnectAttempts) {
                    this.handleDisconnection();
                } else {
                    this.setState(CONNECTION_STATE.DISCONNECTED);
                    this.onDeviceDisconnected();
                    const btError = error instanceof BluetoothError ? error : BluetoothError.fromError(error);
                    this.onError(`No se pudo reconectar después de ${this.maxReconnectAttempts} intentos: ${btError.getUserMessage()}`);
                }
            }
        } else {
            this.logger.error(`Máximo de intentos de reconexión alcanzado (${this.maxReconnectAttempts})`);
            this.setState(CONNECTION_STATE.DISCONNECTED);
            this.onDeviceDisconnected();
            this.onError('No se pudo reconectar al dispositivo después de varios intentos.');
        }
    }
    
    /**
     * Desconectar manualmente
     */
    disconnect() {
        this.logger.info('Desconexión manual iniciada');
        this.isManualDisconnect = true;
        this.reconnectAttempts = this.maxReconnectAttempts; // Evitar reconexión automática
        
        // Remover listeners antes de desconectar
        this.removeEventListeners();
        
        if (this.device && this.device.gatt && this.device.gatt.connected) {
            try {
                this.device.gatt.disconnect();
            } catch (e) {
                this.logger.warn('Error al desconectar GATT:', e);
            }
        }
        
        this.cleanup();
        this.setState(CONNECTION_STATE.DISCONNECTED);
        this.onDeviceDisconnected();
    }
    
    /**
     * Remover event listeners
     */
    removeEventListeners() {
        if (this.characteristics.indoorBikeData) {
            try {
                this.characteristics.indoorBikeData.removeEventListener('characteristicvaluechanged', this.handleIndoorBikeDataBound);
            } catch (e) {
                this.logger.debug('Error al remover listener de indoorBikeData:', e);
            }
        }
        
        if (this.characteristics.status) {
            try {
                this.characteristics.status.removeEventListener('characteristicvaluechanged', this.handleStatusChangeBound);
            } catch (e) {
                this.logger.debug('Error al remover listener de status:', e);
            }
        }
        
        if (this.characteristics.controlPoint) {
            try {
                this.characteristics.controlPoint.removeEventListener('characteristicvaluechanged', this.handleControlPointResponseBound);
            } catch (e) {
                this.logger.debug('Error al remover listener de controlPoint:', e);
            }
        }
    }
    
    /**
     * Limpiar referencias
     */
    cleanup() {
        this.lastIndoorBikeFlags = null;
        this.removeEventListeners();
        this.server = null;
        this.service = null;
        this.characteristics = {};
        this.commandQueue = null;
    }
    
    /**
     * Establecer resistencia (0-100%)
     */
    async setResistance(level) {
        if (!this.commandQueue) {
            throw new Error('No hay conexión activa');
        }
        return this.commandQueue.setTargetResistance(level);
    }
    
    /**
     * Establecer potencia objetivo (modo ERG)
     */
    async setTargetPower(watts) {
        if (!this.commandQueue) {
            throw new Error('No hay conexión activa');
        }
        return this.commandQueue.setTargetPower(watts);
    }
    
    /**
     * Iniciar entrenamiento
     */
    async startTraining() {
        if (!this.commandQueue) {
            throw new Error('No hay conexión activa');
        }
        return this.commandQueue.start();
    }
    
    /**
     * Pausar entrenamiento
     */
    async stopTraining() {
        if (!this.commandQueue) {
            throw new Error('No hay conexión activa');
        }
        return this.commandQueue.stop();
    }
    
    /**
     * Reiniciar métricas
     */
    async reset() {
        if (!this.commandQueue) {
            throw new Error('No hay conexión activa');
        }
        return this.commandQueue.reset();
    }
    
    /**
     * Establecer simulación indoor bike (pendiente, viento, etc.)
     */
    async setSimulationParameters(windSpeed, grade, crr, cw) {
        if (!this.commandQueue) {
            throw new Error('No hay conexión activa');
        }
        return this.commandQueue.setIndoorBikeSimulation(windSpeed, grade, crr, cw);
    }
}
