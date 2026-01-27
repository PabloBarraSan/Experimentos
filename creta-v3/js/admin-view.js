// Admin View Module - Handles the administration view logic and rendering

import { fetchAppointments, calculateStats, getDateRange } from './api.js';

/**
 * Render the complete admin view for a resource
 * @param {Object} resource - Resource object
 * @param {HTMLElement} container - Container element
 */
export async function renderAdminView(resource, container) {
    // Show loading state
    container.innerHTML = `
        <div class="flex items-center justify-center py-12">
            <i class="fa-solid fa-circle-notch fa-spin text-4xl text-blue-600"></i>
            <p class="ml-4 text-slate-500">Cargando datos de administración...</p>
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

    // Calculate statistics
    const stats = calculateStats(appointmentsData);

    // Render the view with real data
    const headerHtml = renderHeader(resource);
    const contentHtml = renderContent(resource, stats, appointmentsData);
    const gridHtml = renderScheduleGrid(resource, appointmentsData);

    container.innerHTML = headerHtml + contentHtml + gridHtml;

    // Initialize chart with real data
    initializeChart(stats);
}

/**
 * Render the header section
 * @param {Object} resource - Resource object
 * @returns {string} HTML string
 */
function renderHeader(resource) {
    return `
        <div class="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-6">
            <div class="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-4">
                <div>
                    <h1 class="text-3xl font-bold text-slate-800 flex items-center gap-3">
                        ${resource.title || resource.name}
                        <span class="text-lg font-normal text-slate-500 bg-slate-100 px-3 py-1 rounded-full">${resource.subtitle || ''}</span>
                    </h1>
                </div>
                <div class="flex flex-wrap gap-2 justify-end">
                    <span class="px-3 py-1 rounded-full text-sm font-medium bg-slate-100 text-slate-600">Tipus: ${resource.type}</span>
                    ${resource.published ? '<span class="px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-700">Publicat</span>' : '<span class="px-3 py-1 rounded-full text-sm font-medium bg-gray-100 text-gray-500">No Publicat</span>'}
                    <span class="px-3 py-1 rounded-full text-sm font-medium bg-slate-100 text-slate-600"><i class="fa-solid fa-check text-green-500 mr-1"></i>Autoconfirmat</span>
                    <span class="px-3 py-1 rounded-full text-sm font-medium bg-slate-100 text-slate-600" title="Seats"><i class="fa-solid fa-users mr-1"></i>${resource.seats?.total || 0}</span>
                    <span class="px-3 py-1 rounded-full text-sm font-medium bg-slate-100 text-slate-600"><i class="fa-solid fa-credit-card text-green-500 mr-1"></i>Pago</span>
                </div>
            </div>
        </div>
    `;
}

/**
 * Render the main content section with stats and chart
 * @param {Object} resource - Resource object
 * @param {Object} stats - Statistics object
 * @param {Object} appointmentsData - Appointments data from API
 * @returns {string} HTML string
 */
function renderContent(resource, stats, appointmentsData) {
    return `
        <div class="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-6">
            <div class="grid grid-cols-1 lg:grid-cols-12 gap-8">
                <!-- Image & Description (Left) -->
                <div class="lg:col-span-4 space-y-4">
                    <div class="rounded-lg overflow-hidden border border-slate-200 aspect-video flex items-center justify-center bg-slate-50">
                        <img src="${resource.photo || 'https://via.placeholder.com/400x300'}" class="w-full h-full object-cover" alt="${resource.name}">
                    </div>
                    <div class="prose prose-sm text-slate-600 max-w-none">
                        ${resource.description?.und || '<p>Sin descripción</p>'}
                    </div>
                </div>

                <!-- Right Column: Stats, Chart, Buttons -->
                <div class="lg:col-span-8 space-y-6">
                    
                    <!-- Stats Cards -->
                    <div class="grid grid-cols-3 gap-4">
                        <div class="bg-slate-50 p-4 rounded-lg border border-slate-200 text-center">
                            <div class="text-2xl font-bold text-slate-800">${stats.totalSlots}</div>
                            <div class="text-xs text-slate-500 uppercase tracking-wide">Slots</div>
                        </div>
                        <div class="bg-slate-50 p-4 rounded-lg border border-slate-200 text-center">
                            <div class="text-2xl font-bold text-slate-800">${stats.confirmedAppointments}</div>
                            <div class="text-xs text-slate-500 uppercase tracking-wide">Reservas</div>
                        </div>
                        <div class="bg-slate-50 p-4 rounded-lg border border-slate-200 text-center">
                            <div class="text-2xl font-bold text-slate-800">${stats.availableSeats}</div>
                            <div class="text-xs text-slate-500 uppercase tracking-wide">Disponibles</div>
                        </div>
                    </div>

                    <!-- Chart & Actions Row -->
                    <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <!-- Chart -->
                        <div class="md:col-span-2 bg-white rounded-lg border border-slate-200 p-4">
                            <div id="chart-container"></div>
                        </div>

                        <!-- Action Buttons -->
                        <div class="space-y-2">
                            <button onclick="navigateToCalendar()" class="w-full text-left px-4 py-3 rounded-lg bg-blue-600 hover:bg-blue-700 text-white transition flex items-center gap-3 shadow-sm">
                                <i class="fa-regular fa-calendar"></i> Calendari cites
                            </button>
                            <button class="w-full text-left px-4 py-3 rounded-lg bg-violet-600 hover:bg-violet-700 text-white transition flex items-center gap-3 shadow-sm">
                                <i class="fa-regular fa-clock"></i> Gestionar Horaris
                            </button>
                            <button class="w-full text-left px-4 py-3 rounded-lg bg-amber-700 hover:bg-amber-800 text-white transition flex items-center gap-3 shadow-sm">
                                <i class="fa-solid fa-print"></i> Imprimir reserves
                            </button>
                            <button class="w-full text-left px-4 py-3 rounded-lg bg-green-600 hover:bg-green-700 text-white transition flex items-center gap-3 shadow-sm">
                                <i class="fa-solid fa-gear"></i> Ajustos del recurs
                            </button>
                            <button class="w-full text-left px-4 py-3 rounded-lg bg-teal-600 hover:bg-teal-700 text-white transition flex items-center gap-3 shadow-sm">
                                <i class="fa-solid fa-user-shield"></i> Admin Torns
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;
}

/**
 * Render the schedule grid
 * @param {Object} resource - Resource object
 * @param {Object} appointmentsData - Appointments data from API
 * @returns {string} HTML string
 */
function renderScheduleGrid(resource, appointmentsData) {
    const gridRows = generateGridRows(resource, appointmentsData);

    return `
        <div class="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
            <div class="flex flex-col sm:flex-row justify-between items-center gap-4 mb-6">
                <h3 class="text-lg font-bold text-slate-800"><i class="fa-regular fa-calendar-days mr-2"></i>Horarios y Disponibilidad</h3>
                <div class="flex items-center gap-2">
                    <div class="flex bg-slate-100 rounded-lg p-1">
                        <button class="px-3 py-1 text-sm font-medium rounded-md text-slate-600 hover:bg-white hover:shadow-sm transition">Día</button>
                        <button class="px-3 py-1 text-sm font-medium rounded-md text-slate-600 hover:bg-white hover:shadow-sm transition">Semana</button>
                        <button class="px-3 py-1 text-sm font-medium rounded-md bg-white text-blue-600 shadow-sm transition">Mes</button>
                    </div>
                </div>
            </div>
            
            <!-- Grid Visualization -->
            <div class="overflow-x-auto">
                <div class="min-w-[800px] border border-slate-200 rounded-lg">
                    ${gridRows}
                </div>
            </div>
        </div>
    `;
}

/**
 * Generate grid rows from virtualSettings
 * @param {Object} resource - Resource object
 * @param {Object} appointmentsData - Appointments data from API
 * @returns {string} HTML string
 */
function generateGridRows(resource, appointmentsData) {
    if (!resource.virtualSettings) {
        return '<div class="p-4 text-center text-slate-500">No hay configuración de horarios disponible</div>';
    }

    // Get virtual settings as array
    const virtualSettings = Object.values(resource.virtualSettings);

    // Create header row
    let html = `
        <div class="grid grid-cols-${virtualSettings.length + 1} bg-slate-50 border-b border-slate-200 text-sm font-medium text-slate-500">
            <div class="p-3 border-r border-slate-200">Hora</div>
    `;

    virtualSettings.forEach(vs => {
        html += `<div class="p-3 border-r border-slate-200 text-center last:border-r-0">${vs.name || vs.title}</div>`;
    });

    html += '</div>';

    // Generate time slots (simplified - showing sample hours)
    const hours = ['09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00'];

    hours.forEach(hour => {
        html += `
            <div class="grid grid-cols-${virtualSettings.length + 1} border-b border-slate-100 last:border-0 hover:bg-slate-50 transition">
                <div class="p-3 text-sm text-slate-500 border-r border-slate-200 font-mono">${hour}</div>
        `;

        virtualSettings.forEach(() => {
            // Randomly show available/booked for demo (in production, use real data)
            const isAvailable = Math.random() > 0.3;
            html += `
                <div class="p-2 border-r border-slate-200 last:border-r-0">
                    <div class="${isAvailable ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'} text-xs p-2 rounded text-center cursor-pointer hover:${isAvailable ? 'bg-green-200' : 'bg-blue-200'} transition">
                        ${isAvailable ? 'Libre' : 'Reserva'}
                    </div>
                </div>
            `;
        });

        html += '</div>';
    });

    return html;
}

/**
 * Initialize the Frappe Chart with real data
 * @param {Object} stats - Statistics object
 */
function initializeChart(stats) {
    setTimeout(() => {
        // Ensure all values are numbers and not NaN
        const confirmed = stats.confirmedAppointments || 0;
        const pending = stats.pendingAppointments || 0;
        const canceled = stats.canceledAppointments || 0;

        // Only show chart if there's data
        const hasData = confirmed > 0 || pending > 0 || canceled > 0;

        if (!hasData) {
            document.getElementById('chart-container').innerHTML = `
                <div class="flex items-center justify-center h-48 text-slate-400">
                    <div class="text-center">
                        <i class="fa-solid fa-chart-pie text-4xl mb-2"></i>
                        <p class="text-sm">No hay datos de citas disponibles</p>
                    </div>
                </div>
            `;
            return;
        }

        const data = {
            labels: ["Confirmades", "Pendents", "Cancel·lades"],
            datasets: [
                { values: [confirmed, pending, canceled] }
            ]
        };

        new frappe.Chart("#chart-container", {
            data: data,
            type: 'pie',
            height: 200,
            colors: ['#22c55e', '#f59e0b', '#ef4444']
        });
    }, 100);
}
