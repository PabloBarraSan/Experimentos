import { BLOCK_TYPES, calculateWorkoutStats, createBlock } from './model.js';

export const SESSION_DURATION_OPTIONS = [10, 20, 30, 35, 40, 45, 60, 90];

export function getWorkoutDurationOptions(workout) {
    if (!workout?.blocks?.length) return SESSION_DURATION_OPTIONS;
    const baseDuration = calculateWorkoutStats(workout).totalDuration;
    // Un test tiene un protocolo fijo: cambiar su duración invalidaría el resultado.
    if (workout.category === 'ftp_test') return [Math.round(baseDuration / 60)];
    const { protectedDuration, flexibleMinimum } = getDurationBounds(workout, baseDuration);
    const minimumDuration = protectedDuration + flexibleMinimum;
    const options = SESSION_DURATION_OPTIONS.filter((minutes) => minutes * 60 >= minimumDuration);
    const naturalDuration = Math.round(baseDuration / 60);
    if (naturalDuration > 0 && naturalDuration * 60 >= minimumDuration) options.push(naturalDuration);
    return [...new Set(options)].sort((left, right) => left - right);
}

export function getDefaultWorkoutDuration(workout) {
    const options = getWorkoutDurationOptions(workout);
    const baseMinutes = (workout?.stats?.totalDuration || 0) / 60;
    return options.reduce((closest, candidate) => (
        Math.abs(candidate - baseMinutes) < Math.abs(closest - baseMinutes) ? candidate : closest
    ), options[0] || 30);
}

export function buildWorkoutForDuration(template, durationMinutes) {
    if (!template?.blocks?.length || !Number.isFinite(Number(durationMinutes))) return null;
    if (template.category === 'ftp_test') return null;
    const baseId = template.parentWorkoutId || template.id;
    const targetDuration = Math.round(Number(durationMinutes) * 60);
    const baseDuration = calculateWorkoutStats(template).totalDuration;
    const { protectedDuration, flexibleMinimum } = getDurationBounds(template, baseDuration);
    if (targetDuration < protectedDuration + flexibleMinimum) return null;

    const blocks = template.blocks.map((block) => ({ ...block }));
    const flexibleIndices = blocks
        .map((block, index) => (isProtectedBlock(block) ? -1 : index))
        .filter((index) => index >= 0);
    const flexibleRecovery = flexibleIndices.reduce((sum, index) => {
        const block = blocks[index];
        return sum + Math.max(0, Number(block.restBetween) || 0) * Math.max(0, (Number(block.repeat) || 1) - 1);
    }, 0);
    const flexibleWork = targetDuration - protectedDuration - flexibleRecovery;
    const minimumWork = flexibleIndices.reduce((sum, index) => (
        sum + getMinimumBlockDuration(blocks[index], baseDuration) * Math.max(1, Number(blocks[index].repeat) || 1)
    ), 0);
    if (flexibleWork < minimumWork) return null;

    if (targetDuration <= baseDuration) {
        const expandableWork = flexibleIndices.reduce((sum, index) => {
            const repeat = Math.max(1, Number(blocks[index].repeat) || 1);
            return sum + Math.max(0, (Number(blocks[index].duration) || 0) - getMinimumBlockDuration(blocks[index], baseDuration)) * repeat;
        }, 0);
        let remainingWork = Math.max(0, flexibleWork - minimumWork);
        flexibleIndices.forEach((index, position) => {
            const block = blocks[index];
            const repeat = Math.max(1, Number(block.repeat) || 1);
            const minimum = getMinimumBlockDuration(block, baseDuration);
            const available = Math.max(0, (Number(block.duration) || 0) - minimum) * repeat;
            const share = position === flexibleIndices.length - 1
                ? remainingWork
                : (expandableWork > 0 ? Math.floor((flexibleWork - minimumWork) * (available / expandableWork)) : 0);
            block.duration = minimum + Math.floor(share / repeat);
            remainingWork -= Math.max(0, block.duration - minimum) * repeat;
        });
    } else {
        const extraDuration = targetDuration - baseDuration;
        const cooldownIndex = blocks.findIndex((block) => block.type === BLOCK_TYPES.COOLDOWN);
        const addedBlock = createBlock({
            type: BLOCK_TYPES.STEADY,
            duration: extraDuration,
            name: 'Fondo suave adicional',
            targetValue: 55,
            instructions: 'Mantén un ritmo cómodo antes de la vuelta a la calma.',
        });
        blocks.splice(cooldownIndex >= 0 ? cooldownIndex : blocks.length, 0, addedBlock);
    }

    const stats = calculateWorkoutStats({ ...template, blocks });
    if (stats.totalDuration !== targetDuration) {
        const correction = targetDuration - stats.totalDuration;
        const correctionBlock = blocks.find((block) => block.name === 'Fondo suave adicional');
        if (correctionBlock) correctionBlock.duration += correction;
        else {
            const lastFlexible = [...blocks].reverse().find((block) => !isProtectedBlock(block));
            if (!lastFlexible) return null;
            lastFlexible.duration += correction;
        }
    }

    const cleanName = template.name.replace(/\s+[·•-]\s+\d+\s*min(?:utos)?$/i, '');
    const variant = {
        ...template,
        id: `${baseId}--${Number(durationMinutes)}m`,
        parentWorkoutId: baseId,
        durationMinutes: Number(durationMinutes),
        name: `${cleanName} · ${Number(durationMinutes)} min`,
        blocks,
    };
    variant.stats = calculateWorkoutStats(variant);
    return variant.stats.totalDuration === targetDuration ? variant : null;
}

function getDurationBounds(workout, totalDuration) {
    const protectedDuration = workout.blocks.reduce((sum, block) => {
        if (!isProtectedBlock(block)) return sum;
        const repeat = Math.max(1, Number(block.repeat) || 1);
        return sum + (Number(block.duration) || 0) * repeat
            + (Number(block.restBetween) || 0) * Math.max(0, repeat - 1);
    }, 0);
    const flexibleMinimum = workout.blocks.reduce((sum, block) => {
        if (isProtectedBlock(block)) return sum;
        return sum + getMinimumBlockDuration(block, totalDuration) * Math.max(1, Number(block.repeat) || 1)
            + (Number(block.restBetween) || 0) * Math.max(0, (Number(block.repeat) || 1) - 1);
    }, 0);
    return { protectedDuration, flexibleMinimum };
}

function isProtectedBlock(block) {
    if ([BLOCK_TYPES.INTERVAL, BLOCK_TYPES.RAMP].includes(block.type)) return true;
    return block.type === BLOCK_TYPES.STEADY
        && Number(block.targetValue) >= 85
        && Number(block.duration) >= 5 * 60;
}

function getMinimumBlockDuration(block, totalDuration) {
    if ([BLOCK_TYPES.WARMUP, BLOCK_TYPES.COOLDOWN].includes(block.type)) {
        return totalDuration >= 25 * 60 ? 3 * 60 : 60;
    }
    if (block.type === BLOCK_TYPES.REST) return 60;
    return 60;
}
