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

    const hasSelection = Boolean(state.selectedRange.start && state.selectedRange.end);
    const formatShortDate = (date) => date.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
    const formatRangeLabel = (start, end) => {
      if (!start || !end) return '';
      return start.getTime() === end.getTime()
        ? formatShortDate(start)
        : `${formatShortDate(start)} - ${formatShortDate(end)}`;
    };
    const rangeNights = hasSelection ? getDateRange(state.selectedRange.start, state.selectedRange.end).length : 0;
    const nightsLabel = rangeNights === 1 ? 'noche' : 'noches';
    const rangeLabel = hasSelection ? formatRangeLabel(state.selectedRange.start, state.selectedRange.end) : '';
    const selectionText = hasSelection
      ? `Seleccionado: ${rangeLabel} (${rangeNights} ${nightsLabel})`
      : 'Selecciona tu fecha de inicio y fin para ver el rango.';
    
    // Estilos inline para el contenedor principal
    const containerStyles = {
      width: '100%',
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'linear-gradient(180deg, #F8FAFC 0%, #EEF2FF 100%)',
      padding: `${Tokens.layout.spacing.xl} ${Tokens.layout.spacing.xl} ${hasSelection ? '110px' : Tokens.layout.spacing.xl} ${Tokens.layout.spacing.xl}`, // Espacio para barra fija
    };

    const cardStyles = {
      width: '100%',
      maxWidth: state.isDesktop ? '1200px' : '900px',
      backgroundColor: Tokens.colors.surface,
      borderRadius: Tokens.layout.borderRadius.xl,
      padding: Tokens.layout.spacing['2xl'],
      boxShadow: '0 30px 60px rgba(15, 23, 42, 0.08)',
      border: `1px solid ${Tokens.colors.border}`,
      display: 'flex',
      flexDirection: 'column',
      gap: Tokens.layout.spacing.lg,
    };

    const headerStyles = {
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      textAlign: 'center',
      gap: Tokens.layout.spacing.sm,
    };

    const badgeStyles = {
      alignSelf: 'center',
      padding: `${Tokens.layout.spacing.xs} ${Tokens.layout.spacing.md}`,
      borderRadius: '999px',
      backgroundColor: Tokens.colors.primaryLight,
      color: Tokens.colors.primary,
      fontSize: Tokens.typography.fontSize.sm,
      fontWeight: Tokens.typography.fontWeight.semibold,
      letterSpacing: '0.3px',
      textTransform: 'uppercase',
    };

    const titleStyles = {
      fontSize: Tokens.typography.fontSize['3xl'],
      fontWeight: Tokens.typography.fontWeight.bold,
      color: Tokens.colors.textPrimary,
    };

    const subtitleStyles = {
      fontSize: Tokens.typography.fontSize.base,
      color: Tokens.colors.textSecondary,
      maxWidth: '720px',
    };

    const selectionStyles = {
      fontSize: Tokens.typography.fontSize.sm,
      color: Tokens.colors.textPrimary,
      backgroundColor: Tokens.colors.surfaceSecondary,
      border: `1px solid ${Tokens.colors.border}`,
      padding: `${Tokens.layout.spacing.xs} ${Tokens.layout.spacing.md}`,
      borderRadius: Tokens.layout.borderRadius.lg,
    };

    const rulesStyles = {
      display: 'flex',
      flexWrap: 'wrap',
      gap: Tokens.layout.spacing.sm,
      justifyContent: 'center',
    };

    const rulePillStyles = {
      backgroundColor: Tokens.colors.surfaceSecondary,
      border: `1px solid ${Tokens.colors.border}`,
      borderRadius: '999px',
      padding: `${Tokens.layout.spacing.xs} ${Tokens.layout.spacing.md}`,
      fontSize: Tokens.typography.fontSize.sm,
      color: Tokens.colors.textSecondary,
      fontWeight: Tokens.typography.fontWeight.medium,
    };

    const legendStyles = {
      display: 'flex',
      flexWrap: 'wrap',
      gap: Tokens.layout.spacing.sm,
      justifyContent: 'center',
    };

    const legendItemStyles = {
      display: 'flex',
      alignItems: 'center',
      gap: Tokens.layout.spacing.xs,
      padding: `${Tokens.layout.spacing.xs} ${Tokens.layout.spacing.md}`,
      borderRadius: '999px',
      border: `1px solid ${Tokens.colors.border}`,
      backgroundColor: Tokens.colors.surfaceSecondary,
      fontSize: Tokens.typography.fontSize.sm,
      color: Tokens.colors.textSecondary,
    };

    const getLegendSwatchStyles = (color, borderColor = null) => ({
      width: '12px',
      height: '12px',
      borderRadius: '4px',
      backgroundColor: color,
      border: borderColor ? `1px solid ${borderColor}` : 'none',
    });

    const controlsStyles = {
      display: 'flex',
      flexDirection: 'column',
      gap: Tokens.layout.spacing.md,
      padding: Tokens.layout.spacing.md,
      borderRadius: Tokens.layout.borderRadius.lg,
      backgroundColor: Tokens.colors.surfaceSecondary,
      border: `1px solid ${Tokens.colors.border}`,
    };

    const controlsRowStyles = {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      flexWrap: 'wrap',
      gap: Tokens.layout.spacing.sm,
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
      boxShadow: Tokens.layout.shadow.md,
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

    const clearSelection = () => {
      state.selectedRange = { start: null, end: null };
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
      boxShadow: 'none',
    };

    const presetButtonHoverStyles = {
      ...presetButtonStyles,
      backgroundColor: Tokens.colors.primaryLight,
      borderColor: Tokens.colors.primary,
    };

    const clearButtonStyles = {
      ...presetButtonStyles,
      color: Tokens.colors.primary,
      borderColor: Tokens.colors.primary,
      backgroundColor: Tokens.colors.primaryLight,
    };

    const clearButtonHoverStyles = {
      ...clearButtonStyles,
      backgroundColor: Tokens.colors.surface,
    };

    const legendItems = [
      { key: 'available', label: 'Disponible', color: Tokens.colors.cell.default, border: Tokens.colors.border },
      { key: 'selected', label: 'Seleccionado', color: Tokens.colors.cell.selected },
      { key: 'range', label: 'En rango', color: Tokens.colors.cell.inRange },
      { key: 'booked', label: 'Ocupado', color: Tokens.colors.cell.booked },
      { key: 'blocked', label: 'Bloqueado', color: Tokens.colors.cell.disabled },
    ];

    // Construir array de children sin null
    const children = [
      m('div', { key: 'main-card', style: cardStyles }, [
        m('div', { key: 'header', style: headerStyles }, [
          m('div', { style: badgeStyles }, 'Ralph Loop'),
          m('h1', { style: titleStyles }, 'Selecciona tus fechas'),
          m('p', { style: subtitleStyles }, 'Haz clic en una fecha de inicio, mueve el ratón y selecciona la fecha de fin. El rango se ajusta automáticamente si hay días no disponibles.'),
          m('div', { style: selectionStyles }, selectionText),
        ]),
        m('div', { key: 'rules', style: rulesStyles }, [
          m('div', { style: rulePillStyles }, `Estancia mínima: ${bookingData.minStay} ${bookingData.minStay === 1 ? 'noche' : 'noches'}`),
          m('div', { style: rulePillStyles }, `Estancia máxima: ${bookingData.maxStay} ${bookingData.maxStay === 1 ? 'noche' : 'noches'}`),
        ]),
        m('div', { key: 'legend', style: legendStyles }, [
          ...legendItems.map((item) => m('div', { key: item.key, style: legendItemStyles }, [
            m('span', { style: getLegendSwatchStyles(item.color, item.border) }),
            item.label,
          ])),
        ]),
        m('div', { key: 'controls', style: controlsStyles }, [
          m('div', { style: controlsRowStyles }, [
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
          m('div', { style: controlsRowStyles }, [
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
            ...(hasSelection ? [m('button', {
              style: clearButtonStyles,
              onmouseenter: (e) => Object.assign(e.target.style, clearButtonHoverStyles),
              onmouseleave: (e) => Object.assign(e.target.style, clearButtonStyles),
              onclick: clearSelection,
            }, 'Limpiar selección')] : []),
          ]),
        ]),
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
      ]),
    ];

    // Agregar barra de resumen si hay rango seleccionado
    if (hasSelection) {
      const rangeText = `${rangeNights} ${nightsLabel}`;
      
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
            rangeLabel,
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
            boxShadow: Tokens.layout.shadow.md,
          },
          onmouseenter: (e) => {
            e.target.style.backgroundColor = Tokens.colors.primaryHover;
            e.target.style.transform = 'translateY(-1px)';
            e.target.style.boxShadow = Tokens.layout.shadow.lg;
          },
          onmouseleave: (e) => {
            e.target.style.backgroundColor = Tokens.colors.primary;
            e.target.style.transform = 'translateY(0)';
            e.target.style.boxShadow = Tokens.layout.shadow.md;
          },
          onclick: () => {
            alert(`¡Reserva confirmada!\nRango: ${rangeLabel}\n${rangeNights} ${nightsLabel}`);
          },
        }, 'Continuar'),
      ]));
    }

    return m('div', { style: containerStyles }, children);
  },
};
