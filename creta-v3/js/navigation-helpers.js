// Navigation Helper Functions - Must be loaded before modules
// These functions are used in onclick handlers in dynamically generated HTML

/**
 * Navigate to a route
 * @param {string} path - Path to navigate to
 */
window.navigateTo = function(path) {
    if (window.router && window.router.navigate) {
        window.router.navigate(path);
    } else {
        // Fallback: use hash directly
        window.location.hash = path.startsWith('/') ? '#' + path : '#' + '/' + path;
    }
};

/**
 * Navigate to a resource route
 * @param {string} resourceId - Resource ID
 * @param {string} view - Optional view (admin, calendar)
 */
window.navigateToResource = function(resourceId, view) {
    if (view) {
        window.navigateTo('/resource/' + resourceId + '/' + view);
    } else {
        window.navigateTo('/resource/' + resourceId);
    }
};

/**
 * Navigate to admin view for current resource
 */
window.navigateToAdmin = function() {
    if (window.app && window.app.currentResource && window.app.currentResource._id) {
        window.navigateToResource(window.app.currentResource._id, 'admin');
    }
};

/**
 * Navigate to calendar view for current resource
 */
window.navigateToCalendar = function() {
    if (window.app && window.app.currentResource && window.app.currentResource._id) {
        window.navigateToResource(window.app.currentResource._id, 'calendar');
    }
};

