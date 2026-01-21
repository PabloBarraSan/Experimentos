/**
 * Punto de entrada - Ralph Loop
 * Monta el componente principal en el DOM
 * Booking Calendar - Vista Mensual
 */

import { MonthCalendar } from './src/components/MonthCalendar.js';
import { Tokens } from './src/tokens.js';
import { 
  getWeekRange, 
  getCurrentWeekendRange, 
  getDateRange, 
  isDateBooked, 
  isDayBlocked,
  startOfDay,
  startOfMonth,
  endOfMonth,
  addDays,
} from './src/core/dates.js';

// Textos mínimos - Zero Noise (sin objeto translations)
const getTexts = (locale) => {
  const isES = locale.startsWith('es');
  return {
    summaryRangeLabel: isES ? 'Rango:' : 'Range:',
    summaryCta: isES ? 'Reservar' : 'Book',
    nights: { one: isES ? 'noche' : 'night', many: isES ? 'noches' : 'nights' },
    alertConfirm: (rangeLabel, nightsText) => 
      isES 
        ? `¡Reserva confirmada!\nRango: ${rangeLabel}\n${nightsText}`
        : `Booking confirmed!\nRange: ${rangeLabel}\n${nightsText}`,
    calendarLabel: isES ? 'Calendario de reserva' : 'Booking calendar',
    status: {
      available: isES ? 'Disponible' : 'Available',
      booked: isES ? 'Ocupado' : 'Booked',
      blocked: isES ? 'Bloqueado' : 'Blocked',
      selected: isES ? 'Seleccionado' : 'Selected',
      inRange: isES ? 'En rango' : 'In range',
      outOfMonth: isES ? 'Fuera de mes' : 'Out of month',
    },
  };
};

/**
 * Componente raíz de la aplicación
 */
export const app = {
  oninit: (vnode) => {
    const state = vnode.state;
    state.currentMonth = new Date();
    state.selectedRange = { start: null, end: null };
    state.isDesktop = window.innerWidth >= 1024; // Detectar desktop
    state.locale = state.locale || 'es-ES';
    document.documentElement.lang = state.locale.split('-')[0];
    
    // Listener para cambios de tamaño de ventana
    state.handleResize = () => {
      state.isDesktop = window.innerWidth >= 1024;
      m.redraw();
    };
    window.addEventListener('resize', state.handleResize);
  },
  
  onremove: (vnode) => {
    // Limpiar listener
    if (vnode.state.handleResize) {
      window.removeEventListener('resize', vnode.state.handleResize);
    }
  },

  view: (vnode) => {
    const state = vnode.state;

    const locale = state.locale || 'es-ES';
    const strings = getTexts(locale);
    const hasSelection = Boolean(state.selectedRange.start && state.selectedRange.end);
    const formatShortDate = (date) => date.toLocaleDateString(locale, { day: 'numeric', month: 'short' });
    const formatRangeLabel = (start, end) => {
      if (!start || !end) return '';
      return start.getTime() === end.getTime()
        ? formatShortDate(start)
        : `${formatShortDate(start)} - ${formatShortDate(end)}`;
    };
    const rangeNights = hasSelection ? getDateRange(state.selectedRange.start, state.selectedRange.end).length : 0;
    const nightsLabel = rangeNights === 1 ? strings.nights.one : strings.nights.many;
    const rangeLabel = hasSelection ? formatRangeLabel(state.selectedRange.start, state.selectedRange.end) : '';
    
    // Datos de ejemplo para el calendario de booking (declarado antes de su uso)
    const bookingData = {
      bookedDates: [
        // Algunas fechas ocupadas de ejemplo
        '2024-01-15',
        '2024-01-16',
        '2024-01-20',
        '2024-01-25',
      ],
      // blockedDays eliminado - ahora solo se bloquean los bookedDates
      minStay: 1,
      maxStay: 31,
      // Precios por fecha (ejemplo)
      prices: {
        '2024-01-01': 45,
        '2024-01-02': 50,
        '2024-01-03': 45,
        '2024-01-04': 55,
        '2024-01-05': 60,
        '2024-01-06': 65,
        '2024-01-07': 70,
        // ... más precios según necesidad
      },
    };
    
    // Calcular precio total del rango
    const calculateTotalPrice = () => {
      if (!hasSelection) return 0;
      let total = 0;
      const dates = getDateRange(state.selectedRange.start, state.selectedRange.end);
      dates.forEach(date => {
        const dateKey = date.toISOString().split('T')[0];
        const price = bookingData.prices[dateKey] || 0;
        total += price;
      });
      return total;
    };
    
    const totalPrice = hasSelection ? calculateTotalPrice() : 0;
    
    // Estilos inline para el contenedor principal - Fondo sólido neutro para mejor contraste
    const containerStyles = {
      width: '100%',
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'flex-start',
      background: '#FFFFFF', // Fondo blanco sólido para mejor contraste
      padding: `${Tokens.layout.spacing.lg} ${Tokens.layout.spacing.md}`,
      paddingBottom: '140px', // Espacio fijo para footer flotante (no cambia dinámicamente)
      position: 'relative',
    };
    
    // Wrapper para el calendario con margin auto para centrado perfecto
    const calendarWrapperStyles = {
      width: '100%',
      maxWidth: '800px',
      margin: 'auto',
    };

    // Callback para cuando se selecciona un rango
    const handleRangeSelect = (start, end) => {
      state.selectedRange = { start, end };
      console.log('Rango seleccionado:', {
        start: start.toISOString().split('T')[0],
        end: end.toISOString().split('T')[0],
      });
      m.redraw();
    };

    // Callback para limpiar selección cuando se inicia una nueva
    const handleSelectionStart = () => {
      state.selectedRange = { start: null, end: null };
      m.redraw();
    };

    // Construir array de children - Solo calendario, sin caja externa
    const children = [
      m('div', {
        key: 'calendar-wrapper',
        style: calendarWrapperStyles,
      }, [
        m(MonthCalendar, {
          key: 'calendar',
          currentMonth: state.currentMonth,
          numberOfMonths: 1,
          locale: locale,
          labels: {
            status: strings.status,
            nights: strings.nights,
            calendarLabel: strings.calendarLabel,
          },
          data: bookingData,
          state: {
            selectedRange: state.selectedRange,
            currentMonth: state.currentMonth,
          },
          callbacks: {
            onRangeSelect: handleRangeSelect,
            onSelectionStart: handleSelectionStart,
            onMonthChange: (nextDate) => {
              state.currentMonth = new Date(nextDate);
              m.redraw();
            },
          },
        }),
      ]),
    ];
    
    // Footer flotante sticky bottom - Solo aparece si hay selección
    if (hasSelection) {
      const rangeText = `${rangeNights} ${nightsLabel}`;
      
      // Estado para animación de precio
      if (!state.animatedPrice) {
        state.animatedPrice = 0;
        state.priceAnimationFrame = null;
      }
      
      // Animar precio cuando cambia
      if (state.lastPrice !== totalPrice) {
        const startPrice = state.animatedPrice || 0;
        const endPrice = totalPrice;
        const duration = 300; // ms
        const startTime = performance.now();
        
        if (state.priceAnimationFrame) {
          cancelAnimationFrame(state.priceAnimationFrame);
        }
        
        const animate = (currentTime) => {
          const elapsed = currentTime - startTime;
          const progress = Math.min(elapsed / duration, 1);
          // Easing cubic-bezier suave
          const eased = progress < 0.5 
            ? 4 * progress * progress * progress
            : 1 - Math.pow(-2 * progress + 2, 3) / 2;
          
          state.animatedPrice = Math.round(startPrice + (endPrice - startPrice) * eased);
          m.redraw();
          
          if (progress < 1) {
            state.priceAnimationFrame = requestAnimationFrame(animate);
          } else {
            state.animatedPrice = endPrice;
            state.priceAnimationFrame = null;
          }
        };
        
        state.priceAnimationFrame = requestAnimationFrame(animate);
        state.lastPrice = totalPrice;
      }
      
      const footerStyles = {
        position: 'fixed',
        bottom: '24px', // Flotando, no pegado al borde total
        left: '50%',
        transform: 'translateX(-50%)', // Centrado perfecto
        width: 'calc(100% - 48px)', // Márgenes laterales
        maxWidth: '600px', // Ancho máximo contenido
        
        // GLASSMORPHISM MAGIC
        backgroundColor: 'rgba(255, 255, 255, 0.85)', // Blanco translúcido
        backdropFilter: 'blur(16px) saturate(180%)', // Desenfoque potente tipo iOS
        WebkitBackdropFilter: 'blur(16px) saturate(180%)',
        
        border: '1px solid rgba(255, 255, 255, 0.5)',
        borderRadius: '24px', // Bordes muy redondeados (Pill shape)
        padding: '16px 24px',
        
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: Tokens.layout.spacing.md,
        boxShadow: '0 20px 40px -10px rgba(0, 0, 0, 0.15), 0 0 0 1px rgba(0,0,0,0.05)', // Sombra difusa + borde sutil
        zIndex: 1000,
        transition: 'all 0.3s cubic-bezier(0.33, 1, 0.68, 1)',
      };
      
      children.push(m('div', {
        key: 'floating-footer',
        style: footerStyles,
      }, [
        m('div', {
          style: {
            display: 'flex',
            alignItems: 'center',
            gap: Tokens.layout.spacing.md,
            flexWrap: 'wrap',
          }
        }, [
          m('div', {
            style: {
              fontSize: Tokens.typography.fontSize.base,
              color: Tokens.colors.textPrimary,
              fontWeight: Tokens.typography.fontWeight.medium,
            }
          }, [
            m('span', {
              style: {
                color: Tokens.colors.textSecondary,
                marginRight: Tokens.layout.spacing.xs,
              }
            }, `${strings.summaryRangeLabel} `),
            m('span', rangeLabel),
          ]),
          m('div', {
            style: {
              fontSize: Tokens.typography.fontSize.base,
              color: Tokens.colors.textPrimary,
              fontWeight: Tokens.typography.fontWeight.semibold,
            }
          }, rangeText),
        ]),
        m('button', {
          style: {
            padding: `${Tokens.layout.spacing.md} ${Tokens.layout.spacing.xl}`,
            backgroundColor: '#111827', // Negro casi puro (más elegante que azul standard)
            color: Tokens.colors.textInverse,
            border: 'none',
            borderRadius: '100px', // Pill button
            fontSize: Tokens.typography.fontSize.base,
            fontWeight: Tokens.typography.fontWeight.semibold,
            cursor: 'pointer',
            transition: Tokens.transitions.fast,
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
            display: 'flex',
            alignItems: 'center',
            gap: Tokens.layout.spacing.sm,
          },
          onmouseenter: (e) => {
            e.target.style.backgroundColor = '#1F2937';
            e.target.style.boxShadow = '0 6px 16px rgba(0,0,0,0.2)';
          },
          onmouseleave: (e) => {
            e.target.style.backgroundColor = '#111827';
            e.target.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)';
          },
          onclick: () => {
            const nightsText = `${rangeNights} ${nightsLabel}`;
            alert(strings.alertConfirm(rangeLabel, nightsText));
          },
          'aria-label': strings.summaryCta,
        }, [
          m('span', strings.summaryCta),
          m('span', {
            style: {
              fontSize: Tokens.typography.fontSize.lg,
              fontWeight: Tokens.typography.fontWeight.bold,
              marginLeft: Tokens.layout.spacing.xs,
            }
          }, `${state.animatedPrice || totalPrice}€`),
        ]),
      ]));
    } else {
      // Limpiar animación si no hay selección
      if (state.priceAnimationFrame) {
        cancelAnimationFrame(state.priceAnimationFrame);
        state.priceAnimationFrame = null;
      }
      state.animatedPrice = 0;
      state.lastPrice = 0;
    }

    return m('div', { style: containerStyles }, children);
  },
};
