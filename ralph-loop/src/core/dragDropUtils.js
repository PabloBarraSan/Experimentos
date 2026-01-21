/**
 * Utilidades de Drag & Drop - Core
 * Funciones para manejar arrastre y soltar de eventos
 */

import { startOfDay, addMinutes, diffInMinutes, snapToInterval } from './dates.js';
import { calculateEventTop, calculateEventHeight } from './eventUtils.js';

/**
 * Calcula la nueva fecha basada en la posición del mouse durante el drag
 * @param {number} mouseY - Posición Y del mouse
 * @param {Date} dayStart - Inicio del día
 * @param {number} slotHeight - Altura de cada slot en píxeles
 * @param {number} slotDuration - Duración de cada slot en minutos
 * @param {number} snapInterval - Intervalo de snap en minutos
 * @param {number} headerHeight - Altura del header
 * @returns {Date} Nueva fecha con snap aplicado
 */
export function calculateDateFromMousePosition(
  mouseY,
  dayStart,
  slotHeight,
  slotDuration,
  snapInterval = 15,
  headerHeight = 0
) {
  // Calcular minutos desde el inicio del día
  const relativeY = mouseY - headerHeight;
  const slotsFromTop = relativeY / slotHeight;
  const minutesFromStart = slotsFromTop * slotDuration;
  
  // Crear nueva fecha
  const newDate = new Date(dayStart);
  newDate.setMinutes(newDate.getMinutes() + minutesFromStart);
  
  // Aplicar snap
  return snapToInterval(newDate, snapInterval);
}

/**
 * Calcula el offset del drag desde el punto inicial
 * @param {number} startY - Posición Y inicial del mouse
 * @param {number} currentY - Posición Y actual del mouse
 * @param {number} slotHeight - Altura de cada slot
 * @param {number} slotDuration - Duración de cada slot en minutos
 * @param {number} snapInterval - Intervalo de snap
 * @returns {number} Offset en minutos
 */
export function calculateDragOffset(startY, currentY, slotHeight, slotDuration, snapInterval) {
  const pixelOffset = currentY - startY;
  const slotOffset = pixelOffset / slotHeight;
  const minutesOffset = slotOffset * slotDuration;
  
  // Redondear al intervalo de snap más cercano
  return Math.round(minutesOffset / snapInterval) * snapInterval;
}

/**
 * Calcula la nueva posición de un evento durante el drag
 * @param {Date} originalStart - Hora de inicio original
 * @param {number} dragOffsetMinutes - Offset del drag en minutos
 * @param {number} snapInterval - Intervalo de snap
 * @returns {Date} Nueva hora de inicio
 */
export function calculateNewEventStart(originalStart, dragOffsetMinutes, snapInterval) {
  const newStart = addMinutes(originalStart, dragOffsetMinutes);
  return snapToInterval(newStart, snapInterval);
}

/**
 * Calcula la nueva duración de un evento durante el resize
 * @param {Date} originalStart - Hora de inicio original
 * @param {Date} originalEnd - Hora de fin original
 * @param {number} resizeOffsetMinutes - Offset del resize en minutos
 * @param {number} snapInterval - Intervalo de snap
 * @param {string} resizeHandle - 'top' o 'bottom'
 * @returns {Object} { start: Date, end: Date }
 */
export function calculateNewEventDuration(
  originalStart,
  originalEnd,
  resizeOffsetMinutes,
  snapInterval,
  resizeHandle
) {
  if (resizeHandle === 'top') {
    // Redimensionar desde arriba (cambiar inicio)
    const newStart = addMinutes(originalStart, resizeOffsetMinutes);
    const snappedStart = snapToInterval(newStart, snapInterval);
    
    // Asegurar que el inicio no sea después del fin
    if (snappedStart >= originalEnd) {
      return {
        start: new Date(originalEnd.getTime() - snapInterval * 60 * 1000),
        end: originalEnd,
      };
    }
    
    return {
      start: snappedStart,
      end: originalEnd,
    };
  } else {
    // Redimensionar desde abajo (cambiar fin)
    const newEnd = addMinutes(originalEnd, resizeOffsetMinutes);
    const snappedEnd = snapToInterval(newEnd, snapInterval);
    
    // Asegurar que el fin no sea antes del inicio
    if (snappedEnd <= originalStart) {
      return {
        start: originalStart,
        end: new Date(originalStart.getTime() + snapInterval * 60 * 1000),
      };
    }
    
    return {
      start: originalStart,
      end: snappedEnd,
    };
  }
}

/**
 * Verifica si una posición está dentro de los límites del calendario
 * @param {Date} date - Fecha a verificar
 * @param {number} startHour - Hora de inicio del calendario
 * @param {number} endHour - Hora de fin del calendario
 * @returns {boolean} true si está dentro de los límites
 */
export function isWithinCalendarBounds(date, startHour, endHour) {
  const hour = date.getHours();
  const minutes = date.getMinutes();
  const totalMinutes = hour * 60 + minutes;
  const startMinutes = startHour * 60;
  const endMinutes = endHour * 60;
  
  return totalMinutes >= startMinutes && totalMinutes <= endMinutes;
}

/**
 * Calcula la posición del ghost element durante el drag
 * @param {Date} newStart - Nueva hora de inicio
 * @param {Date} originalEnd - Hora de fin original
 * @param {Date} dayStart - Inicio del día
 * @param {number} slotHeight - Altura de cada slot
 * @param {number} slotDuration - Duración de cada slot
 * @returns {Object} { top: number, height: number }
 */
export function calculateGhostPosition(newStart, originalEnd, dayStart, slotHeight, slotDuration) {
  const top = calculateEventTop(newStart, dayStart, slotHeight, slotDuration);
  const height = calculateEventHeight(newStart, originalEnd, slotHeight, slotDuration);
  
  return { top, height };
}
