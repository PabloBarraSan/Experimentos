/**
 * Service Worker - Smart Trainer Controller
 * Maneja el caching para funcionamiento offline
 */

const CACHE_NAME = 'smart-trainer-v1';
const BASE_PATH = '/Experimentos/smart-trainer';
const STATIC_ASSETS = [
    `${BASE_PATH}/`,
    `${BASE_PATH}/index.html`,
    `${BASE_PATH}/manifest.json`,
    `${BASE_PATH}/src/app.js`,
    `${BASE_PATH}/src/utils/theme.js`,
    `${BASE_PATH}/src/utils/dom.js`,
    `${BASE_PATH}/src/utils/calculations.js`,
    `${BASE_PATH}/src/bluetooth/scanner.js`,
    `${BASE_PATH}/src/bluetooth/ftms.js`,
    `${BASE_PATH}/src/bluetooth/commands.js`,
    `${BASE_PATH}/src/components/MetricCard.js`,
    `${BASE_PATH}/src/components/PowerGauge.js`,
    `${BASE_PATH}/src/components/ResistanceSlider.js`,
    `${BASE_PATH}/src/components/PowerChart.js`,
    `${BASE_PATH}/src/components/WorkoutPlayer.js`,
    `${BASE_PATH}/src/views/HomeView.js`,
    `${BASE_PATH}/src/views/TrainingView.js`,
    `${BASE_PATH}/src/views/WorkoutsView.js`,
    `${BASE_PATH}/src/views/SettingsView.js`,
    `${BASE_PATH}/src/views/HistoryView.js`,
    `${BASE_PATH}/src/workouts/model.js`,
    `${BASE_PATH}/src/workouts/presets.js`,
    `${BASE_PATH}/src/storage/settings.js`,
    `${BASE_PATH}/src/storage/sessions.js`,
];

/**
 * Instalación del Service Worker
 */
self.addEventListener('install', (event) => {
    console.log('[SW] Installing Service Worker...');
    
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                console.log('[SW] Caching static assets...');
                return cache.addAll(STATIC_ASSETS);
            })
            .then(() => {
                console.log('[SW] Static assets cached successfully');
                return self.skipWaiting();
            })
            .catch((error) => {
                console.error('[SW] Failed to cache static assets:', error);
            })
    );
});

/**
 * Activación del Service Worker
 */
self.addEventListener('activate', (event) => {
    console.log('[SW] Activating Service Worker...');
    
    event.waitUntil(
        caches.keys()
            .then((cacheNames) => {
                return Promise.all(
                    cacheNames
                        .filter((name) => name !== CACHE_NAME)
                        .map((name) => {
                            console.log('[SW] Deleting old cache:', name);
                            return caches.delete(name);
                        })
                );
            })
            .then(() => {
                console.log('[SW] Service Worker activated');
                return self.clients.claim();
            })
    );
});

/**
 * Interceptar peticiones de red
 * Estrategia: Cache First, Network Fallback
 */
self.addEventListener('fetch', (event) => {
    // Solo manejar peticiones GET
    if (event.request.method !== 'GET') {
        return;
    }
    
    // No cachear peticiones de extensiones o dev tools
    if (event.request.url.includes('chrome-extension://') ||
        event.request.url.includes('devtools://')) {
        return;
    }
    
    event.respondWith(
        caches.match(event.request)
            .then((cachedResponse) => {
                // Si está en cache, devolver
                if (cachedResponse) {
                    // Actualizar cache en background (stale-while-revalidate)
                    fetchAndCache(event.request);
                    return cachedResponse;
                }
                
                // Si no está en cache, obtener de red
                return fetchAndCache(event.request);
            })
            .catch(() => {
                // Si falla todo, devolver página offline
                if (event.request.mode === 'navigate') {
                    return caches.match(`${BASE_PATH}/index.html`);
                }
                
                return new Response('Offline', {
                    status: 503,
                    statusText: 'Service Unavailable',
                });
            })
    );
});

/**
 * Obtener recurso de red y cachear
 */
async function fetchAndCache(request) {
    try {
        const response = await fetch(request);
        
        // Solo cachear respuestas válidas
        if (response.ok && response.type === 'basic') {
            const cache = await caches.open(CACHE_NAME);
            cache.put(request, response.clone());
        }
        
        return response;
    } catch (error) {
        console.error('[SW] Fetch failed:', error);
        throw error;
    }
}

/**
 * Manejar mensajes del cliente
 */
self.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
    
    if (event.data && event.data.type === 'GET_VERSION') {
        event.ports[0].postMessage({ version: CACHE_NAME });
    }
});

/**
 * Sincronización en background (si es soportada)
 */
self.addEventListener('sync', (event) => {
    console.log('[SW] Background sync:', event.tag);
    
    if (event.tag === 'sync-sessions') {
        event.waitUntil(syncSessions());
    }
});

/**
 * Sincronizar sesiones pendientes
 */
async function syncSessions() {
    // TODO: Implementar sincronización con servidor
    console.log('[SW] Syncing sessions...');
}

/**
 * Notificaciones push
 */
self.addEventListener('push', (event) => {
    if (!event.data) return;
    
    const data = event.data.json();
    
    const options = {
        body: data.body || 'Notificación de Smart Trainer',
        icon: `${BASE_PATH}/assets/icons/icon-192.png`,
        badge: `${BASE_PATH}/assets/icons/badge-72.png`,
        vibrate: [200, 100, 200],
        data: data.data || {},
        actions: data.actions || [],
    };
    
    event.waitUntil(
        self.registration.showNotification(data.title || 'Smart Trainer', options)
    );
});

/**
 * Click en notificación
 */
self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    
    const urlToOpen = event.notification.data?.url || `${BASE_PATH}/`;
    
    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true })
            .then((clientList) => {
                // Si ya hay una ventana abierta, enfocarla
                for (const client of clientList) {
                    if (client.url.includes(`${BASE_PATH}/`) && 'focus' in client) {
                        return client.focus();
                    }
                }
                // Si no, abrir una nueva
                if (clients.openWindow) {
                    return clients.openWindow(urlToOpen);
                }
            })
    );
});
