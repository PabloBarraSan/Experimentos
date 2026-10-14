/**
 * Routes Storage - Rutas GPX importadas para el ciclismo virtual
 * Smart Trainer Controller
 *
 * Usa una base IndexedDB propia ('SmartTrainerRoutes') para no tener que
 * migrar 'SmartTrainerDB'. Todo se guarda en local; nada se sube.
 */

const DB_NAME = 'SmartTrainerRoutes';
const DB_VERSION = 1;
const ROUTES_STORE = 'routes';

let dbPromise = null;

/**
 * Abrir (o reutilizar) la base de datos
 */
function openDB() {
    if (dbPromise) return dbPromise;

    dbPromise = new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onupgradeneeded = () => {
            const database = request.result;
            if (!database.objectStoreNames.contains(ROUTES_STORE)) {
                database.createObjectStore(ROUTES_STORE, { keyPath: 'id' });
            }
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => {
            dbPromise = null;
            reject(request.error);
        };
    });
    return dbPromise;
}

/**
 * Convertir una IDBRequest en promesa
 */
function promisify(request) {
    return new Promise((resolve, reject) => {
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

/**
 * Hash FNV-1a (hex) para que reimportar el mismo GPX no duplique la ruta
 */
function hashRoute(route) {
    const first = route.points[0];
    const last = route.points[route.points.length - 1];
    const source = [
        route.name,
        Math.round(route.totalDistance),
        first?.lat, first?.lon, last?.lat, last?.lon,
    ].join('|');

    let hash = 0x811c9dc5;
    for (let i = 0; i < source.length; i++) {
        hash ^= source.charCodeAt(i);
        hash = Math.imul(hash, 0x01000193) >>> 0;
    }
    return hash.toString(16).padStart(8, '0');
}

/**
 * Guardar una ruta (resultado de parseGpx). Devuelve la ruta con id y createdAt.
 */
export async function saveRoute(route) {
    const id = `gpx-${hashRoute(route)}`;
    const stored = { ...route, id, createdAt: Date.now() };

    const database = await openDB();
    const tx = database.transaction(ROUTES_STORE, 'readwrite');
    await promisify(tx.objectStore(ROUTES_STORE).put(stored));
    return stored;
}

/**
 * Listar rutas guardadas solo con metadatos (sin puntos), más recientes primero
 */
export async function getAllRoutes() {
    const database = await openDB();
    const all = await promisify(database.transaction(ROUTES_STORE).objectStore(ROUTES_STORE).getAll());

    return all
        .map(({ id, name, totalDistance, ascent, createdAt }) => ({ id, name, totalDistance, ascent, createdAt }))
        .sort((a, b) => b.createdAt - a.createdAt);
}

/**
 * Obtener una ruta completa (con puntos) por id
 */
export async function getRoute(id) {
    const database = await openDB();
    const route = await promisify(database.transaction(ROUTES_STORE).objectStore(ROUTES_STORE).get(id));
    return route || null;
}

/**
 * Eliminar una ruta por id
 */
export async function deleteRoute(id) {
    const database = await openDB();
    const tx = database.transaction(ROUTES_STORE, 'readwrite');
    await promisify(tx.objectStore(ROUTES_STORE).delete(id));
}
