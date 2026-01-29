/**
 * Router - Sistema de navegación basado en URL
 * Usa hash (#/ruta) para que funcione con servidores estáticos sin SPA fallback:
 * - Evita 404 al abrir directamente .../training o al refrescar en una ruta
 * - El servidor solo recibe la petición del documento (ej. /smart-trainer/) y no del path
 */

// Prefijo del hash para rutas
const HASH_PREFIX = '#';

// Mapeo de rutas (path sin leading slash en hash) a vistas
const ROUTES = {
    '': 'home',
    '/': 'home',
    '/home': 'home',
    '/training': 'training',
    '/game': 'game',
    '/ride': 'ride',
    '/history': 'history',
    '/settings': 'settings',
    '/workouts': 'workouts',
};

// Mapeo inverso: vista → path para el hash
const VIEW_TO_ROUTE = {
    'home': '/',
    'training': '/training',
    'game': '/game',
    'ride': '/ride',
    'history': '/history',
    'settings': '/settings',
    'workouts': '/workouts',
};

// Callback para cuando cambia la ruta
let onRouteChange = null;

/**
 * Obtener el path actual desde el hash (#/training → /training)
 */
function getCurrentPath() {
    const hash = window.location.hash || HASH_PREFIX + '/';
    const path = hash.slice(HASH_PREFIX.length) || '/';
    return path.startsWith('/') ? path : '/' + path;
}

/**
 * Obtener el base path de la aplicación (para recursos; con hash no afecta a la ruta)
 */
function getBasePath() {
    const baseTag = document.querySelector('base');
    if (baseTag) {
        const href = baseTag.getAttribute('href');
        if (href && href !== '/') {
            return href.replace(/\/$/, '');
        }
    }
    const pathname = window.location.pathname;
    if (pathname.endsWith('.html')) {
        const dir = pathname.substring(0, pathname.lastIndexOf('/'));
        return dir || '';
    }
    const match = pathname.match(/^(\/[^\/]+)\/?/);
    return match ? match[1] : '';
}

/**
 * Resolver la vista desde un path
 */
function resolveView(path) {
    path = path || '/';
    if (!path.startsWith('/')) path = '/' + path;
    if (ROUTES[path] !== undefined) {
        return ROUTES[path];
    }
    return 'home';
}

/**
 * Obtener la vista actual basada en la URL (hash)
 */
export function getCurrentView() {
    const path = getCurrentPath();
    return resolveView(path);
}

/**
 * Navegar a una vista (actualiza el hash y notifica)
 * @param {string} viewName - Nombre de la vista
 * @param {Object} options - Opciones adicionales
 * @param {boolean} options.replace - Si true, reemplaza la entrada actual en el historial
 */
export function navigate(viewName, options = {}) {
    const route = VIEW_TO_ROUTE[viewName] || '/';
    const newHash = HASH_PREFIX + route;
    const currentHash = window.location.hash || HASH_PREFIX + '/';

    if (currentHash !== newHash) {
        if (options.replace) {
            window.history.replaceState({ view: viewName }, '', window.location.pathname + window.location.search + newHash);
        } else {
            window.history.pushState({ view: viewName }, '', window.location.pathname + window.location.search + newHash);
        }
    }

    if (onRouteChange) {
        onRouteChange(viewName);
    }
}

/**
 * Configurar el callback para cambios de ruta
 */
export function setRouteChangeHandler(handler) {
    onRouteChange = handler;
}

/**
 * Inicializar el router
 * - Escucha popstate (atrás/adelante) y hashchange (cambio de hash directo o enlace)
 * - Retorna la vista inicial basada en el hash actual
 */
export function initRouter() {
    const applyView = () => {
        const view = getCurrentView();
        if (onRouteChange) {
            onRouteChange(view);
        }
    };

    window.addEventListener('popstate', (event) => {
        const view = event.state?.view || getCurrentView();
        if (onRouteChange) {
            onRouteChange(view);
        }
    });

    window.addEventListener('hashchange', () => {
        applyView();
    });

    // Estado inicial: sincronizar history con el hash actual
    const initialView = getCurrentView();
    const initialHash = window.location.hash || HASH_PREFIX + '/';
    window.history.replaceState({ view: initialView }, '', window.location.pathname + window.location.search + initialHash);

    return initialView;
}

/**
 * Crear un enlace navegable (para usar en lugar de <a href>)
 * Previene la recarga de página y usa el router
 */
export function createNavLink(element, viewName) {
    element.addEventListener('click', (e) => {
        e.preventDefault();
        navigate(viewName);
    });
    return element;
}

// Exportar constantes útiles
export { ROUTES, VIEW_TO_ROUTE };
