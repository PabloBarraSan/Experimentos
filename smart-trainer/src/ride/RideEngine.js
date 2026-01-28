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
    
    // Sistemas
    let physics = createRidePhysics();
    let routeGenerator = createRouteGenerator(worldId);
    let botSystem = createBotsForWorld(worldId, ftp, weight);
    
    // Configuración del mundo
    let worldConfig = getWorldConfigFromModule(worldId);
    
    // Throttle para envío de comandos al rodillo
    let lastSimulationUpdate = 0;
    const SIMULATION_UPDATE_INTERVAL = 1000; // Actualizar cada 1 segundo
    
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
        
        if (state.status === RIDE_STATUS.PLAYING) {
            update(deltaTime);
        }
        
        render();
        
        animationFrameId = requestAnimationFrame(gameLoop);
    }
    
    /**
     * Actualizar lógica del ride
     */
    function update(deltaTime) {
        const dtSeconds = deltaTime / 1000;
        
        // Actualizar tiempo
        state.elapsedTime = Date.now() - state.startTime;
        
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
        
        // Notificar cambios de estado
        onStateChange(state);
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
        lastTimestamp = performance.now();
        
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
            lastTimestamp = performance.now();
            onStateChange(state);
        }
    }
    
    /**
     * Finalizar ride
     */
    function finishRide() {
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
        lastTimestamp = performance.now();
        
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
        setFTP,
        setWeight,
        goToWorldSelection,
        goToMenu,
        finishRide,
        destroy,
    };
}
