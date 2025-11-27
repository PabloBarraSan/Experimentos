// Calendar View Module - Handles the calendar view for appointments

import { fetchAppointments, getDateRange } from './api.js';

/**
 * Render the complete calendar view for a resource
 * @param {Object} resource - Resource object
 * @param {HTMLElement} container - Container element
 */
export async function renderCalendarView(resource, container) {
    // Show loading state
    container.innerHTML = `
        <div class="flex items-center justify-center py-12">
            <i class="fa-solid fa-circle-notch fa-spin text-4xl text-blue-600"></i>
            <p class="ml-4 text-slate-500">Cargando calendario...</p>
        </div>
    `;

    // Fetch appointments data
    const dateRange = getDateRange();
    const appointmentsData = await fetchAppointments(
        resource._id,
        resource.groupId,
        dateRange.start,
        dateRange.end
    );

    // Render the calendar view
    const headerHtml = renderCalendarHeader(resource);
    const toolbarHtml = renderToolbar();
    const calendarHtml = renderWeeklyCalendar(resource, appointmentsData);
    const sidebarHtml = renderSidebar();

    container.innerHTML = headerHtml + toolbarHtml + calendarHtml + sidebarHtml;

    // Store appointments data globally for access
    window.currentAppointmentsData = appointmentsData;
}

/**
 * Render the sidebar container (hidden by default)
 * @returns {string} HTML string
 */
function renderSidebar() {
    return `
        <div id="slot-sidebar" class="fixed inset-y-0 right-0 w-96 bg-white shadow-2xl transform translate-x-full transition-transform duration-300 ease-in-out z-50 flex flex-col">
            <div class="p-4 border-b border-slate-200 flex justify-between items-center bg-slate-50">
                <h3 class="font-bold text-lg text-slate-800">Detalles del Slot</h3>
                <button onclick="closeSidebar()" class="text-slate-400 hover:text-slate-600 transition">
                    <i class="fa-solid fa-times text-xl"></i>
                </button>
            </div>
            <div id="sidebar-content" class="flex-1 overflow-y-auto p-4 space-y-4">
                <!-- Content injected via JS -->
            </div>
        </div>
        <div id="sidebar-overlay" onclick="closeSidebar()" class="fixed inset-0 bg-black/20 backdrop-blur-sm hidden z-40 transition-opacity"></div>
    `;
}

/**
 * Open the sidebar with slot details
 * @param {string} slotId - ID of the clicked slot
 */
window.openSlotDetails = function (slotId) {
    const data = window.currentAppointmentsData;
    if (!data || !data.slots) return;

    const slot = data.slots.find(s => s._id === slotId);
    if (!slot) return;

    const sidebar = document.getElementById('slot-sidebar');
    const overlay = document.getElementById('sidebar-overlay');
    const content = document.getElementById('sidebar-content');

    // Populate content
    content.innerHTML = renderSlotDetails(slot);

    // Show sidebar
    sidebar.classList.remove('translate-x-full');
    overlay.classList.remove('hidden');
    document.body.style.overflow = 'hidden'; // Prevent background scrolling
};

/**
 * Close the sidebar
 */
window.closeSidebar = function () {
    const sidebar = document.getElementById('slot-sidebar');
    const overlay = document.getElementById('sidebar-overlay');

    sidebar.classList.add('translate-x-full');
    overlay.classList.add('hidden');
    document.body.style.overflow = '';
};

/**
 * Render details for a specific slot
 * @param {Object} slot - Slot object
 * @returns {string} HTML string
 */
function renderSlotDetails(slot) {
    const startTime = new Date(slot.start).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const endTime = new Date(slot.end).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const date = new Date(slot.start).toLocaleDateString([], { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

    let html = `
        <div class="bg-blue-50 rounded-lg p-4 mb-4 border border-blue-100">
            <h4 class="font-bold text-blue-800 text-lg mb-1">${slot.title || 'Slot'}</h4>
            <div class="text-sm text-blue-600 mb-2">
                <i class="fa-regular fa-calendar mr-2"></i>${date}
            </div>
            <div class="text-sm text-blue-600 mb-2">
                <i class="fa-regular fa-clock mr-2"></i>${startTime} - ${endTime}
            </div>
            <div class="flex items-center justify-between mt-3 bg-white p-2 rounded border border-blue-100">
                <span class="text-xs font-medium text-slate-500 uppercase">Disponibilidad</span>
                <span class="font-bold text-blue-700">${slot.seats?.remaining || 0} / ${slot.seats?.total || 0}</span>
            </div>
        </div>
        
        <h4 class="font-bold text-slate-700 mb-3 flex items-center">
            <i class="fa-solid fa-users mr-2 text-slate-400"></i>
            Reservas (${slot.appointments?.length || 0})
        </h4>
    `;

    if (!slot.appointments || slot.appointments.length === 0) {
        html += `
            <div class="text-center py-8 text-slate-400 bg-slate-50 rounded-lg border border-dashed border-slate-200">
                <i class="fa-regular fa-calendar-xmark text-3xl mb-2"></i>
                <p>No hay reservas en este slot</p>
            </div>
        `;
    } else {
        html += '<div class="space-y-3">';
        slot.appointments.forEach(app => {
            const statusColor = app.confirmed ? 'green' : 'orange';
            const statusIcon = app.confirmed ? 'check-circle' : 'clock';

            html += `
                <div class="bg-white p-3 rounded-lg border border-slate-200 shadow-sm hover:shadow-md transition">
                    <div class="flex justify-between items-start mb-2">
                        <div class="font-semibold text-slate-800">
                            ${app.user?.firstName || 'Usuario'} ${app.user?.lastName || ''}
                        </div>
                        <span class="text-xs font-medium px-2 py-0.5 rounded-full bg-${statusColor}-100 text-${statusColor}-700 flex items-center">
                            <i class="fa-solid fa-${statusIcon} mr-1"></i>
                            ${app.seats} pax
                        </span>
                    </div>
                    <div class="text-xs text-slate-500 space-y-1">
                        <div class="flex items-center">
                            <i class="fa-solid fa-envelope w-4 text-center mr-2 opacity-70"></i>
                            ${app.user?.email || 'No email'}
                        </div>
                        <div class="flex items-center">
                            <i class="fa-solid fa-phone w-4 text-center mr-2 opacity-70"></i>
                            ${app.user?.telephone || 'No teléfono'}
                        </div>
                        ${app.amount ? `
                        <div class="flex items-center text-slate-700 font-medium mt-2 pt-2 border-t border-slate-100">
                            <i class="fa-solid fa-euro-sign w-4 text-center mr-2 opacity-70"></i>
                            ${(app.amount / 100).toFixed(2)}€
                        </div>
                        ` : ''}
                    </div>
                </div>
            `;
        });
        html += '</div>';
    }

    return html;
}

/**
 * Render the calendar header with resource information
 * @param {Object} resource - Resource object
 * @returns {string} HTML string
 */
function renderCalendarHeader(resource) {
    return `
        <div class="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-6">
            <div class="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
                <!-- Resource Info -->
                <div class="flex items-center gap-4">
                    <img src="${resource.photo || 'https://via.placeholder.com/60'}" 
                         alt="${resource.name}"
                         class="w-16 h-16 rounded-full object-cover border-2 border-slate-200">
                    <div>
                        <h1 class="text-2xl font-bold text-slate-900">${resource.title || resource.name}</h1>
                        <p class="text-sm text-slate-500">${resource.subtitle || ''}</p>
                    </div>
                </div>

                <!-- Resource Badges -->
                <div class="flex flex-wrap gap-2">
                    <span class="px-3 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-600">
                        Tipus: ${resource.type}
                    </span>
                    ${resource.published ?
            '<span class="px-3 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700">Publicat</span>' :
            '<span class="px-3 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-500">No Publicat</span>'
        }
                    <span class="px-3 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-600">
                        <i class="fa-solid fa-check text-green-500 mr-1"></i>Autoconfirmat
                    </span>
                    <span class="px-3 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-600">
                        <i class="fa-solid fa-users mr-1"></i>${resource.seats?.total || 0}
                    </span>
                    <span class="px-3 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-600">
                        <i class="fa-solid fa-credit-card text-green-500 mr-1"></i>Pago
                    </span>
                </div>
            </div>
        </div>
    `;
}

/**
 * Render the toolbar with actions
 * @returns {string} HTML string
 */
function renderToolbar() {
    return `
        <div class="bg-white rounded-xl shadow-sm border border-slate-200 p-4 mb-6">
            <div class="flex flex-wrap items-center justify-between gap-3">
                <!-- Left: Back button -->
                <button onclick="app.backToAdmin()" 
                        class="flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition font-medium">
                    <i class="fa-solid fa-arrow-left"></i>
                    <span>Tornar</span>
                </button>

                <!-- Right: Action buttons -->
                <div class="flex flex-wrap gap-2">
                    <button class="px-4 py-2 bg-orange-50 hover:bg-orange-100 text-orange-700 border border-orange-200 rounded-lg transition font-medium text-sm flex items-center gap-2">
                        <i class="fa-solid fa-search"></i>
                        <span>Buscar cites</span>
                    </button>
                    <button class="px-4 py-2 bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 rounded-lg transition font-medium text-sm flex items-center gap-2">
                        <i class="fa-solid fa-calendar"></i>
                        <span>Gestionar horarios</span>
                    </button>
                    <button class="px-4 py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-lg transition font-medium text-sm flex items-center gap-2">
                        <i class="fa-solid fa-plus"></i>
                        <span class="hidden sm:inline">Añadir/quitar asientos</span>
                    </button>
                    <button class="px-4 py-2 bg-teal-50 hover:bg-teal-100 text-teal-700 border border-teal-200 rounded-lg transition font-medium text-sm flex items-center gap-2">
                        <i class="fa-solid fa-clone"></i>
                        <span class="hidden sm:inline">Clonar Setmana</span>
                    </button>
                    <button class="px-4 py-2 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 rounded-lg transition font-medium text-sm flex items-center gap-2">
                        <i class="fa-solid fa-trash"></i>
                        <span class="hidden sm:inline">Eliminar Setmana</span>
                    </button>
                    <button class="px-3 py-2 bg-slate-50 hover:bg-slate-100 text-slate-600 border border-slate-200 rounded-lg transition">
                        <i class="fa-solid fa-circle-question"></i>
                    </button>
                </div>
            </div>
        </div>
    `;
}

/**
 * Render the weekly calendar
 * @param {Object} resource - Resource object
 * @param {Object} appointmentsData - Appointments data from API
 * @returns {string} HTML string
 */
function renderWeeklyCalendar(resource, appointmentsData) {
    const currentWeek = getCurrentWeek();

    return `
        <div class="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
            <!-- Calendar Controls -->
            <div class="flex flex-col sm:flex-row justify-between items-center gap-4 mb-6">
                <!-- Navigation -->
                <div class="flex items-center gap-2">
                    <button class="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition font-medium text-sm">
                        Hoy
                    </button>
                    <div class="flex gap-1">
                        <button class="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-l-lg transition">
                            <i class="fa-solid fa-chevron-left"></i>
                        </button>
                        <button class="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-r-lg transition">
                            <i class="fa-solid fa-chevron-right"></i>
                        </button>
                    </div>
                    <div class="flex gap-1">
                        <button class="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition font-medium text-sm">
                            Día
                        </button>
                        <button class="px-4 py-2 bg-blue-600 text-white rounded-lg transition font-medium text-sm">
                            Semana
                        </button>
                        <button class="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition font-medium text-sm">
                            Mes
                        </button>
                    </div>
                </div>

                <!-- Week Range -->
                <h2 class="text-lg font-semibold text-slate-700">
                    ${formatWeekRange(currentWeek)}
                </h2>
            </div>

            <!-- Calendar Grid -->
            <div class="overflow-x-auto">
                ${renderCalendarGrid(resource, appointmentsData, currentWeek)}
            </div>
        </div>
    `;
}

/**
 * Render the calendar grid
 * @param {Object} resource - Resource object
 * @param {Object} appointmentsData - Appointments data
 * @param {Array} weekDays - Array of days in the week
 * @returns {string} HTML string
 */
function renderCalendarGrid(resource, appointmentsData, weekDays) {
    const virtualSettings = resource.virtualSettings ? Object.values(resource.virtualSettings) : [];
    const timeSlots = generateTimeSlots();

    // Map appointments to a lookup structure
    const appointmentMap = mapAppointmentsToGrid(appointmentsData, resource);

    let html = '<div class="min-w-[800px]">';

    // Header row with days
    html += '<div class="grid grid-cols-8 border-b-2 border-slate-300 bg-slate-50">';
    html += '<div class="p-3 text-sm font-semibold text-slate-500 border-r border-slate-200">Hora</div>';

    weekDays.forEach(day => {
        const dayIsToday = isToday(day);
        html += `
            <div class="p-3 text-center border-r border-slate-200 last:border-r-0 ${dayIsToday ? 'bg-blue-50' : ''}">
                <div class="text-xs font-semibold text-slate-500">${formatDayHeader(day)}</div>
                <div class="text-sm font-bold ${dayIsToday ? 'text-blue-600' : 'text-slate-700'}">${day.getDate()}</div>
            </div>
        `;
    });
    html += '</div>';

    // Time slots rows
    timeSlots.forEach(time => {
        html += '<div class="grid grid-cols-8 border-b border-slate-100 hover:bg-slate-50 transition">';
        html += `<div class="p-3 text-sm text-slate-500 border-r border-slate-200 font-mono">${time}</div>`;

        weekDays.forEach(day => {
            html += '<div class="p-2 border-r border-slate-200 last:border-r-0">';

            // Render slots for each virtual setting
            virtualSettings.forEach((vs, idx) => {
                // Try to find slot by name/title mapping
                const slotKey = `${formatDateKey(day)}_${time}_${vs.name}`;
                const slotData = appointmentMap[slotKey];

                if (slotData) {
                    const { slot, total, remaining } = slotData;
                    const color = getSlotColor(slotData);
                    const availability = `${remaining}/${total}`;

                    html += `
                        <div onclick="openSlotDetails('${slot._id}')" class="${color} text-xs p-2 rounded mb-1 cursor-pointer hover:opacity-80 transition shadow-sm border">
                            <div class="font-medium truncate" title="${vs.name}">${vs.name || vs.title}</div>
                            <div class="text-xs opacity-75 flex justify-between items-center mt-1">
                                <span>${availability}</span>
                                ${slot.appointments?.length ? `<i class="fa-solid fa-user-check"></i>` : ''}
                            </div>
                        </div>
                    `;
                }
            });

            html += '</div>';
        });

        html += '</div>';
    });

    html += '</div>';
    return html;
}

/**
 * Get current week days (Monday to Sunday)
 * @returns {Array<Date>} Array of Date objects
 */
function getCurrentWeek() {
    const today = new Date();
    const dayOfWeek = today.getDay();
    const monday = new Date(today);
    monday.setDate(today.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));

    const week = [];
    for (let i = 0; i < 7; i++) {
        const day = new Date(monday);
        day.setDate(monday.getDate() + i);
        week.push(day);
    }
    return week;
}

/**
 * Generate time slots from 8:00 to 16:00
 * @returns {Array<string>} Array of time strings
 */
function generateTimeSlots() {
    const slots = [];
    for (let hour = 8; hour < 22; hour++) { // Extended to 22:00 to cover more slots
        slots.push(`${hour.toString().padStart(2, '0')}:00`);
    }
    return slots;
}

/**
 * Map appointments data to grid structure
 * @param {Object} appointmentsData - Appointments data from API
 * @param {Object} resource - Resource object
 * @returns {Object} Mapped appointments
 */
function mapAppointmentsToGrid(appointmentsData, resource) {
    const map = {};

    if (!appointmentsData || !appointmentsData.slots) return map;

    const virtualSettings = resource.virtualSettings ? Object.values(resource.virtualSettings) : [];

    appointmentsData.slots.forEach(slot => {
        const date = new Date(slot.start);
        const dateKey = formatDateKey(date);

        // Round down to nearest hour for grid placement
        const timeKey = `${date.getHours().toString().padStart(2, '0')}:00`;

        // Find matching virtual setting by index or title
        const vs = virtualSettings.find(v =>
            (slot.index !== undefined && v.index === slot.index) ||
            (slot.title && v.title && slot.title.toLowerCase() === v.title.toLowerCase()) ||
            (slot.title && v.name && slot.title.toLowerCase() === v.name.toLowerCase())
        );

        if (vs) {
            const key = `${dateKey}_${timeKey}_${vs.name}`;
            map[key] = {
                slot: slot, // Store full slot object
                total: slot.seats?.total || 1,
                remaining: slot.seats?.remaining || 0,
                appointments: slot.appointments || []
            };
        }
    });

    return map;
}

/**
 * Get slot color based on availability
 * @param {Object} slot - Slot data
 * @returns {string} Tailwind CSS classes
 */
function getSlotColor(slot) {
    if (!slot) return 'bg-green-100 text-green-700 border border-green-200';

    const { total, remaining } = slot;

    if (remaining === 0) {
        return 'bg-red-100 text-red-700 border border-red-200';
    } else if (remaining < total) {
        return 'bg-blue-100 text-blue-700 border border-blue-200';
    } else {
        return 'bg-green-100 text-green-700 border border-green-200';
    }
}

/**
 * Format date as key (YYYY-MM-DD)
 * @param {Date} date - Date object
 * @returns {string} Formatted date
 */
function formatDateKey(date) {
    return date.toISOString().split('T')[0];
}

/**
 * Format day header (e.g., "lun. 24/11")
 * @param {Date} date - Date object
 * @returns {string} Formatted string
 */
function formatDayHeader(date) {
    const days = ['dom.', 'lun.', 'mar.', 'mié.', 'jue.', 'vie.', 'sáb.'];
    const day = days[date.getDay()];
    const dateStr = `${date.getDate()}/${(date.getMonth() + 1).toString().padStart(2, '0')}`;
    return `${day} ${dateStr}`;
}

/**
 * Format week range (e.g., "24 – 30 de nov. de 2025")
 * @param {Array<Date>} weekDays - Array of days
 * @returns {string} Formatted string
 */
function formatWeekRange(weekDays) {
    const months = ['ene.', 'feb.', 'mar.', 'abr.', 'may.', 'jun.', 'jul.', 'ago.', 'sep.', 'oct.', 'nov.', 'dic.'];
    const start = weekDays[0];
    const end = weekDays[6];

    return `${start.getDate()} – ${end.getDate()} de ${months[end.getMonth()]} de ${end.getFullYear()}`;
}

/**
 * Check if date is today
 * @param {Date} date - Date to check
 * @returns {boolean} True if today
 */
function isToday(date) {
    const today = new Date();
    return date.toDateString() === today.toDateString();
}
