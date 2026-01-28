/**
 * GameView - Vista del modo videojuego
 * Smart Trainer - Power Rush
 */

import { colors, spacing, typography, baseStyles, borderRadius, premiumCardStyles } from '../utils/theme.js';
import { createElement, div, button, icon } from '../utils/dom.js';
import { createGameEngine } from '../game/GameEngine.js';
import { createGameRenderer, UI_STRIP_HEIGHT } from '../game/GameRenderer.js';
import { GAME_STATUS } from '../game/GameState.js';

const METRICS_BAR_HEIGHT = 50;
const isTouchPrimary = () =>
    window.matchMedia('(pointer: coarse)').matches ||
    ('ontouchstart' in window && window.innerWidth <= 768);

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
        top: spacing.sm,
        right: spacing.sm,
        ...baseStyles.button,
        width: '36px',
        height: '36px',
        minWidth: '36px',
        padding: '0',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(0, 0, 0, 0.4)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        border: `1px solid ${colors.border}80`,
        color: colors.text,
        borderRadius: '50%',
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
            icon('x', 18, colors.text),
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
    
    // Controles en pantalla (franja inferior, encima de la barra de métricas)
    const showTouchControls = isTouchPrimary();
    const controlsContainer = div({
        styles: {
            position: 'absolute',
            bottom: `${METRICS_BAR_HEIGHT}px`,
            left: '0',
            right: '0',
            height: `${UI_STRIP_HEIGHT - METRICS_BAR_HEIGHT}px`,
            display: showTouchControls ? 'flex' : 'none',
            alignItems: 'center',
            justifyContent: 'center',
            gap: spacing.lg,
            zIndex: '1001',
            pointerEvents: 'none',
        },
    });
    
    // Botón de saltar
    const jumpBtn = button({
        styles: {
            width: '56px',
            height: '56px',
            borderRadius: '50%',
            backgroundColor: 'rgba(0, 212, 170, 0.5)',
            backdropFilter: 'blur(10px)',
            WebkitBackdropFilter: 'blur(10px)',
            border: `1px solid rgba(255, 255, 255, 0.35)`,
            color: colors.background,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 2px 12px rgba(0, 212, 170, 0.3)',
            pointerEvents: 'auto',
            userSelect: 'none',
            WebkitUserSelect: 'none',
            transition: 'transform 0.1s, box-shadow 0.1s',
        },
        children: [
            icon('chevronUp', 28, colors.text),
        ],
        attrs: { 
            title: 'Saltar (Espacio)',
            'aria-label': 'Saltar',
        },
        events: {
            touchstart: (e) => {
                e.preventDefault();
                if (engine) {
                    const gameState = engine.getState();
                    if (gameState.status === GAME_STATUS.PLAYING) {
                        engine.forceJump();
                        jumpBtn.style.transform = 'scale(0.9)';
                    }
                }
            },
            touchend: (e) => {
                e.preventDefault();
                jumpBtn.style.transform = 'scale(1)';
            },
            mousedown: (e) => {
                e.preventDefault();
                if (engine) {
                    const gameState = engine.getState();
                    if (gameState.status === GAME_STATUS.PLAYING) {
                        engine.forceJump();
                        jumpBtn.style.transform = 'scale(0.9)';
                    }
                }
            },
            mouseup: () => {
                jumpBtn.style.transform = 'scale(1)';
            },
            mouseleave: () => {
                jumpBtn.style.transform = 'scale(1)';
            },
        },
    });
    
    // Botón de agacharse
    const duckBtn = button({
        styles: {
            width: '56px',
            height: '56px',
            borderRadius: '50%',
            backgroundColor: 'rgba(255, 107, 53, 0.5)',
            backdropFilter: 'blur(10px)',
            WebkitBackdropFilter: 'blur(10px)',
            border: `1px solid rgba(255, 255, 255, 0.35)`,
            color: colors.background,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 2px 12px rgba(255, 107, 53, 0.3)',
            pointerEvents: 'auto',
            userSelect: 'none',
            WebkitUserSelect: 'none',
            transition: 'transform 0.1s, box-shadow 0.1s',
        },
        children: [
            icon('chevronDown', 28, colors.text),
        ],
        attrs: { 
            title: 'Agacharse (S)',
            'aria-label': 'Agacharse',
        },
        events: {
            touchstart: (e) => {
                e.preventDefault();
                if (engine) {
                    const gameState = engine.getState();
                    if (gameState.status === GAME_STATUS.PLAYING) {
                        engine.forceDuck(true);
                        duckBtn.style.transform = 'scale(0.9)';
                    }
                }
            },
            touchend: (e) => {
                e.preventDefault();
                if (engine) {
                    engine.forceDuck(false);
                }
                duckBtn.style.transform = 'scale(1)';
            },
            mousedown: (e) => {
                e.preventDefault();
                if (engine) {
                    const gameState = engine.getState();
                    if (gameState.status === GAME_STATUS.PLAYING) {
                        engine.forceDuck(true);
                        duckBtn.style.transform = 'scale(0.9)';
                    }
                }
            },
            mouseup: () => {
                if (engine) {
                    engine.forceDuck(false);
                }
                duckBtn.style.transform = 'scale(1)';
            },
            mouseleave: () => {
                if (engine) {
                    engine.forceDuck(false);
                }
                duckBtn.style.transform = 'scale(1)';
            },
        },
    });
    
    controlsContainer.appendChild(jumpBtn);
    controlsContainer.appendChild(duckBtn);
    container.appendChild(controlsContainer);
    
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
        // Eliminar event listeners de teclado
        if (handleKeyDown) {
            document.removeEventListener('keydown', handleKeyDown);
        }
        if (handleKeyUp) {
            document.removeEventListener('keyup', handleKeyUp);
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
            case 'ArrowUp':
                // Espacio o flecha arriba para saltar
                if (gameState.status === GAME_STATUS.PLAYING) {
                    e.preventDefault();
                    engine.forceJump();
                } else if (gameState.status === GAME_STATUS.MENU) {
                    engine.start();
                } else if (gameState.status === GAME_STATUS.GAME_OVER) {
                    engine.restart();
                }
                break;
            case 's':
            case 'S':
            case 'ArrowDown':
                // S o flecha abajo para agacharse
                if (gameState.status === GAME_STATUS.PLAYING) {
                    e.preventDefault();
                    engine.forceDuck(true);
                }
                break;
        }
    };
    
    const handleKeyUp = (e) => {
        if (!engine) return;
        
        const gameState = engine.getState();
        
        switch (e.key) {
            case 's':
            case 'S':
            case 'ArrowDown':
                // Dejar de agacharse
                if (gameState.status === GAME_STATUS.PLAYING) {
                    e.preventDefault();
                    engine.forceDuck(false);
                }
                break;
        }
    };
    
    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('keyup', handleKeyUp);
    
    // Guardar referencias para limpieza
    container._keyDownHandler = handleKeyDown;
    container._keyUpHandler = handleKeyUp;
    
    return container;
}

/**
 * Crear botón o card preview para el modo juego.
 * Cuando está deshabilitado: card preview con gradiente + overlay rejilla + "Conecta para desbloquear".
 * Cuando está habilitado: botón con clase card-unlocked para efecto "encendido".
 */
export function GameModeButton({ onClick, disabled = false, className = '' }) {
    if (disabled) {
        // Card preview: overlay de rejilla técnica + contenido
        return div({
            styles: {
                ...premiumCardStyles,
                width: '100%',
                minWidth: '250px',
                padding: spacing.lg,
                position: 'relative',
                overflow: 'hidden',
                cursor: 'not-allowed',
                background: `linear-gradient(145deg, rgba(0, 212, 170, 0.12) 0%, rgba(20, 20, 20, 0.95) 50%, rgba(0, 242, 254, 0.06) 100%)`,
                border: `1px solid ${colors.border}80`,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: spacing.sm,
            },
            children: [
                createElement('div', { className: 'card-grid-overlay' }),
                createElement('span', { text: '🎮', styles: { fontSize: '28px', position: 'relative', zIndex: 1 } }),
                createElement('span', {
                    text: 'Modo Juego',
                    styles: {
                        fontFamily: typography.fontDisplay,
                        fontSize: typography.sizes.md,
                        fontWeight: typography.weights.bold,
                        color: colors.text,
                        position: 'relative',
                        zIndex: 1,
                    },
                }),
                div({
                    styles: {
                        display: 'flex',
                        alignItems: 'center',
                        gap: spacing.xs,
                        fontSize: typography.sizes.xs,
                        color: colors.textMuted,
                        position: 'relative',
                        zIndex: 1,
                    },
                    children: [
                        icon('lock', 14, colors.textMuted),
                        createElement('span', { text: 'Conecta el rodillo para desbloquear' }),
                    ],
                }),
            ],
        });
    }

    const buttonStyles = {
        ...baseStyles.button,
        padding: `${spacing.md} ${spacing.lg}`,
        background: 'linear-gradient(135deg, #00d4aa 0%, #00a88a 100%)',
        color: colors.background,
        fontSize: typography.sizes.md,
        fontWeight: typography.weights.bold,
        gap: spacing.sm,
        boxShadow: '0 4px 15px rgba(0, 212, 170, 0.3)',
        border: 'none',
        cursor: 'pointer',
        minWidth: '250px',
        width: '100%',
        transition: 'transform 0.3s ease, box-shadow 0.3s ease',
    };

    return button({
        className: className || undefined,
        styles: buttonStyles,
        children: [
            createElement('span', { text: '🎮' }),
            createElement('span', { text: 'Modo Juego' }),
        ],
        events: {
            click: onClick,
            mouseenter: (e) => {
                e.target.style.transform = 'scale(1.02)';
                e.target.style.boxShadow = '0 6px 20px rgba(0, 212, 170, 0.4)';
            },
            mouseleave: (e) => {
                e.target.style.transform = 'scale(1)';
                e.target.style.boxShadow = '0 4px 15px rgba(0, 212, 170, 0.3)';
            },
        },
    });
}
