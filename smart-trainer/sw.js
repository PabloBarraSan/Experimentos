/**
 * Service Worker - Smart Trainer Controller
 * Maneja el caching para funcionamiento offline
 * 
 * IMPORTANTE: Incrementar VERSION cuando hagas cambios para forzar actualización
 */

const VERSION = '1.1.0';
const CACHE_NAME = `smart-trainer-v${VERSION}`;

// Detectar BASE_PATH dinámicamente según el entorno
// En GitHub Pages: /Experimentos/smart-trainer
// En localhost: /smart-trainer o vacío
const BASE_PATH = self.location.pathname.replace('/sw.js', '');

// Archivos críticos que deben estar disponibles
const CRITICAL_ASSETS = [
    `${BASE_PATH}/`,
    `${BASE_PATH}/index.html`,
    `${BASE_PATH}/manifest.json`,
    `${BASE_PATH}/src/app.js`,
];

// Archivos adicionales (se cachean pero no bloquean la instalación si fallan)
const STATIC_ASSETS = [
    ...CRITICAL_ASSETS,
    // Utils
    `${BASE_PATH}/src/utils/theme.js`,
    `${BASE_PATH}/src/utils/dom.js`,
    `${BASE_PATH}/src/utils/calculations.js`,
    // Bluetooth
    `${BASE_PATH}/src/bluetooth/scanner.js`,
    `${BASE_PATH}/src/bluetooth/ftms.js`,
    `${BASE_PATH}/src/bluetooth/commands.js`,
    `${BASE_PATH}/src/bluetooth/heartRate.js`,
    // Components
    `${BASE_PATH}/src/components/MetricCard.js`,
    `${BASE_PATH}/src/components/PowerGauge.js`,
    `${BASE_PATH}/src/components/ResistanceSlider.js`,
    `${BASE_PATH}/src/components/PowerChart.js`,
    `${BASE_PATH}/src/components/WorkoutPlayer.js`,
    `${BASE_PATH}/src/components/SaveSessionDialog.js`,
    `${BASE_PATH}/src/components/SessionDetailBottomSheet.js`,
    // Views
    `${BASE_PATH}/src/views/HomeView.js`,
    `${BASE_PATH}/src/views/TrainingView.js`,
    `${BASE_PATH}/src/views/WorkoutsView.js`,
    `${BASE_PATH}/src/views/SettingsView.js`,
    `${BASE_PATH}/src/views/HistoryView.js`,
    `${BASE_PATH}/src/views/GameView.js`,
    `${BASE_PATH}/src/views/RideView.js`,
    // Game
    `${BASE_PATH}/src/game/GameEngine.js`,
    `${BASE_PATH}/src/game/GameRenderer.js`,
    `${BASE_PATH}/src/game/GameState.js`,
    `${BASE_PATH}/src/game/entities/Cyclist.js`,
    `${BASE_PATH}/src/game/entities/Obstacle.js`,
    `${BASE_PATH}/src/game/entities/Collectible.js`,
    `${BASE_PATH}/src/game/systems/PhysicsSystem.js`,
    `${BASE_PATH}/src/game/systems/ScoreSystem.js`,
    `${BASE_PATH}/src/game/systems/SpawnSystem.js`,
    // Ride (ciclismo virtual)
    `${BASE_PATH}/src/ride/index.js`,
    `${BASE_PATH}/src/ride/RideEngine.js`,
    `${BASE_PATH}/src/ride/RideRenderer.js`,
    `${BASE_PATH}/src/ride/RideState.js`,
    `${BASE_PATH}/src/ride/RidePhysics.js`,
    `${BASE_PATH}/src/ride/RouteGenerator.js`,
    `${BASE_PATH}/src/ride/BotSystem.js`,
    `${BASE_PATH}/src/ride/worlds/WorldConfig.js`,
    // Workouts
    `${BASE_PATH}/src/workouts/model.js`,
    `${BASE_PATH}/src/workouts/presets.js`,
    // Storage
    `${BASE_PATH}/src/storage/settings.js`,
    `${BASE_PATH}/src/storage/sessions.js`,
    `${BASE_PATH}/src/storage/strava.js`,
];

/**
 * Instalación del Service Worker
 * Usa cacheo individual para que un fallo no rompa toda la instalación
 */
self.addEventListener('install', (event) => {
    console.log('[SW] Installing Service Worker...');
    
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                console.log('[SW] Caching static assets...');
                // Cachear archivos individualmente para que un fallo no rompa toda la instalación
                return Promise.allSettled(
                    STATIC_ASSETS.map(url => {
                        return fetch(url, { cache: 'no-cache' })
                            .then(response => {
                                if (response.ok) {
                                    return cache.put(url, response);
                                } else {
                                    console.warn(`[SW] Failed to cache ${url}: ${response.status}`);
                                    return Promise.resolve(); // No fallar la instalación
                                }
                            })
                            .catch(error => {
                                console.warn(`[SW] Failed to fetch ${url}:`, error);
                                // No lanzar error, continuar con otros archivos
                                return Promise.resolve();
                            });
                    })
                ).then(results => {
                    const failed = results.filter(r => r.status === 'rejected').length;
                    const succeeded = results.filter(r => r.status === 'fulfilled').length;
                    console.log(`[SW] Cached ${succeeded}/${STATIC_ASSETS.length} assets${failed > 0 ? `, ${failed} failed` : ''}`);
                });
            })
            .then(() => {
                console.log(`[SW] v${VERSION} - Static assets caching completed`);
                // NO llamar skipWaiting() aquí - esperamos a que el cliente lo solicite
                // Esto permite que el usuario decida cuándo actualizar
            })
            .catch((error) => {
                console.error('[SW] Failed to open cache:', error);
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
 * Estrategia mixta:
 * - Network First para archivos JS/HTML (garantiza versión más reciente cuando hay red)
 * - Cache First para assets estáticos (imágenes, fonts, etc.)
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
    
    const url = new URL(event.request.url);
    const isJSorHTML = url.pathname.endsWith('.js') || 
                       url.pathname.endsWith('.html') ||
                       url.pathname.endsWith('/');
    
    if (isJSorHTML) {
        // Network First para archivos críticos
        event.respondWith(networkFirstStrategy(event.request));
    } else {
        // Cache First para otros assets
        event.respondWith(cacheFirstStrategy(event.request));
    }
});

/**
 * Estrategia Network First - intenta red primero, cache como fallback
 */
async function networkFirstStrategy(request) {
    try {
        const response = await fetch(request, { cache: 'no-cache' });
        if (response.ok) {
            const cache = await caches.open(CACHE_NAME);
            cache.put(request, response.clone());
        }
        return response;
    } catch (error) {
        const cachedResponse = await caches.match(request);
        if (cachedResponse) {
            return cachedResponse;
        }
        // Si es navegación y no hay cache, devolver index.html
        if (request.mode === 'navigate') {
            return caches.match(`${BASE_PATH}/index.html`);
        }
        throw error;
    }
}

/**
 * Estrategia Cache First - cache primero, red como fallback
 */
async function cacheFirstStrategy(request) {
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
        // Actualizar cache en background (stale-while-revalidate)
        fetchAndCache(request);
        return cachedResponse;
    }
    return fetchAndCache(request);
}

/**
 * Obtener recurso de red y cachear (para stale-while-revalidate)
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
        // En background update, los errores son normales (offline)
        // No propagar para evitar logs innecesarios
        const cachedResponse = await caches.match(request);
        if (cachedResponse) {
            return cachedResponse;
        }
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
        event.ports[0].postMessage({ version: VERSION, cacheName: CACHE_NAME });
    }
    
    // Forzar actualización: limpiar cache y recargar
    if (event.data && event.data.type === 'FORCE_UPDATE') {
        caches.keys().then(names => {
            return Promise.all(names.map(name => caches.delete(name)));
        }).then(() => {
            self.skipWaiting();
        });
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
