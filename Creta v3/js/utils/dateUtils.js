// Date utility functions - Shared across calendar and admin views

/**
 * Formats a date to Spanish locale format (e.g., "24 nov. 2025")
 * @param {Date|string|number} date - Date to format
 * @returns {string} Formatted date string
 */
export function formatDate(date) {
    if (!date) return 'Sin fecha';
    try {
        let d;
        if (date instanceof Date) {
            d = date;
        } else if (typeof date === 'number') {
            d = new Date(date);
        } else if (typeof date === 'string') {
            d = new Date(date);
        } else {
            return 'Sin fecha';
        }
        
        if (isNaN(d.getTime())) {
            return 'Sin fecha';
        }
        
        const options = { day: '2-digit', month: 'short', year: 'numeric' };
        return d.toLocaleDateString('es-ES', options);
    } catch (e) {
        return 'Sin fecha';
    }
}

/**
 * Format date as key (YYYY-MM-DD)
 * @param {Date} date - Date object
 * @returns {string} Formatted date key
 */
export function formatDateKey(date) {
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    return `${year}-${month}-${day}`;
}

/**
 * Format day header (e.g., "lun. 24/11")
 * @param {Date} date - Date object
 * @returns {string} Formatted string
 */
export function formatDayHeader(date) {
    const days = ['dom.', 'lun.', 'mar.', 'mié.', 'jue.', 'vie.', 'sáb.'];
    const day = days[date.getDay()];
    const dateStr = `${date.getDate()}/${(date.getMonth() + 1).toString().padStart(2, '0')}`;
    return `${day} ${dateStr}`;
}

/**
 * Format date range based on view mode
 * @param {Array<Date>} days - Array of days
 * @param {string} viewMode - 'day', 'week', or 'month'
 * @returns {string} Formatted string
 */
export function formatWeekRange(days, viewMode = 'week') {
    const months = ['ene.', 'feb.', 'mar.', 'abr.', 'may.', 'jun.', 'jul.', 'ago.', 'sep.', 'oct.', 'nov.', 'dic.'];
    
    if (viewMode === 'day') {
        // Single day view
        const day = days[0];
        const dayNames = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
        return `${dayNames[day.getDay()]}, ${day.getDate()} de ${months[day.getMonth()]} de ${day.getFullYear()}`;
    } else if (viewMode === 'month') {
        // Month view
        const firstDay = days[0];
        const lastDay = days[days.length - 1];
        if (firstDay.getMonth() === lastDay.getMonth()) {
            return `${months[firstDay.getMonth()]} de ${firstDay.getFullYear()}`;
        } else {
            return `${months[firstDay.getMonth()]} – ${months[lastDay.getMonth()]} de ${firstDay.getFullYear()}`;
        }
    } else {
        // Week view
        const start = days[0];
        const end = days[days.length - 1];
        if (start.getMonth() === end.getMonth()) {
            return `${start.getDate()} – ${end.getDate()} de ${months[end.getMonth()]} de ${end.getFullYear()}`;
        } else {
            return `${start.getDate()} de ${months[start.getMonth()]} – ${end.getDate()} de ${months[end.getMonth()]} de ${end.getFullYear()}`;
        }
    }
}

/**
 * Check if date is today
 * @param {Date} date - Date to check
 * @returns {boolean} True if today
 */
export function isToday(date) {
    const today = new Date();
    return date.toDateString() === today.toDateString();
}

