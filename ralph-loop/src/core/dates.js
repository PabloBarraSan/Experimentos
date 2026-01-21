/**
 * Utilidades de Fechas - Core
 * Funciones puras para manipulación de fechas (sin dependencias externas)
 */

/**
 * Obtiene el inicio del día para una fecha dada
 * @param {Date} date - Fecha
 * @returns {Date} Inicio del día (00:00:00)
 */
export function startOfDay(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

/**
 * Obtiene el final del día para una fecha dada
 * @param {Date} date - Fecha
 * @returns {Date} Final del día (23:59:59.999)
 */
export function endOfDay(date) {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
}

/**
 * Obtiene el inicio de la semana (lunes)
 * @param {Date} date - Fecha
 * @returns {Date} Inicio de la semana
 */
export function startOfWeek(date) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Ajustar para que lunes sea día 1
  d.setDate(diff);
  return startOfDay(d);
}

/**
 * Obtiene el final de la semana (domingo)
 * @param {Date} date - Fecha
 * @returns {Date} Final de la semana
 */
export function endOfWeek(date) {
  const d = new Date(startOfWeek(date));
  d.setDate(d.getDate() + 6);
  return endOfDay(d);
}

/**
 * Obtiene el inicio del mes
 * @param {Date} date - Fecha
 * @returns {Date} Inicio del mes
 */
export function startOfMonth(date) {
  const d = new Date(date);
  d.setDate(1);
  return startOfDay(d);
}

/**
 * Obtiene el final del mes
 * @param {Date} date - Fecha
 * @returns {Date} Final del mes
 */
export function endOfMonth(date) {
  const d = new Date(date);
  d.setMonth(d.getMonth() + 1, 0);
  return endOfDay(d);
}

/**
 * Añade días a una fecha
 * @param {Date} date - Fecha base
 * @param {number} days - Número de días a añadir (puede ser negativo)
 * @returns {Date} Nueva fecha
 */
export function addDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

/**
 * Añade horas a una fecha
 * @param {Date} date - Fecha base
 * @param {number} hours - Número de horas a añadir
 * @returns {Date} Nueva fecha
 */
export function addHours(date, hours) {
  const d = new Date(date);
  d.setHours(d.getHours() + hours);
  return d;
}

/**
 * Añade minutos a una fecha
 * @param {Date} date - Fecha base
 * @param {number} minutes - Número de minutos a añadir
 * @returns {Date} Nueva fecha
 */
export function addMinutes(date, minutes) {
  const d = new Date(date);
  d.setMinutes(d.getMinutes() + minutes);
  return d;
}

/**
 * Redondea una fecha al intervalo más cercano (snap-to-grid)
 * @param {Date} date - Fecha a redondear
 * @param {number} intervalMinutes - Intervalo en minutos (ej: 15, 30)
 * @returns {Date} Fecha redondeada
 */
export function snapToInterval(date, intervalMinutes) {
  const d = new Date(date);
  const minutes = d.getMinutes();
  const rounded = Math.round(minutes / intervalMinutes) * intervalMinutes;
  d.setMinutes(rounded, 0, 0);
  return d;
}

/**
 * Obtiene la diferencia en minutos entre dos fechas
 * @param {Date} date1 - Primera fecha
 * @param {Date} date2 - Segunda fecha
 * @returns {number} Diferencia en minutos
 */
export function diffInMinutes(date1, date2) {
  return Math.round((date2 - date1) / (1000 * 60));
}

/**
 * Verifica si dos fechas están en el mismo día
 * @param {Date} date1 - Primera fecha
 * @param {Date} date2 - Segunda fecha
 * @returns {boolean} true si están en el mismo día
 */
export function isSameDay(date1, date2) {
  return (
    date1.getFullYear() === date2.getFullYear() &&
    date1.getMonth() === date2.getMonth() &&
    date1.getDate() === date2.getDate()
  );
}

/**
 * Verifica si dos fechas están en la misma semana
 * @param {Date} date1 - Primera fecha
 * @param {Date} date2 - Segunda fecha
 * @returns {boolean} true si están en la misma semana
 */
export function isSameWeek(date1, date2) {
  const week1 = startOfWeek(date1);
  const week2 = startOfWeek(date2);
  return week1.getTime() === week2.getTime();
}

/**
 * Genera un array de fechas entre dos fechas (inclusive)
 * @param {Date} startDate - Fecha de inicio
 * @param {Date} endDate - Fecha de fin
 * @returns {Date[]} Array de fechas
 */
export function getDateRange(startDate, endDate) {
  const dates = [];
  const current = new Date(startDate);
  const end = new Date(endDate);
  
  while (current <= end) {
    dates.push(new Date(current));
    current.setDate(current.getDate() + 1);
  }
  
  return dates;
}

/**
 * Genera un array de horas entre dos horas del día
 * @param {number} startHour - Hora de inicio (0-23)
 * @param {number} endHour - Hora de fin (0-23)
 * @param {number} intervalMinutes - Intervalo en minutos
 * @param {Date} baseDate - Fecha base para generar las horas
 * @returns {Date[]} Array de fechas con horas
 */
export function getTimeSlots(startHour, endHour, intervalMinutes, baseDate = new Date()) {
  const slots = [];
  const start = new Date(baseDate);
  start.setHours(startHour, 0, 0, 0);
  
  const end = new Date(baseDate);
  end.setHours(endHour, 0, 0, 0);
  
  let current = new Date(start);
  
  while (current < end) {
    slots.push(new Date(current));
    current = addMinutes(current, intervalMinutes);
  }
  
  return slots;
}

/**
 * Formatea una fecha para mostrar solo la hora
 * @param {Date} date - Fecha
 * @param {string} locale - Locale (default: 'es-ES')
 * @returns {string} Hora formateada (ej: "10:30")
 */
export function formatTime(date, locale = 'es-ES') {
  return date.toLocaleTimeString(locale, {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

/**
 * Formatea una fecha para mostrar solo la fecha
 * @param {Date} date - Fecha
 * @param {string} locale - Locale (default: 'es-ES')
 * @returns {string} Fecha formateada
 */
export function formatDate(date, locale = 'es-ES') {
  return date.toLocaleDateString(locale, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

/**
 * Genera un array de 42 celdas para el grid mensual (7x6)
 * Incluye días del mes anterior y siguiente para completar el grid
 * @param {number} year - Año
 * @param {number} month - Mes (0-11, donde 0 = Enero)
 * @returns {Array} Array de objetos { date: Date, isCurrentMonth: boolean, isPadding: boolean }
 */
export function generateMonthGrid(year, month) {
  const cells = [];
  
  // Primer día del mes
  const firstDay = new Date(year, month, 1);
  const firstDayOfWeek = firstDay.getDay(); // 0 = Domingo, 1 = Lunes, etc.
  
  // Ajustar para que lunes sea el primer día (0 = Lunes)
  const adjustedFirstDayOfWeek = firstDayOfWeek === 0 ? 6 : firstDayOfWeek - 1;
  
  // Último día del mes
  const lastDay = new Date(year, month + 1, 0);
  const daysInMonth = lastDay.getDate();
  
  // Días del mes anterior (padding inicial)
  const prevMonth = month === 0 ? 11 : month - 1;
  const prevYear = month === 0 ? year - 1 : year;
  const prevMonthLastDay = new Date(prevYear, prevMonth + 1, 0);
  const prevMonthDays = prevMonthLastDay.getDate();
  
  // Agregar días del mes anterior
  for (let i = adjustedFirstDayOfWeek - 1; i >= 0; i--) {
    const day = prevMonthDays - i;
    const date = new Date(prevYear, prevMonth, day);
    cells.push({
      date: date,
      isCurrentMonth: false,
      isPadding: true,
    });
  }
  
  // Agregar días del mes actual
  for (let day = 1; day <= daysInMonth; day++) {
    const date = new Date(year, month, day);
    cells.push({
      date: date,
      isCurrentMonth: true,
      isPadding: false,
    });
  }
  
  // Días del mes siguiente (padding final) para completar 42 celdas
  const remainingCells = 42 - cells.length;
  const nextMonth = month === 11 ? 0 : month + 1;
  const nextYear = month === 11 ? year + 1 : year;
  
  for (let day = 1; day <= remainingCells; day++) {
    const date = new Date(nextYear, nextMonth, day);
    cells.push({
      date: date,
      isCurrentMonth: false,
      isPadding: true,
    });
  }
  
  return cells;
}

/**
 * Verifica si una fecha está en un array de fechas ocupadas
 * @param {Date} date - Fecha a verificar
 * @param {Array<string>} bookedDates - Array de strings ISO (ej: ['2023-10-15'])
 * @returns {boolean} true si la fecha está ocupada
 */
export function isDateBooked(date, bookedDates) {
  const dateStr = date.toISOString().split('T')[0];
  return bookedDates.includes(dateStr);
}

/**
 * Verifica si un día de la semana está bloqueado
 * @param {Date} date - Fecha a verificar
 * @param {Array<number>} blockedDays - Array de días bloqueados (0 = Domingo, 1 = Lunes, etc.)
 * @returns {boolean} true si el día está bloqueado
 */
export function isDayBlocked(date, blockedDays) {
  const dayOfWeek = date.getDay();
  return blockedDays.includes(dayOfWeek);
}

/**
 * Verifica si una fecha está en un rango (inclusive)
 * @param {Date} date - Fecha a verificar
 * @param {Date} start - Inicio del rango
 * @param {Date} end - Fin del rango
 * @returns {boolean} true si la fecha está en el rango
 */
export function isDateInRange(date, start, end) {
  if (!start || !end) return false;
  const dateTime = date.getTime();
  const startTime = startOfDay(start).getTime();
  const endTime = endOfDay(end).getTime();
  return dateTime >= startTime && dateTime <= endTime;
}

/**
 * Obtiene el rango de la semana completa que contiene una fecha
 * @param {Date} date - Fecha dentro de la semana
 * @returns {Object} { start: Date, end: Date } - Lunes a Domingo
 */
export function getWeekRange(date) {
  const weekStart = startOfWeek(date);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);
  return {
    start: startOfDay(weekStart),
    end: endOfDay(weekEnd),
  };
}

/**
 * Obtiene el rango del fin de semana (Sábado y Domingo) más cercano
 * @param {Date} date - Fecha de referencia
 * @returns {Object} { start: Date, end: Date } - Sábado a Domingo
 */
export function getWeekendRange(date) {
  const currentDay = date.getDay(); // 0 = Domingo, 6 = Sábado
  let saturday = new Date(date);
  
  // Calcular el sábado más cercano
  if (currentDay === 0) {
    // Si es domingo, retroceder un día para obtener el sábado
    saturday.setDate(date.getDate() - 1);
  } else if (currentDay < 6) {
    // Si es lunes-viernes, avanzar hasta el sábado
    saturday.setDate(date.getDate() + (6 - currentDay));
  }
  // Si ya es sábado, usar la fecha actual
  
  const sunday = new Date(saturday);
  sunday.setDate(saturday.getDate() + 1);
  
  return {
    start: startOfDay(saturday),
    end: endOfDay(sunday),
  };
}

/**
 * Obtiene el rango del fin de semana actual (Sábado y Domingo de esta semana)
 * @param {Date} date - Fecha de referencia
 * @returns {Object} { start: Date, end: Date } - Sábado a Domingo de esta semana
 */
export function getCurrentWeekendRange(date) {
  const weekStart = startOfWeek(date);
  const saturday = new Date(weekStart);
  saturday.setDate(weekStart.getDate() + 5); // Sábado es 5 días después del lunes
  const sunday = new Date(weekStart);
  sunday.setDate(weekStart.getDate() + 6); // Domingo es 6 días después del lunes
  
  return {
    start: startOfDay(saturday),
    end: endOfDay(sunday),
  };
}
