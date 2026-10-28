/**
 * Smart Trainer Controller
 * Aplicación principal para controlar el rodillo Decathlon D100
 */

import { colors, spacing, typography, baseStyles, borderRadius, transitions } from './utils/theme.js';
import { createElement, div, render } from './utils/dom.js';
import { BluetoothManager, CONNECTION_STATE } from './bluetooth/scanner.js';
import { HeartRateManager, HR_CONNECTION_STATE } from './bluetooth/heartRate.js';
import { ZwiftPlayManager, ZWIFT_PLAY_STATE } from './bluetooth/zwiftPlay.js';
import './views/desktop-pages.css';
import { HomeView } from './views/HomeView.js';
import { PrepareView } from './views/PrepareView.js';
import { mergeTrainerData } from './utils/liveData.js';
import { TrainingView } from './views/TrainingView.js';
import { HistoryView } from './views/HistoryView.js';
import { SettingsView } from './views/SettingsView.js';
import { WorkoutsView } from './views/WorkoutsView.js';
import { ExpeditionView } from './views/ExpeditionView.js';
import { TrainerDiagnosticsView } from './views/TrainerDiagnosticsView.js';
import { ResistanceProbeView } from './views/ResistanceProbeView.js';
import { CyclistViewerView } from './views/CyclistViewerView.js';
import { preloadRiderAvatar } from './expedition/AvatarRider.js';
import { preloadBikeModel } from './expedition/BikeModel.js';
import { calculateKilojoules, calculateCalories } from './utils/calculations.js';
import { initRouter, navigate, setRouteChangeHandler, getCurrentView } from './router.js';
import { getActiveSession, getProgress, saveProgress } from './storage/sessions.js';
import { getAllPresets } from './workouts/presets.js';
import { getCachedPlanWorkout } from './workouts/planConverter.js';
import { startBackgroundSync } from './sync/TrainingAppSync.js';
import { buildWorkoutForDuration, getDefaultWorkoutDuration, getWorkoutDurationOptions } from './workouts/WorkoutConfiguration.js';
import { migrateProgress } from './game/ProgressionService.js';
import { logActiveSessionEvent } from './diagnostics/SessionDebugLogger.js';

// Estado global de la aplicación
const AppState = {
    currentView: 'home',
    bluetoothManager: null,
    connectionState: CONNECTION_STATE.DISCONNECTED,
    deviceName: null,
    deviceCapabilities: null, // Capacidades del dispositivo
    selectedWorkout: null,
    selectedWorkoutTemplate: null,
    selectedDurationMinutes: null,
    selectedMission: null,
    recoveredSession: null,
    progress: null,
    lastDataUpdateTimestamp: null, // Timestamp de la última actualización de datos
    
    // Heart Rate Monitor (pulsómetro separado)
    heartRateManager: null,
    hrConnectionState: HR_CONNECTION_STATE.DISCONNECTED,
    hrDeviceName: null,
    hrSensorLocation: null,
    lastHeartRateUpdateTimestamp: null,

    // Zwift Play (mandos BLE)
    zwiftPlayManager: null,
    zwiftPlayState: ZWIFT_PLAY_STATE.DISCONNECTED,
    
    // Datos en tiempo real del rodillo
    liveData: {
        power: 0,
        cadence: 0,
        speed: 0,
        heartRate: 0,
        distance: 0,
        calories: 0,
        resistance: 0,
    },
    
    // Datos de la sesión actual (solo activa al entrar en modo Entrenamiento, no al conectar)
    session: {
        isActive: false,
        isPaused: false,
        startTime: null,
        elapsedTime: 0,
        dataPoints: [],
        accumulatedDistance: 0, // Distancia acumulada calculada desde velocidad
        pauseDuration: 0,       // ms totales en pausa (para que el tiempo no cuente)
        pausedAt: null,         // timestamp al pausar; null si no está pausado
    },
    
    // Configuración del usuario
    settings: {
        ftp: 200,
        weight: 70,
        maxHR: 190,
        restingHR: 60,
        units: 'metric',
        soundEnabled: true,
        soundVolume: 0.55,
        vibrationEnabled: true,
    },
    
    // Listeners para cambios de estado
    listeners: new Set(),
};

/**
 * Suscribirse a cambios de estado
 */
export function subscribe(listener) {
    AppState.listeners.add(listener);
    return () => AppState.listeners.delete(listener);
}

/**
 * Notificar cambios a los listeners
 */
function notify() {
    AppState.listeners.forEach(listener => listener(AppState));
}

/**
 * Actualizar estado
 */
export function updateState(updates) {
    Object.assign(AppState, updates);
    notify();
}

/**
 * Actualizar distancia acumulada a partir de velocidad (cuando el rodillo no envía distancia).
 * @param {number} speedKmh - Velocidad en km/h
 * @param {number} timeStepSeconds - Intervalo de tiempo en segundos
 */
export function updateDistance(speedKmh, timeStepSeconds) {
    if (speedKmh > 0 && timeStepSeconds > 0) {
        const speedMs = speedKmh / 3.6; // km/h → m/s
        const addedDistance = speedMs * timeStepSeconds;
        if (AppState.session.accumulatedDistance === undefined) {
            AppState.session.accumulatedDistance = 0;
        }
        AppState.session.accumulatedDistance += addedDistance;
    }
}

/**
 * Actualizar datos en tiempo real
 */
export function updateLiveData(data) {
    const now = Date.now();
    const previousTimestamp = AppState.lastDataUpdateTimestamp || now;

    mergeTrainerData(AppState.liveData, data);
    AppState.lastDataUpdateTimestamp = now;

    // Actualizar tiempo transcurrido si la sesión está activa (descontando tiempo en pausa)
    if (AppState.session.isActive && AppState.session.startTime) {
        const pauseDuration = AppState.session.pauseDuration || 0;
        const currentPauseMs = AppState.session.pausedAt ? (now - AppState.session.pausedAt) : 0;
        const totalPauseMs = pauseDuration + currentPauseMs;
        AppState.session.elapsedTime = Math.floor((now - AppState.session.startTime - totalPauseMs) / 1000);
    }
    
    // Distancia: si el parser D100 devuelve distance undefined, forzamos cálculo exacto: distancia += (velocidad/3.6) * (delta_ms/1000)
    if (AppState.session.isActive && !AppState.session.isPaused) {
        if (AppState.liveData.distance === undefined || AppState.liveData.distance === null) {
            const delta_ms = now - previousTimestamp;
            const timeDeltaSeconds = delta_ms / 1000;
            updateDistance(AppState.liveData.speed || 0, timeDeltaSeconds);
            if (AppState.session.accumulatedDistance !== undefined) {
                AppState.liveData.distance = Math.round(AppState.session.accumulatedDistance);
            }
        } else {
            AppState.session.accumulatedDistance = AppState.liveData.distance;
        }
        
        // Guardar punto de datos si ha pasado al menos 1 segundo desde el último punto
        const lastPoint = AppState.session.dataPoints[AppState.session.dataPoints.length - 1];
        if (!lastPoint || now - lastPoint.timestamp >= 1000) {
            AppState.session.dataPoints.push({
                timestamp: now,
                ...AppState.liveData,
            });
            
            // Calcular calorías basadas en la potencia acumulada
            if (AppState.session.dataPoints.length > 0) {
                const powerData = AppState.session.dataPoints.map(p => p.power || 0);
                const kilojoules = calculateKilojoules(powerData, 1);
                AppState.liveData.calories = calculateCalories(kilojoules);
            }
        }
    }
    
    notify();
}

/**
 * Obtener estado actual
 */
export function getState() {
    return AppState;
}

function configureWorkout(workout, preferredDuration = null) {
    if (!workout) return;
    const templateId = workout.parentWorkoutId || workout.id;
    const template = getAllPresets().find((candidate) => candidate.id === templateId) || workout;
    const durationOptions = getWorkoutDurationOptions(template);
    const requestedDuration = Number(preferredDuration);
    const durationMinutes = durationOptions.includes(requestedDuration)
        ? requestedDuration
        : getDefaultWorkoutDuration(template);

    AppState.selectedWorkoutTemplate = template;
    AppState.selectedDurationMinutes = durationMinutes;
    AppState.selectedWorkout = buildWorkoutForDuration(template, durationMinutes) || template;
}

/**
 * Navegar a una vista
 * @param {string} viewName - Nombre de la vista
 * @param {Object} options - Opciones de navegación
 * @param {boolean} options.replace - Si true, reemplaza la entrada actual en el historial
 * @param {boolean} options.skipRouter - Si true, no actualiza la URL (usado internamente por el router)
 */
export function navigateTo(viewName, options = {}) {
    AppState.currentView = viewName;
    // Iniciar sesión de entrenamiento solo al entrar en la vista Entrenamiento (no al conectar)
    if (viewName === 'training' && AppState.connectionState === CONNECTION_STATE.CONNECTED && !AppState.session.isActive) {
        AppState.session.isActive = true;
        AppState.session.isPaused = false;
        AppState.session.startTime = Date.now();
        AppState.session.elapsedTime = 0;
        AppState.session.dataPoints = [];
        AppState.session.accumulatedDistance = 0;
        AppState.session.pauseDuration = 0;
        AppState.session.pausedAt = null;
    }
    
    // Actualizar la URL (excepto si viene del propio router para evitar loops)
    if (!options.skipRouter) {
        navigate(viewName, { replace: options.replace });
    }
    
    renderApp();
}

/**
 * Navegar al modo juego
 */
export function navigateToGame() {
    navigateTo('game');
}

/**
 * Navegar al modo ciclismo virtual
 */
export function navigateToRide() {
    navigateTo('ride');
}

/**
 * Renderizar vista actual
 */
function renderCurrentView() {
    const isTrainingView = AppState.currentView === 'training';
    const container = div({
        styles: {
            flex: '1',
            minHeight: isTrainingView ? 0 : undefined,
            overflow: isTrainingView ? 'hidden' : 'auto',
            display: 'flex',
            flexDirection: 'column',
        }
    });
    
    // Función auxiliar para limpiar vistas de pantalla completa
    const cleanupFullscreenViews = () => {
        // Limpiar GameView si existe
        const gameView = document.querySelector('[data-game-view]');
        if (gameView) {
            if (gameView.cleanup) gameView.cleanup();
            gameView.remove();
        }
        // Limpiar RideView si existe
        const rideView = document.querySelector('[data-ride-view]');
        if (rideView) {
            if (rideView.cleanup) rideView.cleanup();
            rideView.remove();
        }
        // Una prueba de resistencia en curso debe soltar el rodillo al salir de su pantalla.
        const probeView = document.querySelector('[data-view="resistance-probe"]');
        if (probeView) {
            probeView.cleanup?.();
            probeView.remove();
        }
    };
    
    switch (AppState.currentView) {
        case 'game':
            // GameView se renderiza a pantalla completa
            cleanupFullscreenViews();
            import('./views/GameView.js').then(({ GameView }) => {
                if (AppState.currentView !== 'game') return;
                const gameView = GameView({
                    state: AppState,
                    onExit: () => navigateTo('home'),
                });
                gameView.setAttribute('data-game-view', 'true');
                document.body.appendChild(gameView);
            }).catch((error) => console.error('No se pudo cargar el modo juego:', error));
            return container; // Retornar contenedor vacío
            
        case 'ride':
            // RideView se renderiza a pantalla completa
            cleanupFullscreenViews();
            import('./views/RideView.js').then(({ RideView }) => {
                if (AppState.currentView !== 'ride') return;
                const rideView = RideView({
                    state: AppState,
                    onExit: () => navigateTo('home'),
                    onSimulationUpdate: (params) => {
                        if (AppState.bluetoothManager?.commandQueue) {
                            AppState.bluetoothManager.commandQueue.setIndoorBikeSimulation(
                                params.windSpeed,
                                params.grade,
                                params.crr,
                                params.cw
                            ).catch(err => console.debug('Simulación no soportada:', err.message));
                        }
                    },
                });
                rideView.setAttribute('data-ride-view', 'true');
                document.body.appendChild(rideView);
            }).catch((error) => console.error('No se pudo cargar el ciclismo virtual:', error));
            return container; // Retornar contenedor vacío
            
        case 'training': {
            cleanupFullscreenViews();
            const trainingWrapper = div({
                styles: {
                    flex: '1',
                    minHeight: 0,
                    overflow: 'hidden',
                    display: 'flex',
                    flexDirection: 'column',
                }
            });
            trainingWrapper.appendChild(TrainingView(AppState));
            container.appendChild(trainingWrapper);
            break;
        }

        case 'workouts': {
            cleanupFullscreenViews();
            const workoutsWrapper = div({
                styles: { flex: '1', minHeight: 0, overflow: 'auto' },
                attrs: { 'data-view': 'workouts' },
            });
            workoutsWrapper.appendChild(WorkoutsView({
                state: AppState,
                onBack: () => navigateTo('home'),
                onSelectWorkout: (workout) => {
                    AppState.recoveredSession = null;
                    configureWorkout(workout);
                    if (workout.mission) AppState.selectedMission = workout.mission;
                    AppState.prepareTarget = 'expedition';
                    navigateTo('prepare');
                },
            }));
            container.appendChild(workoutsWrapper);
            break;
        }

        case 'prepare': {
            cleanupFullscreenViews();
            if (AppState.prepareTarget !== 'training' && !AppState.selectedWorkout) {
                navigateTo('workouts', { replace: true });
                break;
            }
            container.appendChild(PrepareView(AppState));
            break;
        }

        case 'expedition': {
            cleanupFullscreenViews();
            if (!AppState.selectedWorkout) {
                navigateTo('workouts', { replace: true });
                break;
            }
            container.appendChild(ExpeditionView({
                state: AppState,
                workout: AppState.selectedWorkout,
                mission: AppState.selectedMission,
                availableWorkouts: getAllPresets(),
                recoveredSession: AppState.recoveredSession,
                subscribeToState: subscribe,
                onProgress: (progress) => {
                    AppState.progress = progress;
                    AppState.recoveredSession = null;
                },
                onExit: () => navigateTo('workouts'),
                onSelectWorkout: (workout, preferredDuration) => {
                    AppState.recoveredSession = null;
                    configureWorkout(workout, preferredDuration ?? AppState.selectedDurationMinutes);
                    navigateTo('expedition', { replace: true });
                },
                onSelectDuration: (durationMinutes) => {
                    AppState.recoveredSession = null;
                    configureWorkout(AppState.selectedWorkoutTemplate || AppState.selectedWorkout, durationMinutes);
                    navigateTo('expedition', { replace: true });
                },
                onSelectMission: (mission) => {
                    AppState.selectedMission = mission;
                    navigateTo('expedition', { replace: true });
                },
                onCompleted: () => navigateTo('history'),
            }));
            break;
        }

        case 'cyclist': {
            cleanupFullscreenViews();
            container.appendChild(CyclistViewerView({ onBack: () => navigateTo('home') }));
            break;
        }

        case 'diagnostics': {
            cleanupFullscreenViews();
            container.appendChild(TrainerDiagnosticsView({
                state: AppState,
                subscribeToState: subscribe,
                onBack: () => navigateTo('home'),
            }));
            break;
        }

        case 'probe': {
            cleanupFullscreenViews();
            container.appendChild(ResistanceProbeView({ state: AppState, subscribeToState: subscribe, onBack: () => navigateTo('home') }));
            break;
        }

        case 'history': {
            cleanupFullscreenViews();
            const historyWrapper = div({
                styles: {
                    flex: '1',
                    minHeight: 0,
                    overflow: 'auto',
                    display: 'flex',
                    flexDirection: 'column',
                },
                attrs: { 'data-view': 'history' },
            });
            const loader = div({
                styles: {
                    flex: '1',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: spacing.xxl,
                },
                children: [
                    div({
                        styles: {
                            width: '32px',
                            height: '32px',
                            border: `3px solid ${colors.border}`,
                            borderTopColor: colors.primary,
                            borderRadius: '50%',
                            animation: 'spin 1s linear infinite',
                        },
                    }),
                ],
            });
            historyWrapper.appendChild(loader);
            container.appendChild(historyWrapper);
            HistoryView({ state: AppState, onBack: () => navigateTo('home') })
                .then((viewEl) => {
                    loader.remove();
                    historyWrapper.appendChild(viewEl);
                })
                .catch((err) => {
                    console.error('Error cargando historial:', err);
                    loader.remove();
                    historyWrapper.appendChild(
                        createElement('p', {
                            text: 'Error al cargar el historial. Vuelve a intentarlo.',
                            styles: { color: colors.error, padding: spacing.lg, textAlign: 'center' },
                        })
                    );
                });
            break;
        }

        case 'settings': {
            cleanupFullscreenViews();
            const settingsWrapper = div({
                styles: { flex: '1', minHeight: 0, overflow: 'auto', display: 'flex', flexDirection: 'column' },
                attrs: { 'data-view': 'settings' },
            });
            settingsWrapper.appendChild(SettingsView({
                state: AppState,
                onSave: (newSettings) => {
                    AppState.settings = { ...AppState.settings, ...newSettings };
                    notify();
                },
            }));
            container.appendChild(settingsWrapper);
            break;
        }

        case 'home':
        default:
            cleanupFullscreenViews();
            container.appendChild(HomeView(AppState));
            break;
    }
    
    return container;
}

// Guardar referencia a la vista actual para limpieza
let currentViewElement = null;

/**
 * Renderizar aplicación completa
 */
function renderApp() {
    const appContainer = document.getElementById('app');
    
    // Limpiar vista anterior si existe
    if (currentViewElement && currentViewElement.cleanup) {
        currentViewElement.cleanup();
    }
    
    const appStyles = {
        display: 'flex',
        flexDirection: 'column',
        minHeight: '100vh',
        height: '100%',
        backgroundColor: colors.background,
    };
    
    const viewContainer = renderCurrentView();
    currentViewElement = viewContainer.querySelector('[data-view]') || viewContainer.firstElementChild;
    
    const app = div({
        styles: appStyles,
        children: [viewContainer]
    });
    
    render(appContainer, app);
}

/**
 * Inicializar aplicación
 */
/**
 * Web Bluetooth suelta todas las conexiones al recargar (Ctrl+F5) y el rodillo o el pulsómetro
 * tardan unos segundos en liberar la anterior, así que un único intento al arrancar suele fallar.
 * Reintenta en segundo plano con espera creciente, sin selector (solo dispositivos ya permitidos).
 */
const AUTO_RECONNECT_DELAYS_MS = [1500, 4000, 8000, 15000, 30000];

function startAutoReconnect(targets) {
    targets.forEach(({ manager, disconnected }) => {
        if (!manager?.cachedDevice) return;
        let attempt = 0;
        const tryReconnect = async () => {
            // Si ya se conectó (o el usuario lo está haciendo a mano), no insistir.
            if (manager.state !== disconnected) return;
            try {
                if (await manager.reconnectSilently()) return;
            } catch {
                // reconnectSilently ya registra el motivo
            }
            if (attempt < AUTO_RECONNECT_DELAYS_MS.length) {
                setTimeout(tryReconnect, AUTO_RECONNECT_DELAYS_MS[attempt++]);
            }
        };
        setTimeout(tryReconnect, AUTO_RECONNECT_DELAYS_MS[attempt++]);
    });
}

async function init() {
    startBackgroundSync();
    // El avatar del ciclista se descarga en segundo plano para que la expedición lo tenga listo.
    preloadRiderAvatar();
    preloadBikeModel();
    AppState.progress = migrateProgress(await getProgress().catch(() => null) || {});
    await saveProgress(AppState.progress).catch(() => null);
    AppState.recoveredSession = await getActiveSession().catch(() => null);
    if (AppState.recoveredSession) {
        const variant = AppState.recoveredSession.workoutId?.match(/^(.*)--(\d+)m$/);
        const workoutId = variant?.[1] || AppState.recoveredSession.workoutId;
        const presets = [...getAllPresets(), getCachedPlanWorkout()].filter(Boolean);
        const template = presets.find((workout) => workout.id === workoutId)
            || presets.find((workout) => AppState.recoveredSession.missionId && workout.missionId === AppState.recoveredSession.missionId)
            || null;
        if (template) {
            configureWorkout(template, Number(variant?.[2]) || null);
            AppState.selectedMission = presets.find((workout) => workout.mission?.id === AppState.recoveredSession.missionId)?.mission
                || template.mission
                || presets.find((workout) => workout.mission)?.mission
                || null;
        }
    }
    if (!AppState.selectedMission) AppState.selectedMission = getAllPresets().find((workout) => workout.mission)?.mission || null;
    // Inicializar el router y obtener la vista desde la URL
    const initialView = initRouter();
    AppState.currentView = initialView;
    
    // Configurar handler para cambios de ruta (botón atrás/adelante del navegador)
    setRouteChangeHandler((viewName) => {
        // Usar skipRouter para evitar que navegateTo actualice la URL de nuevo
        navigateTo(viewName, { skipRouter: true });
    });
    
    // Crear instancia del gestor Bluetooth
    AppState.bluetoothManager = new BluetoothManager({
        onStateChange: (state) => {
            AppState.connectionState = state;
            logActiveSessionEvent('app.bluetooth.state', { state, view: AppState.currentView });
            notify();
            // Re-renderizar aquí destruye el SessionController de la expedición
            // justo cuando BLE entra en RECONNECTING. La vista de expedición
            // recibe el cambio mediante subscribe() y conserva el borrador.
            if (!['expedition', 'diagnostics', 'probe', 'cyclist'].includes(AppState.currentView)) renderApp();
        },
        onDeviceConnected: (deviceName) => {
            logActiveSessionEvent('app.bluetooth.connected', { deviceName });
            AppState.deviceName = deviceName;
            AppState.connectionState = CONNECTION_STATE.CONNECTED;
            // Guardar capacidades del dispositivo
            if (AppState.bluetoothManager && AppState.bluetoothManager.capabilities) {
                AppState.deviceCapabilities = AppState.bluetoothManager.capabilities;
            }
            // No iniciar sesión aquí: los datos en vivo (liveData) se actualizan al conectar,
            // pero la sesión (tiempo, distancia, gráfico) solo empieza al entrar en "Entrenamiento".
            AppState.lastDataUpdateTimestamp = Date.now();
            notify();
        },
        onDeviceDisconnected: () => {
            const keepExpeditionOpen = AppState.currentView === 'expedition';
            logActiveSessionEvent('app.bluetooth.disconnected', {
                view: AppState.currentView,
                sessionActive: AppState.session.isActive,
                keepExpeditionOpen,
                elapsedSeconds: AppState.session.elapsedTime,
            });
            AppState.deviceName = null;
            AppState.connectionState = CONNECTION_STATE.DISCONNECTED;
            // Finalizar sesión
            AppState.session.isActive = false;
            AppState.session.isPaused = false;
            AppState.session.startTime = null;
            notify();
            // Una expedición debe poder pausarse y recuperarse tras una pérdida BLE.
            // Las vistas de entrenamiento libre mantienen el comportamiento anterior.
            if (!keepExpeditionOpen) navigateTo('home', { replace: true });
        },
        onDataReceived: (data) => {
            updateLiveData(data);
        },
        onError: (message) => {
            AppState.bluetoothError = message;
            notify();
        },
    });
    
    // Crear instancia del gestor Heart Rate (pulsómetro)
    AppState.heartRateManager = new HeartRateManager({
        onStateChange: (state) => {
            AppState.hrConnectionState = state;
            notify();
            if (!['expedition', 'probe', 'cyclist'].includes(AppState.currentView)) renderApp();
        },
        onDeviceConnected: (deviceName, sensorLocation) => {
            AppState.hrDeviceName = deviceName;
            AppState.hrSensorLocation = sensorLocation;
            AppState.hrConnectionState = HR_CONNECTION_STATE.CONNECTED;
            notify();
        },
        onDeviceDisconnected: () => {
            AppState.hrDeviceName = null;
            AppState.hrSensorLocation = null;
            AppState.hrConnectionState = HR_CONNECTION_STATE.DISCONNECTED;
            // No resetear HR a 0 inmediatamente para evitar parpadeo
            notify();
        },
        onHeartRateReceived: (data) => {
            // Actualizar HR en liveData
            if (data.heartRate !== undefined) {
                AppState.liveData.heartRate = data.heartRate;
                AppState.lastHeartRateUpdateTimestamp = Date.now();
                notify();
            }
        },
    });

    // Gestor Zwift Play (mandos BLE para juego)
    AppState.zwiftPlayManager = new ZwiftPlayManager();
    AppState.zwiftPlayManager.onStateChange = (state) => {
        AppState.zwiftPlayState = state;
        notify();
        if (!['expedition', 'probe', 'cyclist'].includes(AppState.currentView)) renderApp();
    };

    // Cargar configuración guardada
    loadSettings();
    
    // Intentar reconexión automática si hay dispositivo cacheado
    // Nota: Solo funciona si el dispositivo ya fue permitido previamente
    // y getDevices() está disponible (Chrome 85+)
    startAutoReconnect([
        { manager: AppState.bluetoothManager, disconnected: CONNECTION_STATE.DISCONNECTED },
        { manager: AppState.heartRateManager, disconnected: HR_CONNECTION_STATE.DISCONNECTED },
    ]);
    
    renderApp();
    subscribe(() => {});
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState !== 'visible') return;
        if (!AppState.session.isActive || !AppState.session.startTime) return;
        const now = Date.now();
        const pauseDuration = AppState.session.pauseDuration || 0;
        const currentPauseMs = AppState.session.pausedAt ? (now - AppState.session.pausedAt) : 0;
        AppState.session.elapsedTime = Math.floor((now - AppState.session.startTime - pauseDuration - currentPauseMs) / 1000);
        notify();
    });
}

/**
 * Cargar configuración del localStorage
 */
function loadSettings() {
    try {
        const saved = localStorage.getItem('smartTrainer_settings');
        if (saved) {
            AppState.settings = { ...AppState.settings, ...JSON.parse(saved) };
        }
    } catch (e) {
        console.warn('No se pudo cargar la configuración:', e);
    }
}

/**
 * Guardar configuración en localStorage
 */
export function saveSettings(settings) {
    AppState.settings = { ...AppState.settings, ...settings };
    localStorage.setItem('smartTrainer_settings', JSON.stringify(AppState.settings));
    notify();
}

// Iniciar aplicación cuando el DOM esté listo
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}

// Exportar funciones para uso externo
export { AppState, renderApp, HR_CONNECTION_STATE };
