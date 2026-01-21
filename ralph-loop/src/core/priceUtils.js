/**
 * Utilidades de Precios - Core
 * Motor de cálculo de precios con modificadores y lógica de ofertas
 */

/**
 * Obtiene el precio para una fecha específica
 * @param {string|Date} date - Fecha en formato ISO string o Date
 * @param {Object} dailyRates - Configuración de precios
 * @param {number} dailyRates.default - Precio base por defecto
 * @param {string} dailyRates.currency - Moneda (ej: "USD", "EUR")
 * @param {Object} dailyRates.modifiers - Modificadores de precio
 * @param {Object} dailyRates.modifiers[dateISO] - Precio específico para una fecha
 * @param {number} dailyRates.modifiers.weekend - Multiplicador para fines de semana
 * @returns {Object} { price: number, currency: string }
 */
export function getPriceForDate(date, dailyRates = {}) {
  if (!dailyRates || typeof dailyRates !== 'object') {
    return { price: 0, currency: 'USD' };
  }

  // Normalizar fecha a ISO string
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  const dateISO = dateObj.toISOString().split('T')[0];
  
  // Precio base
  const basePrice = dailyRates.default || 100;
  const currency = dailyRates.currency || 'USD';
  
  // Verificar si hay precio específico para esta fecha
  const modifiers = dailyRates.modifiers || {};
  if (modifiers[dateISO]) {
    return {
      price: modifiers[dateISO],
      currency: currency,
    };
  }
  
  // Verificar si es fin de semana y hay multiplicador
  const dayOfWeek = dateObj.getDay(); // 0 = Domingo, 6 = Sábado
  const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
  
  if (isWeekend && modifiers.weekend) {
    const weekendMultiplier = modifiers.weekend;
    return {
      price: Math.round(basePrice * weekendMultiplier),
      currency: currency,
    };
  }
  
  return {
    price: basePrice,
    currency: currency,
  };
}

/**
 * Calcula el precio promedio de un rango de fechas
 * @param {Date} startDate - Fecha de inicio
 * @param {Date} endDate - Fecha de fin
 * @param {Object} dailyRates - Configuración de precios
 * @returns {number} Precio promedio
 */
export function getAveragePrice(startDate, endDate, dailyRates) {
  const dates = [];
  const current = new Date(startDate);
  const end = new Date(endDate);
  
  while (current <= end) {
    dates.push(new Date(current));
    current.setDate(current.getDate() + 1);
  }
  
  if (dates.length === 0) return 0;
  
  const total = dates.reduce((sum, date) => {
    return sum + getPriceForDate(date, dailyRates).price;
  }, 0);
  
  return Math.round(total / dates.length);
}

/**
 * Calcula el total de un rango de fechas
 * @param {Date} startDate - Fecha de inicio
 * @param {Date} endDate - Fecha de fin
 * @param {Object} dailyRates - Configuración de precios
 * @returns {Object} { total: number, nights: number, currency: string }
 */
export function calculateRangeTotal(startDate, endDate, dailyRates) {
  const dates = [];
  const current = new Date(startDate);
  const end = new Date(endDate);
  
  while (current <= end) {
    dates.push(new Date(current));
    current.setDate(current.getDate() + 1);
  }
  
  const nights = dates.length;
  const total = dates.reduce((sum, date) => {
    return sum + getPriceForDate(date, dailyRates).price;
  }, 0);
  
  const currency = dailyRates?.currency || 'USD';
  
  return {
    total: total,
    nights: nights,
    currency: currency,
  };
}

/**
 * Determina el color del precio según su valor relativo
 * @param {number} price - Precio actual
 * @param {number} averagePrice - Precio promedio
 * @param {boolean} isSelected - Si el día está seleccionado
 * @returns {string} Color CSS
 */
export function getPriceColor(price, averagePrice, isSelected = false) {
  if (isSelected) {
    return '#FFFFFF'; // Blanco cuando está seleccionado
  }
  
  if (!averagePrice || averagePrice === 0) {
    return '#6B7280'; // Gris neutro si no hay promedio
  }
  
  const ratio = price / averagePrice;
  
  // Precio alto (> promedio): rojizo/oscuro
  if (ratio > 1.1) {
    return '#DC2626'; // Rojo oscuro
  }
  
  // Precio bajo (oferta): verde o acento
  if (ratio < 0.9) {
    return '#10B981'; // Verde
  }
  
  // Precio normal: gris
  return '#6B7280';
}

/**
 * Formatea un precio con su moneda
 * @param {number} price - Precio
 * @param {string} currency - Moneda (ej: "USD", "EUR")
 * @returns {string} Precio formateado
 */
export function formatPrice(price, currency = 'USD') {
  const formatter = new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency: currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
  
  return formatter.format(price);
}
