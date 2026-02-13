// Chart utility functions - Initialize charts for statistics

/**
 * Initializes a pie chart showing appointment statistics
 * @param {Object} stats - Statistics object with confirmedAppointments, pendingAppointments, canceledAppointments
 * @param {HTMLElement} container - Container element for the chart
 */
export function initializeChart(stats, container) {
    // Si container es el elemento directamente, usarlo; si no, buscar el contenedor
    let chartContainer = container;
    if (container.id !== 'chart-container') {
        chartContainer = container.querySelector('#chart-container');
    }
    
    if (!chartContainer) {
        console.warn('Chart container not found');
        return;
    }
    
    // Limpiar cualquier contenido previo
    chartContainer.innerHTML = '';

    const confirmed = stats.confirmedAppointments || 0;
    const pending = stats.pendingAppointments || 0;
    const canceled = stats.canceledAppointments || 0;

    const hasData = confirmed > 0 || pending > 0 || canceled > 0;

    if (!hasData) {
        chartContainer.innerHTML = `
            <div style="display: flex; align-items: center; justify-content: center; min-height: 60px; color: #94a3b8;">
                <div style="text-align: center;">
                    <i class="fa-solid fa-chart-pie" style="font-size: 1.25rem; margin-bottom: 0.25rem; color: #cbd5e1; display: block;"></i>
                    <p style="font-size: 0.6875rem; color: #94a3b8; margin: 0;">No hay datos</p>
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

    if (window.frappe && window.frappe.Chart) {
        new frappe.Chart(chartContainer, {
            data: data,
            type: 'pie',
            height: 120,
            colors: ['#22c55e', '#f59e0b', '#ef4444']
        });
    }
}




