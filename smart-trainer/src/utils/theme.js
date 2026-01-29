/**
 * Theme - Sistema de estilos y paleta de colores
 * Smart Trainer Controller
 */

export const colors = {
    // Base
    background: '#0a0a0a',
    surface: '#1a1a1a',
    surfaceLight: '#252525',
    surfaceHover: '#2a2a2a',
    border: '#333333',
    
    // Primarios
    primary: '#00d4aa',
    primaryDark: '#00a88a',
    primaryLight: '#33ddbb',
    
    // Secundarios
    secondary: '#0066cc',
    secondaryDark: '#0052a3',
    
    // Acentos
    accent: '#ff6b35',
    accentDark: '#e55a2b',
    warning: '#ffcc00',
    error: '#ff4444',
    success: '#00cc66',
    
    // Texto
    text: '#ffffff',
    textMuted: '#888888',
    textDark: '#666666',
    
    // Zonas de potencia
    zones: {
        z1: '#808080',  // Recuperación (gris)
        z2: '#0066ff',  // Resistencia (azul)
        z3: '#00cc00',  // Tempo (verde)
        z4: '#ffcc00',  // Umbral (amarillo)
        z5: '#ff6600',  // VO2max (naranja)
        z6: '#ff0000',  // Anaeróbico (rojo)
        z7: '#cc00cc',  // Neuromuscular (púrpura)
    }
};

export const spacing = {
    xs: '4px',
    sm: '8px',
    md: '16px',
    lg: '24px',
    xl: '32px',
    xxl: '48px',
};

export const typography = {
    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    fontDisplay: "'Barlow', -apple-system, BlinkMacSystemFont, sans-serif", // Títulos premium
    fontMono: "'SF Mono', 'Monaco', 'Inconsolata', 'Fira Code', monospace",
    
    sizes: {
        xs: '12px',
        sm: '14px',
        md: '16px',
        lg: '20px',
        xl: '24px',
        xxl: '32px',
        xxxl: '48px',
        metric: '64px',
        metricHero: '80px', // Legibilidad bajo fatiga (Garmin/Zwift)
    },
    
    weights: {
        normal: 400,
        medium: 500,
        semibold: 600,
        bold: 700,
    }
};

export const shadows = {
    sm: '0 1px 2px rgba(0, 0, 0, 0.3)',
    md: '0 4px 6px rgba(0, 0, 0, 0.4)',
    lg: '0 10px 15px rgba(0, 0, 0, 0.5)',
    glow: (color) => `0 0 20px ${color}40`,
    glass: '0 8px 32px 0 rgba(0, 0, 0, 0.4)',
};

export const transitions = {
    fast: '150ms ease',
    normal: '250ms ease',
    slow: '400ms ease',
};

export const borderRadius = {
    sm: '4px',
    md: '8px',
    lg: '12px',
    xl: '16px',
    full: '9999px',
};

// Estilos premium: glassmorphism para tarjetas
export const premiumCardStyles = {
    background: 'linear-gradient(145deg, rgba(35, 35, 35, 0.85) 0%, rgba(20, 20, 20, 0.9) 100%)',
    border: `1px solid ${colors.border}80`,
    backdropFilter: 'blur(10px)',
    WebkitBackdropFilter: 'blur(10px)',
    boxShadow: shadows.glass,
    transition: 'transform 0.3s ease, box-shadow 0.3s ease',
};

// Botón de conexión premium (gradiente "Energy")
export const premiumConnectButtonStyles = {
    background: `linear-gradient(90deg, ${colors.primary} 0%, #00f2fe 100%)`,
    color: '#000',
    textTransform: 'uppercase',
    letterSpacing: '1px',
    fontWeight: 800,
    boxShadow: `0 0 25px ${colors.primary}40`,
};

// Estilos base reutilizables
export const baseStyles = {
    card: {
        backgroundColor: colors.surface,
        borderRadius: borderRadius.lg,
        padding: spacing.lg,
        border: `1px solid ${colors.border}`,
    },
    
    button: {
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: `${spacing.sm} ${spacing.md}`,
        borderRadius: borderRadius.md,
        border: 'none',
        cursor: 'pointer',
        fontFamily: typography.fontFamily,
        fontSize: typography.sizes.md,
        fontWeight: typography.weights.medium,
        transition: transitions.fast,
    },
    
    buttonPrimary: {
        backgroundColor: colors.primary,
        color: colors.background,
    },
    
    buttonSecondary: {
        backgroundColor: colors.surfaceLight,
        color: colors.text,
        border: `1px solid ${colors.border}`,
    },
    
    input: {
        backgroundColor: colors.surfaceLight,
        border: `1px solid ${colors.border}`,
        borderRadius: borderRadius.md,
        padding: spacing.sm,
        color: colors.text,
        fontFamily: typography.fontFamily,
        fontSize: typography.sizes.md,
        outline: 'none',
    },
    
    flexCenter: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
    },
    
    flexBetween: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    
    flexColumn: {
        display: 'flex',
        flexDirection: 'column',
    },
};

/**
 * Obtener color de zona según potencia y FTP
 */
export function getZoneColor(power, ftp) {
    if (!ftp || !power) return colors.zones.z1;
    
    const percentage = (power / ftp) * 100;
    
    if (percentage < 55) return colors.zones.z1;
    if (percentage < 76) return colors.zones.z2;
    if (percentage < 91) return colors.zones.z3;
    if (percentage < 106) return colors.zones.z4;
    if (percentage < 121) return colors.zones.z5;
    if (percentage < 151) return colors.zones.z6;
    return colors.zones.z7;
}

/**
 * Obtener nombre de zona según potencia y FTP
 */
export function getZoneName(power, ftp) {
    if (!ftp || !power) return 'Z1 - Recuperación';
    
    const percentage = (power / ftp) * 100;
    
    if (percentage < 55) return 'Z1 - Recuperación';
    if (percentage < 76) return 'Z2 - Resistencia';
    if (percentage < 91) return 'Z3 - Tempo';
    if (percentage < 106) return 'Z4 - Umbral';
    if (percentage < 121) return 'Z5 - VO2max';
    if (percentage < 151) return 'Z6 - Anaeróbico';
    return 'Z7 - Neuromuscular';
}

/**
 * Aplicar estilos a un elemento
 */
export function applyStyles(element, styles) {
    Object.assign(element.style, styles);
    return element;
}

/**
 * Combinar múltiples objetos de estilos
 */
export function mergeStyles(...styleObjects) {
    return Object.assign({}, ...styleObjects);
}
