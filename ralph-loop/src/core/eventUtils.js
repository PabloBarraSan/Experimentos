/**
 * Utilidades de Eventos - Core
 * Funciones puras para posicionamiento y colisiones de eventos
 */

import { startOfDay, diffInMinutes, isSameDay } from './dates.js';

/**
 * Calcula la posición top (en píxeles) de un evento basado en su hora de inicio
 * @param {Date} eventStart - Hora de inicio del evento
 * @param {Date} dayStart - Inicio del día (00:00:00)
 * @param {number} slotHeight - Altura de cada slot en píxeles
 * @param {number} slotDuration - Duración de cada slot en minutos
 * @returns {number} Posición top en píxeles
 */
export function calculateEventTop(eventStart, dayStart, slotHeight, slotDuration) {
  const dayStartTime = startOfDay(dayStart);
  const minutesFromStart = diffInMinutes(dayStartTime, eventStart);
  const slotsFromStart = minutesFromStart / slotDuration;
  return slotsFromStart * slotHeight;
}

/**
 * Calcula la altura (en píxeles) de un evento basado en su duración
 * @param {Date} eventStart - Hora de inicio del evento
 * @param {Date} eventEnd - Hora de fin del evento
 * @param {number} slotHeight - Altura de cada slot en píxeles
 * @param {number} slotDuration - Duración de cada slot en minutos
 * @returns {number} Altura en píxeles
 */
export function calculateEventHeight(eventStart, eventEnd, slotHeight, slotDuration) {
  const durationMinutes = diffInMinutes(eventStart, eventEnd);
  const slots = durationMinutes / slotDuration;
  return Math.max(slots * slotHeight, slotHeight * 0.5); // Mínimo medio slot
}

/**
 * Verifica si dos eventos se solapan en el tiempo
 * @param {Object} event1 - Primer evento { start: Date, end: Date }
 * @param {Object} event2 - Segundo evento { start: Date, end: Date }
 * @returns {boolean} true si se solapan
 */
export function eventsOverlap(event1, event2) {
  return event1.start < event2.end && event1.end > event2.start;
}

/**
 * Agrupa eventos que se solapan en el mismo día
 * @param {Array} events - Array de eventos
 * @param {Date} day - Día a verificar
 * @returns {Array} Array de grupos de eventos solapados
 */
export function groupOverlappingEvents(events, day) {
  // Filtrar eventos que están en este día
  const dayEvents = events.filter(event => {
    const eventStart = new Date(event.start);
    const eventEnd = new Date(event.end);
    return isSameDay(eventStart, day) || isSameDay(eventEnd, day) ||
           (eventStart <= day && eventEnd >= day);
  });

  if (dayEvents.length === 0) return [];

  // Ordenar eventos por hora de inicio
  const sortedEvents = [...dayEvents].sort((a, b) => 
    new Date(a.start) - new Date(b.start)
  );

  // Agrupar eventos solapados
  const groups = [];
  const processed = new Set();

  sortedEvents.forEach((event, index) => {
    if (processed.has(index)) return;

    const group = [event];
    processed.add(index);

    // Buscar todos los eventos que se solapan con este
    sortedEvents.forEach((otherEvent, otherIndex) => {
      if (index === otherIndex || processed.has(otherIndex)) return;

      // Verificar si se solapa con algún evento del grupo actual
      const overlapsWithGroup = group.some(groupEvent => 
        eventsOverlap(
          { start: new Date(groupEvent.start), end: new Date(groupEvent.end) },
          { start: new Date(otherEvent.start), end: new Date(otherEvent.end) }
        )
      );

      if (overlapsWithGroup) {
        group.push(otherEvent);
        processed.add(otherIndex);
      }
    });

    groups.push(group);
  });

  return groups;
}

/**
 * Calcula la posición left y width para eventos solapados
 * @param {Array} eventGroup - Grupo de eventos solapados
 * @param {number} eventIndex - Índice del evento en el grupo
 * @param {number} columnWidth - Ancho de la columna (puede ser píxeles o porcentaje base)
 * @returns {Object} { left: number, width: number } en píxeles o porcentajes
 */
export function calculateEventPosition(eventGroup, eventIndex, columnWidth = 100) {
  const totalEvents = eventGroup.length;
  const eventWidthPercent = 100 / totalEvents;
  const leftPercent = eventIndex * eventWidthPercent;
  
  return {
    left: leftPercent, // Porcentaje
    width: eventWidthPercent, // Porcentaje
  };
}

/**
 * Filtra eventos que son visibles en un rango de días
 * @param {Array} events - Array de eventos
 * @param {Array} visibleDays - Array de días visibles
 * @returns {Array} Eventos visibles
 */
export function filterVisibleEvents(events, visibleDays) {
  if (visibleDays.length === 0) return [];

  const firstDay = visibleDays[0];
  const lastDay = visibleDays[visibleDays.length - 1];
  const rangeStart = new Date(firstDay);
  rangeStart.setHours(0, 0, 0, 0);
  const rangeEnd = new Date(lastDay);
  rangeEnd.setHours(23, 59, 59, 999);

  return events.filter(event => {
    const eventStart = new Date(event.start);
    const eventEnd = new Date(event.end);
    
    // El evento es visible si se solapa con el rango visible
    return eventStart <= rangeEnd && eventEnd >= rangeStart;
  });
}

/**
 * Calcula en qué día(s) cae un evento
 * @param {Object} event - Evento { start: Date, end: Date }
 * @param {Array} visibleDays - Array de días visibles
 * @returns {Array} Array de índices de días donde el evento es visible
 */
export function getEventVisibleDays(event, visibleDays) {
  const eventStart = new Date(event.start);
  const eventEnd = new Date(event.end);
  const visibleDayIndices = [];

  visibleDays.forEach((day, index) => {
    const dayStart = new Date(day);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(day);
    dayEnd.setHours(23, 59, 59, 999);

    // El evento es visible en este día si se solapa
    if (eventStart <= dayEnd && eventEnd >= dayStart) {
      visibleDayIndices.push(index);
    }
  });

  return visibleDayIndices;
}
