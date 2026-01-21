/**
 * Componente EventGhost - Elemento fantasma durante el drag
 * Visualización semitransparente del evento mientras se arrastra
 */

import { Tokens } from '../tokens.js';
import { formatTime } from '../core/dates.js';

/**
 * Componente EventGhost
 * @param {Object} vnode - Props del componente
 * @param {Object} vnode.attrs.event - Objeto evento
 * @param {number} vnode.attrs.top - Posición top en píxeles
 * @param {number} vnode.attrs.height - Altura en píxeles
 * @param {number} vnode.attrs.left - Posición left en porcentaje
 * @param {number} vnode.attrs.width - Ancho en porcentaje
 */
export const EventGhost = {
  view: (vnode) => {
    const { event, top, height, left = 0, width = 100 } = vnode.attrs;

    const eventStart = new Date(event.start);
    const eventEnd = new Date(event.end);
    const timeString = `${formatTime(eventStart)} - ${formatTime(eventEnd)}`;

    // Estilos del ghost element
    const ghostStyles = {
      position: 'absolute',
      top: `${top}px`,
      left: `${left}%`,
      width: `calc(${width}% - 8px)`,
      height: `${height}px`,
      backgroundColor: Tokens.colors.dragGhost,
      border: `2px dashed ${Tokens.colors.primary}`,
      borderRadius: Tokens.layout.borderRadius.sm,
      padding: `${Tokens.layout.spacing.xs} ${Tokens.layout.spacing.sm}`,
      fontSize: Tokens.typography.fontSize.xs,
      color: Tokens.colors.textPrimary,
      pointerEvents: 'none',
      zIndex: Tokens.layout.zIndex.eventDragging,
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'flex-start',
      opacity: 0.7,
    };

    return m('div', { style: ghostStyles }, [
      m('div', {
        style: {
          fontWeight: Tokens.typography.fontWeight.semibold,
          fontSize: Tokens.typography.fontSize.xs,
          lineHeight: Tokens.typography.lineHeight.tight,
          marginBottom: Tokens.layout.spacing.xs,
        }
      }, event.title || 'Sin título'),
      m('div', {
        style: {
          fontSize: Tokens.typography.fontSize.xs,
          opacity: 0.8,
        }
      }, timeString),
    ]);
  },
};
