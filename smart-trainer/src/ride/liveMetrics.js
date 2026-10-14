/**
 * liveMetrics - Métricas de potencia en vivo para el HUD del ride
 * Smart Trainer - Virtual Cycling
 *
 * Módulo puro (sin DOM): recibe muestras de potencia con su dt real y mantiene
 * medias móviles, NP/IF/TSS, kJ, W'bal y mejores esfuerzos por ventana.
 * Todo se actualiza de forma incremental (O(1) por muestra) para poder
 * llamarlo a ~20 Hz durante horas sin degradar.
 */

import { calculateIF, calculateTSS, calculateWattsPerKg } from '../utils/calculations.js';

// Ventanas (s) para los mejores esfuerzos de la sesión
export const BEST_WINDOWS = [5, 60, 300, 1200];

// Segundos de historial a 1 Hz que se exponen para la gráfica
const HISTORY_SECONDS = 120;

// Ventana de la potencia normalizada (media móvil de 30 s, como calculateNP)
const NP_WINDOW = 30;

// Un dt mayor que esto se considera una pausa/hueco y no se integra
const MAX_DT_SECONDS = 5;

// Protección frente a lecturas absurdas del sensor
const MAX_POWER = 3000;

// Constantes del modelo W'bal (Skiba 2015, forma diferencial)
const TAU_BASE = 316;
const TAU_RANGE = 546;
const TAU_DECAY = 0.01;

/**
 * Normalizar una lectura de potencia: finita, >= 0 y acotada
 */
function sanitizePower(power) {
    const value = Number(power);
    if (!Number.isFinite(value) || value < 0) return 0;
    return Math.min(value, MAX_POWER);
}

/**
 * Crear el acumulador de métricas en vivo
 *
 * @param {Object} options
 * @param {number} options.ftp - FTP en W (se usa como CP del modelo W'bal)
 * @param {number} options.weight - Peso en kg (para W/kg)
 * @param {number} [options.wPrimeJ=20000] - W' en julios
 */
export function createLiveMetrics({ ftp = 200, weight = 70, wPrimeJ = 20000 } = {}) {
    const cp = Number.isFinite(ftp) && ftp > 0 ? ftp : 0;
    const wPrime = Number.isFinite(wPrimeJ) && wPrimeJ > 0 ? wPrimeJ : 20000;

    // Muestras a 1 Hz: la suma acumulada (prefix[i] = suma de las i primeras)
    // permite cualquier media de ventana en O(1)
    let prefix;
    let sampleCount;
    let history; // últimos HISTORY_SECONDS valores (se recorta por lotes)
    let historyCache;
    let historyCacheCount;

    // Segundo en curso (se promedia por tiempo para tolerar dt irregulares)
    let binEnergy;
    let binTime;

    // Totales exactos (no dependen del binning)
    let totalJoules;
    let movingSeconds;

    // NP incremental
    let npWindow; // últimos NP_WINDOW valores
    let npWindowSum;
    let npFourthSum;
    let npCount;

    let wBal;
    let bests;
    let lastElapsed;

    function reset() {
        prefix = [0];
        sampleCount = 0;
        history = [];
        historyCache = [];
        historyCacheCount = -1;
        binEnergy = 0;
        binTime = 0;
        totalJoules = 0;
        movingSeconds = 0;
        npWindow = [];
        npWindowSum = 0;
        npFourthSum = 0;
        npCount = 0;
        wBal = wPrime;
        bests = BEST_WINDOWS.map(() => null);
        lastElapsed = null;
    }

    /**
     * Media de las últimas `n` muestras completadas (o de las que haya)
     */
    function trailingAverage(n) {
        if (sampleCount === 0) return 0;
        const span = Math.min(n, sampleCount);
        return (prefix[sampleCount] - prefix[sampleCount - span]) / span;
    }

    /**
     * Registrar un segundo completo de potencia media
     */
    function pushSample(value) {
        sampleCount++;
        prefix.push(prefix[sampleCount - 1] + value);

        history.push(value);
        if (history.length > HISTORY_SECONDS * 2) history = history.slice(-HISTORY_SECONDS);

        // NP: media móvil de 30 s elevada a la 4ª
        npWindow.push(value);
        npWindowSum += value;
        if (npWindow.length > NP_WINDOW) npWindowSum -= npWindow.shift();
        if (npWindow.length === NP_WINDOW) {
            const rolling = npWindowSum / NP_WINDOW;
            npFourthSum += rolling ** 4;
            npCount++;
        }

        // Mejores esfuerzos
        BEST_WINDOWS.forEach((window, i) => {
            if (sampleCount < window) return;
            const avg = (prefix[sampleCount] - prefix[sampleCount - window]) / window;
            if (bests[i] === null || avg > bests[i]) bests[i] = avg;
        });
    }

    /**
     * Integrar el W'bal para un tramo de dt segundos a potencia constante
     */
    function stepWBal(power, dt) {
        if (cp <= 0) return;
        if (power > cp) {
            wBal -= (power - cp) * dt;
        } else {
            const deficit = cp - power;
            const tau = TAU_RANGE * Math.exp(-TAU_DECAY * deficit) + TAU_BASE;
            wBal += (wPrime - wBal) * (1 - Math.exp(-dt / tau));
        }
        wBal = Math.min(wPrime, Math.max(0, wBal));
    }

    /**
     * Añadir un tramo de potencia
     *
     * @param {Object} sample
     * @param {number} sample.power - Potencia en W (se tolera undefined/NaN)
     * @param {number} [sample.dtSeconds] - Duración del tramo; si falta se deduce de elapsedSeconds
     * @param {number} [sample.elapsedSeconds] - Tiempo de ride acumulado
     */
    function update({ power, dtSeconds, elapsedSeconds } = {}) {
        let dt = Number(dtSeconds);
        if (!Number.isFinite(dt) && Number.isFinite(elapsedSeconds) && lastElapsed !== null) {
            dt = elapsedSeconds - lastElapsed;
        }
        if (Number.isFinite(elapsedSeconds)) lastElapsed = elapsedSeconds;

        // dt inválido, nulo o un hueco largo (pausa): no se integra
        if (!Number.isFinite(dt) || dt <= 0 || dt > MAX_DT_SECONDS) return;

        const p = sanitizePower(power);

        totalJoules += p * dt;
        movingSeconds += dt;
        stepWBal(p, dt);

        // Repartir el tramo entre segundos naturales
        let remaining = dt;
        while (remaining > 1e-9) {
            const take = Math.min(remaining, 1 - binTime);
            binEnergy += p * take;
            binTime += take;
            remaining -= take;
            if (binTime >= 1 - 1e-9) {
                pushSample(binEnergy / binTime);
                binEnergy = 0;
                binTime = 0;
            }
        }
    }

    /**
     * Estado actual de todas las métricas
     */
    function snapshot() {
        const avgPower = movingSeconds > 0 ? totalJoules / movingSeconds : 0;
        // Antes de 30 s no hay NP: se usa la media (mismo criterio que calculateNP)
        const np = npCount > 0 ? Math.pow(npFourthSum / npCount, 0.25) : avgPower;
        const power3s = trailingAverage(3);

        if (historyCacheCount !== sampleCount) {
            historyCache = history.slice(-HISTORY_SECONDS);
            historyCacheCount = sampleCount;
        }

        return {
            power3s: Math.round(power3s),
            power10s: Math.round(trailingAverage(10)),
            avgPower: Math.round(avgPower),
            np: Math.round(np),
            if: calculateIF(np, cp),
            tss: calculateTSS(np, movingSeconds, cp),
            kj: Math.round(totalJoules / 1000),
            wattsPerKg: calculateWattsPerKg(power3s, weight),
            wBalPct: Math.round((wBal / wPrime) * 100),
            bests: {
                '5s': bests[0] === null ? null : Math.round(bests[0]),
                '60s': bests[1] === null ? null : Math.round(bests[1]),
                '300s': bests[2] === null ? null : Math.round(bests[2]),
                '1200s': bests[3] === null ? null : Math.round(bests[3]),
            },
            history: historyCache,
            sampleCount,
        };
    }

    reset();

    return { update, snapshot, reset };
}
