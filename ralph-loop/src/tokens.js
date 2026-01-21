/**
 * Sistema de Diseño - Ralph Loop
 * Tokens de diseño para estilos inline (objetos JavaScript)
 */

export const Tokens = {
  colors: {
    // Paleta Principal
    primary: '#2563EB',
    primaryHover: '#1D4ED8',
    primaryLight: '#DBEAFE',
    
    // Superficies
    surface: '#FFFFFF',
    surfaceSecondary: '#F9FAFB',
    surfaceElevated: '#FFFFFF',
    
    // Bordes y Líneas
    border: '#E5E7EB',
    borderLight: '#F3F4F6',
    gridLines: '#F3F4F6',
    gridLinesStrong: '#E5E7EB',
    
    // Eventos
    eventMeeting: '#D1FAE5',
    eventMeetingBorder: '#10B981',
    eventBlocked: '#FEE2E2',
    eventBlockedBorder: '#EF4444',
    eventHover: '#BFDBFE',
    
    // Texto
    textPrimary: '#111827',
    textSecondary: '#6B7280',
    textTertiary: '#9CA3AF',
    textInverse: '#FFFFFF',
    
    // Estados
    success: '#10B981',
    warning: '#F59E0B',
    error: '#EF4444',
    info: '#3B82F6',
    
    // Interacción
    hover: '#F3F4F6',
    active: '#E5E7EB',
    focus: '#2563EB',
    focusRing: 'rgba(37, 99, 235, 0.2)',
    
    // Drag & Drop
    dragGhost: 'rgba(37, 99, 235, 0.3)',
    dropZone: 'rgba(16, 185, 129, 0.1)',
    dropZoneActive: 'rgba(16, 185, 129, 0.2)',
    
    // Booking Calendar (Vista Mensual)
    cell: {
      default: '#FFFFFF',
      hover: '#F3F4F6',
      selected: '#2563EB', // Azul primario
      selectedText: '#FFFFFF',
      inRange: '#DBEAFE', // Azul muy claro para los días entre inicio y fin
      disabled: '#E5E7EB',
      booked: '#EF4444', // Rojo o tachado
      bookedText: '#FFFFFF',
    },
  },
  
  radius: {
    selection: '50%', // Círculos perfectos para inicio/fin
    rangeStart: '8px 0 0 8px', // Bordes redondeados izquierda
    rangeEnd: '0 8px 8px 0', // Bordes redondeados derecha
    rangeMiddle: '0', // Sin bordes redondeados en el medio
  },
  
  layout: {
    // Dimensiones del Grid
    hourWidth: '60px',
    headerHeight: '50px',
    timeColumnWidth: '80px',
    slotHeight: '60px', // Altura por slot de 30min
    
    // Espaciados
    spacing: {
      xs: '4px',
      sm: '8px',
      md: '16px',
      lg: '24px',
      xl: '32px',
      '2xl': '48px',
    },
    
    // Bordes
    borderRadius: {
      sm: '4px',
      md: '6px',
      lg: '8px',
      xl: '12px',
    },
    
    // Sombras
    shadow: {
      sm: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
      md: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
      lg: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
      xl: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
    },
    
    // Z-index Layers
    zIndex: {
      base: 1,
      header: 10,
      event: 5,
      eventDragging: 100,
      tooltip: 1000,
      modal: 2000,
    },
  },
  
  typography: {
    fontFamily: {
      sans: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
      mono: "'SF Mono', Monaco, 'Cascadia Code', 'Roboto Mono', Consolas, monospace",
    },
    fontSize: {
      xs: '12px',
      sm: '14px',
      base: '16px',
      lg: '18px',
      xl: '20px',
      '2xl': '24px',
      '3xl': '30px',
    },
    fontWeight: {
      normal: 400,
      medium: 500,
      semibold: 600,
      bold: 700,
    },
    lineHeight: {
      tight: 1.25,
      normal: 1.5,
      relaxed: 1.75,
    },
  },
  
  transitions: {
    fast: '150ms ease-in-out',
    normal: '250ms ease-in-out',
    slow: '350ms ease-in-out',
    // Transiciones premium "Apple-like"
    slide: 'transform 0.4s cubic-bezier(0.25, 1, 0.5, 1)',
    hover: 'all 0.15s ease-out',
  },
  
  // Sombras premium (glassmorphism)
  shadows: {
    floatingNav: '0 8px 32px rgba(0,0,0,0.12)',
    dayHover: '0 2px 8px rgba(0,0,0,0.08)',
    card: '0 4px 16px rgba(0,0,0,0.1)',
  },
  
  // Configuración por defecto del calendario
  calendar: {
    slotDuration: 30, // minutos
    startHour: 8,
    endHour: 20,
    snapInterval: 15, // minutos para snap-to-grid
  },
};

/**
 * Tokens Premium - Zenith Edition
 * Paleta y estilos elevados para experiencia premium
 */
export const PremiumTokens = {
  typography: {
    fontFamily: '"Inter", -apple-system, BlinkMacSystemFont, sans-serif',
    daySize: '14px',
  },
  shadows: {
    floatingNav: '0 8px 32px rgba(0,0,0,0.12)',
    dayHover: '0 2px 8px rgba(0,0,0,0.08)',
  },
  transitions: {
    slide: 'transform 0.4s cubic-bezier(0.25, 1, 0.5, 1)',
    hover: 'all 0.15s ease-out',
  },
};
