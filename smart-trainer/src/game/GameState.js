/**
 * GameState - Estado global del juego
 * Smart Trainer - Power Rush
 */

export const GAME_STATUS = {
    MENU: 'menu',
    PLAYING: 'playing',
    PAUSED: 'paused',
    GAME_OVER: 'gameover',
};

/**
 * Crear estado inicial del juego
 */
export function createGameState(ftp = 200) {
    return {
        // Estado general
        status: GAME_STATUS.MENU,
        ftp: ftp,
        
        // Puntuación
        score: 0,
        highScore: loadHighScore(),
        distance: 0,
        combo: 0,
        multiplier: 1,
        
        // Vidas
        lives: 3,
        maxLives: 3,
        
        // Posición del mundo
        worldSpeed: 5,          // Velocidad base
        worldPosition: 0,       // Posición horizontal del scroll
        
        // Ciclista
        cyclist: {
            x: 150,             // Posición fija en X
            y: 0,               // Altura (0 = suelo)
            vy: 0,              // Velocidad vertical (para salto)
            isJumping: false,
            isDucking: false,
            manualDuck: false,   // Agacharse manual (botón)
            isTurbo: false,
            pedalAngle: 0,
            lean: 0,            // Inclinación (-1 a 1)
        },
        
        // Datos del rodillo en tiempo real
        bikeData: {
            power: 0,
            cadence: 0,
            speed: 0,
            heartRate: 0,
        },
        
        // Arrays de entidades
        obstacles: [],
        collectibles: [],
        particles: [],
        
        // Timers y contadores
        timeSinceLastObstacle: 0,
        timeSinceLastCollectible: 0,
        sprintTimer: 0,         // Tiempo manteniendo sprint
        turboTimer: 0,          // Tiempo en modo turbo
        comboTimer: 0,          // Tiempo para mantener combo
        playTime: 0,            // Tiempo total de juego
        
        // Dificultad
        difficulty: 1,
        obstacleFrequency: 2000, // ms entre obstáculos
        
        // Efectos
        screenShake: 0,
        flashEffect: null,
        
        // Achievements desbloqueados
        achievements: [],
    };
}

/**
 * Resetear estado para nueva partida
 */
export function resetGameState(state) {
    state.status = GAME_STATUS.PLAYING;
    state.score = 0;
    state.distance = 0;
    state.combo = 0;
    state.multiplier = 1;
    state.lives = 3;
    state.worldSpeed = 5;
    state.worldPosition = 0;
    state.cyclist.y = 0;
    state.cyclist.vy = 0;
    state.cyclist.isJumping = false;
    state.cyclist.isDucking = false;
    state.cyclist.manualDuck = false;
    state.cyclist.isTurbo = false;
    state.obstacles = [];
    state.collectibles = [];
    state.particles = [];
    state.timeSinceLastObstacle = 0;
    state.timeSinceLastCollectible = 0;
    state.sprintTimer = 0;
    state.turboTimer = 0;
    state.comboTimer = 0;
    state.playTime = 0;
    state.difficulty = 1;
    state.obstacleFrequency = 2000;
    state.screenShake = 0;
    state.flashEffect = null;
    
    return state;
}

/**
 * Calcular velocidad del mundo basada en potencia
 */
export function calculateWorldSpeed(power, ftp) {
    // Potencia 0 = velocidad mínima, FTP = velocidad base, 2xFTP = velocidad máxima
    const powerRatio = Math.min(2, power / ftp);
    const minSpeed = 2;
    const maxSpeed = 15;
    
    return minSpeed + (maxSpeed - minSpeed) * powerRatio;
}

/**
 * Obtener zona de potencia actual
 */
export function getCurrentPowerZone(power, ftp) {
    const percent = (power / ftp) * 100;
    
    if (percent < 55) return { zone: 1, name: 'Z1', color: '#808080' };
    if (percent < 75) return { zone: 2, name: 'Z2', color: '#0066ff' };
    if (percent < 90) return { zone: 3, name: 'Z3', color: '#00cc00' };
    if (percent < 105) return { zone: 4, name: 'Z4', color: '#ffcc00' };
    if (percent < 120) return { zone: 5, name: 'Z5', color: '#ff6600' };
    if (percent < 150) return { zone: 6, name: 'Z6', color: '#ff0000' };
    return { zone: 7, name: 'Z7', color: '#cc00cc' };
}

/**
 * Guardar high score en localStorage
 */
export function saveHighScore(score) {
    const current = loadHighScore();
    if (score > current) {
        localStorage.setItem('powerRush_highScore', String(score));
        return true;
    }
    return false;
}

/**
 * Cargar high score de localStorage
 */
export function loadHighScore() {
    return parseInt(localStorage.getItem('powerRush_highScore') || '0', 10);
}

/**
 * Guardar achievement
 */
export function unlockAchievement(state, id) {
    if (!state.achievements.includes(id)) {
        state.achievements.push(id);
        const saved = JSON.parse(localStorage.getItem('powerRush_achievements') || '[]');
        if (!saved.includes(id)) {
            saved.push(id);
            localStorage.setItem('powerRush_achievements', JSON.stringify(saved));
        }
        return true;
    }
    return false;
}

/**
 * Lista de achievements
 */
export const ACHIEVEMENTS = {
    FIRST_JUMP: { id: 'first_jump', name: 'Primer Vuelo', desc: 'Realiza tu primer salto' },
    SPEEDSTER: { id: 'speedster', name: 'Velocista', desc: 'Alcanza 50 km/h virtuales' },
    ENDURANCE: { id: 'endurance', name: 'Resistencia', desc: '10 minutos sin perder vida' },
    POWER_UP: { id: 'power_up', name: 'Power Up', desc: '5 minutos sobre FTP' },
    COMBO_MASTER: { id: 'combo_master', name: 'Combo Master', desc: 'Combo de 50' },
    DIAMOND: { id: 'diamond', name: 'Diamante', desc: '100,000 puntos en una sesión' },
    SURVIVOR: { id: 'survivor', name: 'Superviviente', desc: 'Sobrevive con 1 vida durante 2 min' },
};
