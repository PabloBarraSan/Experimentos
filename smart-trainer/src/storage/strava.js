/**
 * Strava Integration Module
 * Smart Trainer Controller
 * 
 * Este módulo prepara la integración con Strava para subir actividades.
 * 
 * REQUISITOS PARA ACTIVAR:
 * 1. Crear una app en https://www.strava.com/settings/api
 * 2. Configurar STRAVA_CLIENT_ID y STRAVA_CLIENT_SECRET
 * 3. Configurar redirect URI en Strava: tu-dominio.com/strava/callback
 * 
 * FLUJO OAuth2:
 * 1. Usuario pulsa "Conectar con Strava"
 * 2. Redirigir a Strava para autorización
 * 3. Strava redirige de vuelta con código
 * 4. Intercambiar código por access_token + refresh_token
 * 5. Guardar tokens en localStorage
 * 6. Usar access_token para subir actividades
 */

import { exportToTCX, saveSession, getSession } from './sessions.js';

// === CONFIGURACIÓN (PLACEHOLDERS) ===
// Reemplazar con valores reales al activar la integración
const STRAVA_CONFIG = {
    clientId: 'TU_CLIENT_ID',          // Obtener de https://www.strava.com/settings/api
    clientSecret: 'TU_CLIENT_SECRET',  // NUNCA exponer en frontend en producción
    redirectUri: `${window.location.origin}/strava/callback`,
    scope: 'activity:write,activity:read',
    authUrl: 'https://www.strava.com/oauth/authorize',
    tokenUrl: 'https://www.strava.com/oauth/token',
    uploadUrl: 'https://www.strava.com/api/v3/uploads',
    uploadStatusUrl: 'https://www.strava.com/api/v3/uploads',
};

// Keys para localStorage
const STORAGE_KEYS = {
    accessToken: 'strava_access_token',
    refreshToken: 'strava_refresh_token',
    expiresAt: 'strava_expires_at',
    athleteId: 'strava_athlete_id',
};

// === ESTADO ===

/**
 * Verificar si hay sesión de Strava activa
 */
export function isStravaConnected() {
    const accessToken = localStorage.getItem(STORAGE_KEYS.accessToken);
    const expiresAt = localStorage.getItem(STORAGE_KEYS.expiresAt);
    
    if (!accessToken || !expiresAt) return false;
    
    // Verificar si el token ha expirado
    return Date.now() < parseInt(expiresAt, 10);
}

/**
 * Obtener información del atleta conectado
 */
export function getStravaAthlete() {
    if (!isStravaConnected()) return null;
    
    return {
        id: localStorage.getItem(STORAGE_KEYS.athleteId),
        // Se podría cachear más info del atleta aquí
    };
}

// === AUTENTICACIÓN ===

/**
 * Iniciar flujo OAuth con Strava
 * Redirige al usuario a Strava para autorización
 */
export function connectToStrava() {
    const params = new URLSearchParams({
        client_id: STRAVA_CONFIG.clientId,
        redirect_uri: STRAVA_CONFIG.redirectUri,
        response_type: 'code',
        scope: STRAVA_CONFIG.scope,
        approval_prompt: 'auto',
    });
    
    window.location.href = `${STRAVA_CONFIG.authUrl}?${params.toString()}`;
}

/**
 * Manejar callback de Strava después de autorización
 * Llamar esta función cuando el usuario vuelve de Strava
 * 
 * @param {string} code - Código de autorización de Strava
 * @returns {Promise<boolean>} - true si éxito
 */
export async function handleStravaCallback(code) {
    try {
        // NOTA: En producción, este intercambio debe hacerse en el backend
        // para no exponer client_secret en el frontend
        const response = await fetch(STRAVA_CONFIG.tokenUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                client_id: STRAVA_CONFIG.clientId,
                client_secret: STRAVA_CONFIG.clientSecret,
                code,
                grant_type: 'authorization_code',
            }),
        });
        
        if (!response.ok) {
            throw new Error('Error en intercambio de token');
        }
        
        const data = await response.json();
        
        // Guardar tokens
        localStorage.setItem(STORAGE_KEYS.accessToken, data.access_token);
        localStorage.setItem(STORAGE_KEYS.refreshToken, data.refresh_token);
        localStorage.setItem(STORAGE_KEYS.expiresAt, String(data.expires_at * 1000));
        localStorage.setItem(STORAGE_KEYS.athleteId, String(data.athlete?.id));
        
        console.log('✅ Conectado a Strava:', data.athlete?.firstname);
        return true;
    } catch (error) {
        console.error('Error conectando a Strava:', error);
        return false;
    }
}

/**
 * Refrescar access token si está expirado
 */
export async function refreshStravaToken() {
    const refreshToken = localStorage.getItem(STORAGE_KEYS.refreshToken);
    if (!refreshToken) {
        throw new Error('No hay refresh token');
    }
    
    try {
        // NOTA: En producción, hacer esto en el backend
        const response = await fetch(STRAVA_CONFIG.tokenUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                client_id: STRAVA_CONFIG.clientId,
                client_secret: STRAVA_CONFIG.clientSecret,
                refresh_token: refreshToken,
                grant_type: 'refresh_token',
            }),
        });
        
        if (!response.ok) {
            throw new Error('Error refrescando token');
        }
        
        const data = await response.json();
        
        localStorage.setItem(STORAGE_KEYS.accessToken, data.access_token);
        localStorage.setItem(STORAGE_KEYS.refreshToken, data.refresh_token);
        localStorage.setItem(STORAGE_KEYS.expiresAt, String(data.expires_at * 1000));
        
        return data.access_token;
    } catch (error) {
        console.error('Error refrescando token de Strava:', error);
        disconnectFromStrava();
        throw error;
    }
}

/**
 * Desconectar de Strava (logout local)
 */
export function disconnectFromStrava() {
    localStorage.removeItem(STORAGE_KEYS.accessToken);
    localStorage.removeItem(STORAGE_KEYS.refreshToken);
    localStorage.removeItem(STORAGE_KEYS.expiresAt);
    localStorage.removeItem(STORAGE_KEYS.athleteId);
    console.log('🔌 Desconectado de Strava');
}

/**
 * Obtener access token válido (refrescando si es necesario)
 */
async function getValidAccessToken() {
    const expiresAt = parseInt(localStorage.getItem(STORAGE_KEYS.expiresAt) || '0', 10);
    
    // Si expira en menos de 5 minutos, refrescar
    if (Date.now() > expiresAt - 5 * 60 * 1000) {
        return await refreshStravaToken();
    }
    
    return localStorage.getItem(STORAGE_KEYS.accessToken);
}

// === SUBIDA DE ACTIVIDADES ===

/**
 * Subir una sesión a Strava
 * 
 * @param {string} sessionId - ID de la sesión en IndexedDB
 * @returns {Promise<{success: boolean, activityId?: string, error?: string}>}
 */
export async function uploadSessionToStrava(sessionId) {
    try {
        // 1. Verificar conexión
        if (!isStravaConnected()) {
            return { success: false, error: 'No conectado a Strava' };
        }
        
        // 2. Obtener sesión
        const session = await getSession(sessionId);
        if (!session) {
            return { success: false, error: 'Sesión no encontrada' };
        }
        
        // 3. Verificar que no esté ya sincronizada
        if (session.syncStatus?.strava?.synced) {
            return { 
                success: true, 
                activityId: session.syncStatus.strava.activityId,
                message: 'Ya sincronizada' 
            };
        }
        
        // 4. Obtener token válido
        const accessToken = await getValidAccessToken();
        
        // 5. Generar archivo TCX
        const tcxContent = exportToTCX(session);
        const tcxBlob = new Blob([tcxContent], { type: 'application/vnd.garmin.tcx+xml' });
        const tcxFile = new File([tcxBlob], `${session.id}.tcx`, { type: 'application/vnd.garmin.tcx+xml' });
        
        // 6. Subir a Strava
        const formData = new FormData();
        formData.append('file', tcxFile);
        formData.append('data_type', 'tcx');
        formData.append('name', session.workoutName || 'Smart Trainer Session');
        formData.append('description', `Entrenamiento con Smart Trainer Controller\nTSS: ${session.metrics?.intensity?.tss || 'N/A'}`);
        formData.append('trainer', '1'); // Es un entrenamiento en rodillo
        formData.append('commute', '0');
        
        const uploadResponse = await fetch(STRAVA_CONFIG.uploadUrl, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
            },
            body: formData,
        });
        
        if (!uploadResponse.ok) {
            const errorData = await uploadResponse.json();
            throw new Error(errorData.message || 'Error en upload');
        }
        
        const uploadData = await uploadResponse.json();
        
        // 7. Esperar a que Strava procese el archivo
        const activityId = await pollUploadStatus(uploadData.id, accessToken);
        
        // 8. Actualizar sesión con info de sincronización
        session.syncStatus = session.syncStatus || {};
        session.syncStatus.strava = {
            synced: true,
            activityId,
            syncedAt: new Date().toISOString(),
            error: null,
        };
        await saveSession(session);
        
        console.log('✅ Actividad subida a Strava:', activityId);
        return { success: true, activityId };
        
    } catch (error) {
        console.error('Error subiendo a Strava:', error);
        
        // Guardar error en la sesión
        try {
            const session = await getSession(sessionId);
            if (session) {
                session.syncStatus = session.syncStatus || {};
                session.syncStatus.strava = {
                    ...session.syncStatus.strava,
                    synced: false,
                    error: error.message,
                };
                await saveSession(session);
            }
        } catch (e) {
            // Ignorar error secundario
        }
        
        return { success: false, error: error.message };
    }
}

/**
 * Esperar a que Strava procese el archivo subido
 * 
 * @param {string} uploadId - ID del upload
 * @param {string} accessToken - Token de acceso
 * @returns {Promise<string>} - Activity ID
 */
async function pollUploadStatus(uploadId, accessToken) {
    const maxAttempts = 30;
    const pollInterval = 2000; // 2 segundos
    
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
        await new Promise(resolve => setTimeout(resolve, pollInterval));
        
        const response = await fetch(`${STRAVA_CONFIG.uploadStatusUrl}/${uploadId}`, {
            headers: {
                'Authorization': `Bearer ${accessToken}`,
            },
        });
        
        if (!response.ok) {
            throw new Error('Error verificando estado de upload');
        }
        
        const data = await response.json();
        
        if (data.activity_id) {
            return String(data.activity_id);
        }
        
        if (data.error) {
            throw new Error(data.error);
        }
        
        // Status puede ser: 'Your activity is still being processed.'
        console.log(`⏳ Procesando... (${attempt + 1}/${maxAttempts})`);
    }
    
    throw new Error('Timeout esperando procesamiento de Strava');
}

// === UTILIDADES ===

/**
 * Preparar archivo TCX para descarga manual (subida manual a Strava)
 * 
 * @param {Object} session - Sesión de entrenamiento
 * @returns {string} - URL de descarga (blob URL)
 */
export function prepareDownloadForStrava(session) {
    const tcxContent = exportToTCX(session);
    const blob = new Blob([tcxContent], { type: 'application/vnd.garmin.tcx+xml' });
    return URL.createObjectURL(blob);
}

/**
 * Obtener URL para subida manual a Strava
 */
export function getStravaManualUploadUrl() {
    return 'https://www.strava.com/upload/select';
}
