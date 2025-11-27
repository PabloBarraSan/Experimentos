// Calendar View Module - Handles the calendar view for appointments

import { fetchAppointments, getDateRange } from './api.js';

// Calendar State
const calendarState = {
    currentDate: new Date(),
    viewMode: 'week', // 'day', 'week', 'month'
    resource: null,
    container: null
};

// Expose navigation functions globally
window.calendar = {
    prevPeriod: () => {
        const days = calendarState.viewMode === 'week' ? 7 : 1;
        calendarState.currentDate.setDate(calendarState.currentDate.getDate() - days);
        refreshCalendar();
    },
    nextPeriod: () => {
        const days = calendarState.viewMode === 'week' ? 7 : 1;
        calendarState.currentDate.setDate(calendarState.currentDate.getDate() + days);
        refreshCalendar();
    },
    goToToday: () => {
        calendarState.currentDate = new Date();
        refreshCalendar();
    },
    changeView: (mode) => {
        calendarState.viewMode = mode;
        refreshCalendar();
    }
};

async function refreshCalendar() {
    if (calendarState.resource && calendarState.container) {
        await renderCalendarView(calendarState.resource, calendarState.container);
    }
}

/**
 * Render the complete calendar view for a resource
 * @param {Object} resource - Resource object
 * @param {HTMLElement} container - Container element
 */
export async function renderCalendarView(resource, container) {
    // Update state
    calendarState.resource = resource;
    calendarState.container = container;
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
 * Open sidebar for an empty slot
 * @param {string} dateStr - YYYY-MM-DD
 * @param {string} settingName - Virtual setting name
 * @param {string} startHour - Start hour HH:MM
 * @param {string} endHour - End hour HH:MM
 * @param {number} seats - Number of seats
 */
window.openEmptySlotDetails = function (dateStr, settingName, startHour, endHour, seats) {
    const sidebar = document.getElementById('slot-sidebar');
    const overlay = document.getElementById('sidebar-overlay');
    const content = document.getElementById('sidebar-content');

    // Populate content with a "New Reservation" style
    content.innerHTML = `
        <div class="bg-green-50 rounded-lg p-4 mb-4 border border-green-100">
            <h4 class="font-bold text-green-800 text-lg mb-1">Nuevo Turno: ${settingName}</h4>
            <div class="text-sm text-green-600 mb-2">
                <i class="fa-regular fa-calendar mr-2"></i>${new Date(dateStr).toLocaleDateString('es-ES', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
            </div>
            <div class="text-sm text-green-600 mb-2">
                <i class="fa-regular fa-clock mr-2"></i>${startHour} - ${endHour}
            </div>
            <div class="text-xs text-green-700 bg-green-100 rounded px-2 py-1 inline-block">
                <i class="fa-solid fa-users mr-1"></i>${seats || 0} plazas disponibles
            </div>
        </div>
        
        <div class="space-y-3">
            <button class="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition shadow-sm flex items-center justify-center gap-2">
                <i class="fa-solid fa-plus"></i>
                Crear Reserva
            </button>
            <button class="w-full py-3 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-lg font-medium transition shadow-sm flex items-center justify-center gap-2">
                <i class="fa-solid fa-lock"></i>
                Bloquear Slot
            </button>
        </div>
    `;

    // Show sidebar
    sidebar.classList.remove('translate-x-full');
    overlay.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
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

            // Extract extra fields
            const extraFields = app.extra || {};
            const extraInfo = Object.entries(extraFields)
                .map(([key, value]) => `<div class="text-xs text-slate-500"><span class="font-medium capitalize">${key}:</span> ${value}</div>`)
                .join('');

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
                    <div class="text-xs text-slate-500 space-y-1 mb-2">
                        <div class="flex items-center">
                            <i class="fa-solid fa-envelope w-4 text-center mr-2 opacity-70"></i>
                            ${app.user?.email || 'No email'}
                        </div>
                        <div class="flex items-center">
                            <i class="fa-solid fa-phone w-4 text-center mr-2 opacity-70"></i>
                            ${app.user?.telephone || 'No teléfono'}
                        </div>
                    </div>
                    
                    ${extraInfo ? `
                    <div class="bg-slate-50 p-2 rounded border border-slate-100 grid grid-cols-2 gap-1 mb-2">
                        ${extraInfo}
                    </div>
                    ` : ''}

                    <div class="text-xs text-slate-500 space-y-1 border-t border-slate-100 pt-2">
                         ${app.amount ? `
                        <div class="flex items-center justify-between">
                            <span class="flex items-center"><i class="fa-solid fa-euro-sign w-4 text-center mr-2 opacity-70"></i>Importe:</span>
                            <span class="font-medium">${(app.amount / 100).toFixed(2)}€</span>
                        </div>
                        ` : ''}
                        ${app.paymentId ? `
                        <div class="flex items-center justify-between" title="ID Pago: ${app.paymentId}">
                            <span class="flex items-center"><i class="fa-solid fa-receipt w-4 text-center mr-2 opacity-70"></i>Pagado:</span>
                            <span class="font-medium text-green-600">${app.isPaid ? 'Sí' : 'No'}</span>
                        </div>
                        ` : ''}
                        ${app.order ? `
                        <div class="flex items-center justify-between">
                            <span class="flex items-center"><i class="fa-solid fa-hashtag w-4 text-center mr-2 opacity-70"></i>Orden:</span>
                            <span class="font-medium">#${app.order}</span>
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
            <!-- Top Section: Title + Actions -->
            <div class="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 mb-6">
                <!-- Left: Resource Info -->
                <div class="flex items-center gap-4">
                    <div class="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center">
                        <i class="fa-solid fa-calendar-days text-xl text-blue-600"></i>
                    </div>
                    <div>
                        <h1 class="text-2xl font-bold text-slate-900">${resource.title || resource.name}</h1>
                        <p class="text-sm text-slate-500">Gestión de citas y horarios</p>
                    </div>
                </div>

                <!-- Right: Action Buttons -->
                <div class="flex flex-wrap gap-2">
                    <button onclick="app.backToAdmin()" 
                            class="px-4 py-2 bg-slate-50 hover:bg-slate-100 text-slate-700 rounded-lg transition font-medium text-sm border border-slate-200 flex items-center gap-2">
                        <i class="fa-solid fa-arrow-left"></i>
                        <span>Volver</span>
                    </button>
                    <button class="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition font-medium text-sm flex items-center gap-2 shadow-sm">
                        <i class="fa-solid fa-plus"></i>
                        <span class="hidden sm:inline">Nueva cita</span>
                    </button>
                    <button class="px-4 py-2 bg-white hover:bg-slate-50 text-slate-700 rounded-lg transition font-medium text-sm border border-slate-200 flex items-center gap-2">
                        <i class="fa-solid fa-calendar-plus"></i>
                        <span class="hidden sm:inline">Horarios</span>
                    </button>
                    <button class="px-4 py-2 bg-white hover:bg-slate-50 text-slate-700 rounded-lg transition font-medium text-sm border border-slate-200 flex items-center gap-2">
                        <i class="fa-solid fa-search"></i>
                        <span class="hidden sm:inline">Buscar</span>
                    </button>
                </div>
            </div>

            <!-- Bottom Section: Stats -->
            <div class="flex flex-wrap gap-3 pt-4 border-t border-slate-100">
                <div class="flex items-center gap-2 px-3 py-2 bg-slate-50 rounded-lg">
                    <i class="fa-solid fa-users text-slate-400"></i>
                    <div>
                        <div class="text-xs text-slate-500">Capacidad</div>
                        <div class="text-sm font-semibold text-slate-900">${resource.seats?.total || 0} plazas</div>
                    </div>
                </div>
                ${resource.maxAppointmentsPerUser ? `
                <div class="flex items-center gap-2 px-3 py-2 bg-slate-50 rounded-lg">
                    <i class="fa-solid fa-user-clock text-slate-400"></i>
                    <div>
                        <div class="text-xs text-slate-500">Máx. por usuario</div>
                        <div class="text-sm font-semibold text-slate-900">${resource.maxAppointmentsPerUser}</div>
                    </div>
                </div>` : ''}
                <div class="flex items-center gap-2 px-3 py-2 bg-slate-50 rounded-lg">
                    <i class="fa-solid fa-${resource.published ? 'check-circle text-green-500' : 'circle-pause text-slate-400'}"></i>
                    <div>
                        <div class="text-xs text-slate-500">Estado</div>
                        <div class="text-sm font-semibold text-slate-900">${resource.published ? 'Activo' : 'Pausado'}</div>
                    </div>
                </div>
                <div class="flex items-center gap-2 px-3 py-2 bg-green-50 rounded-lg">
                    <i class="fa-solid fa-credit-card text-green-600"></i>
                    <div>
                        <div class="text-xs text-green-600">Pago online</div>
                        <div class="text-sm font-semibold text-green-700">Habilitado</div>
                    </div>
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
    // Toolbar is now integrated into the header
    return '';
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
                    <button onclick="window.calendar.goToToday()" class="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition font-medium text-sm">
                        Hoy
                    </button>
                    <div class="flex gap-1">
                        <button onclick="window.calendar.prevPeriod()" class="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-l-lg transition">
                            <i class="fa-solid fa-chevron-left"></i>
                        </button>
                        <button onclick="window.calendar.nextPeriod()" class="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-r-lg transition">
                            <i class="fa-solid fa-chevron-right"></i>
                        </button>
                    </div>
                    <div class="flex gap-1">
                        <button onclick="window.calendar.changeView('day')" class="${calendarState.viewMode === 'day' ? 'bg-blue-600 text-white' : 'bg-slate-100 hover:bg-slate-200 text-slate-700'} px-4 py-2 rounded-lg transition font-medium text-sm">
                            Día
                        </button>
                        <button onclick="window.calendar.changeView('week')" class="${calendarState.viewMode === 'week' ? 'bg-blue-600 text-white' : 'bg-slate-100 hover:bg-slate-200 text-slate-700'} px-4 py-2 rounded-lg transition font-medium text-sm">
                            Semana
                        </button>
                        <button onclick="window.calendar.changeView('month')" class="${calendarState.viewMode === 'month' ? 'bg-blue-600 text-white' : 'bg-slate-100 hover:bg-slate-200 text-slate-700'} px-4 py-2 rounded-lg transition font-medium text-sm">
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
    let virtualSettings = resource.virtualSettings ? Object.values(resource.virtualSettings) : [];

    // Fallback: If no virtual settings, try to infer from data or use a default
    if (virtualSettings.length === 0 && appointmentsData && appointmentsData.slots) {
        const uniqueTitles = new Set();
        appointmentsData.slots.forEach(slot => {
            if (slot.title) uniqueTitles.add(slot.title);
        });

        if (uniqueTitles.size > 0) {
            virtualSettings = Array.from(uniqueTitles).map(title => ({
                name: title,
                title: title
            }));
            virtualSettings = Array.from(uniqueTitles).map(title => ({
                name: title,
                title: title
            }));
        }

    }

    const timeSlots = generateTimeSlots(appointmentsData, resource);

    // Map appointments to a lookup structure
    const appointmentMap = mapAppointmentsToGrid(appointmentsData, resource, weekDays);

    let html = '<div class="min-w-[800px]">';

    // Header row with days
    html += '<div class="grid grid-cols-8 border-b-2 border-slate-300 bg-slate-50">';
    html += '<div class="p-3 text-sm font-semibold text-slate-500 border-r border-slate-200">Hora</div>';

    weekDays.forEach(day => {
        const dayIsToday = isToday(day);
        const dayKey = formatDateKey(day);
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
            html += '<div class="p-2 border-r border-slate-200 last:border-r-0 relative" style="min-height: 40px;">';

            // Track which virtual settings have been rendered as real slots
            const renderedVirtualSettings = new Set();

            // First pass: Render all real slots (with appointments) for this day/time
            virtualSettings.forEach((vs, idx) => {
                // Check all the filters (date range, day of week, exceptions, time overlap)
                // 1. Check Date Range (from/until)
                if (vs.from && vs.until) {
                    const vsFrom = new Date(vs.from);
                    const vsUntil = new Date(vs.until);
                    vsFrom.setHours(0, 0, 0, 0);
                    vsUntil.setHours(23, 59, 59, 999);
                    const currentDay = new Date(day);
                    currentDay.setHours(12, 0, 0, 0);

                    if (currentDay < vsFrom || currentDay > vsUntil) {
                        return;
                    }
                }

                // 2. Check Day of Week (days array)
                if (vs.days && Array.isArray(vs.days)) {
                    const currentDayOfWeek = day.getDay();
                    if (!vs.days.includes(currentDayOfWeek)) {
                        return;
                    }
                }

                // 2.5 Check Exceptions (Holidays/Special Days)
                if (vs.exceptions && Array.isArray(vs.exceptions)) {
                    const isException = vs.exceptions.some(ex => {
                        const exFrom = new Date(ex.from);
                        const exUntil = new Date(ex.until);
                        exFrom.setHours(0, 0, 0, 0);
                        exUntil.setHours(23, 59, 59, 999);

                        const currentDay = new Date(day);
                        currentDay.setHours(12, 0, 0, 0);

                        if (currentDay >= exFrom && currentDay <= exUntil) {
                            if (ex.seats === 0) return true;
                        }
                        return false;
                    });

                    if (isException) {
                        return;
                    }
                }

                // 3. Check Time Overlap
                const vsStart = vs.startHour || "00:00";
                const vsEnd = vs.endHour || "23:59";

                const rowStart = time;
                const [rowHour, rowMin] = time.split(':').map(Number);
                const rowEndMinutes = rowHour * 60 + rowMin + 30;
                const rowEndHour = Math.floor(rowEndMinutes / 60);
                const rowEndMin = rowEndMinutes % 60;
                const rowEnd = `${rowEndHour.toString().padStart(2, '0')}:${rowEndMin.toString().padStart(2, '0')}`;

                if (!checkTimeOverlap(rowStart, rowEnd, vsStart, vsEnd)) {
                    return;
                }

                // Check if this row contains the start time of the slot
                const toMinutes = (t) => {
                    const [h, m] = t.split(':').map(Number);
                    return h * 60 + m;
                };

                const rStartMin = toMinutes(rowStart);
                const rEndMin = toMinutes(rowEnd);
                const vsStartMin = toMinutes(vsStart);

                if (!(rStartMin <= vsStartMin && vsStartMin < rEndMin)) {
                    return;
                }

                // Try to find real slots at this date/time
                const slotKey = `${formatDateKey(day)}_${time}`;
                const slotsAtTime = appointmentMap[slotKey] || [];

                // Find if this virtual setting has a real slot at this time
                const slotData = slotsAtTime.find(s => {
                    // Match by index or title
                    if (s.vs.index === vs.index) return true;
                    const slotTitle = (s.slot.title || '').toLowerCase().trim();
                    const vsTitle = (vs.title || '').toLowerCase().trim();
                    return slotTitle === vsTitle;
                });

                // Debug: log what we're looking for
                if (formatDateKey(day) === '2025-11-24' || formatDateKey(day) === '2025-11-26') {
                    console.log(`DEBUG: Looking for key: ${slotKey} | Slots at time: ${slotsAtTime.length} | Matched:`, !!slotData);
                }

                if (slotData) {
                    // Mark this virtual setting as rendered
                    renderedVirtualSettings.add(vs.name);

                    // Render occupied slot (real slot with appointments)
                    const { slot, total, remaining } = slotData;
                    const color = getSlotColor(slotData);
                    const availability = `${remaining}/${total}`;

                    // Calculate duration in minutes for height
                    const slotStart = new Date(slot.start);
                    const slotEnd = new Date(slot.end);
                    const durationMinutes = (slotEnd - slotStart) / (1000 * 60);
                    const heightMultiplier = durationMinutes / 30;
                    const slotHeight = heightMultiplier * 40;

                    html += `
                        <div onclick="openSlotDetails('${slot._id}')"
                             class="${color} text-xs p-2 rounded cursor-pointer hover:opacity-80 transition shadow-sm border absolute top-0 left-2 right-2"
                             style="height: ${slotHeight}px; z-index: 10;">
                            <div class="font-medium truncate" title="${vs.name}">${vs.name || vs.title}</div>
                            <div class="text-xs opacity-75 flex justify-between items-center mt-1">
                                <span>${availability}</span>
                                ${slot.appointments?.length ? `<i class="fa-solid fa-user-check"></i>` : ''}
                            </div>
                            <div class="text-xs opacity-60 mt-1">${vs.startHour} - ${vs.endHour}</div>
                        </div>
                    `;
                }
            });

            // Second pass: Render virtual settings (empty slots) only if not already rendered as real slots
            virtualSettings.forEach((vs, idx) => {
                // Skip if already rendered as a real slot
                if (renderedVirtualSettings.has(vs.name)) {
                    return;
                }

                // Apply same filters as before
                if (vs.from && vs.until) {
                    const vsFrom = new Date(vs.from);
                    const vsUntil = new Date(vs.until);
                    vsFrom.setHours(0, 0, 0, 0);
                    vsUntil.setHours(23, 59, 59, 999);
                    const currentDay = new Date(day);
                    currentDay.setHours(12, 0, 0, 0);

                    if (currentDay < vsFrom || currentDay > vsUntil) {
                        return;
                    }
                }

                if (vs.days && Array.isArray(vs.days)) {
                    const currentDayOfWeek = day.getDay();
                    if (!vs.days.includes(currentDayOfWeek)) {
                        return;
                    }
                }

                if (vs.exceptions && Array.isArray(vs.exceptions)) {
                    const isException = vs.exceptions.some(ex => {
                        const exFrom = new Date(ex.from);
                        const exUntil = new Date(ex.until);
                        exFrom.setHours(0, 0, 0, 0);
                        exUntil.setHours(23, 59, 59, 999);

                        const currentDay = new Date(day);
                        currentDay.setHours(12, 0, 0, 0);

                        if (currentDay >= exFrom && currentDay <= exUntil) {
                            if (ex.seats === 0) return true;
                        }
                        return false;
                    });

                    if (isException) {
                        return;
                    }
                }

                const vsStart = vs.startHour || "00:00";
                const vsEnd = vs.endHour || "23:59";

                const rowStart = time;
                const [rowHour, rowMin] = time.split(':').map(Number);
                const rowEndMinutes = rowHour * 60 + rowMin + 30;
                const rowEndHour = Math.floor(rowEndMinutes / 60);
                const rowEndMin = rowEndMinutes % 60;
                const rowEnd = `${rowEndHour.toString().padStart(2, '0')}:${rowEndMin.toString().padStart(2, '0')}`;

                if (!checkTimeOverlap(rowStart, rowEnd, vsStart, vsEnd)) {
                    return;
                }

                const toMinutes = (t) => {
                    const [h, m] = t.split(':').map(Number);
                    return h * 60 + m;
                };

                const rStartMin = toMinutes(rowStart);
                const rEndMin = toMinutes(rowEnd);
                const vsStartMin = toMinutes(vsStart);

                if (!(rStartMin <= vsStartMin && vsStartMin < rEndMin)) {
                    return;
                }

                // Render available (empty) slot
                const dateStr = formatDateKey(day);
                const startHour = vs.startHour || '00:00';
                const endHour = vs.endHour || '23:59';
                const seats = vs.seats || 0;
                const settingName = (vs.name || vs.title || '').replace(/'/g, "\\'");

                // Calculate duration for height
                const [startH, startM] = startHour.split(':').map(Number);
                const [endH, endM] = endHour.split(':').map(Number);
                const durationMinutes = (endH * 60 + endM) - (startH * 60 + startM);
                const heightMultiplier = durationMinutes / 30;
                const slotHeight = heightMultiplier * 40;

                html += `
                    <div onclick="openEmptySlotDetails('${dateStr}', '${settingName}', '${startHour}', '${endHour}', ${seats})"
                         class="bg-slate-50 border border-slate-100 text-xs p-2 rounded hover:bg-green-50 hover:border-green-200 transition cursor-pointer group absolute top-0 left-2 right-2"
                         style="height: ${slotHeight}px; z-index: 10;">
                        <div class="text-slate-400 group-hover:text-green-600 font-medium truncate">${vs.name}</div>
                        <div class="text-xs text-slate-300 group-hover:text-green-500 mt-1">Disponible</div>
                        <div class="text-xs text-slate-400 group-hover:text-green-500 mt-1">${startHour} - ${endHour}</div>
                    </div>
                `;
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
    const today = new Date(calendarState.currentDate);
    const dayOfWeek = today.getDay();
    const monday = new Date(today);
    monday.setDate(today.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));

    const week = [];
    // If view mode is day, just return that day
    if (calendarState.viewMode === 'day') {
        week.push(today);
    } else {
        // Default to week view
        for (let i = 0; i < 7; i++) {
            const day = new Date(monday);
            day.setDate(monday.getDate() + i);
            week.push(day);
        }
    }
    return week;
}

/**
 * Generate time slots based on actual slot times in the data
 * @param {Object} appointmentsData - Appointments data
 * @param {Object} resource - Resource object
 * @returns {Array<string>} Array of time strings in 30-min intervals
 */
function generateTimeSlots(appointmentsData, resource) {
    const virtualSettings = resource.virtualSettings ? Object.values(resource.virtualSettings) : [];

    // Collect all start and end times
    const times = new Set();

    // Add times from virtual settings
    virtualSettings.forEach(vs => {
        if (vs.startHour) times.add(vs.startHour);
        if (vs.endHour) times.add(vs.endHour);
    });

    // Add times from actual slots
    if (appointmentsData && appointmentsData.slots) {
        appointmentsData.slots.forEach(slot => {
            const start = new Date(slot.start);
            const end = new Date(slot.end);
            const startTime = `${start.getHours().toString().padStart(2, '0')}:${start.getMinutes().toString().padStart(2, '0')}`;
            const endTime = `${end.getHours().toString().padStart(2, '0')}:${end.getMinutes().toString().padStart(2, '0')}`;
            times.add(startTime);
            times.add(endTime);
        });
    }

    if (times.size === 0) {
        // Fallback to default range
        times.add('08:00');
        times.add('14:00');
    }

    // Convert to minutes for sorting
    const toMinutes = (time) => {
        const [h, m] = time.split(':').map(Number);
        return h * 60 + m;
    };

    const timeArray = Array.from(times).sort((a, b) => toMinutes(a) - toMinutes(b));
    const minTime = toMinutes(timeArray[0]);
    const maxTime = toMinutes(timeArray[timeArray.length - 1]);

    // Generate 30-minute intervals from min to max
    const slots = [];
    for (let minutes = minTime; minutes <= maxTime; minutes += 30) {
        const hours = Math.floor(minutes / 60);
        const mins = minutes % 60;
        slots.push(`${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`);
    }

    return slots;
}

/**
 * Map appointments data to grid structure
 * @param {Object} appointmentsData - Appointments data from API
 * @param {Object} resource - Resource object
 * @returns {Object} Mapped appointments
 */
function mapAppointmentsToGrid(appointmentsData, resource, visibleDays = []) {
    const map = {};

    if (!appointmentsData || !appointmentsData.slots) return map;

    const virtualSettings = resource.virtualSettings ? Object.values(resource.virtualSettings) : [];

    appointmentsData.slots.forEach(slot => {
        const date = new Date(slot.start);

        // Check if slot is in visible days for debugging
        const isVisible = visibleDays.some(d => d.toDateString() === date.toDateString());
        if (isVisible) {
            console.log(`DEBUG: Processing slot: ${slot.title} at ${date.toLocaleString()}`);
            console.log(`DEBUG: Slot Key: ${formatDateKey(date)}`);
        }

        const dateKey = formatDateKey(date);

        // Use exact time with 30-minute precision for grid placement
        const hours = date.getHours();
        const minutes = date.getMinutes();
        const roundedMinutes = minutes < 30 ? '00' : '30';
        const timeKey = `${hours.toString().padStart(2, '0')}:${roundedMinutes}`;

        // Find matching virtual setting by index or title
        const vs = virtualSettings.find(v => {
            // Match by index
            if (slot.index !== undefined && v.index === slot.index) return true;

            // Match by title/name (case insensitive, trimmed)
            const slotTitle = (slot.title || '').toLowerCase().trim();
            const vTitle = (v.title || '').toLowerCase().trim();
            const vName = (v.name || '').toLowerCase().trim();

            return (slotTitle && (slotTitle === vTitle || slotTitle === vName));
        });

        if (vs) {
            // Use date+time as key (no title needed)
            const key = `${dateKey}_${timeKey}`;

            if (isVisible) {
                console.log(`DEBUG: Creating map key: ${key}`);
                console.log(`DEBUG: Slot:`, slot.title, `| VS: ${vs.name} | timeKey: ${timeKey}`);
            }

            // Store by date+time, can have multiple slots at same time
            if (!map[key]) {
                map[key] = [];
            }
            map[key].push({
                slot: slot,
                total: slot.seats?.total || 1,
                remaining: slot.seats?.remaining || 0,
                appointments: slot.appointments || [],
                vs: vs // Store the matching virtual setting
            });
        } else if (isVisible) {
            console.log(`DEBUG: No VS match for slot:`, slot.title, `index: ${slot.index}`);
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
/**
 * Check if date is today
 * @param {Date} date - Date to check
 * @returns {boolean} True if today
 */
function isToday(date) {
    const today = new Date();
    return date.toDateString() === today.toDateString();
}

/**
 * Check if two time ranges overlap
 * @param {string} start1 - HH:MM
 * @param {string} end1 - HH:MM
 * @param {string} start2 - HH:MM
 * @param {string} end2 - HH:MM
 * @returns {boolean} True if overlap
 */
function checkTimeOverlap(start1, end1, start2, end2) {
    const toMinutes = (time) => {
        const [h, m] = time.split(':').map(Number);
        return h * 60 + m;
    };

    const s1 = toMinutes(start1);
    const e1 = toMinutes(end1);
    const s2 = toMinutes(start2);
    const e2 = toMinutes(end2);

    return Math.max(s1, s2) < Math.min(e1, e2);
}
