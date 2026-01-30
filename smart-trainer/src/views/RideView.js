/**
 * RideView - Vista del modo ciclismo virtual
 * Smart Trainer - Virtual Cycling
 */

import { colors, spacing, typography, baseStyles, borderRadius, premiumCardStyles, getZoneColor } from '../utils/theme.js';
import { createElement, div, button, icon, formatTime, formatDistance } from '../utils/dom.js';
import { createRideEngine } from '../ride/RideEngine.js';
import { createRideRenderer3D, METRICS_BAR_HEIGHT } from '../ride/RideRenderer3D.js';
import { RIDE_STATUS, formatTime as formatTimeMs } from '../ride/RideState.js';
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
    
    // HUD de métricas (overlay sobre el canvas)
    const hudOverlay = div({
        styles: {
            position: 'absolute',
            top: '0',
            left: '0',
            width: '100%',
            height: '100%',
            pointerEvents: 'none',
            display: 'none',
            zIndex: '1001',
            padding: 'env(safe-area-inset-top, 8px) env(safe-area-inset-right, 8px) env(safe-area-inset-bottom, 8px) env(safe-area-inset-left, 8px)',
            boxSizing: 'border-box',
        },
    });
    container.appendChild(hudOverlay);
    
    // Contenedor superior - POTENCIA (protagonista) + métricas secundarias
    const hudTop = div({
        styles: {
            position: 'absolute',
            top: 'max(8px, env(safe-area-inset-top, 8px))',
            left: '8px',
            right: '8px',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'flex-start',
            gap: '8px',
            flexWrap: 'wrap',
            pointerEvents: 'none',
        },
    });
    hudOverlay.appendChild(hudTop);
    
    // Contenedor inferior izquierdo (distancia, tiempo)
    const hudBottomLeft = div({
        styles: {
            position: 'absolute',
            bottom: 'max(12px, env(safe-area-inset-bottom, 12px))',
            left: 'max(8px, env(safe-area-inset-left, 8px))',
            display: 'flex',
            flexDirection: 'row',
            gap: '6px',
            pointerEvents: 'none',
        },
    });
    hudOverlay.appendChild(hudBottomLeft);
    
    // Contenedor inferior derecho (pendiente, elevación)
    const hudBottomRight = div({
        styles: {
            position: 'absolute',
            bottom: 'max(12px, env(safe-area-inset-bottom, 12px))',
            right: 'max(8px, env(safe-area-inset-right, 8px))',
            display: 'flex',
            flexDirection: 'row',
            gap: '6px',
            alignItems: 'flex-end',
            pointerEvents: 'none',
        },
    });
    hudOverlay.appendChild(hudBottomRight);
    
    /**
     * Crear tarjeta de métrica para el HUD - Responsiva
     */
    function createHudMetric(label, value, unit, iconName, accentColor, priority = 'secondary') {
        // Prioridades: 'primary' (potencia), 'secondary' (velocidad, cadencia), 'tertiary' (resto)
        const configs = {
            primary: { 
                padding: '10px 16px',
                valueFontSize: 'clamp(32px, 8vw, 48px)',
                labelFontSize: '11px',
                minWidth: '100px',
                iconSize: 16,
            },
            secondary: { 
                padding: '6px 10px',
                valueFontSize: 'clamp(18px, 4vw, 24px)',
                labelFontSize: '9px',
                minWidth: '60px',
                iconSize: 12,
            },
            tertiary: { 
                padding: '4px 8px',
                valueFontSize: 'clamp(14px, 3vw, 18px)',
                labelFontSize: '8px',
                minWidth: '50px',
                iconSize: 10,
            },
        };
        const c = configs[priority] || configs.secondary;
        
        const card = div({
            styles: {
                backgroundColor: priority === 'primary' ? 'rgba(0, 0, 0, 0.75)' : 'rgba(0, 0, 0, 0.5)',
                backdropFilter: 'blur(8px)',
                WebkitBackdropFilter: 'blur(8px)',
                borderRadius: priority === 'primary' ? '12px' : '8px',
                padding: c.padding,
                minWidth: c.minWidth,
                textAlign: 'center',
                borderLeft: accentColor ? `3px solid ${accentColor}` : 'none',
                boxShadow: priority === 'primary' ? '0 4px 12px rgba(0,0,0,0.3)' : 'none',
            },
        });
        
        // Label con icono (oculto en móvil para métricas terciarias)
        const labelRow = div({
            styles: {
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '3px',
                marginBottom: '2px',
            },
        });
        
        if (iconName) {
            labelRow.appendChild(icon(iconName, c.iconSize, colors.textMuted));
        }
        
        labelRow.appendChild(createElement('span', {
            text: label,
            styles: {
                fontSize: c.labelFontSize,
                color: colors.textMuted,
                textTransform: 'uppercase',
                letterSpacing: '0.3px',
                whiteSpace: 'nowrap',
            },
        }));
        
        card.appendChild(labelRow);
        
        // Valor + unidad
        const valueRow = div({
            styles: {
                display: 'flex',
                alignItems: 'baseline',
                justifyContent: 'center',
                gap: '2px',
            },
        });
        
        valueRow.appendChild(createElement('span', {
            text: String(value),
            styles: {
                fontSize: c.valueFontSize,
                fontWeight: typography.weights.bold,
                color: colors.text,
                fontFamily: typography.fontMono,
                lineHeight: '1',
            },
            attrs: { 'data-value': 'true' },
        }));
        
        if (unit) {
            valueRow.appendChild(createElement('span', {
                text: unit,
                styles: {
                    fontSize: priority === 'primary' ? '14px' : '10px',
                    color: colors.textMuted,
                    marginLeft: '2px',
                },
            }));
        }
        
        card.appendChild(valueRow);
        
        return card;
    }
    
    // Elementos del HUD (referencias para actualizar)
    let hudElements = {
        power: null,
        speed: null,
        heartRate: null,
        distance: null,
        time: null,
        grade: null,
        elevation: null,
    };
    
    /**
     * Inicializar HUD - Jerarquía: Potencia > Velocidad/Cadencia > Resto
     */
    function initHud() {
        hudTop.innerHTML = '';
        hudBottomLeft.innerHTML = '';
        hudBottomRight.innerHTML = '';
        
        // POTENCIA - Métrica principal (protagonista)
        hudElements.power = createHudMetric('Potencia', '0', 'W', 'zap', colors.primary, 'primary');
        hudTop.appendChild(hudElements.power);
        
        // Velocidad - Secundaria
        hudElements.speed = createHudMetric('Velocidad', '0.0', 'km/h', 'speedometer', colors.secondary, 'secondary');
        hudTop.appendChild(hudElements.speed);
        
        // Frecuencia cardíaca - Secundaria
        hudElements.heartRate = createHudMetric('FC', '--', 'bpm', 'heart', colors.error, 'secondary');
        hudTop.appendChild(hudElements.heartRate);
        
        // Distancia - Terciaria (esquina inferior izquierda)
        hudElements.distance = createHudMetric('Dist', '0.00', 'km', 'route', null, 'tertiary');
        hudBottomLeft.appendChild(hudElements.distance);
        
        // Tiempo - Terciaria
        hudElements.time = createHudMetric('Tiempo', '00:00', '', 'clock', null, 'tertiary');
        hudBottomLeft.appendChild(hudElements.time);
        
        // Pendiente - Terciaria
        hudElements.grade = createHudMetric('Pend', '0.0', '%', 'chevronUp', null, 'tertiary');
        hudBottomRight.appendChild(hudElements.grade);
        
        // Elevación - Terciaria
        hudElements.elevation = createHudMetric('Elev', '0', 'm', null, null, 'tertiary');
        hudBottomRight.appendChild(hudElements.elevation);
    }
    
    /**
     * Actualizar valor de un elemento del HUD
     */
    function updateHudValue(element, value, accentColor = null) {
        if (!element) return;
        const valueEl = element.querySelector('[data-value]');
        if (valueEl) {
            valueEl.textContent = String(value);
        }
        if (accentColor) {
            element.style.borderLeftColor = accentColor;
        }
    }
    
    /**
     * Actualizar HUD con el estado del ride
     */
    function updateHud(rideState) {
        const { bikeData, position, currentGrade, elapsedTime, ftp } = rideState;
        
        // Potencia con color de zona
        const zoneColor = getZoneColor(bikeData.power, ftp);
        updateHudValue(hudElements.power, bikeData.power || 0, zoneColor);
        
        // Velocidad
        updateHudValue(hudElements.speed, position.virtualSpeed?.toFixed(1) || '0.0');
        
        // Frecuencia cardíaca
        updateHudValue(hudElements.heartRate, bikeData.heartRate || '--');
        
        // Distancia (metros a km)
        const distanceKm = (position.distance / 1000).toFixed(2);
        updateHudValue(hudElements.distance, distanceKm);
        
        // Tiempo (ms a mm:ss)
        const totalSeconds = Math.floor(elapsedTime / 1000);
        const minutes = Math.floor(totalSeconds / 60);
        const seconds = totalSeconds % 60;
        const timeStr = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        updateHudValue(hudElements.time, timeStr);
        
        // Pendiente (con color según subida/bajada)
        const gradeColor = currentGrade > 0 ? colors.error : (currentGrade < 0 ? colors.success : colors.textMuted);
        updateHudValue(hudElements.grade, currentGrade?.toFixed(1) || '0.0', gradeColor);
        
        // Elevación
        updateHudValue(hudElements.elevation, Math.round(position.elevation || 0));
    }
    
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
                        // Mostrar indicador de carga
                        showLoadingIndicator(`Generando ${route.name}...`);
                        
                        // Dar tiempo para que se renderice el indicador antes de generar la ruta
                        setTimeout(() => {
                            engine.selectRoute(route);
                            startRide();
                        }, 100);
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
     * Mostrar indicador de carga
     */
    function showLoadingIndicator(message = 'Generando ruta...') {
        menuOverlay.innerHTML = '';
        menuOverlay.style.display = 'flex';
        
        const loadingContent = div({
            styles: {
                textAlign: 'center',
                padding: spacing.xl,
            },
            children: [
                // Spinner animado
                div({
                    styles: {
                        width: '50px',
                        height: '50px',
                        border: `4px solid ${colors.border}`,
                        borderTop: `4px solid ${colors.primary}`,
                        borderRadius: '50%',
                        animation: 'spin 1s linear infinite',
                        margin: '0 auto',
                        marginBottom: spacing.lg,
                    },
                }),
                createElement('p', {
                    text: message,
                    styles: {
                        color: colors.text,
                        fontSize: typography.sizes.lg,
                    },
                }),
            ],
        });
        
        menuOverlay.appendChild(loadingContent);
    }
    
    /**
     * Iniciar el ride
     */
    function startRide() {
        menuOverlay.style.display = 'none';
        hudOverlay.style.display = 'block';
        initHud();
        engine.start();
    }
    
    /**
     * Mostrar modal de resultados al finalizar
     */
    function showFinishModal(rideState) {
        menuOverlay.innerHTML = '';
        menuOverlay.style.display = 'flex';
        
        const { stats, position, elapsedTime } = rideState;
        
        // Formatear tiempo
        const totalSeconds = Math.floor(elapsedTime / 1000);
        const minutes = Math.floor(totalSeconds / 60);
        const seconds = totalSeconds % 60;
        const timeStr = `${minutes}:${seconds.toString().padStart(2, '0')}`;
        
        // Formatear distancia
        const distanceKm = (position.distance / 1000).toFixed(2);
        
        const modalContent = div({
            styles: {
                ...premiumCardStyles,
                maxWidth: '450px',
                width: '90%',
                padding: spacing.xl,
                textAlign: 'center',
                borderRadius: borderRadius.xl,
            },
        });
        
        // Título
        modalContent.appendChild(createElement('h2', {
            text: '🎉 Ruta Completada',
            styles: {
                color: colors.primary,
                fontSize: typography.sizes.xxl,
                marginBottom: spacing.lg,
                fontFamily: typography.fontDisplay,
            },
        }));
        
        // Grid de estadísticas
        const statsGrid = div({
            styles: {
                display: 'grid',
                gridTemplateColumns: 'repeat(2, 1fr)',
                gap: spacing.md,
                marginBottom: spacing.xl,
            },
        });
        
        const statItems = [
            { label: 'Distancia', value: distanceKm, unit: 'km', icon: 'route' },
            { label: 'Tiempo', value: timeStr, unit: '', icon: 'clock' },
            { label: 'Potencia media', value: stats.avgPower || 0, unit: 'W', icon: 'zap' },
            { label: 'Potencia máx', value: stats.maxPower || 0, unit: 'W', icon: 'zap' },
            { label: 'Velocidad media', value: stats.avgSpeed || '0.0', unit: 'km/h', icon: 'speedometer' },
            { label: 'Ascenso total', value: Math.round(stats.totalAscent || 0), unit: 'm', icon: 'chevronUp' },
        ];
        
        statItems.forEach(item => {
            const statCard = div({
                styles: {
                    backgroundColor: colors.surface,
                    borderRadius: borderRadius.md,
                    padding: spacing.md,
                    textAlign: 'center',
                },
                children: [
                    div({
                        styles: {
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: spacing.xs,
                            marginBottom: spacing.xs,
                        },
                        children: [
                            icon(item.icon, 14, colors.textMuted),
                            createElement('span', {
                                text: item.label,
                                styles: { fontSize: typography.sizes.xs, color: colors.textMuted },
                            }),
                        ],
                    }),
                    div({
                        styles: { display: 'flex', alignItems: 'baseline', justifyContent: 'center', gap: '4px' },
                        children: [
                            createElement('span', {
                                text: String(item.value),
                                styles: {
                                    fontSize: typography.sizes.xl,
                                    fontWeight: typography.weights.bold,
                                    color: colors.text,
                                    fontFamily: typography.fontMono,
                                },
                            }),
                            item.unit ? createElement('span', {
                                text: item.unit,
                                styles: { fontSize: typography.sizes.sm, color: colors.textMuted },
                            }) : null,
                        ].filter(Boolean),
                    }),
                ],
            });
            statsGrid.appendChild(statCard);
        });
        
        modalContent.appendChild(statsGrid);
        
        // Botones de acción
        const buttonsContainer = div({
            styles: {
                display: 'flex',
                gap: spacing.md,
                justifyContent: 'center',
            },
        });
        
        // Botón para nueva ruta
        const newRouteBtn = button({
            styles: {
                ...baseStyles.button,
                backgroundColor: colors.primary,
                color: colors.background,
                padding: `${spacing.md} ${spacing.xl}`,
                fontWeight: typography.weights.bold,
            },
            children: [
                icon('refresh', 18, colors.background),
                createElement('span', { text: 'Nueva Ruta', styles: { marginLeft: spacing.sm } }),
            ],
            events: {
                click: () => {
                    showWorldSelectionMenu();
                },
            },
        });
        buttonsContainer.appendChild(newRouteBtn);
        
        // Botón para salir
        const exitBtnModal = button({
            styles: {
                ...baseStyles.button,
                backgroundColor: 'transparent',
                color: colors.textMuted,
                border: `1px solid ${colors.border}`,
                padding: `${spacing.md} ${spacing.xl}`,
            },
            children: [
                icon('x', 18, colors.textMuted),
                createElement('span', { text: 'Salir', styles: { marginLeft: spacing.sm } }),
            ],
            events: {
                click: () => {
                    cleanup();
                    if (onExit) onExit();
                },
            },
        });
        buttonsContainer.appendChild(exitBtnModal);
        
        modalContent.appendChild(buttonsContainer);
        menuOverlay.appendChild(modalContent);
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
                // Actualizar HUD si está jugando o pausado
                if (rideState.status === RIDE_STATUS.PLAYING || rideState.status === RIDE_STATUS.PAUSED) {
                    updateHud(rideState);
                }
                
                // Mostrar/ocultar HUD según estado
                if (rideState.status === RIDE_STATUS.PLAYING) {
                    hudOverlay.style.display = 'block';
                } else if (rideState.status === RIDE_STATUS.PAUSED) {
                    hudOverlay.style.display = 'block';
                    // Podríamos añadir un indicador de pausa aquí
                } else if (rideState.status === RIDE_STATUS.FINISHED) {
                    hudOverlay.style.display = 'none';
                    // Mostrar resultados con modal personalizado
                    showFinishModal(rideState);
                } else {
                    hudOverlay.style.display = 'none';
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
        
        // Actualizar datos del rodillo continuamente (~60Hz para sincronía con el render)
        dataUpdateInterval = setInterval(() => {
            if (engine) {
                engine.updateBikeData({
                    power: liveData.power || 0,
                    cadence: liveData.cadence || 0,
                    speed: liveData.speed || 0,
                    heartRate: liveData.heartRate || 0,
                });
                
                // Reanudar si está pausado y pedalea
                const rideState = engine.getState();
                if (rideState.status === RIDE_STATUS.PAUSED && liveData.power > 30) {
                    engine.resume();
                }
            }
        }, 16); // ~60 FPS para sincronía con el render loop
        
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
