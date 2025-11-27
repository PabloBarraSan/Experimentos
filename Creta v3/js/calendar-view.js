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
        if (calendarState.viewMode === 'month') {
            calendarState.currentDate.setMonth(calendarState.currentDate.getMonth() - 1);
        } else if (calendarState.viewMode === 'week') {
            calendarState.currentDate.setDate(calendarState.currentDate.getDate() - 7);
        } else {
            calendarState.currentDate.setDate(calendarState.currentDate.getDate() - 1);
        }
        refreshCalendar();
    },
    nextPeriod: () => {
        if (calendarState.viewMode === 'month') {
            calendarState.currentDate.setMonth(calendarState.currentDate.getMonth() + 1);
        } else if (calendarState.viewMode === 'week') {
            calendarState.currentDate.setDate(calendarState.currentDate.getDate() + 7);
        } else {
            calendarState.currentDate.setDate(calendarState.currentDate.getDate() + 1);
        }
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

// Quick Actions Handlers
window.handleSearchAppointments = function() {
    // TODO: Implementar búsqueda de citas
    console.log('Buscar citas');
};

window.handleManageSchedules = function() {
    // TODO: Implementar gestión de horarios
    console.log('Gestionar horarios');
};

window.handleCloneWeek = function() {
    // TODO: Implementar clonar semana
    console.log('Clonar Semana');
};

window.handleDeleteWeek = function() {
    // TODO: Implementar eliminar semana
    console.log('Eliminar Semana');
};

// Slot Actions Handlers
window.handleReserveSlot = function(slotId) {
    // TODO: Implementar reservar slot
    console.log('Reservar slot:', slotId);
};

window.handleMoreInfo = function(slotId) {
    // TODO: Implementar más información del slot
    console.log('Más info slot:', slotId);
};

window.handleDeleteSlot = function(slotId) {
    // TODO: Implementar eliminar slot
    if (confirm('¿Estás seguro de que quieres eliminar este slot?')) {
        console.log('Eliminar slot:', slotId);
    }
};

// Reservation Actions Handlers
window.handleReservationInfo = function(reservationId) {
    // TODO: Implementar información de reserva
    console.log('Info reserva:', reservationId);
};

window.handleEditReservation = function(reservationId) {
    // TODO: Implementar editar reserva
    console.log('Editar reserva:', reservationId);
};

window.handlePrintReservation = function(reservationId) {
    // TODO: Implementar imprimir reserva
    console.log('Imprimir reserva:', reservationId);
};

window.handleReservationNotes = function(reservationId) {
    // TODO: Implementar notas de reserva
    console.log('Notas reserva:', reservationId);
};

window.handleSendMessage = function(reservationId) {
    // TODO: Implementar enviar mensaje
    console.log('Enviar mensaje reserva:', reservationId);
};

window.handleCancelReservation = function(reservationId) {
    // TODO: Implementar cancelar reserva
    if (confirm('¿Estás seguro de que quieres cancelar esta reserva?')) {
        console.log('Cancelar reserva:', reservationId);
    }
};

// Toggle reservation card expand/collapse
window.toggleReservation = function(reservationId) {
    const content = document.getElementById(reservationId);
    const chevron = document.getElementById(`chevron-${reservationId}`);
    
    if (content && chevron) {
        const isHidden = content.classList.contains('hidden');
        
        if (isHidden) {
            content.classList.remove('hidden');
            chevron.classList.remove('fa-chevron-down');
            chevron.classList.add('fa-chevron-up');
        } else {
            content.classList.add('hidden');
            chevron.classList.remove('fa-chevron-up');
            chevron.classList.add('fa-chevron-down');
        }
    }
};

// Filter reservations by search text
window.filterReservations = function(slotId) {
    const searchInput = document.getElementById(`reservation-search-${slotId}`);
    const container = document.getElementById(`reservations-container-${slotId}`);
    
    if (!searchInput || !container) return;
    
    const searchText = searchInput.value.toLowerCase().trim();
    const reservationCards = container.querySelectorAll('.reservation-card');
    
    reservationCards.forEach(card => {
        const searchableText = card.getAttribute('data-search-text') || '';
        if (searchableText.includes(searchText)) {
            card.style.display = '';
        } else {
            card.style.display = 'none';
        }
    });
};

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

    // Add Escape key listener
    window.sidebarEscapeHandler = function(e) {
        if (e.key === 'Escape') {
            window.closeSidebar();
        }
    };
    document.addEventListener('keydown', window.sidebarEscapeHandler);
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

    // Remove Escape key listener
    if (window.sidebarEscapeHandler) {
        document.removeEventListener('keydown', window.sidebarEscapeHandler);
        window.sidebarEscapeHandler = null;
    }
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

    // Add Escape key listener
    window.sidebarEscapeHandler = function(e) {
        if (e.key === 'Escape') {
            window.closeSidebar();
        }
    };
    document.addEventListener('keydown', window.sidebarEscapeHandler);
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
        
        <!-- Search Box -->
        <div class="mb-3">
            <div class="relative">
                <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <i class="fa-solid fa-magnifying-glass text-slate-400 text-sm"></i>
                </div>
                <input type="text" 
                       id="reservation-search-${slot._id}" 
                       onkeyup="filterReservations('${slot._id}')"
                       placeholder="Buscar reservas..." 
                       class="block w-full pl-10 pr-3 py-2 border border-slate-300 rounded-lg text-sm bg-white placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 transition">
            </div>
        </div>
        
        <!-- Reservas con scroll -->
        <div id="reservations-container-${slot._id}" class="bg-white rounded-lg border border-slate-200 p-3 mb-4 max-h-[500px] overflow-y-auto">
    `;

    if (!slot.appointments || slot.appointments.length === 0) {
        html += `
            <div class="text-center py-8 text-slate-400">
                <i class="fa-regular fa-calendar-xmark text-3xl mb-2"></i>
                <p>No hay reservas en este slot</p>
            </div>
        `;
    } else {
        html += '<div class="space-y-3">';
        slot.appointments.forEach((app, index) => {
            const statusColor = app.confirmed ? 'green' : 'orange';
            const statusText = app.confirmed ? 'Confirmada' : 'Pendiente';
            const reservationNumber = index + 1;
            const reservationDate = new Date(app.start || slot.start);
            const formattedDate = reservationDate.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' });
            const formattedTime = reservationDate.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
            
            // Extract extra fields and ensure values are strings
            const extraFields = app.extra || {};
            const origin = typeof app.origin === 'string' ? app.origin : (app.origin?.name || app.origin?.title || 'web');

            const reservationId = `reservation-${app._id || index}`;
            const searchableText = `${app.user?.firstName || ''} ${app.user?.lastName || ''} ${app.user?.email || ''} ${app.user?.telephone || ''} ${origin}`.toLowerCase();
            html += `
                <div class="reservation-card bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden" data-search-text="${searchableText.replace(/"/g, '&quot;')}">
                    <!-- Top Section: Badges and Info -->
                    <div onclick="toggleReservation('${reservationId}')" class="bg-blue-50/30 px-3 py-2 border-b border-slate-200 cursor-pointer hover:bg-blue-50/50 transition">
                        <!-- First row: Badges -->
                        <div class="flex items-center justify-between mb-2">
                            <div class="flex items-center gap-2">
                                <div class="w-8 h-8 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-sm">
                                    ${reservationNumber}
                                </div>
                                <span class="px-2 py-0.5 rounded text-xs font-medium ${app.confirmed ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'}">
                                    ${statusText}
                                </span>
                                <span class="px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-700 flex items-center gap-1">
                                    <i class="fa-solid fa-users text-xs"></i>
                                    ${app.seats || 1}
                                </span>
                            </div>
                            <i id="chevron-${reservationId}" class="fa-solid fa-chevron-down text-slate-400 text-xs transition-transform"></i>
                        </div>
                        <!-- Second row: Name and origin (always visible) -->
                        <div class="flex items-center justify-between">
                            <div class="flex items-center gap-2">
                                <i class="fa-solid fa-user text-slate-400 text-xs"></i>
                                <h5 class="font-semibold text-slate-800 text-sm m-0">
                                    ${app.user?.firstName || 'Usuario'} ${app.user?.lastName || ''}
                                </h5>
                            </div>
                            <span class="px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-700">
                                ${origin}
                            </span>
                        </div>
                    </div>
                    
                    <!-- Bottom Section: Details (Collapsed by default) -->
                    <div id="${reservationId}" class="hidden p-3">
                        
                        <!-- Info List -->
                        <div class="space-y-2 mb-3 text-xs">
                            <div>
                                <div class="font-medium text-slate-500 mb-0.5">Fecha de la reserva</div>
                                <div class="text-slate-700">${formattedDate} ${formattedTime}</div>
                            </div>
                            <div>
                                <div class="font-medium text-slate-500 mb-0.5">Nombre</div>
                                <div class="text-slate-700">${app.user?.firstName || '-'}</div>
                            </div>
                            <div>
                                <div class="font-medium text-slate-500 mb-0.5">Apellidos</div>
                                <div class="text-slate-700">${app.user?.lastName || '-'}</div>
                            </div>
                            <div>
                                <div class="font-medium text-slate-500 mb-0.5">Correo Electrónico</div>
                                <div class="text-slate-700">${app.user?.email || 'No email'}</div>
                            </div>
                            <div>
                                <div class="font-medium text-slate-500 mb-0.5">Teléfono</div>
                                <div class="text-slate-700">${app.user?.telephone || 'No teléfono'}</div>
                            </div>
                            ${Object.entries(extraFields).map(([key, value]) => {
                                // Convert value to string, handling objects
                                const displayValue = typeof value === 'object' && value !== null 
                                    ? (value.name || value.title || JSON.stringify(value))
                                    : String(value || '-');
                                return `
                            <div>
                                <div class="font-medium text-slate-500 mb-0.5">${key.charAt(0).toUpperCase() + key.slice(1)}</div>
                                <div class="text-slate-700">${displayValue}</div>
                            </div>
                            `;
                            }).join('')}
                        </div>
                    </div>
                    
                    <!-- Action Buttons (Always visible) -->
                    <div class="flex flex-wrap gap-1 p-2 border-t border-slate-200 bg-slate-50/50">
                        <button onclick="handleReservationInfo('${app._id}')" 
                                class="p-1.5 text-slate-600 hover:text-blue-600 hover:bg-blue-50 rounded transition" 
                                title="Información">
                            <i class="fa-solid fa-info-circle text-xs"></i>
                        </button>
                        <button onclick="handleEditReservation('${app._id}')" 
                                class="p-1.5 text-slate-600 hover:text-blue-600 hover:bg-blue-50 rounded transition" 
                                title="Editar reserva">
                            <i class="fa-solid fa-edit text-xs"></i>
                        </button>
                        <button onclick="handlePrintReservation('${app._id}')" 
                                class="p-1.5 text-slate-600 hover:text-blue-600 hover:bg-blue-50 rounded transition" 
                                title="Imprimir la reserva">
                            <i class="fa-solid fa-print text-xs"></i>
                        </button>
                        <button onclick="handleReservationNotes('${app._id}')" 
                                class="p-1.5 text-slate-600 hover:text-yellow-600 hover:bg-yellow-50 rounded transition" 
                                title="Notas">
                            <i class="fa-solid fa-sticky-note text-xs"></i>
                        </button>
                        <button onclick="handleSendMessage('${app._id}')" 
                                class="p-1.5 text-slate-600 hover:text-blue-600 hover:bg-blue-50 rounded transition" 
                                title="Enviar un mensaje">
                            <i class="fa-solid fa-comments text-xs"></i>
                        </button>
                        <button onclick="handleCancelReservation('${app._id}')" 
                                class="p-1.5 text-slate-600 hover:text-red-600 hover:bg-red-50 rounded transition ml-auto" 
                                title="Cancelar">
                            <i class="fa-solid fa-trash text-xs"></i>
                        </button>
                    </div>
                </div>
            `;
        });
        html += '</div>';
    }
    
    html += `
        </div>
        
        <!-- Action Buttons -->
        <div class="flex flex-col gap-2 pt-2 border-t border-slate-200">
            <button onclick="handleReserveSlot('${slot._id}')" 
                    class="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition shadow-sm flex items-center justify-center gap-2">
                <i class="fa-solid fa-plus"></i>
                Reservar
            </button>
            <button onclick="handleMoreInfo('${slot._id}')" 
                    class="w-full py-2.5 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-lg font-medium transition shadow-sm flex items-center justify-center gap-2">
                <i class="fa-solid fa-info-circle"></i>
                Más info
            </button>
            <button onclick="handleDeleteSlot('${slot._id}')" 
                    class="w-full py-2.5 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 rounded-lg font-medium transition shadow-sm flex items-center justify-center gap-2">
                <i class="fa-solid fa-trash"></i>
                Eliminar
            </button>
        </div>
    `;

    return html;
}


/**
 * Render the calendar header with resource information
 * @param {Object} resource - Resource object
 * @returns {string} HTML string
 */
function renderCalendarHeader(resource) {
    const resourceName = resource.title || resource.name || 'Recurso';
    const groupName = resource.subtitle || '';
    const imgUrl = resource.photo ? `${resource.photo}?w=80&h=80&thumbnail=true` : null;
    
    return `
        <!-- Main Header Card -->
        <div class="bg-white rounded-lg border border-slate-200 mb-6">
            <div class="px-6 py-4">
                <!-- Top Row: Title and Action Buttons -->
                <div class="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-4">
                    <div class="flex-1 flex items-start gap-3">
                        ${imgUrl ? `
                        <img src="${imgUrl}" 
                             alt="${resourceName}" 
                             class="w-12 h-12 rounded-full object-cover border-2 border-slate-200 shadow-sm flex-shrink-0"
                             onerror="this.style.display='none'">
                        ` : ''}
                        <div class="flex-1">
                            <h1 class="text-xl font-semibold text-slate-900">${resourceName}</h1>
                            ${groupName ? `<p class="text-sm text-slate-500 mt-1">${groupName}</p>` : ''}
                            <!-- Stats Pills - Below title for better association -->
                            <div class="flex flex-wrap items-center gap-2 mt-3">
                                <span class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200">
                                    <i class="fa-solid fa-users text-xs"></i>
                                    Capacidad: ${resource.seats?.total || 0}
                                </span>
                                ${resource.maxAppointmentsPerUser ? `
                                <span class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-purple-50 text-purple-700 border border-purple-200">
                                    <i class="fa-solid fa-user-clock text-xs"></i>
                                    Máx. usuario: ${resource.maxAppointmentsPerUser}
                                </span>
                                ` : ''}
                                <span class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium ${resource.published ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-slate-50 text-slate-600 border border-slate-200'}">
                                    <i class="fa-solid fa-${resource.published ? 'check-circle' : 'circle-pause'} text-xs"></i>
                                    ${resource.published ? 'Activo' : 'Pausado'}
                                </span>
                            </div>
                        </div>
                    </div>
                    
                    <!-- Quick Actions - Top right, more visible -->
                    <div class="flex flex-wrap items-center gap-2">
                        <button onclick="handleSearchAppointments()" 
                                class="group inline-flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-medium bg-white hover:bg-orange-50 text-slate-700 hover:text-orange-700 border border-slate-200 hover:border-orange-300 transition-all shadow-sm hover:shadow">
                            <i class="fa-solid fa-search text-sm text-orange-600 group-hover:scale-110 transition-transform"></i>
                            <span>Buscar citas</span>
                        </button>
                        <button onclick="handleManageSchedules()" 
                                class="group inline-flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-medium bg-white hover:bg-purple-50 text-slate-700 hover:text-purple-700 border border-slate-200 hover:border-purple-300 transition-all shadow-sm hover:shadow">
                            <i class="fa-solid fa-calendar text-sm text-purple-600 group-hover:scale-110 transition-transform"></i>
                            <span>Gestionar horarios</span>
                        </button>
                        <button id="1" onclick="handleCloneWeek()" 
                                class="group inline-flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-medium bg-white hover:bg-teal-50 text-slate-700 hover:text-teal-700 border border-slate-200 hover:border-teal-300 transition-all shadow-sm hover:shadow">
                            <i class="fa-solid fa-clone text-sm text-teal-600 group-hover:scale-110 transition-transform"></i>
                            <span>Clonar Semana</span>
                        </button>
                        <button id="2" onclick="handleDeleteWeek()" 
                                class="group inline-flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-medium bg-white hover:bg-red-50 text-slate-700 hover:text-red-700 border border-slate-200 hover:border-red-300 transition-all shadow-sm hover:shadow">
                            <i class="fa-solid fa-trash text-sm text-red-600 group-hover:scale-110 transition-transform"></i>
                            <span>Eliminar Semana</span>
                        </button>
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
    const isToday = calendarState.viewMode === 'day' && 
                    calendarState.currentDate.toDateString() === new Date().toDateString();

    return `
        <div class="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <!-- Calendar Toolbar - Improved -->
            <div class="px-6 py-4 bg-slate-50 border-b border-slate-200">
                <div class="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
                    <!-- Left: Navigation + View Mode Toggle + Today Button -->
                    <div class="flex flex-wrap items-center gap-2">
                        <!-- Navigation Controls -->
                        <div class="flex items-center gap-1 bg-white rounded-lg p-1 border border-slate-200 shadow-sm">
                            <button onclick="window.calendar.prevPeriod()" 
                                    class="px-3 py-2 text-slate-600 hover:bg-slate-50 rounded-md transition" 
                                    title="Anterior">
                                <i class="fa-solid fa-chevron-left"></i>
                            </button>
                            <button onclick="window.calendar.nextPeriod()" 
                                    class="px-3 py-2 text-slate-600 hover:bg-slate-50 rounded-md transition" 
                                    title="Siguiente">
                                <i class="fa-solid fa-chevron-right"></i>
                            </button>
                        </div>
                        
                        <!-- View Mode Toggle -->
                        <div class="flex items-center bg-white rounded-lg p-1 border border-slate-200 shadow-sm">
                            <button onclick="window.calendar.changeView('day')" 
                                    class="${calendarState.viewMode === 'day' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-50'} px-3 py-1.5 rounded-md transition font-medium text-sm">
                                <i class="fa-solid fa-calendar-day mr-1.5"></i>Día
                            </button>
                            <button onclick="window.calendar.changeView('week')" 
                                    class="${calendarState.viewMode === 'week' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-50'} px-3 py-1.5 rounded-md transition font-medium text-sm">
                                <i class="fa-solid fa-calendar-week mr-1.5"></i>Semana
                            </button>
                            <button onclick="window.calendar.changeView('month')" 
                                    class="${calendarState.viewMode === 'month' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-50'} px-3 py-1.5 rounded-md transition font-medium text-sm">
                                <i class="fa-solid fa-calendar-days mr-1.5"></i>Mes
                            </button>
                        </div>
                        
                        <!-- Today Button -->
                        <button onclick="window.calendar.goToToday()" 
                                class="px-4 py-2 ${isToday ? 'bg-blue-600 text-white' : 'bg-white text-slate-700 hover:bg-slate-50'} rounded-lg transition font-medium text-sm border border-slate-200 shadow-sm">
                            <i class="fa-solid fa-calendar-check mr-1.5"></i>Hoy
                        </button>
                    </div>

                    <!-- Right: Date Range Display -->
                    <div class="flex items-center gap-3">
                        <div class="w-10 h-10 rounded-lg bg-white border border-slate-200 flex items-center justify-center shadow-sm">
                            <i class="fa-solid fa-calendar text-blue-600"></i>
                        </div>
                        <div>
                            <h2 class="text-xl font-bold text-slate-900 leading-tight">
                                ${formatWeekRange(currentWeek)}
                            </h2>
                            <p class="text-xs text-slate-500 mt-0.5">
                                ${calendarState.viewMode === 'day' ? 'Vista diaria' : calendarState.viewMode === 'week' ? 'Vista semanal' : 'Vista mensual'}
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Calendar Grid -->
            <div class="p-6">
                <div class="overflow-x-auto">
                    ${renderCalendarGrid(resource, appointmentsData, currentWeek)}
                </div>
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

    // Determine number of columns and visible days based on view mode
    let numColumns, visibleDays;
    if (calendarState.viewMode === 'day') {
        numColumns = 2; // Hora + 1 día
        visibleDays = weekDays.length > 0 ? [weekDays[0]] : [];
    } else if (calendarState.viewMode === 'month') {
        // For month view, show first week (can be expanded later to show full month grid)
        numColumns = 8; // Hora + 7 días
        visibleDays = weekDays.slice(0, Math.min(7, weekDays.length));
    } else {
        // Week view
        numColumns = 8; // Hora + 7 días
        visibleDays = weekDays;
    }

    let html = '<div class="min-w-[800px]">';

    // Header row with days
    html += `<div class="grid grid-cols-${numColumns} border-b-2 border-slate-300 bg-slate-50">`;
    html += '<div class="p-3 text-sm font-semibold text-slate-500 border-r border-slate-200">Hora</div>';

    visibleDays.forEach(day => {
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
        html += `<div class="grid grid-cols-${numColumns} border-b border-slate-100">`;
        html += `<div class="p-3 text-sm text-slate-500 border-r border-slate-200 font-mono">${time}</div>`;

        visibleDays.forEach(day => {
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
    const days = [];

    if (calendarState.viewMode === 'day') {
        // Single day view
        days.push(new Date(today));
    } else if (calendarState.viewMode === 'month') {
        // Month view - get all days of the month
        const year = today.getFullYear();
        const month = today.getMonth();
        const firstDay = new Date(year, month, 1);
        const lastDay = new Date(year, month + 1, 0);
        
        // Start from Monday of the week containing the first day
        const firstDayOfWeek = firstDay.getDay();
        const mondayOffset = firstDayOfWeek === 0 ? -6 : 1 - firstDayOfWeek;
        const startDate = new Date(firstDay);
        startDate.setDate(firstDay.getDate() + mondayOffset);
        
        // End on Sunday of the week containing the last day
        const lastDayOfWeek = lastDay.getDay();
        const sundayOffset = lastDayOfWeek === 0 ? 0 : 7 - lastDayOfWeek;
        const endDate = new Date(lastDay);
        endDate.setDate(lastDay.getDate() + sundayOffset);
        
        // Generate all days
        const current = new Date(startDate);
        while (current <= endDate) {
            days.push(new Date(current));
            current.setDate(current.getDate() + 1);
        }
    } else {
        // Week view - Monday to Sunday
        const dayOfWeek = today.getDay();
        const monday = new Date(today);
        monday.setDate(today.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
        
        for (let i = 0; i < 7; i++) {
            const day = new Date(monday);
            day.setDate(monday.getDate() + i);
            days.push(day);
        }
    }
    
    return days;
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
 * Format date range based on view mode
 * @param {Array<Date>} days - Array of days
 * @returns {string} Formatted string
 */
function formatWeekRange(days) {
    const months = ['ene.', 'feb.', 'mar.', 'abr.', 'may.', 'jun.', 'jul.', 'ago.', 'sep.', 'oct.', 'nov.', 'dic.'];
    
    if (calendarState.viewMode === 'day') {
        // Single day view
        const day = days[0];
        const dayNames = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
        return `${dayNames[day.getDay()]}, ${day.getDate()} de ${months[day.getMonth()]} de ${day.getFullYear()}`;
    } else if (calendarState.viewMode === 'month') {
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
