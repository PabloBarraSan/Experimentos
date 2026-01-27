/**
 * HomeView - Vista de inicio/conexión
 * Smart Trainer Controller
 */

import { colors, spacing, typography, baseStyles, borderRadius, transitions, shadows } from '../utils/theme.js';
import { createElement, div, button, icon } from '../utils/dom.js';
import { checkBluetoothSupport } from '../bluetooth/scanner.js';

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
    
    window.addEventListener('pwa-installable', handleInstallable);
    window.addEventListener('pwa-installed', handleInstalled);
    
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
    const container = div({ styles: containerStyles });
    
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
    
    // Botón de conexión o mensaje de error
    if (bluetoothSupport.supported) {
        const connectBtn = button({
            styles: connectButtonStyles,
            children: [
                icon('bluetooth', 24, colors.background),
                createElement('span', { text: 'Conectar Rodillo' }),
            ],
            events: {
                click: async () => {
                    try {
                        await state.bluetoothManager.scan();
                    } catch (error) {
                        console.log('Conexión cancelada o error:', error.message);
                    }
                },
                mouseenter: (e) => {
                    e.target.style.transform = 'scale(1.05)';
                },
                mouseleave: (e) => {
                    e.target.style.transform = 'scale(1)';
                },
            }
        });
        container.appendChild(connectBtn);
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
                    }),
                    createElement('li', {
                        styles: instructionItemStyles,
                        children: [
                            createElement('span', { text: '3.', styles: { color: colors.primary, fontWeight: typography.weights.bold } }),
                            createElement('span', { text: 'Una vez conectado, podrás ver tus métricas y controlar la resistencia.' }),
                        ]
                    }),
                    createElement('li', {
                        styles: instructionItemStyles,
                        children: [
                            createElement('span', { text: '💡', styles: { fontSize: typography.sizes.md } }),
                            createElement('span', { text: 'Usa Chrome, Edge u Opera para mejor compatibilidad con Web Bluetooth.' }),
                        ]
                    }),
                ]
            }),
        ]
    });
    container.appendChild(instructions);
    
    // Dispositivos compatibles
    const compatibleDevices = div({
        styles: {
            marginTop: spacing.lg,
            padding: spacing.md,
            backgroundColor: colors.surfaceLight,
            borderRadius: borderRadius.md,
            maxWidth: '500px',
        },
        children: [
            createElement('p', {
                text: 'Dispositivos compatibles: Decathlon D100, Van Rysel E-500, y cualquier rodillo FTMS',
                styles: { fontSize: typography.sizes.xs, color: colors.textDark }
            })
        ]
    });
    container.appendChild(compatibleDevices);
    
    return container;
}
