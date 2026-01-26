/**
 * FTMS Protocol Parser - Fitness Machine Service
 * Smart Trainer Controller
 * 
 * Especificación: https://www.bluetooth.com/specifications/specs/fitness-machine-service-1-0/
 */

// UUIDs del protocolo FTMS
export const FTMS_UUIDS = {
    // Servicios
    FITNESS_MACHINE_SERVICE: 0x1826,
    DEVICE_INFORMATION_SERVICE: 0x180A,
    BATTERY_SERVICE: 0x180F,
    HEART_RATE_SERVICE: 0x180D,
    
    // Características del Fitness Machine Service
    FITNESS_MACHINE_FEATURE: 0x2ACC,
    INDOOR_BIKE_DATA: 0x2AD2,
    TRAINING_STATUS: 0x2AD3,
    SUPPORTED_RESISTANCE_LEVEL_RANGE: 0x2AD6,
    SUPPORTED_POWER_RANGE: 0x2AD8,
    FITNESS_MACHINE_CONTROL_POINT: 0x2AD9,
    FITNESS_MACHINE_STATUS: 0x2ADA,
    
    // Heart Rate
    HEART_RATE_MEASUREMENT: 0x2A37,
};

// Flags del Indoor Bike Data (según especificación FTMS)
const INDOOR_BIKE_DATA_FLAGS = {
    MORE_DATA: 0x0001,                    // Bit 0: More Data
    AVERAGE_SPEED: 0x0002,                // Bit 1: Average Speed present
    INSTANTANEOUS_CADENCE: 0x0004,        // Bit 2: Instantaneous Cadence present
    AVERAGE_CADENCE: 0x0008,              // Bit 3: Average Cadence present
    TOTAL_DISTANCE: 0x0010,               // Bit 4: Total Distance present
    RESISTANCE_LEVEL: 0x0020,             // Bit 5: Resistance Level present
    INSTANTANEOUS_POWER: 0x0040,          // Bit 6: Instantaneous Power present
    AVERAGE_POWER: 0x0080,                // Bit 7: Average Power present
    EXPENDED_ENERGY: 0x0100,              // Bit 8: Expended Energy present
    HEART_RATE: 0x0200,                   // Bit 9: Heart Rate present
    METABOLIC_EQUIVALENT: 0x0400,         // Bit 10: Metabolic Equivalent present
    ELAPSED_TIME: 0x0800,                 // Bit 11: Elapsed Time present
    REMAINING_TIME: 0x1000,               // Bit 12: Remaining Time present
};

/**
 * Parsear Indoor Bike Data (0x2AD2)
 * @param {DataView} dataView - Datos recibidos
 * @returns {Object} Datos parseados
 */
export function parseIndoorBikeData(dataView) {
    const flags = dataView.getUint16(0, true);
    let offset = 2;
    
    const result = {
        timestamp: Date.now(),
    };
    
    // Velocidad instantánea (siempre presente si bit 0 = 0, en 0.01 km/h)
    // Si MORE_DATA = 0, la velocidad está presente
    if (!(flags & INDOOR_BIKE_DATA_FLAGS.MORE_DATA)) {
        result.speed = dataView.getUint16(offset, true) / 100;
        offset += 2;
    }
    
    // Velocidad media
    if (flags & INDOOR_BIKE_DATA_FLAGS.AVERAGE_SPEED) {
        result.averageSpeed = dataView.getUint16(offset, true) / 100;
        offset += 2;
    }
    
    // Cadencia instantánea (en 0.5 rpm)
    if (flags & INDOOR_BIKE_DATA_FLAGS.INSTANTANEOUS_CADENCE) {
        result.cadence = dataView.getUint16(offset, true) / 2;
        offset += 2;
    }
    
    // Cadencia media
    if (flags & INDOOR_BIKE_DATA_FLAGS.AVERAGE_CADENCE) {
        result.averageCadence = dataView.getUint16(offset, true) / 2;
        offset += 2;
    }
    
    // Distancia total (en metros, uint24)
    if (flags & INDOOR_BIKE_DATA_FLAGS.TOTAL_DISTANCE) {
        result.distance = dataView.getUint16(offset, true) | (dataView.getUint8(offset + 2) << 16);
        offset += 3;
    }
    
    // Nivel de resistencia (sint16, unitless)
    if (flags & INDOOR_BIKE_DATA_FLAGS.RESISTANCE_LEVEL) {
        result.resistance = dataView.getInt16(offset, true);
        offset += 2;
    }
    
    // Potencia instantánea (en watts, sint16)
    if (flags & INDOOR_BIKE_DATA_FLAGS.INSTANTANEOUS_POWER) {
        result.power = dataView.getInt16(offset, true);
        offset += 2;
    }
    
    // Potencia media
    if (flags & INDOOR_BIKE_DATA_FLAGS.AVERAGE_POWER) {
        result.averagePower = dataView.getInt16(offset, true);
        offset += 2;
    }
    
    // Energía expendida (kcal total, kcal/h, kcal/min)
    if (flags & INDOOR_BIKE_DATA_FLAGS.EXPENDED_ENERGY) {
        result.totalEnergy = dataView.getUint16(offset, true);
        result.energyPerHour = dataView.getUint16(offset + 2, true);
        result.energyPerMinute = dataView.getUint8(offset + 4);
        result.calories = result.totalEnergy;
        offset += 5;
    }
    
    // Frecuencia cardíaca
    if (flags & INDOOR_BIKE_DATA_FLAGS.HEART_RATE) {
        result.heartRate = dataView.getUint8(offset);
        offset += 1;
    }
    
    // Equivalente metabólico
    if (flags & INDOOR_BIKE_DATA_FLAGS.METABOLIC_EQUIVALENT) {
        result.metabolicEquivalent = dataView.getUint8(offset) / 10;
        offset += 1;
    }
    
    // Tiempo transcurrido (en segundos)
    if (flags & INDOOR_BIKE_DATA_FLAGS.ELAPSED_TIME) {
        result.elapsedTime = dataView.getUint16(offset, true);
        offset += 2;
    }
    
    // Tiempo restante
    if (flags & INDOOR_BIKE_DATA_FLAGS.REMAINING_TIME) {
        result.remainingTime = dataView.getUint16(offset, true);
        offset += 2;
    }
    
    return result;
}

/**
 * Parsear Fitness Machine Feature (0x2ACC)
 * @param {DataView} dataView - Datos de capacidades
 * @returns {Object} Capacidades del dispositivo
 */
export function parseFitnessMachineFeature(dataView) {
    const machineFeatures = dataView.getUint32(0, true);
    const targetSettings = dataView.getUint32(4, true);
    
    return {
        // Machine Features
        averageSpeedSupported: !!(machineFeatures & 0x0001),
        cadenceSupported: !!(machineFeatures & 0x0002),
        totalDistanceSupported: !!(machineFeatures & 0x0004),
        inclinationSupported: !!(machineFeatures & 0x0008),
        elevationGainSupported: !!(machineFeatures & 0x0010),
        paceSupported: !!(machineFeatures & 0x0020),
        stepCountSupported: !!(machineFeatures & 0x0040),
        resistanceLevelSupported: !!(machineFeatures & 0x0080),
        strideCountSupported: !!(machineFeatures & 0x0100),
        expendedEnergySupported: !!(machineFeatures & 0x0200),
        heartRateMeasurementSupported: !!(machineFeatures & 0x0400),
        metabolicEquivalentSupported: !!(machineFeatures & 0x0800),
        elapsedTimeSupported: !!(machineFeatures & 0x1000),
        remainingTimeSupported: !!(machineFeatures & 0x2000),
        powerMeasurementSupported: !!(machineFeatures & 0x4000),
        forceOnBeltSupported: !!(machineFeatures & 0x8000),
        userDataRetentionSupported: !!(machineFeatures & 0x10000),
        
        // Target Settings
        speedTargetSupported: !!(targetSettings & 0x0001),
        inclinationTargetSupported: !!(targetSettings & 0x0002),
        resistanceTargetSupported: !!(targetSettings & 0x0004),
        powerTargetSupported: !!(targetSettings & 0x0008),
        heartRateTargetSupported: !!(targetSettings & 0x0010),
        targetedExpendedEnergySupported: !!(targetSettings & 0x0020),
        targetedStepNumberSupported: !!(targetSettings & 0x0040),
        targetedStrideNumberSupported: !!(targetSettings & 0x0080),
        targetedDistanceSupported: !!(targetSettings & 0x0100),
        targetedTimeSupported: !!(targetSettings & 0x0200),
        targetedTimeTwoZonesSupported: !!(targetSettings & 0x0400),
        targetedTimeThreeZonesSupported: !!(targetSettings & 0x0800),
        targetedTimeFiveZonesSupported: !!(targetSettings & 0x1000),
        indoorBikeSimulationSupported: !!(targetSettings & 0x2000),
        wheelCircumferenceSupported: !!(targetSettings & 0x4000),
        spinDownControlSupported: !!(targetSettings & 0x8000),
        targetedCadenceSupported: !!(targetSettings & 0x10000),
    };
}

/**
 * Parsear Fitness Machine Status (0x2ADA)
 * @param {DataView} dataView - Datos de estado
 * @returns {Object} Estado del dispositivo
 */
export function parseFitnessMachineStatus(dataView) {
    const opCode = dataView.getUint8(0);
    
    const statusCodes = {
        0x01: 'Reset',
        0x02: 'Fitness Machine Stopped or Paused by User',
        0x03: 'Fitness Machine Stopped by Safety Key',
        0x04: 'Fitness Machine Started or Resumed by User',
        0x05: 'Target Speed Changed',
        0x06: 'Target Incline Changed',
        0x07: 'Target Resistance Level Changed',
        0x08: 'Target Power Changed',
        0x09: 'Target Heart Rate Changed',
        0x0A: 'Targeted Expended Energy Changed',
        0x0B: 'Targeted Number of Steps Changed',
        0x0C: 'Targeted Number of Strides Changed',
        0x0D: 'Targeted Distance Changed',
        0x0E: 'Targeted Training Time Changed',
        0x0F: 'Targeted Time in Two Heart Rate Zones Changed',
        0x10: 'Targeted Time in Three Heart Rate Zones Changed',
        0x11: 'Targeted Time in Five Heart Rate Zones Changed',
        0x12: 'Indoor Bike Simulation Parameters Changed',
        0x13: 'Wheel Circumference Changed',
        0x14: 'Spin Down Status',
        0x15: 'Targeted Cadence Changed',
        0xFF: 'Control Permission Lost',
    };
    
    const result = {
        opCode,
        status: statusCodes[opCode] || 'Unknown',
    };
    
    // Parsear datos adicionales según el opCode
    if (opCode === 0x05 && dataView.byteLength >= 3) {
        result.targetSpeed = dataView.getUint16(1, true) / 100;
    } else if (opCode === 0x07 && dataView.byteLength >= 2) {
        result.targetResistance = dataView.getInt8(1);
    } else if (opCode === 0x08 && dataView.byteLength >= 3) {
        result.targetPower = dataView.getInt16(1, true);
    }
    
    return result;
}

/**
 * Parsear Training Status (0x2AD3)
 * @param {DataView} dataView - Datos de estado de entrenamiento
 * @returns {Object} Estado del entrenamiento
 */
export function parseTrainingStatus(dataView) {
    const flags = dataView.getUint8(0);
    const status = dataView.getUint8(1);
    
    const statusDescriptions = {
        0x00: 'Other',
        0x01: 'Idle',
        0x02: 'Warming Up',
        0x03: 'Low Intensity Interval',
        0x04: 'High Intensity Interval',
        0x05: 'Recovery Interval',
        0x06: 'Isometric',
        0x07: 'Heart Rate Control',
        0x08: 'Fitness Test',
        0x09: 'Speed Outside Control Region - Low',
        0x0A: 'Speed Outside Control Region - High',
        0x0B: 'Cool Down',
        0x0C: 'Watt Control',
        0x0D: 'Manual Mode (Quick Start)',
        0x0E: 'Pre-Workout',
        0x0F: 'Post-Workout',
    };
    
    const result = {
        trainingStatusString: !!(flags & 0x01),
        extendedString: !!(flags & 0x02),
        status,
        statusDescription: statusDescriptions[status] || 'Unknown',
    };
    
    // Si hay string de entrenamiento
    if (result.trainingStatusString && dataView.byteLength > 2) {
        const stringBytes = [];
        for (let i = 2; i < dataView.byteLength; i++) {
            stringBytes.push(dataView.getUint8(i));
        }
        result.trainingStatusStringValue = String.fromCharCode(...stringBytes);
    }
    
    return result;
}

/**
 * Parsear Supported Resistance Level Range (0x2AD6)
 * @param {DataView} dataView - Datos del rango
 * @returns {Object} Rango de resistencia soportado
 */
export function parseSupportedResistanceRange(dataView) {
    return {
        minimum: dataView.getInt16(0, true) / 10,
        maximum: dataView.getInt16(2, true) / 10,
        increment: dataView.getUint16(4, true) / 10,
    };
}

/**
 * Parsear Supported Power Range (0x2AD8)
 * @param {DataView} dataView - Datos del rango
 * @returns {Object} Rango de potencia soportado
 */
export function parseSupportedPowerRange(dataView) {
    return {
        minimum: dataView.getInt16(0, true),
        maximum: dataView.getInt16(2, true),
        increment: dataView.getUint16(4, true),
    };
}
