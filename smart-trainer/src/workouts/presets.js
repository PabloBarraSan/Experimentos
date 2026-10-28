/**
 * Workout Presets - Entrenamientos predefinidos
 * Smart Trainer Controller
 */

import { createWorkout, createBlock, BLOCK_TYPES, TARGET_TYPES } from './model.js';

function withMission(workout, mission) {
    workout.missionId = mission.id;
    workout.missionVersion = mission.version;
    workout.mission = mission;
    return workout;
}

/**
 * Biblioteca de entrenamientos predefinidos
 */
export const WORKOUT_PRESETS = {
    AURORA_EXPEDITION: withMission(createWorkout({
        name: 'Valle de Aurora · 10 min',
        description: 'Una expedición corta para descubrir el valle: sigue al guía, cruza el puerto y termina en la baliza de la cima.',
        author: 'Smart Trainer',
        category: 'endurance',
        difficulty: 'medium',
        tags: ['expedición', '10min', 'aventura', 'flow'],
        blocks: [
            createBlock({
                type: BLOCK_TYPES.WARMUP,
                duration: 2 * 60,
                name: 'Salida del campamento',
                targetValue: 50,
                cadenceTarget: 80,
                instructions: 'Encuentra un pedaleo suave y alcanza al guía.',
            }),
            createBlock({
                type: BLOCK_TYPES.STEADY,
                duration: 2 * 60,
                name: 'Sendero del bosque',
                targetValue: 65,
                cadenceMin: 82,
                cadenceMax: 92,
                instructions: 'Mantén el Flow mientras cruzas el bosque.',
            }),
            createBlock({
                type: BLOCK_TYPES.INTERVAL,
                duration: 60,
                name: 'Ataque al puerto',
                targetValue: 92,
                repeat: 2,
                restBetween: 60,
                restTargetValue: 52,
                cadenceMin: 85,
                cadenceMax: 98,
                instructions: 'Dos impulsos para no perder la rueda del guía.',
            }),
            createBlock({
                type: BLOCK_TYPES.STEADY,
                duration: 2 * 60,
                name: 'Camino de la baliza',
                targetValue: 72,
                cadenceTarget: 88,
                instructions: 'Sostén el ritmo hasta ver la baliza.',
            }),
            createBlock({
                type: BLOCK_TYPES.COOLDOWN,
                duration: 60,
                name: 'Mirador de Aurora',
                targetValue: 45,
                instructions: 'Misión cumplida. Suelta las piernas.',
            }),
        ],
    }), {
        id: 'aurora-10', version: 2, world: 'aurora', title: 'Valle de Aurora',
        terrain: 'Valle · Puerto', objective: 'Alcanza la baliza', quality: 'medium',
        checkpoints: [{ id: 'aurora-gate', progress: 0.48 }, { id: 'aurora-summit', progress: 0.86 }],
        decisions: [{ id: 'aurora-fork', blockType: 'rest', choices: ['safe', 'technical', 'scenic'] }],
        rewards: ['jersey-aurora'], ghostVersion: 2,
    }),

    MIST_FOREST_EXPEDITION: withMission(createWorkout({
        name: 'Bosque de Bruma · 20 min',
        description: 'Tempo, control de cadencia y dos bifurcaciones en un bosque que despierta con tu Flow.',
        author: 'Smart Trainer', category: 'endurance', difficulty: 'medium',
        tags: ['expedición', '20min', 'tempo', 'ghost'],
        blocks: [
            createBlock({ type: BLOCK_TYPES.WARMUP, duration: 240, name: 'Sendero húmedo', targetValue: 48, cadenceTarget: 82 }),
            createBlock({ type: BLOCK_TYPES.STEADY, duration: 240, name: 'Pinos de cristal', targetValue: 72, cadenceTarget: 88 }),
            createBlock({ type: BLOCK_TYPES.REST, duration: 90, name: 'Claro de la niebla', targetValue: 52, cadenceTarget: 82 }),
            createBlock({ type: BLOCK_TYPES.INTERVAL, duration: 120, name: 'Lomas gemelas', targetValue: 88, repeat: 2, restBetween: 60, restTargetValue: 50, cadenceTarget: 90 }),
            createBlock({ type: BLOCK_TYPES.STEADY, duration: 210, name: 'Corazón del bosque', targetValue: 76, cadenceTarget: 88 }),
            createBlock({ type: BLOCK_TYPES.COOLDOWN, duration: 120, name: 'Refugio de Bruma', targetValue: 44, cadenceTarget: 78 }),
        ],
    }), {
        id: 'mist-forest-20', version: 1, world: 'mist', title: 'Bosque de Bruma',
        terrain: 'Bosque · Colinas', objective: 'Cruza la niebla', quality: 'medium',
        checkpoints: [{ id: 'mist-arch', progress: 0.28 }, { id: 'mist-heart', progress: 0.62 }, { id: 'mist-refuge', progress: 0.9 }],
        decisions: [{ id: 'mist-fork-1', blockType: 'rest', occurrence: 1 }, { id: 'mist-fork-2', blockType: 'cooldown', occurrence: 1 }],
        rewards: ['trail-mist'], ghostVersion: 1,
    }),

    NORTHERN_PEAKS_EXPEDITION: withMission(createWorkout({
        name: 'Cumbres del Norte · 30 min',
        description: 'Una ascensión progresiva con checkpoints de precisión y una elección final de riesgo y recompensa.',
        author: 'Smart Trainer', category: 'intervals', difficulty: 'hard',
        tags: ['expedición', '30min', 'climber', 'progresivo'],
        blocks: [
            createBlock({ type: BLOCK_TYPES.WARMUP, duration: 300, name: 'Valle del Norte', targetValue: 45, targetValueEnd: 60, cadenceTarget: 82 }),
            createBlock({ type: BLOCK_TYPES.STEADY, duration: 300, name: 'Ladera abierta', targetValue: 72, cadenceTarget: 86 }),
            createBlock({ type: BLOCK_TYPES.REST, duration: 90, name: 'Fuente de piedra', targetValue: 48, cadenceTarget: 78 }),
            createBlock({ type: BLOCK_TYPES.RAMP, duration: 300, name: 'Paso del viento', targetValue: 70, targetValueEnd: 90, cadenceTarget: 88 }),
            createBlock({ type: BLOCK_TYPES.REST, duration: 90, name: 'Collado seguro', targetValue: 50, cadenceTarget: 80 }),
            createBlock({ type: BLOCK_TYPES.INTERVAL, duration: 150, name: 'Ataques de cumbre', targetValue: 96, repeat: 2, restBetween: 60, restTargetValue: 50, cadenceTarget: 90 }),
            createBlock({ type: BLOCK_TYPES.STEADY, duration: 210, name: 'Arista final', targetValue: 82, cadenceTarget: 88 }),
            createBlock({ type: BLOCK_TYPES.COOLDOWN, duration: 150, name: 'Mirador del Norte', targetValue: 42, cadenceTarget: 76 }),
        ],
    }), {
        id: 'northern-peaks-30', version: 1, world: 'north', title: 'Cumbres del Norte',
        terrain: 'Puerto · Cumbre', objective: 'Conquista la arista', quality: 'high',
        checkpoints: [{ id: 'north-pass', progress: 0.25 }, { id: 'north-wind', progress: 0.52 }, { id: 'north-ridge', progress: 0.76 }, { id: 'north-summit', progress: 0.94 }],
        decisions: [{ id: 'north-fork-1', blockType: 'rest', occurrence: 1 }, { id: 'north-fork-2', blockType: 'rest', occurrence: 2 }],
        rewards: ['bike-north'], ghostVersion: 1,
    }),
    
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
                targetType: TARGET_TYPES.FREE,
                instructions: 'Esfuerzo libre: da todo lo que puedas durante 20 minutos a un ritmo constante. No empieces demasiado fuerte.',
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
                targetType: TARGET_TYPES.POWER_ABSOLUTE,
                targetValue: 100,
                instructions: 'Pedalea suave: los escalones empiezan en 100 W, así que el calentamiento no depende de tu FTP.',
            }),
            // Rampa de 100 W a 400 W en escalones de 1 minuto (+15 W por minuto)
            ...[100, 115, 130, 145, 160, 175, 190, 205, 220, 235, 250, 265, 280, 295, 310, 325, 340, 355, 370, 385, 400].map((watts, i) =>
                createBlock({
                    type: BLOCK_TYPES.STEADY,
                    duration: 60,
                    name: `Escalón ${i + 1}`,
                    targetType: TARGET_TYPES.POWER_ABSOLUTE,
                    targetValue: watts,
                    instructions: i > 15 ? '¡Aguanta todo lo que puedas!' : '',
                })
            ),
            createBlock({
                type: BLOCK_TYPES.COOLDOWN,
                duration: 5 * 60,
                name: 'Enfriamiento',
                targetType: TARGET_TYPES.POWER_ABSOLUTE,
                targetValue: 80,
            }),
        ],
    }),

    FTP_TEST_8: createWorkout({
        name: 'FTP Test 2×8 minutos',
        description: 'Dos esfuerzos máximos de 8 minutos con 10 de recuperación. Tu FTP será aproximadamente el 90% de la mejor media de los dos.',
        author: 'Smart Trainer',
        category: 'ftp_test',
        difficulty: 'hard',
        tags: ['test', 'ftp', '8min'],
        blocks: [
            createBlock({ type: BLOCK_TYPES.WARMUP, duration: 10 * 60, name: 'Calentamiento', targetValue: 50, targetValueEnd: 70, instructions: 'Pedalea suave y sube poco a poco.' }),
            createBlock({ type: BLOCK_TYPES.INTERVAL, duration: 60, name: 'Activación', targetValue: 100, repeat: 3, restBetween: 60, restTargetValue: 45, instructions: 'Tres activaciones de un minuto a tu FTP actual.' }),
            createBlock({ type: BLOCK_TYPES.REST, duration: 5 * 60, name: 'Recuperación', targetValue: 40 }),
            createBlock({ type: BLOCK_TYPES.STEADY, duration: 8 * 60, name: '🔥 Esfuerzo 1 · 8 min', targetType: TARGET_TYPES.FREE, instructions: 'Esfuerzo libre, máximo sostenible durante 8 minutos.' }),
            createBlock({ type: BLOCK_TYPES.REST, duration: 10 * 60, name: 'Recuperación completa', targetValue: 40 }),
            createBlock({ type: BLOCK_TYPES.STEADY, duration: 8 * 60, name: '🔥 Esfuerzo 2 · 8 min', targetType: TARGET_TYPES.FREE, instructions: 'Repite el esfuerzo con el mismo ritmo que el primero.' }),
            createBlock({ type: BLOCK_TYPES.COOLDOWN, duration: 5 * 60, name: 'Enfriamiento', targetValue: 40 }),
        ],
    }),

    CP_TEST_3_12: createWorkout({
        name: 'Potencia crítica 3 + 12',
        description: 'Un esfuerzo máximo de 3 minutos y otro de 12 con 15 de recuperación. Con las dos potencias medias se calcula tu potencia crítica (CP) y tu reserva anaeróbica (W′).',
        author: 'Smart Trainer',
        category: 'ftp_test',
        difficulty: 'extreme',
        tags: ['test', 'cp', 'vo2max', '3-12'],
        blocks: [
            createBlock({ type: BLOCK_TYPES.WARMUP, duration: 10 * 60, name: 'Calentamiento', targetValue: 50, targetValueEnd: 70 }),
            createBlock({ type: BLOCK_TYPES.INTERVAL, duration: 60, name: 'Activación', targetValue: 100, repeat: 2, restBetween: 60, restTargetValue: 45 }),
            createBlock({ type: BLOCK_TYPES.REST, duration: 5 * 60, name: 'Recuperación', targetValue: 40 }),
            createBlock({ type: BLOCK_TYPES.STEADY, duration: 3 * 60, name: '🔥 Esfuerzo 1 · 3 min', targetType: TARGET_TYPES.FREE, instructions: 'Todo lo que tengas durante 3 minutos. Reparte bien: no te quedes sin fuerzas en el minuto 2.' }),
            createBlock({ type: BLOCK_TYPES.REST, duration: 15 * 60, name: 'Recuperación completa', targetValue: 40, instructions: 'Rueda muy suave. Necesitas llegar fresco al segundo esfuerzo.' }),
            createBlock({ type: BLOCK_TYPES.STEADY, duration: 12 * 60, name: '🔥 Esfuerzo 2 · 12 min', targetType: TARGET_TYPES.FREE, instructions: 'Máximo sostenible durante 12 minutos, a ritmo constante.' }),
            createBlock({ type: BLOCK_TYPES.COOLDOWN, duration: 5 * 60, name: 'Enfriamiento', targetValue: 40 }),
        ],
    }),
    
    // === INTERVALOS ===

    VO2MAX_4X4: createWorkout({
        name: 'VO₂max · 4×4',
        description: 'Cuatro esfuerzos de cuatro minutos con recuperación entre repeticiones y calentamiento progresivo.',
        author: 'Smart Trainer',
        category: 'intervals',
        difficulty: 'hard',
        tags: ['vo2max', '4x4', 'intervalos', 'destacado'],
        blocks: [
            createBlock({
                type: BLOCK_TYPES.WARMUP,
                duration: 10 * 60,
                name: 'Calentamiento progresivo',
                targetValue: 55,
                targetValueEnd: 72,
                cadenceTarget: 85,
                instructions: 'Sube la cadencia y deja que las piernas entren en ritmo.',
            }),
            createBlock({
                type: BLOCK_TYPES.INTERVAL,
                duration: 4 * 60,
                name: 'VO₂max · repetición',
                targetValue: 108,
                repeat: 4,
                restBetween: 3 * 60,
                restTargetValue: 50,
                cadenceMin: 90,
                cadenceMax: 100,
                instructions: 'Mantén un esfuerzo fuerte y uniforme en las cuatro repeticiones.',
            }),
            createBlock({
                type: BLOCK_TYPES.COOLDOWN,
                duration: 8 * 60,
                name: 'Vuelta a la calma',
                targetValue: 45,
                instructions: 'Suelta las piernas y baja el pulso poco a poco.',
            }),
        ],
    }),

    VO2MAX_5X3: createWorkout({
        name: 'VO₂max · 5×3',
        description: 'Cinco esfuerzos de tres minutos con tres minutos de recuperación activa.',
        author: 'Smart Trainer',
        category: 'intervals',
        difficulty: 'hard',
        tags: ['vo2max', '5x3', 'intervalos', 'destacado'],
        blocks: [
            createBlock({ type: BLOCK_TYPES.WARMUP, duration: 10 * 60, name: 'Calentamiento progresivo', targetValue: 55, targetValueEnd: 72, cadenceTarget: 85 }),
            createBlock({
                type: BLOCK_TYPES.INTERVAL,
                duration: 3 * 60,
                name: 'VO₂max · repetición',
                targetValue: 112,
                repeat: 5,
                restBetween: 3 * 60,
                restTargetValue: 50,
                cadenceMin: 90,
                cadenceMax: 100,
                instructions: 'Repite el esfuerzo con control; intenta sostener la misma potencia en cada bloque.',
            }),
            createBlock({ type: BLOCK_TYPES.COOLDOWN, duration: 8 * 60, name: 'Vuelta a la calma', targetValue: 45 }),
        ],
    }),

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
    
    SWEET_SPOT_2x15: withMission(createWorkout({
        name: 'Sweet Spot 2x15',
        description: '2 bloques de 15 minutos al 90% del FTP con 5 minutos de recuperación. Estímulo de umbral con menos fatiga que un 2x20; encaja 48 h después de un VO2max.',
        author: 'Smart Trainer',
        category: 'intervals',
        difficulty: 'medium',
        tags: ['expedición', 'sweet spot', 'umbral'],
        blocks: [
            createBlock({
                type: BLOCK_TYPES.WARMUP,
                duration: 12 * 60,
                name: 'Calentamiento',
                targetValue: 55,
                targetValueEnd: 70,
            }),
            createBlock({
                type: BLOCK_TYPES.INTERVAL,
                duration: 15 * 60,
                name: 'Sweet Spot',
                targetValue: 90,
                repeat: 2,
                restBetween: 5 * 60,
                restTargetValue: 50,
                cadenceTarget: 88,
                instructions: 'Esfuerzo sostenido y controlado. Si el primer bloque se te hace muy duro, baja al 85% en el segundo.',
            }),
            createBlock({
                type: BLOCK_TYPES.COOLDOWN,
                duration: 10 * 60,
                name: 'Enfriamiento',
                targetValue: 45,
            }),
        ],
    }), {
        id: 'sweet-spot-2x15', version: 1, world: 'aurora', title: 'Puerto de Aurora',
        terrain: 'Valle · Puerto', objective: 'Sostén el ritmo del puerto', quality: 'medium',
        checkpoints: [{ id: 'ss-start', progress: 0.3 }, { id: 'ss-pass', progress: 0.62 }, { id: 'ss-summit', progress: 0.9 }],
        decisions: [], rewards: [], ghostVersion: 1,
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
    
    SWEET_SPOT_3X8: createWorkout({
        name: 'Sweet Spot 3×8 · Alfa',
        description: 'Tres series de 8 minutos en sweet spot con 4 de recuperación. Pensado para la primera sesión de prueba sin FTP calibrada: cada bloque trae una referencia de esfuerzo (RPE) por si los vatios no cuadran con tus sensaciones.',
        author: 'Smart Trainer',
        category: 'intervals',
        difficulty: 'medium',
        tags: ['sweet spot', 'umbral', 'alfa'],
        blocks: [
            createBlock({
                type: BLOCK_TYPES.RAMP,
                duration: 8 * 60,
                name: 'Calentamiento',
                targetValue: 45,
                targetValueEnd: 65,
                cadenceTarget: 85,
                instructions: 'Empieza muy suave y sube poco a poco. RPE 2 → 4.',
            }),
            createBlock({
                type: BLOCK_TYPES.INTERVAL,
                duration: 40,
                name: 'Activación',
                targetValue: 100,
                cadenceTarget: 95,
                repeat: 3,
                restBetween: 80,
                restTargetValue: 50,
                instructions: 'Tres acelerones cortos para despertar las piernas. RPE 7, sin llegar al límite.',
            }),
            createBlock({
                type: BLOCK_TYPES.REST,
                duration: 2 * 60,
                name: 'Recuperación previa',
                targetValue: 50,
                cadenceTarget: 85,
                instructions: 'Gira suave y respira antes de empezar las series.',
            }),
            createBlock({
                type: BLOCK_TYPES.INTERVAL,
                duration: 8 * 60,
                name: 'Sweet Spot',
                targetValue: 88,
                cadenceTarget: 88,
                repeat: 3,
                restBetween: 4 * 60,
                restTargetValue: 55,
                instructions: 'Duro pero sostenible: RPE 6-7, podrías decir frases cortas. Si no llegas a terminar la serie, baja el objetivo en la siguiente.',
            }),
            createBlock({
                type: BLOCK_TYPES.COOLDOWN,
                duration: 6 * 60,
                name: 'Vuelta a la calma',
                targetValue: 45,
                cadenceTarget: 80,
                instructions: 'Baja pulsaciones y suelta las piernas. RPE 2.',
            }),
        ],
    }),

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

    SWEET_SPOT_POST_CARRERA_52: createWorkout({
        name: 'Sweet spot · 3×8 · 52 min',
        description: 'Sesión para después de correr y antes de pierna: 3 × 8 min al 90 % FTP, justo por debajo del umbral.',
        author: 'Smart Trainer',
        category: 'endurance',
        difficulty: 'medium',
        tags: ['sweet spot', '52min', 'tempo'],
        blocks: [
            createBlock({
                type: BLOCK_TYPES.RAMP,
                duration: 10 * 60,
                name: 'Calentamiento',
                targetValue: 45,
                targetValueEnd: 70,
            }),
            createBlock({
                type: BLOCK_TYPES.INTERVAL,
                duration: 8 * 60,
                name: 'Sweet spot',
                targetValue: 90,
                cadenceMin: 85,
                cadenceMax: 95,
                repeat: 3,
                restBetween: 4 * 60,
                restTargetValue: 55,
            }),
            createBlock({
                type: BLOCK_TYPES.STEADY,
                duration: 5 * 60,
                name: 'Rodaje',
                targetValue: 65,
            }),
            createBlock({
                type: BLOCK_TYPES.COOLDOWN,
                duration: 5 * 60,
                name: 'Vuelta a la calma',
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
