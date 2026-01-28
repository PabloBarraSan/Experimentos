/**
 * Ride Module - Ciclismo Virtual
 * Smart Trainer
 * 
 * Barrel file para exportar todos los componentes del módulo
 */

// Estado
export { 
    createRideState, 
    resetRideState, 
    updateStats, 
    getCurrentPowerZone, 
    formatTime,
    RIDE_STATUS 
} from './RideState.js';

// Física
export { 
    createRidePhysics, 
    calculateVAM, 
    estimateTime 
} from './RidePhysics.js';

// Generador de rutas
export { 
    createRouteGenerator, 
    ROUTE_CONFIGS, 
    PRESET_ROUTES 
} from './RouteGenerator.js';

// Sistema de bots
export { 
    createBot, 
    createBotSystem, 
    createBotsForWorld, 
    BOT_TYPES 
} from './BotSystem.js';

// Configuración de mundos
export { 
    WORLDS, 
    getWorldConfig, 
    getAvailableWorlds, 
    getSkyColor, 
    hexToRgb, 
    lerpColor 
} from './worlds/WorldConfig.js';

// Motor principal
export { createRideEngine } from './RideEngine.js';

// Renderer
export { createRideRenderer, METRICS_BAR_HEIGHT } from './RideRenderer.js';
