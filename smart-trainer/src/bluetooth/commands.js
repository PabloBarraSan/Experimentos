/**
 * Bluetooth Commands - Control Point Commands
 * Smart Trainer Controller
 * 
 * Comandos FTMS Control Point (0x2AD9)
 */

// OpCodes del Control Point
export const CONTROL_POINT_OPCODES = {
    REQUEST_CONTROL: 0x00,
    RESET: 0x01,
    SET_TARGET_SPEED: 0x02,
    SET_TARGET_INCLINATION: 0x03,
    SET_TARGET_RESISTANCE: 0x04,
    SET_TARGET_POWER: 0x05,
    SET_TARGET_HEART_RATE: 0x06,
    START_OR_RESUME: 0x07,
    STOP_OR_PAUSE: 0x08,
    SET_TARGETED_EXPENDED_ENERGY: 0x09,
    SET_TARGETED_STEPS: 0x0A,
    SET_TARGETED_STRIDES: 0x0B,
    SET_TARGETED_DISTANCE: 0x0C,
    SET_TARGETED_TRAINING_TIME: 0x0D,
    SET_TARGETED_TIME_IN_TWO_HR_ZONES: 0x0E,
    SET_TARGETED_TIME_IN_THREE_HR_ZONES: 0x0F,
    SET_TARGETED_TIME_IN_FIVE_HR_ZONES: 0x10,
    SET_INDOOR_BIKE_SIMULATION: 0x11,
    SET_WHEEL_CIRCUMFERENCE: 0x12,
    SPIN_DOWN_CONTROL: 0x13,
    SET_TARGETED_CADENCE: 0x14,
    RESPONSE_CODE: 0x80,
};

// Códigos de resultado
export const RESULT_CODES = {
    SUCCESS: 0x01,
    OP_CODE_NOT_SUPPORTED: 0x02,
    INVALID_PARAMETER: 0x03,
    OPERATION_FAILED: 0x04,
    CONTROL_NOT_PERMITTED: 0x05,
};

/**
 * Cola de comandos para evitar colisiones
 */
export class CommandQueue {
    constructor(controlPointCharacteristic) {
        this.characteristic = controlPointCharacteristic;
        this.queue = [];
        this.isProcessing = false;
        this.pendingCommand = null;
        this.timeout = 5000; // 5 segundos timeout
        this.resolveCallback = null;
        this.rejectCallback = null;
    }
    
    /**
     * Encolar y ejecutar comando
     */
    async enqueue(command, data = []) {
        return new Promise((resolve, reject) => {
            this.queue.push({ command, data, resolve, reject });
            this.processQueue();
        });
    }
    
    /**
     * Procesar cola de comandos
     */
    async processQueue() {
        if (this.isProcessing || this.queue.length === 0) {
            return;
        }
        
        this.isProcessing = true;
        const { command, data, resolve, reject } = this.queue.shift();
        
        this.pendingCommand = command;
        this.resolveCallback = resolve;
        this.rejectCallback = reject;
        
        // Timeout para el comando
        const timeoutId = setTimeout(() => {
            this.rejectCallback?.(new Error(`Comando ${command} timeout`));
            this.cleanup();
        }, this.timeout);
        
        try {
            const buffer = new Uint8Array([command, ...data]);
            await this.characteristic.writeValue(buffer);
            
            // Esperar respuesta (se manejará en handleResponse)
            // El timeout se limpiará cuando llegue la respuesta
            
        } catch (error) {
            clearTimeout(timeoutId);
            reject(error);
            this.cleanup();
        }
    }
    
    /**
     * Manejar respuesta del Control Point
     */
    handleResponse(dataView) {
        const responseCode = dataView.getUint8(0);
        
        if (responseCode !== CONTROL_POINT_OPCODES.RESPONSE_CODE) {
            return;
        }
        
        const requestOpCode = dataView.getUint8(1);
        const resultCode = dataView.getUint8(2);
        
        // Verificar que la respuesta corresponde al comando pendiente
        if (requestOpCode !== this.pendingCommand) {
            console.warn(`Respuesta inesperada: esperado ${this.pendingCommand}, recibido ${requestOpCode}`);
            return;
        }
        
        const resultNames = {
            [RESULT_CODES.SUCCESS]: 'Success',
            [RESULT_CODES.OP_CODE_NOT_SUPPORTED]: 'OpCode Not Supported',
            [RESULT_CODES.INVALID_PARAMETER]: 'Invalid Parameter',
            [RESULT_CODES.OPERATION_FAILED]: 'Operation Failed',
            [RESULT_CODES.CONTROL_NOT_PERMITTED]: 'Control Not Permitted',
        };
        
        console.log(`📡 Respuesta comando ${requestOpCode}: ${resultNames[resultCode] || resultCode}`);
        
        if (resultCode === RESULT_CODES.SUCCESS) {
            this.resolveCallback?.({ success: true, opCode: requestOpCode });
        } else {
            this.rejectCallback?.(new Error(resultNames[resultCode] || `Error code: ${resultCode}`));
        }
        
        this.cleanup();
    }
    
    /**
     * Limpiar estado y procesar siguiente comando
     */
    cleanup() {
        this.isProcessing = false;
        this.pendingCommand = null;
        this.resolveCallback = null;
        this.rejectCallback = null;
        
        // Procesar siguiente comando en cola
        if (this.queue.length > 0) {
            setTimeout(() => this.processQueue(), 100);
        }
    }
    
    // === Comandos de alto nivel ===
    
    /**
     * Solicitar control del dispositivo
     */
    async requestControl() {
        console.log('🎮 Solicitando control del dispositivo...');
        return this.enqueue(CONTROL_POINT_OPCODES.REQUEST_CONTROL);
    }
    
    /**
     * Reiniciar métricas
     */
    async reset() {
        console.log('🔄 Reiniciando métricas...');
        return this.enqueue(CONTROL_POINT_OPCODES.RESET);
    }
    
    /**
     * Establecer resistencia objetivo (0-100%)
     * @param {number} level - Nivel de resistencia (0-100)
     */
    async setTargetResistance(level) {
        // El nivel se envía como sint16 con resolución 0.1
        const value = Math.round(Math.max(0, Math.min(100, level)) * 10);
        const data = [value & 0xFF, (value >> 8) & 0xFF];
        
        console.log(`⚡ Estableciendo resistencia: ${level}%`);
        return this.enqueue(CONTROL_POINT_OPCODES.SET_TARGET_RESISTANCE, data);
    }
    
    /**
     * Establecer potencia objetivo (modo ERG)
     * @param {number} watts - Potencia en watts
     */
    async setTargetPower(watts) {
        const value = Math.round(Math.max(0, Math.min(4000, watts)));
        const data = [value & 0xFF, (value >> 8) & 0xFF];
        
        console.log(`💪 Estableciendo potencia objetivo: ${watts}W`);
        return this.enqueue(CONTROL_POINT_OPCODES.SET_TARGET_POWER, data);
    }
    
    /**
     * Establecer frecuencia cardíaca objetivo
     * @param {number} bpm - Frecuencia cardíaca objetivo
     */
    async setTargetHeartRate(bpm) {
        const value = Math.round(Math.max(0, Math.min(255, bpm)));
        
        console.log(`❤️ Estableciendo FC objetivo: ${bpm} bpm`);
        return this.enqueue(CONTROL_POINT_OPCODES.SET_TARGET_HEART_RATE, [value]);
    }
    
    /**
     * Iniciar o reanudar entrenamiento
     */
    async start() {
        console.log('▶️ Iniciando entrenamiento...');
        return this.enqueue(CONTROL_POINT_OPCODES.START_OR_RESUME);
    }
    
    /**
     * Detener o pausar entrenamiento
     * @param {boolean} pause - true para pausar, false para detener
     */
    async stop(pause = true) {
        const data = [pause ? 0x02 : 0x01]; // 0x01 = stop, 0x02 = pause
        console.log(pause ? '⏸️ Pausando entrenamiento...' : '⏹️ Deteniendo entrenamiento...');
        return this.enqueue(CONTROL_POINT_OPCODES.STOP_OR_PAUSE, data);
    }
    
    /**
     * Establecer parámetros de simulación indoor bike
     * @param {number} windSpeed - Velocidad del viento (m/s, resolución 0.001)
     * @param {number} grade - Pendiente (%, resolución 0.01)
     * @param {number} crr - Coeficiente de resistencia a la rodadura (resolución 0.0001)
     * @param {number} cw - Coeficiente de resistencia al viento (kg/m, resolución 0.01)
     */
    async setIndoorBikeSimulation(windSpeed = 0, grade = 0, crr = 0.004, cw = 0.51) {
        // Wind Speed: sint16, 0.001 m/s
        const windValue = Math.round(windSpeed * 1000);
        
        // Grade: sint16, 0.01 %
        const gradeValue = Math.round(grade * 100);
        
        // Crr: uint8, 0.0001
        const crrValue = Math.round(crr * 10000);
        
        // Cw: uint8, 0.01 kg/m
        const cwValue = Math.round(cw * 100);
        
        const data = [
            windValue & 0xFF, (windValue >> 8) & 0xFF,
            gradeValue & 0xFF, (gradeValue >> 8) & 0xFF,
            crrValue,
            cwValue,
        ];
        
        console.log(`🚴 Simulación: viento=${windSpeed}m/s, pendiente=${grade}%, crr=${crr}, cw=${cw}`);
        return this.enqueue(CONTROL_POINT_OPCODES.SET_INDOOR_BIKE_SIMULATION, data);
    }
    
    /**
     * Establecer inclinación objetivo
     * @param {number} incline - Inclinación en % (resolución 0.1)
     */
    async setTargetInclination(incline) {
        const value = Math.round(incline * 10);
        const data = [value & 0xFF, (value >> 8) & 0xFF];
        
        console.log(`📐 Estableciendo inclinación: ${incline}%`);
        return this.enqueue(CONTROL_POINT_OPCODES.SET_TARGET_INCLINATION, data);
    }
    
    /**
     * Establecer cadencia objetivo
     * @param {number} cadence - Cadencia en rpm (resolución 0.5)
     */
    async setTargetCadence(cadence) {
        const value = Math.round(cadence * 2);
        const data = [value & 0xFF, (value >> 8) & 0xFF];
        
        console.log(`🔄 Estableciendo cadencia objetivo: ${cadence} rpm`);
        return this.enqueue(CONTROL_POINT_OPCODES.SET_TARGETED_CADENCE, data);
    }
    
    /**
     * Control de spin down (calibración)
     * @param {number} spinDownControl - 0x01 = start, 0x02 = ignore
     */
    async spinDownControl(start = true) {
        const data = [start ? 0x01 : 0x02];
        console.log(start ? '🎯 Iniciando spin down...' : '❌ Ignorando spin down');
        return this.enqueue(CONTROL_POINT_OPCODES.SPIN_DOWN_CONTROL, data);
    }
}
