/**
 * RidePowerChart - Gráfica de potencia en vivo para el HUD del ride
 * Smart Trainer - Virtual Cycling
 *
 * Un único canvas reutilizado: se redimensiona solo cuando cambia su tamaño
 * y se redibuja con un throttle (no en cada actualización del HUD).
 */

import { colors, typography } from '../../utils/theme.js';

const MIN_REDRAW_MS = 250;

/**
 * @param {Object} options
 * @param {number} options.windowSeconds - Segundos visibles (60-120)
 * @returns {{ element: HTMLCanvasElement, configure: Function, draw: Function, destroy: Function }}
 */
export function createRidePowerChart({ windowSeconds = 90 } = {}) {
    const canvas = document.createElement('canvas');
    canvas.className = 'ride-hud__chart-canvas';
    const ctx = canvas.getContext('2d');

    let zones = [];
    let ftp = 200;
    let width = 0;
    let height = 0;
    let dpr = 1;
    let lastDraw = 0;
    let lastCount = -1;
    let dirty = true;
    let resizeObserver = null;

    // Medir y ajustar el backing store solo si cambió el tamaño real
    function syncSize() {
        const w = canvas.clientWidth;
        const h = canvas.clientHeight;
        const ratio = Math.min(window.devicePixelRatio || 1, 2);
        if (w !== width || h !== height || ratio !== dpr) {
            width = w;
            height = h;
            dpr = ratio;
            canvas.width = Math.max(1, Math.round(w * dpr));
            canvas.height = Math.max(1, Math.round(h * dpr));
            dirty = true;
        }
    }

    if (typeof window.ResizeObserver === 'function') {
        resizeObserver = new window.ResizeObserver(() => {
            dirty = true;
        });
        resizeObserver.observe(canvas);
    }

    /**
     * Zonas (de settings.calculatePowerZones) y FTP actuales
     */
    function configure({ zones: newZones, ftp: newFtp }) {
        zones = newZones || [];
        ftp = newFtp || 200;
        dirty = true;
    }

    function zoneColorAt(power) {
        for (let i = zones.length - 1; i >= 0; i--) {
            if (power >= zones[i].minWatts) return zones[i].color;
        }
        return zones[0]?.color || colors.zones.z1;
    }

    /**
     * @param {number[]} history - Potencia a 1 Hz (la más reciente al final)
     * @param {number} sampleCount - Contador que cambia con cada muestra nueva
     * @param {number} now - Marca de tiempo (ms)
     */
    function draw(history, sampleCount, now) {
        if (!ctx) return;
        const changed = sampleCount !== lastCount;
        if (!dirty && (!changed || now - lastDraw < MIN_REDRAW_MS)) return;
        syncSize();
        if (width === 0 || height === 0) return; // Oculto (modo esencial)

        lastDraw = now;
        lastCount = sampleCount;
        dirty = false;

        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.clearRect(0, 0, width, height);

        const data = history.length > windowSeconds ? history.slice(-windowSeconds) : history;
        let peak = ftp * 1.25;
        for (let i = 0; i < data.length; i++) if (data[i] > peak) peak = data[i];
        const maxY = Math.ceil((peak * 1.05) / 50) * 50;
        const yOf = (watts) => height - (Math.min(watts, maxY) / maxY) * height;

        // Bandas de zona de fondo
        zones.forEach((zone) => {
            if (zone.minWatts >= maxY) return;
            const top = yOf(zone.maxWatts === Infinity ? maxY : zone.maxWatts);
            const bottom = yOf(zone.minWatts);
            ctx.fillStyle = `${zone.color}22`;
            ctx.fillRect(0, top, width, bottom - top);
        });

        // Línea de FTP
        const ftpY = yOf(ftp);
        ctx.save();
        ctx.setLineDash([4, 4]);
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.55)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(0, ftpY);
        ctx.lineTo(width, ftpY);
        ctx.stroke();
        ctx.restore();
        ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
        ctx.font = `600 10px ${typography.fontMono}`;
        ctx.textBaseline = 'bottom';
        ctx.fillText(`FTP ${Math.round(ftp)}`, 4, ftpY - 2);

        if (data.length < 2) return;

        // Serie: el eje X es fijo (windowSeconds) y los datos entran por la derecha
        const stepX = width / (windowSeconds - 1);
        const x0 = width - (data.length - 1) * stepX;

        ctx.lineWidth = 2;
        ctx.lineJoin = 'round';
        for (let i = 1; i < data.length; i++) {
            const xa = x0 + (i - 1) * stepX;
            const xb = x0 + i * stepX;
            ctx.strokeStyle = zoneColorAt((data[i] + data[i - 1]) / 2);
            ctx.beginPath();
            ctx.moveTo(xa, yOf(data[i - 1]));
            ctx.lineTo(xb, yOf(data[i]));
            ctx.stroke();
        }
    }

    function destroy() {
        resizeObserver?.disconnect();
        resizeObserver = null;
    }

    return { element: canvas, configure, draw, destroy };
}
