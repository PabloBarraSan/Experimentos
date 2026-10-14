/**
 * RideHud - HUD del modo ciclismo virtual
 * Smart Trainer - Virtual Cycling
 *
 * Se construye una sola vez (start) y update() solo toca textContent/atributos
 * cuando el valor cambia. Los estilos viven en views/ride-hud.css (clases ride-hud__*).
 */

import '../../views/ride-hud.css';
import { colors, typography } from '../../utils/theme.js';
import { calculatePowerZones, getRideHudPrefs, saveRideHudPrefs } from '../../storage/settings.js';
import { createLiveMetrics } from '../../ride/liveMetrics.js';
import { calculateVAM } from '../../ride/RidePhysics.js';
import { RIDE_STATUS } from '../../ride/RideState.js';
import { createRouteProfile } from './RouteProfile.js';
import { createRidePowerChart } from './RidePowerChart.js';

// Pantallas donde el HUD arranca en modo esencial (móvil / apaisado bajito)
const SMALL_SCREEN_QUERY = '(max-width: 700px), (max-height: 500px)';

// Ventana de la gráfica en vivo (s)
const CHART_WINDOW_SECONDS = 90;

// Tramo siguiente para la pendiente media (m) y ventana del VAM (s)
const NEXT_SEGMENT_METERS = 500;
const VAM_WINDOW_SECONDS = 60;
const VAM_MIN_SECONDS = 15;

const MODES = { essential: 'essential', full: 'full' };

/**
 * Segundos a m:ss (o h:mm:ss)
 */
function formatClock(totalSeconds) {
    const total = Math.max(0, Math.round(totalSeconds));
    const hours = Math.floor(total / 3600);
    const minutes = Math.floor((total % 3600) / 60);
    const ss = (total % 60).toString().padStart(2, '0');
    if (hours > 0) return `${hours}:${minutes.toString().padStart(2, '0')}:${ss}`;
    return `${minutes}:${ss}`;
}

/**
 * Hueco con signo: +0:12 (por delante) / -0:05 (por detrás)
 */
function formatGap(seconds) {
    return `${seconds >= 0 ? '+' : '-'}${formatClock(Math.abs(seconds))}`;
}

function formatSigned(value, decimals = 1) {
    const text = value.toFixed(decimals);
    return value > 0 ? `+${text}` : text;
}

/**
 * Elevación interpolada en una distancia (búsqueda binaria; puntos ordenados por distancia)
 */
function elevationAt(points, distance) {
    const last = points.length - 1;
    if (last < 0) return 0;
    if (distance <= points[0].distance) return points[0].elevation;
    if (distance >= points[last].distance) return points[last].elevation;
    let lo = 0;
    let hi = last;
    while (hi - lo > 1) {
        const mid = (lo + hi) >> 1;
        if (points[mid].distance <= distance) lo = mid;
        else hi = mid;
    }
    const a = points[lo];
    const b = points[hi];
    const span = b.distance - a.distance;
    const t = span > 0 ? (distance - a.distance) / span : 0;
    return a.elevation + (b.elevation - a.elevation) * t;
}

/**
 * Crear un elemento con clase y texto opcional
 */
function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
}

/**
 * Setter de texto que evita tocar el DOM si el valor no cambia
 */
function textSetter(node) {
    let last = null;
    return (value) => {
        if (value !== last) {
            last = value;
            node.textContent = value;
        }
    };
}

/**
 * Setter de propiedad CSS (o variable) con caché
 */
function styleSetter(node, prop) {
    let last = null;
    return (value) => {
        if (value !== last) {
            last = value;
            node.style.setProperty(prop, value);
        }
    };
}

/**
 * Setter de atributo con caché
 */
function attrSetter(node, name) {
    let last = null;
    return (value) => {
        if (value !== last) {
            last = value;
            node.setAttribute(name, value);
        }
    };
}

/**
 * Tarjeta etiqueta + valor (+ unidad)
 */
function createTile({ label, unit = '', className = '' }) {
    const root = el('div', `ride-hud__tile ${className}`.trim());
    root.appendChild(el('span', 'ride-hud__label', label));
    const row = el('div', 'ride-hud__value-row');
    const value = el('span', 'ride-hud__value', '--');
    row.appendChild(value);
    if (unit) row.appendChild(el('span', 'ride-hud__unit', unit));
    root.appendChild(row);
    return { root, value, set: textSetter(value) };
}

const ARROW_SVG = '<svg viewBox="0 0 24 24" width="100%" height="100%" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12h15M13 6l6 6-6 6"/></svg>';

/**
 * Crear el HUD
 *
 * @param {Object} options
 * @param {Function} [options.onModeChange] - Se llama con 'essential' | 'full' al alternar
 * @returns {{ element, start, update, setVisible, destroy }}
 */
export function createRideHud({ onModeChange } = {}) {
    // ---- Estado interno ----
    let zones = [];
    let ftp = 200;
    let metrics = null;
    let route = { points: [], length: 0 };
    let profile = null;
    let lastElapsed = null;
    let elevHistory = [];
    let lastElevSecond = -1;
    let mode = MODES.full;

    const smallScreen = typeof window.matchMedia === 'function' ? window.matchMedia(SMALL_SCREEN_QUERY) : { matches: false };

    // ---- Raíz ----
    const root = el('div', 'ride-hud');
    root.hidden = true;
    root.style.setProperty('--rh-font-display', typography.fontDisplay);
    root.style.setProperty('--rh-font-mono', typography.fontMono);
    root.style.setProperty('--rh-primary', colors.primary);
    root.style.setProperty('--rh-good', colors.success);
    root.style.setProperty('--rh-bad', colors.error);
    root.style.setProperty('--rh-warn', colors.warning);
    root.style.setProperty('--rh-muted', colors.textMuted);
    root.style.setProperty('--rh-zone', colors.zones.z1);

    // ---- Arriba: modo + viaje (tiempo, distancia, perfil) ----
    const top = el('div', 'ride-hud__top');

    const modeBtn = el('button', 'ride-hud__mode');
    modeBtn.type = 'button';
    const setModeLabel = textSetter(modeBtn);
    modeBtn.addEventListener('click', () => applyMode(mode === MODES.full ? MODES.essential : MODES.full, true));
    top.appendChild(modeBtn);

    const trip = el('div', 'ride-hud__trip');
    const tripRow = el('div', 'ride-hud__trip-row');
    const timeTile = createTile({ label: 'Tiempo', className: 'ride-hud__tile--time' });
    const distTile = createTile({ label: 'Recorrido', unit: 'km', className: 'ride-hud__tile--dist' });
    const remainTile = createTile({ label: 'Restan', unit: 'km', className: 'ride-hud__tile--remain' });
    tripRow.append(timeTile.root, distTile.root, remainTile.root);
    trip.appendChild(tripRow);

    const profileSlot = el('div', 'ride-hud__profile-slot');
    trip.appendChild(profileSlot);

    const progress = el('div', 'ride-hud__progress');
    const progressFill = el('div', 'ride-hud__progress-fill');
    progress.appendChild(progressFill);
    trip.appendChild(progress);
    const setProgress = styleSetter(progressFill, 'width');

    const nextRow = el('div', 'ride-hud__next ride-hud__full-only');
    nextRow.appendChild(el('span', 'ride-hud__label', 'Próx. 500 m'));
    const nextValue = el('span', 'ride-hud__next-value', '--');
    nextRow.appendChild(nextValue);
    trip.appendChild(nextRow);
    const setNext = textSetter(nextValue);
    const setNextTrend = attrSetter(nextValue, 'data-trend');

    top.appendChild(trip);
    root.appendChild(top);

    // ---- Izquierda: potencia ----
    const left = el('div', 'ride-hud__left');
    const powerPanel = el('div', 'ride-hud__power');
    powerPanel.appendChild(el('span', 'ride-hud__label', 'Potencia'));
    const powerRow = el('div', 'ride-hud__value-row');
    const powerValue = el('span', 'ride-hud__power-value', '0');
    powerRow.append(powerValue, el('span', 'ride-hud__unit', 'W'));
    powerPanel.appendChild(powerRow);
    const zoneChip = el('div', 'ride-hud__zone');
    const zoneNum = el('span', 'ride-hud__zone-num', 'Z1');
    const zoneName = el('span', 'ride-hud__zone-name', '');
    zoneChip.append(zoneNum, zoneName);
    powerPanel.appendChild(zoneChip);
    left.appendChild(powerPanel);
    const setPower = textSetter(powerValue);
    const setZoneNum = textSetter(zoneNum);
    const setZoneName = textSetter(zoneName);
    const setZoneColor = styleSetter(root, '--rh-zone');

    const secondary = el('div', 'ride-hud__row ride-hud__full-only');
    const p3Tile = createTile({ label: '3 s', unit: 'W' });
    const wkgTile = createTile({ label: 'W/kg' });
    const cadTile = createTile({ label: 'Cad', unit: 'rpm' });
    const hrTile = createTile({ label: 'FC', unit: 'bpm', className: 'ride-hud__tile--hr' });
    secondary.append(p3Tile.root, wkgTile.root, cadTile.root, hrTile.root);
    left.appendChild(secondary);
    root.appendChild(left);

    // ---- Derecha: velocidad, pendiente, fantasma, altimetría ----
    const right = el('div', 'ride-hud__right');
    const speedTile = createTile({ label: 'Velocidad', unit: 'km/h', className: 'ride-hud__tile--speed' });
    right.appendChild(speedTile.root);

    const gradeTile = el('div', 'ride-hud__tile ride-hud__tile--grade');
    gradeTile.setAttribute('data-trend', 'flat');
    gradeTile.appendChild(el('span', 'ride-hud__label', 'Pendiente'));
    const gradeRow = el('div', 'ride-hud__value-row');
    const gradeArrow = el('span', 'ride-hud__arrow');
    gradeArrow.innerHTML = ARROW_SVG; // SVG estático propio, sin datos externos
    const gradeValue = el('span', 'ride-hud__value', '0.0');
    gradeRow.append(gradeArrow, gradeValue, el('span', 'ride-hud__unit', '%'));
    gradeTile.appendChild(gradeRow);
    right.appendChild(gradeTile);
    const setGrade = textSetter(gradeValue);
    const setGradeTrend = attrSetter(gradeTile, 'data-trend');
    const setArrowRotation = styleSetter(gradeArrow, 'transform');

    const ghostTile = createTile({ label: 'Fantasma', unit: '', className: 'ride-hud__tile--ghost' });
    ghostTile.root.hidden = true;
    const ghostMeters = ghostTile.root.querySelector('.ride-hud__value-row');
    const ghostUnit = el('span', 'ride-hud__unit', '+0 m');
    ghostMeters.appendChild(ghostUnit);
    right.appendChild(ghostTile.root);
    const setGhostMeters = textSetter(ghostUnit);
    const setGhostTrend = attrSetter(ghostTile.root, 'data-trend');

    const altTile = createTile({ label: 'Altitud', unit: 'm', className: 'ride-hud__full-only ride-hud__tertiary' });
    const ascentTile = createTile({ label: 'Ascenso', unit: 'm', className: 'ride-hud__full-only ride-hud__tertiary' });
    const vamTile = createTile({ label: 'VAM', unit: 'm/h', className: 'ride-hud__full-only ride-hud__tertiary' });
    right.append(altTile.root, ascentTile.root, vamTile.root);
    root.appendChild(right);

    // ---- Abajo: gráfica y métricas de sesión ----
    const bottom = el('div', 'ride-hud__bottom ride-hud__full-only');
    const chartBox = el('div', 'ride-hud__chart');
    const chart = createRidePowerChart({ windowSeconds: CHART_WINDOW_SECONDS });
    chartBox.appendChild(chart.element);
    bottom.appendChild(chartBox);

    const session = el('div', 'ride-hud__session');
    const npTile = createTile({ label: 'NP', unit: 'W' });
    const ifTile = createTile({ label: 'IF' });
    const tssTile = createTile({ label: 'TSS' });
    const kjTile = createTile({ label: 'kJ' });

    const wbalTile = el('div', 'ride-hud__tile ride-hud__tile--wbal');
    wbalTile.appendChild(el('span', 'ride-hud__label', 'W′bal'));
    const wbalRow = el('div', 'ride-hud__value-row');
    const wbalValue = el('span', 'ride-hud__value', '100');
    wbalRow.append(wbalValue, el('span', 'ride-hud__unit', '%'));
    wbalTile.appendChild(wbalRow);
    const wbalBar = el('div', 'ride-hud__bar');
    const wbalFill = el('div', 'ride-hud__bar-fill');
    wbalBar.appendChild(wbalFill);
    wbalTile.appendChild(wbalBar);
    const setWbal = textSetter(wbalValue);
    const setWbalWidth = styleSetter(wbalFill, 'width');
    const setWbalLevel = attrSetter(wbalTile, 'data-level');

    session.append(npTile.root, ifTile.root, tssTile.root, kjTile.root, wbalTile);

    const bestsRow = el('div', 'ride-hud__bests ride-hud__tertiary');
    const bestTiles = {
        '5s': createTile({ label: 'Mejor 5 s', unit: 'W' }),
        '60s': createTile({ label: 'Mejor 1 min', unit: 'W' }),
        '300s': createTile({ label: 'Mejor 5 min', unit: 'W' }),
        '1200s': createTile({ label: 'Mejor 20 min', unit: 'W' }),
    };
    Object.values(bestTiles).forEach((tile) => bestsRow.appendChild(tile.root));
    session.appendChild(bestsRow);
    bottom.appendChild(session);
    root.appendChild(bottom);

    // ---- Indicador de pausa ----
    const pause = el('div', 'ride-hud__pause');
    pause.hidden = true;
    pause.appendChild(el('span', 'ride-hud__pause-title', 'PAUSA'));
    pause.appendChild(el('span', 'ride-hud__pause-hint', 'Pedalea para continuar'));
    root.appendChild(pause);
    let pauseShown = false;

    // ---- Modo ----
    function applyMode(nextMode, persist) {
        mode = nextMode;
        root.setAttribute('data-mode', mode);
        setModeLabel(mode === MODES.full ? 'Vista: completa' : 'Vista: esencial');
        modeBtn.setAttribute('aria-pressed', mode === MODES.full ? 'true' : 'false');
        modeBtn.title = mode === MODES.full ? 'Cambiar a vista esencial' : 'Cambiar a vista completa';
        if (persist) {
            saveRideHudPrefs({ mode });
            if (onModeChange) onModeChange(mode);
        }
    }

    function resolveInitialMode() {
        const saved = getRideHudPrefs().mode;
        if (saved) return saved;
        return smallScreen.matches ? MODES.essential : MODES.full;
    }

    // ---- Ciclo de vida ----

    /**
     * Preparar el HUD para un ride nuevo (rutas, zonas y métricas desde cero)
     * @param {Object} rideState - Estado del motor (ftp, weight, route.points, route.length)
     */
    function start(rideState) {
        ftp = rideState.ftp || 200;
        zones = calculatePowerZones(ftp);
        metrics = createLiveMetrics({ ftp, weight: rideState.weight || 70 });
        chart.configure({ zones, ftp });
        route = { points: rideState.route?.points || [], length: rideState.route?.length || 0 };
        lastElapsed = rideState.elapsedTime || 0;
        elevHistory = [];
        lastElevSecond = -1;

        // Perfil nuevo para la ruta (única reconstrucción de DOM del perfil)
        profileSlot.replaceChildren();
        profile = null;
        if (route.points.length >= 2) {
            profile = createRouteProfile(route.points);
            profileSlot.appendChild(profile.element);
        }

        applyMode(resolveInitialMode(), false);
        setGhostVisible(!!rideState.ghost);
        pause.hidden = true;
        pauseShown = false;
        update(rideState);
    }

    let ghostVisible = false;
    function setGhostVisible(visible) {
        if (visible !== ghostVisible) {
            ghostVisible = visible;
            ghostTile.root.hidden = !visible;
        }
    }

    function zoneIndexFor(power) {
        for (let i = zones.length - 1; i >= 0; i--) {
            if (power >= zones[i].minWatts) return i;
        }
        return 0;
    }

    /**
     * Actualizar con el estado del ride (llamado a ~20 Hz)
     */
    function update(rideState) {
        if (!metrics) return;
        const { bikeData, position, status, elapsedTime } = rideState;
        const elapsedSeconds = elapsedTime / 1000;
        const power = Math.max(0, Math.round(bikeData.power || 0));
        const playing = status === RIDE_STATUS.PLAYING;

        // Pausa
        const paused = status === RIDE_STATUS.PAUSED;
        if (paused !== pauseShown) {
            pauseShown = paused;
            pause.hidden = !paused;
        }

        // Métricas de sesión: solo avanzan jugando (la pausa no integra)
        if (playing) {
            const dt = (elapsedTime - lastElapsed) / 1000;
            if (dt > 0) metrics.update({ power: bikeData.power, dtSeconds: dt, elapsedSeconds });
        }
        lastElapsed = elapsedTime;
        const snap = metrics.snapshot();

        // Potencia y zona (una sola definición: settings)
        const zone = zones[zoneIndexFor(power)];
        setPower(String(power));
        if (zone) {
            setZoneNum(zone.key.toUpperCase());
            setZoneName(zone.name);
            setZoneColor(zone.color);
        }

        // Viaje: tiempo, distancia, restante y progreso
        const distance = position.distance || 0;
        const remaining = Math.max(0, route.length - distance);
        timeTile.set(formatClock(elapsedSeconds));
        distTile.set((distance / 1000).toFixed(2));
        remainTile.set((remaining / 1000).toFixed(2));
        setProgress(`${route.length > 0 ? Math.min(100, (distance / route.length) * 100).toFixed(1) : 0}%`);

        // Pendiente actual y media del tramo siguiente
        const grade = Number.isFinite(rideState.currentGrade) ? rideState.currentGrade : 0;
        setGrade(grade.toFixed(1));
        const trend = grade > 0.5 ? 'up' : grade < -0.5 ? 'down' : 'flat';
        setGradeTrend(trend);
        setArrowRotation(`rotate(${Math.round(-Math.max(-20, Math.min(20, grade)) * 2)}deg)`);

        if (mode === MODES.full) {
            const span = Math.min(NEXT_SEGMENT_METERS, remaining);
            if (span >= 50 && route.points.length > 1) {
                const nextGrade = ((elevationAt(route.points, distance + span) - elevationAt(route.points, distance)) / span) * 100;
                setNext(`${formatSigned(nextGrade)} %`);
                setNextTrend(nextGrade > 0.5 ? 'up' : nextGrade < -0.5 ? 'down' : 'flat');
            } else {
                setNext('--');
                setNextTrend('flat');
            }
        }

        // Marcadores del perfil
        if (profile) {
            profile.setMarkers(distance, rideState.ghost ? rideState.ghost.distance : null, rideState.bots);
        }

        // Derecha
        speedTile.set((position.virtualSpeed || 0).toFixed(1));
        setGhostVisible(!!rideState.ghost);
        if (rideState.ghost) {
            const { gapSeconds, gapMeters } = rideState.ghost;
            ghostTile.set(formatGap(gapSeconds));
            setGhostMeters(`${gapMeters >= 0 ? '+' : '-'}${Math.abs(Math.round(gapMeters))} m`);
            setGhostTrend(gapSeconds >= 0 ? 'up' : 'down');
        }

        // Resto de métricas: en modo esencial no se calculan ni se pintan
        if (mode !== MODES.full) return;

        p3Tile.set(String(snap.power3s));
        wkgTile.set(snap.wattsPerKg.toFixed(2));
        cadTile.set(bikeData.cadence > 0 ? String(Math.round(bikeData.cadence)) : '--');
        hrTile.set(bikeData.heartRate > 0 ? String(Math.round(bikeData.heartRate)) : '--');

        const elevation = position.elevation || 0;
        altTile.set(String(Math.round(elevation)));
        ascentTile.set(String(Math.round(rideState.stats?.totalAscent || 0)));
        vamTile.set(computeVam(elevation, elapsedSeconds, playing));

        npTile.set(String(snap.np));
        ifTile.set(snap.if.toFixed(2));
        tssTile.set(String(snap.tss));
        kjTile.set(String(snap.kj));
        setWbal(String(snap.wBalPct));
        setWbalWidth(`${snap.wBalPct}%`);
        setWbalLevel(snap.wBalPct > 50 ? 'ok' : snap.wBalPct > 25 ? 'warn' : 'low');
        for (const key of Object.keys(bestTiles)) {
            const best = snap.bests[key];
            bestTiles[key].set(best === null ? '--' : String(best));
        }

        chart.draw(snap.history, snap.sampleCount, performance.now());
    }

    /**
     * VAM sobre los últimos ~60 s de ride (muestras de elevación a 1 Hz)
     */
    function computeVam(elevation, elapsedSeconds, playing) {
        const second = Math.floor(elapsedSeconds);
        if (playing && second !== lastElevSecond) {
            lastElevSecond = second;
            elevHistory.push({ t: elapsedSeconds, e: elevation });
            while (elevHistory.length > 1 && elapsedSeconds - elevHistory[0].t > VAM_WINDOW_SECONDS) {
                elevHistory.shift();
            }
        }
        if (elevHistory.length < 2) return '--';
        const first = elevHistory[0];
        const last = elevHistory[elevHistory.length - 1];
        const seconds = last.t - first.t;
        const gain = last.e - first.e;
        if (seconds < VAM_MIN_SECONDS || gain <= 0) return '--';
        return String(Math.round(calculateVAM(gain, seconds)));
    }

    function setVisible(visible) {
        root.hidden = !visible;
    }

    function destroy() {
        chart.destroy();
        root.remove();
        metrics = null;
    }

    applyMode(resolveInitialMode(), false);

    return { element: root, start, update, setVisible, destroy };
}
