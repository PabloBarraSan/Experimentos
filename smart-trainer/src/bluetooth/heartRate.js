/**
 * Heart Rate Manager - Gestión de conexión BLE con pulsómetros
 * Smart Trainer Controller
 * 
 * Servicio: Heart Rate Service (0x180D)
 * Característica: Heart Rate Measurement (0x2A37)
 */

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
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 3;
        
        // Bind handler para poder removerlo
        this.handleHRDataBound = (event) => this.handleHRData(event);
        
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
            this.device = await navigator.bluetooth.requestDevice({
                filters: [
                    { services: [HR_UUIDS.HEART_RATE_SERVICE] },
                ],
                optionalServices: [],
            });
            
            console.log('[HR] Pulsómetro seleccionado:', this.device.name);
            
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
                this.device = cachedDevice;
                this.isManualDisconnect = false;
                
                this.device.addEventListener('gattserverdisconnected', () => {
                    this.handleDisconnection();
                });
                
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
     * Conectar al dispositivo seleccionado
     */
    async connect() {
        if (!this.device) {
            throw new Error('No hay pulsómetro seleccionado');
        }
        
        this.setState(HR_CONNECTION_STATE.CONNECTING);
        
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
            
            this.setState(HR_CONNECTION_STATE.CONNECTED);
            this.reconnectAttempts = 0;
            this.onDeviceConnected(this.device.name, this.sensorLocation);
            
            console.log('[HR] Conectado exitosamente a', this.device.name);
            
        } catch (error) {
            this.setState(HR_CONNECTION_STATE.DISCONNECTED);
            this.cleanup();
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
            this.onHeartRateReceived(data);
        } catch (error) {
            console.error('[HR] Error al parsear datos:', error);
        }
    }
    
    /**
     * Manejar desconexión
     */
    async handleDisconnection() {
        console.warn('[HR] Pulsómetro desconectado');
        
        if (this.isManualDisconnect) {
            this.setState(HR_CONNECTION_STATE.DISCONNECTED);
            this.onDeviceDisconnected();
            this.cleanup();
            return;
        }
        
        this.cleanup();
        
        if (this.reconnectAttempts < this.maxReconnectAttempts) {
            this.setState(HR_CONNECTION_STATE.RECONNECTING);
            this.reconnectAttempts++;
            
            const delay = 2000 * this.reconnectAttempts;
            console.log(`[HR] Intento de reconexión ${this.reconnectAttempts}/${this.maxReconnectAttempts} en ${delay}ms...`);
            
            await new Promise(resolve => setTimeout(resolve, delay));
            
            try {
                await this.connect();
            } catch (error) {
                if (this.reconnectAttempts < this.maxReconnectAttempts) {
                    this.handleDisconnection();
                } else {
                    this.setState(HR_CONNECTION_STATE.DISCONNECTED);
                    this.onDeviceDisconnected();
                    this.onError('No se pudo reconectar al pulsómetro después de varios intentos.');
                }
            }
        } else {
            this.setState(HR_CONNECTION_STATE.DISCONNECTED);
            this.onDeviceDisconnected();
            this.onError('No se pudo reconectar al pulsómetro.');
        }
    }
    
    /**
     * Desconectar manualmente
     */
    disconnect() {
        console.log('[HR] Desconexión manual iniciada');
        this.isManualDisconnect = true;
        this.reconnectAttempts = this.maxReconnectAttempts;
        
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
