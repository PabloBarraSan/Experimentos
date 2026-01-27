/**
 * GameView - Vista del modo videojuego
 * Smart Trainer - Power Rush
 */

import { colors, spacing, typography, baseStyles, borderRadius } from '../utils/theme.js';
import { createElement, div, button, icon } from '../utils/dom.js';
import { createGameEngine } from '../game/GameEngine.js';
import { createGameRenderer } from '../game/GameRenderer.js';
import { GAME_STATUS } from '../game/GameState.js';

/**
 * Vista del juego Power Rush
 */
export function GameView({ state, onExit }) {
    const { liveData, settings, bluetoothManager } = state;
    
    const containerStyles = {
        position: 'fixed',
        top: '0',
        left: '0',
        width: '100vw',
        height: '100vh',
        backgroundColor: '#000000',
        zIndex: '1000',
    };
    
    const canvasStyles = {
        display: 'block',
        width: '100%',
        height: '100%',
    };
    
    const exitButtonStyles = {
        position: 'absolute',
        top: spacing.md,
        right: spacing.md,
        ...baseStyles.button,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        border: `1px solid ${colors.border}`,
        color: colors.text,
        padding: spacing.sm,
        zIndex: '1001',
    };
    
    // Crear contenedor
    const container = div({ styles: containerStyles });
    
    // Crear canvas
    const canvas = createElement('canvas', { styles: canvasStyles });
    container.appendChild(canvas);
    
    // Botón de salir
    const exitBtn = button({
        styles: exitButtonStyles,
        children: [
            icon('x', 24, colors.text),
        ],
        attrs: { title: 'Salir del juego' },
        events: {
            click: () => {
                if (engine) {
                    engine.destroy();
                }
                if (renderer) {
                    renderer.destroy();
                }
                if (onExit) {
                    onExit();
                }
            },
        },
    });
    container.appendChild(exitBtn);
    
    // Variables del motor
    let engine = null;
    let renderer = null;
    let dataUpdateInterval = null;
    
    // Inicializar cuando el canvas esté en el DOM
    requestAnimationFrame(() => {
        // Ajustar tamaño del canvas
        const rect = container.getBoundingClientRect();
        canvas.width = rect.width;
        canvas.height = rect.height;
        
        // Crear renderer
        renderer = createGameRenderer(canvas);
        
        // Crear motor del juego
        engine = createGameEngine({
            canvas,
            ftp: settings.ftp,
            onScoreUpdate: (data) => {
                // Actualizar UI si es necesario
            },
            onGameOver: (results) => {
                console.log('Game Over:', results);
            },
        });
        
        // Conectar renderer
        engine.setRenderer(renderer);
        
        // Actualizar datos del rodillo continuamente
        dataUpdateInterval = setInterval(() => {
            if (engine) {
                engine.updateBikeData({
                    power: liveData.power || 0,
                    cadence: liveData.cadence || 0,
                    speed: liveData.speed || 0,
                    heartRate: liveData.heartRate || 0,
                });
                
                // Auto-start cuando empieza a pedalear
                const gameState = engine.getState();
                if (gameState.status === GAME_STATUS.MENU && liveData.power > 50) {
                    engine.start();
                }
                
                // Restart en game over con sprint
                if (gameState.status === GAME_STATUS.GAME_OVER) {
                    const powerRatio = liveData.power / settings.ftp;
                    if (powerRatio > 1.2) {
                        engine.restart();
                    }
                }
            }
        }, 50); // 20 FPS para datos
        
        // Iniciar el render loop (el juego empieza en menú)
        engine.start();
        engine.pause(); // Empezar pausado hasta que pedalee
        
        // Mostrar menú inicial
        const gameState = engine.getState();
        gameState.status = GAME_STATUS.MENU;
    });
    
    // Limpiar al desmontar
    container.cleanup = () => {
        if (dataUpdateInterval) {
            clearInterval(dataUpdateInterval);
        }
        if (engine) {
            engine.destroy();
        }
        if (renderer) {
            renderer.destroy();
        }
    };
    
    // Manejar teclas
    const handleKeyDown = (e) => {
        if (!engine) return;
        
        const gameState = engine.getState();
        
        switch (e.key) {
            case 'Escape':
                if (gameState.status === GAME_STATUS.PLAYING) {
                    engine.pause();
                } else if (gameState.status === GAME_STATUS.PAUSED) {
                    engine.resume();
                }
                break;
            case ' ':
                // Espacio para saltar (debug/testing)
                if (gameState.status === GAME_STATUS.PLAYING) {
                    engine.forceJump();
                } else if (gameState.status === GAME_STATUS.MENU) {
                    engine.start();
                } else if (gameState.status === GAME_STATUS.GAME_OVER) {
                    engine.restart();
                }
                break;
        }
    };
    
    document.addEventListener('keydown', handleKeyDown);
    
    // Guardar referencia para limpieza
    container._keyHandler = handleKeyDown;
    
    return container;
}

/**
 * Crear botón para acceder al modo juego
 */
export function GameModeButton({ onClick }) {
    const buttonStyles = {
        ...baseStyles.button,
        padding: `${spacing.md} ${spacing.lg}`,
        backgroundColor: 'linear-gradient(135deg, #00d4aa 0%, #00a88a 100%)',
        background: 'linear-gradient(135deg, #00d4aa 0%, #00a88a 100%)',
        color: colors.background,
        fontSize: typography.sizes.md,
        fontWeight: typography.weights.bold,
        gap: spacing.sm,
        boxShadow: '0 4px 15px rgba(0, 212, 170, 0.3)',
        border: 'none',
    };
    
    return button({
        styles: buttonStyles,
        children: [
            createElement('span', { text: '🎮' }),
            createElement('span', { text: 'Modo Juego' }),
        ],
        events: {
            click: onClick,
            mouseenter: (e) => {
                e.target.style.transform = 'scale(1.05)';
                e.target.style.boxShadow = '0 6px 20px rgba(0, 212, 170, 0.4)';
            },
            mouseleave: (e) => {
                e.target.style.transform = 'scale(1)';
                e.target.style.boxShadow = '0 4px 15px rgba(0, 212, 170, 0.3)';
            },
        },
    });
}
