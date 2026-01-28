/**
 * RideState - Estado del modo ciclismo virtual
 * Smart Trainer - Virtual Cycling
 */

// Estados del ride
export const RIDE_STATUS = {
    MENU: 'menu',
    SELECTING_WORLD: 'selecting_world',
    SELECTING_ROUTE: 'selecting_route',
    PLAYING: 'playing',
    PAUSED: 'paused',
    FINISHED: 'finished',
};

/**
 * Crear estado inicial del ride
 */
export function createRideState(options = {}) {
    const {
        ftp = 200,
        weight = 70,
        worldId = 'green_valley',
        routeLength = 10000, // 10km por defecto
    } = options;
    
    return {
        // Estado general
        status: RIDE_STATUS.MENU,
        ftp,
        weight,
        bikeWeight: 10, // kg
        
        // Datos del rodillo
        bikeData: {
            power: 0,
            cadence: 0,
            speed: 0,
            heartRate: 0,
        },
        
        // Configuración del mundo
        worldId,
        
        // Datos de la ruta
        route: {
            length: routeLength,
            points: [], // Array de { distance, elevation, grade }
            currentIndex: 0,
        },
        
        // Posición y progreso
        position: {
            distance: 0,        // metros recorridos
            elevation: 0,       // elevación actual
            speed: 0,           // velocidad calculada (m/s)
            virtualSpeed: 0,    // velocidad visual (km/h)
        },
        
        // Pendiente actual
        currentGrade: 0, // %
        
        // Tiempo
        startTime: null,
        elapsedTime: 0, // ms
        
        // Bots
        bots: [],
        
        // Estadísticas de la sesión
        stats: {
            maxPower: 0,
            avgPower: 0,
            maxSpeed: 0,
            avgSpeed: 0,
            totalAscent: 0,
            powerSamples: [],
            speedSamples: [],
        },
        
        // Efectos visuales
        screenShake: 0,
        flashEffect: null,
        
        // UI
        showHUD: true,
    };
}

/**
 * Resetear estado para nueva ruta
 */
export function resetRideState(state, routePoints = []) {
    return {
        ...state,
        status: RIDE_STATUS.PLAYING,
        route: {
            ...state.route,
            points: routePoints,
            currentIndex: 0,
        },
        position: {
            distance: 0,
            elevation: routePoints[0]?.elevation || 0,
            speed: 0,
            virtualSpeed: 0,
        },
        currentGrade: routePoints[0]?.grade || 0,
        startTime: Date.now(),
        elapsedTime: 0,
        stats: {
            maxPower: 0,
            avgPower: 0,
            maxSpeed: 0,
            avgSpeed: 0,
            totalAscent: 0,
            powerSamples: [],
            speedSamples: [],
        },
        screenShake: 0,
        flashEffect: null,
    };
}

/**
 * Obtener zona de potencia actual
 */
export function getCurrentPowerZone(power, ftp) {
    const ratio = power / ftp;
    
    if (ratio < 0.55) return { zone: 1, name: 'Recuperación', color: '#808080' };
    if (ratio < 0.75) return { zone: 2, name: 'Resistencia', color: '#00aaff' };
    if (ratio < 0.90) return { zone: 3, name: 'Tempo', color: '#00ff00' };
    if (ratio < 1.05) return { zone: 4, name: 'Umbral', color: '#ffff00' };
    if (ratio < 1.20) return { zone: 5, name: 'VO2max', color: '#ff8800' };
    if (ratio < 1.50) return { zone: 6, name: 'Anaeróbico', color: '#ff0000' };
    return { zone: 7, name: 'Neuromuscular', color: '#ff00ff' };
}

/**
 * Actualizar estadísticas
 */
export function updateStats(state, deltaTime) {
    const { power, speed } = state.bikeData;
    const virtualSpeed = state.position.virtualSpeed;
    
    // Actualizar máximos
    if (power > state.stats.maxPower) {
        state.stats.maxPower = power;
    }
    if (virtualSpeed > state.stats.maxSpeed) {
        state.stats.maxSpeed = virtualSpeed;
    }
    
    // Agregar muestras (cada segundo aproximadamente)
    if (deltaTime > 0) {
        state.stats.powerSamples.push(power);
        state.stats.speedSamples.push(virtualSpeed);
        
        // Calcular promedios
        if (state.stats.powerSamples.length > 0) {
            state.stats.avgPower = Math.round(
                state.stats.powerSamples.reduce((a, b) => a + b, 0) / state.stats.powerSamples.length
            );
        }
        if (state.stats.speedSamples.length > 0) {
            state.stats.avgSpeed = (
                state.stats.speedSamples.reduce((a, b) => a + b, 0) / state.stats.speedSamples.length
            ).toFixed(1);
        }
    }
    
    return state;
}

/**
 * Formatear tiempo
 */
export function formatTime(ms) {
    const totalSeconds = Math.floor(ms / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    
    if (hours > 0) {
        return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}
