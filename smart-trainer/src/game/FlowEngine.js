const clamp01 = (value) => Math.max(0, Math.min(1, value));

export function calculateInstantFlow({
    power = 0,
    targetPower = null,
    cadence = 0,
    targetCadence = null,
}) {
    if (!Number.isFinite(targetPower) || targetPower <= 0) {
        return { flow: 0, powerScore: 0, cadenceScore: null, powerError: null, cadenceError: null };
    }

    const powerError = power - targetPower;
    const powerTolerance = Math.max(30, targetPower * 0.30);
    const powerScore = clamp01(1 - Math.abs(powerError) / powerTolerance);

    if (!Number.isFinite(targetCadence) || targetCadence <= 0) {
        return { flow: powerScore, powerScore, cadenceScore: null, powerError, cadenceError: null };
    }

    const cadenceError = cadence - targetCadence;
    const cadenceScore = clamp01(1 - Math.abs(cadenceError) / 20);
    return {
        flow: powerScore * 0.8 + cadenceScore * 0.2,
        powerScore,
        cadenceScore,
        powerError,
        cadenceError,
    };
}

export function starsForAdherence(adherence) {
    if (adherence >= 0.90) return 3;
    if (adherence >= 0.75) return 2;
    if (adherence >= 0.50) return 1;
    return 0;
}

export function createFlowTracker({ graceSeconds = 3 } = {}) {
    const state = {
        schemaVersion: 2,
        totalFlow: 0,
        samples: 0,
        combo: 0,
        maxCombo: 0,
        secondsOutside: 0,
        blocks: new Map(),
        ghostTrace: [],
        lastGhostSecond: -5,
        energy: 0,
        checkpoints: [],
        decisions: [],
        status: 'active',
        comboThreshold: 0.75,
    };

    function update(sample) {
        const result = calculateInstantFlow(sample);
        state.totalFlow += result.flow;
        state.samples++;

        if (result.flow >= state.comboThreshold) {
            state.secondsOutside = 0;
            state.combo++;
            state.maxCombo = Math.max(state.maxCombo, state.combo);
        } else {
            state.secondsOutside++;
            if (state.secondsOutside > graceSeconds) state.combo = 0;
        }

        const blockKey = sample.blockId || `block-${sample.blockIndex ?? 0}`;
        const block = state.blocks.get(blockKey) || {
            id: blockKey,
            index: sample.blockIndex ?? 0,
            name: sample.blockName || 'Bloque',
            totalFlow: 0,
            samples: 0,
            powerFlow: 0,
            cadenceFlow: 0,
            cadenceSamples: 0,
        };
        block.totalFlow += result.flow;
        block.samples++;
        block.powerFlow += result.powerScore;
        if (result.cadenceScore !== null) {
            block.cadenceFlow += result.cadenceScore;
            block.cadenceSamples++;
        }
        state.blocks.set(blockKey, block);
        state.energy = Math.min(100, state.energy + result.flow * 1.25);

        const elapsed = Math.max(0, Math.floor(sample.elapsedSeconds || 0));
        if (elapsed - state.lastGhostSecond >= 5) {
            state.ghostTrace.push({
                elapsed,
                progress: Number.isFinite(sample.totalDuration) && sample.totalDuration > 0
                    ? Math.min(1, elapsed / sample.totalDuration)
                    : (state.samples ? state.totalFlow / state.samples : 0),
                flow: result.flow,
            });
            state.lastGhostSecond = elapsed;
        }

        return {
            ...result,
            smoothedFlow: result.flow,
            combo: state.combo,
            maxCombo: state.maxCombo,
            energy: state.energy,
        };
    }

    function addCheckpoint({ id, elapsedSeconds = 0 } = {}) {
        if (!id || state.checkpoints.some((checkpoint) => checkpoint.id === id)) return null;
        const boost = state.energy >= 35;
        const checkpoint = {
            id,
            elapsedSeconds,
            energy: Math.round(state.energy),
            boost,
            multiplier: boost ? 1.1 : 1,
        };
        if (boost) state.energy = Math.max(0, state.energy - 35);
        state.checkpoints.push(checkpoint);
        return checkpoint;
    }

    function chooseRoute({ id, choice = 'safe', automatic = false, elapsedSeconds = 0 } = {}) {
        if (!id || state.decisions.some((decision) => decision.id === id)) return null;
        const allowed = ['safe', 'technical', 'scenic'];
        const decision = {
            id,
            choice: allowed.includes(choice) ? choice : 'safe',
            automatic,
            elapsedSeconds,
        };
        state.decisions.push(decision);
        state.comboThreshold = decision.choice === 'technical' ? 0.82 : decision.choice === 'safe' ? 0.70 : 0.75;
        return decision;
    }

    function setStatus(status) {
        state.status = ['completed', 'abandoned', 'recovered'].includes(status) ? status : 'active';
    }

    function getResult() {
        const adherence = state.samples ? state.totalFlow / state.samples : 0;
        const blocks = [...state.blocks.values()]
            .sort((a, b) => a.index - b.index)
            .map((block) => {
                const blockAdherence = block.samples ? block.totalFlow / block.samples : 0;
                return {
                    id: block.id,
                    index: block.index,
                    name: block.name,
                    adherence: blockAdherence,
                    stars: starsForAdherence(blockAdherence),
                    powerAdherence: block.samples ? block.powerFlow / block.samples : 0,
                    cadenceAdherence: block.cadenceSamples ? block.cadenceFlow / block.cadenceSamples : null,
                    samples: block.samples,
                };
            });
        const totalStars = blocks.reduce((sum, block) => sum + block.stars, 0);
        const prestigeBonus = state.decisions.reduce((sum, decision) => (
            sum + (decision.choice === 'technical' ? 150 : decision.choice === 'scenic' ? 75 : 0)
        ), 0);
        return {
            schemaVersion: 2,
            scoreAlgorithmVersion: 2,
            adherence,
            score: Math.round(adherence * 10000),
            maxCombo: state.maxCombo,
            blocks,
            totalStars,
            ghostTrace: [...state.ghostTrace],
            energy: Math.round(state.energy),
            checkpoints: [...state.checkpoints],
            decisions: [...state.decisions],
            status: state.status,
            prestigeBonus,
        };
    }

    return { update, addCheckpoint, chooseRoute, setStatus, getResult };
}

export function calculateMissionXp({ completed, activeMinutes = 0, totalStars = 0 }) {
    return (completed ? 50 : 0) + Math.min(120, Math.max(0, Math.floor(activeMinutes))) + Math.max(0, totalStars) * 25;
}
