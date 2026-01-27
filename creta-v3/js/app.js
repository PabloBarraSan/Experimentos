// Main Application Logic - Creta Dashboard with Mithril

import { fetchResources, fetchGroups } from './api.js';
import { App } from './components/App.js';
import { Breadcrumbs } from './components/Breadcrumbs.js';
import { DashboardView } from './views/DashboardView.js';
import { AdminView } from './views/AdminView.js';
import { ResourceSettingsView } from './views/ResourceSettingsView.js';
import { renderCalendarView } from './views/CalendarView.js';

// Make app globally accessible
window.app = {
    data: [],
    groups: [],
    groupedData: {},
    currentResource: null,

    /**
     * Initialize the application
     */
    init: async function () {
        try {
            this.data = await fetchResources();
            this.groups = await fetchGroups();
        } catch (error) {
            console.warn("Failed to load resources or groups", error);
            this.data = [];
            this.groups = [];
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
        // Crear un mapa de groupId -> nombre del grupo
        const groupMap = {};
        if (this.groups && Array.isArray(this.groups)) {
            this.groups.forEach(group => {
                if (group._id && (group.name || group.title)) {
                    groupMap[group._id] = group.name || group.title;
                }
            });
        }
        
        this.groupedData = this.data.reduce((acc, item) => {
            // Normalizar el nombre del grupo: trim y verificar que no esté vacío
            let groupName = null;
            
            // 1. Intentar obtener el grupo del subtitle (prioridad más alta)
            if (item.subtitle) {
                const trimmedSubtitle = item.subtitle.trim();
                if (trimmedSubtitle !== "") {
                    groupName = trimmedSubtitle;
                }
            }
            
            // 2. Si no hay subtitle, buscar el nombre del grupo usando groupId
            if (!groupName && item.groupId && groupMap[item.groupId]) {
                groupName = groupMap[item.groupId];
            }
            
            // 3. Si aún no hay grupo, intentar otros campos posibles
            if (!groupName) {
                if (item.group && item.group.trim() !== "") {
                    groupName = item.group.trim();
                } else if (item.groupName && item.groupName.trim() !== "") {
                    groupName = item.groupName.trim();
                }
            }
            
            // 4. Si aún no hay grupo, asignar a "Otros Recursos"
            if (!groupName) {
                groupName = "Otros Recursos";
                // Debug: mostrar recursos que realmente no tienen grupo
                console.log("Recurso sin grupo asignado:", {
                    id: item._id,
                    name: item.name || item.title,
                    groupId: item.groupId,
                    groupFound: item.groupId ? groupMap[item.groupId] : 'N/A'
                });
            }
            
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
            '/resource/:id/settings': {
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
                        m(ResourceSettingsView, { resource: window.app.currentResource })
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
