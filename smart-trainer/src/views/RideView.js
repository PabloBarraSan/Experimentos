/**
 * RideView - Vista del modo ciclismo virtual
 * Smart Trainer - Virtual Cycling
 */

import { colors, spacing, typography, baseStyles, borderRadius, premiumCardStyles } from '../utils/theme.js';
import { createElement, div, button, icon, formatTime, formatDistance } from '../utils/dom.js';
import { createRideEngine } from '../ride/RideEngine.js';
import { createRideRenderer3D } from '../ride/RideRenderer3D.js';
import { RIDE_STATUS, formatTime as formatTimeMs } from '../ride/RideState.js';
import { getAvailableWorlds, getWorldConfig } from '../ride/worlds/WorldConfig.js';
import { parseGpx } from '../ride/gpx.js';
import { saveRoute, getAllRoutes, getRoute, deleteRoute } from '../storage/routes.js';
import { getSessionsByRoute, getSessionTrace } from '../storage/sessions.js';
import { createGhost } from '../ride/GhostRider.js';
import { createRideRecorder } from '../ride/RideRecorder.js';
import { BIKE_PAINTS, RIDER_POSITIONS, DEFAULT_RIDER_POSITION } from '../expedition/Cyclist.js';
import { getRiderPrefs, saveRiderPrefs } from '../storage/settings.js';
import { createRideHud } from '../components/ride/RideHud.js';
import { createProfileSvg } from '../components/ride/RouteProfile.js';

// Tamaño máximo de GPX aceptado (se lee entero en memoria)
const MAX_GPX_BYTES = 30 * 1024 * 1024;

// Máximo de rides pasados que se ofrecen como fantasma
const MAX_GHOST_OPTIONS = 5;

/**
 * Preferencias guardadas del ciclista (posición y pintura de la bici), validadas contra Cyclist.js
 */
function resolveRiderPrefs() {
    const saved = getRiderPrefs();
    return {
        position: RIDER_POSITIONS[saved.position] ? saved.position : DEFAULT_RIDER_POSITION,
        bikeColor: (BIKE_PAINTS.find((paint) => paint.id === saved.bikeColor) || BIKE_PAINTS[0]).id,
    };
}

const paintHex = (id) => `#${(BIKE_PAINTS.find((paint) => paint.id === id) || BIKE_PAINTS[0]).color.toString(16).padStart(6, '0')}`;

/**
 * Segundos a m:ss (o h:mm:ss) sin signo
 */
function formatClock(totalSeconds) {
    const total = Math.max(0, Math.round(totalSeconds));
    const hours = Math.floor(total / 3600);
    const minutes = Math.floor((total % 3600) / 60);
    const seconds = total % 60;
    const ss = seconds.toString().padStart(2, '0');
    if (hours > 0) return `${hours}:${minutes.toString().padStart(2, '0')}:${ss}`;
    return `${minutes}:${ss}`;
}

function formatGhostDate(isoDate) {
    return new Date(isoDate).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' });
}

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
    
    // HUD (overlay sobre el canvas). Ignora el puntero salvo su botón de modo; ver components/ride/RideHud.js
    const hud = createRideHud();
    container.appendChild(hud.element);
    
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
    let recorder = null;
    let riderPrefs = resolveRiderPrefs();
    
    /**
     * Selector de la pantalla previa: posición sobre la bici (cambia el CdA de la física) y color de la bici
     */
    function createRiderSelector() {
        const chipStyles = (active) => ({
            ...baseStyles.button,
            cursor: 'pointer',
            padding: `${spacing.xs} ${spacing.sm}`,
            fontSize: typography.sizes.sm,
            backgroundColor: active ? colors.primary : colors.surface,
            color: active ? colors.background : colors.text,
            border: `1px solid ${active ? colors.primary : colors.border}`,
        });
        const dotStyles = (active, hex) => ({
            width: '24px',
            height: '24px',
            padding: '0',
            borderRadius: '50%',
            cursor: 'pointer',
            backgroundColor: hex,
            border: `2px solid ${active ? colors.text : colors.border}`,
            transform: active ? 'scale(1.15)' : 'none',
        });
        
        const positionButtons = Object.values(RIDER_POSITIONS).map((position) => button({
            text: position.label,
            attrs: { title: `CdA ${position.cda.toFixed(2)} m²` },
            styles: chipStyles(position.id === riderPrefs.position),
            events: {
                click: () => {
                    riderPrefs = { ...riderPrefs, position: position.id };
                    saveRiderPrefs({ position: position.id });
                    renderer?.setRiderPosition(position.id);
                    engine?.setCda(position.cda);
                    refresh();
                },
            },
        }));
        const colorButtons = BIKE_PAINTS.map((paint) => button({
            attrs: { title: paint.name, 'aria-label': `Bici ${paint.name}` },
            styles: dotStyles(paint.id === riderPrefs.bikeColor, paintHex(paint.id)),
            events: {
                click: () => {
                    riderPrefs = { ...riderPrefs, bikeColor: paint.id };
                    saveRiderPrefs({ bikeColor: paint.id });
                    renderer?.setRiderBikeColor(paint.color);
                    refresh();
                },
            },
        }));
        
        function refresh() {
            Object.values(RIDER_POSITIONS).forEach((position, index) => {
                Object.assign(positionButtons[index].style, chipStyles(position.id === riderPrefs.position));
            });
            BIKE_PAINTS.forEach((paint, index) => {
                Object.assign(colorButtons[index].style, dotStyles(paint.id === riderPrefs.bikeColor, paintHex(paint.id)));
            });
        }
        
        const row = (title, ...children) => div({
            styles: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, flexWrap: 'wrap' },
            children: [
                createElement('span', { text: title, styles: { color: colors.textMuted, fontSize: typography.sizes.sm, minWidth: '70px', textAlign: 'right' } }),
                ...children,
            ],
        });
        return div({
            styles: { display: 'flex', flexDirection: 'column', gap: spacing.sm, marginBottom: spacing.lg },
            children: [row('Posición', ...positionButtons), row('Bici', ...colorButtons)],
        });
    }
    
    /**
     * Guardar el ride en el historial (no hace nada si ya se guardó o fue demasiado corto)
     */
    function saveRide(status) {
        if (!engine || !recorder) return;
        recorder.finish(engine.getState(), status).catch((err) => {
            console.debug('No se pudo guardar el ride:', err);
        });
    }
    
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
                maxHeight: '100%',
                overflowY: 'auto',
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
        
        // Posición y color de la bici
        menuContent.appendChild(createRiderSelector());
        
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

        // Importar GPX + vista previa + Mis rutas
        menuContent.appendChild(createGpxSection());

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
     * Perfil de elevación sencillo en SVG a partir de los puntos de la ruta
     */
    function createElevationProfile(points) {
        return createProfileSvg(points, { height: 70 });
    }

    /**
     * Lista "Competir contra tu pasado" con selección opcional y chip del fantasma activo
     * @param {HTMLElement} box - Contenedor donde se dibuja
     * @param {Array} past - Rides pasados de la ruta (getSessionsByRoute)
     * @param {Function} getSelected - Devuelve la elección actual (o null)
     * @param {Function} setSelected - Guarda la elección
     */
    function renderGhostBox(box, past, getSelected, setSelected) {
        box.innerHTML = '';
        box.style.display = 'block';
        const selected = getSelected();

        box.appendChild(createElement('div', {
            text: 'Competir contra tu pasado',
            styles: {
                color: colors.textMuted,
                fontSize: typography.sizes.sm,
                marginBottom: spacing.xs,
            },
        }));

        const options = [{ id: null, label: 'Ninguno (sin fantasma)', detail: '' }, ...past.map((item) => ({
            id: item.id,
            date: item.date,
            label: formatGhostDate(item.date),
            detail: `${formatClock(item.duration)} · ${Math.round(item.avgPower)} W`,
        }))];

        options.forEach((option) => {
            const isSelected = (selected?.id ?? null) === option.id;
            box.appendChild(button({
                styles: {
                    ...baseStyles.button,
                    width: '100%',
                    padding: spacing.sm,
                    marginBottom: spacing.xs,
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    cursor: 'pointer',
                    backgroundColor: isSelected ? `${colors.primary}22` : colors.surface,
                    border: `1px solid ${isSelected ? colors.primary : colors.border}`,
                },
                attrs: { 'aria-pressed': isSelected ? 'true' : 'false' },
                children: [
                    createElement('span', {
                        text: option.label,
                        styles: { color: colors.text, fontSize: typography.sizes.sm },
                    }),
                    createElement('span', {
                        text: option.detail,
                        styles: { color: colors.primary, fontSize: typography.sizes.sm, fontFamily: typography.fontMono },
                    }),
                ],
                events: {
                    click: () => {
                        setSelected(option.id ? { id: option.id, date: option.date } : null);
                        renderGhostBox(box, past, getSelected, setSelected);
                    },
                },
            }));
        });

        if (selected) {
            box.appendChild(createElement('span', {
                text: `Fantasma: ${formatGhostDate(selected.date)}`,
                styles: {
                    display: 'inline-block',
                    marginTop: spacing.xs,
                    padding: `2px ${spacing.sm}`,
                    borderRadius: borderRadius.md,
                    backgroundColor: `${colors.primary}33`,
                    color: colors.primary,
                    fontSize: typography.sizes.xs,
                },
            }));
        }
    }

    /**
     * Sección de rutas GPX: importar, vista previa y "Mis rutas"
     */
    function createGpxSection() {
        const section = div({
            styles: {
                display: 'flex',
                flexDirection: 'column',
                gap: spacing.sm,
                marginBottom: spacing.lg,
                paddingTop: spacing.md,
                borderTop: `1px solid ${colors.border}`,
            },
        });

        const errorBox = div({
            styles: {
                display: 'none',
                color: colors.error,
                fontSize: typography.sizes.sm,
                padding: spacing.sm,
                border: `1px solid ${colors.error}`,
                borderRadius: borderRadius.md,
            },
        });
        errorBox.setAttribute('role', 'alert');

        const previewBox = div({ styles: { display: 'none' } });
        const myRoutesBox = div({
            styles: { display: 'flex', flexDirection: 'column', gap: spacing.xs },
        });

        const showError = (message) => {
            errorBox.textContent = message;
            errorBox.style.display = message ? 'block' : 'none';
        };

        // Cargar una ruta (ya parseada) en el motor y empezar
        // ghostChoice (opcional): { id, date } de un ride pasado en esta ruta
        const rideRoute = (route, ghostChoice = null) => {
            showLoadingIndicator(`Cargando ${route.name}...`);
            setTimeout(async () => {
                let ghost = null;
                if (ghostChoice) {
                    try {
                        ghost = createGhost(await getSessionTrace(ghostChoice.id));
                    } catch (err) {
                        console.debug('No se pudo cargar el fantasma:', err);
                    }
                }
                if (!engine) return; // Se salió de la vista mientras cargaba
                engine.setCustomRoute(route);
                engine.clearGhost();
                if (ghost) engine.setGhost(ghost, formatGhostDate(ghostChoice.date));
                startRide();
            }, 100);
        };

        const showPreview = (route, note = '') => {
            previewBox.innerHTML = '';
            previewBox.style.display = 'block';

            const card = div({
                styles: {
                    ...premiumCardStyles,
                    padding: spacing.md,
                    border: `1px solid ${colors.primary}`,
                    textAlign: 'left',
                },
            });
            card.appendChild(createElement('div', {
                text: route.name,
                styles: {
                    color: colors.text,
                    fontSize: typography.sizes.md,
                    fontWeight: typography.weights.bold,
                    marginBottom: spacing.xs,
                },
            }));
            card.appendChild(createElement('div', {
                text: route.hasElevation === false
                    ? `${(route.totalDistance / 1000).toFixed(1)} km · sin datos de elevación (pendiente 0%)`
                    : `${(route.totalDistance / 1000).toFixed(1)} km · +${Math.round(route.ascent)} m`,
                styles: {
                    color: colors.textMuted,
                    fontSize: typography.sizes.sm,
                    marginBottom: spacing.sm,
                },
            }));
            if (route.hasElevation !== false) {
                card.appendChild(createElevationProfile(route.points));
            }
            if (note) {
                card.appendChild(createElement('div', {
                    text: note,
                    styles: { color: colors.textMuted, fontSize: typography.sizes.xs, marginTop: spacing.xs },
                }));
            }

            // Competir contra tu pasado: ninguno por defecto
            let selectedGhost = null;
            const ghostBox = div({ styles: { display: 'none', marginTop: spacing.md } });
            card.appendChild(ghostBox);
            if (route.id) {
                getSessionsByRoute(route.id)
                    .then((past) => {
                        if (past.length === 0 || !ghostBox.isConnected) return;
                        renderGhostBox(ghostBox, past.slice(0, MAX_GHOST_OPTIONS), () => selectedGhost, (choice) => {
                            selectedGhost = choice;
                        });
                    })
                    .catch((err) => console.debug('No se pudieron leer los rides pasados:', err));
            }

            card.appendChild(button({
                styles: {
                    ...baseStyles.button,
                    backgroundColor: colors.primary,
                    color: colors.background,
                    fontWeight: typography.weights.bold,
                    padding: `${spacing.sm} ${spacing.lg}`,
                    marginTop: spacing.md,
                    width: '100%',
                },
                children: [createElement('span', { text: 'Recorrer esta ruta' })],
                events: { click: () => rideRoute(route, selectedGhost) },
            }));
            previewBox.appendChild(card);
        };

        // Lista "Mis rutas"
        const renderMyRoutes = async () => {
            let saved = [];
            try {
                saved = await getAllRoutes();
            } catch (err) {
                console.debug('No se pudieron leer las rutas guardadas:', err);
            }
            if (!myRoutesBox.isConnected) return; // El menú ya se cerró o se redibujó

            myRoutesBox.innerHTML = '';
            if (saved.length === 0) return;

            myRoutesBox.appendChild(createElement('div', {
                text: 'Mis rutas',
                styles: {
                    color: colors.textMuted,
                    fontSize: typography.sizes.sm,
                    textAlign: 'left',
                    marginTop: spacing.xs,
                },
            }));

            saved.forEach(item => {
                const row = div({
                    styles: {
                        display: 'flex',
                        gap: spacing.xs,
                        alignItems: 'stretch',
                    },
                });

                const selectBtn = button({
                    styles: {
                        ...baseStyles.button,
                        flex: '1',
                        padding: spacing.sm,
                        backgroundColor: colors.surface,
                        border: `1px solid ${colors.border}`,
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        cursor: 'pointer',
                        textAlign: 'left',
                    },
                    children: [
                        createElement('span', {
                            text: item.name,
                            styles: { color: colors.text, fontSize: typography.sizes.sm },
                        }),
                        createElement('span', {
                            text: `${(item.totalDistance / 1000).toFixed(1)} km · +${Math.round(item.ascent)} m`,
                            styles: { color: colors.primary, fontSize: typography.sizes.sm, whiteSpace: 'nowrap', marginLeft: spacing.sm },
                        }),
                    ],
                    events: {
                        click: async () => {
                            showError('');
                            try {
                                const full = await getRoute(item.id);
                                if (!full) throw new Error('La ruta ya no existe.');
                                showPreview(full);
                            } catch (err) {
                                showError(`No se pudo abrir la ruta: ${err.message}`);
                            }
                        },
                    },
                });

                // Borrado con confirmación en dos pasos (sin alert/confirm)
                let confirmTimer = null;
                const deleteBtn = button({
                    styles: {
                        ...baseStyles.button,
                        padding: `${spacing.sm} ${spacing.md}`,
                        backgroundColor: 'transparent',
                        border: `1px solid ${colors.border}`,
                        color: colors.textMuted,
                        fontSize: typography.sizes.xs,
                        cursor: 'pointer',
                    },
                    attrs: { title: 'Borrar ruta' },
                    children: [icon('x', 14, colors.textMuted)],
                    events: {
                        click: async () => {
                            if (!confirmTimer) {
                                deleteBtn.replaceChildren(createElement('span', { text: '¿Borrar?' }));
                                deleteBtn.style.color = colors.error;
                                deleteBtn.style.borderColor = colors.error;
                                confirmTimer = setTimeout(() => {
                                    confirmTimer = null;
                                    deleteBtn.replaceChildren(icon('x', 14, colors.textMuted));
                                    deleteBtn.style.color = colors.textMuted;
                                    deleteBtn.style.borderColor = colors.border;
                                }, 3000);
                                return;
                            }
                            clearTimeout(confirmTimer);
                            confirmTimer = null;
                            try {
                                await deleteRoute(item.id);
                            } catch (err) {
                                showError(`No se pudo borrar la ruta: ${err.message}`);
                                return;
                            }
                            renderMyRoutes();
                        },
                    },
                });

                row.appendChild(selectBtn);
                row.appendChild(deleteBtn);
                myRoutesBox.appendChild(row);
            });
        };

        // Importar: el archivo se lee en local, no se sube a ningún sitio
        const fileInput = createElement('input', {
            attrs: { type: 'file', accept: '.gpx,application/gpx+xml' },
            styles: { display: 'none' },
        });
        fileInput.addEventListener('change', async () => {
            const file = fileInput.files && fileInput.files[0];
            fileInput.value = ''; // Permite reimportar el mismo archivo
            if (!file) return;

            showError('');
            try {
                if (file.size > MAX_GPX_BYTES) {
                    throw new Error('El archivo es demasiado grande (máx. 30 MB).');
                }
                const route = parseGpx(await file.text());
                if (route.name === 'Ruta GPX') {
                    route.name = file.name.replace(/\.gpx$/i, '') || route.name;
                }

                let note = '';
                let toShow = route;
                try {
                    toShow = await saveRoute(route);
                    note = 'Guardada en Mis rutas (solo en este dispositivo).';
                } catch (err) {
                    console.debug('No se pudo guardar la ruta:', err);
                    note = 'No se pudo guardar; solo estará disponible en esta sesión.';
                }
                showPreview(toShow, note);
                renderMyRoutes();
            } catch (err) {
                previewBox.style.display = 'none';
                showError(err.message || 'No se pudo leer el archivo GPX.');
            }
        });

        const importBtn = button({
            styles: {
                ...baseStyles.button,
                backgroundColor: 'transparent',
                color: colors.primary,
                border: `1px solid ${colors.primary}`,
                padding: `${spacing.sm} ${spacing.lg}`,
                cursor: 'pointer',
            },
            children: [
                icon('route', 16, colors.primary),
                createElement('span', { text: 'Importar GPX', styles: { marginLeft: spacing.xs } }),
            ],
            events: { click: () => fileInput.click() },
        });

        section.appendChild(importBtn);
        section.appendChild(fileInput);
        section.appendChild(errorBox);
        section.appendChild(previewBox);
        section.appendChild(myRoutesBox);

        // La lista se rellena cuando la sección ya está en el DOM
        setTimeout(renderMyRoutes, 0);

        return section;
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
        engine.start();
        hud.start(engine.getState());
        hud.setVisible(true);
        recorder = createRideRecorder({ ftp: settings.ftp });
        recorder.start(engine.getState());
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
        
        // Resumen contra el fantasma: tiempo propio vs tiempo del fantasma y diferencia final
        if (rideState.ghost) {
            const diff = rideState.ghost.duration - elapsedTime / 1000;
            const diffColor = diff >= 0 ? colors.success : colors.error;
            modalContent.appendChild(div({
                styles: {
                    backgroundColor: colors.surface,
                    borderRadius: borderRadius.md,
                    padding: spacing.md,
                    marginBottom: spacing.xl,
                    border: `1px solid ${diffColor}`,
                },
                children: [
                    createElement('div', {
                        text: `Fantasma: ${rideState.ghost.label}`,
                        styles: { fontSize: typography.sizes.xs, color: colors.textMuted, marginBottom: spacing.xs },
                    }),
                    createElement('div', {
                        text: `Tú ${formatClock(elapsedTime / 1000)} · Fantasma ${formatClock(rideState.ghost.duration)}`,
                        styles: { fontSize: typography.sizes.md, color: colors.text, fontFamily: typography.fontMono },
                    }),
                    createElement('div', {
                        text: diff >= 0
                            ? `Le ganaste por ${formatClock(diff)}`
                            : `Te ganó por ${formatClock(-diff)}`,
                        styles: { fontSize: typography.sizes.lg, fontWeight: typography.weights.bold, color: diffColor, marginTop: spacing.xs },
                    }),
                ],
            }));
        }
        
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
        // Un ride en curso o pausado se guarda como abandonado (si no es demasiado corto)
        saveRide('abandoned');
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
        hud.destroy();
    }
    
    // Inicializar cuando el canvas esté en el DOM
    requestAnimationFrame(() => {
        // Ajustar tamaño del canvas
        const rect = container.getBoundingClientRect();
        canvas.width = rect.width;
        canvas.height = rect.height;
        
        // Crear renderer
        renderer = createRideRenderer3D(canvas, {
            position: riderPrefs.position,
            bikeColor: BIKE_PAINTS.find((paint) => paint.id === riderPrefs.bikeColor).color,
        });
        
        // Crear motor del ride
        engine = createRideEngine({
            canvas,
            ftp: settings.ftp,
            weight: settings.weight || 70,
            cda: RIDER_POSITIONS[riderPrefs.position].cda,
            onStateChange: (rideState) => {
                // Grabar muestra para el historial (1/s, solo jugando)
                if (recorder) recorder.sample(rideState);
                
                // Actualizar HUD si está jugando o pausado
                if (rideState.status === RIDE_STATUS.PLAYING || rideState.status === RIDE_STATUS.PAUSED) {
                    hud.update(rideState);
                }
                
                // Mostrar/ocultar HUD según estado
                if (rideState.status === RIDE_STATUS.PLAYING || rideState.status === RIDE_STATUS.PAUSED) {
                    hud.setVisible(true); // En pausa el HUD muestra su indicador de PAUSA
                } else if (rideState.status === RIDE_STATUS.FINISHED) {
                    hud.setVisible(false);
                    saveRide('completed');
                    // Mostrar resultados con modal personalizado
                    showFinishModal(rideState);
                } else {
                    hud.setVisible(false);
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
