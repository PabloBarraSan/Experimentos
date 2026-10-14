/**
 * RouteProfile - Perfil de elevación de la ruta (SVG ligero) con marcadores
 * Smart Trainer - Virtual Cycling
 *
 * - createProfileSvg: dibujo estático reutilizable (tarjetas de ruta y HUD).
 * - createRouteProfile: perfil del HUD con marcadores del jugador, el fantasma
 *   y los bots (elementos HTML reutilizados, solo cambia su posición).
 */

import { colors } from '../../utils/theme.js';

const SVG_NS = 'http://www.w3.org/2000/svg';
const MAX_SAMPLES = 150;
const MAX_BOT_MARKERS = 8;

/**
 * Submuestrear los puntos de la ruta y normalizarlos a [0..1] en x e y
 * @returns {{ samples: Array<{x:number,y:number}>, total: number, minEle: number, range: number }}
 */
function sampleProfile(points) {
    const stride = Math.max(1, Math.floor(points.length / MAX_SAMPLES));
    const sampled = points.filter((_, i) => i % stride === 0 || i === points.length - 1);

    let minEle = Infinity;
    let maxEle = -Infinity;
    sampled.forEach((p) => {
        if (p.elevation < minEle) minEle = p.elevation;
        if (p.elevation > maxEle) maxEle = p.elevation;
    });
    const range = Math.max(10, maxEle - minEle); // Evita perfiles planos exagerados
    const total = points[points.length - 1].distance || 1;

    const samples = sampled.map((p) => ({
        x: p.distance / total,
        y: (p.elevation - minEle) / range,
    }));
    return { samples, total, minEle, range };
}

/**
 * Perfil de elevación en SVG a partir de los puntos de la ruta
 * @param {Array} points - [{ distance, elevation }]
 * @param {Object} [options]
 * @param {number} [options.height=70] - Alto CSS en px (null = 100% del contenedor)
 * @param {string} [options.color] - Color de línea/relleno
 * @returns {SVGElement}
 */
export function createProfileSvg(points, { height = 70, color = colors.primary } = {}) {
    const width = 300;
    const viewHeight = 70;
    const { samples } = sampleProfile(points);

    const coords = samples.map((s) => {
        const x = s.x * width;
        const y = viewHeight - 4 - s.y * (viewHeight - 8);
        return `${x.toFixed(1)},${y.toFixed(1)}`;
    });

    const svg = document.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('viewBox', `0 0 ${width} ${viewHeight}`);
    svg.setAttribute('preserveAspectRatio', 'none');
    svg.style.width = '100%';
    svg.style.height = height === null ? '100%' : `${height}px`;
    svg.style.display = 'block';

    const area = document.createElementNS(SVG_NS, 'polygon');
    area.setAttribute('points', `0,${viewHeight} ${coords.join(' ')} ${width},${viewHeight}`);
    area.setAttribute('fill', `${color}33`);
    svg.appendChild(area);

    const line = document.createElementNS(SVG_NS, 'polyline');
    line.setAttribute('points', coords.join(' '));
    line.setAttribute('fill', 'none');
    line.setAttribute('stroke', color);
    line.setAttribute('stroke-width', '1.5');
    line.setAttribute('vector-effect', 'non-scaling-stroke');
    svg.appendChild(line);

    return svg;
}

/**
 * Perfil del HUD con marcadores
 * @param {Array} points - Puntos de la ruta [{ distance, elevation }]
 * @returns {{ element: HTMLElement, setMarkers: Function }}
 */
export function createRouteProfile(points) {
    const element = document.createElement('div');
    element.className = 'ride-hud__profile';

    if (!Array.isArray(points) || points.length < 2) {
        return { element, setMarkers() {} };
    }

    const { samples } = sampleProfile(points);

    // Zona ya recorrida (tinte) bajo el perfil
    const done = document.createElement('div');
    done.className = 'ride-hud__profile-done';
    element.appendChild(done);

    element.appendChild(createProfileSvg(points, { height: null }));

    // Altura relativa (0 abajo .. 1 arriba) del perfil en un punto de la ruta
    function heightAt(fraction) {
        let lo = 0;
        let hi = samples.length - 1;
        while (hi - lo > 1) {
            const mid = (lo + hi) >> 1;
            if (samples[mid].x <= fraction) lo = mid;
            else hi = mid;
        }
        const a = samples[lo];
        const b = samples[hi];
        const span = b.x - a.x;
        const t = span > 0 ? Math.min(1, Math.max(0, (fraction - a.x) / span)) : 0;
        return a.y + (b.y - a.y) * t;
    }

    function createMarker(className) {
        const marker = document.createElement('span');
        marker.className = `ride-hud__marker ${className}`;
        marker.style.display = 'none';
        element.appendChild(marker);
        return { el: marker, left: -1, bottom: -1, shown: false };
    }

    const player = createMarker('ride-hud__marker--player');
    const ghost = createMarker('ride-hud__marker--ghost');
    const bots = [];

    const total = points[points.length - 1].distance || 1;
    let lastDone = -1;

    function place(marker, distance, color) {
        if (distance === null || distance === undefined || !Number.isFinite(distance)) {
            if (marker.shown) {
                marker.el.style.display = 'none';
                marker.shown = false;
            }
            return;
        }
        const fraction = Math.min(1, Math.max(0, distance / total));
        // Márgenes del viewBox (4 de 70) para que el punto caiga sobre la línea
        const bottom = 5.7 + heightAt(fraction) * 88.6;
        const left = Math.round(fraction * 1000) / 10;
        const bottomRounded = Math.round(bottom * 10) / 10;
        if (!marker.shown) {
            marker.el.style.display = '';
            marker.shown = true;
        }
        if (marker.left !== left) {
            marker.left = left;
            marker.el.style.left = `${left}%`;
        }
        if (marker.bottom !== bottomRounded) {
            marker.bottom = bottomRounded;
            marker.el.style.bottom = `${bottomRounded}%`;
        }
        if (color && marker.color !== color) {
            marker.color = color;
            marker.el.style.backgroundColor = color;
        }
    }

    /**
     * @param {number} playerDistance - m recorridos
     * @param {number|null} ghostDistance - m del fantasma (null si no hay)
     * @param {Array} nearbyBots - [{ distance, color }]
     */
    function setMarkers(playerDistance, ghostDistance, nearbyBots) {
        place(player, playerDistance);
        place(ghost, ghostDistance);

        const count = Math.min(nearbyBots?.length || 0, MAX_BOT_MARKERS);
        while (bots.length < count) bots.push(createMarker('ride-hud__marker--bot'));
        for (let i = 0; i < bots.length; i++) {
            if (i < count) place(bots[i], nearbyBots[i].distance, nearbyBots[i].color);
            else place(bots[i], null);
        }

        const donePct = Math.round(Math.min(1, Math.max(0, playerDistance / total)) * 1000) / 10;
        if (donePct !== lastDone) {
            lastDone = donePct;
            done.style.width = `${donePct}%`;
        }
    }

    return { element, setMarkers };
}
