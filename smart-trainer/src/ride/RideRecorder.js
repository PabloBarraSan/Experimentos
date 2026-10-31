/**
 * RideRecorder - Graba un ride virtual como sesión del historial
 * Smart Trainer - Virtual Cycling
 *
 * Toma muestras del estado del RideEngine (como máximo 1/s) y guarda la sesión
 * con la distancia del motor (no la integrada por velocidad), para poder
 * usarla después como fantasma en la misma ruta.
 */

import { createSession, finishSession } from '../storage/sessions.js';
import { flushSyncOutbox } from '../sync/TrainingAppSync.js';
import { calculateSessionMetrics } from '../utils/calculations.js';
import { RIDE_STATUS } from './RideState.js';

// Por debajo de esto el ride no se guarda (un clic accidental no debe ensuciar el historial)
export const MIN_SAVED_SECONDS = 120;
export const MIN_SAVED_METERS = 500;

/**
 * Crear un grabador para un ride
 * @param {Object} options - { ftp }
 */
export function createRideRecorder({ ftp = 200 } = {}) {
    let session = null;
    let lastSampleSecond = -1;
    let finished = false;

    /**
     * Empezar a grabar (llamar al arrancar el ride, con la ruta ya cargada)
     */
    function start(rideState) {
        session = createSession({
            workoutName: rideState.route.name || 'Ciclismo virtual',
            ftp,
            routeId: rideState.route.id || null,
            routeName: rideState.route.name || null,
            experienceMode: 'ride',
        });
        lastSampleSecond = -1;
        finished = false;
    }

    function pushSample(rideState, elapsedSeconds) {
        const { bikeData, position, route } = rideState;
        session.dataPoints.push({
            timestamp: Date.now(),
            elapsedSeconds,
            power: bikeData.power || 0,
            cadence: bikeData.cadence || 0,
            speed: position.virtualSpeed || 0,
            heartRate: bikeData.heartRate || 0,
            resistance: 0,
            // Distancia del motor (m), sin pasarse de la meta
            distance: Math.round(Math.min(position.distance, route.length || position.distance)),
        });
        lastSampleSecond = Math.floor(elapsedSeconds);
    }

    /**
     * Registrar una muestra si ha pasado al menos 1 s de ride (se ignora en pausa)
     */
    function sample(rideState) {
        if (!session || finished || rideState.status !== RIDE_STATUS.PLAYING) return;
        const elapsedSeconds = rideState.elapsedTime / 1000;
        if (Math.floor(elapsedSeconds) > lastSampleSecond) {
            pushSample(rideState, elapsedSeconds);
        }
    }

    /**
     * Cerrar y guardar la sesión. Devuelve null si el ride fue demasiado corto.
     * @param {Object} rideState - Estado final del motor
     * @param {'completed'|'abandoned'} status
     */
    async function finish(rideState, status = 'abandoned') {
        if (!session || finished) return null;
        finished = true;

        const elapsedSeconds = rideState.elapsedTime / 1000;
        const distance = Math.min(rideState.position.distance, rideState.route.length || rideState.position.distance);
        if (elapsedSeconds < MIN_SAVED_SECONDS || distance < MIN_SAVED_METERS) return null;

        // Muestra final para que la traza llegue hasta donde terminó el ride
        const last = session.dataPoints[session.dataPoints.length - 1];
        if (!last || elapsedSeconds > last.elapsedSeconds) pushSample(rideState, elapsedSeconds);

        const metrics = calculateSessionMetrics({
            dataPoints: session.dataPoints,
            duration: elapsedSeconds,
        }, ftp);
        metrics.distance = Math.round(distance);
        session.elapsedTime = elapsedSeconds;

        const saved = await finishSession(session, metrics, status);
        flushSyncOutbox().catch(() => {});
        return saved;
    }

    return { start, sample, finish };
}
