/**
 * Utilidades de Virtualización - Core
 * Funciones para calcular qué elementos son visibles en el viewport
 */

/**
 * Calcula qué slots de tiempo son visibles en el viewport
 * @param {Array} timeSlots - Array de slots de tiempo
 * @param {number} scrollTop - Posición de scroll vertical
 * @param {number} viewportHeight - Altura del viewport
 * @param {number} slotHeight - Altura de cada slot en píxeles
 * @param {number} buffer - Buffer adicional en píxeles (default: 200)
 * @returns {Object} { startIndex: number, endIndex: number, visibleSlots: Array }
 */
export function getVisibleTimeSlots(timeSlots, scrollTop, viewportHeight, slotHeight, buffer = 200) {
  if (timeSlots.length === 0) {
    return { startIndex: 0, endIndex: 0, visibleSlots: [] };
  }

  // Calcular índices visibles con buffer
  const startPixel = Math.max(0, scrollTop - buffer);
  const endPixel = scrollTop + viewportHeight + buffer;

  const startIndex = Math.floor(startPixel / slotHeight);
  const endIndex = Math.min(
    timeSlots.length - 1,
    Math.ceil(endPixel / slotHeight)
  );

  const visibleSlots = timeSlots.slice(
    Math.max(0, startIndex),
    Math.min(timeSlots.length, endIndex + 1)
  );

  return {
    startIndex: Math.max(0, startIndex),
    endIndex: Math.min(timeSlots.length - 1, endIndex),
    visibleSlots,
  };
}

/**
 * Calcula qué eventos son visibles en el viewport vertical
 * @param {Array} events - Array de eventos
 * @param {Date} dayStart - Inicio del día
 * @param {number} scrollTop - Posición de scroll vertical
 * @param {number} viewportHeight - Altura del viewport
 * @param {number} slotHeight - Altura de cada slot en píxeles
 * @param {number} slotDuration - Duración de cada slot en minutos
 * @param {number} headerHeight - Altura del header en píxeles
 * @param {number} buffer - Buffer adicional en píxeles (default: 200)
 * @returns {Array} Eventos visibles
 */
export function getVisibleEvents(
  events,
  dayStart,
  scrollTop,
  viewportHeight,
  slotHeight,
  slotDuration,
  headerHeight = 0,
  buffer = 200
) {
  if (events.length === 0) return [];

  // Calcular rango de tiempo visible
  const visibleTop = scrollTop - buffer;
  const visibleBottom = scrollTop + viewportHeight + buffer;

  // Convertir píxeles a minutos desde el inicio del día
  const minutesPerPixel = slotDuration / slotHeight;
  const visibleStartMinutes = Math.max(0, (visibleTop - headerHeight) * minutesPerPixel);
  const visibleEndMinutes = (visibleBottom - headerHeight) * minutesPerPixel;

  // Crear fechas de inicio y fin del rango visible
  const visibleStart = new Date(dayStart);
  visibleStart.setMinutes(visibleStart.getMinutes() + visibleStartMinutes);

  const visibleEnd = new Date(dayStart);
  visibleEnd.setMinutes(visibleEnd.getMinutes() + visibleEndMinutes);

  // Filtrar eventos que se solapan con el rango visible
  return events.filter(event => {
    const eventStart = new Date(event.start);
    const eventEnd = new Date(event.end);

    // El evento es visible si se solapa con el rango visible
    return eventStart < visibleEnd && eventEnd > visibleStart;
  });
}

/**
 * Calcula la altura total del contenido (para scrollbar correcta)
 * @param {number} totalSlots - Número total de slots
 * @param {number} slotHeight - Altura de cada slot en píxeles
 * @param {number} headerHeight - Altura del header en píxeles
 * @returns {number} Altura total en píxeles
 */
export function calculateTotalHeight(totalSlots, slotHeight, headerHeight = 0) {
  return totalSlots * slotHeight + headerHeight;
}

/**
 * Calcula el offset de renderizado para slots virtualizados
 * @param {number} startIndex - Índice del primer slot visible
 * @param {number} slotHeight - Altura de cada slot en píxeles
 * @returns {number} Offset en píxeles
 */
export function calculateRenderOffset(startIndex, slotHeight) {
  return startIndex * slotHeight;
}
