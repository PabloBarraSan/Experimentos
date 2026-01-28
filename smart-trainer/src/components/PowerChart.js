/**
 * PowerChart - Gráfico de potencia en tiempo real
 * Smart Trainer Controller
 */

import { colors, spacing, typography, borderRadius, getZoneColor } from '../utils/theme.js';
import { div } from '../utils/dom.js';

/**
 * Gráfico de potencia usando Canvas
 * @param {Object} props
 * @param {Array} props.dataPoints - Array de puntos de datos
 * @param {number} props.ftp - FTP del usuario
 * @param {string|number} props.width - Ancho del gráfico
 * @param {number} props.height - Alto del gráfico
 * @param {number} props.windowSeconds - Ventana de tiempo a mostrar (en segundos)
 */
export function PowerChart({ dataPoints = [], ftp = 200, width = '100%', height = 150, windowSeconds = 300 }) {
    const containerStyles = {
        width: typeof width === 'number' ? `${width}px` : width,
        height: `${height}px`,
        backgroundColor: colors.surfaceLight,
        borderRadius: borderRadius.md,
        overflow: 'hidden',
        position: 'relative',
    };
    
    const container = div({ styles: containerStyles });
    
    // Crear canvas
    const canvas = document.createElement('canvas');
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    container.appendChild(canvas);
    
    // Placeholder si no hay datos
    if (dataPoints.length < 2) {
        const placeholder = div({
            styles: {
                position: 'absolute',
                top: '0',
                left: '0',
                right: '0',
                bottom: '0',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: colors.textMuted,
                fontSize: typography.sizes.sm,
            },
            text: 'Esperando datos de potencia...'
        });
        container.appendChild(placeholder);
        return container;
    }
    
    // Dibujar gráfico cuando el canvas esté en el DOM
    const currentPower = dataPoints.length > 0 ? (dataPoints[dataPoints.length - 1].power || 0) : 0;
    requestAnimationFrame(() => {
        const rect = canvas.getBoundingClientRect();
        canvas.width = rect.width * window.devicePixelRatio;
        canvas.height = rect.height * window.devicePixelRatio;
        
        const ctx = canvas.getContext('2d');
        ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
        
        drawChart(ctx, rect.width, rect.height, dataPoints, ftp, windowSeconds, currentPower);
    });
    
    return container;
}

/**
 * Dibujar el gráfico en el canvas (área con degradado según zona de potencia)
 */
function drawChart(ctx, width, height, dataPoints, ftp, windowSeconds, currentPower = 0) {
    const padding = { top: 10, right: 10, bottom: 25, left: 40 };
    const chartWidth = width - padding.left - padding.right;
    const chartHeight = height - padding.top - padding.bottom;
    
    // Filtrar datos de la ventana de tiempo
    const now = Date.now();
    const windowStart = now - windowSeconds * 1000;
    const visibleData = dataPoints.filter(p => p.timestamp >= windowStart);
    
    if (visibleData.length < 2) {
        return;
    }
    
    // Calcular rango de potencia
    const powers = visibleData.map(p => p.power || 0);
    const minPower = 0;
    const maxPower = Math.max(ftp * 1.5, Math.max(...powers) * 1.1);
    
    // Limpiar canvas
    ctx.clearRect(0, 0, width, height);
    
    // Dibujar líneas de referencia FTP
    ctx.strokeStyle = colors.border;
    ctx.lineWidth = 1;
    ctx.setLineDash([5, 5]);
    
    // Línea FTP
    const ftpY = padding.top + chartHeight - (ftp / maxPower) * chartHeight;
    ctx.beginPath();
    ctx.moveTo(padding.left, ftpY);
    ctx.lineTo(width - padding.right, ftpY);
    ctx.stroke();
    
    // Label FTP
    ctx.setLineDash([]);
    ctx.fillStyle = colors.warning;
    ctx.font = `${10}px ${typography.fontMono}`;
    ctx.textAlign = 'left';
    ctx.fillText('FTP', padding.left + 5, ftpY - 3);
    
    // Dibujar zonas de fondo (opcional, sutil)
    const zoneColors = [
        { threshold: 0.55, color: colors.zones.z1 },
        { threshold: 0.75, color: colors.zones.z2 },
        { threshold: 0.90, color: colors.zones.z3 },
        { threshold: 1.05, color: colors.zones.z4 },
        { threshold: 1.20, color: colors.zones.z5 },
        { threshold: 1.50, color: colors.zones.z6 },
    ];
    
    // Dibujar gráfico de área
    ctx.beginPath();
    
    visibleData.forEach((point, index) => {
        const x = padding.left + ((point.timestamp - windowStart) / (windowSeconds * 1000)) * chartWidth;
        const y = padding.top + chartHeight - ((point.power || 0) / maxPower) * chartHeight;
        
        if (index === 0) {
            ctx.moveTo(x, y);
        } else {
            ctx.lineTo(x, y);
        }
    });
    
    // Completar área
    const lastPoint = visibleData[visibleData.length - 1];
    const lastX = padding.left + ((lastPoint.timestamp - windowStart) / (windowSeconds * 1000)) * chartWidth;
    ctx.lineTo(lastX, padding.top + chartHeight);
    
    const firstPoint = visibleData[0];
    const firstX = padding.left + ((firstPoint.timestamp - windowStart) / (windowSeconds * 1000)) * chartWidth;
    ctx.lineTo(firstX, padding.top + chartHeight);
    ctx.closePath();
    
    // Gradiente de relleno según zona de potencia actual (legibilidad periférica)
    const zoneColor = getZoneColor(currentPower, ftp);
    const gradient = ctx.createLinearGradient(0, padding.top, 0, padding.top + chartHeight);
    gradient.addColorStop(0, `${zoneColor}60`);
    gradient.addColorStop(1, `${zoneColor}08`);
    ctx.fillStyle = gradient;
    ctx.fill();
    
    // Dibujar línea de potencia (color de zona)
    ctx.beginPath();
    ctx.strokeStyle = zoneColor;
    ctx.lineWidth = 2;
    ctx.setLineDash([]);
    
    visibleData.forEach((point, index) => {
        const x = padding.left + ((point.timestamp - windowStart) / (windowSeconds * 1000)) * chartWidth;
        const y = padding.top + chartHeight - ((point.power || 0) / maxPower) * chartHeight;
        
        if (index === 0) {
            ctx.moveTo(x, y);
        } else {
            ctx.lineTo(x, y);
        }
    });
    ctx.stroke();
    
    // Eje Y (labels de potencia)
    ctx.fillStyle = colors.textMuted;
    ctx.font = `${9}px ${typography.fontMono}`;
    ctx.textAlign = 'right';
    
    const yLabels = [0, Math.round(maxPower / 2), Math.round(maxPower)];
    yLabels.forEach(power => {
        const y = padding.top + chartHeight - (power / maxPower) * chartHeight;
        ctx.fillText(`${power}W`, padding.left - 5, y + 3);
    });
    
    // Eje X (tiempo)
    ctx.textAlign = 'center';
    const timeLabels = [0, windowSeconds / 2, windowSeconds];
    timeLabels.forEach(seconds => {
        const x = padding.left + (seconds / windowSeconds) * chartWidth;
        const label = seconds === 0 ? 'Ahora' : `-${Math.round(windowSeconds - seconds)}s`;
        ctx.fillText(label, x, height - 5);
    });
    
    // Punto actual (color de zona)
    if (visibleData.length > 0) {
        const current = visibleData[visibleData.length - 1];
        const x = padding.left + ((current.timestamp - windowStart) / (windowSeconds * 1000)) * chartWidth;
        const y = padding.top + chartHeight - ((current.power || 0) / maxPower) * chartHeight;
        
        ctx.beginPath();
        ctx.arc(x, y, 4, 0, Math.PI * 2);
        ctx.fillStyle = zoneColor;
        ctx.fill();
        ctx.strokeStyle = colors.background;
        ctx.lineWidth = 2;
        ctx.stroke();
    }
}

/**
 * Crear un gráfico que se actualiza automáticamente
 */
export function createLivePowerChart(container, getDataFn, ftp = 200) {
    let animationId = null;
    
    const update = () => {
        const dataPoints = getDataFn();
        const chart = PowerChart({ dataPoints, ftp, width: '100%', height: 150 });
        container.innerHTML = '';
        container.appendChild(chart);
        
        animationId = requestAnimationFrame(update);
    };
    
    update();
    
    // Retornar función para detener actualización
    return () => {
        if (animationId) {
            cancelAnimationFrame(animationId);
        }
    };
}
