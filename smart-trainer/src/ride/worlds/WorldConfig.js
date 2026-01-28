/**
 * WorldConfig - Configuración de mundos temáticos
 * Smart Trainer - Virtual Cycling
 */

/**
 * Configuración visual de cada mundo
 */
export const WORLDS = {
    green_valley: {
        id: 'green_valley',
        name: 'Valle Verde',
        description: 'Paisaje tranquilo para recuperación y resistencia base',
        difficulty: 'Fácil',
        targetZones: [1, 2],
        
        // Colores del cielo (gradiente de arriba a abajo)
        skyColors: {
            top: '#87CEEB',      // Azul cielo
            middle: '#E0F4FF',   // Azul muy claro
            horizon: '#98D8AA',  // Verde suave en horizonte
        },
        
        // Colores de la carretera
        roadColors: {
            main: '#555555',
            line: '#FFFFFF',
            edge: '#3D3D3D',
            shoulder: '#8B7355', // Tierra
        },
        
        // Elementos del paisaje
        landscape: {
            // Montañas/colinas en el fondo
            mountains: [
                { color: '#228B22', height: 0.15, offset: 0 },     // Verde oscuro
                { color: '#32CD32', height: 0.12, offset: 0.3 },   // Verde lima
                { color: '#90EE90', height: 0.08, offset: 0.6 },   // Verde claro
            ],
            // Color del suelo
            groundColor: '#7CFC00',
            // Objetos decorativos
            objects: ['tree', 'bush', 'flower', 'fence'],
            // Frecuencia de objetos (0-1)
            objectDensity: 0.6,
        },
        
        // Efectos ambientales
        ambient: {
            fog: false,
            fogColor: null,
            fogDensity: 0,
            particles: ['butterfly', 'bird'],
            particleDensity: 0.3,
        },
        
        // Hora del día simulada
        timeOfDay: 'afternoon',
        
        // Sonidos ambiente (para futuro)
        sounds: ['birds', 'wind_light'],
    },
    
    med_coast: {
        id: 'med_coast',
        name: 'Costa Mediterránea',
        description: 'Colinas costeras para trabajo de tempo y sweet spot',
        difficulty: 'Moderado',
        targetZones: [3, 4],
        
        skyColors: {
            top: '#1E90FF',      // Azul profundo
            middle: '#87CEEB',   // Azul cielo
            horizon: '#FFE4B5',  // Melocotón (reflejo del sol)
        },
        
        roadColors: {
            main: '#4A4A4A',
            line: '#FFFF00',     // Amarillo mediterráneo
            edge: '#2F2F2F',
            shoulder: '#D2B48C', // Arena
        },
        
        landscape: {
            mountains: [
                { color: '#8B4513', height: 0.2, offset: 0 },      // Marrón acantilado
                { color: '#CD853F', height: 0.15, offset: 0.4 },   // Peru
                { color: '#1E90FF', height: 0.05, offset: 0.8 },   // Mar
            ],
            groundColor: '#F5DEB3', // Trigo
            objects: ['palm', 'white_house', 'olive_tree', 'boat'],
            objectDensity: 0.5,
        },
        
        ambient: {
            fog: false,
            fogColor: null,
            fogDensity: 0,
            particles: ['seagull'],
            particleDensity: 0.2,
        },
        
        timeOfDay: 'sunset',
        sounds: ['waves', 'seagulls'],
    },
    
    snowy_alps: {
        id: 'snowy_alps',
        name: 'Alpes Nevados',
        description: 'Ascensos épicos para trabajo de umbral y VO2max',
        difficulty: 'Difícil',
        targetZones: [4, 5],
        
        skyColors: {
            top: '#4169E1',      // Azul real
            middle: '#B0C4DE',   // Azul acero claro
            horizon: '#E6E6FA',  // Lavanda (niebla)
        },
        
        roadColors: {
            main: '#3D3D3D',
            line: '#FF6600',     // Naranja (quitanieves)
            edge: '#1F1F1F',
            shoulder: '#DCDCDC', // Nieve
        },
        
        landscape: {
            mountains: [
                { color: '#2F4F4F', height: 0.35, offset: 0 },     // Gris pizarra oscuro
                { color: '#708090', height: 0.3, offset: 0.2 },    // Gris pizarra
                { color: '#FFFFFF', height: 0.25, offset: 0.4, snow: true }, // Picos nevados
            ],
            groundColor: '#F0FFF0', // Blanco verdoso
            objects: ['pine_tree', 'snow_pile', 'chalet', 'ski_lift'],
            objectDensity: 0.4,
        },
        
        ambient: {
            fog: true,
            fogColor: '#E6E6FA',
            fogDensity: 0.3,
            particles: ['snowflake'],
            particleDensity: 0.5,
        },
        
        timeOfDay: 'morning',
        sounds: ['wind_strong', 'eagles'],
    },
    
    night_volcano: {
        id: 'night_volcano',
        name: 'Volcán Nocturno',
        description: 'Rampas explosivas para intervalos y sprints',
        difficulty: 'Extremo',
        targetZones: [5, 6],
        
        skyColors: {
            top: '#0D0D0D',      // Negro
            middle: '#1A0A0A',   // Rojo muy oscuro
            horizon: '#FF4500',  // Naranja rojo (resplandor lava)
        },
        
        roadColors: {
            main: '#1A1A1A',
            line: '#FF0000',     // Rojo
            edge: '#0D0D0D',
            shoulder: '#2F1F1F', // Roca volcánica
        },
        
        landscape: {
            mountains: [
                { color: '#0D0D0D', height: 0.4, offset: 0 },      // Negro volcán
                { color: '#8B0000', height: 0.25, offset: 0.3 },   // Rojo oscuro
                { color: '#FF4500', height: 0.1, offset: 0.6, glow: true }, // Lava
            ],
            groundColor: '#1A1010', // Negro rojizo
            objects: ['lava_rock', 'steam_vent', 'lava_flow'],
            objectDensity: 0.3,
        },
        
        ambient: {
            fog: true,
            fogColor: '#1A0505',
            fogDensity: 0.2,
            particles: ['ember', 'ash'],
            particleDensity: 0.7,
        },
        
        timeOfDay: 'night',
        sounds: ['rumble', 'lava_bubbles'],
    },
    
    future_city: {
        id: 'future_city',
        name: 'Ciudad Futurista',
        description: 'Terreno variado para entrenamiento tipo fartlek',
        difficulty: 'Variable',
        targetZones: [2, 3, 4, 5],
        
        skyColors: {
            top: '#0A0A20',      // Azul muy oscuro
            middle: '#1A1A3A',   // Azul noche
            horizon: '#00FFFF',  // Cyan (neón)
        },
        
        roadColors: {
            main: '#1F1F2F',
            line: '#00FFFF',     // Cyan neón
            edge: '#0F0F1F',
            shoulder: '#2A2A4A', // Púrpura oscuro
        },
        
        landscape: {
            mountains: [
                { color: '#1A1A3A', height: 0.5, offset: 0 },      // Rascacielos
                { color: '#2A2A5A', height: 0.4, offset: 0.2 },    // Edificios
                { color: '#00FFFF', height: 0.02, offset: 0, glow: true }, // Líneas neón
            ],
            groundColor: '#15152A', // Púrpura muy oscuro
            objects: ['neon_sign', 'hologram', 'flying_car', 'robot'],
            objectDensity: 0.7,
        },
        
        ambient: {
            fog: true,
            fogColor: '#1A1A3A',
            fogDensity: 0.15,
            particles: ['neon_spark', 'drone'],
            particleDensity: 0.4,
        },
        
        timeOfDay: 'night',
        sounds: ['synth_ambient', 'traffic_futuristic'],
    },
};

/**
 * Obtener configuración de mundo
 */
export function getWorldConfig(worldId) {
    return WORLDS[worldId] || WORLDS.green_valley;
}

/**
 * Obtener lista de mundos disponibles
 */
export function getAvailableWorlds() {
    return Object.values(WORLDS).map(world => ({
        id: world.id,
        name: world.name,
        description: world.description,
        difficulty: world.difficulty,
        targetZones: world.targetZones,
    }));
}

/**
 * Obtener color de cielo interpolado según altura
 * @param {object} world - Configuración del mundo
 * @param {number} y - Posición vertical normalizada (0 = arriba, 1 = abajo)
 */
export function getSkyColor(world, y) {
    const { skyColors } = world;
    
    if (y < 0.4) {
        return skyColors.top;
    } else if (y < 0.7) {
        return skyColors.middle;
    } else {
        return skyColors.horizon;
    }
}

/**
 * Parsear color hex a RGB
 */
export function hexToRgb(hex) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16),
    } : { r: 0, g: 0, b: 0 };
}

/**
 * Interpolar entre dos colores
 */
export function lerpColor(color1, color2, t) {
    const c1 = hexToRgb(color1);
    const c2 = hexToRgb(color2);
    
    const r = Math.round(c1.r + (c2.r - c1.r) * t);
    const g = Math.round(c1.g + (c2.g - c1.g) * t);
    const b = Math.round(c1.b + (c2.b - c1.b) * t);
    
    return `rgb(${r}, ${g}, ${b})`;
}
