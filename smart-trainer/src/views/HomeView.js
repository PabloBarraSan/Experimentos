/**
 * HomeView - Vista de inicio/conexión
 * Smart Trainer Controller
 */

import { colors, spacing, typography, baseStyles, borderRadius, transitions, shadows } from '../utils/theme.js';
import { createElement, div, button, icon } from '../utils/dom.js';
import { checkBluetoothSupport } from '../bluetooth/scanner.js';
import { GameModeButton } from './GameView.js';
import { navigateToGame, navigateTo, getState } from '../app.js';
import { CONNECTION_STATE } from '../bluetooth/scanner.js';

/**
 * Vista de inicio con botón de conexión
 */
export function HomeView(state) {
    const bluetoothSupport = checkBluetoothSupport();
    
    // Estado para el botón de instalación PWA
    let installButtonContainer = null;
    let showInstallButton = false;
    
    // Verificar si la PWA está instalable
    const checkInstallable = () => {
        // Verificar si ya está instalada
        if (window.matchMedia('(display-mode: standalone)').matches || 
            window.navigator.standalone === true) {
            return false; // Ya está instalada
        }
        
        // Verificar si hay un deferredPrompt disponible
        return typeof window.installPWA === 'function';
    };
    
    // Escuchar eventos de instalación
    const handleInstallable = () => {
        showInstallButton = true;
        if (installButtonContainer) {
            installButtonContainer.style.display = 'flex';
        }
    };
    
    const handleInstalled = () => {
        showInstallButton = false;
        if (installButtonContainer) {
            installButtonContainer.style.display = 'none';
        }
    };
    
    // Guardar referencias a los handlers para poder eliminarlos
    const installableHandler = handleInstallable;
    const installedHandler = handleInstalled;
    
    window.addEventListener('pwa-installable', installableHandler);
    window.addEventListener('pwa-installed', installedHandler);
    
    // Verificar al cargar
    showInstallButton = checkInstallable();
    
    const containerStyles = {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: 'calc(100vh - 60px)',
        padding: spacing.xl,
        textAlign: 'center',
    };
    
    const logoContainerStyles = {
        marginBottom: spacing.xl,
    };
    
    const logoStyles = {
        width: '120px',
        height: '120px',
        borderRadius: borderRadius.full,
        backgroundColor: colors.surface,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: spacing.lg,
        border: `2px solid ${colors.primary}`,
        boxShadow: shadows.glow(colors.primary),
    };
    
    const titleStyles = {
        fontSize: typography.sizes.xxl,
        fontWeight: typography.weights.bold,
        color: colors.text,
        marginBottom: spacing.sm,
    };
    
    const subtitleStyles = {
        fontSize: typography.sizes.md,
        color: colors.textMuted,
        marginBottom: spacing.xxl,
        maxWidth: '400px',
    };
    
    const connectButtonStyles = {
        ...baseStyles.button,
        ...baseStyles.buttonPrimary,
        padding: `${spacing.md} ${spacing.xl}`,
        fontSize: typography.sizes.lg,
        fontWeight: typography.weights.bold,
        gap: spacing.sm,
        minWidth: '250px',
        boxShadow: shadows.glow(colors.primary),
        transition: transitions.normal,
    };
    
    const disabledButtonStyles = {
        ...connectButtonStyles,
        backgroundColor: colors.surfaceLight,
        color: colors.textMuted,
        cursor: 'not-allowed',
        boxShadow: 'none',
    };
    
    const errorBoxStyles = {
        ...baseStyles.card,
        backgroundColor: 'rgba(255, 68, 68, 0.1)',
        borderColor: colors.error,
        maxWidth: '400px',
        marginTop: spacing.lg,
    };
    
    const instructionsStyles = {
        marginTop: spacing.xxl,
        padding: spacing.lg,
        backgroundColor: colors.surface,
        borderRadius: borderRadius.lg,
        maxWidth: '500px',
        textAlign: 'left',
    };
    
    const instructionsTitleStyles = {
        fontSize: typography.sizes.lg,
        fontWeight: typography.weights.semibold,
        color: colors.text,
        marginBottom: spacing.md,
    };
    
    const instructionsListStyles = {
        listStyle: 'none',
        padding: '0',
        margin: '0',
    };
    
    const instructionItemStyles = {
        display: 'flex',
        alignItems: 'flex-start',
        gap: spacing.sm,
        marginBottom: spacing.sm,
        color: colors.textMuted,
        fontSize: typography.sizes.sm,
    };
    
    // Crear elementos
    const container = div({ 
        styles: containerStyles,
        attrs: { 'data-view': 'home' }
    });
    
    // Logo
    const logoContainer = div({
        styles: logoContainerStyles,
        children: [
            div({
                styles: logoStyles,
                children: [icon('bike', 64, colors.primary)]
            }),
            createElement('h1', { text: 'Smart Trainer', styles: titleStyles }),
            createElement('p', { 
                text: 'Conecta tu rodillo Decathlon D100 y comienza a entrenar', 
                styles: subtitleStyles 
            }),
        ]
    });
    container.appendChild(logoContainer);
    
    // Botón de instalación PWA
    const installButtonStyles = {
        ...baseStyles.button,
        backgroundColor: colors.surface,
        color: colors.text,
        border: `1px solid ${colors.border}`,
        padding: `${spacing.sm} ${spacing.md}`,
        fontSize: typography.sizes.sm,
        fontWeight: typography.weights.medium,
        gap: spacing.xs,
        marginBottom: spacing.md,
        minWidth: '200px',
    };
    
    installButtonContainer = div({
        styles: {
            display: showInstallButton ? 'flex' : 'none',
            justifyContent: 'center',
            marginBottom: spacing.md,
        },
        children: [
            button({
                styles: installButtonStyles,
                children: [
                    icon('download', 18, colors.primary),
                    createElement('span', { text: 'Instalar App' }),
                ],
                events: {
                    click: async () => {
                        if (window.installPWA) {
                            await window.installPWA();
                        }
                    },
                }
            })
        ]
    });
    container.appendChild(installButtonContainer);
    
    // Verificar si hay dispositivo cacheado
    const hasCachedDevice = state.bluetoothManager?.cachedDevice;
    const connectionState = state.connectionState || CONNECTION_STATE.DISCONNECTED;
    
    // Indicador de progreso de conexión
    const getConnectionStatusText = () => {
        switch (connectionState) {
            case CONNECTION_STATE.SCANNING:
                return 'Buscando dispositivos...';
            case CONNECTION_STATE.CONNECTING:
            case CONNECTION_STATE.CONNECTING_GATT:
                return 'Conectando...';
            case CONNECTION_STATE.DISCOVERING_SERVICES:
                return 'Descubriendo servicios...';
            case CONNECTION_STATE.SUBSCRIBING:
                return 'Configurando notificaciones...';
            case CONNECTION_STATE.RECONNECTING:
                return 'Reconectando...';
            default:
                return null;
        }
    };
    
    const statusText = getConnectionStatusText();
    const isConnecting = [
        CONNECTION_STATE.SCANNING,
        CONNECTION_STATE.CONNECTING,
        CONNECTION_STATE.CONNECTING_GATT,
        CONNECTION_STATE.DISCOVERING_SERVICES,
        CONNECTION_STATE.SUBSCRIBING,
        CONNECTION_STATE.RECONNECTING,
    ].includes(connectionState);
    
    // Mostrar indicador de progreso si está conectando
    if (isConnecting && statusText) {
        const progressContainer = div({
            styles: {
                ...baseStyles.card,
                padding: spacing.md,
                marginBottom: spacing.md,
                maxWidth: '400px',
                textAlign: 'center',
            },
            children: [
                div({
                    styles: {
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: spacing.sm,
                        color: colors.primary,
                    },
                    children: [
                        div({
                            styles: {
                                width: '20px',
                                height: '20px',
                                border: `3px solid ${colors.primary}20`,
                                borderTopColor: colors.primary,
                                borderRadius: borderRadius.full,
                                animation: 'spin 1s linear infinite',
                            }
                        }),
                        createElement('span', {
                            text: statusText,
                            styles: {
                                fontSize: typography.sizes.sm,
                                fontWeight: typography.weights.medium,
                            }
                        }),
                    ]
                }),
            ]
        });
        
        // Añadir animación CSS si no existe
        if (!document.getElementById('connection-spinner-style')) {
            const style = document.createElement('style');
            style.id = 'connection-spinner-style';
            style.textContent = `
                @keyframes spin {
                    to { transform: rotate(360deg); }
                }
            `;
            document.head.appendChild(style);
        }
        
        container.appendChild(progressContainer);
    }
    
    // Botón de conexión o mensaje de error
    if (bluetoothSupport.supported) {
        const buttonContainer = div({
            styles: {
                display: 'flex',
                flexDirection: 'column',
                gap: spacing.md,
                alignItems: 'center',
                width: '100%',
                maxWidth: '400px',
            }
        });
        
        // Botón principal de conexión
        const connectBtn = button({
            styles: {
                ...connectButtonStyles,
                opacity: isConnecting ? 0.6 : 1,
                cursor: isConnecting ? 'not-allowed' : 'pointer',
            },
            children: [
                icon('bluetooth', 24, colors.background),
                createElement('span', { 
                    text: hasCachedDevice && !isConnecting 
                        ? `Conectar a ${hasCachedDevice.name || 'Dispositivo'}` 
                        : 'Conectar Rodillo' 
                }),
            ],
            events: {
                click: async () => {
                    if (isConnecting) return;
                    try {
                        // Si hay dispositivo cacheado, intentar reconexión silenciosa primero
                        if (hasCachedDevice) {
                            const device = await state.bluetoothManager.reconnectSilently();
                            if (device) {
                                // Reconexión silenciosa exitosa, no hacer nada más
                                return;
                            }
                            // Si falla, intentar reconexión con selector
                            await state.bluetoothManager.reconnectToCachedDevice();
                        } else {
                            // No hay dispositivo cacheado, buscar nuevo
                            await state.bluetoothManager.scan();
                        }
                    } catch (error) {
                        // El usuario canceló o hubo un error
                        if (error.name !== 'NotFoundError') {
                            console.log('Conexión cancelada o error:', error.message);
                        }
                    }
                },
                mouseenter: (e) => {
                    if (!isConnecting) {
                        e.target.style.transform = 'scale(1.05)';
                    }
                },
                mouseleave: (e) => {
                    e.target.style.transform = 'scale(1)';
                },
            }
        });
        buttonContainer.appendChild(connectBtn);
        container.appendChild(buttonContainer);
    } else {
        const disabledBtn = button({
            styles: disabledButtonStyles,
            children: [
                icon('x', 24, colors.textMuted),
                createElement('span', { text: 'Bluetooth No Disponible' }),
            ],
            attrs: { disabled: 'true' }
        });
        container.appendChild(disabledBtn);
        
        const errorBox = div({
            styles: errorBoxStyles,
            children: [
                createElement('p', {
                    text: bluetoothSupport.reason,
                    styles: { color: colors.error, fontSize: typography.sizes.sm }
                })
            ]
        });
        container.appendChild(errorBox);
    }
    
    // Sección de Modos de Entrenamiento
    const trainingModesStyles = {
        marginTop: spacing.xxl,
        padding: spacing.lg,
        backgroundColor: colors.surface,
        borderRadius: borderRadius.lg,
        maxWidth: '500px',
        width: '100%',
    };
    
    const trainingModesTitleStyles = {
        fontSize: typography.sizes.lg,
        fontWeight: typography.weights.semibold,
        color: colors.text,
        marginBottom: spacing.md,
        textAlign: 'center',
    };
    
    const isConnected = state && state.connectionState === CONNECTION_STATE.CONNECTED;
    
    const trainingModes = div({
        styles: trainingModesStyles,
        children: [
            createElement('h3', { text: 'Modos de Entrenamiento', styles: trainingModesTitleStyles }),
            div({
                styles: {
                    display: 'flex',
                    flexDirection: 'column',
                    gap: spacing.md,
                    alignItems: 'center',
                },
                children: [
                    // Botón de Entrenamiento (solo visible cuando está conectado)
                    isConnected && button({
                        styles: {
                            ...baseStyles.button,
                            ...baseStyles.buttonPrimary,
                            padding: `${spacing.md} ${spacing.lg}`,
                            fontSize: typography.sizes.md,
                            fontWeight: typography.weights.bold,
                            gap: spacing.sm,
                            minWidth: '250px',
                            width: '100%',
                        },
                        children: [
                            icon('activity', 20, colors.background),
                            createElement('span', { text: 'Entrenamiento' }),
                        ],
                        events: {
                            click: () => {
                                navigateTo('training');
                            },
                        }
                    }),
                    // Botón de Modo Juego
                    GameModeButton({
                        onClick: () => {
                            if (isConnected) {
                                navigateToGame();
                            } else {
                                alert('Por favor, conecta tu rodillo primero para usar el modo juego.');
                            }
                        },
                        disabled: !isConnected,
                    }),
                    !isConnected && createElement('p', {
                        text: 'Conecta tu rodillo para habilitar los modos de entrenamiento',
                        styles: {
                            fontSize: typography.sizes.sm,
                            color: colors.textMuted,
                            marginTop: spacing.xs,
                            textAlign: 'center',
                        }
                    }),
                ].filter(Boolean)
            }),
        ]
    });
    container.appendChild(trainingModes);
    
    // Instrucciones
    const instructions = div({
        styles: instructionsStyles,
        children: [
            createElement('h3', { text: 'Instrucciones', styles: instructionsTitleStyles }),
            createElement('ul', {
                styles: instructionsListStyles,
                children: [
                    createElement('li', {
                        styles: instructionItemStyles,
                        children: [
                            createElement('span', { text: '1.', styles: { color: colors.primary, fontWeight: typography.weights.bold } }),
                            createElement('span', { text: 'Enciende tu rodillo Decathlon D100 y asegúrate de que el Bluetooth esté activo.' }),
                        ]
                    }),
                    createElement('li', {
                        styles: instructionItemStyles,
                        children: [
                            createElement('span', { text: '2.', styles: { color: colors.primary, fontWeight: typography.weights.bold } }),
                            createElement('span', { text: 'Haz clic en "Conectar Rodillo" y selecciona tu dispositivo de la lista.' }),
                        ]
                    })
                ]
            }),
        ]
    });
    container.appendChild(instructions);
    
    // Función de limpieza para eliminar event listeners
    container.cleanup = () => {
        window.removeEventListener('pwa-installable', installableHandler);
        window.removeEventListener('pwa-installed', installedHandler);
    };
    
    return container;
}
