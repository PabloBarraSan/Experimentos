/**
 * GameView - Vista del modo videojuego
 * Smart Trainer - Power Rush
 */

import { colors, spacing, typography, baseStyles, borderRadius, premiumCardStyles } from '../utils/theme.js';
import { createElement, div, button, icon } from '../utils/dom.js';
import { createGameEngine } from '../game/GameEngine.js';
import { createGameRenderer } from '../game/GameRenderer.js';
import { GAME_STATUS } from '../game/GameState.js';
import { CONNECTION_STATE } from '../bluetooth/scanner.js';
import { PLAY_BUTTON_TO_ACTION } from '../bluetooth/zwiftPlay.js';


/**
 * Vista del juego Power Rush
 */
export function GameView({ state, onExit }) {
    const { liveData, settings, bluetoothManager, connectionState, zwiftPlayManager } = state;
    const isDemoMode = connectionState !== CONNECTION_STATE.CONNECTED;
    
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

    if (zwiftPlayManager && zwiftPlayManager.isConnected()) {
        const zwiftBadge = createElement('span', {
            text: 'Mando Zwift',
            styles: {
                position: 'absolute',
                top: spacing.sm,
                left: spacing.sm,
                fontSize: '11px',
                color: colors.textMuted,
                backgroundColor: 'rgba(0,0,0,0.4)',
                padding: '4px 8px',
                borderRadius: borderRadius.sm,
                zIndex: '1001',
            },
        });
        container.appendChild(zwiftBadge);
    }

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
        
        // Actualizar datos del rodillo (o simulados si no hay conexión)
        dataUpdateInterval = setInterval(() => {
            if (engine) {
                const bikeData = isDemoMode
                    ? { power: 100, cadence: 80, speed: 25, heartRate: 0 }
                    : {
                        power: liveData.power || 0,
                        cadence: liveData.cadence || 0,
                        speed: liveData.speed || 0,
                        heartRate: liveData.heartRate || 0,
                    };
                engine.updateBikeData(bikeData);

                const gameState = engine.getState();
                // Auto-start solo con rodillo cuando empieza a pedalear
                if (!isDemoMode && gameState.status === GAME_STATUS.MENU && liveData.power > 50) {
                    engine.start();
                }
                // Restart en game over con sprint (solo con rodillo; sin rodillo se usa Espacio)
                if (!isDemoMode && gameState.status === GAME_STATUS.GAME_OVER) {
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

        // Listener para mandos Zwift Play (mismas acciones que teclado)
        const handleZwiftButton = (ev) => {
            if (!engine) return;
            const action = PLAY_BUTTON_TO_ACTION[ev.button];
            if (!action) return;
            const gs = engine.getState();
            if (action === 'jump') {
                if (gs.status === GAME_STATUS.PLAYING && ev.pressed) engine.forceJump();
                else if (gs.status === GAME_STATUS.MENU && ev.pressed) engine.start();
                else if (gs.status === GAME_STATUS.GAME_OVER && ev.pressed) engine.restart();
            } else if (action === 'duck') {
                if (gs.status === GAME_STATUS.PLAYING) engine.forceDuck(ev.pressed);
            } else if (action === 'pause') {
                if (ev.pressed) {
                    if (gs.status === GAME_STATUS.PLAYING) engine.pause();
                    else if (gs.status === GAME_STATUS.PAUSED) engine.resume();
                }
            }
        };
        if (zwiftPlayManager && zwiftPlayManager.isConnected()) {
            zwiftPlayManager.onButton = handleZwiftButton;
        }
        container._zwiftHandler = handleZwiftButton;
    });

    // Limpiar al desmontar
    container.cleanup = () => {
        if (zwiftPlayManager) zwiftPlayManager.onButton = null;
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
            case 'ArrowLeft':
                if (gameState.status === GAME_STATUS.PLAYING) {
                    e.preventDefault();
                    engine.moveLeft();
                }
                break;
            case 'ArrowRight':
                if (gameState.status === GAME_STATUS.PLAYING) {
                    e.preventDefault();
                    engine.moveRight();
                }
                break;
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
