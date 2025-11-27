// Main Application Logic - Creta Dashboard

import { fetchResources } from './api.js';
import { renderAdminView } from './admin-view.js';
import { renderCalendarView } from './calendar-view.js';
import router from './router.js';
import { renderBreadcrumbsInContainer } from './breadcrumbs.js';
import { renderDashboardView } from './views/dashboard-view.js';
import { renderDetailView } from './views/detail-view.js';

// Make router globally accessible immediately
window.router = router;

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
        this.setupRoutes();

        try {
            this.data = await fetchResources();
        } catch (error) {
            console.warn("Failed to load resources", error);
            this.data = [];
        } finally {
            this.processData();
        }

        // Handle initial route - this will render the view
        router.handleRoute();
    },

    /**
     * Setup route handlers
     */
    setupRoutes: function () {
        // Home route
        router.on('/', () => {
            this.renderCurrentView();
        });

        // Resource detail route
        router.on('/resource/:id', (params) => {
            if (params.id) {
                this.renderCurrentView();
            }
        });

        // Resource admin route
        router.on('/resource/:id/admin', async (params) => {
            if (params.id) {
                await this.renderCurrentView();
            }
        });

        // Resource calendar route
        router.on('/resource/:id/calendar', async (params) => {
            if (params.id) {
                await this.renderCurrentView();
            }
        });

        // Kiosko route
        router.on('/kiosko', () => {
            this.renderCurrentView();
        });

        // TV route
        router.on('/tv', () => {
            this.renderCurrentView();
        });

        // Stats route
        router.on('/stats', () => {
            this.renderCurrentView();
        });
    },

    /**
     * Render the current view based on the route
     */
    renderCurrentView: async function () {
        const container = document.getElementById('app-container');
        if (!container) return;

        const currentPath = router.getCurrentPath();
        const pathParts = currentPath.split('/').filter(p => p);

        // Update breadcrumbs
        this.updateBreadcrumbs();

        // Clear container (except breadcrumbs)
        const breadcrumbsContainer = container.querySelector('.breadcrumbs-container');
        container.innerHTML = '';
        if (breadcrumbsContainer) {
            container.appendChild(breadcrumbsContainer);
        }

        // Render based on route
        if (currentPath === '/') {
            // Dashboard
            container.innerHTML = (breadcrumbsContainer ? breadcrumbsContainer.outerHTML : '') + renderDashboardView(this);
            // Re-attach event listeners
            this.attachDashboardListeners();
        } else if (pathParts[0] === 'resource' && pathParts[1]) {
            const resourceId = pathParts[1];
            const resource = this.data.find(r => r._id === resourceId);
            
            if (!resource) {
                container.innerHTML = '<div class="text-center py-12"><p class="text-slate-500">Recurso no encontrado</p></div>';
                return;
            }

            this.currentResource = resource;

            if (pathParts[2] === 'admin') {
                // Admin view
                const adminContainer = document.createElement('div');
                container.appendChild(adminContainer);
                await renderAdminView(resource, adminContainer);
            } else if (pathParts[2] === 'calendar') {
                // Calendar view
                const calendarContainer = document.createElement('div');
                container.appendChild(calendarContainer);
                await renderCalendarView(resource, calendarContainer);
            } else {
                // Detail view
                const breadcrumbsHtml = breadcrumbsContainer ? breadcrumbsContainer.outerHTML : '';
                container.innerHTML = breadcrumbsHtml + renderDetailView(resource);
            }
        } else {
            // Other routes (kiosko, tv, stats)
            container.innerHTML = '<div class="text-center py-12"><p class="text-slate-500">Vista en desarrollo</p></div>';
        }

        window.scrollTo(0, 0);
    },

    /**
     * Attach event listeners for dashboard
     */
    attachDashboardListeners: function () {
        // Listeners are already in the HTML via onclick attributes
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
     * Filter resources (called on search input)
     */
    filterResources: function () {
        this.renderCurrentView();
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

        this.renderCurrentView();
    },




    /**
     * Go back to admin view from calendar
     */
    backToAdmin: function () {
        const resource = this.currentResource;
        if (resource && resource._id) {
            navigateToResource(resource._id, 'admin');
        }
    },

    /**
     * Legacy function for compatibility - redirects to route-based navigation
     * @deprecated Use navigateToCalendar() instead
     */
    loadCalendarView: function () {
        navigateToCalendar();
    },

    /**
     * Legacy function for compatibility - redirects to route-based navigation
     * @deprecated Use navigateToAdmin() instead
     */
    loadAdminView: function (id) {
        if (id) {
            navigateToResource(id, 'admin');
        } else {
            navigateToAdmin();
        }
    },

    /**
     * Update breadcrumbs for current view
     */
    updateBreadcrumbs: function () {
        const currentPath = router.getCurrentPath();
        const container = document.getElementById('app-container');
        
        if (container) {
            renderBreadcrumbsInContainer(container, {
                currentPath: currentPath,
                resource: this.currentResource
            });
        }
    }
};

// Listen to route changes to update breadcrumbs
router.addListener(() => {
    if (window.app && window.app.updateBreadcrumbs) {
        window.app.updateBreadcrumbs();
    }
});

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    app.init();
});
