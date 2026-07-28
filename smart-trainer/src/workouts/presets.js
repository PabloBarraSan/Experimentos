/**
 * Workout Presets - Entrenamientos predefinidos
 * Smart Trainer Controller
 */

import { createWorkout, createBlock, BLOCK_TYPES, TARGET_TYPES } from './model.js';

/**
 * Biblioteca de entrenamientos predefinidos
 */
export const WORKOUT_PRESETS = {
    
    // === TESTS ===
    
    FTP_TEST_20: createWorkout({
        name: 'FTP Test 20 minutos',
        description: 'Test de 20 minutos para calcular tu FTP. Tu FTP será aproximadamente el 95% de tu potencia media en los 20 minutos.',
        author: 'Smart Trainer',
        category: 'ftp_test',
        difficulty: 'hard',
        tags: ['test', 'ftp', '20min'],
        blocks: [
            createBlock({
                type: BLOCK_TYPES.WARMUP,
                duration: 10 * 60,
                name: 'Calentamiento',
                targetValue: 50,
                instructions: 'Pedalea suave para calentar los músculos',
            }),
            createBlock({
                type: BLOCK_TYPES.INTERVAL,
                duration: 60,
                name: 'Activación 1',
                targetValue: 100,
                repeat: 3,
                restBetween: 60,
                restTargetValue: 40,
                instructions: 'Activaciones cortas a FTP',
            }),
            createBlock({
                type: BLOCK_TYPES.STEADY,
                duration: 5 * 60,
                name: 'Recuperación',
                targetValue: 40,
                instructions: 'Recupera antes del esfuerzo principal',
            }),
            createBlock({
                type: BLOCK_TYPES.STEADY,
                duration: 20 * 60,
                name: '🔥 TEST 20min',
                targetValue: 100,
                instructions: '¡Da todo lo que puedas durante 20 minutos! Intenta mantener un ritmo constante.',
            }),
            createBlock({
                type: BLOCK_TYPES.COOLDOWN,
                duration: 5 * 60,
                name: 'Enfriamiento',
                targetValue: 40,
                instructions: 'Recupera y baja las pulsaciones',
            }),
        ],
    }),
    
    RAMP_TEST: createWorkout({
        name: 'Ramp Test',
        description: 'Test de rampa progresiva. Empieza fácil y aumenta cada minuto hasta que no puedas más. Tu FTP será aproximadamente el 75% de tu último minuto completado.',
        author: 'Smart Trainer',
        category: 'ftp_test',
        difficulty: 'hard',
        tags: ['test', 'ftp', 'ramp'],
        blocks: [
            createBlock({
                type: BLOCK_TYPES.WARMUP,
                duration: 5 * 60,
                name: 'Calentamiento',
                targetValue: 50,
            }),
            // Rampa de 100W a 500W en escalones de 1 minuto
            ...[100, 115, 130, 145, 160, 175, 190, 205, 220, 235, 250, 265, 280, 295, 310, 325, 340, 355, 370, 385, 400].map((percent, i) => 
                createBlock({
                    type: BLOCK_TYPES.STEADY,
                    duration: 60,
                    name: `Escalón ${i + 1}`,
                    targetType: TARGET_TYPES.POWER_ABSOLUTE,
                    targetValue: percent,
                    instructions: i > 15 ? '¡Aguanta todo lo que puedas!' : '',
                })
            ),
            createBlock({
                type: BLOCK_TYPES.COOLDOWN,
                duration: 5 * 60,
                name: 'Enfriamiento',
                targetValue: 40,
            }),
        ],
    }),
    
    // === INTERVALOS ===
    
    VO2MAX_5x5: createWorkout({
        name: 'VO2max 5x5',
        description: '5 intervalos de 5 minutos al 105-120% del FTP con 5 minutos de recuperación. Excelente para mejorar tu consumo máximo de oxígeno.',
        author: 'Smart Trainer',
        category: 'intervals',
        difficulty: 'hard',
        tags: ['vo2max', 'intervalos', 'alto rendimiento'],
        blocks: [
            createBlock({
                type: BLOCK_TYPES.WARMUP,
                duration: 10 * 60,
                name: 'Calentamiento',
                targetValue: 55,
            }),
            createBlock({
                type: BLOCK_TYPES.INTERVAL,
                duration: 30,
                name: 'Activación',
                targetValue: 120,
                repeat: 2,
                restBetween: 30,
                restTargetValue: 40,
            }),
            createBlock({
                type: BLOCK_TYPES.STEADY,
                duration: 3 * 60,
                name: 'Preparación',
                targetValue: 50,
            }),
            createBlock({
                type: BLOCK_TYPES.INTERVAL,
                duration: 5 * 60,
                name: 'VO2max',
                targetValue: 112,
                repeat: 5,
                restBetween: 5 * 60,
                restTargetValue: 50,
                cadenceMin: 90,
                cadenceMax: 100,
                instructions: 'Mantén una cadencia alta (90-100 rpm)',
            }),
            createBlock({
                type: BLOCK_TYPES.COOLDOWN,
                duration: 10 * 60,
                name: 'Enfriamiento',
                targetValue: 45,
            }),
        ],
    }),
    
    SWEET_SPOT_2x20: createWorkout({
        name: 'Sweet Spot 2x20',
        description: '2 bloques de 20 minutos al 88-94% del FTP. El punto dulce para maximizar adaptaciones con fatiga moderada.',
        author: 'Smart Trainer',
        category: 'intervals',
        difficulty: 'medium',
        tags: ['sweet spot', 'umbral', 'resistencia'],
        blocks: [
            createBlock({
                type: BLOCK_TYPES.WARMUP,
                duration: 10 * 60,
                name: 'Calentamiento',
                targetValue: 55,
            }),
            createBlock({
                type: BLOCK_TYPES.INTERVAL,
                duration: 20 * 60,
                name: 'Sweet Spot',
                targetValue: 90,
                repeat: 2,
                restBetween: 5 * 60,
                restTargetValue: 50,
                cadenceTarget: 85,
                instructions: 'Mantén un esfuerzo sostenido pero controlado',
            }),
            createBlock({
                type: BLOCK_TYPES.COOLDOWN,
                duration: 10 * 60,
                name: 'Enfriamiento',
                targetValue: 45,
            }),
        ],
    }),
    
    THRESHOLD_4x8: createWorkout({
        name: 'Umbral 4x8',
        description: '4 intervalos de 8 minutos al 95-105% del FTP. Perfecto para mejorar tu potencia de umbral.',
        author: 'Smart Trainer',
        category: 'intervals',
        difficulty: 'hard',
        tags: ['umbral', 'ftp', 'intervalos'],
        blocks: [
            createBlock({
                type: BLOCK_TYPES.WARMUP,
                duration: 10 * 60,
                name: 'Calentamiento',
                targetValue: 55,
            }),
            createBlock({
                type: BLOCK_TYPES.INTERVAL,
                duration: 8 * 60,
                name: 'Umbral',
                targetValue: 100,
                repeat: 4,
                restBetween: 4 * 60,
                restTargetValue: 50,
                instructions: 'Esfuerzo sostenido al límite del umbral',
            }),
            createBlock({
                type: BLOCK_TYPES.COOLDOWN,
                duration: 10 * 60,
                name: 'Enfriamiento',
                targetValue: 45,
            }),
        ],
    }),
    
    TABATA: createWorkout({
        name: 'Tabata Clásico',
        description: '8 intervalos de 20 segundos al máximo esfuerzo con 10 segundos de descanso. El entrenamiento HIIT original.',
        author: 'Smart Trainer',
        category: 'intervals',
        difficulty: 'extreme',
        tags: ['tabata', 'hiit', 'corto', 'intenso'],
        blocks: [
            createBlock({
                type: BLOCK_TYPES.WARMUP,
                duration: 10 * 60,
                name: 'Calentamiento',
                targetValue: 55,
            }),
            createBlock({
                type: BLOCK_TYPES.STEADY,
                duration: 3 * 60,
                name: 'Preparación',
                targetValue: 70,
            }),
            createBlock({
                type: BLOCK_TYPES.INTERVAL,
                duration: 20,
                name: 'TABATA',
                targetValue: 170,
                repeat: 8,
                restBetween: 10,
                restTargetValue: 40,
                instructions: '¡TODO AL MÁXIMO!',
            }),
            createBlock({
                type: BLOCK_TYPES.COOLDOWN,
                duration: 10 * 60,
                name: 'Enfriamiento',
                targetValue: 40,
            }),
        ],
    }),
    
    // === RESISTENCIA ===
    
    ENDURANCE_60: createWorkout({
        name: 'Resistencia 1 hora',
        description: 'Sesión de resistencia base de 1 hora. Ideal para construir base aeróbica.',
        author: 'Smart Trainer',
        category: 'endurance',
        difficulty: 'easy',
        tags: ['resistencia', 'base', 'aeróbico', '60min'],
        blocks: [
            createBlock({
                type: BLOCK_TYPES.WARMUP,
                duration: 5 * 60,
                name: 'Calentamiento',
                targetValue: 50,
            }),
            createBlock({
                type: BLOCK_TYPES.STEADY,
                duration: 50 * 60,
                name: 'Resistencia',
                targetValue: 65,
                cadenceTarget: 85,
                instructions: 'Mantén un ritmo cómodo que puedas sostener conversando',
            }),
            createBlock({
                type: BLOCK_TYPES.COOLDOWN,
                duration: 5 * 60,
                name: 'Enfriamiento',
                targetValue: 45,
            }),
        ],
    }),
    
    ENDURANCE_90: createWorkout({
        name: 'Resistencia 90 minutos',
        description: 'Sesión larga de resistencia con variaciones de cadencia.',
        author: 'Smart Trainer',
        category: 'endurance',
        difficulty: 'medium',
        tags: ['resistencia', 'larga', '90min'],
        blocks: [
            createBlock({
                type: BLOCK_TYPES.WARMUP,
                duration: 10 * 60,
                name: 'Calentamiento',
                targetValue: 50,
            }),
            createBlock({
                type: BLOCK_TYPES.STEADY,
                duration: 20 * 60,
                name: 'Resistencia baja cadencia',
                targetValue: 65,
                cadenceTarget: 75,
                instructions: 'Cadencia baja para trabajar fuerza',
            }),
            createBlock({
                type: BLOCK_TYPES.STEADY,
                duration: 20 * 60,
                name: 'Resistencia normal',
                targetValue: 68,
                cadenceTarget: 90,
            }),
            createBlock({
                type: BLOCK_TYPES.STEADY,
                duration: 20 * 60,
                name: 'Resistencia alta cadencia',
                targetValue: 65,
                cadenceTarget: 100,
                instructions: 'Cadencia alta para eficiencia',
            }),
            createBlock({
                type: BLOCK_TYPES.STEADY,
                duration: 15 * 60,
                name: 'Tempo suave',
                targetValue: 75,
            }),
            createBlock({
                type: BLOCK_TYPES.COOLDOWN,
                duration: 5 * 60,
                name: 'Enfriamiento',
                targetValue: 45,
            }),
        ],
    }),
    
    // === RECUPERACIÓN ===
    
    RECOVERY: createWorkout({
        name: 'Recuperación activa',
        description: 'Sesión suave de recuperación activa. Ideal para el día después de un entrenamiento duro.',
        author: 'Smart Trainer',
        category: 'recovery',
        difficulty: 'easy',
        tags: ['recuperación', 'suave', 'activa'],
        blocks: [
            createBlock({
                type: BLOCK_TYPES.WARMUP,
                duration: 5 * 60,
                name: 'Inicio suave',
                targetValue: 40,
            }),
            createBlock({
                type: BLOCK_TYPES.STEADY,
                duration: 25 * 60,
                name: 'Recuperación',
                targetValue: 50,
                cadenceTarget: 90,
                instructions: 'Mantén las piernas sueltas y la respiración tranquila',
            }),
            createBlock({
                type: BLOCK_TYPES.COOLDOWN,
                duration: 5 * 60,
                name: 'Final',
                targetValue: 40,
            }),
        ],
    }),
    
    // === ESPECIALES ===
    
    PYRAMID: createWorkout({
        name: 'Pirámide',
        description: 'Intervalos en forma de pirámide: 1-2-3-4-3-2-1 minutos con descanso igual.',
        author: 'Smart Trainer',
        category: 'intervals',
        difficulty: 'hard',
        tags: ['pirámide', 'intervalos', 'variado'],
        blocks: [
            createBlock({
                type: BLOCK_TYPES.WARMUP,
                duration: 10 * 60,
                name: 'Calentamiento',
                targetValue: 55,
            }),
            ...[1, 2, 3, 4, 3, 2, 1].map((minutes, i) => 
                createBlock({
                    type: BLOCK_TYPES.INTERVAL,
                    duration: minutes * 60,
                    name: `${minutes} min`,
                    targetValue: 105,
                    repeat: 1,
                    restBetween: minutes * 60,
                    restTargetValue: 50,
                })
            ),
            createBlock({
                type: BLOCK_TYPES.COOLDOWN,
                duration: 10 * 60,
                name: 'Enfriamiento',
                targetValue: 45,
            }),
        ],
    }),
};

// Los presets necesitan IDs deterministas para poder recuperar una misión tras
// recargar la PWA y para que la sincronización sea idempotente.
Object.entries(WORKOUT_PRESETS).forEach(([key, workout]) => {
    workout.id = key.toLowerCase();
});

/**
 * Obtener todos los presets como array
 */
export function getAllPresets() {
    return Object.values(WORKOUT_PRESETS);
}

/**
 * Obtener presets por categoría
 */
export function getPresetsByCategory(category) {
    return getAllPresets().filter(w => w.category === category);
}

/**
 * Obtener presets por dificultad
 */
export function getPresetsByDifficulty(difficulty) {
    return getAllPresets().filter(w => w.difficulty === difficulty);
}

/**
 * Obtener presets por duración aproximada
 */
export function getPresetsByDuration(maxMinutes) {
    return getAllPresets().filter(w => (w.stats.totalDuration / 60) <= maxMinutes);
}

/**
 * Buscar presets por nombre o tags
 */
export function searchPresets(query) {
    const q = query.toLowerCase();
    return getAllPresets().filter(w => 
        w.name.toLowerCase().includes(q) ||
        w.description.toLowerCase().includes(q) ||
        w.tags.some(tag => tag.toLowerCase().includes(q))
    );
}

/**
 * Categorías disponibles
 */
export const CATEGORIES = [
    { id: 'ftp_test', name: 'Tests de FTP', icon: '📊' },
    { id: 'intervals', name: 'Intervalos', icon: '⚡' },
    { id: 'endurance', name: 'Resistencia', icon: '🚴' },
    { id: 'recovery', name: 'Recuperación', icon: '🧘' },
    { id: 'custom', name: 'Personalizados', icon: '✏️' },
];

/**
 * Niveles de dificultad
 */
export const DIFFICULTIES = [
    { id: 'easy', name: 'Fácil', color: '#00cc00' },
    { id: 'medium', name: 'Medio', color: '#ffcc00' },
    { id: 'hard', name: 'Difícil', color: '#ff6600' },
    { id: 'extreme', name: 'Extremo', color: '#ff0000' },
];
