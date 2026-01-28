/**
 * HomeView - Vista de inicio/conexión
 * Smart Trainer Controller
 */

import { colors, spacing, typography, baseStyles, borderRadius, transitions, shadows, premiumCardStyles, premiumConnectButtonStyles } from '../utils/theme.js';
import { createElement, div, button, icon } from '../utils/dom.js';
import { checkBluetoothSupport, CONNECTION_STATE } from '../bluetooth/scanner.js';
import { HR_CONNECTION_STATE } from '../bluetooth/heartRate.js';
import { GameModeButton } from './GameView.js';
import { RideModeButton } from './RideView.js';
import { navigateToGame, navigateTo, navigateToRide, getState } from '../app.js';

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
    
    const isConnected = state && state.connectionState === CONNECTION_STATE.CONNECTED;
    
    const titleStyles = {
        fontFamily: typography.fontDisplay,
        fontSize: typography.sizes.xxl,
        fontWeight: 800,
        color: colors.text,
        marginBottom: spacing.sm,
        letterSpacing: '-0.02em',
    };
    
    const subtitleStyles = {
        fontSize: typography.sizes.md,
        color: colors.textMuted,
        marginBottom: spacing.xxl,
        maxWidth: '400px',
    };
    
    const connectButtonStyles = {
        ...baseStyles.button,
        ...premiumConnectButtonStyles,
        padding: `${spacing.md} ${spacing.xl}`,
        fontSize: typography.sizes.lg,
        fontWeight: 800,
        gap: spacing.sm,
        minWidth: '250px',
        transition: 'transform 0.3s ease, box-shadow 0.3s ease, opacity 0.35s ease',
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
    
    // Crear elementos
    const container = div({ 
        styles: containerStyles,
        attrs: { 'data-view': 'home', class: 'home-view-bg' }
    });
    
    // Banner PWA (elegante en la parte superior, no compite con Conectar)
    installButtonContainer = div({
        styles: {
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            display: showInstallButton ? 'flex' : 'none',
            justifyContent: 'center',
            alignItems: 'center',
            padding: spacing.sm,
            background: 'linear-gradient(180deg, rgba(0,0,0,0.5) 0%, transparent 100%)',
            backdropFilter: 'blur(8px)',
            zIndex: 10,
        },
        children: [
            button({
                styles: {
                    ...baseStyles.button,
                    background: 'rgba(35,35,35,0.85)',
                    color: colors.text,
                    border: `1px solid ${colors.border}80`,
                    padding: `${spacing.xs} ${spacing.md}`,
                    fontSize: typography.sizes.xs,
                    fontWeight: typography.weights.medium,
                    gap: spacing.xs,
                    borderRadius: borderRadius.full,
                },
                children: [
                    icon('download', 14, colors.primary),
                    createElement('span', { text: 'Instalar App' }),
                ],
                events: {
                    click: async () => {
                        if (window.installPWA) await window.installPWA();
                    },
                },
            }),
        ],
    });
    container.style.position = 'relative';
    container.appendChild(installButtonContainer);
    
    // Logo
    const logoContainer = div({
        styles: logoContainerStyles,
        children: [
            createElement('h1', { text: 'Smart Trainer', styles: titleStyles }),
            createElement('p', { 
                text: 'Conecta tu rodillo Decathlon D100 y comienza a entrenar', 
                styles: subtitleStyles 
            }),
        ]
    });
    container.appendChild(logoContainer);
    
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
    
    // Haptic feedback al conectar con éxito (PWA/móvil)
    const triggerHapticSuccess = () => {
        if (typeof navigator !== 'undefined' && navigator.vibrate) {
            navigator.vibrate([50, 30, 50]);
        }
    };
    
    // Estado del pulsómetro
    const hrConnectionState = state.hrConnectionState || HR_CONNECTION_STATE.DISCONNECTED;
    const isHRConnected = hrConnectionState === HR_CONNECTION_STATE.CONNECTED;
    const isHRConnecting = [
        HR_CONNECTION_STATE.SCANNING,
        HR_CONNECTION_STATE.CONNECTING,
        HR_CONNECTION_STATE.RECONNECTING,
    ].includes(hrConnectionState);
    const hasCachedHRDevice = state.heartRateManager?.cachedDevice;
    
    const getHRStatusText = () => {
        switch (hrConnectionState) {
            case HR_CONNECTION_STATE.SCANNING:
                return 'Buscando pulsómetro...';
            case HR_CONNECTION_STATE.CONNECTING:
                return 'Conectando...';
            case HR_CONNECTION_STATE.RECONNECTING:
                return 'Reconectando...';
            default:
                return null;
        }
    };
    const hrStatusText = getHRStatusText();
    
    // Conexión: si ya está conectado, mostrar estado "Conectado a [nombre]"; si no, botón Conectar
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
        
        if (isConnected) {
            // Ya conectado: mostrar estado, no el botón "Conectar a Van Rysel"
            const deviceName = hasCachedDevice?.name || 'Rodillo';
            const connectedStatus = div({
                styles: {
                    ...baseStyles.card,
                    display: 'flex',
                    alignItems: 'center',
                    gap: spacing.sm,
                    padding: spacing.md,
                    backgroundColor: 'rgba(0, 212, 170, 0.12)',
                    borderColor: `${colors.primary}60`,
                },
                children: [
                    icon('check', 24, colors.primary),
                    createElement('span', {
                        text: `Conectado a ${deviceName}`,
                        styles: {
                            fontSize: typography.sizes.md,
                            fontWeight: typography.weights.semibold,
                            color: colors.text,
                        }
                    }),
                ]
            });
            buttonContainer.appendChild(connectedStatus);
        } else {
            // No conectado: botón principal de conexión (spinner dentro cuando isConnecting)
            const connectBtn = button({
                className: !isConnecting ? 'connect-btn-pro' : '',
                styles: {
                    ...connectButtonStyles,
                    opacity: isConnecting ? 0.85 : 1,
                    cursor: isConnecting ? 'not-allowed' : 'pointer',
                    minWidth: isConnecting ? '280px' : '250px',
                    transition: 'min-width 0.35s ease, opacity 0.35s ease',
                },
                children: isConnecting && statusText
                    ? [
                        div({
                            styles: {
                                width: '22px',
                                height: '22px',
                                border: `3px solid ${colors.primary}40`,
                                borderTopColor: colors.primary,
                                borderRadius: borderRadius.full,
                                flexShrink: 0,
                                animation: 'spin 1s linear infinite',
                            }
                        }),
                        createElement('span', {
                            text: statusText,
                            styles: {
                                fontSize: typography.sizes.sm,
                                fontWeight: typography.weights.semibold,
                                color: '#000',
                            }
                        }),
                    ]
                    : [
                        icon('bluetooth', 24, '#000'),
                        createElement('span', { text: 'Conectar Rodillo' }),
                    ],
                events: {
                    click: async () => {
                        if (isConnecting) return;
                        try {
                            if (hasCachedDevice) {
                                const device = await state.bluetoothManager.reconnectSilently();
                                if (device) {
                                    triggerHapticSuccess();
                                    return;
                                }
                                await state.bluetoothManager.reconnectToCachedDevice();
                            } else {
                                await state.bluetoothManager.scan();
                            }
                            triggerHapticSuccess();
                        } catch (error) {
                            if (error.name !== 'NotFoundError') {
                                console.log('Conexión cancelada o error:', error.message);
                            }
                        }
                    },
                    mouseenter: (e) => {
                        if (!isConnecting) e.target.style.transform = 'scale(1.05)';
                    },
                    mouseleave: (e) => {
                        e.target.style.transform = 'scale(1)';
                    },
                }
            });
            buttonContainer.appendChild(connectBtn);
        }
        
        // Botón de pulsómetro (siempre visible, estilo secundario)
        const hrButtonStyles = {
            ...baseStyles.button,
            padding: `${spacing.sm} ${spacing.lg}`,
            fontSize: typography.sizes.sm,
            fontWeight: typography.weights.semibold,
            gap: spacing.sm,
            minWidth: '220px',
            background: isHRConnected 
                ? 'rgba(255, 82, 82, 0.15)' 
                : 'rgba(255, 82, 82, 0.08)',
            border: `1px solid ${isHRConnected ? 'rgba(255, 82, 82, 0.5)' : 'rgba(255, 82, 82, 0.3)'}`,
            color: isHRConnected ? '#ff5252' : colors.text,
            borderRadius: borderRadius.lg,
            transition: 'all 0.3s ease',
        };
        
        if (isHRConnected) {
            // Mostrar estado conectado del pulsómetro
            const hrDeviceName = state.hrDeviceName || hasCachedHRDevice?.name || 'Pulsómetro';
            const hrConnectedStatus = div({
                styles: {
                    ...baseStyles.card,
                    display: 'flex',
                    alignItems: 'center',
                    gap: spacing.sm,
                    padding: spacing.sm,
                    paddingLeft: spacing.md,
                    paddingRight: spacing.md,
                    backgroundColor: 'rgba(255, 82, 82, 0.12)',
                    borderColor: 'rgba(255, 82, 82, 0.4)',
                    cursor: 'pointer',
                },
                children: [
                    icon('heart', 18, '#ff5252'),
                    createElement('span', {
                        text: hrDeviceName,
                        styles: {
                            fontSize: typography.sizes.sm,
                            fontWeight: typography.weights.medium,
                            color: colors.text,
                        }
                    }),
                    // Botón desconectar pequeño
                    div({
                        styles: {
                            marginLeft: 'auto',
                            padding: spacing.xs,
                            cursor: 'pointer',
                            opacity: 0.6,
                            transition: 'opacity 0.2s',
                        },
                        children: [icon('x', 14, colors.textMuted)],
                        events: {
                            click: (e) => {
                                e.stopPropagation();
                                state.heartRateManager?.disconnect();
                            },
                            mouseenter: (e) => { e.currentTarget.style.opacity = '1'; },
                            mouseleave: (e) => { e.currentTarget.style.opacity = '0.6'; },
                        }
                    }),
                ],
            });
            buttonContainer.appendChild(hrConnectedStatus);
        } else {
            // Botón para conectar pulsómetro
            const hrConnectBtn = button({
                styles: {
                    ...hrButtonStyles,
                    opacity: isHRConnecting ? 0.85 : 1,
                    cursor: isHRConnecting ? 'not-allowed' : 'pointer',
                },
                children: isHRConnecting && hrStatusText
                    ? [
                        div({
                            styles: {
                                width: '16px',
                                height: '16px',
                                border: '2px solid rgba(255, 82, 82, 0.3)',
                                borderTopColor: '#ff5252',
                                borderRadius: borderRadius.full,
                                flexShrink: 0,
                                animation: 'spin 1s linear infinite',
                            }
                        }),
                        createElement('span', { text: hrStatusText }),
                    ]
                    : [
                        icon('heart', 18, '#ff5252'),
                        createElement('span', { 
                            text: hasCachedHRDevice 
                                ? `Conectar ${hasCachedHRDevice.name}` 
                                : 'Conectar Pulsómetro' 
                        }),
                    ],
                events: {
                    click: async () => {
                        if (isHRConnecting) return;
                        try {
                            if (hasCachedHRDevice) {
                                const device = await state.heartRateManager.reconnectSilently();
                                if (device) {
                                    triggerHapticSuccess();
                                    return;
                                }
                            }
                            await state.heartRateManager.scan();
                            triggerHapticSuccess();
                        } catch (error) {
                            if (error.name !== 'NotFoundError') {
                                console.log('Conexión HR cancelada o error:', error.message);
                            }
                        }
                    },
                    mouseenter: (e) => {
                        if (!isHRConnecting) {
                            e.target.style.background = 'rgba(255, 82, 82, 0.15)';
                            e.target.style.borderColor = 'rgba(255, 82, 82, 0.5)';
                        }
                    },
                    mouseleave: (e) => {
                        e.target.style.background = 'rgba(255, 82, 82, 0.08)';
                        e.target.style.borderColor = 'rgba(255, 82, 82, 0.3)';
                    },
                }
            });
            buttonContainer.appendChild(hrConnectBtn);
        }
        
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
    
    // Sección de Modos de Entrenamiento (glassmorphism + overlay rejilla)
    const trainingModesStyles = {
        ...premiumCardStyles,
        marginTop: spacing.xxl,
        padding: spacing.lg,
        borderRadius: borderRadius.lg,
        maxWidth: '500px',
        width: '100%',
        position: 'relative',
        overflow: 'hidden',
    };
    
    const trainingModesTitleStyles = {
        fontFamily: typography.fontDisplay,
        fontSize: typography.sizes.lg,
        fontWeight: typography.weights.semibold,
        color: colors.text,
        marginBottom: spacing.md,
        textAlign: 'center',
    };
    
    const trainingModes = div({
        styles: trainingModesStyles,
        children: [
            createElement('div', { className: 'card-grid-overlay' }),
            createElement('h3', { text: 'Modos de Entrenamiento', styles: { ...trainingModesTitleStyles, position: 'relative', zIndex: 1 } }),
            div({
                styles: {
                    display: 'flex',
                    flexDirection: 'column',
                    gap: spacing.md,
                    alignItems: 'center',
                    position: 'relative',
                    zIndex: 1,
                },
                children: [
                    // Entrenamiento: siempre visible; bloqueado o botón según conexión
                    isConnected
                        ? button({
                            className: 'card-unlocked',
                            styles: {
                                ...baseStyles.button,
                                ...baseStyles.buttonPrimary,
                                padding: `${spacing.md} ${spacing.lg}`,
                                fontSize: typography.sizes.md,
                                fontWeight: typography.weights.bold,
                                gap: spacing.sm,
                                minWidth: '250px',
                                width: '100%',
                                position: 'relative',
                                zIndex: 1,
                            },
                            children: [
                                icon('activity', 20, colors.background),
                                createElement('span', { text: 'Entrenamiento' }),
                            ],
                            events: { click: () => navigateTo('training') },
                        })
                        : div({
                            styles: {
                                ...premiumCardStyles,
                                width: '100%',
                                minWidth: '250px',
                                padding: spacing.lg,
                                position: 'relative',
                                overflow: 'hidden',
                                cursor: 'not-allowed',
                                background: `linear-gradient(145deg, rgba(0, 212, 170, 0.12) 0%, rgba(20, 20, 20, 0.95) 50%, rgba(0, 242, 254, 0.06) 100%)`,
                                border: `1px solid ${colors.border}80`,
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                gap: spacing.sm,
                            },
                            children: [
                                createElement('div', { className: 'card-grid-overlay' }),
                                icon('activity', 28, colors.primary),
                                createElement('span', {
                                    text: 'Entrenamiento',
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
                        }),
                    // Modo Juego: siempre visible; bloqueado o botón según conexión
                    GameModeButton({
                        onClick: () => {
                            if (isConnected) navigateToGame();
                            else alert('Por favor, conecta tu rodillo primero para usar el modo juego.');
                        },
                        disabled: !isConnected,
                        className: isConnected ? 'card-unlocked' : '',
                    }),
                    // Ciclismo Virtual: siempre visible; bloqueado o botón según conexión
                    RideModeButton({
                        onClick: () => {
                            if (isConnected) navigateToRide();
                            else alert('Por favor, conecta tu rodillo primero para usar el ciclismo virtual.');
                        },
                        disabled: !isConnected,
                    }),
                ]
            }),
        ]
    });
    container.appendChild(trainingModes);
    
    // Función de limpieza para eliminar event listeners
    container.cleanup = () => {
        window.removeEventListener('pwa-installable', installableHandler);
        window.removeEventListener('pwa-installed', installedHandler);
    };
    
    return container;
}
