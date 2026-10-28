/**
 * Workout Model - Estructura de datos para entrenamientos
 * Smart Trainer Controller
 */

/**
 * Tipos de bloques de entrenamiento
 */
export const BLOCK_TYPES = {
    WARMUP: 'warmup',
    COOLDOWN: 'cooldown',
    INTERVAL: 'interval',
    STEADY: 'steady',
    RAMP: 'ramp',
    REST: 'rest',
    FREE: 'free',
};

/**
 * Tipos de target
 */
export const TARGET_TYPES = {
    POWER_ABSOLUTE: 'power_absolute',   // Watts fijos
    POWER_FTP: 'power_ftp',             // % de FTP
    RESISTANCE: 'resistance',           // % de resistencia
    HEART_RATE: 'heart_rate',           // BPM
    CADENCE: 'cadence',                 // RPM
    FREE: 'free',                       // Sin target
};

/**
 * Crear un bloque de entrenamiento
 * @param {Object} options - Opciones del bloque
 * @returns {Object} Bloque de entrenamiento
 */
export function createBlock(options) {
    const {
        type = BLOCK_TYPES.STEADY,
        duration = 60,                   // Duración en segundos
        name = '',
        targetType = TARGET_TYPES.POWER_FTP,
        targetValue = 50,                // Valor según targetType
        targetValueEnd = null,           // Para rampas, valor final
        cadenceTarget = null,            // Cadencia objetivo (opcional)
        cadenceMin = null,
        cadenceMax = null,
        repeat = 1,                      // Número de repeticiones
        restBetween = 0,                 // Descanso entre repeticiones (segundos)
        restTargetValue = 40,            // Target durante descanso (% FTP)
        color = null,                    // Color personalizado
        instructions = '',               // Instrucciones para el usuario
    } = options;
    
    return {
        id: generateId(),
        type,
        duration,
        name: name || getDefaultBlockName(type),
        targetType,
        targetValue,
        targetValueEnd,
        cadenceTarget,
        cadenceMin,
        cadenceMax,
        repeat,
        restBetween,
        restTargetValue,
        color: color || getBlockColor(type, targetValue),
        instructions,
    };
}

/**
 * Crear un entrenamiento completo
 * @param {Object} options - Opciones del entrenamiento
 * @returns {Object} Entrenamiento
 */
export function createWorkout(options) {
    const {
        name = 'Nuevo Entrenamiento',
        description = '',
        author = '',
        blocks = [],
        tags = [],
        difficulty = 'medium',           // easy, medium, hard, extreme
        sportType = 'cycling',
        category = 'custom',             // ftp_test, intervals, endurance, recovery, custom
    } = options;
    
    const workout = {
        id: generateId(),
        name,
        description,
        author,
        blocks,
        tags,
        difficulty,
        sportType,
        category,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
    };
    
    // Calcular estadísticas
    workout.stats = calculateWorkoutStats(workout);
    
    return workout;
}

/**
 * Calcular estadísticas del entrenamiento
 */
export function calculateWorkoutStats(workout, ftp = 200) {
    let totalDuration = 0;
    let totalWork = 0;      // kJ
    let weightedPowerSum = 0;
    let durationSum = 0;
    
    const expandedBlocks = expandBlocks(workout.blocks);
    
    expandedBlocks.forEach(block => {
        const blockDuration = block.duration;
        totalDuration += blockDuration;
        
        // Calcular potencia media del bloque
        let avgPower;
        if (block.targetType === TARGET_TYPES.POWER_FTP) {
            avgPower = (block.targetValue / 100) * ftp;
            if (block.targetValueEnd !== null) {
                // Para rampas, usar promedio
                avgPower = ((block.targetValue + block.targetValueEnd) / 2 / 100) * ftp;
            }
        } else if (block.targetType === TARGET_TYPES.POWER_ABSOLUTE) {
            avgPower = block.targetValue;
            if (block.targetValueEnd !== null) {
                avgPower = (block.targetValue + block.targetValueEnd) / 2;
            }
        } else {
            avgPower = 0.5 * ftp; // Estimación para otros tipos
        }
        
        // Trabajo en kJ
        totalWork += (avgPower * blockDuration) / 1000;
        
        // Para calcular IF y TSS
        weightedPowerSum += Math.pow(avgPower, 4) * blockDuration;
        durationSum += blockDuration;
    });
    
    // Potencia normalizada aproximada
    const normalizedPower = durationSum > 0 
        ? Math.pow(weightedPowerSum / durationSum, 0.25)
        : 0;
    
    // Intensity Factor
    const intensityFactor = normalizedPower / ftp;
    
    // Training Stress Score
    const tss = (totalDuration * normalizedPower * intensityFactor) / (ftp * 3600) * 100;
    
    return {
        totalDuration,                          // Segundos
        totalDurationFormatted: formatDuration(totalDuration),
        totalWork: Math.round(totalWork),       // kJ
        estimatedCalories: Math.round(totalWork * 1.05), // Aproximación
        normalizedPower: Math.round(normalizedPower),
        intensityFactor: parseFloat(intensityFactor.toFixed(2)),
        tss: Math.round(tss),
        blockCount: expandedBlocks.length,
    };
}

/**
 * Expandir bloques con repeticiones
 */
export function expandBlocks(blocks) {
    const expanded = [];
    
    blocks.forEach(block => {
        for (let i = 0; i < block.repeat; i++) {
            expanded.push({ ...block, repeatIndex: i });
            
            // Añadir descanso entre repeticiones
            if (block.restBetween > 0 && i < block.repeat - 1) {
                expanded.push(createBlock({
                    type: BLOCK_TYPES.REST,
                    duration: block.restBetween,
                    name: 'Descanso',
                    targetType: block.targetType,
                    targetValue: block.restTargetValue,
                }));
            }
        }
    });
    
    return expanded;
}

/**
 * Obtener el target en watts para un momento específico
 * @param {Object} block - Bloque actual
 * @param {number} elapsed - Tiempo transcurrido en el bloque (segundos)
 * @param {number} ftp - FTP del usuario
 * @returns {Object} Target con potencia, cadencia, etc.
 */
export function getTargetAtTime(block, elapsed, ftp) {
    let powerTarget = 0;
    
    switch (block.targetType) {
        case TARGET_TYPES.POWER_FTP:
            if (block.targetValueEnd !== null && block.type === BLOCK_TYPES.RAMP) {
                // Interpolación lineal para rampas
                const progress = Math.min(1, elapsed / block.duration);
                const ftpPercent = block.targetValue + (block.targetValueEnd - block.targetValue) * progress;
                powerTarget = (ftpPercent / 100) * ftp;
            } else {
                powerTarget = (block.targetValue / 100) * ftp;
            }
            break;
            
        case TARGET_TYPES.POWER_ABSOLUTE:
            if (block.targetValueEnd !== null && block.type === BLOCK_TYPES.RAMP) {
                const progress = Math.min(1, elapsed / block.duration);
                powerTarget = block.targetValue + (block.targetValueEnd - block.targetValue) * progress;
            } else {
                powerTarget = block.targetValue;
            }
            break;
            
        case TARGET_TYPES.RESISTANCE:
            powerTarget = null; // Se usa resistance directamente
            break;
            
        default:
            powerTarget = null;
    }
    
    return {
        power: powerTarget !== null ? Math.round(powerTarget) : null,
        resistance: block.targetType === TARGET_TYPES.RESISTANCE ? block.targetValue : null,
        cadence: block.cadenceTarget,
        cadenceMin: block.cadenceMin,
        cadenceMax: block.cadenceMax,
        blockName: block.name,
        blockType: block.type,
        instructions: block.instructions,
    };
}

/**
 * Validar estructura de entrenamiento
 */
export function validateWorkout(workout) {
    const errors = [];
    
    if (!workout.name || workout.name.trim() === '') {
        errors.push('El entrenamiento debe tener un nombre');
    }
    
    if (!workout.blocks || workout.blocks.length === 0) {
        errors.push('El entrenamiento debe tener al menos un bloque');
    }
    
    workout.blocks?.forEach((block, index) => {
        if (block.duration <= 0) {
            errors.push(`Bloque ${index + 1}: la duración debe ser mayor a 0`);
        }
        
        if (block.targetType === TARGET_TYPES.POWER_FTP && (block.targetValue < 0 || block.targetValue > 300)) {
            errors.push(`Bloque ${index + 1}: el % FTP debe estar entre 0 y 300`);
        }
        
        if (block.repeat < 1) {
            errors.push(`Bloque ${index + 1}: las repeticiones deben ser al menos 1`);
        }
    });
    
    return {
        valid: errors.length === 0,
        errors,
    };
}

// === Utilidades ===

function generateId() {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

function getDefaultBlockName(type) {
    const names = {
        [BLOCK_TYPES.WARMUP]: 'Calentamiento',
        [BLOCK_TYPES.COOLDOWN]: 'Enfriamiento',
        [BLOCK_TYPES.INTERVAL]: 'Intervalo',
        [BLOCK_TYPES.STEADY]: 'Steady State',
        [BLOCK_TYPES.RAMP]: 'Rampa',
        [BLOCK_TYPES.REST]: 'Descanso',
        [BLOCK_TYPES.FREE]: 'Libre',
    };
    return names[type] || 'Bloque';
}

function getBlockColor(type, targetValue) {
    // Colores basados en tipo y % FTP
    if (type === BLOCK_TYPES.REST || type === BLOCK_TYPES.FREE) {
        return '#808080';
    }
    
    if (targetValue < 55) return '#808080';
    if (targetValue < 76) return '#0066ff';
    if (targetValue < 91) return '#00cc00';
    if (targetValue < 106) return '#ffcc00';
    if (targetValue < 121) return '#ff6600';
    if (targetValue < 151) return '#ff0000';
    return '#cc00cc';
}

function formatDuration(seconds) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hours > 0) {
        return `${hours}h ${minutes}m`;
    }
    if (minutes > 0) {
        return `${minutes}m ${secs}s`;
    }
    return `${secs}s`;
}
