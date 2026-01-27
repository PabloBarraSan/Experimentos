/**
 * Settings - Gestión de configuración del usuario
 * Smart Trainer Controller
 */

const STORAGE_KEY = 'smartTrainer_settings';

// Configuración por defecto
const DEFAULT_SETTINGS = {
    // Datos del usuario
    ftp: 200,           // Functional Threshold Power
    weight: 70,         // Peso en kg
    maxHR: 190,         // Frecuencia cardíaca máxima
    restingHR: 60,      // Frecuencia cardíaca en reposo
    
    // Preferencias
    units: 'metric',    // 'metric' o 'imperial'
    theme: 'dark',      // 'dark' o 'light'
    soundEnabled: true,
    vibrationEnabled: true,
    
    // Zonas personalizadas (% de FTP)
    zones: {
        z1: { min: 0, max: 55, name: 'Recuperación', color: '#808080' },
        z2: { min: 55, max: 75, name: 'Resistencia', color: '#0066ff' },
        z3: { min: 75, max: 90, name: 'Tempo', color: '#00cc00' },
        z4: { min: 90, max: 105, name: 'Umbral', color: '#ffcc00' },
        z5: { min: 105, max: 120, name: 'VO2max', color: '#ff6600' },
        z6: { min: 120, max: 150, name: 'Anaeróbico', color: '#ff0000' },
        z7: { min: 150, max: 999, name: 'Neuromuscular', color: '#cc00cc' },
    },
    
    // Configuración del rodillo
    trainer: {
        wheelCircumference: 2105, // mm (700x25c por defecto)
        spindownValue: null,      // Valor de calibración
        lastCalibration: null,    // Fecha última calibración
    },
    
    // Configuración de pantalla
    display: {
        showHeartRate: true,
        showCadence: true,
        showSpeed: true,
        showCalories: true,
        showDistance: true,
        chartWindowSeconds: 300,  // 5 minutos de ventana en el gráfico
    },
};

/**
 * Cargar configuración desde localStorage
 */
export function loadSettings() {
    try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
            const parsed = JSON.parse(saved);
            // Mezclar con defaults para asegurar que existan todas las propiedades
            return deepMerge(DEFAULT_SETTINGS, parsed);
        }
    } catch (error) {
        console.warn('Error cargando configuración:', error);
    }
    return { ...DEFAULT_SETTINGS };
}

/**
 * Guardar configuración en localStorage
 */
export function saveSettings(settings) {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
        return true;
    } catch (error) {
        console.error('Error guardando configuración:', error);
        return false;
    }
}

/**
 * Actualizar configuración parcialmente
 */
export function updateSettings(updates) {
    const current = loadSettings();
    const updated = deepMerge(current, updates);
    saveSettings(updated);
    return updated;
}

/**
 * Restablecer configuración a valores por defecto
 */
export function resetSettings() {
    saveSettings(DEFAULT_SETTINGS);
    return { ...DEFAULT_SETTINGS };
}

/**
 * Calcular zonas de potencia basadas en FTP
 */
export function calculatePowerZones(ftp) {
    const settings = loadSettings();
    const zones = settings.zones;
    
    return Object.entries(zones).map(([key, zone]) => ({
        key,
        name: zone.name,
        color: zone.color,
        minWatts: Math.round(ftp * zone.min / 100),
        maxWatts: zone.max === 999 ? Infinity : Math.round(ftp * zone.max / 100),
        minPercent: zone.min,
        maxPercent: zone.max,
    }));
}

/**
 * Obtener zona actual basada en potencia
 */
export function getCurrentZone(power, ftp) {
    if (!ftp || !power) {
        return {
            key: 'z1',
            name: 'Recuperación',
            color: '#808080',
            percent: 0,
        };
    }
    
    const percent = (power / ftp) * 100;
    const settings = loadSettings();
    const zones = settings.zones;
    
    for (const [key, zone] of Object.entries(zones)) {
        if (percent >= zone.min && percent < zone.max) {
            return {
                key,
                name: zone.name,
                color: zone.color,
                percent: Math.round(percent),
            };
        }
    }
    
    // Si excede todas las zonas, está en Z7
    return {
        key: 'z7',
        name: zones.z7.name,
        color: zones.z7.color,
        percent: Math.round(percent),
    };
}

/**
 * Calcular zonas de frecuencia cardíaca (Karvonen)
 */
export function calculateHRZones(maxHR, restingHR) {
    const hrReserve = maxHR - restingHR;
    
    return [
        { zone: 1, name: 'Recuperación', min: restingHR + hrReserve * 0.50, max: restingHR + hrReserve * 0.60 },
        { zone: 2, name: 'Aeróbico base', min: restingHR + hrReserve * 0.60, max: restingHR + hrReserve * 0.70 },
        { zone: 3, name: 'Aeróbico', min: restingHR + hrReserve * 0.70, max: restingHR + hrReserve * 0.80 },
        { zone: 4, name: 'Umbral anaeróbico', min: restingHR + hrReserve * 0.80, max: restingHR + hrReserve * 0.90 },
        { zone: 5, name: 'Máximo', min: restingHR + hrReserve * 0.90, max: maxHR },
    ].map(z => ({
        ...z,
        min: Math.round(z.min),
        max: Math.round(z.max),
    }));
}

/**
 * Convertir unidades
 */
export function convertUnits(value, from, to) {
    const conversions = {
        'km_to_mi': 0.621371,
        'mi_to_km': 1.60934,
        'kg_to_lb': 2.20462,
        'lb_to_kg': 0.453592,
        'm_to_ft': 3.28084,
        'ft_to_m': 0.3048,
    };
    
    const key = `${from}_to_${to}`;
    return conversions[key] ? value * conversions[key] : value;
}

/**
 * Formatear valor según preferencias de unidades
 */
export function formatWithUnits(value, type, settings = null) {
    settings = settings || loadSettings();
    const isImperial = settings.units === 'imperial';
    
    switch (type) {
        case 'distance':
            if (isImperial) {
                return `${(value * 0.000621371).toFixed(2)} mi`;
            }
            return value >= 1000 
                ? `${(value / 1000).toFixed(2)} km`
                : `${Math.round(value)} m`;
        
        case 'speed':
            if (isImperial) {
                return `${(value * 0.621371).toFixed(1)} mph`;
            }
            return `${value.toFixed(1)} km/h`;
        
        case 'weight':
            if (isImperial) {
                return `${(value * 2.20462).toFixed(1)} lb`;
            }
            return `${value.toFixed(1)} kg`;
        
        case 'elevation':
            if (isImperial) {
                return `${Math.round(value * 3.28084)} ft`;
            }
            return `${Math.round(value)} m`;
        
        default:
            return String(value);
    }
}

/**
 * Mezclar objetos profundamente
 */
function deepMerge(target, source) {
    const result = { ...target };
    
    for (const key of Object.keys(source)) {
        if (source[key] instanceof Object && key in target && target[key] instanceof Object) {
            result[key] = deepMerge(target[key], source[key]);
        } else {
            result[key] = source[key];
        }
    }
    
    return result;
}

/**
 * Exportar configuración como JSON
 */
export function exportSettings() {
    const settings = loadSettings();
    return JSON.stringify(settings, null, 2);
}

/**
 * Importar configuración desde JSON
 */
export function importSettings(jsonString) {
    try {
        const parsed = JSON.parse(jsonString);
        const merged = deepMerge(DEFAULT_SETTINGS, parsed);
        saveSettings(merged);
        return { success: true, settings: merged };
    } catch (error) {
        return { success: false, error: error.message };
    }
}
