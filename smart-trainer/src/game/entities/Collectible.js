/**
 * Collectible - Items coleccionables
 * Smart Trainer - Power Rush
 */

// Tipos de coleccionables
export const COLLECTIBLE_TYPES = {
    STAR: 'star',           // +10 puntos
    DIAMOND: 'diamond',     // x2 puntos por 15s
    HEART: 'heart',         // +1 vida
    BOLT: 'bolt',           // Velocidad x1.5 por 10s
};

/**
 * Crear un coleccionable
 */
export function createCollectible(type, x, y = 0) {
    const configs = {
        [COLLECTIBLE_TYPES.STAR]: {
            size: 24,
            points: 10,
            color: '#ffd700',
            effect: null,
        },
        [COLLECTIBLE_TYPES.DIAMOND]: {
            size: 28,
            points: 25,
            color: '#00d4ff',
            effect: { type: 'multiplier', value: 2, duration: 15000 },
        },
        [COLLECTIBLE_TYPES.HEART]: {
            size: 26,
            points: 0,
            color: '#ff4444',
            effect: { type: 'life', value: 1 },
        },
        [COLLECTIBLE_TYPES.BOLT]: {
            size: 26,
            points: 15,
            color: '#ffaa00',
            effect: { type: 'speed', value: 1.5, duration: 10000 },
        },
    };
    
    const config = configs[type] || configs[COLLECTIBLE_TYPES.STAR];
    
    return {
        type,
        x,
        y: y || (Math.random() * 40 + 20), // Altura aleatoria
        size: config.size,
        points: config.points,
        color: config.color,
        effect: config.effect,
        active: true,
        collected: false,
        rotation: 0,
        scale: 1,
        glow: 0,
    };
}

/**
 * Actualizar coleccionable
 */
export function updateCollectible(collectible, worldSpeed, deltaTime) {
    // Mover hacia la izquierda
    collectible.x -= worldSpeed * (deltaTime / 16);
    
    // Rotación continua
    collectible.rotation += 0.05;
    
    // Efecto de pulso
    collectible.glow = Math.sin(Date.now() / 200) * 0.3 + 0.7;
    
    // Animación de recolección
    if (collectible.collected) {
        collectible.scale *= 1.1;
        collectible.y -= 5;
        if (collectible.scale > 2) {
            collectible.active = false;
        }
    }
    
    // Marcar como inactivo si sale de la pantalla
    if (collectible.x + collectible.size < -50) {
        collectible.active = false;
    }
    
    return collectible;
}

/**
 * Obtener hitbox del coleccionable
 */
export function getCollectibleHitbox(collectible, groundY) {
    const halfSize = collectible.size / 2;
    
    return {
        x: collectible.x - halfSize,
        y: groundY - collectible.y - halfSize,
        width: collectible.size,
        height: collectible.size,
    };
}

/**
 * Renderizar coleccionable
 */
export function renderCollectible(ctx, collectible, groundY) {
    if (!collectible.active) return;
    
    const x = collectible.x;
    const y = groundY - collectible.y;
    
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(collectible.rotation);
    ctx.scale(collectible.scale, collectible.scale);
    
    // Efecto de glow
    ctx.shadowColor = collectible.color;
    ctx.shadowBlur = 10 * collectible.glow;
    
    switch (collectible.type) {
        case COLLECTIBLE_TYPES.STAR:
            renderStar(ctx, collectible);
            break;
        case COLLECTIBLE_TYPES.DIAMOND:
            renderDiamond(ctx, collectible);
            break;
        case COLLECTIBLE_TYPES.HEART:
            renderHeart(ctx, collectible);
            break;
        case COLLECTIBLE_TYPES.BOLT:
            renderBolt(ctx, collectible);
            break;
    }
    
    ctx.restore();
}

/**
 * Renderizar estrella
 */
function renderStar(ctx, item) {
    const size = item.size / 2;
    const spikes = 5;
    const outerRadius = size;
    const innerRadius = size * 0.5;
    
    ctx.fillStyle = item.color;
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    
    ctx.beginPath();
    for (let i = 0; i < spikes * 2; i++) {
        const radius = i % 2 === 0 ? outerRadius : innerRadius;
        const angle = (i * Math.PI) / spikes - Math.PI / 2;
        const x = Math.cos(angle) * radius;
        const y = Math.sin(angle) * radius;
        
        if (i === 0) {
            ctx.moveTo(x, y);
        } else {
            ctx.lineTo(x, y);
        }
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
}

/**
 * Renderizar diamante
 */
function renderDiamond(ctx, item) {
    const size = item.size / 2;
    
    ctx.fillStyle = item.color;
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    
    ctx.beginPath();
    ctx.moveTo(0, -size);
    ctx.lineTo(size, 0);
    ctx.lineTo(0, size);
    ctx.lineTo(-size, 0);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    
    // Línea interior brillante
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(-size * 0.5, -size * 0.3);
    ctx.lineTo(size * 0.5, -size * 0.3);
    ctx.stroke();
}

/**
 * Renderizar corazón
 */
function renderHeart(ctx, item) {
    const size = item.size / 2;
    
    ctx.fillStyle = item.color;
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    
    ctx.beginPath();
    ctx.moveTo(0, size * 0.8);
    ctx.bezierCurveTo(-size, size * 0.3, -size, -size * 0.5, 0, -size * 0.2);
    ctx.bezierCurveTo(size, -size * 0.5, size, size * 0.3, 0, size * 0.8);
    ctx.fill();
    ctx.stroke();
}

/**
 * Renderizar rayo
 */
function renderBolt(ctx, item) {
    const size = item.size / 2;
    
    ctx.fillStyle = item.color;
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    
    ctx.beginPath();
    ctx.moveTo(size * 0.3, -size);
    ctx.lineTo(-size * 0.5, 0);
    ctx.lineTo(0, 0);
    ctx.lineTo(-size * 0.3, size);
    ctx.lineTo(size * 0.5, 0);
    ctx.lineTo(0, 0);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
}

/**
 * Crear partículas al recoger
 */
export function createCollectParticles(x, y, color) {
    const particles = [];
    const count = 8;
    
    for (let i = 0; i < count; i++) {
        const angle = (Math.PI * 2 / count) * i;
        particles.push({
            x,
            y,
            vx: Math.cos(angle) * 3,
            vy: Math.sin(angle) * 3,
            color,
            size: 4,
            life: 1,
        });
    }
    
    return particles;
}
