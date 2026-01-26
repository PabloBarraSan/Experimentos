/**
 * PhysicsSystem - Física y colisiones
 * Smart Trainer - Power Rush
 */

import { getCyclistHitbox, jumpCyclist } from '../entities/Cyclist.js';
import { getObstacleHitbox, checkObstacleCondition, OBSTACLE_TYPES } from '../entities/Obstacle.js';
import { getCollectibleHitbox, createCollectParticles } from '../entities/Collectible.js';

// Constantes
const SPRINT_THRESHOLD = 1.2;     // 120% FTP para sprint
const SPRINT_DURATION = 2000;     // 2 segundos para activar salto
const TURBO_THRESHOLD = 1.0;      // 100% FTP para turbo
const TURBO_DURATION = 10000;     // 10 segundos para activar turbo

/**
 * Actualizar sistema de física
 */
export function updatePhysicsSystem(state, groundY, deltaTime) {
    const { cyclist, bikeData, ftp } = state;
    
    // Detectar sprint para salto
    updateSprintDetection(state, deltaTime);
    
    // Detectar modo turbo
    updateTurboDetection(state, deltaTime);
    
    // Verificar colisiones con obstáculos
    checkObstacleCollisions(state, groundY);
    
    // Verificar colisiones con coleccionables
    checkCollectibleCollisions(state, groundY);
    
    // Actualizar partículas
    updateParticles(state, deltaTime);
}

/**
 * Detectar sprint para salto
 */
function updateSprintDetection(state, deltaTime) {
    const { bikeData, ftp, cyclist } = state;
    const powerRatio = bikeData.power / ftp;
    
    if (powerRatio >= SPRINT_THRESHOLD) {
        state.sprintTimer += deltaTime;
        
        // Si mantiene sprint suficiente tiempo, saltar
        if (state.sprintTimer >= SPRINT_DURATION && !cyclist.isJumping) {
            jumpCyclist(cyclist);
            state.sprintTimer = 0;
        }
    } else {
        state.sprintTimer = 0;
    }
}

/**
 * Detectar modo turbo
 */
function updateTurboDetection(state, deltaTime) {
    const { bikeData, ftp, cyclist } = state;
    const powerRatio = bikeData.power / ftp;
    
    if (powerRatio >= TURBO_THRESHOLD) {
        state.turboTimer += deltaTime;
        
        // Activar turbo si mantiene potencia alta
        if (state.turboTimer >= TURBO_DURATION) {
            cyclist.isTurbo = true;
        }
    } else {
        state.turboTimer = Math.max(0, state.turboTimer - deltaTime * 2);
        if (state.turboTimer < TURBO_DURATION * 0.5) {
            cyclist.isTurbo = false;
        }
    }
}

/**
 * Verificar colisiones con obstáculos
 */
function checkObstacleCollisions(state, groundY) {
    const { cyclist, bikeData, ftp } = state;
    const cyclistBox = getCyclistHitbox(cyclist, groundY);
    
    for (const obstacle of state.obstacles) {
        if (!obstacle.active || obstacle.passed) continue;
        
        const obstacleBox = getObstacleHitbox(obstacle, groundY);
        
        // Verificar si el ciclista ha pasado el obstáculo
        if (cyclistBox.x > obstacleBox.x + obstacleBox.width) {
            obstacle.passed = true;
            
            // Verificar si lo pasó correctamente
            const success = checkObstacleCondition(obstacle, cyclist, bikeData, ftp);
            
            if (success) {
                // Sumar puntos
                handleObstacleSuccess(state, obstacle);
            } else if (checkAABBCollision(cyclistBox, obstacleBox)) {
                // Colisión!
                handleObstacleCollision(state, obstacle);
            }
            continue;
        }
        
        // Colisión en tiempo real
        if (checkAABBCollision(cyclistBox, obstacleBox)) {
            const success = checkObstacleCondition(obstacle, cyclist, bikeData, ftp);
            
            if (!success && !obstacle.passed) {
                handleObstacleCollision(state, obstacle);
                obstacle.passed = true;
            }
        }
    }
}

/**
 * Manejar éxito al superar obstáculo
 */
function handleObstacleSuccess(state, obstacle) {
    // Aumentar combo
    state.combo++;
    state.comboTimer = 3000;
    
    // Actualizar multiplicador
    if (state.combo >= 20) {
        state.multiplier = 5;
    } else if (state.combo >= 10) {
        state.multiplier = 3;
    } else if (state.combo >= 5) {
        state.multiplier = 2;
    }
    
    // Sumar puntos
    state.score += obstacle.points * state.multiplier;
    
    // Crear efecto visual
    state.flashEffect = { color: '#00ff00', duration: 200 };
}

/**
 * Manejar colisión con obstáculo
 */
function handleObstacleCollision(state, obstacle) {
    // Perder vida
    state.lives--;
    
    // Resetear combo
    state.combo = 0;
    state.multiplier = 1;
    
    // Efecto de screen shake
    state.screenShake = 500;
    
    // Efecto visual
    state.flashEffect = { color: '#ff0000', duration: 300 };
    
    // Game over si no quedan vidas
    if (state.lives <= 0) {
        state.status = 'gameover';
    }
}

/**
 * Verificar colisiones con coleccionables
 */
function checkCollectibleCollisions(state, groundY) {
    const { cyclist } = state;
    const cyclistBox = getCyclistHitbox(cyclist, groundY);
    
    for (const item of state.collectibles) {
        if (!item.active || item.collected) continue;
        
        const itemBox = getCollectibleHitbox(item, groundY);
        
        if (checkAABBCollision(cyclistBox, itemBox)) {
            collectItem(state, item);
        }
    }
}

/**
 * Recoger item
 */
function collectItem(state, item) {
    item.collected = true;
    
    // Sumar puntos
    state.score += item.points * state.multiplier;
    
    // Aplicar efecto especial
    if (item.effect) {
        applyItemEffect(state, item.effect);
    }
    
    // Crear partículas
    const particles = createCollectParticles(item.x, item.y, item.color);
    state.particles.push(...particles);
    
    // Efecto visual
    state.flashEffect = { color: item.color, duration: 150 };
}

/**
 * Aplicar efecto de item
 */
function applyItemEffect(state, effect) {
    switch (effect.type) {
        case 'life':
            state.lives = Math.min(state.maxLives, state.lives + effect.value);
            break;
        case 'multiplier':
            state.multiplier = Math.max(state.multiplier, effect.value);
            // El efecto durará un tiempo
            setTimeout(() => {
                state.multiplier = Math.max(1, state.multiplier - 1);
            }, effect.duration);
            break;
        case 'speed':
            // Velocidad temporal
            const originalSpeed = state.worldSpeed;
            state.worldSpeed *= effect.value;
            setTimeout(() => {
                state.worldSpeed = originalSpeed;
            }, effect.duration);
            break;
    }
}

/**
 * Actualizar partículas
 */
function updateParticles(state, deltaTime) {
    for (const particle of state.particles) {
        particle.x += particle.vx;
        particle.y += particle.vy;
        particle.vy += 0.2; // Gravedad
        particle.life -= deltaTime / 500;
        particle.size *= 0.95;
    }
}

/**
 * Verificar colisión AABB
 */
function checkAABBCollision(a, b) {
    return (
        a.x < b.x + b.width &&
        a.x + a.width > b.x &&
        a.y < b.y + b.height &&
        a.y + a.height > b.y
    );
}

/**
 * Actualizar combo timer
 */
export function updateComboTimer(state, deltaTime) {
    if (state.combo > 0) {
        state.comboTimer -= deltaTime;
        if (state.comboTimer <= 0) {
            state.combo = 0;
            state.multiplier = 1;
        }
    }
}
