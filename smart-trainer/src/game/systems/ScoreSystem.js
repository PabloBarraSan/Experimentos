/**
 * ScoreSystem - Sistema de puntuación y achievements
 * Smart Trainer - Power Rush
 */

import { saveHighScore, unlockAchievement, ACHIEVEMENTS } from '../GameState.js';

/**
 * Actualizar sistema de puntuación
 */
export function updateScoreSystem(state, deltaTime) {
    // Puntos por distancia
    const distancePoints = Math.floor(state.worldSpeed * deltaTime / 100);
    state.score += distancePoints;
    state.distance += state.worldSpeed * deltaTime / 50;
    
    // Puntos extra por potencia alta
    const powerRatio = state.bikeData.power / state.ftp;
    if (powerRatio >= 1.0) {
        const bonusPoints = Math.floor((powerRatio - 1.0) * 10 * deltaTime / 100);
        state.score += bonusPoints;
    }
    
    // Actualizar tiempo de juego
    state.playTime += deltaTime;
    
    // Verificar achievements
    checkAchievements(state);
}

/**
 * Verificar achievements
 */
function checkAchievements(state) {
    const { cyclist, bikeData, ftp, score, combo, playTime, lives } = state;
    
    // Primer salto
    if (cyclist.isJumping) {
        unlockAchievement(state, ACHIEVEMENTS.FIRST_JUMP.id);
    }
    
    // Velocista (50 km/h virtuales = worldSpeed > 12)
    if (state.worldSpeed > 12) {
        unlockAchievement(state, ACHIEVEMENTS.SPEEDSTER.id);
    }
    
    // Combo Master
    if (combo >= 50) {
        unlockAchievement(state, ACHIEVEMENTS.COMBO_MASTER.id);
    }
    
    // Diamante (100k puntos)
    if (score >= 100000) {
        unlockAchievement(state, ACHIEVEMENTS.DIAMOND.id);
    }
    
    // Resistencia (10 minutos sin perder vida)
    // Esto requiere tracking adicional, simplificado aquí
    if (playTime >= 600000 && lives === 3) {
        unlockAchievement(state, ACHIEVEMENTS.ENDURANCE.id);
    }
    
    // Power Up (5 minutos sobre FTP)
    // Simplificado: si el turbo está activo
    if (cyclist.isTurbo && playTime >= 300000) {
        unlockAchievement(state, ACHIEVEMENTS.POWER_UP.id);
    }
}

/**
 * Finalizar partida y guardar puntuación
 */
export function finishGame(state) {
    const isNewHighScore = saveHighScore(state.score);
    
    return {
        score: state.score,
        distance: Math.round(state.distance),
        playTime: state.playTime,
        maxCombo: state.combo, // Idealmente trackear el máximo
        isNewHighScore,
        achievements: state.achievements,
    };
}

/**
 * Formatear puntuación con separadores
 */
export function formatScore(score) {
    return score.toLocaleString();
}

/**
 * Formatear tiempo de juego
 */
export function formatPlayTime(ms) {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Calcular estadísticas de la partida
 */
export function calculateGameStats(state) {
    return {
        score: state.score,
        distance: Math.round(state.distance),
        time: formatPlayTime(state.playTime),
        avgPower: state.bikeData.power, // Idealmente promedio real
        maxCombo: state.combo,
        itemsCollected: state.collectibles.filter(c => c.collected).length,
        obstaclesPassed: state.obstacles.filter(o => o.passed).length,
    };
}
