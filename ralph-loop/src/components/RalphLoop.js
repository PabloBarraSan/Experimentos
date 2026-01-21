/**
 * Componente Principal - Ralph Loop
 * Motor de reservas de alto rendimiento
 */

import { Tokens } from '../tokens.js';
import { CalendarGrid } from './CalendarGrid.js';
import { Button } from '../../../DView/elements.js';

/**
 * Componente RalphLoop
 * @param {Object} vnode - Props del componente
 * @param {Object} vnode.attrs.data - Datos (events, resources, blockedDays)
 * @param {Object} vnode.attrs.config - Configuración (slotDuration, startHour, endHour)
 * @param {Object} vnode.attrs.dependencies - Dependencias externas (DView)
 * @param {Object} vnode.attrs.callbacks - Callbacks (onEventDrop, onSlotSelect, etc.)
 */
export const RalphLoop = {
  oninit: (vnode) => {
    // Estado local del componente - inicializar propiedades directamente
    const state = vnode.state;
    state.currentDate = new Date();
    state.viewMode = 'week'; // 'month' | 'week' | 'day'
    state.selectedSlot = null;
    state.draggingEvent = null;
  },

  view: (vnode) => {
    const { data, config, dependencies, callbacks } = vnode.attrs;
    const state = vnode.state;

    // Estilos del contenedor principal
    const containerStyles = {
      width: '100%',
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      backgroundColor: Tokens.colors.surface,
    };

    // Estilos del header
    const headerStyles = {
      height: Tokens.layout.headerHeight,
      backgroundColor: Tokens.colors.surface,
      borderBottom: `1px solid ${Tokens.colors.border}`,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: `0 ${Tokens.layout.spacing.lg}`,
      boxShadow: Tokens.layout.shadow.sm,
    };

    // Estilos del título
    const titleStyles = {
      fontSize: Tokens.typography.fontSize.xl,
      fontWeight: Tokens.typography.fontWeight.semibold,
      color: Tokens.colors.textPrimary,
    };

    // Estilos del área del calendario
    const calendarStyles = {
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      backgroundColor: Tokens.colors.surfaceSecondary,
      overflow: 'hidden',
    };

    // Calcular navegación según el modo de vista
    const navigatePrevious = () => {
      const newDate = new Date(state.currentDate);
      if (state.viewMode === 'month') {
        newDate.setMonth(newDate.getMonth() - 1);
      } else if (state.viewMode === 'week') {
        newDate.setDate(newDate.getDate() - 7);
      } else {
        newDate.setDate(newDate.getDate() - 1);
      }
      state.currentDate = newDate;
      m.redraw();
    };

    const navigateNext = () => {
      const newDate = new Date(state.currentDate);
      if (state.viewMode === 'month') {
        newDate.setMonth(newDate.getMonth() + 1);
      } else if (state.viewMode === 'week') {
        newDate.setDate(newDate.getDate() + 7);
      } else {
        newDate.setDate(newDate.getDate() + 1);
      }
      state.currentDate = newDate;
      m.redraw();
    };

    const navigateToday = () => {
      state.currentDate = new Date();
      m.redraw();
    };

    return m('div', { style: containerStyles }, [
      // Header
      m('div', { style: headerStyles }, [
        m('div', {
          style: {
            display: 'flex',
            alignItems: 'center',
            gap: Tokens.layout.spacing.md,
          }
        }, [
          m('h1', { style: titleStyles }, 'Ralph Loop'),
          m('div', {
            style: {
              display: 'flex',
              gap: Tokens.layout.spacing.sm,
              alignItems: 'center',
            }
          }, [
            m(Button, {
              type: 'default',
              size: 'small',
              onclick: navigatePrevious,
              style: {
                margin: `0 ${Tokens.layout.spacing.xs}`,
              }
            }, '◀ Anterior'),
            m(Button, {
              type: 'default',
              size: 'small',
              onclick: navigateToday,
              style: {
                margin: `0 ${Tokens.layout.spacing.xs}`,
              }
            }, 'Hoy'),
            m(Button, {
              type: 'default',
              size: 'small',
              onclick: navigateNext,
              style: {
                margin: `0 ${Tokens.layout.spacing.xs}`,
              }
            }, 'Siguiente ▶'),
          ]),
        ]),
        m('div', [
          m('span', {
            style: {
              fontSize: Tokens.typography.fontSize.sm,
              color: Tokens.colors.textSecondary,
            },
          }, `Vista: ${state.viewMode} | ${state.currentDate.toLocaleDateString('es-ES', { 
            weekday: 'long', 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
          })})`),
        ]),
      ]),
      
      // Área del calendario con grid
      m('div', { style: calendarStyles }, [
        m(CalendarGrid, {
          currentDate: state.currentDate,
          viewMode: state.viewMode,
          events: data.events,
          resources: data.resources,
          config: config,
        }),
      ]),
    ]);
  },
};
