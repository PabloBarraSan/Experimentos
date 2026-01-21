/**
 * Componente CalendarGrid - Grid del calendario
 * Genera dinámicamente el grid CSS mediante JavaScript
 */

import { Tokens } from '../tokens.js';
import { 
  startOfWeek, 
  startOfDay,
  getDateRange, 
  getTimeSlots, 
  formatTime,
  isSameDay 
} from '../core/dates.js';
import {
  filterVisibleEvents,
  groupOverlappingEvents,
  calculateEventPosition,
  getEventVisibleDays,
  calculateEventTop,
} from '../core/eventUtils.js';
import {
  getVisibleTimeSlots,
  getVisibleEvents,
  calculateTotalHeight,
  calculateRenderOffset,
} from '../core/virtualizationUtils.js';
import {
  calculateDateFromMousePosition,
  calculateDragOffset,
  calculateNewEventStart,
  isWithinCalendarBounds,
  calculateGhostPosition,
  calculateNewEventDuration,
} from '../core/dragDropUtils.js';
import { diffInMinutes, addMinutes } from '../core/dates.js';
import { EventBlock } from './EventBlock.js';
import { EventGhost } from './EventGhost.js';

/**
 * Componente CalendarGrid
 * @param {Object} vnode - Props del componente
 * @param {Date} vnode.attrs.currentDate - Fecha actual
 * @param {string} vnode.attrs.viewMode - Modo de vista ('week' | 'month' | 'day')
 * @param {Array} vnode.attrs.events - Array de eventos
 * @param {Array} vnode.attrs.resources - Array de recursos
 * @param {Object} vnode.attrs.config - Configuración (slotDuration, startHour, endHour)
 */
export const CalendarGrid = {
  oninit: (vnode) => {
    const state = vnode.state;
    state.scrollTop = 0;
    state.scrollLeft = 0;
    state.gridRef = null;
    state.viewportHeight = 600; // Valor por defecto, se actualizará
    state.scrollUpdatePending = false;
    state.lastScrollTop = 0;
    
    // Estado de drag & drop
    state.draggingEvent = null;
    state.dragStartPosition = null;
    state.ghostPosition = null;
    
    // Estado de resize
    state.resizingEvent = null;
    state.resizeHandle = null;
    state.resizeStartPosition = null;
    
    // Estado de selección (click to create)
    state.isSelecting = false;
    state.selectionStart = null;
    state.selectionEnd = null;
  },

  oncreate: (vnode) => {
    // Guardar referencia al elemento del grid para sincronización de scroll
    const state = vnode.state;
    state.gridRef = vnode.dom;
    
    // Actualizar altura del viewport
    const updateViewport = () => {
      if (vnode.dom) {
        state.viewportHeight = vnode.dom.clientHeight;
      }
    };
    
    updateViewport();
    
    // Observer para cambios de tamaño
    if (window.ResizeObserver) {
      state.resizeObserver = new ResizeObserver(updateViewport);
      state.resizeObserver.observe(vnode.dom);
    }
  },

  onremove: (vnode) => {
    // Limpiar observer
    const state = vnode.state;
    if (state.resizeObserver) {
      state.resizeObserver.disconnect();
    }
  },

  view: (vnode) => {
    const { currentDate, viewMode, events, resources, config } = vnode.attrs;
    const state = vnode.state;

    // Calcular días visibles según el modo de vista
    let visibleDays = [];
    if (viewMode === 'day') {
      visibleDays = [new Date(currentDate)];
    } else if (viewMode === 'week') {
      const weekStart = startOfWeek(currentDate);
      visibleDays = getDateRange(weekStart, new Date(weekStart.getTime() + 6 * 24 * 60 * 60 * 1000));
    } else if (viewMode === 'month') {
      // Por ahora, mostrar solo la primera semana del mes
      const weekStart = startOfWeek(currentDate);
      visibleDays = getDateRange(weekStart, new Date(weekStart.getTime() + 6 * 24 * 60 * 60 * 1000));
    }

    // Generar slots de tiempo
    const timeSlots = getTimeSlots(
      config.startHour || 8,
      config.endHour || 20,
      config.slotDuration || 30,
      currentDate
    );

    // Calcular número de columnas: 1 columna de tiempo + N días
    const numColumns = visibleDays.length + 1;

    // Generar template de columnas para CSS Grid
    const gridTemplateColumns = [
      Tokens.layout.timeColumnWidth, // Columna de tiempo
      ...Array(visibleDays.length).fill('1fr') // Columnas de días
    ].join(' ');

    // Estilos del contenedor principal del grid
    const gridContainerStyles = {
      display: 'grid',
      gridTemplateColumns: gridTemplateColumns,
      width: '100%',
      height: '100%',
      overflow: 'auto',
      backgroundColor: Tokens.colors.surface,
    };

    // Estilos de las celdas del header
    const headerCellStyles = {
      backgroundColor: Tokens.colors.surfaceElevated,
      borderBottom: `2px solid ${Tokens.colors.border}`,
      borderRight: `1px solid ${Tokens.colors.border}`,
      padding: Tokens.layout.spacing.md,
      textAlign: 'center',
      fontSize: Tokens.typography.fontSize.sm,
      fontWeight: Tokens.typography.fontWeight.medium,
      color: Tokens.colors.textPrimary,
      position: 'sticky',
      top: 0,
      zIndex: Tokens.layout.zIndex.header,
      boxShadow: `0 2px 4px ${Tokens.colors.borderLight}`,
    };

    // Estilos de la columna de tiempo del header (primera columna)
    const timeColumnHeaderStyles = {
      ...headerCellStyles,
      backgroundColor: Tokens.colors.surfaceElevated,
      position: 'sticky',
      left: 0,
      zIndex: Tokens.layout.zIndex.header + 1,
    };

    // Estilos de las celdas de día del header
    const dayCellStyles = {
      ...headerCellStyles,
    };

    // Estilos de la celda de tiempo (primera columna de cada fila)
    const timeCellStyles = {
      borderRight: `1px solid ${Tokens.colors.border}`,
      borderBottom: `1px solid ${Tokens.colors.gridLines}`,
      padding: `${Tokens.layout.spacing.xs} ${Tokens.layout.spacing.sm}`,
      fontSize: Tokens.typography.fontSize.xs,
      color: Tokens.colors.textSecondary,
      fontFamily: Tokens.typography.fontFamily.mono,
      textAlign: 'right',
      backgroundColor: Tokens.colors.surfaceSecondary,
      position: 'sticky',
      left: 0,
      zIndex: Tokens.layout.zIndex.base,
      backgroundColor: Tokens.colors.surfaceSecondary,
    };

    // Estilos de las celdas de slot (cada celda del grid)
    const slotCellStyles = {
      borderRight: `1px solid ${Tokens.colors.gridLines}`,
      borderBottom: `1px solid ${Tokens.colors.gridLines}`,
      minHeight: Tokens.layout.slotHeight,
      position: 'relative',
      backgroundColor: Tokens.colors.surface,
    };

    // Formatear nombres de días
    const dayNames = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
    const monthNames = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

    // Calcular altura total del grid (para contenedores de eventos)
    const slotHeight = parseInt(Tokens.layout.slotHeight) || 60;
    const slotDuration = config.slotDuration || 30;
    const totalSlots = timeSlots.length;
    const totalHeight = totalSlots * slotHeight;
    const headerHeight = parseInt(Tokens.layout.headerHeight) || 50;

    // Filtrar eventos visibles por rango de días
    const allVisibleEvents = filterVisibleEvents(events || [], visibleDays);
    
    // Virtualización: Para cada día, filtrar eventos visibles en el viewport
    // Esto se hace por día porque cada día tiene su propio contenedor de eventos
    const virtualizedEventsByDay = visibleDays.map(day => {
      const dayEvents = allVisibleEvents.filter(event => {
        const eventStart = new Date(event.start);
        const eventEnd = new Date(event.end);
        return isSameDay(eventStart, day) || 
               (eventStart <= day && eventEnd >= day);
      });
      
      // Virtualizar eventos de este día
      return getVisibleEvents(
        dayEvents,
        day,
        state.scrollTop,
        state.viewportHeight || 600,
        slotHeight,
        slotDuration,
        headerHeight,
        300 // Buffer de 300px
      );
    });

    // Handlers de drag & drop
    const handleDragStart = (event, position) => {
      const state = vnode.state;
      state.draggingEvent = event;
      state.dragStartPosition = position;
    };

    const handleDrag = (event, delta) => {
      const state = vnode.state;
      if (!state.draggingEvent || !state.dragStartPosition) return;

      // Calcular nueva posición basada en el mouse
      const gridRect = state.gridRef?.getBoundingClientRect();
      if (!gridRect) return;

      const relativeY = delta.clientY - gridRect.top + state.scrollTop;
      const dayStart = startOfDay(visibleDays[0] || currentDate);
      
      // Calcular nueva fecha con snap
      const snapInterval = config.snapInterval || 15;
      const newStart = calculateDateFromMousePosition(
        relativeY,
        dayStart,
        slotHeight,
        slotDuration,
        snapInterval,
        headerHeight
      );

      // Calcular posición del ghost
      const originalEnd = new Date(event.end);
      const ghostPos = calculateGhostPosition(
        newStart,
        originalEnd,
        dayStart,
        slotHeight,
        slotDuration
      );

      state.ghostPosition = {
        ...ghostPos,
        event: {
          ...event,
          start: newStart,
        },
      };

      m.redraw();
    };

    const handleDragEnd = (event, delta) => {
      const state = vnode.state;
      if (!state.draggingEvent || !state.dragStartPosition) return;

      // Calcular nueva fecha final
      const gridRect = state.gridRef?.getBoundingClientRect();
      if (!gridRect) {
        state.draggingEvent = null;
        state.dragStartPosition = null;
        state.ghostPosition = null;
        return;
      }

      const relativeY = delta.clientY - gridRect.top + state.scrollTop;
      const dayStart = startOfDay(visibleDays[0] || currentDate);
      const snapInterval = config.snapInterval || 15;
      
      const newStart = calculateDateFromMousePosition(
        relativeY,
        dayStart,
        slotHeight,
        slotDuration,
        snapInterval,
        headerHeight
      );

      // Verificar que esté dentro de los límites
      const startHour = config.startHour || 8;
      const endHour = config.endHour || 20;
      
      if (isWithinCalendarBounds(newStart, startHour, endHour)) {
        const originalEnd = new Date(event.end);
        const duration = diffInMinutes(new Date(event.start), originalEnd);
        const newEnd = addMinutes(newStart, duration);

        // Llamar callback si existe
        const callbacks = vnode.attrs.callbacks;
        if (callbacks && callbacks.onEventDrop) {
          callbacks.onEventDrop(event, newStart, newEnd);
        }
      }

      // Limpiar estado
      state.draggingEvent = null;
      state.dragStartPosition = null;
      state.ghostPosition = null;
      m.redraw();
    };

    // Handlers de resize
    const handleResizeStart = (event, handle, position) => {
      const state = vnode.state;
      state.resizingEvent = event;
      state.resizeHandle = handle;
      state.resizeStartPosition = position;
    };

    const handleResize = (event, delta) => {
      const state = vnode.state;
      if (!state.resizingEvent || !state.resizeStartPosition) return;

      // Calcular offset en minutos
      const slotHeight = parseInt(Tokens.layout.slotHeight) || 60;
      const slotDuration = config.slotDuration || 30;
      const snapInterval = config.snapInterval || 15;
      const pixelOffset = delta.deltaY;
      const slotOffset = pixelOffset / slotHeight;
      const minutesOffset = slotOffset * slotDuration;
      const snappedOffset = Math.round(minutesOffset / snapInterval) * snapInterval;

      // Calcular nueva duración
      const originalStart = new Date(event.start);
      const originalEnd = new Date(event.end);
      const newDuration = calculateNewEventDuration(
        originalStart,
        originalEnd,
        snappedOffset,
        snapInterval,
        state.resizeHandle
      );

      // Actualizar ghost position para mostrar preview
      const dayStart = startOfDay(visibleDays[0] || currentDate);
      const ghostPos = calculateGhostPosition(
        newDuration.start,
        newDuration.end,
        dayStart,
        slotHeight,
        slotDuration
      );

      state.ghostPosition = {
        ...ghostPos,
        event: {
          ...event,
          start: newDuration.start,
          end: newDuration.end,
        },
      };

      m.redraw();
    };

    const handleResizeEnd = (event, delta) => {
      const state = vnode.state;
      if (!state.resizingEvent || !state.resizeStartPosition) return;

      // Calcular nueva duración final
      const slotHeight = parseInt(Tokens.layout.slotHeight) || 60;
      const slotDuration = config.slotDuration || 30;
      const snapInterval = config.snapInterval || 15;
      const pixelOffset = delta.deltaY;
      const slotOffset = pixelOffset / slotHeight;
      const minutesOffset = slotOffset * slotDuration;
      const snappedOffset = Math.round(minutesOffset / snapInterval) * snapInterval;

      const originalStart = new Date(event.start);
      const originalEnd = new Date(event.end);
      const newDuration = calculateNewEventDuration(
        originalStart,
        originalEnd,
        snappedOffset,
        snapInterval,
        state.resizeHandle
      );

      // Verificar límites
      const startHour = config.startHour || 8;
      const endHour = config.endHour || 20;
      
      if (isWithinCalendarBounds(newDuration.start, startHour, endHour) &&
          isWithinCalendarBounds(newDuration.end, startHour, endHour)) {
        // Llamar callback si existe
        const callbacks = vnode.attrs.callbacks;
        if (callbacks && callbacks.onEventResize) {
          callbacks.onEventResize(event, newDuration.start, newDuration.end);
        }
      }

      // Limpiar estado
      state.resizingEvent = null;
      state.resizeHandle = null;
      state.resizeStartPosition = null;
      state.ghostPosition = null;
      m.redraw();
    };

    // Función para renderizar eventos de un día
    const renderDayEvents = (day, dayIndex) => {
      // Usar eventos virtualizados para este día
      const dayEvents = virtualizedEventsByDay[dayIndex] || [];

      if (dayEvents.length === 0) return null;

      // Agrupar eventos solapados
      const eventGroups = groupOverlappingEvents(dayEvents, day);

      // Renderizar eventos
      return eventGroups.map((group, groupIndex) => {
        return group.map((event, eventIndex) => {
          // Calcular posición left/width para eventos solapados (en porcentajes)
          const position = calculateEventPosition(group, eventIndex);

          // Encontrar el recurso del evento
          const resource = (resources || []).find(r => r.id === event.resourceId) || {};

          return m(EventBlock, {
            key: event.id || `${eventIndex}-${groupIndex}`,
            event: {
              ...event,
              resource: {
                ...resource,
                color: resource.color || Tokens.colors.eventMeeting,
                borderColor: resource.borderColor || Tokens.colors.eventMeetingBorder,
              }
            },
            day: day,
            slotHeight: slotHeight,
            slotDuration: slotDuration,
            left: position.left,
            width: position.width,
            snapInterval: config.snapInterval || 15,
            onDragStart: handleDragStart,
            onDrag: handleDrag,
            onDragEnd: handleDragEnd,
            onResizeStart: handleResizeStart,
            onResize: handleResize,
            onResizeEnd: handleResizeEnd,
            onClick: (e) => {
              const callbacks = vnode.attrs.callbacks;
              if (callbacks && callbacks.onEventClick) {
                callbacks.onEventClick(e);
              }
            }
          });
        });
      }).flat();
    };

    // Función optimizada para manejar scroll con throttling
    const handleScroll = (e) => {
      const newScrollTop = e.target.scrollTop;
      const newScrollLeft = e.target.scrollLeft;
      
      state.scrollTop = newScrollTop;
      state.scrollLeft = newScrollLeft;
      
      // Throttle: solo actualizar virtualización si hay cambio significativo
      if (Math.abs(state.lastScrollTop - newScrollTop) > 50) {
        state.lastScrollTop = newScrollTop;
        
        // Usar requestAnimationFrame para actualizar suavemente
        if (!state.scrollUpdatePending) {
          state.scrollUpdatePending = true;
          requestAnimationFrame(() => {
            state.scrollUpdatePending = false;
            m.redraw();
          });
        }
      }
    };

    return m('div', { 
      style: gridContainerStyles,
      onscroll: handleScroll
    }, [
      // Header: Celda vacía para la columna de tiempo
      m('div', { 
        style: timeColumnHeaderStyles,
      }, ''),
      // Headers de días (parte del mismo grid)
      ...visibleDays.map(day => {
          const dayName = dayNames[day.getDay()];
          const dayNumber = day.getDate();
          const monthName = monthNames[day.getMonth()];
          const isToday = isSameDay(day, new Date());
          
          return m('div', {
            style: {
              ...dayCellStyles,
              backgroundColor: isToday ? Tokens.colors.primaryLight : dayCellStyles.backgroundColor,
              color: isToday ? Tokens.colors.primary : dayCellStyles.color,
            }
          }, [
            m('div', {
              style: {
                fontSize: Tokens.typography.fontSize.xs,
                color: isToday ? Tokens.colors.primary : Tokens.colors.textSecondary,
                marginBottom: Tokens.layout.spacing.xs,
              }
            }, dayName),
            m('div', {
              style: {
                fontSize: Tokens.typography.fontSize.base,
                fontWeight: Tokens.typography.fontWeight.semibold,
              }
            }, dayNumber),
            m('div', {
              style: {
                fontSize: Tokens.typography.fontSize.xs,
                color: Tokens.colors.textTertiary,
                marginTop: Tokens.layout.spacing.xs,
              }
            }, monthName),
          ]);
        }),

      // Filas de tiempo (parte del mismo grid)
      ...timeSlots.map((timeSlot, index) => {
        const timeString = formatTime(timeSlot);
        const isHourMark = timeSlot.getMinutes() === 0;

        return [
          // Celda de tiempo
          m('div', {
            style: {
              ...timeCellStyles,
              borderBottom: isHourMark 
                ? `1px solid ${Tokens.colors.gridLinesStrong}` 
                : timeCellStyles.borderBottom,
            }
          }, isHourMark ? timeString : ''),
          
          // Celdas de slots para cada día
          ...visibleDays.map((day, dayIndex) => {
            const isFirstRow = index === 0;
            const dayEvents = isFirstRow ? renderDayEvents(day, dayIndex) : null;
            
            return m('div', {
              style: {
                ...slotCellStyles,
                borderBottom: isHourMark 
                  ? `1px solid ${Tokens.colors.gridLinesStrong}` 
                  : slotCellStyles.borderBottom,
              },
              onmousedown: (e) => {
                // Solo con botón izquierdo y si no hay drag/resize activo
                if (e.button !== 0 || state.draggingEvent || state.resizingEvent) return;
                
                e.preventDefault();
                e.stopPropagation();
                
                // Iniciar selección
                const gridRect = state.gridRef?.getBoundingClientRect();
                if (!gridRect) return;
                
                const relativeY = e.clientY - gridRect.top + state.scrollTop;
                const dayStart = startOfDay(day);
                const snapInterval = config.snapInterval || 15;
                
                const startDate = calculateDateFromMousePosition(
                  relativeY,
                  dayStart,
                  slotHeight,
                  slotDuration,
                  snapInterval,
                  headerHeight
                );
                
                state.isSelecting = true;
                state.selectionStart = { day, date: startDate, y: relativeY };
                state.selectionEnd = { day, date: startDate, y: relativeY };
                
                // Agregar listeners
                const handleSelectMove = (moveEvent) => {
                  if (!state.isSelecting) return;
                  
                  const newRelativeY = moveEvent.clientY - gridRect.top + state.scrollTop;
                  const endDate = calculateDateFromMousePosition(
                    newRelativeY,
                    dayStart,
                    slotHeight,
                    slotDuration,
                    snapInterval,
                    headerHeight
                  );
                  
                  // Asegurar que endDate sea después de startDate
                  if (endDate < state.selectionStart.date) {
                    state.selectionEnd = { day: state.selectionStart.day, date: state.selectionStart.date, y: state.selectionStart.y };
                    state.selectionStart = { day, date: endDate, y: newRelativeY };
                  } else {
                    state.selectionEnd = { day, date: endDate, y: newRelativeY };
                  }
                  
                  m.redraw();
                };
                
                const handleSelectEnd = (endEvent) => {
                  if (!state.isSelecting) return;
                  
                  state.isSelecting = false;
                  
                  // Remover listeners
                  document.removeEventListener('mousemove', handleSelectMove);
                  document.removeEventListener('mouseup', handleSelectEnd);
                  
                  // Calcular rango final
                  const finalStart = state.selectionStart.date < state.selectionEnd.date 
                    ? state.selectionStart.date 
                    : state.selectionEnd.date;
                  const finalEnd = state.selectionStart.date < state.selectionEnd.date 
                    ? state.selectionEnd.date 
                    : state.selectionStart.date;
                  
                  // Verificar que haya una duración mínima
                  const minDuration = snapInterval;
                  if (diffInMinutes(finalStart, finalEnd) >= minDuration) {
                    // Llamar callback
                    const callbacks = vnode.attrs.callbacks;
                    if (callbacks && callbacks.onSlotSelect) {
                      callbacks.onSlotSelect(finalStart, finalEnd, day);
                    }
                  }
                  
                  // Limpiar selección
                  state.selectionStart = null;
                  state.selectionEnd = null;
                  m.redraw();
                };
                
                document.addEventListener('mousemove', handleSelectMove);
                document.addEventListener('mouseup', handleSelectEnd);
              }
            }, isFirstRow && dayEvents && dayEvents.length > 0 ? [
              m('div', {
                style: {
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  height: `${totalHeight}px`,
                  pointerEvents: 'auto',
                  zIndex: Tokens.layout.zIndex.event,
                }
              }, dayEvents)
            ] : null);
          }),
        ];
      }).flat(),
      
      // Ghost element durante el drag (renderizado sobre el grid)
      state.ghostPosition ? m('div', {
        style: {
          position: 'absolute',
          top: `${headerHeight}px`,
          left: `${parseInt(Tokens.layout.timeColumnWidth)}px`,
          right: 0,
          height: `${totalHeight}px`,
          pointerEvents: 'none',
          zIndex: Tokens.layout.zIndex.eventDragging + 1,
        }
      }, [
        m(EventGhost, {
          event: state.ghostPosition.event,
          top: state.ghostPosition.top,
          height: state.ghostPosition.height,
          left: 4,
          width: 100,
        })
      ]) : null,
      
      // Selección visual (click to create)
      state.isSelecting && state.selectionStart && state.selectionEnd ? 
        visibleDays.map((day, dayIndex) => {
          // Solo mostrar selección en el día correspondiente
          if (state.selectionStart.day.getTime() !== day.getTime() && 
              state.selectionEnd.day.getTime() !== day.getTime()) {
            return null;
          }
          
          const dayStart = startOfDay(day);
          const selectionStart = state.selectionStart.day.getTime() === day.getTime() 
            ? state.selectionStart.date 
            : dayStart;
          const selectionEnd = state.selectionEnd.day.getTime() === day.getTime() 
            ? state.selectionEnd.date 
            : dayStart;
          
          // Calcular posición y tamaño
          const startTop = calculateEventTop(selectionStart, dayStart, slotHeight, slotDuration);
          const endTop = calculateEventTop(selectionEnd, dayStart, slotHeight, slotDuration);
          const selectionTop = Math.min(startTop, endTop);
          const selectionHeight = Math.abs(endTop - startTop);
          
          // Mínimo de altura para que sea visible
          const minHeight = slotHeight * 0.5;
          const finalHeight = Math.max(selectionHeight, minHeight);
          
          return m('div', {
            key: `selection-${dayIndex}`,
            style: {
              position: 'absolute',
              top: `${headerHeight + selectionTop}px`,
              left: `${parseInt(Tokens.layout.timeColumnWidth) + (dayIndex * (100 / (visibleDays.length + 1)))}%`,
              width: `${100 / (visibleDays.length + 1)}%`,
              height: `${finalHeight}px`,
              backgroundColor: Tokens.colors.dropZoneActive,
              border: `2px dashed ${Tokens.colors.primary}`,
              borderRadius: Tokens.layout.borderRadius.sm,
              pointerEvents: 'none',
              zIndex: Tokens.layout.zIndex.event,
              opacity: 0.6,
            }
          });
        }).filter(Boolean) : null,
    ]);
  },
};
