/**
 * RideView - Vista del modo ciclismo virtual
 * Smart Trainer - Virtual Cycling
 */

import { colors, spacing, typography, baseStyles, borderRadius, premiumCardStyles } from '../utils/theme.js';
import { createElement, div, button, icon } from '../utils/dom.js';
import { createRideEngine } from '../ride/RideEngine.js';
import { createRideRenderer3D, METRICS_BAR_HEIGHT } from '../ride/RideRenderer3D.js';
import { RIDE_STATUS } from '../ride/RideState.js';
import { getAvailableWorlds, getWorldConfig } from '../ride/worlds/WorldConfig.js';

/**
 * Vista del ciclismo virtual
 */
export function RideView({ state, onExit, onSimulationUpdate }) {
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
    
    // Overlay para menús
    const menuOverlay = div({
        styles: {
            position: 'absolute',
            top: '0',
            left: '0',
            width: '100%',
            height: '100%',
            display: 'none',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: 'rgba(0, 0, 0, 0.9)',
            zIndex: '1002',
        },
    });
    container.appendChild(menuOverlay);
    
    // Botón de salir
    const exitBtn = button({
        styles: exitButtonStyles,
        children: [
            icon('x', 18, colors.text),
        ],
        attrs: { title: 'Salir' },
        events: {
            click: () => {
                cleanup();
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
    
    /**
     * Mostrar menú de selección de mundo
     */
    function showWorldSelectionMenu() {
        const worlds = getAvailableWorlds();
        
        menuOverlay.innerHTML = '';
        menuOverlay.style.display = 'flex';
        
        const menuContent = div({
            styles: {
                maxWidth: '600px',
                width: '90%',
                padding: spacing.xl,
                textAlign: 'center',
            },
        });
        
        // Título
        menuContent.appendChild(createElement('h2', {
            text: 'Selecciona un Mundo',
            styles: {
                color: colors.primary,
                fontSize: typography.sizes.xxl,
                marginBottom: spacing.lg,
                fontFamily: typography.fontDisplay,
            },
        }));
        
        // Grid de mundos
        const worldsGrid = div({
            styles: {
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
                gap: spacing.md,
                marginBottom: spacing.lg,
            },
        });
        
        worlds.forEach(world => {
            const worldConfig = getWorldConfig(world.id);
            const worldCard = button({
                styles: {
                    ...premiumCardStyles,
                    padding: spacing.md,
                    cursor: 'pointer',
                    border: '1px solid ' + colors.border,
                    background: `linear-gradient(135deg, ${worldConfig.skyColors.top}40, ${worldConfig.skyColors.middle}20)`,
                    transition: 'transform 0.2s, border-color 0.2s',
                },
                children: [
                    createElement('div', {
                        text: world.name,
                        styles: {
                            color: colors.text,
                            fontSize: typography.sizes.md,
                            fontWeight: typography.weights.bold,
                            marginBottom: spacing.xs,
                        },
                    }),
                    createElement('div', {
                        text: world.difficulty,
                        styles: {
                            color: colors.textMuted,
                            fontSize: typography.sizes.sm,
                            marginBottom: spacing.xs,
                        },
                    }),
                    createElement('div', {
                        text: `Zonas Z${world.targetZones.join('-Z')}`,
                        styles: {
                            color: colors.primary,
                            fontSize: typography.sizes.xs,
                        },
                    }),
                ],
                events: {
                    click: () => {
                        engine.selectWorld(world.id);
                        showRouteSelectionMenu();
                    },
                    mouseenter: (e) => {
                        e.currentTarget.style.transform = 'scale(1.02)';
                        e.currentTarget.style.borderColor = colors.primary;
                    },
                    mouseleave: (e) => {
                        e.currentTarget.style.transform = 'scale(1)';
                        e.currentTarget.style.borderColor = colors.border;
                    },
                },
            });
            worldsGrid.appendChild(worldCard);
        });
        
        menuContent.appendChild(worldsGrid);
        menuOverlay.appendChild(menuContent);
    }
    
    /**
     * Mostrar menú de selección de ruta
     */
    function showRouteSelectionMenu() {
        const routes = engine.getAvailableRoutes();
        const engineState = engine.getState();
        const worldConfig = getWorldConfig(engineState.worldId);
        
        menuOverlay.innerHTML = '';
        menuOverlay.style.display = 'flex';
        
        const menuContent = div({
            styles: {
                maxWidth: '600px',
                width: '90%',
                padding: spacing.xl,
                textAlign: 'center',
            },
        });
        
        // Título con nombre del mundo
        menuContent.appendChild(createElement('h2', {
            text: worldConfig.name,
            styles: {
                color: colors.primary,
                fontSize: typography.sizes.xxl,
                marginBottom: spacing.sm,
                fontFamily: typography.fontDisplay,
            },
        }));
        
        menuContent.appendChild(createElement('p', {
            text: 'Selecciona una ruta',
            styles: {
                color: colors.textMuted,
                fontSize: typography.sizes.md,
                marginBottom: spacing.lg,
            },
        }));
        
        // Lista de rutas
        const routesList = div({
            styles: {
                display: 'flex',
                flexDirection: 'column',
                gap: spacing.sm,
                marginBottom: spacing.lg,
            },
        });
        
        routes.forEach(route => {
            const routeBtn = button({
                styles: {
                    ...baseStyles.button,
                    padding: spacing.md,
                    backgroundColor: colors.surface,
                    border: '1px solid ' + colors.border,
                    width: '100%',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    cursor: 'pointer',
                    transition: 'background-color 0.2s, border-color 0.2s',
                },
                children: [
                    div({
                        styles: { textAlign: 'left' },
                        children: [
                            createElement('div', {
                                text: route.name,
                                styles: {
                                    color: colors.text,
                                    fontSize: typography.sizes.md,
                                    fontWeight: typography.weights.semibold,
                                },
                            }),
                            createElement('div', {
                                text: route.description,
                                styles: {
                                    color: colors.textMuted,
                                    fontSize: typography.sizes.sm,
                                },
                            }),
                        ],
                    }),
                    createElement('div', {
                        text: `${(route.length / 1000).toFixed(0)} km`,
                        styles: {
                            color: colors.primary,
                            fontSize: typography.sizes.lg,
                            fontWeight: typography.weights.bold,
                        },
                    }),
                ],
                events: {
                    click: () => {
                        engine.selectRoute(route);
                        startRide();
                    },
                    mouseenter: (e) => {
                        e.currentTarget.style.backgroundColor = colors.surfaceHover;
                        e.currentTarget.style.borderColor = colors.primary;
                    },
                    mouseleave: (e) => {
                        e.currentTarget.style.backgroundColor = colors.surface;
                        e.currentTarget.style.borderColor = colors.border;
                    },
                },
            });
            routesList.appendChild(routeBtn);
        });
        
        menuContent.appendChild(routesList);
        
        // Botón volver
        const backBtn = button({
            styles: {
                ...baseStyles.button,
                backgroundColor: 'transparent',
                color: colors.textMuted,
                border: '1px solid ' + colors.border,
                padding: `${spacing.sm} ${spacing.lg}`,
            },
            children: [
                icon('chevronLeft', 16, colors.textMuted),
                createElement('span', { text: 'Cambiar mundo', styles: { marginLeft: spacing.xs } }),
            ],
            events: {
                click: () => showWorldSelectionMenu(),
            },
        });
        menuContent.appendChild(backBtn);
        
        menuOverlay.appendChild(menuContent);
    }
    
    /**
     * Iniciar el ride
     */
    function startRide() {
        menuOverlay.style.display = 'none';
        engine.start();
    }
    
    /**
     * Limpiar recursos
     */
    function cleanup() {
        if (dataUpdateInterval) {
            clearInterval(dataUpdateInterval);
            dataUpdateInterval = null;
        }
        if (engine) {
            engine.destroy();
            engine = null;
        }
        if (renderer) {
            renderer.destroy();
            renderer = null;
        }
    }
    
    // Inicializar cuando el canvas esté en el DOM
    requestAnimationFrame(() => {
        // Ajustar tamaño del canvas
        const rect = container.getBoundingClientRect();
        canvas.width = rect.width;
        canvas.height = rect.height;
        
        // Crear renderer
        renderer = createRideRenderer3D(canvas);
        
        // Crear motor del ride
        engine = createRideEngine({
            canvas,
            ftp: settings.ftp,
            weight: settings.weight || 70,
            onStateChange: (rideState) => {
                // Manejar cambios de estado
                if (rideState.status === RIDE_STATUS.FINISHED) {
                    // Mostrar resultados y opción de volver
                    setTimeout(() => {
                        if (confirm('¿Quieres hacer otra ruta?')) {
                            showWorldSelectionMenu();
                        } else {
                            cleanup();
                            if (onExit) onExit();
                        }
                    }, 2000);
                }
            },
            onRouteComplete: (results) => {
                console.log('Ruta completada:', results);
            },
            onSimulationUpdate: (params) => {
                // Enviar parámetros de simulación al rodillo
                if (onSimulationUpdate) {
                    onSimulationUpdate(params);
                } else if (bluetoothManager && bluetoothManager.commandQueue) {
                    // Intentar enviar directamente si hay conexión
                    try {
                        bluetoothManager.commandQueue.setIndoorBikeSimulation(
                            params.windSpeed,
                            params.grade,
                            params.crr,
                            params.cw
                        ).catch(err => {
                            // Silenciar errores de simulación
                            console.debug('Error enviando simulación:', err.message);
                        });
                    } catch (err) {
                        // Ignorar si no hay soporte
                    }
                }
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
                
                // Auto-start cuando empieza a pedalear (en menú principal)
                const rideState = engine.getState();
                if (rideState.status === RIDE_STATUS.MENU && liveData.power > 30) {
                    // No auto-start, mostrar selección de mundo
                }
                
                // Reanudar si está pausado y pedalea
                if (rideState.status === RIDE_STATUS.PAUSED && liveData.power > 30) {
                    engine.resume();
                }
            }
        }, 50); // 20 FPS para datos
        
        // Mostrar menú de selección de mundo
        showWorldSelectionMenu();
    });
    
    // Limpiar al desmontar
    container.cleanup = cleanup;
    
    // Manejar teclas
    const handleKeyDown = (e) => {
        if (!engine) return;
        
        const rideState = engine.getState();
        
        switch (e.key) {
            case 'Escape':
                if (rideState.status === RIDE_STATUS.PLAYING) {
                    engine.pause();
                } else if (rideState.status === RIDE_STATUS.PAUSED) {
                    engine.resume();
                }
                break;
            case ' ':
                if (rideState.status === RIDE_STATUS.PAUSED) {
                    engine.resume();
                }
                break;
        }
    };
    
    document.addEventListener('keydown', handleKeyDown);
    
    // Guardar referencia para limpieza
    const originalCleanup = container.cleanup;
    container.cleanup = () => {
        document.removeEventListener('keydown', handleKeyDown);
        originalCleanup();
    };
    
    return container;
}

/**
 * Crear botón/card para acceder al modo ciclismo virtual
 */
export function RideModeButton({ onClick, disabled = false }) {
    if (disabled) {
        return div({
            styles: {
                ...premiumCardStyles,
                width: '100%',
                minWidth: '250px',
                padding: spacing.lg,
                position: 'relative',
                overflow: 'hidden',
                cursor: 'not-allowed',
                background: `linear-gradient(145deg, rgba(0, 150, 255, 0.12) 0%, rgba(20, 20, 20, 0.95) 50%, rgba(0, 200, 150, 0.06) 100%)`,
                border: `1px solid ${colors.border}80`,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: spacing.sm,
            },
            children: [
                createElement('div', { className: 'card-grid-overlay' }),
                createElement('span', { text: '🚴', styles: { fontSize: '28px', position: 'relative', zIndex: 1 } }),
                createElement('span', {
                    text: 'Ciclismo Virtual',
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
        background: 'linear-gradient(135deg, #0088ff 0%, #00d4aa 100%)',
        color: colors.background,
        fontSize: typography.sizes.md,
        fontWeight: typography.weights.bold,
        gap: spacing.sm,
        boxShadow: '0 4px 15px rgba(0, 136, 255, 0.3)',
        border: 'none',
        cursor: 'pointer',
        minWidth: '250px',
        width: '100%',
        transition: 'transform 0.3s ease, box-shadow 0.3s ease',
    };

    return button({
        styles: buttonStyles,
        children: [
            createElement('span', { text: '🚴' }),
            createElement('span', { text: 'Ciclismo Virtual' }),
        ],
        events: {
            click: onClick,
            mouseenter: (e) => {
                e.target.style.transform = 'scale(1.02)';
                e.target.style.boxShadow = '0 6px 20px rgba(0, 136, 255, 0.4)';
            },
            mouseleave: (e) => {
                e.target.style.transform = 'scale(1)';
                e.target.style.boxShadow = '0 4px 15px rgba(0, 136, 255, 0.3)';
            },
        },
    });
}
