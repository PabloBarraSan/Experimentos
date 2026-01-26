/**
 * Smart Trainer Controller
 * Aplicación principal para controlar el rodillo Decathlon D100
 */

import { colors, spacing, typography, baseStyles, borderRadius, transitions } from './utils/theme.js';
import { createElement, div, render, icon } from './utils/dom.js';
import { BluetoothManager, CONNECTION_STATE } from './bluetooth/scanner.js';
import { HomeView } from './views/HomeView.js';
import { TrainingView } from './views/TrainingView.js';

// Estado global de la aplicación
const AppState = {
    currentView: 'home',
    bluetoothManager: null,
    connectionState: CONNECTION_STATE.DISCONNECTED,
    deviceName: null,
    
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
    Object.assign(AppState.liveData, data);
    
    // Guardar punto de datos si la sesión está activa
    if (AppState.session.isActive && !AppState.session.isPaused) {
        AppState.session.dataPoints.push({
            timestamp: Date.now(),
            ...AppState.liveData,
        });
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
                return { text: 'Conectando...', color: colors.warning };
            case CONNECTION_STATE.SCANNING:
                return { text: 'Buscando...', color: colors.warning };
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
        case 'training':
            container.appendChild(TrainingView(AppState));
            break;
        case 'home':
        default:
            container.appendChild(HomeView(AppState));
            break;
    }
    
    return container;
}

/**
 * Renderizar aplicación completa
 */
function renderApp() {
    const appContainer = document.getElementById('app');
    
    const appStyles = {
        display: 'flex',
        flexDirection: 'column',
        minHeight: '100vh',
        backgroundColor: colors.background,
    };
    
    const app = div({
        styles: appStyles,
        children: [
            renderHeader(),
            renderCurrentView(),
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
            navigateTo('training');
        },
        onDeviceDisconnected: () => {
            AppState.deviceName = null;
            AppState.connectionState = CONNECTION_STATE.DISCONNECTED;
            navigateTo('home');
        },
        onDataReceived: (data) => {
            updateLiveData(data);
        },
    });
    
    // Cargar configuración guardada
    loadSettings();
    
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
