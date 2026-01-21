/**
 * Componente MonthCalendar - Vista Mensual de Booking
 * Calendario mensual para selección de rangos de fechas
 */

import { Tokens, PremiumTokens } from '../tokens.js';
import {
  generateMonthGrid,
  isDateBooked,
  isDayBlocked,
  startOfDay,
  isSameDay,
  getDateRange,
  addDays,
} from '../core/dates.js';

/**
 * Componente MonthCalendar
 * @param {Object} vnode - Props del componente
 * @param {Date} vnode.attrs.currentMonth - Mes actual a mostrar
 * @param {Object} vnode.attrs.data - Datos (bookedDates, blockedDays, minStay, maxStay)
 * @param {string} vnode.attrs.locale - Locale para textos y fechas (ej: "es-ES")
 * @param {Object} vnode.attrs.labels - Labels personalizados (dayNames, monthNames, status, nights)
 * @param {Object} vnode.attrs.state - Estado (selectedRange, currentMonth)
 * @param {Object} vnode.attrs.callbacks - Callbacks (onRangeSelect, onMonthChange)
 * @param {number} vnode.attrs.numberOfMonths - Número de meses a mostrar (1 o 2, default: 1)
 */
export const MonthCalendar = {
  oninit: (vnode) => {
    const state = vnode.state;
    state.hoveredDate = null;
    state.selectionStart = null;
    state.isSelecting = false;
    state.hoveredCell = null;
    state.tooltipInfo = null; // Para tooltip durante hover
    state.focusedDate = null;
  },

  view: (vnode) => {
    const { currentMonth, data = {}, callbacks = {}, numberOfMonths = 1, locale = 'es-ES', labels = {} } = vnode.attrs;
    const state = vnode.state;
    
    const bookedDates = data.bookedDates || [];
    const blockedDays = data.blockedDays || [];
    const minStay = data.minStay || 1;
    const maxStay = data.maxStay || 30;
    
    const selectedRange = vnode.attrs.state?.selectedRange || { start: null, end: null };
    
    // Generar meses a mostrar
    const monthsToShow = [];
    for (let i = 0; i < numberOfMonths; i++) {
      const monthDate = new Date(currentMonth);
      monthDate.setMonth(currentMonth.getMonth() + i);
      monthsToShow.push(monthDate);
    }
    
    const formatShortDate = (date) => {
      return date.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
    };
    
    const statusLabels = {
      available: 'Disponible',
      booked: 'Ocupado',
      blocked: 'Bloqueado',
      selected: 'Seleccionado',
      inRange: 'En rango',
      outOfMonth: 'Fuera de mes',
      ...(labels.status || {}),
    };

    const nightsLabels = {
      one: 'noche',
      many: 'noches',
      ...(labels.nights || {}),
    };

    const generateDayNames = (targetLocale) => {
      const formatter = new Intl.DateTimeFormat(targetLocale, { weekday: 'short' });
      const base = new Date(2024, 0, 1); // Lunes
      return Array.from({ length: 7 }, (_, index) => formatter.format(addDays(base, index)));
    };

    const generateMonthNames = (targetLocale) => {
      const formatter = new Intl.DateTimeFormat(targetLocale, { month: 'long' });
      return Array.from({ length: 12 }, (_, index) => formatter.format(new Date(2024, index, 1)));
    };

    const dayNames = Array.isArray(labels.dayNames) && labels.dayNames.length === 7
      ? labels.dayNames
      : generateDayNames(locale);
    const monthNames = Array.isArray(labels.monthNames) && labels.monthNames.length === 12
      ? labels.monthNames
      : generateMonthNames(locale);

    const formatShortDate = (date) => {
      return date.toLocaleDateString(locale, { day: 'numeric', month: 'short' });
    };

    const formatLongDate = (date) => {
      return date.toLocaleDateString(locale, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    };

    if (!state.focusedDate ||
        state.focusedDate.getMonth() !== currentMonth.getMonth() ||
        state.focusedDate.getFullYear() !== currentMonth.getFullYear()) {
      state.focusedDate = startOfDay(new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1));
    }

    const isUnavailableDate = (date) => {
      return isDateBooked(date, bookedDates) || isDayBlocked(date, blockedDays);
    };

    const getFirstUnavailableDateInRange = (startDate, endDate) => {
      if (!startDate || !endDate) return null;
      const start = startOfDay(startDate);
      const end = startOfDay(endDate);
      const direction = start <= end ? 1 : -1;
      const current = new Date(start);
      current.setDate(current.getDate() + direction);
      while (direction > 0 ? current <= end : current >= end) {
        if (isUnavailableDate(current)) {
          return new Date(current);
        }
        current.setDate(current.getDate() + direction);
      }
      return null;
    };

    const clampRangeEnd = (startDate, endDate) => {
      if (!startDate || !endDate) return endDate;
      const start = startOfDay(startDate);
      const end = startOfDay(endDate);
      const firstUnavailable = getFirstUnavailableDateInRange(start, end);
      if (!firstUnavailable) {
        return end;
      }
      const direction = start <= end ? 1 : -1;
      const clamped = new Date(firstUnavailable);
      clamped.setDate(clamped.getDate() - direction);
      return startOfDay(clamped);
    };
    
    // Estilos del contenedor principal
    const containerStyles = {
      width: '100%',
      maxWidth: numberOfMonths === 2 ? '1400px' : '800px',
      margin: '0 auto',
      padding: Tokens.layout.spacing.lg,
      backgroundColor: Tokens.colors.surface,
      borderRadius: Tokens.layout.borderRadius.lg,
      display: 'flex',
      flexDirection: 'row',
      gap: numberOfMonths === 2 ? Tokens.layout.spacing.xl : 0,
      flexWrap: 'wrap',
    };
    
    // Estilos para cada mes individual
    const monthContainerStyles = {
      flex: numberOfMonths === 2 ? '1 1 calc(50% - 16px)' : '1 1 100%',
      minWidth: numberOfMonths === 2 ? '400px' : 'auto',
    };
    
    // Estilos del header del mes
    const monthHeaderStyles = {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: Tokens.layout.spacing.lg,
      paddingBottom: Tokens.layout.spacing.md,
      borderBottom: `2px solid ${Tokens.colors.border}`,
    };
    
    const monthTitleStyles = {
      fontSize: Tokens.typography.fontSize['2xl'],
      fontWeight: Tokens.typography.fontWeight.bold,
      color: Tokens.colors.textPrimary,
    };
    
    // Estilos del grid
    const gridStyles = {
      display: 'grid',
      gridTemplateColumns: 'repeat(7, 1fr)',
      gap: '2px',
      width: '100%',
    };
    
    // Estilos del header de días de la semana
    const dayHeaderStyles = {
      padding: Tokens.layout.spacing.md,
      textAlign: 'center',
      fontSize: Tokens.typography.fontSize.sm,
      fontWeight: Tokens.typography.fontWeight.semibold,
      color: Tokens.colors.textSecondary,
      backgroundColor: Tokens.colors.surfaceSecondary,
    };
    
    // Handler para click en celda
    const handleCellClick = (cell) => {
      if (!cell.isCurrentMonth) return;
      if (isUnavailableDate(cell.date)) return;
      
      const clickedDate = startOfDay(cell.date);
      state.focusedDate = clickedDate;
      
      if (!state.selectionStart) {
        // Primer click: establecer inicio
        state.selectionStart = clickedDate;
        state.isSelecting = true;
        m.redraw();
      } else {
        // Segundo click: establecer fin y completar selección
        const startDate = state.selectionStart;
        const clampedEnd = clampRangeEnd(startDate, clickedDate);
        
        // Asegurar que start < end
        const actualStart = startDate <= clampedEnd ? startDate : clampedEnd;
        const actualEnd = startDate <= clampedEnd ? clampedEnd : startDate;
        
        const rangeDates = getDateRange(actualStart, actualEnd);
        const daysDiff = rangeDates.length;
        
        if (daysDiff < minStay) {
          console.warn(`La estancia mínima es de ${minStay} días`);
          // Reiniciar selección
          state.selectionStart = null;
          state.isSelecting = false;
          state.hoveredDate = null;
          state.tooltipInfo = null;
          m.redraw();
          return;
        }
        
        if (daysDiff > maxStay) {
          console.warn(`La estancia máxima es de ${maxStay} días`);
          // Reiniciar selección
          state.selectionStart = null;
          state.isSelecting = false;
          state.hoveredDate = null;
          state.tooltipInfo = null;
          m.redraw();
          return;
        }
        
        // Verificar que no haya días no disponibles en el rango
        const hasUnavailableDate = rangeDates.some((date) => isUnavailableDate(date));
        if (hasUnavailableDate) {
          console.warn('El rango seleccionado incluye días no disponibles');
          // Reiniciar selección
          state.selectionStart = null;
          state.isSelecting = false;
          state.hoveredDate = null;
          state.tooltipInfo = null;
          m.redraw();
          return;
        }
        
        // Llamar callback
        if (callbacks.onRangeSelect) {
          callbacks.onRangeSelect(actualStart, actualEnd);
        }
        
        // Limpiar estado
        state.selectionStart = null;
        state.isSelecting = false;
        state.hoveredDate = null;
        state.tooltipInfo = null;
        m.redraw();
      }
    };
    
    // Handler para hover en celda
    const handleCellHover = (cell) => {
      // Hover básico para todas las celdas
      if (!isUnavailableDate(cell.date)) {
        state.hoveredCell = cell;
      }
      
      // Durante selección, actualizar hoveredDate y tooltip
      if (state.isSelecting && state.selectionStart) {
        if (!cell.isCurrentMonth) return;
        if (isUnavailableDate(cell.date)) return;
        
        const proposedHoverDate = startOfDay(cell.date);
        state.hoveredDate = clampRangeEnd(state.selectionStart, proposedHoverDate);
        
        // Calcular tooltip con información de rango
        if (state.selectionStart && state.hoveredDate) {
          const rangeStart = state.selectionStart < state.hoveredDate ? state.selectionStart : state.hoveredDate;
          const rangeEnd = state.selectionStart < state.hoveredDate ? state.hoveredDate : state.selectionStart;
          const nights = getDateRange(rangeStart, rangeEnd).length;
          state.tooltipInfo = {
            nights: nights,
            start: rangeStart,
            end: rangeEnd,
          };
        }
      } else {
        state.tooltipInfo = null;
      }
      
      m.redraw();
    };
    
    // Handler para salir del hover
    const handleCellLeave = () => {
      state.hoveredCell = null;
      if (state.isSelecting) {
        state.hoveredDate = null;
        state.tooltipInfo = null;
      }
      m.redraw();
    };

    const focusDate = (date) => {
      const normalized = startOfDay(date);
      state.focusedDate = normalized;
      if (callbacks.onMonthChange) {
        const sameMonth = normalized.getMonth() === currentMonth.getMonth() &&
          normalized.getFullYear() === currentMonth.getFullYear();
        if (!sameMonth) {
          callbacks.onMonthChange(normalized);
        }
      }
      m.redraw();
    };

    const moveMonth = (date, delta) => {
      const day = date.getDate();
      const base = new Date(date);
      base.setDate(1);
      base.setMonth(base.getMonth() + delta);
      const daysInTargetMonth = new Date(base.getFullYear(), base.getMonth() + 1, 0).getDate();
      base.setDate(Math.min(day, daysInTargetMonth));
      return base;
    };

    const handleCellKeyDown = (event, cell) => {
      if (!cell.isCurrentMonth) return;
      const focused = state.focusedDate || startOfDay(cell.date);
      let nextDate = null;
      switch (event.key) {
        case 'ArrowLeft':
          event.preventDefault();
          nextDate = addDays(focused, -1);
          break;
        case 'ArrowRight':
          event.preventDefault();
          nextDate = addDays(focused, 1);
          break;
        case 'ArrowUp':
          event.preventDefault();
          nextDate = addDays(focused, -7);
          break;
        case 'ArrowDown':
          event.preventDefault();
          nextDate = addDays(focused, 7);
          break;
        case 'PageUp':
          event.preventDefault();
          nextDate = moveMonth(focused, -1);
          break;
        case 'PageDown':
          event.preventDefault();
          nextDate = moveMonth(focused, 1);
          break;
        case 'Enter':
        case ' ':
          event.preventDefault();
          handleCellClick(cell);
          return;
        default:
          return;
      }
      if (nextDate) {
        focusDate(nextDate);
      }
    };
    
    // Función para renderizar un mes individual
    const renderMonth = (monthDate, monthIndex) => {
      const year = monthDate.getFullYear();
      const month = monthDate.getMonth();
      const monthCells = generateMonthGrid(year, month);
      
      return m('div', {
        key: `month-${monthIndex}`,
        style: monthContainerStyles,
      }, [
        // Header del mes
        m('div', { style: monthHeaderStyles }, [
          m('h2', { style: monthTitleStyles }, 
            `${monthNames[month]} ${year}`
          ),
        ]),
        
        // Grid de días de la semana
        m('div', { style: gridStyles, role: 'grid', 'aria-label': labels.calendarLabel || 'Calendario' }, [
          // Headers de días
          ...dayNames.map((dayName, index) => 
            m('div', { key: `header-${monthIndex}-${index}`, style: dayHeaderStyles, role: 'columnheader' }, dayName)
          ),
          
          // Celdas del mes
          ...monthCells.map((cell, index) => {
            // Calcular posición en la fila para bordes redondeados
            const rowIndex = Math.floor(index / 7);
            const colIndex = index % 7;
            const isFirstInRow = colIndex === 0;
            const isLastInRow = colIndex === 6;
            
            // Recalcular estilos con la posición correcta
            const cellStyles = (() => {
              const { date, isCurrentMonth } = cell;
              const today = new Date();
              const isToday = isCurrentMonth && isSameDay(date, today);
              const isOutOfMonth = !isCurrentMonth;
              const isBooked = isDateBooked(date, bookedDates);
              const isBlocked = isDayBlocked(date, blockedDays);
              const isDisabled = isOutOfMonth || isBooked || isBlocked;
              
              // Determinar rango actual (seleccionado o hover)
              let rangeStart = null;
              let rangeEnd = null;
              
              if (state.isSelecting && state.selectionStart && state.hoveredDate) {
                rangeStart = state.selectionStart < state.hoveredDate ? state.selectionStart : state.hoveredDate;
                rangeEnd = state.selectionStart < state.hoveredDate ? state.hoveredDate : state.selectionStart;
              } else if (selectedRange.start && selectedRange.end) {
                rangeStart = selectedRange.start;
                rangeEnd = selectedRange.end;
              }
              
              // Determinar si es inicio/fin/medio del rango visual
              let isRangeStart = false;
              let isRangeEnd = false;
              let isRangeMiddle = false;
              
              if (rangeStart && rangeEnd) {
                const dateTime = date.getTime();
                const startTime = startOfDay(rangeStart).getTime();
                const endTime = startOfDay(rangeEnd).getTime();
                
                isRangeStart = dateTime === startTime;
                isRangeEnd = dateTime === endTime;
                isRangeMiddle = dateTime > startTime && dateTime < endTime;
              }
              
              // Ajustar bordes redondeados según posición en fila y rango
              let borderRadius = '0';
              if (isRangeStart && isRangeEnd) {
                borderRadius = Tokens.radius.selection;
              } else if (isRangeStart) {
                if (isFirstInRow) {
                  borderRadius = '8px 0 0 8px';
                } else {
                  borderRadius = Tokens.radius.selection;
                }
              } else if (isRangeEnd) {
                if (isLastInRow) {
                  borderRadius = '0 8px 8px 0';
                } else {
                  borderRadius = Tokens.radius.selection;
                }
              } else if (isRangeMiddle) {
                borderRadius = '0';
              }
              
              // Estilos base
              const baseStyles = {
                aspectRatio: '1',
                minHeight: '70px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: isDisabled ? 'not-allowed' : (state.isSelecting ? 'grab' : 'pointer'),
                transition: PremiumTokens.transitions.hover,
                position: 'relative',
                borderRadius: borderRadius,
                border: isToday ? `2px solid ${Tokens.colors.primary}` : 'none',
                padding: Tokens.layout.spacing.xs,
              };
              
              // Colores según estado
              if (isOutOfMonth) {
                return {
                  ...baseStyles,
                  backgroundColor: Tokens.colors.surfaceSecondary,
                  color: Tokens.colors.textTertiary,
                  opacity: 0.6,
                };
              }

              if (isBooked) {
                return {
                  ...baseStyles,
                  backgroundColor: Tokens.colors.cell.booked,
                  color: Tokens.colors.cell.bookedText,
                  textDecoration: 'line-through',
                };
              }

              if (isBlocked) {
                return {
                  ...baseStyles,
                  backgroundColor: Tokens.colors.cell.disabled,
                  color: Tokens.colors.textTertiary,
                  opacity: 0.6,
                };
              }
              
              if (isRangeStart || isRangeEnd) {
                return {
                  ...baseStyles,
                  backgroundColor: Tokens.colors.cell.selected,
                  color: Tokens.colors.cell.selectedText,
                  fontWeight: Tokens.typography.fontWeight.bold,
                  transform: 'scale(1.05)',
                };
              }
              
              if (isRangeMiddle) {
                return {
                  ...baseStyles,
                  backgroundColor: Tokens.colors.cell.inRange,
                  color: Tokens.colors.textPrimary,
                };
              }
              
              // Estado por defecto
              const isHovered = state.hoveredCell && isSameDay(cell.date, state.hoveredCell.date) && 
                               !isDisabled && !isRangeStart && !isRangeEnd && !isRangeMiddle;
              
              return {
                ...baseStyles,
                backgroundColor: isHovered 
                  ? Tokens.colors.cell.hover 
                  : (isCurrentMonth ? Tokens.colors.cell.default : Tokens.colors.surfaceSecondary),
                color: isCurrentMonth ? Tokens.colors.textPrimary : Tokens.colors.textTertiary,
              };
            })();
            
            const dayNumber = cell.date.getDate();
            
            const isInRange = isRangeStart || isRangeEnd || isRangeMiddle;
            const isFocused = state.focusedDate && isSameDay(cell.date, state.focusedDate);
            const ariaStatus = isOutOfMonth
              ? statusLabels.outOfMonth
              : (isBooked
                ? statusLabels.booked
                : (isBlocked
                  ? statusLabels.blocked
                  : (isRangeStart || isRangeEnd
                    ? statusLabels.selected
                    : (isRangeMiddle ? statusLabels.inRange : statusLabels.available))));
            const ariaLabel = `${formatLongDate(cell.date)}. ${ariaStatus}.`;

            return m('div', {
              key: `cell-${monthIndex}-${index}`,
              style: cellStyles,
              onclick: () => handleCellClick(cell),
              onmouseenter: () => handleCellHover(cell),
              onmouseleave: handleCellLeave,
              onfocus: () => {
                if (cell.isCurrentMonth) {
                  state.focusedDate = startOfDay(cell.date);
                }
              },
              onkeydown: (event) => handleCellKeyDown(event, cell),
              role: 'gridcell',
              tabindex: cell.isCurrentMonth ? (isFocused ? 0 : -1) : -1,
              'aria-selected': isInRange ? 'true' : 'false',
              'aria-disabled': (isOutOfMonth || isBooked || isBlocked) ? 'true' : 'false',
              'aria-label': ariaLabel,
            }, [
              m('span', {
                key: 'day',
                style: {
                  fontSize: Tokens.typography.fontSize.base,
                  fontWeight: cellStyles.fontWeight || Tokens.typography.fontWeight.normal,
                  lineHeight: 1.2,
                }
              }, dayNumber),
            ]);
          }),
        ]),
      ]);
    };
    
    // Construir array de children sin null
    const children = [
      // Renderizar cada mes
      ...monthsToShow.map((monthDate, index) => renderMonth(monthDate, index)),
    ];
    
    // Agregar tooltip si existe
    if (state.tooltipInfo) {
      const nightsLabel = state.tooltipInfo.nights === 1 ? nightsLabels.one : nightsLabels.many;
      const rangeLabel = (state.tooltipInfo.start && state.tooltipInfo.end)
        ? (isSameDay(state.tooltipInfo.start, state.tooltipInfo.end)
          ? formatShortDate(state.tooltipInfo.start)
          : `${formatShortDate(state.tooltipInfo.start)} - ${formatShortDate(state.tooltipInfo.end)}`)
        : '';
      children.push(m('div', {
        key: 'tooltip',
        style: {
          position: 'fixed',
          bottom: '100px',
          left: '50%',
          transform: 'translateX(-50%)',
          backgroundColor: Tokens.colors.textPrimary,
          color: Tokens.colors.textInverse,
          padding: `${Tokens.layout.spacing.sm} ${Tokens.layout.spacing.md}`,
          borderRadius: Tokens.layout.borderRadius.md,
          fontSize: Tokens.typography.fontSize.sm,
          fontWeight: Tokens.typography.fontWeight.medium,
          boxShadow: Tokens.shadows.card,
          zIndex: Tokens.layout.zIndex.tooltip,
          pointerEvents: 'none',
          whiteSpace: 'nowrap',
        }
      }, [
        rangeLabel,
        rangeLabel ? ' • ' : '',
        `${state.tooltipInfo.nights} ${nightsLabel}`,
      ]));
    }
    
    return m('div', { style: containerStyles }, children);
  },
};
