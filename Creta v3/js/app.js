// Main Application Logic - Creta Dashboard with Mithril

import { fetchResources } from './api.js';
import { App } from './components/App.js';
import { Breadcrumbs } from './components/Breadcrumbs.js';
import { DashboardView } from './views/DashboardView.js';
import { DetailView } from './views/DetailView.js';
import { AdminView } from './views/AdminView.js';
import { renderCalendarView } from './calendar-view.js';

// Make app globally accessible
window.app = {
    data: [],
    groupedData: {},
    currentResource: null,

    /**
     * Initialize the application
     */
    init: async function () {
        try {
            this.data = await fetchResources();
        } catch (error) {
            console.warn("Failed to load resources", error);
            this.data = [];
        } finally {
            this.processData();
        }

        // Setup Mithril routes
        this.setupRoutes();
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
     * Setup Mithril routes
     */
    setupRoutes: function () {
        m.route(document.getElementById('app'), '/', {
            '/': {
                view: () => {
                    return m(App, [
                        m(Breadcrumbs, {
                            currentPath: m.route.get()
                        }),
                        m(DashboardView, { app: window.app })
                    ]);
                }
            },
            '/resource/:id': {
                onmatch: (args, requestedPath) => {
                    const resource = window.app.data.find(r => r._id === args.id);
                    if (!resource) {
                        return m.route.set('/');
                    }
                    window.app.currentResource = resource;
                },
                render: () => {
                    return m(App, [
                        m(Breadcrumbs, {
                            currentPath: m.route.get(),
                            resource: window.app.currentResource
                        }),
                        m(DetailView, { resource: window.app.currentResource })
                    ]);
                }
            },
            '/resource/:id/admin': {
                onmatch: async (args, requestedPath) => {
                    const resource = window.app.data.find(r => r._id === args.id);
                    if (!resource) {
                        return m.route.set('/');
                    }
                    window.app.currentResource = resource;
                },
                render: () => {
                    return m(App, [
                        m(Breadcrumbs, {
                            currentPath: m.route.get(),
                            resource: window.app.currentResource
                        }),
                        m(AdminView, { resource: window.app.currentResource })
                    ]);
                }
            },
            '/resource/:id/calendar': {
                onmatch: async (args, requestedPath) => {
                    const resource = window.app.data.find(r => r._id === args.id);
                    if (!resource) {
                        return m.route.set('/');
                    }
                    window.app.currentResource = resource;
                },
                render: () => {
                    return m(App, [
                        m(Breadcrumbs, {
                            currentPath: m.route.get(),
                            resource: window.app.currentResource
                        }),
                        m(CalendarViewWrapper, { resource: window.app.currentResource })
                    ]);
                }
            },
            '/kiosko': {
                view: () => {
                    return m(App, [
                        m(Breadcrumbs, { currentPath: m.route.get() }),
                        m('div', { style: { textAlign: 'center', padding: '3rem' } }, [
                            m('p', { style: { color: '#64748b' } }, 'Vista en desarrollo')
                        ])
                    ]);
                }
            },
            '/tv': {
                view: () => {
                    return m(App, [
                        m(Breadcrumbs, { currentPath: m.route.get() }),
                        m('div', { style: { textAlign: 'center', padding: '3rem' } }, [
                            m('p', { style: { color: '#64748b' } }, 'Vista en desarrollo')
                        ])
                    ]);
                }
            },
            '/stats': {
                view: () => {
                    return m(App, [
                        m(Breadcrumbs, { currentPath: m.route.get() }),
                        m('div', { style: { textAlign: 'center', padding: '3rem' } }, [
                            m('p', { style: { color: '#64748b' } }, 'Vista en desarrollo')
                        ])
                    ]);
                }
            }
        });
    }
};

// Wrapper component for Calendar View (legacy HTML rendering)
const CalendarViewWrapper = {
    oncreate: async (vnode) => {
        const container = document.createElement('div');
        vnode.dom.appendChild(container);
        await renderCalendarView(vnode.attrs.resource, container);
    },
    view: () => {
        return m('div');
    }
};

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    app.init();
});
