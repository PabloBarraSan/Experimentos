/**
 * Convierte el entreno planificado de training-app (estructura neutra en % FTP)
 * al modelo de workout del rodillo.
 */

import { BLOCK_TYPES, TARGET_TYPES, createBlock, createWorkout } from './model.js';

function toBlock(planBlock) {
    const { target = {}, restTarget = null } = planBlock;
    // El reproductor solo interpola las rampas; un calentamiento 45→65 % se modela como rampa.
    const isRamp = Boolean(target.valueEnd) && planBlock.type !== BLOCK_TYPES.RAMP;
    return createBlock({
        type: isRamp ? BLOCK_TYPES.RAMP : planBlock.type,
        name: planBlock.name || '',
        duration: planBlock.durationSec,
        targetType: TARGET_TYPES.POWER_FTP,
        targetValue: target.value,
        targetValueEnd: target.valueEnd ?? null,
        cadenceTarget: planBlock.cadence ?? null,
        repeat: planBlock.repeat || 1,
        restBetween: planBlock.restSec || 0,
        restTargetValue: restTarget?.value ?? 40,
    });
}

/** @param {Object} plan Item `planned` devuelto por GET /api/smart-trainer/plan/today */
export function planToWorkout(plan) {
    const workout = createWorkout({
        name: plan.name,
        description: plan.description || '',
        author: 'training-app',
        blocks: plan.structure.map(toBlock),
        tags: ['plan', plan.sessionType],
        sportType: 'cycling',
        category: 'plan',
    });
    // Mismo id para el mismo entreno del plan: permite recuperar la sesión y enlazarla al subirla.
    workout.id = `plan-${plan.id}`;
    workout.plannedWorkoutId = plan.id;
    return workout;
}

const CACHE_KEY = 'smartTrainer_planWorkout';

/** Guarda el último entreno del plan para poder retomarlo tras recargar o sin conexión. */
export function cachePlanWorkout(workout) {
    try {
        localStorage.setItem(CACHE_KEY, JSON.stringify(workout));
    } catch {
        // Sin espacio o sin localStorage: el plan se vuelve a pedir en la próxima carga.
    }
}

export function getCachedPlanWorkout() {
    try {
        const workout = JSON.parse(localStorage.getItem(CACHE_KEY) || 'null');
        return workout?.blocks?.length ? workout : null;
    } catch {
        return null;
    }
}
