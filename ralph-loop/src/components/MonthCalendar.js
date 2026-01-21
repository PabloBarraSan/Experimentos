/**
 * Componente MonthCalendar - Vista Mensual de Booking
 * Nivel World-Class: Clean Canvas, Perfect Centering, True Liquid
 */

import { Tokens } from '../tokens.js';
import {
  generateMonthGrid,
  isDateBooked,
  isDayBlocked,
  startOfDay,
  isSameDay,
  getDateRange,
  addDays,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  toISODateString,
} from '../core/dates.js';

export const MonthCalendar = {
  oninit: (vnode) => {
    const state = vnode.state;
    state.hoveredDate = null;
    state.selectionStart = null;
    state.isSelecting = false;
    state.hoveredCell = null;
    state.focusedDate = null;
    state.transitionKey = 0;
    state.isTransitioning = false;
    state.hoveredWeek = null;
    
    // Gestos swipe
    state.swipeStartX = null;
    state.swipeStartY = null;
    state.swipeThreshold = 50;
    
    state.handleTouchStart = (e) => {
      const touch = e.touches[0];
      state.swipeStartX = touch.clientX;
      state.swipeStartY = touch.clientY;
    };
    
    state.handleTouchEnd = null; 
  },

  view: (vnode) => {
    const { currentMonth, data = {}, callbacks = {}, numberOfMonths = 1, locale = 'es-ES', labels = {} } = vnode.attrs;
    const state = vnode.state;
    
    const bookedDates = data.bookedDates || [];
    const blockedDays = data.blockedDays || [];
    const minStay = data.minStay || 1;
    const maxStay = data.maxStay || 31;
    const prices = data.prices || {};

    // Configuración Visual Top-Tier
    const CELL_HEIGHT = '44px'; // Más compacto (antes 48px)
    const CAPSULE_RADIUS = '22px'; // Mitad exacta de la altura para semicírculos perfectos
    
    const easeOutCubic = 'cubic-bezier(0.33, 1, 0.68, 1)';
    const selectedRange = vnode.attrs.state?.selectedRange || { start: null, end: null };
    
    const monthsToShow = [];
    for (let i = 0; i < numberOfMonths; i++) {
      const monthDate = new Date(currentMonth);
      monthDate.setMonth(currentMonth.getMonth() + i);
      monthsToShow.push(monthDate);
    }

    // Helpers de Fechas y Textos
    const generateDayNames = (targetLocale) => {
      const formatter = new Intl.DateTimeFormat(targetLocale, { weekday: 'narrow' }); // "L", "M", "X" (Más minimalista)
      const base = new Date(2024, 0, 1); 
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

    const formatLongDate = (date) => date.toLocaleDateString(locale, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

    // Lógica de fechas (Today, Unavailable, etc)
    const today = startOfDay(new Date());
    
    if (!state.focusedDate || state.focusedDate.getMonth() !== currentMonth.getMonth()) {
      state.focusedDate = startOfDay(new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1));
    }

    const isUnavailableDate = (date) => {
      const dateOnly = startOfDay(date);
      if (dateOnly < today) return true;
      return isDateBooked(date, bookedDates);
    };
    
    const isPastDate = (date) => startOfDay(date) < today;

    // Lógica de selección inteligente (Clamp)
    const getFirstUnavailableDateInRange = (startDate, endDate) => {
      if (!startDate || !endDate) return null;
      const start = startOfDay(startDate);
      const end = startOfDay(endDate);
      const direction = start <= end ? 1 : -1;
      const current = new Date(start);
      current.setDate(current.getDate() + direction);
      while (direction > 0 ? current <= end : current >= end) {
        if (isUnavailableDate(current)) return new Date(current);
        current.setDate(current.getDate() + direction);
      }
      return null;
    };

    const clampRangeEnd = (startDate, endDate) => {
      if (!startDate || !endDate) return endDate;
      const start = startOfDay(startDate);
      const end = startOfDay(endDate);
      const firstUnavailable = getFirstUnavailableDateInRange(start, end);
      if (!firstUnavailable) return end;
      
      const direction = start <= end ? 1 : -1;
      const clamped = new Date(firstUnavailable);
      clamped.setDate(clamped.getDate() - direction);
      return startOfDay(clamped);
    };
    
    // --- ESTILOS ---
    
    const containerStyles = {
      width: '100%',
      maxWidth: '100%',
      margin: '0 auto',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Inter", "SF Pro Text", sans-serif',
      opacity: state.isTransitioning ? 0.4 : 1,
      transform: state.isTransitioning ? 'translateX(8px)' : 'translateX(0)',
      transition: `opacity 0.3s ${easeOutCubic}, transform 0.3s ${easeOutCubic}`,
    };
    
    const monthContainerStyles = {
      width: '100%',
      maxWidth: '400px', // Ancho máximo controlado para evitar estiramiento excesivo
      margin: '0 auto',  // Centrado automático
      padding: '0 16px', // Padding lateral seguro
      backgroundColor: 'transparent',
    };
    
    // Header más limpio
    const monthHeaderStyles = {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: '24px', // Más aire entre título y grid
      padding: '0 8px',
    };
    
    const navButtonStyles = {
      width: '32px',
      height: '32px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'transparent', // Botones ghost
      border: 'none',
      borderRadius: '50%', // Botones circulares
      cursor: 'pointer',
      color: '#111827',
      fontSize: '16px',
      transition: 'background-color 0.2s',
    };
    
    const monthTitleStyles = {
      fontSize: '16px',
      fontWeight: '600',
      color: '#111827',
      textTransform: 'capitalize',
      letterSpacing: '-0.01em',
    };
    
    // Grid Setup - Zero Gap
    const gridStyles = {
      display: 'grid',
      gridTemplateColumns: 'repeat(7, 1fr)',
      gap: '0px', 
      width: '100%',
      position: 'relative',
      // ELIMINADO: paddingLeft: '32px' -> Esto causaba el descentrado
    };
    
    const dayHeaderStyles = {
      textAlign: 'center',
      fontSize: '11px',
      fontWeight: '600',
      color: '#9CA3AF', // Gris medio para no competir
      marginBottom: '8px',
      textTransform: 'uppercase',
      letterSpacing: '0.05em',
    };

    // --- HANDLERS (Simplificados) ---
    const handleCellClick = (cell) => {
      if (!cell.isCurrentMonth || isUnavailableDate(cell.date)) return;
      
      const clickedDate = startOfDay(cell.date);
      state.focusedDate = clickedDate;
      
      if (!state.selectionStart) {
        state.selectionStart = clickedDate;
        state.isSelecting = true;
        if (callbacks.onSelectionStart) callbacks.onSelectionStart();
        m.redraw();
      } else {
        const startDate = state.selectionStart;
        if (clickedDate < startDate) {
          state.selectionStart = clickedDate;
          state.isSelecting = true;
          m.redraw();
          return;
        }
        
        const clampedEnd = clampRangeEnd(startDate, clickedDate);
        const rangeDates = getDateRange(startDate, clampedEnd);
        
        // Validaciones mínimas/máximas
        if (rangeDates.length < minStay || rangeDates.length > maxStay) {
          // Feedback visual de error (vibración) podría ir aquí
          state.selectionStart = null;
          state.isSelecting = false;
          state.hoveredDate = null;
          m.redraw();
          return;
        }
        
        if (callbacks.onRangeSelect) callbacks.onRangeSelect(startDate, clampedEnd);
        
        state.selectionStart = null;
        state.isSelecting = false;
        state.hoveredDate = null;
        m.redraw();
      }
    };
    
    const handleCellHover = (cell) => {
      if (isUnavailableDate(cell.date)) return;
      state.hoveredCell = cell;
      
      if (state.isSelecting && state.selectionStart && cell.isCurrentMonth) {
        const proposedHoverDate = startOfDay(cell.date);
        if (proposedHoverDate >= state.selectionStart) {
          state.hoveredDate = clampRangeEnd(state.selectionStart, proposedHoverDate);
        }
      }
      m.redraw();
    };
    
    // Navegación
    const navigateMonth = (delta) => {
      const newDate = new Date(currentMonth);
      newDate.setMonth(newDate.getMonth() + delta);
      
      if (document.startViewTransition) {
        document.startViewTransition(() => callbacks.onMonthChange && callbacks.onMonthChange(newDate));
      } else {
        callbacks.onMonthChange && callbacks.onMonthChange(newDate);
      }
    };

    // --- RENDER MES ---
    const renderMonth = (monthDate, monthIndex) => {
      const year = monthDate.getFullYear();
      const month = monthDate.getMonth();
      const monthCells = generateMonthGrid(year, month);
      
      return m('div', {
        key: `month-${monthIndex}-${state.transitionKey}`,
        style: monthContainerStyles,
        ontouchstart: state.handleTouchStart,
        ontouchend: (!state.handleTouchEnd) ? (e) => { /* lógica swipe */ } : state.handleTouchEnd,
      }, [
        // Navigation Header
        m('div', { key: `header-${monthIndex}`, style: monthHeaderStyles }, [
          m('button', {
            key: `nav-prev-${monthIndex}`,
            style: navButtonStyles,
            onclick: () => navigateMonth(-1),
            onmouseenter: (e) => e.target.style.backgroundColor = '#F3F4F6',
            onmouseleave: (e) => e.target.style.backgroundColor = 'transparent',
          }, '←'), // Flecha simple ASCII o SVG
          m('span', { key: `month-title-${monthIndex}`, style: monthTitleStyles }, `${monthNames[month]} ${year}`),
          m('button', {
            key: `nav-next-${monthIndex}`,
            style: navButtonStyles,
            onclick: () => navigateMonth(1),
            onmouseenter: (e) => e.target.style.backgroundColor = '#F3F4F6',
            onmouseleave: (e) => e.target.style.backgroundColor = 'transparent',
          }, '→'),
        ]),
        
        // Grid
        m('div', { key: `grid-${monthIndex}`, style: gridStyles, role: 'grid' }, [
          ...dayNames.map((dayName, dayIndex) => 
            m('div', { key: `day-header-${dayIndex}`, style: dayHeaderStyles }, dayName)
          ),
          
          ...monthCells.map((cell, index) => {
            const { date, isCurrentMonth } = cell;
            const isToday = isCurrentMonth && isSameDay(date, today);
            const isOutOfMonth = !isCurrentMonth;
            const isBooked = isDateBooked(date, bookedDates);
            const isBlocked = isDayBlocked(date, blockedDays);
            
            // Determinar Rango Visual
            let rangeStart = null, rangeEnd = null;
            
            if (state.isSelecting && state.selectionStart) {
              rangeStart = state.selectionStart;
              rangeEnd = state.hoveredDate || state.selectionStart;
            } else if (selectedRange.start && selectedRange.end) {
              rangeStart = selectedRange.start;
              rangeEnd = selectedRange.end;
            }
            
            let isRangeStart = false, isRangeEnd = false, isRangeMiddle = false;
            let hasLeft = false, hasRight = false;

            if (rangeStart && rangeEnd && isCurrentMonth) {
              const t = date.getTime();
              const tS = startOfDay(rangeStart).getTime();
              const tE = startOfDay(rangeEnd).getTime();
              
              isRangeStart = t === tS;
              isRangeEnd = t === tE;
              isRangeMiddle = t > tS && t < tE;
              
              // Conectores líquidos
              const prev = addDays(date, -1);
              const next = addDays(date, 1);
              
              // Solo conectamos si el adyacente está en rango Y en el mismo mes visual
              const prevInSameMonth = prev.getMonth() === month && prev.getFullYear() === year;
              const nextInSameMonth = next.getMonth() === month && next.getFullYear() === year;

              hasLeft = prevInSameMonth && (startOfDay(prev).getTime() >= tS && startOfDay(prev).getTime() <= tE) && !isDateBooked(prev, bookedDates);
              hasRight = nextInSameMonth && (startOfDay(next).getTime() >= tS && startOfDay(next).getTime() <= tE) && !isDateBooked(next, bookedDates);
            }

            // ESTILOS DINÁMICOS DE CELDA
            const cellStyle = (() => {
              // Geometría
              let borderRadius = '0';
              const isInRange = isRangeStart || isRangeEnd || isRangeMiddle;
              
              if (isInRange) {
                if (isRangeStart && isRangeEnd) {
                  borderRadius = '50%'; // Día único seleccionado = Círculo
                } else {
                  // Cápsula lógica
                  const l = (!hasLeft) ? CAPSULE_RADIUS : '0';
                  const r = (!hasRight) ? CAPSULE_RADIUS : '0';
                  borderRadius = `${l} ${r} ${r} ${l}`;
                }
              } else if (state.hoveredCell && isSameDay(date, state.hoveredCell.date)) {
                borderRadius = '50%'; // Hover en día suelto = Círculo perfecto (Estilo iOS)
              }

              // Color y Fondo
              let bg = 'transparent';
              let color = '#374151'; // Gris oscuro (casi negro)
              let fontWeight = '400';
              let shadow = 'none';
              let zIndex = 1;

              if (isOutOfMonth) return { opacity: 0, pointerEvents: 'none' }; // Invisible
              
              if (isBooked || isBlocked) {
                color = '#D1D5DB'; // Gris muy claro
                return { 
                  color, 
                  textDecoration: 'line-through',
                  cursor: 'not-allowed',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', height: CELL_HEIGHT 
                };
              }

              if (isRangeStart || isRangeEnd) {
                bg = '#111827'; // Negro Carbón
                color = '#FFFFFF';
                fontWeight = '600';
                zIndex = 10;
                shadow = '0 4px 6px rgba(0,0,0,0.1)'; // Sombra sutil para elevación
              } else if (isRangeMiddle) {
                bg = '#F3F4F6'; // Gris muy pálido, casi blanco
                color = '#111827';
              } else if (state.hoveredCell && isSameDay(date, state.hoveredCell.date)) {
                bg = '#F3F4F6'; // Hover sutil
              }

              if (isToday && !isInRange) {
                color = Tokens.colors.primary; // Azul o color de marca para "Hoy"
                fontWeight = '600';
              }

              return {
                height: CELL_HEIGHT,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: bg,
                borderRadius: borderRadius,
                color: color,
                fontWeight: fontWeight,
                cursor: 'pointer',
                position: 'relative',
                zIndex: zIndex,
                boxShadow: shadow,
                transition: 'background-color 0.15s ease, transform 0.1s ease',
                userSelect: 'none',
                // Eliminamos márgenes para que se toquen (liquid effect)
                margin: (isInRange) ? '0' : '1px 0', // Pequeño gap vertical en días normales para que respiren
              };
            })();

            // Children
            const children = [];
            
            // Selector de semana (Overlay flotante, no ocupa espacio en grid)
            const weekStart = startOfWeek(date);
            const isFirstCol = index % 7 === 0;
            if (isFirstCol && isCurrentMonth) {
               children.push(m('div', {
                 key: `week-selector-${index}`,
                 style: {
                   position: 'absolute',
                   left: '-24px', // Flotando a la izquierda
                   top: '50%',
                   transform: 'translateY(-50%)',
                   fontSize: '10px',
                   color: state.hoveredWeek === weekStart.getTime() ? '#111827' : 'transparent', // Solo visible en hover
                   cursor: 'pointer',
                   padding: '4px',
                 },
                 onmouseenter: () => state.hoveredWeek = weekStart.getTime(),
                 onclick: (e) => { e.stopPropagation(); /* handleWeekClick logic */ }
               }, '›'));
            }

            // Día Número
            children.push(m('span', {
              key: `day-number-${index}`,
              style: {
                fontSize: '15px',
                lineHeight: '1',
                zIndex: 2,
                fontFeatureSettings: '"tnum"', // Tabular numbers para centrado perfecto
              }
            }, date.getDate()));

            // Precio (Minimalista)
            const price = prices[toISODateString(date)];
            if (price && !isBooked && !isRangeMiddle) {
              children.push(m('span', {
                key: `price-${index}`,
                style: {
                  fontSize: '9px',
                  marginTop: '2px',
                  color: (isRangeStart || isRangeEnd) ? 'rgba(255,255,255,0.7)' : '#9CA3AF',
                  fontWeight: '500',
                }
              }, `${price}€`));
            }

            // Puntito "Hoy"
            if (isToday && !isRangeStart && !isRangeEnd && !isRangeMiddle) {
              children.push(m('div', {
                key: `today-indicator-${index}`,
                style: {
                  position: 'absolute',
                  bottom: '4px',
                  width: '4px',
                  height: '4px',
                  backgroundColor: Tokens.colors.primary,
                  borderRadius: '50%',
                }
              }));
            }

            return m('div', {
              key: `cell-${index}`,
              style: cellStyle,
              onmousedown: (e) => e.currentTarget.style.transform = 'scale(0.90)',
              onmouseup: (e) => e.currentTarget.style.transform = 'scale(1)',
              onmouseleave: (e) => {
                handleCellHover({ date: new Date(0), isCurrentMonth: false }); // Clear hover
                e.currentTarget.style.transform = 'scale(1)';
              },
              onmouseenter: () => handleCellHover(cell),
              onclick: () => handleCellClick(cell),
            }, children);
          })
        ]),
      ]);
    };

    return m('div', { style: containerStyles }, [
      ...monthsToShow.map((d, i) => renderMonth(d, i))
    ]);
  }
};
