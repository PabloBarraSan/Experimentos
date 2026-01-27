/**
 * SpawnSystem - Generación de obstáculos y coleccionables
 * Smart Trainer - Power Rush
 */

import { createObstacle, OBSTACLE_TYPES } from '../entities/Obstacle.js';
import { createCollectible, COLLECTIBLE_TYPES } from '../entities/Collectible.js';

/**
 * Configuración de spawn
 */
const SPAWN_CONFIG = {
    minObstacleGap: 800,      // Mínima distancia entre obstáculos
    collectibleChance: 0.4,    // Probabilidad de spawn de coleccionable
    powerZoneChance: 0.15,     // Probabilidad de zona de potencia
    specialItemChance: 0.1,    // Probabilidad de item especial
};

/**
 * Actualizar sistema de spawn
 */
export function updateSpawnSystem(state, canvasWidth, deltaTime) {
    state.timeSinceLastObstacle += deltaTime;
    state.timeSinceLastCollectible += deltaTime;
    
    // Ajustar frecuencia según dificultad
    const adjustedFrequency = state.obstacleFrequency / state.difficulty;
    
    // Spawn de obstáculos
    if (state.timeSinceLastObstacle >= adjustedFrequency) {
        spawnObstacle(state, canvasWidth);
        state.timeSinceLastObstacle = 0;
        
        // Aumentar dificultad gradualmente
        state.difficulty = 1 + (state.playTime / 60000) * 0.5; // +0.5 cada minuto
        state.obstacleFrequency = Math.max(1000, 2000 - state.playTime / 100);
    }
    
    // Spawn de coleccionables
    if (state.timeSinceLastCollectible >= 1500 && Math.random() < SPAWN_CONFIG.collectibleChance) {
        spawnCollectible(state, canvasWidth);
        state.timeSinceLastCollectible = 0;
    }
}

/**
 * Spawn de obstáculo
 */
function spawnObstacle(state, canvasWidth) {
    // Elegir tipo de obstáculo
    const rand = Math.random();
    let type;
    
    if (rand < 0.4) {
        type = OBSTACLE_TYPES.RAMP;
    } else if (rand < 0.7) {
        type = OBSTACLE_TYPES.TUNNEL;
    } else if (rand < 0.85) {
        type = OBSTACLE_TYPES.POWER_ZONE;
    } else {
        type = OBSTACLE_TYPES.HEADWIND;
    }
    
    // Opciones específicas según tipo
    const options = {};
    if (type === OBSTACLE_TYPES.POWER_ZONE) {
        // Zona de potencia con target aleatorio entre 70-120% FTP
        options.targetPower = Math.floor(Math.random() * 50) + 70;
    }
    
    const obstacle = createObstacle(type, canvasWidth + 100, options);
    state.obstacles.push(obstacle);
}

/**
 * Spawn de coleccionable
 */
function spawnCollectible(state, canvasWidth) {
    // Verificar que no hay obstáculo cerca
    const lastObstacle = state.obstacles[state.obstacles.length - 1];
    if (lastObstacle && canvasWidth + 50 - lastObstacle.x < 200) {
        return; // No spawn si hay obstáculo cerca
    }
    
    // Elegir tipo de coleccionable
    const rand = Math.random();
    let type;
    
    if (rand < 0.6) {
        type = COLLECTIBLE_TYPES.STAR;
    } else if (rand < 0.8) {
        type = COLLECTIBLE_TYPES.BOLT;
    } else if (rand < 0.95) {
        type = COLLECTIBLE_TYPES.DIAMOND;
    } else {
        // Corazón solo si tiene menos de 3 vidas
        type = state.lives < state.maxLives 
            ? COLLECTIBLE_TYPES.HEART 
            : COLLECTIBLE_TYPES.STAR;
    }
    
    // Posición Y aleatoria
    const yOffset = Math.random() * 50 + 10;
    
    const collectible = createCollectible(type, canvasWidth + 50, yOffset);
    state.collectibles.push(collectible);
}

/**
 * Spawn de grupo de estrellas
 */
export function spawnStarGroup(state, canvasWidth, count = 3) {
    for (let i = 0; i < count; i++) {
        const collectible = createCollectible(
            COLLECTIBLE_TYPES.STAR,
            canvasWidth + 50 + i * 40,
            30 + Math.sin(i * 0.5) * 20
        );
        state.collectibles.push(collectible);
    }
}

/**
 * Limpiar entidades inactivas
 */
export function cleanupEntities(state) {
    state.obstacles = state.obstacles.filter(o => o.active);
    state.collectibles = state.collectibles.filter(c => c.active);
    state.particles = state.particles.filter(p => p.life > 0);
}
