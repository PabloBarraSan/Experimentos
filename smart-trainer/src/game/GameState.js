/**
 * GameState - Estado global (Versión 3 Carriles)
 */

export const GAME_STATUS = {
    MENU: 'menu',
    PLAYING: 'playing',
    PAUSED: 'paused',
    GAME_OVER: 'gameover',
};

// Configuración de carriles
export const LANE_WIDTH = 2.0; // Ancho visual de cada carril en 3D (bajar a 1.5 si se sale)
export const LANES = {
    LEFT: -1,
    CENTER: 0,
    RIGHT: 1
};

export function createGameState(ftp = 200) {
    return {
        status: GAME_STATUS.MENU,
        ftp: ftp,
        score: 0,
        lives: 3,

        // MUNDO
        worldSpeed: 0,      // Se calculará según los vatios
        distanceTraveled: 0,

        // CICLISTA
        cyclist: {
            lane: 0,        // -1 (Izquierda), 0 (Centro), 1 (Derecha)
            x: 0,           // Posición visual actual (para suavizar el movimiento)
            y: 0,           // Altura (por si saltamos)
            isJumping: false,
            vy: 0,          // Velocidad vertical
        },

        // DATOS RODILLO
        bikeData: { power: 0, cadence: 0, speed: 0 },

        // OBJETOS (Ahora tienen propiedad 'z' y 'lane')
        obstacles: [],
        collectibles: [],

        // TIMERS
        timeSinceLastSpawn: 0,
        difficultyMultiplier: 1
    };
}

export function resetGameState(state) {
    state.status = GAME_STATUS.PLAYING;
    state.score = 0;
    state.lives = 3;
    state.distanceTraveled = 0;
    state.cyclist.lane = 0;
    state.cyclist.x = 0;
    state.obstacles = [];
    state.collectibles = [];
    return state;
}

export function calculateWorldSpeed(power, ftp) {
    // Más vatios = Más velocidad del mundo hacia ti
    if (power < 10) return 0;
    const intensity = power / ftp;
    // Velocidad mínima 10, máxima 50 (unidades por segundo)
    return 10 + (intensity * 40);
}

// Mantenemos esta para los colores de la UI
export function getCurrentPowerZone(power, ftp) {
    const p = (power / ftp) * 100;
    if (p < 55) return { color: '#808080' }; // Z1
    if (p < 75) return { color: '#0066ff' }; // Z2
    if (p < 90) return { color: '#00cc00' }; // Z3
    if (p < 105) return { color: '#ffcc00' }; // Z4
    if (p < 120) return { color: '#ff6600' }; // Z5
    return { color: '#ff0000' }; // Z6
}
