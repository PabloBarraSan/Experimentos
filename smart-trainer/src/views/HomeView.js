/**
 * HomeView - Vista de inicio/conexión
 * Smart Trainer Controller
 */

import { colors, spacing, typography, baseStyles, borderRadius, premiumConnectButtonStyles, shadows } from '../utils/theme.js';
import { createElement, div, button, icon } from '../utils/dom.js';
import { checkBluetoothSupport, CONNECTION_STATE } from '../bluetooth/scanner.js';
import { HR_CONNECTION_STATE } from '../bluetooth/heartRate.js';
import { navigateToGame, navigateTo, navigateToRide } from '../app.js';

/**
 * Vista de inicio con botón de conexión
 */
export function HomeView(state) {
    const bluetoothSupport = checkBluetoothSupport();
    
    let showInstallButton = false;
    
    // Verificar si la app ya está instalada (abierta como PWA)
    const isPWAInstalled = () => {
        if (window.matchMedia('(display-mode: standalone)').matches) return true;
        if (window.matchMedia('(display-mode: fullscreen)').matches) return true;
        if (window.matchMedia('(display-mode: minimal-ui)').matches) return true;
        if (typeof window.navigator !== 'undefined' && window.navigator.standalone === true) return true;
        return false;
    };
    
    // Mostrar botón de instalar solo si no está ya instalada
    const checkInstallable = () => {
        if (isPWAInstalled()) return false;
        return typeof window.installPWA === 'function';
    };
    
    let installPopupOpen = false;
    let installTriggerEl = null;
    let installPopupEl = null;

    let infoModalOpen = false;
    let infoModalEl = null;

    const openInstallPopup = () => {
        installPopupOpen = true;
        if (installPopupEl) {
            installPopupEl.style.display = 'flex';
            const manual = installPopupEl.querySelector('[data-manual-install]');
            if (manual) manual.style.display = 'none';
        }
    };

    const closeInstallPopup = () => {
        installPopupOpen = false;
        if (installPopupEl) installPopupEl.style.display = 'none';
    };

    const openInfoModal = (title, message) => {
        infoModalOpen = true;
        if (infoModalEl) {
            const t = infoModalEl.querySelector('[data-info-modal-title]');
            const m = infoModalEl.querySelector('[data-info-modal-message]');
            if (t) t.textContent = title;
            if (m) m.textContent = message;
            infoModalEl.style.display = 'flex';
        }
    };

    const closeInfoModal = () => {
        infoModalOpen = false;
        if (infoModalEl) infoModalEl.style.display = 'none';
    };

    const handleInstallable = () => {
        showInstallButton = true;
        if (installTriggerEl) installTriggerEl.style.display = 'flex';
    };

    const handleInstalled = () => {
        showInstallButton = false;
        closeInstallPopup();
        if (installTriggerEl) installTriggerEl.style.display = 'none';
    };

    const showManualInstallInstructions = () => {
        const block = installPopupEl && installPopupEl.querySelector('[data-manual-install]');
        if (block) block.style.display = 'block';
    };

    const installableHandler = handleInstallable;
    const installedHandler = handleInstalled;
    const installUnavailableHandler = showManualInstallInstructions;

    window.addEventListener('pwa-installable', installableHandler);
    window.addEventListener('pwa-installed', installedHandler);
    window.addEventListener('pwa-install-unavailable', installUnavailableHandler);

    showInstallButton = checkInstallable();
    
    const isConnected = state && state.connectionState === CONNECTION_STATE.CONNECTED;
    const innerStyles = {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'stretch',
        width: '100%',
        maxWidth: '400px',
        margin: '0 auto',
        padding: '24px',
        paddingTop: '40px',
    };
    
    const errorBoxStyles = {
        ...baseStyles.card,
        backgroundColor: 'rgba(255, 68, 68, 0.1)',
        borderColor: colors.error,
        marginTop: spacing.lg,
    };
    
    const wrapper = div({
        styles: {
            flex: '1',
            width: '100%',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            position: 'relative',
        },
        attrs: { 'data-view': 'home', class: 'home-view-bg' },
    });
    
    const container = div({
        styles: { ...innerStyles, position: 'relative' },
    });
    wrapper.appendChild(container);
    
    installTriggerEl = button({
        styles: {
            position: 'absolute',
            top: spacing.md,
            right: spacing.md,
            display: showInstallButton ? 'flex' : 'none',
            ...baseStyles.flexCenter,
            gap: spacing.xs,
            padding: `${spacing.xs} ${spacing.md}`,
            fontSize: typography.sizes.sm,
            color: colors.textMuted,
            background: 'rgba(35,35,35,0.8)',
            border: `1px solid ${colors.border}`,
            borderRadius: borderRadius.full,
            cursor: 'pointer',
            zIndex: 5,
        },
        children: [
            icon('download', 16, colors.primary),
            createElement('span', { text: 'Instalar App' }),
        ],
        events: { click: openInstallPopup },
    });
    container.appendChild(installTriggerEl);

    // Popup de instalación PWA (cerrable, solo útil si no está instalada)
    const popupOverlayStyles = {
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.6)',
        backdropFilter: 'blur(4px)',
        display: installPopupOpen ? 'flex' : 'none',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: spacing.lg,
    };
    const popupCardStyles = {
        ...baseStyles.card,
        maxWidth: '340px',
        width: '100%',
        padding: spacing.xl,
        boxShadow: shadows.lg,
    };
    installPopupEl = div({
        styles: popupOverlayStyles,
        attrs: { 'data-install-popup': 'true' },
        events: {
            click: (e) => {
                if (e.target === installPopupEl) closeInstallPopup();
            },
        },
        children: [
            div({
                styles: popupCardStyles,
                events: { click: (e) => e.stopPropagation() },
                children: [
                    div({
                        styles: {
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'flex-start',
                            marginBottom: spacing.md,
                        },
                        children: [
                            createElement('h3', {
                                text: 'Instalar Smart Trainer',
                                styles: {
                                    fontSize: typography.sizes.lg,
                                    fontWeight: typography.weights.bold,
                                    color: colors.text,
                                },
                            }),
                            button({
                                styles: {
                                    ...baseStyles.button,
                                    padding: spacing.xs,
                                    minWidth: 'auto',
                                    background: 'transparent',
                                    color: colors.textMuted,
                                    border: 'none',
                                },
                                children: [icon('close', 20, colors.textMuted)],
                                attrs: { title: 'Cerrar', 'aria-label': 'Cerrar' },
                                events: { click: closeInstallPopup },
                            }),
                        ],
                    }),
                    createElement('p', {
                        text: 'Instala la app en tu dispositivo para acceder más rápido y usarla sin depender del navegador.',
                        styles: {
                            fontSize: typography.sizes.sm,
                            color: colors.textMuted,
                            marginBottom: spacing.lg,
                            lineHeight: 1.5,
                        },
                    }),
                    div({
                        attrs: { 'data-manual-install': 'true' },
                        styles: {
                            display: 'none',
                            fontSize: typography.sizes.sm,
                            color: colors.textMuted,
                            marginBottom: spacing.lg,
                            padding: spacing.sm,
                            background: 'rgba(0,0,0,0.2)',
                            borderRadius: borderRadius.md,
                            lineHeight: 1.5,
                        },
                        text: 'En Chrome: menú (⋮) → «Instalar Smart Trainer» o «Añadir a la pantalla de inicio». En otros navegadores busca «Instalar app» o «Añadir a inicio».',
                    }),
                    div({
                        styles: { display: 'flex', gap: spacing.sm, justifyContent: 'flex-end' },
                        children: [
                            button({
                                styles: {
                                    ...baseStyles.button,
                                    ...baseStyles.buttonSecondary,
                                },
                                text: 'Cerrar',
                                events: { click: closeInstallPopup },
                            }),
                            button({
                                styles: {
                                    ...baseStyles.button,
                                    ...premiumConnectButtonStyles,
                                    padding: `${spacing.sm} ${spacing.md}`,
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: spacing.sm,
                                },
                                children: [
                                    icon('download', 18, '#000'),
                                    createElement('span', { text: 'Instalar' }),
                                ],
                                events: {
                                    click: async () => {
                                        if (window.installPWA) {
                                            const ok = await window.installPWA();
                                            if (!ok) showManualInstallInstructions();
                                        }
                                    },
                                },
                            }),
                        ],
                    }),
                ],
            }),
        ],
    });
    document.body.appendChild(installPopupEl);

    // Modal informativo (sustituye alerts)
    const infoModalOverlayStyles = {
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.6)',
        backdropFilter: 'blur(4px)',
        display: infoModalOpen ? 'flex' : 'none',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1001,
        padding: spacing.lg,
    };
    infoModalEl = div({
        styles: infoModalOverlayStyles,
        attrs: { 'data-info-modal': 'true' },
        events: {
            click: (e) => {
                if (e.target === infoModalEl) closeInfoModal();
            },
        },
        children: [
            div({
                styles: {
                    ...baseStyles.card,
                    maxWidth: '340px',
                    width: '100%',
                    padding: spacing.xl,
                    boxShadow: shadows.lg,
                },
                events: { click: (e) => e.stopPropagation() },
                children: [
                    createElement('h3', {
                        text: 'Conecta el rodillo',
                        attrs: { 'data-info-modal-title': 'true' },
                        styles: {
                            fontSize: typography.sizes.lg,
                            fontWeight: typography.weights.bold,
                            color: colors.text,
                            marginBottom: spacing.sm,
                        },
                    }),
                    createElement('p', {
                        text: 'Conecta tu rodillo primero para usar este modo.',
                        attrs: { 'data-info-modal-message': 'true' },
                        styles: {
                            fontSize: typography.sizes.sm,
                            color: colors.textMuted,
                            marginBottom: spacing.lg,
                            lineHeight: 1.5,
                        },
                    }),
                    div({
                        styles: { display: 'flex', justifyContent: 'flex-end' },
                        children: [
                            button({
                                styles: {
                                    ...baseStyles.button,
                                    ...premiumConnectButtonStyles,
                                    padding: `${spacing.sm} ${spacing.lg}`,
                                },
                                text: 'Entendido',
                                events: { click: closeInfoModal },
                            }),
                        ],
                    }),
                ],
            }),
        ],
    });
    document.body.appendChild(infoModalEl);
    
    // Hero: logo animado + título
    const logoInner = div({
        styles: {
            background: 'linear-gradient(145deg, #222, #111)',
            borderRadius: '50%',
            width: '70px',
            height: '70px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            position: 'relative',
            zIndex: 2,
            border: '1px solid rgba(255,255,255,0.1)',
        },
        children: [
            createElement('span', {
                html: '<svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>',
            }),
        ],
    });
    const logoRing = div({
        className: 'logo-ring',
        styles: { position: 'absolute', width: '100%', height: '100%', borderRadius: '50%', top: 0, left: 0 },
    });
    const logoContainer = div({
        styles: {
            width: '84px',
            height: '84px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: spacing.md,
            position: 'relative',
        },
        children: [logoRing, logoInner],
    });
    const hero = div({
        styles: {
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            textAlign: 'center',
            marginBottom: '32px',
        },
        children: [
            logoContainer,
            createElement('h1', {
                text: 'Smart Trainer',
                attrs: { class: 'hero-title-gradient' },
                styles: {
                    fontFamily: typography.fontDisplay,
                    fontWeight: 800,
                    fontSize: '32px',
                    margin: 0,
                    letterSpacing: '-1px',
                },
            }),
        ],
    });
    container.appendChild(hero);
    
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
    
    const borderMuted = 'rgba(255,255,255,0.08)';
    const deviceTileBase = {
        borderRadius: '16px',
        padding: '12px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '8px',
        cursor: 'pointer',
        transition: 'all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1)',
        border: `1px solid ${borderMuted}`,
        background: 'rgba(255,255,255,0.03)',
    };

    const makeDeviceTile = (kind) => {
        const isRodillo = kind === 'rodillo';
        const connected = isRodillo ? isConnected : isHRConnected;
        const connecting = isRodillo ? isConnecting : isHRConnecting;
        const connStatus = isRodillo ? statusText : hrStatusText;
        const showSpinner = connecting && connStatus;
        const statusLabel = showSpinner ? connStatus : (connected ? (isRodillo ? 'Conectado' : (state.hrDeviceName || hasCachedHRDevice?.name || 'Conectado')) : 'Conectar +');
        const iconColor = isRodillo ? (connected ? colors.primary : colors.textMuted) : (connected ? '#ff5252' : colors.textMuted);
        const iconEl = isRodillo ? icon('bike', 24, iconColor) : icon('heart', 24, iconColor);
        const label = isRodillo ? 'Rodillo' : 'Pulso';
        const onClick = async (e) => {
            if (!isRodillo && connected && e.target.closest('[data-hr-disconnect]')) return;
            if (isRodillo) {
                if (connecting) return;
                try {
                    if (hasCachedDevice) {
                        const dev = await state.bluetoothManager.reconnectSilently();
                        if (dev) { triggerHapticSuccess(); return; }
                        await state.bluetoothManager.reconnectToCachedDevice();
                    } else await state.bluetoothManager.scan();
                    triggerHapticSuccess();
                } catch (err) {
                    if (err.name !== 'NotFoundError') console.log('Conexión cancelada o error:', err.message);
                }
                return;
            }
            if (connecting) return;
            try {
                if (hasCachedHRDevice) {
                    const dev = await state.heartRateManager.reconnectSilently();
                    if (dev) { triggerHapticSuccess(); return; }
                }
                await state.heartRateManager.scan();
                triggerHapticSuccess();
            } catch (err) {
                if (err.name !== 'NotFoundError') console.log('Conexión HR cancelada o error:', err.message);
            }
        };
        const spinner = div({
            styles: {
                width: '20px', height: '20px',
                border: `2px solid ${isRodillo ? `${colors.primary}40` : 'rgba(255,82,82,0.3)'}`,
                borderTopColor: isRodillo ? colors.primary : '#ff5252',
                borderRadius: borderRadius.full,
                flexShrink: 0,
                animation: 'spin 1s linear infinite',
            },
        });
        const children = [
            div({
                styles: { display: 'flex', alignItems: 'center', justifyContent: 'center' },
                children: [showSpinner ? spinner : iconEl],
            }),
            createElement('span', { text: label, styles: { fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', color: '#ccc' } }),
            createElement('span', {
                text: statusLabel,
                styles: { fontSize: '10px', color: connected ? (isRodillo ? colors.primary : '#ff5252') : colors.textMuted },
            }),
        ];
        if (connected && !isRodillo) {
            const disconnectBtn = div({
                attrs: { 'data-hr-disconnect': 'true' },
                styles: { position: 'absolute', top: 4, right: 4, padding: 4, cursor: 'pointer', opacity: 0.6 },
                children: [icon('x', 12, colors.textMuted)],
                events: { click: (e) => { e.stopPropagation(); state.heartRateManager?.disconnect(); } },
            });
            children.push(disconnectBtn);
        }
        const tile = div({
            styles: {
                ...deviceTileBase,
                position: connected && !isRodillo ? 'relative' : undefined,
                ...(connected && isRodillo && { background: 'rgba(0,212,170,0.1)', borderColor: colors.primary, boxShadow: '0 4px 20px rgba(0,212,170,0.1)' }),
                ...(connected && !isRodillo && { background: 'rgba(255,82,82,0.1)', borderColor: 'rgba(255,82,82,0.5)' }),
                ...(!connected && !connecting && { borderStyle: 'dashed', opacity: 0.85 }),
                opacity: connecting ? 0.9 : 1,
                cursor: connecting ? 'not-allowed' : 'pointer',
            },
            events: { click: onClick },
            children,
        });
        return tile;
    };

    if (bluetoothSupport.supported) {
        const devicesRow = div({
            styles: {
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: '12px',
                width: '100%',
                marginBottom: '32px',
            },
            children: [makeDeviceTile('rodillo'), makeDeviceTile('pulso')],
        });
        container.appendChild(devicesRow);
    } else {
        const disabledBtn = button({
            styles: {
                ...baseStyles.button,
                padding: `${spacing.md} ${spacing.xl}`,
                fontSize: typography.sizes.lg,
                fontWeight: 800,
                backgroundColor: colors.surfaceLight,
                color: colors.textMuted,
                cursor: 'not-allowed',
                boxShadow: 'none',
                marginBottom: spacing.md,
            },
            children: [icon('x', 24, colors.textMuted), createElement('span', { text: 'Bluetooth No Disponible' })],
            attrs: { disabled: 'true' },
        });
        container.appendChild(disabledBtn);
        const errorBox = div({
            styles: errorBoxStyles,
            children: [createElement('p', { text: bluetoothSupport.reason, styles: { color: colors.error, fontSize: typography.sizes.sm } })],
        });
        container.appendChild(errorBox);
    }
    
    const sectionTitle = (text) =>
        createElement('div', {
            text,
            styles: {
                fontSize: '13px',
                textTransform: 'uppercase',
                letterSpacing: '1px',
                color: colors.textMuted,
                marginBottom: '12px',
                paddingLeft: '4px',
                fontWeight: 600,
            },
        });

    const cardBg = 'linear-gradient(145deg, rgba(30,30,30,0.9), rgba(20,20,20,0.95))';
    const cardBorder = borderMuted;

    const createActionCard = ({ iconName, iconBg, iconColor, title, description, onClick, locked }) => {
        const padding = '20px';
        const iconSize = 24;
        const el = div({
            styles: {
                background: cardBg,
                border: `1px solid ${cardBorder}`,
                borderRadius: '20px',
                padding,
                display: 'flex',
                alignItems: 'center',
                gap: '16px',
                cursor: locked ? 'pointer' : 'pointer',
                transition: 'transform 0.2s',
                opacity: locked ? 0.75 : 1,
            },
            events: {
                click: () => {
                    if (locked) {
                        openInfoModal('Conecta el rodillo', 'Conecta tu rodillo primero para usar este modo.');
                        return;
                    }
                    onClick?.();
                },
                mouseenter: (e) => { if (!locked) e.currentTarget.style.transform = 'scale(0.99)'; },
                mouseleave: (e) => { e.currentTarget.style.transform = 'scale(1)'; },
            },
            children: [
                div({
                    styles: {
                        width: '48px',
                        height: '48px',
                        borderRadius: '14px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                        background: iconBg,
                        color: iconColor,
                    },
                    children: [icon(iconName, iconSize, iconColor)],
                }),
                div({
                    styles: { flex: 1, minWidth: 0 },
                    children: [
                        createElement('h3', {
                            text: title,
                            styles: { margin: '0 0 4px 0', fontFamily: typography.fontDisplay, fontSize: '18px', fontWeight: 700, color: colors.text },
                        }),
                        createElement('p', {
                            text: description,
                            styles: { margin: 0, fontSize: '13px', color: colors.textMuted },
                        }),
                    ],
                }),
                div({
                    styles: { marginLeft: 'auto', opacity: 0.3 },
                    children: [icon('chevronRight', 20, colors.textMuted)],
                }),
            ],
        });
        return el;
    };

    const modesSection = div({
        styles: { marginBottom: '8px' },
        children: [
            sectionTitle('Modos de Entrenamiento'),
            div({
                styles: { display: 'flex', flexDirection: 'column', gap: '12px' },
                children: [
                    createActionCard({
                        iconName: 'activity',
                        iconBg: 'rgba(0, 212, 170, 0.15)',
                        iconColor: colors.primary,
                        title: 'Entrenamiento Libre',
                        description: isConnected ? 'Control manual y zonas de potencia.' : 'Conecta el rodillo para desbloquear.',
                        onClick: () => navigateTo('training'),
                        locked: !isConnected,
                    }),
                    createActionCard({
                        iconName: 'game',
                        iconBg: 'rgba(168, 85, 247, 0.15)',
                        iconColor: '#a855f7',
                        title: 'Modo Juego',
                        description: isConnected ? 'Simulación 3D y retos físicos.' : 'Jugar sin rodillo (modo demo).',
                        onClick: () => navigateToGame(),
                        locked: false,
                    }),
                    createActionCard({
                        iconName: 'bike',
                        iconBg: 'rgba(59, 130, 246, 0.15)',
                        iconColor: '#3b82f6',
                        title: 'Ciclismo Virtual',
                        description: isConnected ? 'Ruta generada y resistencia dinámica.' : 'Conecta el rodillo para desbloquear.',
                        onClick: () => navigateToRide(),
                        locked: !isConnected,
                    }),
                ],
            }),
        ],
    });
    container.appendChild(modesSection);

    const dataSection = div({
        styles: { marginTop: '24px' },
        children: [
            sectionTitle('Datos'),
            div({
                styles: { display: 'flex', flexDirection: 'column', gap: '12px' },
                children: [
                    createActionCard({
                        iconName: 'barChart',
                        iconBg: 'rgba(59, 130, 246, 0.15)',
                        iconColor: '#3b82f6',
                        title: 'Mis Entrenamientos',
                        description: 'Historial, estadísticas y progreso.',
                        onClick: () => navigateTo('history'),
                        locked: false,
                    }),
                    createActionCard({
                        iconName: 'settings',
                        iconBg: 'rgba(107, 114, 128, 0.15)',
                        iconColor: colors.textMuted,
                        title: 'Configuración',
                        description: 'FTP, peso, mando Zwift Play y preferencias.',
                        onClick: () => navigateTo('settings'),
                        locked: false,
                    }),
                ],
            }),
        ],
    });
    container.appendChild(dataSection);
    
    wrapper.cleanup = () => {
        window.removeEventListener('pwa-installable', installableHandler);
        window.removeEventListener('pwa-installed', installedHandler);
        window.removeEventListener('pwa-install-unavailable', installUnavailableHandler);
        if (installPopupEl && installPopupEl.parentNode) installPopupEl.parentNode.removeChild(installPopupEl);
        if (infoModalEl && infoModalEl.parentNode) infoModalEl.parentNode.removeChild(infoModalEl);
    };
    
    return wrapper;
}
