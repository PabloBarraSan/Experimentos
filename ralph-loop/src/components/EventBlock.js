/**
 * Componente EventBlock - Bloque de evento individual
 * Renderiza un evento posicionado en el calendario
 */

import { Tokens } from '../tokens.js';
import { 
  calculateEventTop, 
  calculateEventHeight 
} from '../core/eventUtils.js';
import { formatTime, startOfDay } from '../core/dates.js';

/**
 * Componente EventBlock
 * @param {Object} vnode - Props del componente
 * @param {Object} vnode.attrs.event - Objeto evento
 * @param {Date} vnode.attrs.day - Día del evento
 * @param {number} vnode.attrs.slotHeight - Altura de cada slot
 * @param {number} vnode.attrs.slotDuration - Duración de cada slot en minutos
 * @param {number} vnode.attrs.left - Posición left en píxeles (para eventos solapados)
 * @param {number} vnode.attrs.width - Ancho en píxeles (para eventos solapados)
 * @param {Function} vnode.attrs.onClick - Callback al hacer click
 *       @param {Function} vnode.attrs.onDragStart - Callback cuando comienza el drag
 * @param {Function} vnode.attrs.onDrag - Callback durante el drag
 * @param {Function} vnode.attrs.onDragEnd - Callback cuando termina el drag
 * @param {Function} vnode.attrs.onResizeStart - Callback cuando comienza el resize
 * @param {Function} vnode.attrs.onResize - Callback durante el resize
 * @param {Function} vnode.attrs.onResizeEnd - Callback cuando termina el resize
 * @param {number} vnode.attrs.snapInterval - Intervalo de snap en minutos
 */
export const EventBlock = {
  oninit: (vnode) => {
    const state = vnode.state;
    state.isDragging = false;
    state.isResizing = false;
    state.dragStartY = 0;
    state.dragStartX = 0;
    state.resizeHandle = null; // 'top' o 'bottom'
  },

  view: (vnode) => {
    const { 
      event, 
      day, 
      slotHeight, 
      slotDuration, 
      left = 0, 
      width = null, 
      onClick,
      onDragStart,
      onDrag,
      onDragEnd,
      onResizeStart,
      onResize,
      onResizeEnd,
      snapInterval = 15,
    } = vnode.attrs;
    const state = vnode.state;

    const eventStart = new Date(event.start);
    const eventEnd = new Date(event.end);
    const dayStart = startOfDay(day);

    // Calcular posición y tamaño
    const top = calculateEventTop(eventStart, dayStart, slotHeight, slotDuration);
    const height = calculateEventHeight(eventStart, eventEnd, slotHeight, slotDuration);

    // Obtener color del recurso si existe
    const resource = event.resource || {};
    const eventColor = resource.color || Tokens.colors.primary;
    const eventBorderColor = resource.borderColor || Tokens.colors.primaryHover;

    // Estilos del bloque de evento
    const eventStyles = {
      position: 'absolute',
      top: `${top}px`,
      left: left > 0 ? `${left}%` : '4px',
      width: width ? `calc(${width}% - 8px)` : 'calc(100% - 8px)',
      height: `${height}px`,
      backgroundColor: eventColor,
      borderLeft: `3px solid ${eventBorderColor}`,
      borderRadius: Tokens.layout.borderRadius.sm,
      padding: `${Tokens.layout.spacing.xs} ${Tokens.layout.spacing.sm}`,
      fontSize: Tokens.typography.fontSize.xs,
      color: Tokens.colors.textInverse,
      cursor: 'pointer',
      overflow: 'hidden',
      zIndex: Tokens.layout.zIndex.event,
      boxShadow: Tokens.layout.shadow.sm,
      transition: `all ${Tokens.transitions.fast}`,
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'flex-start',
    };

    // Estilos para hover
    const eventHoverStyles = {
      ...eventStyles,
      boxShadow: Tokens.layout.shadow.md,
      transform: 'scale(1.02)',
    };

    // Formatear hora del evento
    const timeString = `${formatTime(eventStart)} - ${formatTime(eventEnd)}`;

    // Handlers de drag & drop
    const handleMouseDown = (e) => {
      // Solo iniciar drag con botón izquierdo
      if (e.button !== 0) return;
      
      e.preventDefault();
      e.stopPropagation();
      
      state.isDragging = true;
      state.dragStartY = e.clientY;
      state.dragStartX = e.clientX;
      
      // Agregar listeners globales
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.body.style.userSelect = 'none'; // Prevenir selección de texto
      
      if (onDragStart) {
        onDragStart(event, { x: e.clientX, y: e.clientY });
      }
    };

    const handleMouseMove = (e) => {
      if (!state.isDragging) return;
      
      const deltaY = e.clientY - state.dragStartY;
      const deltaX = e.clientX - state.dragStartX;
      
      if (onDrag) {
        onDrag(event, {
          deltaY,
          deltaX,
          clientY: e.clientY,
          clientX: e.clientX,
        });
      }
    };

    const handleMouseUp = (e) => {
      if (!state.isDragging && !state.isResizing) return;
      
      if (state.isDragging) {
        state.isDragging = false;
        
        // Remover listeners globales
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
        document.body.style.userSelect = '';
        
        if (onDragEnd) {
          const deltaY = e.clientY - state.dragStartY;
          onDragEnd(event, {
            deltaY,
            clientY: e.clientY,
            clientX: e.clientX,
          });
        }
      }
      
      if (state.isResizing) {
        state.isResizing = false;
        state.resizeHandle = null;
        
        // Remover listeners globales
        document.removeEventListener('mousemove', handleResizeMove);
        document.removeEventListener('mouseup', handleResizeUp);
        document.body.style.userSelect = '';
        
        if (onResizeEnd) {
          const deltaY = e.clientY - state.dragStartY;
          onResizeEnd(event, {
            deltaY,
            resizeHandle: state.resizeHandle,
            clientY: e.clientY,
            clientX: e.clientX,
          });
        }
      }
    };

    // Handlers de resize
    const handleResizeStart = (e, handle) => {
      e.preventDefault();
      e.stopPropagation();
      
      state.isResizing = true;
      state.resizeHandle = handle;
      state.dragStartY = e.clientY;
      
      // Agregar listeners globales
      document.addEventListener('mousemove', handleResizeMove);
      document.addEventListener('mouseup', handleResizeUp);
      document.body.style.userSelect = 'none';
      document.body.style.cursor = 'ns-resize';
      
      if (onResizeStart) {
        onResizeStart(event, handle, { x: e.clientX, y: e.clientY });
      }
    };

    const handleResizeMove = (e) => {
      if (!state.isResizing) return;
      
      const deltaY = e.clientY - state.dragStartY;
      
      if (onResize) {
        onResize(event, {
          deltaY,
          resizeHandle: state.resizeHandle,
          clientY: e.clientY,
          clientX: e.clientX,
        });
      }
    };

    const handleResizeUp = handleMouseUp;

    // Estilos cuando está siendo arrastrado
    const draggingStyles = {
      ...eventStyles,
      opacity: 0.5,
      cursor: 'grabbing',
      zIndex: Tokens.layout.zIndex.eventDragging,
    };

    // Estilos cuando está siendo redimensionado
    const resizingStyles = {
      ...eventStyles,
      opacity: 0.7,
      zIndex: Tokens.layout.zIndex.eventDragging,
    };

    // Estilos de los tiradores de resize
    const resizeHandleStyles = {
      position: 'absolute',
      left: 0,
      right: 0,
      height: '8px',
      cursor: 'ns-resize',
      zIndex: Tokens.layout.zIndex.event + 1,
      backgroundColor: 'transparent',
    };

    const resizeHandleTopStyles = {
      ...resizeHandleStyles,
      top: '-4px',
    };

    const resizeHandleBottomStyles = {
      ...resizeHandleStyles,
      bottom: '-4px',
    };

    return m('div', {
      style: state.isDragging ? draggingStyles : (state.isResizing ? resizingStyles : eventStyles),
      onmousedown: handleMouseDown,
      onmouseenter: (e) => {
        if (!state.isDragging) {
          Object.assign(e.target.style, eventHoverStyles);
        }
      },
      onmouseleave: (e) => {
        if (!state.isDragging) {
          Object.assign(e.target.style, eventStyles);
        }
      },
      onclick: (e) => {
        // Solo ejecutar onClick si no hubo drag significativo
        if (!state.isDragging && onClick) {
          onClick(event);
        }
      },
      title: `${event.title || 'Evento'} - ${timeString}`,
    }, [
      // Título del evento
      m('div', {
        style: {
          fontWeight: Tokens.typography.fontWeight.semibold,
          fontSize: Tokens.typography.fontSize.xs,
          lineHeight: Tokens.typography.lineHeight.tight,
          marginBottom: Tokens.layout.spacing.xs,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }
      }, event.title || 'Sin título'),
      
      // Hora del evento
      m('div', {
        style: {
          fontSize: Tokens.typography.fontSize.xs,
          opacity: 0.9,
          lineHeight: Tokens.typography.lineHeight.tight,
        }
      }, timeString),
      
      // Tiradores de resize (solo si el evento es lo suficientemente grande)
      height > slotHeight * 0.75 ? [
        // Tirador superior
        m('div', {
          style: resizeHandleTopStyles,
          onmousedown: (e) => handleResizeStart(e, 'top'),
          title: 'Redimensionar desde arriba',
        }),
        // Tirador inferior
        m('div', {
          style: resizeHandleBottomStyles,
          onmousedown: (e) => handleResizeStart(e, 'bottom'),
          title: 'Redimensionar desde abajo',
        }),
      ] : null,
      
      // Información adicional si hay espacio
      height > slotHeight * 1.5 && event.description ? m('div', {
        style: {
          fontSize: Tokens.typography.fontSize.xs,
          opacity: 0.8,
          marginTop: Tokens.layout.spacing.xs,
          lineHeight: Tokens.typography.lineHeight.normal,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          display: '-webkit-box',
          WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical',
        }
      }, event.description) : null,
    ]);
  },
};
