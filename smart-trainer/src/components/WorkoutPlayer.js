/**
 * WorkoutPlayer - Reproductor de entrenamientos estructurados
 * Smart Trainer Controller
 */

import { colors, spacing, typography, baseStyles, borderRadius, transitions } from '../utils/theme.js';
import { createElement, div, button, icon, formatTime } from '../utils/dom.js';
import { expandBlocks, getTargetAtTime, TARGET_TYPES } from '../workouts/model.js';

/**
 * Estado del reproductor
 */
export const PLAYER_STATE = {
    IDLE: 'idle',
    PLAYING: 'playing',
    PAUSED: 'paused',
    FINISHED: 'finished',
};

/**
 * Crear instancia del reproductor de entrenamientos
 */
export function createWorkoutPlayer(options = {}) {
    const {
        workout,
        ftp = 200,
        onTargetChange = () => {},
        onBlockChange = () => {},
        onComplete = () => {},
        onTick = () => {},
    } = options;
    
    let state = PLAYER_STATE.IDLE;
    let expandedBlocks = [];
    let currentBlockIndex = 0;
    let blockElapsedTime = 0;
    let totalElapsedTime = 0;
    let animationFrameId = null;
    let lastTimestamp = null;
    
    // Inicializar bloques expandidos
    if (workout) {
        expandedBlocks = expandBlocks(workout.blocks);
    }
    
    /**
     * Calcular tiempo total del entrenamiento
     */
    function getTotalDuration() {
        return expandedBlocks.reduce((sum, block) => sum + block.duration, 0);
    }
    
    /**
     * Obtener bloque actual
     */
    function getCurrentBlock() {
        return expandedBlocks[currentBlockIndex] || null;
    }
    
    /**
     * Obtener target actual
     */
    function getCurrentTarget() {
        const block = getCurrentBlock();
        if (!block) return null;
        return getTargetAtTime(block, blockElapsedTime, ftp);
    }
    
    /**
     * Iniciar reproducción
     */
    function play() {
        if (state === PLAYER_STATE.PLAYING) return;
        if (expandedBlocks.length === 0) return;
        
        state = PLAYER_STATE.PLAYING;
        lastTimestamp = performance.now();
        
        // Enviar target inicial
        const target = getCurrentTarget();
        if (target) {
            onTargetChange(target);
        }
        onBlockChange(getCurrentBlock(), currentBlockIndex, expandedBlocks.length);
        
        // Iniciar loop de actualización
        tick();
    }
    
    /**
     * Pausar reproducción
     */
    function pause() {
        if (state !== PLAYER_STATE.PLAYING) return;
        
        state = PLAYER_STATE.PAUSED;
        if (animationFrameId) {
            cancelAnimationFrame(animationFrameId);
            animationFrameId = null;
        }
    }
    
    /**
     * Reanudar reproducción
     */
    function resume() {
        if (state !== PLAYER_STATE.PAUSED) return;
        
        state = PLAYER_STATE.PLAYING;
        lastTimestamp = performance.now();
        tick();
    }
    
    /**
     * Detener reproducción
     */
    function stop() {
        state = PLAYER_STATE.IDLE;
        currentBlockIndex = 0;
        blockElapsedTime = 0;
        totalElapsedTime = 0;
        
        if (animationFrameId) {
            cancelAnimationFrame(animationFrameId);
            animationFrameId = null;
        }
    }
    
    /**
     * Saltar a bloque específico
     */
    function skipToBlock(index) {
        if (index < 0 || index >= expandedBlocks.length) return;
        
        // Calcular tiempo total hasta este bloque
        totalElapsedTime = 0;
        for (let i = 0; i < index; i++) {
            totalElapsedTime += expandedBlocks[i].duration;
        }
        
        currentBlockIndex = index;
        blockElapsedTime = 0;
        
        const target = getCurrentTarget();
        if (target) {
            onTargetChange(target);
        }
        onBlockChange(getCurrentBlock(), currentBlockIndex, expandedBlocks.length);
    }
    
    /**
     * Saltar al siguiente bloque
     */
    function nextBlock() {
        skipToBlock(currentBlockIndex + 1);
    }
    
    /**
     * Saltar al bloque anterior
     */
    function previousBlock() {
        skipToBlock(currentBlockIndex - 1);
    }
    
    /**
     * Loop de actualización
     */
    function tick() {
        if (state !== PLAYER_STATE.PLAYING) return;
        
        const now = performance.now();
        const deltaMs = now - lastTimestamp;
        lastTimestamp = now;
        
        // Convertir a segundos
        const deltaSec = deltaMs / 1000;
        
        blockElapsedTime += deltaSec;
        totalElapsedTime += deltaSec;
        
        const currentBlock = getCurrentBlock();
        
        // Verificar si el bloque ha terminado
        if (currentBlock && blockElapsedTime >= currentBlock.duration) {
            currentBlockIndex++;
            blockElapsedTime = 0;
            
            if (currentBlockIndex >= expandedBlocks.length) {
                // Entrenamiento completado
                state = PLAYER_STATE.FINISHED;
                onComplete();
                return;
            }
            
            // Nuevo bloque
            const target = getCurrentTarget();
            if (target) {
                onTargetChange(target);
            }
            onBlockChange(getCurrentBlock(), currentBlockIndex, expandedBlocks.length);
        }
        
        // Notificar tick con datos actuales
        onTick({
            state,
            currentBlockIndex,
            totalBlocks: expandedBlocks.length,
            blockElapsedTime,
            blockDuration: currentBlock?.duration || 0,
            blockRemainingTime: currentBlock ? Math.max(0, currentBlock.duration - blockElapsedTime) : 0,
            totalElapsedTime,
            totalDuration: getTotalDuration(),
            totalRemainingTime: Math.max(0, getTotalDuration() - totalElapsedTime),
            currentTarget: getCurrentTarget(),
            currentBlock: getCurrentBlock(),
        });
        
        // Continuar loop
        animationFrameId = requestAnimationFrame(tick);
    }
    
    /**
     * Obtener estado actual
     */
    function getState() {
        return {
            state,
            currentBlockIndex,
            totalBlocks: expandedBlocks.length,
            blockElapsedTime,
            totalElapsedTime,
            totalDuration: getTotalDuration(),
            currentBlock: getCurrentBlock(),
            currentTarget: getCurrentTarget(),
        };
    }
    
    return {
        play,
        pause,
        resume,
        stop,
        skipToBlock,
        nextBlock,
        previousBlock,
        getState,
        getCurrentTarget,
        getCurrentBlock,
        getTotalDuration,
    };
}

/**
 * Componente visual del reproductor
 */
export function WorkoutPlayerUI({ player, workout, ftp = 200, onSendTarget }) {
    if (!workout) {
        return div({
            styles: {
                ...baseStyles.card,
                padding: spacing.xl,
                textAlign: 'center',
                color: colors.textMuted,
            },
            text: 'No hay entrenamiento seleccionado',
        });
    }
    
    const expandedBlocks = expandBlocks(workout.blocks);
    const playerState = player.getState();
    
    const containerStyles = {
        ...baseStyles.card,
        padding: spacing.lg,
    };
    
    const headerStyles = {
        ...baseStyles.flexBetween,
        marginBottom: spacing.lg,
    };
    
    const titleStyles = {
        fontSize: typography.sizes.lg,
        fontWeight: typography.weights.semibold,
        color: colors.text,
    };
    
    const statsStyles = {
        display: 'flex',
        gap: spacing.lg,
        fontSize: typography.sizes.sm,
        color: colors.textMuted,
    };
    
    // Timeline de bloques
    const timelineStyles = {
        display: 'flex',
        height: '60px',
        gap: '2px',
        marginBottom: spacing.md,
        borderRadius: borderRadius.md,
        overflow: 'hidden',
    };
    
    // Construir UI
    const container = div({ styles: containerStyles });
    
    // Header con nombre y stats
    const header = div({
        styles: headerStyles,
        children: [
            createElement('h3', { text: workout.name, styles: titleStyles }),
            div({
                styles: statsStyles,
                children: [
                    createElement('span', { text: `⏱️ ${workout.stats.totalDurationFormatted}` }),
                    createElement('span', { text: `💪 TSS: ${workout.stats.tss}` }),
                    createElement('span', { text: `📊 IF: ${workout.stats.intensityFactor}` }),
                ],
            }),
        ],
    });
    container.appendChild(header);
    
    // Timeline de bloques
    const totalDuration = player.getTotalDuration();
    const timeline = div({ styles: timelineStyles });
    
    expandedBlocks.forEach((block, index) => {
        const widthPercent = (block.duration / totalDuration) * 100;
        const isActive = index === playerState.currentBlockIndex;
        const isPast = index < playerState.currentBlockIndex;
        
        const blockStyle = {
            flex: `${widthPercent} 0 0`,
            minWidth: '4px',
            backgroundColor: block.color || colors.primary,
            opacity: isPast ? 0.4 : isActive ? 1 : 0.7,
            cursor: 'pointer',
            position: 'relative',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: typography.sizes.xs,
            color: colors.background,
            fontWeight: typography.weights.semibold,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            padding: '0 4px',
            transition: transitions.fast,
        };
        
        if (isActive) {
            blockStyle.boxShadow = `0 0 10px ${block.color || colors.primary}`;
        }
        
        const blockEl = div({
            styles: blockStyle,
            text: widthPercent > 8 ? block.name : '',
            attrs: {
                title: `${block.name}: ${formatTime(block.duration)} @ ${block.targetValue}%`,
            },
            events: {
                click: () => player.skipToBlock(index),
            },
        });
        
        // Indicador de progreso dentro del bloque activo
        if (isActive && playerState.blockElapsedTime > 0) {
            const progressPercent = (playerState.blockElapsedTime / block.duration) * 100;
            const progressBar = div({
                styles: {
                    position: 'absolute',
                    left: '0',
                    top: '0',
                    bottom: '0',
                    width: `${progressPercent}%`,
                    backgroundColor: 'rgba(255,255,255,0.3)',
                    pointerEvents: 'none',
                },
            });
            blockEl.appendChild(progressBar);
        }
        
        timeline.appendChild(blockEl);
    });
    
    container.appendChild(timeline);
    
    // Info del bloque actual
    const currentBlock = player.getCurrentBlock();
    const currentTarget = player.getCurrentTarget();
    
    if (currentBlock) {
        const blockInfoStyles = {
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: spacing.md,
            backgroundColor: colors.surfaceLight,
            borderRadius: borderRadius.md,
            marginBottom: spacing.md,
        };
        
        const blockInfo = div({
            styles: blockInfoStyles,
            children: [
                div({
                    styles: { ...baseStyles.flexColumn, gap: spacing.xs },
                    children: [
                        createElement('span', {
                            text: currentBlock.name,
                            styles: { fontWeight: typography.weights.semibold, color: colors.text },
                        }),
                        createElement('span', {
                            text: currentBlock.instructions || '',
                            styles: { fontSize: typography.sizes.sm, color: colors.textMuted },
                        }),
                    ],
                }),
                div({
                    styles: { textAlign: 'right' },
                    children: [
                        div({
                            styles: {
                                fontSize: typography.sizes.xxl,
                                fontWeight: typography.weights.bold,
                                color: currentBlock.color || colors.primary,
                                fontFamily: typography.fontMono,
                            },
                            text: currentTarget?.power ? `${currentTarget.power}W` : `${currentBlock.targetValue}%`,
                        }),
                        createElement('span', {
                            text: formatTime(Math.max(0, currentBlock.duration - playerState.blockElapsedTime)),
                            styles: { fontSize: typography.sizes.sm, color: colors.textMuted },
                        }),
                    ],
                }),
            ],
        });
        container.appendChild(blockInfo);
    }
    
    // Tiempo total
    const timeInfoStyles = {
        display: 'flex',
        justifyContent: 'space-between',
        marginBottom: spacing.lg,
        fontSize: typography.sizes.sm,
        color: colors.textMuted,
    };
    
    const timeInfo = div({
        styles: timeInfoStyles,
        children: [
            createElement('span', { text: `Transcurrido: ${formatTime(playerState.totalElapsedTime)}` }),
            createElement('span', { text: `Restante: ${formatTime(Math.max(0, totalDuration - playerState.totalElapsedTime))}` }),
        ],
    });
    container.appendChild(timeInfo);
    
    // Controles del reproductor
    const controlsStyles = {
        display: 'flex',
        justifyContent: 'center',
        gap: spacing.md,
    };
    
    const buttonStyles = {
        ...baseStyles.button,
        width: '48px',
        height: '48px',
        borderRadius: borderRadius.full,
        padding: '0',
    };
    
    const controls = div({
        styles: controlsStyles,
        children: [
            button({
                styles: { ...buttonStyles, ...baseStyles.buttonSecondary },
                children: [icon('chevronRight', 24, colors.text)],
                attrs: { style: 'transform: rotate(180deg)' },
                events: { click: () => player.previousBlock() },
            }),
            button({
                styles: {
                    ...buttonStyles,
                    ...baseStyles.buttonPrimary,
                    width: '64px',
                    height: '64px',
                },
                children: [
                    icon(
                        playerState.state === PLAYER_STATE.PLAYING ? 'pause' : 'play',
                        32,
                        colors.background
                    ),
                ],
                events: {
                    click: () => {
                        if (playerState.state === PLAYER_STATE.PLAYING) {
                            player.pause();
                        } else if (playerState.state === PLAYER_STATE.PAUSED) {
                            player.resume();
                        } else {
                            player.play();
                        }
                    },
                },
            }),
            button({
                styles: { ...buttonStyles, ...baseStyles.buttonSecondary },
                children: [icon('chevronRight', 24, colors.text)],
                events: { click: () => player.nextBlock() },
            }),
            button({
                styles: { ...buttonStyles, backgroundColor: colors.error },
                children: [icon('stop', 24, colors.text)],
                events: { click: () => player.stop() },
            }),
        ],
    });
    container.appendChild(controls);
    
    return container;
}
