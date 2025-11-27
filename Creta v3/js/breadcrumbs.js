// Breadcrumbs Module - Global navigation component

/**
 * Generate breadcrumbs based on current route and context
 * @param {Object} options - Options object
 * @param {string} options.currentPath - Current route path
 * @param {Object} options.resource - Current resource object (optional)
 * @param {string} options.currentView - Current view name (optional)
 * @returns {string} HTML string for breadcrumbs
 */
export function renderBreadcrumbs(options = {}) {
    const { currentPath, resource, currentView } = options;
    
    // Don't show breadcrumbs on home page
    if (!currentPath || currentPath === '/') {
        return '';
    }
    
    // Parse current path
    const pathParts = currentPath ? currentPath.split('/').filter(p => p) : [];
    
    let breadcrumbs = [];
    
    // Always start with Home
    breadcrumbs.push({
        label: 'Inicio',
        href: '#/',
        icon: 'fa-home',
        onClick: "navigateTo('/')"
    });
    
    // If we're on a resource route
    if (pathParts[0] === 'resource' && pathParts[1]) {
        const resourceId = pathParts[1];
        
        // Resource name
        if (resource) {
            breadcrumbs.push({
                label: resource.title || resource.name || resource.subtitle || 'Recurso',
                href: `#/resource/${resourceId}`,
                icon: null,
                onClick: `navigateToResource('${resourceId}')`
            });
        } else {
            breadcrumbs.push({
                label: 'Recurso',
                href: `#/resource/${resourceId}`,
                icon: null,
                onClick: `navigateToResource('${resourceId}')`
            });
        }
        
        // Sub-views
        if (pathParts[2] === 'admin') {
            breadcrumbs.push({
                label: 'Administración',
                href: `#/resource/${resourceId}/admin`,
                icon: 'fa-pen-to-square',
                onClick: null // Current page
            });
        } else if (pathParts[2] === 'calendar') {
            breadcrumbs.push({
                label: 'Calendario',
                href: `#/resource/${resourceId}/calendar`,
                icon: 'fa-calendar-days',
                onClick: null // Current page
            });
        } else if (currentView) {
            breadcrumbs.push({
                label: currentView,
                href: null,
                icon: null,
                onClick: null
            });
        }
    } else if (pathParts[0] === 'kiosko') {
        breadcrumbs.push({
            label: 'Kiosko',
            href: '#/kiosko',
            icon: 'fa-ticket',
            onClick: null
        });
    } else if (pathParts[0] === 'tv') {
        breadcrumbs.push({
            label: 'TV',
            href: '#/tv',
            icon: 'fa-tv',
            onClick: null
        });
    } else if (pathParts[0] === 'stats') {
        breadcrumbs.push({
            label: 'Estadísticas',
            href: '#/stats',
            icon: 'fa-chart-bar',
            onClick: null
        });
    }
    
    // Generate HTML
    let html = '<nav class="flex items-center gap-2 text-sm mb-4" aria-label="Breadcrumb">';
    
    breadcrumbs.forEach((crumb, index) => {
        const isLast = index === breadcrumbs.length - 1;
        const isClickable = crumb.onClick && !isLast;
        
        if (index > 0) {
            html += '<i class="fa-solid fa-chevron-right text-slate-300 text-xs"></i>';
        }
        
        if (isClickable) {
            html += `<a href="${crumb.href || '#'}" onclick="${crumb.onClick}; return false;" class="text-slate-500 hover:text-blue-600 transition-colors flex items-center gap-1">`;
        } else {
            html += `<span class="${isLast ? 'text-slate-900 font-medium' : 'text-slate-500'} flex items-center gap-1">`;
        }
        
        if (crumb.icon) {
            html += `<i class="fa-solid ${crumb.icon} text-xs"></i>`;
        }
        
        html += `<span>${crumb.label}</span>`;
        
        if (isClickable) {
            html += '</a>';
        } else {
            html += '</span>';
        }
    });
    
    html += '</nav>';
    
    return html;
}

/**
 * Render breadcrumbs in a container element
 * @param {HTMLElement} container - Container element
 * @param {Object} options - Options for breadcrumbs
 */
export function renderBreadcrumbsInContainer(container, options = {}) {
    // Get current path from router if available
    if (!options.currentPath && window.router) {
        options.currentPath = window.router.getCurrentPath();
    }
    
    // Get current resource from app if available
    if (!options.resource && window.app && window.app.currentResource) {
        options.resource = window.app.currentResource;
    }
    
    const breadcrumbsHtml = renderBreadcrumbs(options);
    
    // Create breadcrumbs container if it doesn't exist
    let breadcrumbsContainer = container.querySelector('.breadcrumbs-container');
    if (!breadcrumbsContainer) {
        breadcrumbsContainer = document.createElement('div');
        breadcrumbsContainer.className = 'breadcrumbs-container';
        container.insertBefore(breadcrumbsContainer, container.firstChild);
    }
    
    breadcrumbsContainer.innerHTML = breadcrumbsHtml;
}

