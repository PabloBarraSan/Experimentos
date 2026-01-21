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
} from './src/core/dates.js';
import { calculateRangeTotal, formatPrice } from './src/core/priceUtils.js';

/**
 * Componente raíz de la aplicación
 */
export const app = {
  oninit: (vnode) => {
    const state = vnode.state;
    state.currentMonth = new Date();
    state.selectedRange = { start: null, end: null };
    state.isDesktop = window.innerWidth >= 1024; // Detectar desktop
    
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
    
    // Estilos inline para el contenedor principal
    const containerStyles = {
      width: '100%',
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: Tokens.colors.surfaceSecondary,
      padding: `${Tokens.layout.spacing.xl} ${Tokens.layout.spacing.xl} ${state.selectedRange.start && state.selectedRange.end ? '100px' : Tokens.layout.spacing.xl} ${Tokens.layout.spacing.xl}`, // Espacio para barra fija
    };

    // Datos de ejemplo para el calendario de booking
    const bookingData = {
      bookedDates: [
        // Algunas fechas ocupadas de ejemplo
        '2024-01-15',
        '2024-01-16',
        '2024-01-20',
        '2024-01-25',
      ],
      blockedDays: [0, 6], // Domingos y Sábados bloqueados
      minStay: 1,
      maxStay: 30,
      // Sistema de precios (Zenith Edition)
      dailyRates: {
        default: 100,
        currency: 'EUR',
        modifiers: {
          // Precios específicos por fecha (alta demanda)
          '2024-01-10': 150,
          '2024-01-11': 150,
          '2024-01-12': 140,
          '2024-01-13': 120,
          '2024-01-14': 120,
          // Multiplicador para fines de semana
          weekend: 1.2, // 20% más caro los fines de semana
        },
      },
    };

    // Navegación de meses
    const navigatePrevious = () => {
      const newDate = new Date(state.currentMonth);
      newDate.setMonth(newDate.getMonth() - 1);
      state.currentMonth = newDate;
      m.redraw();
    };

    const navigateNext = () => {
      const newDate = new Date(state.currentMonth);
      newDate.setMonth(newDate.getMonth() + 1);
      state.currentMonth = newDate;
      m.redraw();
    };

    const navigateToday = () => {
      state.currentMonth = new Date();
      m.redraw();
    };

    const isUnavailableDate = (date) => {
      return isDateBooked(date, bookingData.bookedDates) || isDayBlocked(date, bookingData.blockedDays);
    };

    const normalizeRange = (start, end) => {
      const normalizedStart = startOfDay(start);
      const normalizedEnd = startOfDay(end);
      return normalizedStart <= normalizedEnd
        ? { start: normalizedStart, end: normalizedEnd }
        : { start: normalizedEnd, end: normalizedStart };
    };

    const validatePresetRange = (range) => {
      const normalized = normalizeRange(range.start, range.end);
      if (isUnavailableDate(normalized.start)) {
        console.warn('El preset no puede iniciar en un día no disponible');
        return null;
      }

      const allDates = getDateRange(normalized.start, normalized.end);
      const firstUnavailable = allDates.find((date, index) => index > 0 && isUnavailableDate(date));
      let finalEnd = normalized.end;
      if (firstUnavailable) {
        const clamped = new Date(firstUnavailable);
        clamped.setDate(clamped.getDate() - 1);
        finalEnd = startOfDay(clamped);
      }

      const rangeDates = getDateRange(normalized.start, finalEnd);
      const nights = rangeDates.length;
      if (nights < bookingData.minStay) {
        console.warn(`La estancia mínima es de ${bookingData.minStay} días`);
        return null;
      }
      if (nights > bookingData.maxStay) {
        console.warn(`La estancia máxima es de ${bookingData.maxStay} días`);
        return null;
      }

      return { start: normalized.start, end: finalEnd };
    };

    const applyPresetRange = (range) => {
      const validatedRange = validatePresetRange(range);
      if (!validatedRange) return;
      if (validatedRange.start.getMonth() !== state.currentMonth.getMonth() ||
          validatedRange.start.getFullYear() !== state.currentMonth.getFullYear()) {
        state.currentMonth = new Date(validatedRange.start);
      }
      handleRangeSelect(validatedRange.start, validatedRange.end);
    };

    // Estilos para los botones de navegación
    const buttonStyles = {
      padding: `${Tokens.layout.spacing.sm} ${Tokens.layout.spacing.md}`,
      backgroundColor: Tokens.colors.primary,
      color: Tokens.colors.textInverse,
      border: 'none',
      borderRadius: Tokens.layout.borderRadius.md,
      fontSize: Tokens.typography.fontSize.sm,
      fontWeight: Tokens.typography.fontWeight.medium,
      cursor: 'pointer',
      transition: Tokens.transitions.fast,
    };

    const buttonHoverStyles = {
      ...buttonStyles,
      backgroundColor: Tokens.colors.primaryHover,
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

    // Handlers para presets
    const selectWeekRange = () => {
      const today = new Date();
      const weekRange = getWeekRange(today);
      applyPresetRange(weekRange);
    };

    const selectWeekendRange = () => {
      const today = new Date();
      const weekendRange = getCurrentWeekendRange(today);
      applyPresetRange(weekendRange);
    };

    // Estilos para botones de preset
    const presetButtonStyles = {
      ...buttonStyles,
      backgroundColor: Tokens.colors.surface,
      color: Tokens.colors.textPrimary,
      border: `1px solid ${Tokens.colors.border}`,
    };

    const presetButtonHoverStyles = {
      ...presetButtonStyles,
      backgroundColor: Tokens.colors.primaryLight,
      borderColor: Tokens.colors.primary,
    };

    // Construir array de children sin null
    const children = [
      // Controles de navegación
      m('div', {
        key: 'nav-controls',
        style: {
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: Tokens.layout.spacing.md,
          marginBottom: Tokens.layout.spacing.md,
        }
      }, [
        m('button', {
          style: buttonStyles,
          onmouseenter: (e) => Object.assign(e.target.style, buttonHoverStyles),
          onmouseleave: (e) => Object.assign(e.target.style, buttonStyles),
          onclick: navigatePrevious,
        }, '◀ Anterior'),
        m('button', {
          style: buttonStyles,
          onmouseenter: (e) => Object.assign(e.target.style, buttonHoverStyles),
          onmouseleave: (e) => Object.assign(e.target.style, buttonStyles),
          onclick: navigateToday,
        }, 'Hoy'),
        m('button', {
          style: buttonStyles,
          onmouseenter: (e) => Object.assign(e.target.style, buttonHoverStyles),
          onmouseleave: (e) => Object.assign(e.target.style, buttonStyles),
          onclick: navigateNext,
        }, 'Siguiente ▶'),
      ]),

      // Botones de presets
      m('div', {
        key: 'preset-controls',
        style: {
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: Tokens.layout.spacing.sm,
          marginBottom: Tokens.layout.spacing.lg,
        }
      }, [
        m('button', {
          style: presetButtonStyles,
          onmouseenter: (e) => Object.assign(e.target.style, presetButtonHoverStyles),
          onmouseleave: (e) => Object.assign(e.target.style, presetButtonStyles),
          onclick: selectWeekRange,
        }, '📅 Semana Completa'),
        m('button', {
          style: presetButtonStyles,
          onmouseenter: (e) => Object.assign(e.target.style, presetButtonHoverStyles),
          onmouseleave: (e) => Object.assign(e.target.style, presetButtonStyles),
          onclick: selectWeekendRange,
        }, '🏖️ Este Fin de Semana'),
      ]),

      // Calendario mensual (vista dual en desktop)
      m(MonthCalendar, {
        key: 'calendar',
        currentMonth: state.currentMonth,
        numberOfMonths: state.isDesktop ? 2 : 1,
        data: bookingData,
        state: {
          selectedRange: state.selectedRange,
          currentMonth: state.currentMonth,
        },
        callbacks: {
          onRangeSelect: handleRangeSelect,
        },
      }),
    ];

    // Agregar barra de resumen si hay rango seleccionado
    if (state.selectedRange.start && state.selectedRange.end) {
      // Calcular información del rango
      const rangeInfo = calculateRangeTotal(state.selectedRange.start, state.selectedRange.end, bookingData.dailyRates);
      const nightsText = rangeInfo.nights === 1 ? 'noche' : 'noches';
      const rangeText = `${rangeInfo.nights} ${nightsText} • Total: ${formatPrice(rangeInfo.total, rangeInfo.currency)}`;
      
      children.push(m('div', {
        key: 'summary-bar',
        style: {
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          backgroundColor: Tokens.colors.surface,
          borderTop: `1px solid ${Tokens.colors.border}`,
          padding: `${Tokens.layout.spacing.md} ${Tokens.layout.spacing.xl}`,
          boxShadow: '0 -4px 16px rgba(0,0,0,0.1)',
          zIndex: Tokens.layout.zIndex.modal - 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: Tokens.layout.spacing.md,
        }
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
            }, 'Rango: '),
            `${state.selectedRange.start.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })} - ${state.selectedRange.end.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}`,
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
            padding: `${Tokens.layout.spacing.sm} ${Tokens.layout.spacing.xl}`,
            backgroundColor: Tokens.colors.primary,
            color: Tokens.colors.textInverse,
            border: 'none',
            borderRadius: Tokens.layout.borderRadius.md,
            fontSize: Tokens.typography.fontSize.base,
            fontWeight: Tokens.typography.fontWeight.semibold,
            cursor: 'pointer',
            transition: Tokens.transitions.fast,
            boxShadow: Tokens.shadows.md,
          },
          onmouseenter: (e) => {
            e.target.style.backgroundColor = Tokens.colors.primaryHover;
            e.target.style.transform = 'translateY(-1px)';
            e.target.style.boxShadow = Tokens.shadows.lg;
          },
          onmouseleave: (e) => {
            e.target.style.backgroundColor = Tokens.colors.primary;
            e.target.style.transform = 'translateY(0)';
            e.target.style.boxShadow = Tokens.shadows.md;
          },
          onclick: () => {
            alert(`¡Reserva confirmada!\n${rangeInfo.nights} ${rangeInfo.nights === 1 ? 'noche' : 'noches'}\nTotal: ${formatPrice(rangeInfo.total, rangeInfo.currency)}`);
          },
        }, 'Reservar'),
      ]));
    }

    return m('div', { style: containerStyles }, children);
  },
};
