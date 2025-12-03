// Breadcrumbs Component using DView

import { FlexRow, Tappable } from '../../../DView/layout.js';
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
            
            if (resource) {
                breadcrumbs.push({
                    label: resource.title || resource.name || resource.subtitle || 'Recurso',
                    href: `/resource/${resourceId}`
                });
            } else {
                breadcrumbs.push({
                    label: 'Recurso',
                    href: `/resource/${resourceId}`
                });
            }
            
            // Sub-views
            if (pathParts[2] === 'admin') {
                breadcrumbs.push({
                    label: 'Administración',
                    href: null // Current page
                });
            } else if (pathParts[2] === 'calendar') {
                breadcrumbs.push({
                    label: 'Calendario',
                    href: null // Current page
                });
            }
        } else if (pathParts[0] === 'kiosko') {
            breadcrumbs.push({ label: 'Kiosko', href: null });
        } else if (pathParts[0] === 'tv') {
            breadcrumbs.push({ label: 'TV', href: null });
        } else if (pathParts[0] === 'stats') {
            breadcrumbs.push({ label: 'Estadísticas', href: null });
        }
        
        return m(FlexRow, {
            alignItems: 'center',
            gap: '0.5rem',
            style: {
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

