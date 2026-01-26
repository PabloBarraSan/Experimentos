/**
 * Service Worker - Smart Trainer Controller
 * Maneja el caching para funcionamiento offline
 */

const CACHE_NAME = 'smart-trainer-v1';
const STATIC_ASSETS = [
    '/smart-trainer/',
    '/smart-trainer/index.html',
    '/smart-trainer/manifest.json',
    '/smart-trainer/src/app.js',
    '/smart-trainer/src/utils/theme.js',
    '/smart-trainer/src/utils/dom.js',
    '/smart-trainer/src/utils/calculations.js',
    '/smart-trainer/src/bluetooth/scanner.js',
    '/smart-trainer/src/bluetooth/ftms.js',
    '/smart-trainer/src/bluetooth/commands.js',
    '/smart-trainer/src/components/MetricCard.js',
    '/smart-trainer/src/components/PowerGauge.js',
    '/smart-trainer/src/components/ResistanceSlider.js',
    '/smart-trainer/src/components/PowerChart.js',
    '/smart-trainer/src/components/WorkoutPlayer.js',
    '/smart-trainer/src/views/HomeView.js',
    '/smart-trainer/src/views/TrainingView.js',
    '/smart-trainer/src/views/WorkoutsView.js',
    '/smart-trainer/src/views/SettingsView.js',
    '/smart-trainer/src/views/HistoryView.js',
    '/smart-trainer/src/workouts/model.js',
    '/smart-trainer/src/workouts/presets.js',
    '/smart-trainer/src/storage/settings.js',
    '/smart-trainer/src/storage/sessions.js',
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
                    return caches.match('/smart-trainer/index.html');
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
        icon: '/smart-trainer/assets/icons/icon-192.png',
        badge: '/smart-trainer/assets/icons/badge-72.png',
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
    
    const urlToOpen = event.notification.data?.url || '/smart-trainer/';
    
    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true })
            .then((clientList) => {
                // Si ya hay una ventana abierta, enfocarla
                for (const client of clientList) {
                    if (client.url.includes('/smart-trainer/') && 'focus' in client) {
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
