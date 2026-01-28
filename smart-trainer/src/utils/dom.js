/**
 * DOM Utilities - Funciones para manipulación del DOM
 * Smart Trainer Controller
 */

import { applyStyles } from './theme.js';

/**
 * Crear elemento con estilos y atributos
 * @param {string} tag - Nombre del tag HTML
 * @param {Object} options - Opciones del elemento
 * @returns {HTMLElement}
 */
export function createElement(tag, options = {}) {
    const { styles, attrs, children, text, html, events, className } = options;
    
    const element = document.createElement(tag);
    
    if (className) {
        element.className = className;
    }
    
    if (styles) {
        applyStyles(element, styles);
    }
    
    if (attrs) {
        Object.entries(attrs).forEach(([key, value]) => {
            if (key === 'dataset') {
                Object.entries(value).forEach(([dataKey, dataValue]) => {
                    element.dataset[dataKey] = dataValue;
                });
            } else {
                element.setAttribute(key, value);
            }
        });
    }
    
    if (text) {
        element.textContent = text;
    }
    
    if (html) {
        element.innerHTML = html;
    }
    
    if (children) {
        children.forEach(child => {
            if (child) {
                element.appendChild(child);
            }
        });
    }
    
    if (events) {
        Object.entries(events).forEach(([event, handler]) => {
            element.addEventListener(event, handler);
        });
    }
    
    return element;
}

/**
 * Crear un contenedor div con estilos
 */
export function div(options = {}) {
    return createElement('div', options);
}

/**
 * Crear un botón con estilos
 */
export function button(options = {}) {
    return createElement('button', options);
}

/**
 * Crear un span con texto
 */
export function span(options = {}) {
    return createElement('span', options);
}

/**
 * Renderizar componente en contenedor
 * @param {HTMLElement} container - Contenedor donde renderizar
 * @param {HTMLElement|Function} component - Componente a renderizar
 */
export function render(container, component) {
    container.innerHTML = '';
    
    if (typeof component === 'function') {
        const element = component();
        if (element) {
            container.appendChild(element);
        }
    } else if (component instanceof HTMLElement) {
        container.appendChild(component);
    }
}

/**
 * Limpiar contenedor
 */
export function clear(container) {
    container.innerHTML = '';
}

/**
 * Crear icono SVG inline
 */
export function icon(name, size = 24, color = 'currentColor') {
    const icons = {
        bluetooth: `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2">
            <path d="M6.5 6.5l11 11L12 23V1l5.5 5.5-11 11"/>
        </svg>`,
        
        power: `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2">
            <path d="M18.36 6.64a9 9 0 1 1-12.73 0"/>
            <line x1="12" y1="2" x2="12" y2="12"/>
        </svg>`,
        
        play: `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="${color}">
            <polygon points="5 3 19 12 5 21 5 3"/>
        </svg>`,
        
        pause: `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="${color}">
            <rect x="6" y="4" width="4" height="16"/>
            <rect x="14" y="4" width="4" height="16"/>
        </svg>`,
        
        stop: `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="${color}">
            <rect x="4" y="4" width="16" height="16" rx="2"/>
        </svg>`,
        
        settings: `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2">
            <circle cx="12" cy="12" r="3"/>
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>
        </svg>`,
        
        activity: `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2">
            <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
        </svg>`,
        
        clock: `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2">
            <circle cx="12" cy="12" r="10"/>
            <polyline points="12 6 12 12 16 14"/>
        </svg>`,
        
        zap: `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="${color}">
            <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
        </svg>`,
        
        bike: `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2">
            <circle cx="5.5" cy="17.5" r="3.5"/>
            <circle cx="18.5" cy="17.5" r="3.5"/>
            <path d="M15 6a1 1 0 1 0 0-2 1 1 0 0 0 0 2zm-3 11.5V14l-3-3 4-3 2 3h3"/>
        </svg>`,
        
        refresh: `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2">
            <polyline points="23 4 23 10 17 10"/>
            <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
        </svg>`,
        
        check: `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2">
            <polyline points="20 6 9 17 4 12"/>
        </svg>`,
        
        x: `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2">
            <line x1="18" y1="6" x2="6" y2="18"/>
            <line x1="6" y1="6" x2="18" y2="18"/>
        </svg>`,
        
        chevronRight: `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2">
            <polyline points="9 18 15 12 9 6"/>
        </svg>`,
        chevronUp: `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2">
            <polyline points="18 15 12 9 6 15"/>
        </svg>`,
        chevronDown: `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2">
            <polyline points="6 9 12 15 18 9"/>
        </svg>`,
        
        flame: `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="${color}">
            <path d="M12 2c1 3-2 5-2 8a4 4 0 0 0 8 0c0-3-2-5-3-7 0 3-3 4-3 4s-1-2 0-5z"/>
        </svg>`,
        
        gauge: `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2">
            <path d="M12 2a10 10 0 1 0 10 10"/>
            <path d="M12 12l4-4"/>
            <circle cx="12" cy="12" r="2"/>
        </svg>`,
        /** Velocímetro (para Velocidad) - mismo que gauge */
        speedometer: `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2">
            <path d="M12 2a10 10 0 1 0 10 10"/>
            <path d="M12 12l4-4"/>
            <circle cx="12" cy="12" r="2"/>
        </svg>`,
        /** Ruta / distancia (para Distancia) */
        route: `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2">
            <circle cx="6" cy="18" r="3"/>
            <circle cx="18" cy="6" r="3"/>
            <path d="M9 18l3-9 6 3"/>
        </svg>`,
        /** Cadencia (rpm) */
        cadence: `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2">
            <circle cx="12" cy="12" r="8"/>
            <path d="M12 6v6l4 2"/>
            <path d="M12 4v2M12 18v2M4 12h2M18 12h2"/>
        </svg>`,
        
        download: `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
            <polyline points="7 10 12 15 17 10"/>
            <line x1="12" y1="15" x2="12" y2="3"/>
        </svg>`,
        
        lock: `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
            <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
        </svg>`,
        
        heart: `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="${color}" stroke="${color}" stroke-width="2">
            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
        </svg>`,
        
        heartPulse: `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2">
            <path d="M19.5 12.572l-7.5 7.428l-7.5 -7.428a5 5 0 1 1 7.5 -6.566a5 5 0 1 1 7.5 6.572"/>
            <path d="M12 6l-1 4l2.5 3l2.5 -3l-1 -4"/>
        </svg>`,
    };
    
    const wrapper = document.createElement('span');
    wrapper.innerHTML = icons[name] || '';
    wrapper.style.display = 'inline-flex';
    wrapper.style.alignItems = 'center';
    wrapper.style.justifyContent = 'center';
    
    return wrapper;
}

/**
 * Debounce function
 */
export function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

/**
 * Throttle function
 */
export function throttle(func, limit) {
    let inThrottle;
    return function executedFunction(...args) {
        if (!inThrottle) {
            func(...args);
            inThrottle = true;
            setTimeout(() => inThrottle = false, limit);
        }
    };
}

/**
 * Format time from seconds to HH:MM:SS
 */
export function formatTime(totalSeconds) {
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = Math.floor(totalSeconds % 60);
    
    if (hours > 0) {
        return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

/**
 * Format distance from meters
 */
export function formatDistance(meters) {
    if (meters >= 1000) {
        return `${(meters / 1000).toFixed(2)} km`;
    }
    return `${Math.round(meters)} m`;
}
