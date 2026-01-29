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
        this.timeoutId = null;
        
        // Timeouts configurables por tipo de comando
        this.timeouts = {
            default: 5000,      // 5 segundos por defecto
            critical: 10000,    // 10 segundos para comandos críticos
            fast: 3000,         // 3 segundos para comandos rápidos
        };
        
        this.baseTimeout = this.timeouts.default;
        this.adaptiveTimeout = this.baseTimeout; // Timeout adaptativo
        this.consecutiveFailures = 0; // Contador de fallos consecutivos
        
        this.resolveCallback = null;
        this.rejectCallback = null;
        
        // Métricas
        this.metrics = {
            total: 0,
            success: 0,
            failed: 0,
            timeouts: 0,
        };
    }
    
    /**
     * Obtener timeout para un comando específico
     */
    getTimeoutForCommand(command) {
        // Comandos críticos que requieren más tiempo
        const criticalCommands = [
            CONTROL_POINT_OPCODES.REQUEST_CONTROL,
            CONTROL_POINT_OPCODES.SET_INDOOR_BIKE_SIMULATION,
        ];
        
        // Comandos rápidos que deberían responder rápido
        const fastCommands = [
            CONTROL_POINT_OPCODES.START_OR_RESUME,
            CONTROL_POINT_OPCODES.STOP_OR_PAUSE,
        ];
        
        if (criticalCommands.includes(command)) {
            return this.timeouts.critical;
        } else if (fastCommands.includes(command)) {
            return this.timeouts.fast;
        }
        
        // Usar timeout adaptativo si hay fallos consecutivos
        return this.adaptiveTimeout;
    }
    
    /**
     * Ajustar timeout adaptativo basado en fallos
     */
    adjustTimeout(success) {
        if (success) {
            this.consecutiveFailures = 0;
            this.adaptiveTimeout = this.baseTimeout;
        } else {
            this.consecutiveFailures++;
            // Aumentar timeout si hay fallos (hasta 2x el base)
            this.adaptiveTimeout = Math.min(
                this.baseTimeout * (1 + this.consecutiveFailures * 0.2),
                this.baseTimeout * 2
            );
        }
    }
    
    /**
     * Encolar y ejecutar comando
     * @param {number} command - OpCode del comando
     * @param {Array} data - Datos del comando
     * @param {Object} options - Opciones: priority (number), timeout (number)
     */
    async enqueue(command, data = [], options = {}) {
        return new Promise((resolve, reject) => {
            const priority = options.priority || 0; // Mayor número = mayor prioridad
            const item = { command, data, resolve, reject, priority, options };
            
            // Insertar según prioridad
            if (priority > 0) {
                // Insertar al inicio si tiene prioridad
                let insertIndex = 0;
                for (let i = 0; i < this.queue.length; i++) {
                    if (this.queue[i].priority < priority) {
                        insertIndex = i;
                        break;
                    }
                    insertIndex = i + 1;
                }
                this.queue.splice(insertIndex, 0, item);
            } else {
                this.queue.push(item);
            }
            
            this.processQueue();
        });
    }
    
    /**
     * Cancelar comando pendiente
     */
    cancelCommand(command) {
        const index = this.queue.findIndex(item => item.command === command);
        if (index !== -1) {
            const item = this.queue.splice(index, 1)[0];
            item.reject(new Error('Comando cancelado'));
            return true;
        }
        return false;
    }
    
    /**
     * Cancelar todos los comandos pendientes
     */
    cancelAll() {
        this.queue.forEach(item => {
            item.reject(new Error('Todos los comandos fueron cancelados'));
        });
        this.queue = [];
    }
    
    /**
     * Procesar cola de comandos
     */
    async processQueue() {
        if (this.isProcessing || this.queue.length === 0) {
            return;
        }
        
        this.isProcessing = true;
        const item = this.queue.shift();
        const { command, data, resolve, reject, options } = item;
        
        this.pendingCommand = command;
        this.resolveCallback = resolve;
        this.rejectCallback = reject;
        
        // Obtener timeout para este comando
        const timeout = options?.timeout || this.getTimeoutForCommand(command);
        
        // Timeout para el comando
        this.timeoutId = setTimeout(() => {
            this.metrics.timeouts++;
            this.metrics.failed++;
            this.adjustTimeout(false);
            this.rejectCallback?.(new Error(`Comando ${command} timeout después de ${timeout}ms`));
            this.cleanup();
        }, timeout);
        
        this.metrics.total++;
        
        try {
            const buffer = new Uint8Array([command, ...data]);
            await this.characteristic.writeValue(buffer);
            
            // Esperar respuesta (se manejará en handleResponse)
            // El timeout se limpiará cuando llegue la respuesta
            
        } catch (error) {
            if (this.timeoutId) {
                clearTimeout(this.timeoutId);
                this.timeoutId = null;
            }
            this.metrics.failed++;
            this.adjustTimeout(false);
            reject(error);
            this.cleanup();
        }
    }
    
    /**
     * Manejar respuesta del Control Point
     */
    handleResponse(dataView) {
        if (!dataView || dataView.byteLength < 3) {
            console.warn('Respuesta inválida recibida');
            return;
        }
        
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
        
        // Limpiar timeout
        if (this.timeoutId) {
            clearTimeout(this.timeoutId);
            this.timeoutId = null;
        }
        
        const resultNames = {
            [RESULT_CODES.SUCCESS]: 'Success',
            [RESULT_CODES.OP_CODE_NOT_SUPPORTED]: 'OpCode Not Supported',
            [RESULT_CODES.INVALID_PARAMETER]: 'Invalid Parameter',
            [RESULT_CODES.OPERATION_FAILED]: 'Operation Failed',
            [RESULT_CODES.CONTROL_NOT_PERMITTED]: 'Control Not Permitted',
        };
        
        const isSuccess = resultCode === RESULT_CODES.SUCCESS;
        
        if (isSuccess) {
            this.metrics.success++;
            this.adjustTimeout(true);
        } else {
            this.metrics.failed++;
            this.adjustTimeout(false);
        }
        
        // Solo log en modo debug
        if (typeof window !== 'undefined' && (location.hostname === 'localhost' || location.hostname === '127.0.0.1')) {
            console.log(`📡 Respuesta comando ${requestOpCode}: ${resultNames[resultCode] || resultCode}`);
        }
        
        if (isSuccess) {
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
        if (this.timeoutId) {
            clearTimeout(this.timeoutId);
            this.timeoutId = null;
        }
        
        this.isProcessing = false;
        this.pendingCommand = null;
        this.resolveCallback = null;
        this.rejectCallback = null;
        
        // Procesar siguiente comando en cola
        if (this.queue.length > 0) {
            setTimeout(() => this.processQueue(), 100);
        }
    }
    
    /**
     * Obtener métricas de la cola
     */
    getMetrics() {
        return {
            ...this.metrics,
            queueLength: this.queue.length,
            successRate: this.metrics.total > 0 
                ? (this.metrics.success / this.metrics.total * 100).toFixed(1) + '%'
                : '0%',
            consecutiveFailures: this.consecutiveFailures,
            adaptiveTimeout: this.adaptiveTimeout,
        };
    }
    
    /**
     * Resetear métricas
     */
    resetMetrics() {
        this.metrics = {
            total: 0,
            success: 0,
            failed: 0,
            timeouts: 0,
        };
        this.consecutiveFailures = 0;
        this.adaptiveTimeout = this.baseTimeout;
    }
    
    // === Comandos de alto nivel ===
    
    /**
     * Solicitar control del dispositivo
     */
    async requestControl() {
        console.log('🎮 Solicitando control del dispositivo...');
        return this.enqueue(CONTROL_POINT_OPCODES.REQUEST_CONTROL, [], { 
            priority: 10, // Alta prioridad
            timeout: this.timeouts.critical 
        });
    }
    
    /**
     * Reiniciar métricas
     */
    async reset() {
        console.log('🔄 Reiniciando métricas...');
        return this.enqueue(CONTROL_POINT_OPCODES.RESET);
    }
    
    /**
     * Establecer resistencia objetivo
     * @param {number} level - Nivel de resistencia (en las unidades del dispositivo)
     * @param {Object} resistanceRange - Rango soportado por el dispositivo (opcional)
     */
    async setTargetResistance(level, resistanceRange = null) {
        // Si tenemos el rango, clampar al rango real del dispositivo
        let clampedLevel = level;
        if (resistanceRange) {
            clampedLevel = Math.max(resistanceRange.minimum, Math.min(resistanceRange.maximum, level));
        } else {
            // Sin rango conocido, asumir 0-100
            clampedLevel = Math.max(0, Math.min(100, level));
        }
        
        // El nivel se envía como sint16 con resolución 0.1
        // Según FTMS spec: valor = nivel * 10 (para resolución 0.1)
        const value = Math.round(clampedLevel * 10);
        const data = [value & 0xFF, (value >> 8) & 0xFF];
        
        const rangeInfo = resistanceRange 
            ? `(rango dispositivo: ${resistanceRange.minimum}-${resistanceRange.maximum})` 
            : '(rango desconocido, asumiendo 0-100)';
        
        console.log(`⚡ Estableciendo resistencia: ${clampedLevel.toFixed(1)} ${rangeInfo}`);
        console.log(`   Valor FTMS: ${value}, bytes: [0x${data[0].toString(16).padStart(2, '0')}, 0x${data[1].toString(16).padStart(2, '0')}]`);
        
        try {
            const result = await this.enqueue(CONTROL_POINT_OPCODES.SET_TARGET_RESISTANCE, data);
            console.log(`✅ Resistencia ${clampedLevel.toFixed(1)} aplicada correctamente`);
            return result;
        } catch (error) {
            console.warn(`⚠️ Error al aplicar resistencia: ${error.message}`);
            throw error;
        }
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
