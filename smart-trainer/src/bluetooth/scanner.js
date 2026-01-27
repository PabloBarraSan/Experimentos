/**
 * Bluetooth Scanner - Gestión de conexión BLE
 * Smart Trainer Controller
 */

import { FTMS_UUIDS, parseIndoorBikeData, parseFitnessMachineFeature } from './ftms.js';
import { CommandQueue } from './commands.js';

// Estados de conexión
export const CONNECTION_STATE = {
    DISCONNECTED: 'disconnected',
    SCANNING: 'scanning',
    CONNECTING: 'connecting',
    CONNECTED: 'connected',
    RECONNECTING: 'reconnecting',
};

/**
 * Verificar soporte de Web Bluetooth
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
        this.maxReconnectAttempts = 3;
        this.dataCallback = null;
        
        // Callbacks
        this.onStateChange = callbacks.onStateChange || (() => {});
        this.onDeviceConnected = callbacks.onDeviceConnected || (() => {});
        this.onDeviceDisconnected = callbacks.onDeviceDisconnected || (() => {});
        this.onDataReceived = callbacks.onDataReceived || (() => {});
        this.onError = callbacks.onError || console.error;
    }
    
    /**
     * Cambiar estado y notificar
     */
    setState(newState) {
        this.state = newState;
        this.onStateChange(newState);
    }
    
    /**
     * Escanear y seleccionar dispositivo FTMS
     */
    async scan() {
        const support = checkBluetoothSupport();
        if (!support.supported) {
            this.onError(support.reason);
            throw new Error(support.reason);
        }
        
        this.setState(CONNECTION_STATE.SCANNING);
        
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
            
            console.log('📱 Dispositivo seleccionado:', this.device.name);
            
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
                console.log('Búsqueda cancelada por el usuario');
            } else {
                this.onError(`Error al buscar dispositivos: ${error.message}`);
            }
            
            throw error;
        }
    }
    
    /**
     * Conectar al dispositivo seleccionado
     */
    async connect() {
        if (!this.device) {
            throw new Error('No hay dispositivo seleccionado');
        }
        
        this.setState(CONNECTION_STATE.CONNECTING);
        
        try {
            console.log('🔌 Conectando a GATT server...');
            this.server = await this.device.gatt.connect();
            
            console.log('📡 Obteniendo servicio FTMS...');
            this.service = await this.server.getPrimaryService(FTMS_UUIDS.FITNESS_MACHINE_SERVICE);
            
            // Obtener características disponibles
            await this.discoverCharacteristics();
            
            // Iniciar cola de comandos
            this.commandQueue = new CommandQueue(this.characteristics.controlPoint);
            
            // Suscribirse a notificaciones de datos
            await this.subscribeToNotifications();
            
            // Solicitar control del dispositivo
            await this.commandQueue.requestControl();
            
            this.setState(CONNECTION_STATE.CONNECTED);
            this.reconnectAttempts = 0;
            this.onDeviceConnected(this.device.name);
            
            console.log('✅ Conectado exitosamente a', this.device.name);
            
        } catch (error) {
            this.setState(CONNECTION_STATE.DISCONNECTED);
            this.onError(`Error de conexión: ${error.message}`);
            throw error;
        }
    }
    
    /**
     * Descubrir características disponibles
     */
    async discoverCharacteristics() {
        const characteristicsList = [
            { name: 'indoorBikeData', uuid: FTMS_UUIDS.INDOOR_BIKE_DATA },
            { name: 'controlPoint', uuid: FTMS_UUIDS.FITNESS_MACHINE_CONTROL_POINT },
            { name: 'status', uuid: FTMS_UUIDS.FITNESS_MACHINE_STATUS },
            { name: 'feature', uuid: FTMS_UUIDS.FITNESS_MACHINE_FEATURE },
            { name: 'trainingStatus', uuid: FTMS_UUIDS.TRAINING_STATUS },
            { name: 'supportedResistance', uuid: FTMS_UUIDS.SUPPORTED_RESISTANCE_LEVEL_RANGE },
            { name: 'supportedPower', uuid: FTMS_UUIDS.SUPPORTED_POWER_RANGE },
        ];
        
        for (const { name, uuid } of characteristicsList) {
            try {
                this.characteristics[name] = await this.service.getCharacteristic(uuid);
                console.log(`  ✓ Característica ${name} encontrada`);
            } catch (e) {
                console.log(`  ✗ Característica ${name} no disponible`);
            }
        }
        
        // Leer características de capacidades
        if (this.characteristics.feature) {
            try {
                const featureValue = await this.characteristics.feature.readValue();
                const features = parseFitnessMachineFeature(featureValue);
                console.log('📋 Capacidades del dispositivo:', features);
            } catch (e) {
                console.warn('No se pudieron leer las capacidades:', e);
            }
        }
    }
    
    /**
     * Suscribirse a notificaciones de datos
     */
    async subscribeToNotifications() {
        // Indoor Bike Data - datos principales
        if (this.characteristics.indoorBikeData) {
            await this.characteristics.indoorBikeData.startNotifications();
            this.characteristics.indoorBikeData.addEventListener(
                'characteristicvaluechanged',
                (event) => this.handleIndoorBikeData(event)
            );
            console.log('📊 Suscrito a Indoor Bike Data');
        }
        
        // Status del dispositivo
        if (this.characteristics.status) {
            try {
                await this.characteristics.status.startNotifications();
                this.characteristics.status.addEventListener(
                    'characteristicvaluechanged',
                    (event) => this.handleStatusChange(event)
                );
                console.log('📊 Suscrito a Status');
            } catch (e) {
                console.warn('No se pudo suscribir a Status:', e);
            }
        }
        
        // Control Point responses
        if (this.characteristics.controlPoint) {
            try {
                await this.characteristics.controlPoint.startNotifications();
                this.characteristics.controlPoint.addEventListener(
                    'characteristicvaluechanged',
                    (event) => this.handleControlPointResponse(event)
                );
                console.log('📊 Suscrito a Control Point');
            } catch (e) {
                console.warn('No se pudo suscribir a Control Point:', e);
            }
        }
    }
    
    /**
     * Manejar datos del Indoor Bike Data
     */
    handleIndoorBikeData(event) {
        const data = parseIndoorBikeData(event.target.value);
        this.onDataReceived(data);
    }
    
    /**
     * Manejar cambios de estado
     */
    handleStatusChange(event) {
        const dataView = event.target.value;
        const opCode = dataView.getUint8(0);
        console.log('📡 Status change:', opCode);
    }
    
    /**
     * Manejar respuestas del Control Point
     */
    handleControlPointResponse(event) {
        if (this.commandQueue) {
            this.commandQueue.handleResponse(event.target.value);
        }
    }
    
    /**
     * Manejar desconexión
     */
    async handleDisconnection() {
        console.log('⚠️ Dispositivo desconectado');
        
        if (this.reconnectAttempts < this.maxReconnectAttempts) {
            this.setState(CONNECTION_STATE.RECONNECTING);
            this.reconnectAttempts++;
            
            console.log(`🔄 Intento de reconexión ${this.reconnectAttempts}/${this.maxReconnectAttempts}...`);
            
            // Esperar antes de reconectar
            await new Promise(resolve => setTimeout(resolve, 2000));
            
            try {
                await this.connect();
            } catch (error) {
                console.error('Error en reconexión:', error);
                this.handleDisconnection();
            }
        } else {
            this.setState(CONNECTION_STATE.DISCONNECTED);
            this.onDeviceDisconnected();
            this.cleanup();
        }
    }
    
    /**
     * Desconectar manualmente
     */
    disconnect() {
        this.reconnectAttempts = this.maxReconnectAttempts; // Evitar reconexión automática
        
        if (this.device && this.device.gatt.connected) {
            this.device.gatt.disconnect();
        }
        
        this.cleanup();
        this.setState(CONNECTION_STATE.DISCONNECTED);
        this.onDeviceDisconnected();
    }
    
    /**
     * Limpiar referencias
     */
    cleanup() {
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
