// Breadcrumbs Component using DView

import { FlexRow, Tappable, Div } from '../../../DView/layout.js';
import { Text } from '../../../DView/texts.js';

export const Breadcrumbs = {
    view: (vnode) => {
        const { currentPath, resource } = vnode.attrs;
        
        // Don't show breadcrumbs on home page
        if (!currentPath || currentPath === '/') {
            return null;
        }
        
        const pathParts = currentPath.split('/').filter(p => p);
        const breadcrumbs = [];
        
        // Always start with Home
        breadcrumbs.push({
            label: 'Inicio',
            href: '/',
            icon: 'home'
        });
        
            // If we're on a resource route
        if (pathParts[0] === 'resource' && pathParts[1]) {
            const resourceId = pathParts[1];
            const subView = pathParts[2]; // 'admin', 'calendar', etc.
            
            if (resource) {
                // Determine href based on current view
                let resourceHref = null;
                if (subView === 'admin') {
                    // In admin view, resource is not clickable (current page)
                    resourceHref = null;
                } else if (subView === 'calendar') {
                    // In calendar view, clicking resource goes to admin
                    resourceHref = `/resource/${resourceId}/admin`;
                } else {
                    // Default: go to admin view
                    resourceHref = `/resource/${resourceId}/admin`;
                }
                
                breadcrumbs.push({
                    label: resource.title || resource.name || resource.subtitle || 'Recurso',
                    href: resourceHref
                });
            } else {
                // Same logic for when resource is not available
                let resourceHref = null;
                if (subView === 'admin') {
                    resourceHref = null;
                } else if (subView === 'calendar') {
                    resourceHref = `/resource/${resourceId}/admin`;
                } else {
                    resourceHref = `/resource/${resourceId}/admin`;
                }
                
                breadcrumbs.push({
                    label: 'Recurso',
                    href: resourceHref
                });
            }
            
            // Sub-views (only show for non-admin views)
            if (subView === 'calendar') {
                breadcrumbs.push({
                    label: 'Calendario',
                    href: null // Current page
                });
            }
            // Note: We don't add "Administración" level - admin view shows as just "Inicio -> Recurso"
        } else if (pathParts[0] === 'kiosko') {
            breadcrumbs.push({ label: 'Kiosko', href: null });
        } else if (pathParts[0] === 'tv') {
            breadcrumbs.push({ label: 'TV', href: null });
        } else if (pathParts[0] === 'stats') {
            breadcrumbs.push({ label: 'Estadísticas', href: null });
        }
        
        return m(Div, {
            style: {
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                fontSize: '0.875rem',
                marginBottom: '1.5rem',
                marginTop: '0'
            }
        }, breadcrumbs.map((crumb, index) => {
            const isLast = index === breadcrumbs.length - 1;
            const isClickable = crumb.href && !isLast;
            
            return [
                index > 0 && m('i', {
                    class: 'fa-solid fa-chevron-right',
                    style: { fontSize: '0.75rem', color: '#cbd5e1', margin: '0 0.25rem' }
                }),
                isClickable ? m(Tappable, {
                    onclick: () => m.route.set(crumb.href),
                    style: {
                        color: '#64748b',
                        textDecoration: 'none',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.25rem'
                    },
                    hover: {
                        color: '#2563eb'
                    }
                }, [
                    crumb.icon && m('i', {
                        class: `fa-solid fa-${crumb.icon}`,
                        style: { fontSize: '0.75rem' }
                    }),
                    m(Text, { fontSize: '0.875rem' }, crumb.label)
                ]) : m(Text, {
                    style: {
                        fontSize: '0.875rem',
                        color: isLast ? '#0f172a' : '#64748b',
                        fontWeight: isLast ? 500 : 'normal'
                    }
                }, crumb.label)
            ];
        }).flat())
    }
};

