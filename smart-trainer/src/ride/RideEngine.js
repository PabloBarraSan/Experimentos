/**
 * RideEngine - Motor principal del ciclismo virtual
 * Smart Trainer - Virtual Cycling
 */

import { createRideState, resetRideState, updateStats, RIDE_STATUS } from './RideState.js';
import { createRidePhysics } from './RidePhysics.js';
import { createRouteGenerator, PRESET_ROUTES } from './RouteGenerator.js';
import { createBotSystem, createBotsForWorld } from './BotSystem.js';
import { getWorldConfig as getWorldConfigFromModule } from './worlds/WorldConfig.js';

/**
 * Crear instancia del motor de ciclismo virtual
 */
export function createRideEngine(options = {}) {
    const {
        canvas,
        ftp = 200,
        weight = 70,
        cda, // CdA inicial (m²); si falta, la física usa su valor por defecto
        worldId = 'green_valley',
        onStateChange = () => {},
        onRouteComplete = () => {},
        onSimulationUpdate = () => {}, // Callback para actualizar resistencia del rodillo
    } = options;
    
    // Estado del ride
    let state = createRideState({ ftp, weight, worldId });
    let lastTimestamp = 0;
    let animationFrameId = null;
    let renderer = null;
    
    // Tiempo de inicio usando performance.now() para consistencia
    let performanceStartTime = 0;
    let pausedElapsedTime = 0; // Tiempo acumulado antes de pausar
    
    // Sistemas
    let physics = createRidePhysics({ cda });
    let routeGenerator = createRouteGenerator(worldId);
    let botSystem = createBotsForWorld(worldId, ftp, weight);
    let ghost = null; // Fantasma opcional (ver GhostRider.js)
    let ghostLabel = '';
    
    // Configuración del mundo
    let worldConfig = getWorldConfigFromModule(worldId);
    
    // Throttle para envío de comandos al rodillo
    let lastSimulationUpdate = 0;
    const SIMULATION_UPDATE_INTERVAL = 1000; // Actualizar cada 1 segundo
    
    // Throttle para notificaciones de estado (evitar re-renders excesivos)
    let lastStateNotification = 0;
    const STATE_NOTIFICATION_INTERVAL = 50; // Notificar cada 50ms (20 FPS para UI)
    
    // Dimensiones del canvas
    const getCanvasSize = () => ({
        width: canvas?.width || 800,
        height: canvas?.height || 600,
    });
    
    /**
     * Game loop principal
     */
    function gameLoop(timestamp) {
        const deltaTime = timestamp - lastTimestamp;
        lastTimestamp = timestamp;
        
        // Validar deltaTime para evitar valores inválidos en el primer frame
        if (deltaTime > 0 && deltaTime < 1000 && state.status === RIDE_STATUS.PLAYING) {
            update(deltaTime, timestamp);
        }
        
        render();
        
        animationFrameId = requestAnimationFrame(gameLoop);
    }
    
    /**
     * Actualizar lógica del ride
     */
    function update(deltaTime, timestamp) {
        const dtSeconds = deltaTime / 1000;
        
        // Actualizar tiempo usando performance.now() consistentemente
        state.elapsedTime = pausedElapsedTime + (timestamp - performanceStartTime);
        
        // Obtener punto actual de la ruta
        const currentPoint = routeGenerator.getPointAtDistance(
            state.route.points,
            state.position.distance
        );
        
        state.currentGrade = currentPoint.grade;
        state.position.elevation = currentPoint.elevation;
        
        // Calcular velocidad usando física
        const totalMass = state.weight + state.bikeWeight;
        const velocity = physics.calculateSimpleVelocity(
            state.bikeData.power,
            state.currentGrade,
            totalMass
        );
        
        state.position.speed = velocity;
        state.position.virtualSpeed = velocity * 3.6; // m/s a km/h
        
        // Actualizar posición
        state.position.distance += velocity * dtSeconds;
        
        // Actualizar bots
        botSystem.update(state.position.distance, state.currentGrade, deltaTime);
        state.bots = botSystem.getVisibleBots(state.position.distance);
        
        // Actualizar fantasma
        updateGhost();
        
        // Actualizar estadísticas
        updateStats(state, dtSeconds);
        
        // Tracking de ascenso total
        if (state.currentGrade > 0) {
            const elevationGain = velocity * dtSeconds * (state.currentGrade / 100);
            state.stats.totalAscent += elevationGain;
        }
        
        // Enviar actualización de simulación al rodillo (throttled)
        const now = Date.now();
        if (now - lastSimulationUpdate > SIMULATION_UPDATE_INTERVAL) {
            lastSimulationUpdate = now;
            const simParams = physics.getSimulationParams(state.currentGrade);
            onSimulationUpdate(simParams);
        }
        
        // Verificar si la ruta está completa
        if (state.position.distance >= state.route.length) {
            finishRide();
        }
        
        // Notificar cambios de estado (throttled para evitar re-renders excesivos)
        if (now - lastStateNotification > STATE_NOTIFICATION_INTERVAL) {
            lastStateNotification = now;
            onStateChange(state);
        }
    }
    
    /**
     * Calcular posición y hueco del fantasma según el tiempo del ride
     */
    function updateGhost() {
        if (!ghost) return;
        const elapsedSeconds = state.elapsedTime / 1000;
        const gap = ghost.getGapAt(elapsedSeconds, state.position.distance);
        state.ghost = {
            label: ghostLabel,
            distance: ghost.getDistanceAt(elapsedSeconds),
            gapMeters: gap.meters,   // + = vas por delante
            gapSeconds: gap.seconds, // + = vas por delante
            duration: ghost.duration,
        };
    }
    
    /**
     * Activar un fantasma (de GhostRider.createGhost) para el ride actual
     */
    function setGhost(newGhost, label = '') {
        ghost = newGhost;
        ghostLabel = label;
        state.ghost = ghost && {
            label: ghostLabel,
            distance: ghost.getDistanceAt(0),
            gapMeters: 0,
            gapSeconds: 0,
            duration: ghost.duration,
        };
    }
    
    /**
     * Quitar el fantasma
     */
    function clearGhost() {
        ghost = null;
        ghostLabel = '';
        state.ghost = null;
    }
    
    /**
     * Renderizar
     */
    function render() {
        if (renderer) {
            renderer.render(state, worldConfig);
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
     * Seleccionar mundo
     */
    function selectWorld(newWorldId) {
        state.worldId = newWorldId;
        worldConfig = getWorldConfigFromModule(newWorldId);
        routeGenerator = createRouteGenerator(newWorldId);
        botSystem = createBotsForWorld(newWorldId, state.ftp, state.weight);
        state.status = RIDE_STATUS.SELECTING_ROUTE;
        onStateChange(state);
    }
    
    /**
     * Obtener rutas disponibles para el mundo actual
     */
    function getAvailableRoutes() {
        const presets = PRESET_ROUTES[state.worldId] || [];
        return [
            {
                id: 'procedural_short',
                name: 'Ruta Corta',
                description: 'Ruta procedural de 5km',
                length: 5000,
                procedural: true,
            },
            {
                id: 'procedural_medium',
                name: 'Ruta Media',
                description: 'Ruta procedural de 10km',
                length: 10000,
                procedural: true,
            },
            {
                id: 'procedural_long',
                name: 'Ruta Larga',
                description: 'Ruta procedural de 20km',
                length: 20000,
                procedural: true,
            },
            ...presets.map(p => ({
                ...p,
                procedural: true, // Las preset también usan generación procedural con seed
            })),
        ];
    }
    
    /**
     * Seleccionar ruta e iniciar
     */
    function selectRoute(routeConfig) {
        const { length, seed } = routeConfig;
        
        // Generar puntos de ruta
        if (seed) {
            routeGenerator = createRouteGenerator(state.worldId, seed);
        }
        
        const routePoints = routeGenerator.generateCustom({
            length,
            resolution: 10,
            flatStart: 200,
            flatEnd: 100,
        });
        
        state.route.length = length;
        state = resetRideState(state, routePoints);
        // Ruta generada: sin fantasma ni identidad de ruta importada previa.
        // Solo las rutas con seed son reproducibles, así que solo ellas tienen id estable.
        ghost = null;
        state.ghost = null;
        state.route.id = seed ? `gen-${state.worldId}-${length}-${seed}` : null;
        state.route.name = routeConfig.name || null;
        botSystem.reset();
        physics.reset();

        onStateChange(state);
    }

    /**
     * Seleccionar una ruta importada (GPX) con sus puntos ya calculados
     * @param {Object} route - { id, name, points, totalDistance }
     */
    function setCustomRoute(route) {
        if (!route || !Array.isArray(route.points) || route.points.length < 2) {
            throw new Error('Ruta inválida');
        }

        const lastPoint = route.points[route.points.length - 1];
        state.route.length = route.totalDistance || lastPoint.distance;
        state = resetRideState(state, route.points);
        state.route.id = route.id || null;
        state.route.name = route.name || null;
        botSystem.reset();
        physics.reset();

        onStateChange(state);
    }

    /**
     * Iniciar ride
     */
    function start() {
        if (state.route.points.length === 0) {
            // Si no hay ruta, generar una por defecto
            selectRoute({ length: 10000 });
        }
        
        state.status = RIDE_STATUS.PLAYING;
        state.startTime = Date.now();
        
        // Usar performance.now() para tiempo consistente con el game loop
        const now = performance.now();
        performanceStartTime = now;
        lastTimestamp = now;
        pausedElapsedTime = 0;
        
        if (!animationFrameId) {
            animationFrameId = requestAnimationFrame(gameLoop);
        }
        
        onStateChange(state);
    }
    
    /**
     * Pausar ride
     */
    function pause() {
        if (state.status === RIDE_STATUS.PLAYING) {
            // Guardar tiempo acumulado antes de pausar
            pausedElapsedTime = state.elapsedTime;
            state.status = RIDE_STATUS.PAUSED;
            onStateChange(state);
        }
    }
    
    /**
     * Reanudar ride
     */
    function resume() {
        if (state.status === RIDE_STATUS.PAUSED) {
            state.status = RIDE_STATUS.PLAYING;
            // Reiniciar el timestamp desde ahora
            const now = performance.now();
            performanceStartTime = now;
            lastTimestamp = now;
            onStateChange(state);
        }
    }
    
    /**
     * Finalizar ride
     */
    function finishRide() {
        // Cancelar el animation frame para detener el loop
        if (animationFrameId) {
            cancelAnimationFrame(animationFrameId);
            animationFrameId = null;
        }
        
        state.status = RIDE_STATUS.FINISHED;
        
        const results = {
            distance: state.position.distance,
            elapsedTime: state.elapsedTime,
            avgPower: state.stats.avgPower,
            maxPower: state.stats.maxPower,
            avgSpeed: state.stats.avgSpeed,
            maxSpeed: state.stats.maxSpeed,
            totalAscent: Math.round(state.stats.totalAscent),
            worldId: state.worldId,
            worldName: worldConfig.name,
        };
        
        onRouteComplete(results);
        onStateChange(state);
    }
    
    /**
     * Detener ride
     */
    function stop() {
        if (animationFrameId) {
            cancelAnimationFrame(animationFrameId);
            animationFrameId = null;
        }
        state.status = RIDE_STATUS.MENU;
        onStateChange(state);
    }
    
    /**
     * Reiniciar ride con la misma ruta
     */
    function restart() {
        const routePoints = state.route.points;
        const length = state.route.length;
        
        state = resetRideState(state, routePoints);
        state.route.length = length;
        botSystem.reset();
        physics.reset();
        
        state.status = RIDE_STATUS.PLAYING;
        state.startTime = Date.now();
        
        // Reiniciar tiempo con performance.now()
        const now = performance.now();
        performanceStartTime = now;
        lastTimestamp = now;
        pausedElapsedTime = 0;
        
        onStateChange(state);
    }
    
    /**
     * Obtener estado actual
     */
    function getState() {
        return state;
    }
    
    /**
     * Obtener configuración del mundo actual
     */
    function getWorldConfig() {
        return worldConfig;
    }
    
    /**
     * Obtener estadísticas de la ruta actual
     */
    function getRouteStats() {
        return routeGenerator.getRouteStats(state.route.points);
    }
    
    /**
     * Establecer FTP
     */
    function setFTP(newFTP) {
        state.ftp = newFTP;
    }
    
    /**
     * Establecer peso
     */
    function setWeight(newWeight) {
        state.weight = newWeight;
    }
    
    /**
     * Cambiar el CdA (m²) según la posición del ciclista; se usa en la velocidad y se envía al rodillo
     */
    function setCda(newCda) {
        physics?.setCda(newCda);
    }
    
    /**
     * Ir al menú de selección de mundo
     */
    function goToWorldSelection() {
        state.status = RIDE_STATUS.SELECTING_WORLD;
        onStateChange(state);
    }
    
    /**
     * Ir al menú principal
     */
    function goToMenu() {
        state.status = RIDE_STATUS.MENU;
        onStateChange(state);
    }
    
    /**
     * Destruir engine
     */
    function destroy() {
        stop();
        state = null;
        renderer = null;
        physics = null;
        routeGenerator = null;
        botSystem = null;
        ghost = null;
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
        getWorldConfig,
        getRouteStats,
        getAvailableRoutes,
        selectWorld,
        selectRoute,
        setCustomRoute,
        setGhost,
        clearGhost,
        setFTP,
        setWeight,
        setCda,
        goToWorldSelection,
        goToMenu,
        finishRide,
        destroy,
    };
}
