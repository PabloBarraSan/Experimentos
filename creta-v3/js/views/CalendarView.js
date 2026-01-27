// Calendar View Module - Handles the calendar view for appointments

import { fetchAppointments, getDateRange } from '../api.js';
import { ScheduleModal } from '../components/ScheduleModal.js';
import { openDialog } from '../../../DView/dialogs.js';
import { renderSidebarHTML, openSlotDetails, closeSidebar, renderSlotDetails, openEmptySlotDetails } from '../components/SlotSidebar.js';
import { formatDateKey, formatDayHeader, formatWeekRange, isToday } from '../utils/dateUtils.js';

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
    const resource = calendarState.resource;
    if (!resource) return;
    
    // Convert virtualSettings object to array
    const virtualSettings = resource.virtualSettings || {};
    const schedules = Object.values(virtualSettings).map(schedule => ({
        id: schedule.id,
        name: schedule.name,
        index: schedule.index || 0,
        seats: schedule.seats || 25,
        days: schedule.days || [],
        from: schedule.from || '',
        until: schedule.until || '',
        startHour: schedule.startHour || '',
        endHour: schedule.endHour || '',
        appDuration: schedule.appDuration || 0,
        supplement: schedule.supplement || 0,
        exceptions: schedule.exceptions || [],
        title: schedule.title || schedule.name,
        photo: schedule.photo || resource.photo || '',
        description: schedule.description || '',
        resourceId: schedule.resourceId || resource._id
    }));
    
    // Sort by index
    schedules.sort((a, b) => (a.index || 0) - (b.index || 0));
    
    openDialog(ScheduleModal, {
        attrs: {
            resource: resource,
            schedules: schedules,
            onClose: () => {
                // Modal will be closed by openDialog
            }
        }
    });
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
        const isHidden = content.style.display === 'none';
        
        if (isHidden) {
            content.style.display = 'block';
            chevron.classList.remove('fa-chevron-down');
            chevron.classList.add('fa-chevron-up');
        } else {
            content.style.display = 'none';
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
        <div style="display: flex; align-items: center; justify-content: center; padding: 3rem 0;">
            <i class="fa-solid fa-circle-notch fa-spin" style="font-size: 2.5rem; color: #2563eb;"></i>
            <p style="margin-left: 1rem; color: #64748b;">Cargando calendario...</p>
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
    const sidebarHtml = renderSidebarHTML();

    container.innerHTML = headerHtml + toolbarHtml + calendarHtml + sidebarHtml;

    // Store appointments data globally for access
    window.currentAppointmentsData = appointmentsData;
}

// Sidebar functions moved to shared component (components/SlotSidebar.js)
// Functions are exposed globally via SlotSidebar.js for backward compatibility


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
        <div style="background-color: white; border-radius: 0.5rem; border: 1px solid #e2e8f0; margin-bottom: 1.5rem;">
            <div style="padding: 1rem 1.5rem;">
                <!-- Top Row: Title and Action Buttons -->
                <div style="display: flex; flex-direction: row; align-items: flex-start; justify-content: space-between; gap: 1rem; margin-bottom: 1rem; flex-wrap: wrap;">
                    <div style="flex: 1; display: flex; align-items: flex-start; gap: 0.75rem; min-width: 0;">
                        ${imgUrl ? `
                        <img src="${imgUrl}" 
                             alt="${resourceName}" 
                             style="width: 48px; height: 48px; border-radius: 50%; object-fit: cover; border: 2px solid #e2e8f0; box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05); flex-shrink: 0;"
                             onerror="this.style.display='none'">
                        ` : ''}
                        <div style="flex: 1; min-width: 0;">
                            <h1 style="font-size: 1.25rem; font-weight: 600; color: #0f172a; margin: 0;">${resourceName}</h1>
                            ${groupName ? `<p style="font-size: 0.875rem; color: #64748b; margin-top: 0.25rem; margin-bottom: 0;">${groupName}</p>` : ''}
                            <!-- Stats Pills - Below title for better association -->
                            <div style="display: flex; flex-wrap: wrap; align-items: center; gap: 0.5rem; margin-top: 0.75rem;">
                                <span style="display: inline-flex; align-items: center; gap: 0.375rem; padding: 0.375rem 0.75rem; border-radius: 9999px; font-size: 0.75rem; font-weight: 500; background-color: #eff6ff; color: #1d4ed8; border: 1px solid #bfdbfe;">
                                    <i class="fa-solid fa-users" style="font-size: 0.75rem;"></i>
                                    Capacidad: ${resource.seats?.total || 0}
                                </span>
                                ${resource.maxAppointmentsPerUser ? `
                                <span style="display: inline-flex; align-items: center; gap: 0.375rem; padding: 0.375rem 0.75rem; border-radius: 9999px; font-size: 0.75rem; font-weight: 500; background-color: #faf5ff; color: #7c3aed; border: 1px solid #e9d5ff;">
                                    <i class="fa-solid fa-user-clock" style="font-size: 0.75rem;"></i>
                                    Máx. usuario: ${resource.maxAppointmentsPerUser}
                                </span>
                                ` : ''}
                                <span style="display: inline-flex; align-items: center; gap: 0.375rem; padding: 0.375rem 0.75rem; border-radius: 9999px; font-size: 0.75rem; font-weight: 500; ${resource.published ? 'background-color: #f0fdf4; color: #15803d; border: 1px solid #bbf7d0;' : 'background-color: #f8fafc; color: #475569; border: 1px solid #e2e8f0;'}">
                                    <i class="fa-solid fa-${resource.published ? 'check-circle' : 'circle-pause'}" style="font-size: 0.75rem;"></i>
                                    ${resource.published ? 'Activo' : 'Pausado'}
                                </span>
                            </div>
                        </div>
                    </div>
                    
                    <!-- Quick Actions - Top right, more visible -->
                    <div style="display: flex; flex-wrap: wrap; align-items: center; gap: 0.5rem; align-self: flex-start;">
                        <button onclick="handleSearchAppointments()" 
                                style="display: inline-flex; align-items: center; gap: 0.5rem; padding: 0.5rem 0.875rem; border-radius: 0.5rem; font-size: 0.875rem; font-weight: 500; background-color: white; color: #334155; border: 1px solid #e2e8f0; box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05); transition: all 0.2s; cursor: pointer;"
                                onmouseenter="this.style.backgroundColor='#fff7ed'; this.style.color='#c2410c'; this.style.borderColor='#fed7aa'; this.style.boxShadow='0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)';"
                                onmouseleave="this.style.backgroundColor='white'; this.style.color='#334155'; this.style.borderColor='#e2e8f0'; this.style.boxShadow='0 1px 2px 0 rgba(0, 0, 0, 0.05)';">
                            <i class="fa-solid fa-search" style="font-size: 0.875rem; color: #ea580c;"></i>
                            <span>Buscar citas</span>
                        </button>
                        <button onclick="handleManageSchedules()" 
                                style="display: inline-flex; align-items: center; gap: 0.5rem; padding: 0.5rem 0.875rem; border-radius: 0.5rem; font-size: 0.875rem; font-weight: 500; background-color: white; color: #334155; border: 1px solid #e2e8f0; box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05); transition: all 0.2s; cursor: pointer;"
                                onmouseenter="this.style.backgroundColor='#faf5ff'; this.style.color='#7c3aed'; this.style.borderColor='#e9d5ff'; this.style.boxShadow='0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)';"
                                onmouseleave="this.style.backgroundColor='white'; this.style.color='#334155'; this.style.borderColor='#e2e8f0'; this.style.boxShadow='0 1px 2px 0 rgba(0, 0, 0, 0.05)';">
                            <i class="fa-solid fa-calendar" style="font-size: 0.875rem; color: #7c3aed;"></i>
                            <span>Gestionar horarios</span>
                        </button>
                        <button id="1" onclick="handleCloneWeek()" 
                                style="display: inline-flex; align-items: center; gap: 0.5rem; padding: 0.5rem 0.875rem; border-radius: 0.5rem; font-size: 0.875rem; font-weight: 500; background-color: white; color: #334155; border: 1px solid #e2e8f0; box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05); transition: all 0.2s; cursor: pointer;"
                                onmouseenter="this.style.backgroundColor='#f0fdfa'; this.style.color='#0d9488'; this.style.borderColor='#99f6e4'; this.style.boxShadow='0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)';"
                                onmouseleave="this.style.backgroundColor='white'; this.style.color='#334155'; this.style.borderColor='#e2e8f0'; this.style.boxShadow='0 1px 2px 0 rgba(0, 0, 0, 0.05)';">
                            <i class="fa-solid fa-clone" style="font-size: 0.875rem; color: #14b8a6;"></i>
                            <span>Clonar Semana</span>
                        </button>
                        <button id="2" onclick="handleDeleteWeek()" 
                                style="display: inline-flex; align-items: center; gap: 0.5rem; padding: 0.5rem 0.875rem; border-radius: 0.5rem; font-size: 0.875rem; font-weight: 500; background-color: white; color: #334155; border: 1px solid #e2e8f0; box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05); transition: all 0.2s; cursor: pointer;"
                                onmouseenter="this.style.backgroundColor='#fef2f2'; this.style.color='#dc2626'; this.style.borderColor='#fecaca'; this.style.boxShadow='0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)';"
                                onmouseleave="this.style.backgroundColor='white'; this.style.color='#334155'; this.style.borderColor='#e2e8f0'; this.style.boxShadow='0 1px 2px 0 rgba(0, 0, 0, 0.05)';">
                            <i class="fa-solid fa-trash" style="font-size: 0.875rem; color: #ef4444;"></i>
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
    const isTodayDate = calendarState.viewMode === 'day' && 
                    isToday(calendarState.currentDate);

    return `
        <div style="background-color: white; border-radius: 0.75rem; box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05); border: 1px solid #e2e8f0; overflow: hidden;">
            <!-- Calendar Toolbar - Improved -->
            <div style="padding: 1rem 1.5rem; background-color: #f8fafc; border-bottom: 1px solid #e2e8f0;">
                <div style="display: flex; flex-direction: row; align-items: center; justify-content: space-between; gap: 1rem; flex-wrap: wrap;">
                    <!-- Left: Navigation + View Mode Toggle + Today Button -->
                    <div style="display: flex; flex-wrap: wrap; align-items: center; gap: 0.5rem;">
                        <!-- Navigation Controls -->
                        <div style="display: flex; align-items: center; gap: 0.25rem; background-color: white; border-radius: 0.5rem; padding: 0.25rem; border: 1px solid #e2e8f0; box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05);">
                            <button onclick="window.calendar.prevPeriod()" 
                                    style="padding: 0.5rem 0.75rem; color: #475569; border-radius: 0.375rem; transition: all 0.2s; cursor: pointer; border: none; background: transparent;"
                                    onmouseenter="this.style.backgroundColor='#f1f5f9';"
                                    onmouseleave="this.style.backgroundColor='transparent';"
                                    title="Anterior">
                                <i class="fa-solid fa-chevron-left"></i>
                            </button>
                            <button onclick="window.calendar.nextPeriod()" 
                                    style="padding: 0.5rem 0.75rem; color: #475569; border-radius: 0.375rem; transition: all 0.2s; cursor: pointer; border: none; background: transparent;"
                                    onmouseenter="this.style.backgroundColor='#f1f5f9';"
                                    onmouseleave="this.style.backgroundColor='transparent';"
                                    title="Siguiente">
                                <i class="fa-solid fa-chevron-right"></i>
                            </button>
                        </div>
                        
                        <!-- View Mode Toggle -->
                        <div style="display: flex; align-items: center; background-color: white; border-radius: 0.5rem; padding: 0.25rem; border: 1px solid #e2e8f0; box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05);">
                            <button onclick="window.calendar.changeView('day')" 
                                    style="padding: 0.375rem 0.75rem; border-radius: 0.375rem; transition: all 0.2s; font-weight: 500; font-size: 0.875rem; cursor: pointer; border: none; ${calendarState.viewMode === 'day' ? 'background-color: #2563eb; color: white; box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05);' : 'color: #475569; background-color: transparent;'}"
                                    onmouseenter="${calendarState.viewMode !== 'day' ? "this.style.backgroundColor='#f1f5f9';" : ''}"
                                    onmouseleave="${calendarState.viewMode !== 'day' ? "this.style.backgroundColor='transparent';" : ''}">
                                <i class="fa-solid fa-calendar-day" style="margin-right: 0.375rem;"></i>Día
                            </button>
                            <button onclick="window.calendar.changeView('week')" 
                                    style="padding: 0.375rem 0.75rem; border-radius: 0.375rem; transition: all 0.2s; font-weight: 500; font-size: 0.875rem; cursor: pointer; border: none; ${calendarState.viewMode === 'week' ? 'background-color: #2563eb; color: white; box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05);' : 'color: #475569; background-color: transparent;'}"
                                    onmouseenter="${calendarState.viewMode !== 'week' ? "this.style.backgroundColor='#f1f5f9';" : ''}"
                                    onmouseleave="${calendarState.viewMode !== 'week' ? "this.style.backgroundColor='transparent';" : ''}">
                                <i class="fa-solid fa-calendar-week" style="margin-right: 0.375rem;"></i>Semana
                            </button>
                            <button onclick="window.calendar.changeView('month')" 
                                    style="padding: 0.375rem 0.75rem; border-radius: 0.375rem; transition: all 0.2s; font-weight: 500; font-size: 0.875rem; cursor: pointer; border: none; ${calendarState.viewMode === 'month' ? 'background-color: #2563eb; color: white; box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05);' : 'color: #475569; background-color: transparent;'}"
                                    onmouseenter="${calendarState.viewMode !== 'month' ? "this.style.backgroundColor='#f1f5f9';" : ''}"
                                    onmouseleave="${calendarState.viewMode !== 'month' ? "this.style.backgroundColor='transparent';" : ''}">
                                <i class="fa-solid fa-calendar-days" style="margin-right: 0.375rem;"></i>Mes
                            </button>
                        </div>
                        
                        <!-- Today Button -->
                        <button onclick="window.calendar.goToToday()" 
                                style="padding: 0.5rem 1rem; border-radius: 0.5rem; transition: all 0.2s; font-weight: 500; font-size: 0.875rem; cursor: pointer; border: 1px solid #e2e8f0; box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05); ${isTodayDate ? 'background-color: #2563eb; color: white;' : 'background-color: white; color: #334155;'}"
                                onmouseenter="${!isTodayDate ? "this.style.backgroundColor='#f1f5f9';" : ''}"
                                onmouseleave="${!isTodayDate ? "this.style.backgroundColor='white';" : ''}">
                            <i class="fa-solid fa-calendar-check" style="margin-right: 0.375rem;"></i>Hoy
                        </button>
                    </div>

                    <!-- Right: Date Range Display -->
                    <div style="display: flex; align-items: center; gap: 0.75rem;">
                        <div style="width: 40px; height: 40px; border-radius: 0.5rem; background-color: white; border: 1px solid #e2e8f0; display: flex; align-items: center; justify-content: center; box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05);">
                            <i class="fa-solid fa-calendar" style="color: #2563eb;"></i>
                        </div>
                        <div>
                            <h2 style="font-size: 1.25rem; font-weight: bold; color: #0f172a; line-height: 1.25; margin: 0;">
                                ${formatWeekRange(currentWeek, calendarState.viewMode)}
                            </h2>
                            <p style="font-size: 0.75rem; color: #64748b; margin-top: 0.125rem; margin-bottom: 0;">
                                ${calendarState.viewMode === 'day' ? 'Vista diaria' : calendarState.viewMode === 'week' ? 'Vista semanal' : 'Vista mensual'}
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Calendar Grid -->
            <div style="padding: 1.5rem;">
                <div style="overflow-x: auto;">
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

    let html = '<div style="min-width: 800px;">';

    // Header row with days
    html += `<div style="display: grid; border-bottom: 2px solid #cbd5e1; background-color: #f8fafc; grid-template-columns: 100px repeat(${numColumns - 1}, minmax(0, 1fr));">`;
    html += '<div style="padding: 0.75rem; font-size: 0.875rem; font-weight: 600; color: #64748b; border-right: 1px solid #e2e8f0;">Hora</div>';

    visibleDays.forEach(day => {
        const dayIsToday = isToday(day);
        const dayKey = formatDateKey(day);
        html += `
            <div style="padding: 0.75rem; text-align: center; border-right: 1px solid #e2e8f0; ${dayIsToday ? 'background-color: #eff6ff;' : ''}">
                <div style="font-size: 0.75rem; font-weight: 600; color: #64748b;">${formatDayHeader(day)}</div>
                <div style="font-size: 0.875rem; font-weight: bold; ${dayIsToday ? 'color: #2563eb;' : 'color: #334155;'}">${day.getDate()}</div>
            </div>
        `;
    });
    html += '</div>';

    // Time slots rows
    timeSlots.forEach(time => {
        html += `<div style="display: grid; border-bottom: 1px solid #f1f5f9; grid-template-columns: 100px repeat(${numColumns - 1}, minmax(0, 1fr));">`;
        html += `<div style="padding: 0.75rem; font-size: 0.875rem; color: #64748b; border-right: 1px solid #e2e8f0; font-family: monospace;">${time}</div>`;

        visibleDays.forEach(day => {
            html += '<div style="padding: 0.5rem; border-right: 1px solid #e2e8f0; position: relative; min-height: 40px;">';

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
                             style="font-size: 0.75rem; padding: 0.5rem; border-radius: 0.25rem; cursor: pointer; transition: opacity 0.2s; box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05); border: 1px solid; position: absolute; top: 0; left: 0.5rem; right: 0.5rem; height: ${slotHeight}px; z-index: 10; ${color};"
                             onmouseenter="this.style.opacity='0.8';"
                             onmouseleave="this.style.opacity='1';">
                            <div style="font-weight: 500; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${vs.name}">${vs.name || vs.title}</div>
                            <div style="font-size: 0.75rem; opacity: 0.75; display: flex; justify-content: space-between; align-items: center; margin-top: 0.25rem;">
                                <span>${availability}</span>
                                ${slot.appointments?.length ? `<i class="fa-solid fa-user-check"></i>` : ''}
                            </div>
                            <div style="font-size: 0.75rem; opacity: 0.6; margin-top: 0.25rem;">${vs.startHour} - ${vs.endHour}</div>
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
                         style="background-color: #f8fafc; border: 1px solid #f1f5f9; font-size: 0.75rem; padding: 0.5rem; border-radius: 0.25rem; transition: all 0.2s; cursor: pointer; position: absolute; top: 0; left: 0.5rem; right: 0.5rem; height: ${slotHeight}px; z-index: 10;"
                         onmouseenter="this.style.backgroundColor='#f0fdf4'; this.style.borderColor='#bbf7d0'; this.querySelectorAll('div').forEach(el => { if(el.style.color === 'rgb(148, 163, 184)') el.style.color='#16a34a'; if(el.style.color === 'rgb(203, 213, 225)') el.style.color='#22c55e'; });"
                         onmouseleave="this.style.backgroundColor='#f8fafc'; this.style.borderColor='#f1f5f9'; this.querySelectorAll('div').forEach(el => { if(el.style.color === 'rgb(16, 163, 74)') el.style.color='#94a3b8'; if(el.style.color === 'rgb(34, 197, 94)') el.style.color='#cbd5e1'; });">
                        <div style="color: #94a3b8; font-weight: 500; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${vs.name}</div>
                        <div style="font-size: 0.75rem; color: #cbd5e1; margin-top: 0.25rem;">Disponible</div>
                        <div style="font-size: 0.75rem; color: #94a3b8; margin-top: 0.25rem;">${startHour} - ${endHour}</div>
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
 * @returns {string} Inline CSS styles
 */
function getSlotColor(slot) {
    if (!slot) return 'background-color: #dcfce7; color: #15803d; border-color: #bbf7d0;';

    const { total, remaining } = slot;

    if (remaining === 0) {
        return 'background-color: #fee2e2; color: #b91c1c; border-color: #fecaca;';
    } else if (remaining < total) {
        return 'background-color: #dbeafe; color: #1d4ed8; border-color: #bfdbfe;';
    } else {
        return 'background-color: #dcfce7; color: #15803d; border-color: #bbf7d0;';
    }
}

/**
 * Format date as key (YYYY-MM-DD)
 * @param {Date} date - Date object
 * @returns {string} Formatted date
 */
// Date utility functions moved to utils/dateUtils.js

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
