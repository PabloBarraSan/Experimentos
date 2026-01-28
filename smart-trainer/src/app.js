/**
 * Smart Trainer Controller
 * Aplicación principal para controlar el rodillo Decathlon D100
 */

import { colors, spacing, typography, baseStyles, borderRadius, transitions } from './utils/theme.js';
import { createElement, div, render, icon } from './utils/dom.js';
import { BluetoothManager, CONNECTION_STATE } from './bluetooth/scanner.js';
import { HeartRateManager, HR_CONNECTION_STATE } from './bluetooth/heartRate.js';
import { HomeView } from './views/HomeView.js';
import { TrainingView } from './views/TrainingView.js';
import { GameView } from './views/GameView.js';
import { RideView } from './views/RideView.js';
import { calculateKilojoules, calculateCalories } from './utils/calculations.js';

// Estado global de la aplicación
const AppState = {
    currentView: 'home',
    bluetoothManager: null,
    connectionState: CONNECTION_STATE.DISCONNECTED,
    deviceName: null,
    deviceCapabilities: null, // Capacidades del dispositivo
    lastDataUpdateTimestamp: null, // Timestamp de la última actualización de datos
    
    // Heart Rate Monitor (pulsómetro separado)
    heartRateManager: null,
    hrConnectionState: HR_CONNECTION_STATE.DISCONNECTED,
    hrDeviceName: null,
    hrSensorLocation: null,
    
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
        units: 'metric',
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

    Object.assign(AppState.liveData, data);
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

/**
 * Navegar a una vista
 */
export function navigateTo(viewName) {
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
 * Renderizar header de la aplicación
 */
function renderHeader() {
    const headerStyles = {
        ...baseStyles.flexBetween,
        padding: `${spacing.md} ${spacing.lg}`,
        backgroundColor: colors.surface,
        borderBottom: `1px solid ${colors.border}`,
        position: 'sticky',
        top: '0',
        zIndex: '100',
    };
    
    const logoStyles = {
        ...baseStyles.flexCenter,
        gap: spacing.sm,
        fontSize: typography.sizes.lg,
        fontWeight: typography.weights.bold,
        color: colors.primary,
    };
    
    const statusStyles = {
        ...baseStyles.flexCenter,
        gap: spacing.sm,
        fontSize: typography.sizes.sm,
        color: colors.textMuted,
    };
    
    const getStatusInfo = () => {
        switch (AppState.connectionState) {
            case CONNECTION_STATE.CONNECTED:
                return { text: AppState.deviceName || 'Conectado', color: colors.success };
            case CONNECTION_STATE.CONNECTING:
            case CONNECTION_STATE.CONNECTING_GATT:
                return { text: 'Conectando...', color: colors.warning };
            case CONNECTION_STATE.DISCOVERING_SERVICES:
                return { text: 'Descubriendo...', color: colors.warning };
            case CONNECTION_STATE.SUBSCRIBING:
                return { text: 'Configurando...', color: colors.warning };
            case CONNECTION_STATE.SCANNING:
                return { text: 'Buscando...', color: colors.warning };
            case CONNECTION_STATE.RECONNECTING:
                return { text: 'Reconectando...', color: colors.warning };
            default:
                return { text: 'Desconectado', color: colors.textMuted };
        }
    };
    
    const status = getStatusInfo();
    
    const statusDot = div({
        styles: {
            width: '8px',
            height: '8px',
            borderRadius: borderRadius.full,
            backgroundColor: status.color,
        }
    });
    
    // Estado del pulsómetro
    const isHRConnected = AppState.hrConnectionState === HR_CONNECTION_STATE.CONNECTED;
    const hrIndicator = isHRConnected ? div({
        styles: {
            ...baseStyles.flexCenter,
            gap: '4px',
            padding: '2px 8px',
            backgroundColor: 'rgba(255, 82, 82, 0.15)',
            borderRadius: borderRadius.full,
            marginLeft: spacing.sm,
        },
        children: [
            icon('heart', 14, '#ff5252'),
            createElement('span', { 
                text: AppState.liveData.heartRate || '--', 
                styles: { 
                    color: '#ff5252', 
                    fontSize: typography.sizes.xs,
                    fontWeight: typography.weights.semibold,
                } 
            }),
        ]
    }) : null;
    
    return div({
        styles: headerStyles,
        children: [
            div({
                styles: logoStyles,
                children: [
                    icon('bike', 28, colors.primary),
                    createElement('span', { text: 'Smart Trainer' }),
                ]
            }),
            div({
                styles: {
                    ...statusStyles,
                    gap: spacing.md,
                },
                children: [
                    // HR indicator (si conectado)
                    hrIndicator,
                    // Separador visual si hay HR
                    isHRConnected ? div({
                        styles: {
                            width: '1px',
                            height: '20px',
                            backgroundColor: colors.border,
                        }
                    }) : null,
                    // Estado del rodillo
                    div({
                        styles: {
                            ...baseStyles.flexCenter,
                            gap: spacing.xs,
                        },
                        children: [
                            statusDot,
                            createElement('span', { text: status.text, styles: { color: status.color } }),
                        ]
                    }),
                ].filter(Boolean)
            }),
        ]
    });
}

/**
 * Renderizar vista actual
 */
function renderCurrentView() {
    const container = div({
        styles: {
            flex: '1',
            overflow: 'auto',
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
    };
    
    switch (AppState.currentView) {
        case 'game':
            // GameView se renderiza a pantalla completa
            cleanupFullscreenViews();
            const gameView = GameView({
                state: AppState,
                onExit: () => {
                    navigateTo('training');
                }
            });
            gameView.setAttribute('data-game-view', 'true');
            document.body.appendChild(gameView);
            return container; // Retornar contenedor vacío
            
        case 'ride':
            // RideView se renderiza a pantalla completa
            cleanupFullscreenViews();
            const rideView = RideView({
                state: AppState,
                onExit: () => {
                    navigateTo('home');
                },
                onSimulationUpdate: (params) => {
                    // Enviar parámetros de simulación al rodillo
                    if (AppState.bluetoothManager && AppState.bluetoothManager.commandQueue) {
                        AppState.bluetoothManager.commandQueue.setIndoorBikeSimulation(
                            params.windSpeed,
                            params.grade,
                            params.crr,
                            params.cw
                        ).catch(err => {
                            // Silenciar errores - el rodillo puede no soportar simulación
                            console.debug('Simulación no soportada:', err.message);
                        });
                    }
                }
            });
            rideView.setAttribute('data-ride-view', 'true');
            document.body.appendChild(rideView);
            return container; // Retornar contenedor vacío
            
        case 'training':
            cleanupFullscreenViews();
            container.appendChild(TrainingView(AppState));
            break;
            
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
        backgroundColor: colors.background,
    };
    
    const viewContainer = renderCurrentView();
    currentViewElement = viewContainer.querySelector('[data-view]') || viewContainer.firstElementChild;
    
    const app = div({
        styles: appStyles,
        children: [
            renderHeader(),
            viewContainer,
        ]
    });
    
    render(appContainer, app);
}

/**
 * Inicializar aplicación
 */
async function init() {
    console.log('🚴 Smart Trainer Controller iniciando...');
    
    // Crear instancia del gestor Bluetooth
    AppState.bluetoothManager = new BluetoothManager({
        onStateChange: (state) => {
            AppState.connectionState = state;
            notify();
            renderApp();
        },
        onDeviceConnected: (deviceName) => {
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
            AppState.deviceName = null;
            AppState.connectionState = CONNECTION_STATE.DISCONNECTED;
            // Finalizar sesión
            AppState.session.isActive = false;
            AppState.session.isPaused = false;
            AppState.session.startTime = null;
            notify();
            navigateTo('home');
        },
        onDataReceived: (data) => {
            updateLiveData(data);
        },
    });
    
    // Crear instancia del gestor Heart Rate (pulsómetro)
    AppState.heartRateManager = new HeartRateManager({
        onStateChange: (state) => {
            AppState.hrConnectionState = state;
            notify();
            renderApp();
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
                notify();
            }
        },
    });
    
    // Cargar configuración guardada
    loadSettings();
    
    // Intentar reconexión automática si hay dispositivo cacheado
    // Nota: Solo funciona si el dispositivo ya fue permitido previamente
    // y getDevices() está disponible (Chrome 85+)
    if (AppState.bluetoothManager && AppState.bluetoothManager.cachedDevice) {
        // Intentar reconexión silenciosa en segundo plano (no bloquear la UI)
        AppState.bluetoothManager.reconnectSilently().catch(error => {
            // Silenciar errores de reconexión automática - es normal que falle
            console.log('Reconexión automática no disponible:', error.message);
        });
    }
    
    // Renderizar app inicial
    renderApp();
    
    // Suscribirse a cambios para re-renderizar
    subscribe(() => {
        // Solo re-renderizar componentes específicos, no toda la app
        // Esto se optimizará más adelante
    });
    
    // Mantener sesión correcta al volver de segundo plano: recalcular tiempo y notificar
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState !== 'visible') return;
        if (!AppState.session.isActive || !AppState.session.startTime) return;
        const now = Date.now();
        const pauseDuration = AppState.session.pauseDuration || 0;
        const currentPauseMs = AppState.session.pausedAt ? (now - AppState.session.pausedAt) : 0;
        AppState.session.elapsedTime = Math.floor((now - AppState.session.startTime - pauseDuration - currentPauseMs) / 1000);
        notify();
    });
    
    console.log('✅ Smart Trainer Controller listo');
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
