/**
 * Calculations - Métricas avanzadas de ciclismo
 * Smart Trainer Controller
 */

/**
 * Calcular Potencia Normalizada (NP)
 * Basado en el algoritmo de TrainingPeaks/Coggan
 * 
 * @param {Array<number>} powerData - Array de potencias en watts (1 dato por segundo)
 * @param {number} sampleRate - Muestras por segundo (default 1)
 * @returns {number} Potencia normalizada en watts
 */
export function calculateNP(powerData, sampleRate = 1) {
    if (!powerData || powerData.length < 30 * sampleRate) {
        // Necesitamos al menos 30 segundos de datos
        return calculateAvgPower(powerData);
    }
    
    const windowSize = 30 * sampleRate; // Ventana de 30 segundos
    const rollingAvg = [];
    
    // 1. Calcular media móvil de 30 segundos
    for (let i = windowSize; i <= powerData.length; i++) {
        const window = powerData.slice(i - windowSize, i);
        const avg = window.reduce((sum, p) => sum + (p || 0), 0) / windowSize;
        rollingAvg.push(avg);
    }
    
    if (rollingAvg.length === 0) {
        return calculateAvgPower(powerData);
    }
    
    // 2. Elevar cada valor a la 4ª potencia
    const fourthPower = rollingAvg.map(p => Math.pow(p, 4));
    
    // 3. Calcular media de los valores elevados
    const avgFourth = fourthPower.reduce((sum, p) => sum + p, 0) / fourthPower.length;
    
    // 4. Raíz cuarta del resultado
    return Math.round(Math.pow(avgFourth, 0.25));
}

/**
 * Calcular Training Stress Score (TSS)
 * 
 * @param {number} normalizedPower - Potencia normalizada
 * @param {number} durationSeconds - Duración en segundos
 * @param {number} ftp - FTP del usuario
 * @returns {number} TSS
 */
export function calculateTSS(normalizedPower, durationSeconds, ftp) {
    if (!ftp || ftp <= 0 || !durationSeconds || durationSeconds <= 0) {
        return 0;
    }
    
    const intensityFactor = normalizedPower / ftp;
    const tss = (durationSeconds * normalizedPower * intensityFactor) / (ftp * 3600) * 100;
    
    return Math.round(tss);
}

/**
 * Calcular Intensity Factor (IF)
 * 
 * @param {number} normalizedPower - Potencia normalizada
 * @param {number} ftp - FTP del usuario
 * @returns {number} IF (típicamente entre 0.5 y 1.2)
 */
export function calculateIF(normalizedPower, ftp) {
    if (!ftp || ftp <= 0) {
        return 0;
    }
    
    return parseFloat((normalizedPower / ftp).toFixed(2));
}

/**
 * Calcular Variability Index (VI)
 * Indica cuán variable fue el esfuerzo
 * 
 * @param {number} normalizedPower - Potencia normalizada
 * @param {number} avgPower - Potencia media
 * @returns {number} VI (1.0 = constante, >1.05 = variable)
 */
export function calculateVI(normalizedPower, avgPower) {
    if (!avgPower || avgPower <= 0) {
        return 1;
    }
    
    return parseFloat((normalizedPower / avgPower).toFixed(2));
}

/**
 * Calcular trabajo total en kilojoules
 * 
 * @param {Array<number>} powerData - Array de potencias (1 por segundo)
 * @param {number} sampleRate - Muestras por segundo
 * @returns {number} Trabajo en kJ
 */
export function calculateKilojoules(powerData, sampleRate = 1) {
    if (!powerData || powerData.length === 0) {
        return 0;
    }
    
    // Energía = Potencia × Tiempo
    // 1 kJ = 1000 J = 1000 W·s
    const totalJoules = powerData.reduce((sum, p) => sum + (p || 0), 0) / sampleRate;
    
    return Math.round(totalJoules / 1000);
}

/**
 * Calcular calorías quemadas (aproximación)
 * 
 * @param {number} kilojoules - Trabajo en kJ
 * @returns {number} Calorías estimadas
 */
export function calculateCalories(kilojoules) {
    // La eficiencia humana es aproximadamente 20-25%
    // Por lo que 1 kJ de trabajo ≈ 1 kcal quemada (simplificación común)
    return Math.round(kilojoules * 1.05);
}

/**
 * Calcular potencia media
 * 
 * @param {Array<number>} powerData - Array de potencias
 * @returns {number} Potencia media en watts
 */
export function calculateAvgPower(powerData) {
    if (!powerData || powerData.length === 0) {
        return 0;
    }
    
    const validData = powerData.filter(p => p !== null && p !== undefined && p > 0);
    if (validData.length === 0) {
        return 0;
    }
    
    return Math.round(validData.reduce((sum, p) => sum + p, 0) / validData.length);
}

/**
 * Calcular potencia máxima
 * 
 * @param {Array<number>} powerData - Array de potencias
 * @returns {number} Potencia máxima en watts
 */
export function calculateMaxPower(powerData) {
    if (!powerData || powerData.length === 0) {
        return 0;
    }
    
    return Math.max(...powerData.filter(p => p !== null && p !== undefined));
}

/**
 * Calcular potencia máxima sostenida por duración
 * 
 * @param {Array<number>} powerData - Array de potencias (1 por segundo)
 * @param {number} durationSeconds - Duración del esfuerzo
 * @returns {number} Mejor potencia media para esa duración
 */
export function calculateBestPower(powerData, durationSeconds) {
    if (!powerData || powerData.length < durationSeconds) {
        return calculateAvgPower(powerData);
    }
    
    let maxAvg = 0;
    
    for (let i = 0; i <= powerData.length - durationSeconds; i++) {
        const window = powerData.slice(i, i + durationSeconds);
        const avg = window.reduce((sum, p) => sum + (p || 0), 0) / durationSeconds;
        if (avg > maxAvg) {
            maxAvg = avg;
        }
    }
    
    return Math.round(maxAvg);
}

/**
 * Calcular curva de potencia (power profile)
 * 
 * @param {Array<number>} powerData - Array de potencias (1 por segundo)
 * @returns {Object} Objeto con mejores potencias por duración
 */
export function calculatePowerCurve(powerData) {
    const durations = [5, 10, 30, 60, 300, 600, 1200, 3600]; // segundos
    const curve = {};
    
    durations.forEach(duration => {
        if (powerData.length >= duration) {
            curve[duration] = calculateBestPower(powerData, duration);
        }
    });
    
    return curve;
}

/**
 * Calcular estadísticas de cadencia
 * 
 * @param {Array<number>} cadenceData - Array de cadencias
 * @returns {Object} Estadísticas de cadencia
 */
export function calculateCadenceStats(cadenceData) {
    const validData = cadenceData.filter(c => c !== null && c !== undefined && c > 0);
    
    if (validData.length === 0) {
        return { avg: 0, max: 0, min: 0 };
    }
    
    return {
        avg: Math.round(validData.reduce((sum, c) => sum + c, 0) / validData.length),
        max: Math.max(...validData),
        min: Math.min(...validData),
    };
}

/**
 * Calcular estadísticas de frecuencia cardíaca
 * 
 * @param {Array<number>} hrData - Array de datos de FC
 * @param {number} maxHR - FC máxima del usuario
 * @returns {Object} Estadísticas de FC
 */
export function calculateHRStats(hrData, maxHR = 190) {
    const validData = hrData.filter(hr => hr !== null && hr !== undefined && hr > 0);
    
    if (validData.length === 0) {
        return { avg: 0, max: 0, min: 0, percentMax: 0 };
    }
    
    const avg = Math.round(validData.reduce((sum, hr) => sum + hr, 0) / validData.length);
    const max = Math.max(...validData);
    
    return {
        avg,
        max,
        min: Math.min(...validData),
        percentMax: Math.round((avg / maxHR) * 100),
    };
}

/**
 * Calcular tiempo en zonas de potencia
 * 
 * @param {Array<number>} powerData - Array de potencias
 * @param {number} ftp - FTP del usuario
 * @returns {Object} Tiempo en cada zona (en segundos)
 */
export function calculateTimeInZones(powerData, ftp) {
    const zones = {
        z1: 0, // < 55%
        z2: 0, // 55-75%
        z3: 0, // 75-90%
        z4: 0, // 90-105%
        z5: 0, // 105-120%
        z6: 0, // 120-150%
        z7: 0, // > 150%
    };
    
    powerData.forEach(power => {
        if (!power || power <= 0) return;
        
        const percent = (power / ftp) * 100;
        
        if (percent < 55) zones.z1++;
        else if (percent < 75) zones.z2++;
        else if (percent < 90) zones.z3++;
        else if (percent < 105) zones.z4++;
        else if (percent < 120) zones.z5++;
        else if (percent < 150) zones.z6++;
        else zones.z7++;
    });
    
    return zones;
}

/**
 * Calcular todas las métricas de una sesión
 * 
 * @param {Object} sessionData - Datos de la sesión
 * @param {number} ftp - FTP del usuario
 * @returns {Object} Todas las métricas calculadas
 */
export function calculateSessionMetrics(sessionData, ftp) {
    const { dataPoints = [], duration } = sessionData;
    
    const powerData = dataPoints.map(p => p.power || 0);
    const cadenceData = dataPoints.map(p => p.cadence || 0);
    const hrData = dataPoints.map(p => p.heartRate || 0);
    
    const avgPower = calculateAvgPower(powerData);
    const maxPower = calculateMaxPower(powerData);
    const np = calculateNP(powerData);
    const intensityFactor = calculateIF(np, ftp);
    const vi = calculateVI(np, avgPower);
    const tss = calculateTSS(np, duration || powerData.length, ftp);
    const kj = calculateKilojoules(powerData);
    const calories = calculateCalories(kj);
    const timeInZones = calculateTimeInZones(powerData, ftp);
    const cadenceStats = calculateCadenceStats(cadenceData);
    const hrStats = calculateHRStats(hrData);
    const powerCurve = calculatePowerCurve(powerData);
    
    return {
        duration: duration || powerData.length,
        power: {
            avg: avgPower,
            max: maxPower,
            normalized: np,
        },
        intensity: {
            if: intensityFactor,
            vi,
            tss,
        },
        energy: {
            kj,
            calories,
        },
        zones: timeInZones,
        cadence: cadenceStats,
        heartRate: hrStats,
        powerCurve,
    };
}

/**
 * Estimar FTP basado en un test de 20 minutos
 * 
 * @param {number} avgPower20min - Potencia media en 20 minutos
 * @returns {number} FTP estimado
 */
export function estimateFTPFrom20Min(avgPower20min) {
    return Math.round(avgPower20min * 0.95);
}

/**
 * Estimar FTP basado en un ramp test
 * 
 * @param {number} lastCompletedPower - Potencia del último minuto completado
 * @returns {number} FTP estimado
 */
export function estimateFTPFromRamp(lastCompletedPower) {
    return Math.round(lastCompletedPower * 0.75);
}

/**
 * Calcular W/kg (watts por kilogramo)
 * 
 * @param {number} power - Potencia en watts
 * @param {number} weight - Peso en kg
 * @returns {number} W/kg
 */
export function calculateWattsPerKg(power, weight) {
    if (!weight || weight <= 0) return 0;
    return parseFloat((power / weight).toFixed(2));
}
