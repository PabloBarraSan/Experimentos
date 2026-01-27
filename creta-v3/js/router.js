// Router Module - Handles URL-based routing for the application

/**
 * Router class to handle hash-based routing
 */
class Router {
    constructor() {
        this.routes = new Map();
        this.currentRoute = null;
        this.listeners = [];
        
        // Listen to hash changes
        window.addEventListener('hashchange', () => this.handleRoute());
        window.addEventListener('load', () => this.handleRoute());
    }

    /**
     * Register a route with a handler function
     * @param {string} pattern - Route pattern (e.g., '/resource/:id')
     * @param {Function} handler - Handler function
     */
    on(pattern, handler) {
        this.routes.set(pattern, handler);
    }

    /**
     * Navigate to a route
     * @param {string} path - Path to navigate to
     * @param {boolean} replace - If true, replace current history entry
     */
    navigate(path, replace = false) {
        // Ensure path starts with /
        if (!path.startsWith('/')) {
            path = '/' + path;
        }

        // Remove leading # if present
        path = path.replace(/^#/, '');

        if (replace) {
            window.location.replace('#' + path);
        } else {
            window.location.hash = path;
        }
    }

    /**
     * Get current route path
     * @returns {string} Current path
     */
    getCurrentPath() {
        const hash = window.location.hash;
        if (!hash || hash === '#') {
            return '/';
        }
        return hash.substring(1); // Remove #
    }

    /**
     * Parse route pattern and match against path
     * @param {string} pattern - Route pattern
     * @param {string} path - Path to match
     * @returns {Object|null} Matched params or null
     */
    matchRoute(pattern, path) {
        const patternParts = pattern.split('/').filter(p => p);
        const pathParts = path.split('/').filter(p => p);

        if (patternParts.length !== pathParts.length) {
            return null;
        }

        const params = {};
        for (let i = 0; i < patternParts.length; i++) {
            const patternPart = patternParts[i];
            const pathPart = pathParts[i];

            if (patternPart.startsWith(':')) {
                // Parameter
                const paramName = patternPart.substring(1);
                params[paramName] = pathPart;
            } else if (patternPart !== pathPart) {
                // Literal doesn't match
                return null;
            }
        }

        return params;
    }

    /**
     * Handle route change
     */
    handleRoute() {
        const path = this.getCurrentPath();
        this.currentRoute = path;

        // Try to match against registered routes
        let matched = false;
        for (const [pattern, handler] of this.routes.entries()) {
            const params = this.matchRoute(pattern, path);
            if (params !== null) {
                handler(params, path);
                matched = true;
                break;
            }
        }

        // If no route matched, try exact match
        if (!matched) {
            const exactHandler = this.routes.get(path);
            if (exactHandler) {
                exactHandler({}, path);
                matched = true;
            }
        }

        // Default to home if no match
        if (!matched && path === '/') {
            const homeHandler = this.routes.get('/');
            if (homeHandler) {
                homeHandler({}, path);
            }
        }

        // Notify listeners
        this.notifyListeners(path);
    }

    /**
     * Add a listener for route changes
     * @param {Function} callback - Callback function
     */
    addListener(callback) {
        this.listeners.push(callback);
    }

    /**
     * Notify all listeners of route change
     * @param {string} path - New path
     */
    notifyListeners(path) {
        this.listeners.forEach(callback => callback(path));
    }

    /**
     * Get route parameters from current URL
     * @returns {Object} Route parameters
     */
    getParams() {
        const path = this.getCurrentPath();
        for (const [pattern] of this.routes.entries()) {
            const params = this.matchRoute(pattern, path);
            if (params !== null) {
                return params;
            }
        }
        return {};
    }
}

// Create singleton instance
const router = new Router();

// Export router instance
export default router;

