/**
 * Obstacle - Obstáculos del juego
 * Smart Trainer - Power Rush
 */

// Tipos de obstáculos
export const OBSTACLE_TYPES = {
    RAMP: 'ramp',           // Requiere saltar (sprint)
    TUNNEL: 'tunnel',       // Requiere agacharse (cadencia baja)
    POWER_ZONE: 'power_zone', // Requiere mantener watts específicos
    HEADWIND: 'headwind',   // Requiere aumentar potencia
};

/**
 * Crear un obstáculo
 */
export function createObstacle(type, x, options = {}) {
    const configs = {
        [OBSTACLE_TYPES.RAMP]: {
            width: 60,
            height: 40,
            points: 50,
            color: '#ff6b35',
            requiresJump: true,
        },
        [OBSTACLE_TYPES.TUNNEL]: {
            width: 80,
            height: 50,
            points: 30,
            color: '#6b5bff',
            requiresDuck: true,
        },
        [OBSTACLE_TYPES.POWER_ZONE]: {
            width: 150,
            height: 60,
            points: 100,
            color: '#00d4aa',
            targetPower: options.targetPower || 100, // % FTP
            tolerance: 10, // +/- 10%
        },
        [OBSTACLE_TYPES.HEADWIND]: {
            width: 100,
            height: 80,
            points: 75,
            color: '#00aaff',
            powerBoost: 20, // Requiere +20% de potencia
        },
    };
    
    const config = configs[type] || configs[OBSTACLE_TYPES.RAMP];
    
    return {
        type,
        x,
        y: 0, // Posición vertical relativa al suelo
        width: config.width,
        height: config.height,
        points: config.points,
        color: config.color,
        active: true,
        passed: false,
        ...config,
        ...options,
    };
}

/**
 * Actualizar obstáculo
 */
export function updateObstacle(obstacle, worldSpeed, deltaTime) {
    // Mover hacia la izquierda
    obstacle.x -= worldSpeed * (deltaTime / 16);
    
    // Marcar como inactivo si sale de la pantalla
    if (obstacle.x + obstacle.width < -50) {
        obstacle.active = false;
    }
    
    return obstacle;
}

/**
 * Obtener hitbox del obstáculo
 */
export function getObstacleHitbox(obstacle, groundY) {
    let y, height;
    
    switch (obstacle.type) {
        case OBSTACLE_TYPES.TUNNEL:
            // El túnel está arriba, hay que agacharse
            y = groundY - 80;
            height = obstacle.height;
            break;
        case OBSTACLE_TYPES.RAMP:
            // La rampa está en el suelo
            y = groundY - obstacle.height;
            height = obstacle.height;
            break;
        default:
            y = groundY - obstacle.height;
            height = obstacle.height;
    }
    
    return {
        x: obstacle.x,
        y: y,
        width: obstacle.width,
        height: height,
    };
}

/**
 * Verificar si el ciclista supera el obstáculo correctamente
 */
export function checkObstacleCondition(obstacle, cyclist, bikeData, ftp) {
    switch (obstacle.type) {
        case OBSTACLE_TYPES.RAMP:
            // Debe estar saltando
            return cyclist.isJumping && cyclist.y > 30;
            
        case OBSTACLE_TYPES.TUNNEL:
            // Debe estar agachado
            return cyclist.isDucking;
            
        case OBSTACLE_TYPES.POWER_ZONE:
            // Debe estar en el rango de potencia
            const targetWatts = (obstacle.targetPower / 100) * ftp;
            const tolerance = (obstacle.tolerance / 100) * ftp;
            return Math.abs(bikeData.power - targetWatts) <= tolerance;
            
        case OBSTACLE_TYPES.HEADWIND:
            // Debe tener potencia suficiente
            const requiredPower = ftp * (1 + obstacle.powerBoost / 100);
            return bikeData.power >= requiredPower;
            
        default:
            return false;
    }
}

/**
 * Renderizar obstáculo
 */
export function renderObstacle(ctx, obstacle, groundY) {
    ctx.save();
    
    const x = obstacle.x;
    const y = groundY;
    
    switch (obstacle.type) {
        case OBSTACLE_TYPES.RAMP:
            renderRamp(ctx, x, y, obstacle);
            break;
        case OBSTACLE_TYPES.TUNNEL:
            renderTunnel(ctx, x, y, obstacle);
            break;
        case OBSTACLE_TYPES.POWER_ZONE:
            renderPowerZone(ctx, x, y, obstacle);
            break;
        case OBSTACLE_TYPES.HEADWIND:
            renderHeadwind(ctx, x, y, obstacle);
            break;
    }
    
    ctx.restore();
}

/**
 * Renderizar rampa
 */
function renderRamp(ctx, x, y, obstacle) {
    ctx.fillStyle = obstacle.color;
    ctx.strokeStyle = '#ff8c5a';
    ctx.lineWidth = 2;
    
    // Triángulo (rampa)
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + obstacle.width, y);
    ctx.lineTo(x + obstacle.width / 2, y - obstacle.height);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    
    // Indicador de salto
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 16px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('↑', x + obstacle.width / 2, y - obstacle.height - 10);
}

/**
 * Renderizar túnel
 */
function renderTunnel(ctx, x, y, obstacle) {
    ctx.fillStyle = obstacle.color;
    ctx.strokeStyle = '#8b7bff';
    ctx.lineWidth = 2;
    
    // Rectángulo superior (túnel)
    const tunnelY = y - 80;
    ctx.fillRect(x, tunnelY, obstacle.width, obstacle.height);
    ctx.strokeRect(x, tunnelY, obstacle.width, obstacle.height);
    
    // Líneas de advertencia
    ctx.strokeStyle = '#ffcc00';
    ctx.lineWidth = 3;
    for (let i = 0; i < obstacle.width; i += 20) {
        ctx.beginPath();
        ctx.moveTo(x + i, tunnelY + obstacle.height);
        ctx.lineTo(x + i + 10, tunnelY + obstacle.height);
        ctx.stroke();
    }
    
    // Indicador de agacharse
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 14px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('↓ RPM', x + obstacle.width / 2, tunnelY - 5);
}

/**
 * Renderizar zona de potencia
 */
function renderPowerZone(ctx, x, y, obstacle) {
    // Fondo con gradiente
    const gradient = ctx.createLinearGradient(x, 0, x + obstacle.width, 0);
    gradient.addColorStop(0, 'rgba(0, 212, 170, 0.1)');
    gradient.addColorStop(0.5, 'rgba(0, 212, 170, 0.3)');
    gradient.addColorStop(1, 'rgba(0, 212, 170, 0.1)');
    
    ctx.fillStyle = gradient;
    ctx.fillRect(x, y - obstacle.height, obstacle.width, obstacle.height);
    
    // Bordes
    ctx.strokeStyle = obstacle.color;
    ctx.lineWidth = 3;
    ctx.setLineDash([10, 5]);
    ctx.strokeRect(x, y - obstacle.height, obstacle.width, obstacle.height);
    ctx.setLineDash([]);
    
    // Texto de potencia requerida
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 18px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`${obstacle.targetPower}%`, x + obstacle.width / 2, y - obstacle.height / 2);
    ctx.font = '12px sans-serif';
    ctx.fillText('FTP', x + obstacle.width / 2, y - obstacle.height / 2 + 15);
}

/**
 * Renderizar viento en contra
 */
function renderHeadwind(ctx, x, y, obstacle) {
    ctx.fillStyle = 'rgba(0, 170, 255, 0.2)';
    ctx.fillRect(x, y - obstacle.height, obstacle.width, obstacle.height);
    
    // Flechas de viento
    ctx.strokeStyle = obstacle.color;
    ctx.lineWidth = 2;
    
    for (let i = 0; i < 3; i++) {
        const arrowX = x + 20 + i * 30;
        const arrowY = y - obstacle.height / 2;
        
        ctx.beginPath();
        ctx.moveTo(arrowX + 20, arrowY);
        ctx.lineTo(arrowX, arrowY);
        ctx.lineTo(arrowX + 8, arrowY - 8);
        ctx.moveTo(arrowX, arrowY);
        ctx.lineTo(arrowX + 8, arrowY + 8);
        ctx.stroke();
    }
    
    // Indicador de potencia extra
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 14px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`+${obstacle.powerBoost}%`, x + obstacle.width / 2, y - obstacle.height - 5);
}
