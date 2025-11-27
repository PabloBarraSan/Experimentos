// Main Application Logic - Creta Dashboard

import { fetchResources } from './api.js';
import { renderAdminView } from './admin-view.js';
import { renderCalendarView } from './calendar-view.js';

// Make app globally accessible
window.app = {
    data: [],
    groupedData: {},
    currentTypeFilter: 'all', // 'all', 'booking', 'bon', 'appointment'
    currentResource: null,

    /**
     * Initialize the application
     */
    init: async function () {
        this.showLoading(true);
        this.goHome();

        try {
            this.data = await fetchResources();
        } catch (error) {
            console.warn("Failed to load resources", error);
            this.data = [];
        } finally {
            this.processData();
            this.renderDashboard();
            this.showLoading(false);
        }
    },

    /**
     * Show/hide loading indicator
     * @param {boolean} show - Whether to show loading
     */
    showLoading: function (show) {
        const loader = document.getElementById('loading-indicator');
        if (show) loader.classList.remove('hidden');
        else loader.classList.add('hidden');
    },

    /**
     * Process and group data by subtitle
     */
    processData: function () {
        this.groupedData = this.data.reduce((acc, item) => {
            const groupName = item.subtitle && item.subtitle.trim() !== "" ? item.subtitle : "Otros Recursos";
            if (!acc[groupName]) {
                acc[groupName] = [];
            }
            acc[groupName].push(item);
            return acc;
        }, {});
    },

    /**
     * Render the dashboard with resource cards
     */
    renderDashboard: function () {
        const grid = document.getElementById('resources-grid');
        const showUnpublished = document.getElementById('toggle-unpublished').checked;
        const searchTerm = document.getElementById('search-input').value.toLowerCase();

        grid.innerHTML = '';

        const sortedGroups = Object.keys(this.groupedData).sort();

        sortedGroups.forEach(groupName => {
            let resources = this.groupedData[groupName];

            // Filter by search, published status, and type
            resources = resources.filter(r => {
                const name = r.name || r.title || "";
                const matchesSearch = name.toLowerCase().includes(searchTerm) || groupName.toLowerCase().includes(searchTerm);
                const matchesPub = showUnpublished ? true : r.published;

                let matchesType = true;
                if (this.currentTypeFilter !== 'all') {
                    matchesType = r.type === this.currentTypeFilter;
                }

                return matchesSearch && matchesPub && matchesType;
            });

            if (resources.length === 0) return;

            // Create group card
            const groupCard = document.createElement('div');
            groupCard.className = 'mb-6 break-inside-avoid bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden hover:shadow-md transition-shadow duration-300 fade-in';

            // Header
            const headerHTML = `
                <div class="px-5 py-4 border-b border-slate-100 flex justify-between items-start bg-slate-50/50">
                    <div>
                        <h3 class="text-lg font-bold text-slate-800 leading-tight uppercase">${groupName}</h3>
                        <span class="text-xs text-slate-400 font-medium">${resources.length} Recursos</span>
                    </div>
                    <div class="flex space-x-1">
                        <button class="text-slate-400 hover:text-blue-600 hover:bg-blue-50 p-1.5 rounded-md transition" title="Usuarios">
                            <i class="fa-solid fa-users"></i>
                        </button>
                        <button class="text-slate-400 hover:text-green-600 hover:bg-green-50 p-1.5 rounded-md transition" title="Editar">
                            <i class="fa-solid fa-pen"></i>
                        </button>
                    </div>
                </div>
            `;

            // Resource list
            let listHTML = '<div class="divide-y divide-slate-100">';
            resources.forEach(res => {
                const imgUrl = res.photo ? `${res.photo}?w=210&h=140&thumbnail=true` : 'https://via.placeholder.com/210x140?text=No+Image';
                const resName = res.name || res.title || "Sin nombre";

                listHTML += `
                    <div onclick="app.showDetail('${res._id}')" class="group px-4 py-3 hover:bg-slate-50 cursor-pointer transition-colors flex items-center gap-4">
                        <img src="${imgUrl}" class="w-16 h-12 object-cover rounded-lg shadow-sm group-hover:scale-105 transition-transform duration-300" alt="${resName}" onerror="this.src='https://via.placeholder.com/210x140?text=Error'">
                        <div class="flex-grow">
                            <h4 class="text-sm font-semibold text-slate-700 group-hover:text-blue-600 transition-colors">${resName}</h4>
                            ${!res.published ? '<span class="text-xs text-red-500 font-bold bg-red-50 px-2 py-0.5 rounded-full border border-red-100">No Publicado</span>' : ''}
                        </div>
                        <i class="fa-solid fa-chevron-right text-slate-300 text-xs group-hover:text-blue-500 transition-colors"></i>
                    </div>
                `;
            });
            listHTML += '</div>';

            groupCard.innerHTML = headerHTML + listHTML;
            grid.appendChild(groupCard);
        });
    },

    /**
     * Filter resources (called on search input)
     */
    filterResources: function () {
        this.renderDashboard();
    },

    /**
     * Set filter type (all, booking, bon, appointment)
     * @param {string} type - Filter type
     */
    setFilterType: function (type) {
        this.currentTypeFilter = type;

        // Update button styles
        const buttons = document.querySelectorAll('.filter-btn');
        buttons.forEach(btn => {
            btn.classList.remove('bg-blue-600', 'text-white', 'border-blue-600');
            btn.classList.add('bg-white', 'text-slate-600', 'border-slate-200');
        });

        const activeBtn = document.getElementById(`btn-filter-${type}`);
        if (activeBtn) {
            activeBtn.classList.remove('bg-white', 'text-slate-600', 'border-slate-200');
            activeBtn.classList.add('bg-blue-600', 'text-white', 'border-blue-600');
        }

        this.renderDashboard();
    },

    /**
     * Show detail view for a resource
     * @param {string} id - Resource ID
     */
    showDetail: function (id) {
        let resource = this.data.find(r => r._id === id);

        // Mock data for development if no data loaded
        if (!resource && this.data.length === 0) {
            resource = {
                "_id": "66c31201e2810d1463e5dd0d",
                "name": "Campo de Fútbol 7 ",
                "title": "Campo de Fútbol 7 ",
                "subtitle": "ESTADIO MUNICIPAL RAFAEL MENDOZA",
                "published": true,
                "type": "booking",
                "photo": "https://cdn.digitalvalue.es/pinto/assets/672b92f7e69d9f340c12341f?w=400",
                "description": {
                    "und": "<p>También puede realizar su reserva llamando al 912 483 802 - 912 483 815</p><p>Siempre que vaya a utilizar la pista una persona mayor de dieciocho años, se cobrará el precio de la pista como adulto...</p>"
                },
                "seats": { "total": 3 },
                "virtualSettings": {
                    "aca371": { "name": "C1 F7", "startHour": "08:00", "endHour": "16:00" },
                    "b66cd0": { "name": "C2 F7", "startHour": "08:00", "endHour": "16:00" }
                }
            };
        }

        if (!resource) return;

        // Save current resource
        this.currentResource = resource;

        // Update detail view
        document.getElementById('detail-resource-name').innerText = resource.name || resource.title;
        document.getElementById('detail-group-name').innerText = resource.subtitle || "Recurso";

        // Show detail view
        document.getElementById('view-dashboard').classList.add('hidden');
        document.getElementById('view-detail').classList.remove('hidden');
        document.getElementById('view-admin').classList.add('hidden');

        window.scrollTo(0, 0);
    },

    /**
     * Load admin view for current or specified resource
     * @param {string} id - Optional resource ID
     */
    loadAdminView: async function (id) {
        let resource = this.currentResource;
        if (id) {
            resource = this.data.find(r => r._id === id);
        }

        if (resource) {
            // Hide detail, show admin
            document.getElementById('view-detail').classList.add('hidden');
            document.getElementById('view-admin').classList.remove('hidden');

            const container = document.getElementById('view-admin');
            await renderAdminView(resource, container);
            window.scrollTo(0, 0);
        }
    },

    /**
     * Load calendar view for current resource
     */
    loadCalendarView: async function () {
        const resource = this.currentResource;
        if (resource) {
            // Hide admin, show calendar
            document.getElementById('view-admin').classList.add('hidden');
            document.getElementById('view-calendar').classList.remove('hidden');

            const container = document.getElementById('view-calendar');
            await renderCalendarView(resource, container);
            window.scrollTo(0, 0);
        }
    },

    /**
     * Go back to admin view from calendar
     */
    backToAdmin: function () {
        document.getElementById('view-calendar').classList.add('hidden');
        document.getElementById('view-admin').classList.remove('hidden');
        window.scrollTo(0, 0);
    },

    /**
     * Go back to dashboard
     */
    goHome: function () {
        document.getElementById('view-detail').classList.add('hidden');
        document.getElementById('view-admin').classList.add('hidden');
        document.getElementById('view-calendar').classList.add('hidden');
        document.getElementById('view-dashboard').classList.remove('hidden');

        window.scrollTo(0, 0);
    }
};

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    app.init();
});
