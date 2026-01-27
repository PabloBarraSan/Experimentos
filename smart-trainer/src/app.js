/**
 * Smart Trainer Controller
 * Aplicación principal para controlar el rodillo Decathlon D100
 */

import { colors, spacing, typography, baseStyles, borderRadius, transitions } from './utils/theme.js';
import { createElement, div, render, icon } from './utils/dom.js';
import { BluetoothManager, CONNECTION_STATE } from './bluetooth/scanner.js';
import { HomeView } from './views/HomeView.js';
import { TrainingView } from './views/TrainingView.js';
import { GameView } from './views/GameView.js';
import { calculateKilojoules, calculateCalories } from './utils/calculations.js';

// Estado global de la aplicación
const AppState = {
    currentView: 'home',
    bluetoothManager: null,
    connectionState: CONNECTION_STATE.DISCONNECTED,
    deviceName: null,
    deviceCapabilities: null, // Capacidades del dispositivo
    lastDataUpdateTimestamp: null, // Timestamp de la última actualización de datos
    
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
    
    // Datos de la sesión actual
    session: {
        isActive: false,
        isPaused: false,
        startTime: null,
        elapsedTime: 0,
        dataPoints: [],
        accumulatedDistance: 0, // Distancia acumulada calculada desde velocidad
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
 * Actualizar datos en tiempo real
 */
export function updateLiveData(data) {
    const now = Date.now();
    const previousData = { ...AppState.liveData };
    const previousTimestamp = AppState.lastDataUpdateTimestamp || now;
    
    Object.assign(AppState.liveData, data);
    AppState.lastDataUpdateTimestamp = now;
    
    // Actualizar tiempo transcurrido si la sesión está activa
    if (AppState.session.isActive && AppState.session.startTime) {
        AppState.session.elapsedTime = Math.floor((Date.now() - AppState.session.startTime) / 1000);
    }
    
    // Calcular distancia acumulada si no viene del dispositivo pero tenemos velocidad
    if (AppState.session.isActive && !AppState.session.isPaused) {
        // Calcular distancia basada en velocidad si no está disponible del dispositivo
        if (AppState.liveData.distance === undefined || AppState.liveData.distance === null) {
            // Inicializar distancia acumulada si no existe
            if (AppState.session.accumulatedDistance === undefined) {
                AppState.session.accumulatedDistance = 0;
            }
            
            // Calcular distancia desde la última actualización (en metros)
            // velocidad está en km/h, convertir a m/s: km/h * 1000/3600 = m/s
            const timeDelta = (now - previousTimestamp) / 1000; // segundos
            if (timeDelta > 0 && AppState.liveData.speed > 0) {
                const speedMs = (AppState.liveData.speed * 1000) / 3600; // m/s
                const distanceDelta = speedMs * timeDelta; // metros
                AppState.session.accumulatedDistance += distanceDelta;
                AppState.liveData.distance = Math.round(AppState.session.accumulatedDistance);
            }
        } else {
            // Si el dispositivo envía distancia, usar esa y resetear la acumulada
            AppState.session.accumulatedDistance = AppState.liveData.distance;
        }
        
        // Guardar punto de datos si ha pasado al menos 1 segundo desde el último punto
        const lastPoint = AppState.session.dataPoints[AppState.session.dataPoints.length - 1];
        if (!lastPoint || now - lastPoint.timestamp >= 1000) {
            AppState.session.dataPoints.push({
                timestamp: now,
                ...AppState.liveData,
            });
            // Limitar a los últimos 5 minutos de datos (300 puntos a 1 por segundo)
            if (AppState.session.dataPoints.length > 300) {
                AppState.session.dataPoints.shift();
            }
            
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
    renderApp();
}

/**
 * Navegar al modo juego
 */
export function navigateToGame() {
    navigateTo('game');
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
                styles: statusStyles,
                children: [
                    statusDot,
                    createElement('span', { text: status.text, styles: { color: status.color } }),
                ]
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
    
    switch (AppState.currentView) {
        case 'game':
            // GameView se renderiza a pantalla completa, no necesita contenedor
            const gameView = GameView({
                state: AppState,
                onExit: () => {
                    navigateTo('training');
                }
            });
            // Limpiar contenedor anterior si existe
            const existingGameView = document.querySelector('[data-game-view]');
            if (existingGameView) {
                if (existingGameView.cleanup) {
                    existingGameView.cleanup();
                }
                existingGameView.remove();
            }
            gameView.setAttribute('data-game-view', 'true');
            document.body.appendChild(gameView);
            return container; // Retornar contenedor vacío ya que GameView se añade al body
        case 'training':
            // Limpiar GameView si existe
            const gameViewToRemove = document.querySelector('[data-game-view]');
            if (gameViewToRemove) {
                if (gameViewToRemove.cleanup) {
                    gameViewToRemove.cleanup();
                }
                gameViewToRemove.remove();
            }
            container.appendChild(TrainingView(AppState));
            break;
        case 'home':
        default:
            // Limpiar GameView si existe
            const gameViewToRemove2 = document.querySelector('[data-game-view]');
            if (gameViewToRemove2) {
                if (gameViewToRemove2.cleanup) {
                    gameViewToRemove2.cleanup();
                }
                gameViewToRemove2.remove();
            }
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
            // Iniciar sesión cuando se conecta el dispositivo
            AppState.session.isActive = true;
            AppState.session.isPaused = false;
            AppState.session.startTime = Date.now();
            AppState.session.elapsedTime = 0;
            AppState.session.dataPoints = [];
            AppState.session.accumulatedDistance = 0;
            AppState.lastDataUpdateTimestamp = Date.now();
            notify();
            // No navegar automáticamente - permitir que el usuario elija entre entrenamiento y modo juego
            // navigateTo('training');
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
export { AppState, renderApp };
