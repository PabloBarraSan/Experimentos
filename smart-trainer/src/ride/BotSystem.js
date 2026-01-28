/**
 * BotSystem - Sistema de ciclistas bot (NPCs)
 * Smart Trainer - Virtual Cycling
 */

import { createRidePhysics } from './RidePhysics.js';

/**
 * Tipos de bots
 */
export const BOT_TYPES = {
    PACER: 'pacer',         // Mantiene potencia constante
    RIVAL: 'rival',         // Intenta mantenerse ligeramente adelante
    GROUP: 'group',         // Grupo de ciclistas variados
};

/**
 * Crear un bot
 */
export function createBot(options = {}) {
    const {
        id = `bot_${Date.now()}`,
        type = BOT_TYPES.PACER,
        name = 'Bot',
        ftp = 200,           // FTP del bot
        weight = 70,         // Peso en kg
        targetPowerRatio = 0.7, // Ratio de FTP objetivo (para PACER)
        startOffset = 0,     // Distancia inicial respecto al jugador (metros)
        color = '#00aaff',
    } = options;
    
    return {
        id,
        type,
        name,
        ftp,
        weight,
        targetPowerRatio,
        color,
        
        // Estado actual
        distance: startOffset,
        speed: 0,           // m/s
        currentPower: 0,
        
        // Física propia
        physics: createRidePhysics(),
        
        // Visual
        scale: 1,           // Escala visual (1 = cercano, 0 = lejano)
        visible: true,
    };
}

/**
 * Crear sistema de bots
 */
export function createBotSystem(options = {}) {
    const {
        playerFtp = 200,
        playerWeight = 70,
    } = options;
    
    let bots = [];
    
    /**
     * Añadir bot pacer
     */
    function addPacer(powerRatio = 0.7, startOffset = 50) {
        const pacerFtp = playerFtp * (0.9 + Math.random() * 0.2); // ±10% del FTP del jugador
        
        const bot = createBot({
            type: BOT_TYPES.PACER,
            name: `Pacer ${Math.round(powerRatio * 100)}%`,
            ftp: pacerFtp,
            weight: 65 + Math.random() * 20,
            targetPowerRatio: powerRatio,
            startOffset,
            color: getPacerColor(powerRatio),
        });
        
        bots.push(bot);
        return bot;
    }
    
    /**
     * Añadir bot rival
     */
    function addRival(startOffset = 100) {
        const rivalFtp = playerFtp * (1.0 + Math.random() * 0.15); // Ligeramente más fuerte
        
        const bot = createBot({
            type: BOT_TYPES.RIVAL,
            name: 'Rival',
            ftp: rivalFtp,
            weight: 65 + Math.random() * 15,
            targetPowerRatio: 0.85,
            startOffset,
            color: '#ff4444',
        });
        
        bots.push(bot);
        return bot;
    }
    
    /**
     * Añadir grupo de bots
     */
    function addGroup(count = 3, startOffset = 30) {
        const groupBots = [];
        
        for (let i = 0; i < count; i++) {
            const offset = startOffset + (i * 15) - (count * 7.5);
            const powerRatio = 0.6 + Math.random() * 0.4; // 60-100%
            const botFtp = playerFtp * (0.8 + Math.random() * 0.3);
            
            const bot = createBot({
                type: BOT_TYPES.GROUP,
                name: `Ciclista ${i + 1}`,
                ftp: botFtp,
                weight: 60 + Math.random() * 25,
                targetPowerRatio: powerRatio,
                startOffset: offset,
                color: getGroupColor(i),
            });
            
            bots.push(bot);
            groupBots.push(bot);
        }
        
        return groupBots;
    }
    
    /**
     * Actualizar todos los bots
     */
    function update(playerDistance, currentGrade, deltaTime) {
        const dtSeconds = deltaTime / 1000;
        
        for (const bot of bots) {
            // Calcular potencia objetivo según tipo
            let targetPower = bot.ftp * bot.targetPowerRatio;
            
            switch (bot.type) {
                case BOT_TYPES.RIVAL:
                    // El rival intenta mantenerse adelante
                    const distanceDiff = bot.distance - playerDistance;
                    if (distanceDiff < 20) {
                        // Acelerar si está cerca o detrás
                        targetPower = bot.ftp * 0.95;
                    } else if (distanceDiff > 100) {
                        // Reducir si está muy adelante
                        targetPower = bot.ftp * 0.7;
                    }
                    break;
                    
                case BOT_TYPES.GROUP:
                    // Añadir variación aleatoria
                    targetPower *= (0.95 + Math.random() * 0.1);
                    break;
            }
            
            // Simular variación natural de potencia
            const powerVariation = 1 + (Math.sin(Date.now() / 1000 + bot.id.charCodeAt(4)) * 0.05);
            bot.currentPower = Math.round(targetPower * powerVariation);
            
            // Calcular velocidad usando física
            const totalMass = bot.weight + 10; // +10kg de bici
            bot.speed = bot.physics.calculateSimpleVelocity(bot.currentPower, currentGrade, totalMass);
            
            // Actualizar posición
            bot.distance += bot.speed * dtSeconds;
            
            // Calcular escala visual según distancia al jugador
            const relativeDistance = bot.distance - playerDistance;
            bot.scale = calculateBotScale(relativeDistance);
            bot.visible = Math.abs(relativeDistance) < 500; // Visible dentro de 500m
        }
        
        // Ordenar bots por distancia para renderizado correcto
        bots.sort((a, b) => b.distance - a.distance);
        
        return bots;
    }
    
    /**
     * Obtener bots visibles
     */
    function getVisibleBots(playerDistance) {
        return bots.filter(bot => {
            const relativeDistance = bot.distance - playerDistance;
            return Math.abs(relativeDistance) < 500;
        });
    }
    
    /**
     * Obtener bot más cercano adelante
     */
    function getNextBot(playerDistance) {
        const botsAhead = bots.filter(bot => bot.distance > playerDistance);
        if (botsAhead.length === 0) return null;
        return botsAhead.reduce((closest, bot) => 
            (bot.distance < closest.distance) ? bot : closest
        );
    }
    
    /**
     * Obtener bot más cercano detrás
     */
    function getPreviousBot(playerDistance) {
        const botsBehind = bots.filter(bot => bot.distance < playerDistance);
        if (botsBehind.length === 0) return null;
        return botsBehind.reduce((closest, bot) => 
            (bot.distance > closest.distance) ? bot : closest
        );
    }
    
    /**
     * Reiniciar posiciones de bots
     */
    function reset() {
        for (const bot of bots) {
            bot.distance = bot.startOffset || 0;
            bot.speed = 0;
            bot.physics.reset();
        }
    }
    
    /**
     * Limpiar todos los bots
     */
    function clear() {
        bots = [];
    }
    
    /**
     * Obtener todos los bots
     */
    function getBots() {
        return bots;
    }
    
    return {
        addPacer,
        addRival,
        addGroup,
        update,
        getVisibleBots,
        getNextBot,
        getPreviousBot,
        reset,
        clear,
        getBots,
    };
}

/**
 * Calcular escala visual del bot según distancia
 */
function calculateBotScale(relativeDistance) {
    // Distancia negativa = bot detrás (no visible en primera persona)
    if (relativeDistance < 0) {
        return 0;
    }
    
    // Escala basada en distancia (perspectiva)
    // A 10m: escala 1 (cercano)
    // A 200m: escala 0.2 (lejano)
    const minDist = 10;
    const maxDist = 200;
    
    if (relativeDistance <= minDist) return 1;
    if (relativeDistance >= maxDist) return 0.2;
    
    const t = (relativeDistance - minDist) / (maxDist - minDist);
    return 1 - (t * 0.8); // 1 -> 0.2
}

/**
 * Obtener color para pacer según ratio de potencia
 */
function getPacerColor(powerRatio) {
    if (powerRatio < 0.6) return '#00ff00';  // Verde (fácil)
    if (powerRatio < 0.75) return '#00aaff'; // Azul (moderado)
    if (powerRatio < 0.9) return '#ffaa00';  // Naranja (duro)
    return '#ff4444';                         // Rojo (muy duro)
}

/**
 * Obtener color para bot de grupo
 */
function getGroupColor(index) {
    const colors = [
        '#4CAF50', // Verde
        '#2196F3', // Azul
        '#FF9800', // Naranja
        '#9C27B0', // Púrpura
        '#00BCD4', // Cyan
    ];
    return colors[index % colors.length];
}

/**
 * Crear configuración predefinida de bots para cada mundo
 */
export function createBotsForWorld(worldId, playerFtp, playerWeight) {
    const system = createBotSystem({ playerFtp, playerWeight });
    
    switch (worldId) {
        case 'green_valley':
            // Bots tranquilos para recuperación
            system.addPacer(0.5, 30);   // Pacer al 50% FTP
            system.addPacer(0.65, 80);  // Pacer al 65% FTP
            break;
            
        case 'med_coast':
            // Grupo de tempo
            system.addPacer(0.75, 50);
            system.addGroup(3, 100);
            break;
            
        case 'snowy_alps':
            // Rival desafiante
            system.addRival(100);
            system.addPacer(0.85, 200);
            break;
            
        case 'night_volcano':
            // Múltiples rivales para intervalos
            system.addRival(50);
            system.addRival(150);
            break;
            
        case 'future_city':
            // Grupo variado
            system.addGroup(5, 50);
            system.addPacer(0.7, -30);
            break;
            
        default:
            system.addPacer(0.7, 50);
    }
    
    return system;
}
