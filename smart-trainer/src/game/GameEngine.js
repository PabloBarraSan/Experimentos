/**
 * GameEngine - Motor principal del juego
 * Smart Trainer - Power Rush
 */

import { createGameState, resetGameState, calculateWorldSpeed, GAME_STATUS } from './GameState.js';
import { updateCyclist } from './entities/Cyclist.js';
import { updateObstacle } from './entities/Obstacle.js';
import { updateCollectible } from './entities/Collectible.js';
import { updateSpawnSystem, cleanupEntities } from './systems/SpawnSystem.js';
import { updatePhysicsSystem, updateComboTimer } from './systems/PhysicsSystem.js';
import { updateScoreSystem, finishGame } from './systems/ScoreSystem.js';

/**
 * Crear instancia del motor del juego
 */
export function createGameEngine(options = {}) {
    const {
        canvas,
        ftp = 200,
        onScoreUpdate = () => {},
        onGameOver = () => {},
        onAchievement = () => {},
    } = options;
    
    // Estado del juego
    let state = createGameState(ftp);
    let lastTimestamp = 0;
    let animationFrameId = null;
    let renderer = null;
    
    // Dimensiones del canvas
    const getCanvasSize = () => ({
        width: canvas.width,
        height: canvas.height,
    });
    
    /**
     * Game loop principal
     */
    function gameLoop(timestamp) {
        const deltaTime = timestamp - lastTimestamp;
        lastTimestamp = timestamp;
        
        if (state.status === GAME_STATUS.PLAYING) {
            update(deltaTime);
        }
        
        render();
        
        animationFrameId = requestAnimationFrame(gameLoop);
    }
    
    /**
     * Actualizar lógica del juego
     */
    function update(deltaTime) {
        const { width, height } = getCanvasSize();
        const groundY = height - 80;
        
        // Actualizar velocidad del mundo según potencia
        state.worldSpeed = calculateWorldSpeed(state.bikeData.power, state.ftp);
        
        // Actualizar posición del mundo
        state.worldPosition += state.worldSpeed;
        
        // Actualizar ciclista
        state.cyclist = updateCyclist(
            state.cyclist,
            state.bikeData,
            state.ftp,
            deltaTime
        );
        
        // Actualizar obstáculos
        for (const obstacle of state.obstacles) {
            updateObstacle(obstacle, state.worldSpeed, deltaTime);
        }
        
        // Actualizar coleccionables
        for (const collectible of state.collectibles) {
            updateCollectible(collectible, state.worldSpeed, deltaTime);
        }
        
        // Sistema de spawn
        updateSpawnSystem(state, width, deltaTime);
        
        // Sistema de física y colisiones
        updatePhysicsSystem(state, groundY, deltaTime);
        
        // Sistema de puntuación
        updateScoreSystem(state, deltaTime);
        
        // Actualizar combo timer
        updateComboTimer(state, deltaTime);
        
        // Limpiar entidades inactivas
        cleanupEntities(state);
        
        // Actualizar screen shake
        if (state.screenShake > 0) {
            state.screenShake -= deltaTime;
        }
        
        // Actualizar flash effect
        if (state.flashEffect) {
            state.flashEffect.duration -= deltaTime;
            if (state.flashEffect.duration <= 0) {
                state.flashEffect = null;
            }
        }
        
        // Notificar cambios de puntuación
        onScoreUpdate({
            score: state.score,
            lives: state.lives,
            combo: state.combo,
            multiplier: state.multiplier,
        });
        
        // Verificar game over
        if (state.status === GAME_STATUS.GAME_OVER) {
            const results = finishGame(state);
            onGameOver(results);
        }
    }
    
    /**
     * Renderizar el juego
     */
    function render() {
        if (renderer) {
            renderer.render(state);
        }
    }
    
    /**
     * Establecer renderer
     */
    function setRenderer(r) {
        renderer = r;
    }
    
    /**
     * Actualizar datos del rodillo
     */
    function updateBikeData(data) {
        state.bikeData = {
            power: data.power || 0,
            cadence: data.cadence || 0,
            speed: data.speed || 0,
            heartRate: data.heartRate || 0,
        };
    }
    
    /**
     * Iniciar juego
     */
    function start() {
        state = resetGameState(state);
        lastTimestamp = performance.now();
        
        if (!animationFrameId) {
            animationFrameId = requestAnimationFrame(gameLoop);
        }
    }
    
    /**
     * Pausar juego
     */
    function pause() {
        if (state.status === GAME_STATUS.PLAYING) {
            state.status = GAME_STATUS.PAUSED;
        }
    }
    
    /**
     * Reanudar juego
     */
    function resume() {
        if (state.status === GAME_STATUS.PAUSED) {
            state.status = GAME_STATUS.PLAYING;
            lastTimestamp = performance.now();
        }
    }
    
    /**
     * Detener juego
     */
    function stop() {
        if (animationFrameId) {
            cancelAnimationFrame(animationFrameId);
            animationFrameId = null;
        }
        state.status = GAME_STATUS.MENU;
    }
    
    /**
     * Reiniciar juego
     */
    function restart() {
        state = resetGameState(state);
        lastTimestamp = performance.now();
    }
    
    /**
     * Obtener estado actual
     */
    function getState() {
        return state;
    }
    
    /**
     * Establecer FTP
     */
    function setFTP(newFTP) {
        state.ftp = newFTP;
    }
    
    /**
     * Forzar salto (para testing o botón manual)
     */
    function forceJump() {
        if (!state.cyclist.isJumping) {
            state.cyclist.isJumping = true;
            state.cyclist.vy = -15;
        }
    }
    
    /**
     * Destruir engine
     */
    function destroy() {
        stop();
        state = null;
        renderer = null;
    }
    
    // API pública
    return {
        start,
        pause,
        resume,
        stop,
        restart,
        updateBikeData,
        setRenderer,
        getState,
        setFTP,
        forceJump,
        destroy,
    };
}
