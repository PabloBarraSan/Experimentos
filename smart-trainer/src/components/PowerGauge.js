/**
 * PowerGauge - Indicador visual de potencia
 * Smart Trainer Controller
 */

import { colors, spacing, typography, getZoneColor, getZoneName } from '../utils/theme.js';
import { createElement, div } from '../utils/dom.js';

/**
 * Gauge semicircular de potencia
 * @param {Object} props
 * @param {number} props.power - Potencia actual en watts
 * @param {number} props.ftp - FTP del usuario
 * @param {number} props.maxPower - Potencia máxima del gauge
 */
export function PowerGauge({ power = 0, ftp = 200, maxPower = 400 }) {
    const percentage = Math.min(100, (power / maxPower) * 100);
    const zoneColor = getZoneColor(power, ftp);
    const zoneName = getZoneName(power, ftp);
    const ftpPercentage = ftp ? Math.round((power / ftp) * 100) : 0;
    
    const containerStyles = {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        width: '100%',
        maxWidth: '300px',
    };
    
    const gaugeContainerStyles = {
        position: 'relative',
        width: '100%',
        paddingTop: '50%', // Mantener ratio 2:1 para semicírculo
    };
    
    const svgStyles = {
        position: 'absolute',
        top: '0',
        left: '0',
        width: '100%',
        height: '100%',
    };
    
    const valueContainerStyles = {
        position: 'absolute',
        bottom: '10%',
        left: '50%',
        transform: 'translateX(-50%)',
        textAlign: 'center',
    };
    
    const powerValueStyles = {
        fontSize: typography.sizes.metric,
        fontWeight: typography.weights.bold,
        color: colors.text,
        fontFamily: typography.fontMono,
        lineHeight: '1',
    };
    
    const unitStyles = {
        fontSize: typography.sizes.lg,
        color: colors.textMuted,
        marginLeft: spacing.xs,
    };
    
    const ftpPercentStyles = {
        fontSize: typography.sizes.lg,
        color: zoneColor,
        fontWeight: typography.weights.semibold,
        marginTop: spacing.xs,
    };
    
    // Calcular el arco SVG
    const radius = 45;
    const strokeWidth = 8;
    const circumference = Math.PI * radius; // Solo semicírculo
    const strokeDashoffset = circumference - (percentage / 100) * circumference;
    
    // Crear SVG para el gauge
    const svgNS = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(svgNS, 'svg');
    svg.setAttribute('viewBox', '0 0 100 55');
    svg.style.cssText = Object.entries(svgStyles).map(([k, v]) => `${k.replace(/[A-Z]/g, m => '-' + m.toLowerCase())}:${v}`).join(';');
    
    // Fondo del arco
    const bgArc = document.createElementNS(svgNS, 'path');
    bgArc.setAttribute('d', `M ${5 + strokeWidth/2} 50 A ${radius} ${radius} 0 0 1 ${95 - strokeWidth/2} 50`);
    bgArc.setAttribute('fill', 'none');
    bgArc.setAttribute('stroke', colors.surfaceLight);
    bgArc.setAttribute('stroke-width', strokeWidth);
    bgArc.setAttribute('stroke-linecap', 'round');
    svg.appendChild(bgArc);
    
    // Arco de progreso
    const progressArc = document.createElementNS(svgNS, 'path');
    progressArc.setAttribute('d', `M ${5 + strokeWidth/2} 50 A ${radius} ${radius} 0 0 1 ${95 - strokeWidth/2} 50`);
    progressArc.setAttribute('fill', 'none');
    progressArc.setAttribute('stroke', zoneColor);
    progressArc.setAttribute('stroke-width', strokeWidth);
    progressArc.setAttribute('stroke-linecap', 'round');
    progressArc.setAttribute('stroke-dasharray', circumference);
    progressArc.setAttribute('stroke-dashoffset', strokeDashoffset);
    progressArc.style.transition = 'stroke-dashoffset 0.3s ease, stroke 0.3s ease';
    svg.appendChild(progressArc);
    
    // Marcadores de FTP
    const ftpAngle = Math.PI - (ftp / maxPower) * Math.PI;
    const ftpX = 50 + radius * Math.cos(ftpAngle);
    const ftpY = 50 - radius * Math.sin(ftpAngle);
    
    const ftpMarker = document.createElementNS(svgNS, 'circle');
    ftpMarker.setAttribute('cx', ftpX);
    ftpMarker.setAttribute('cy', ftpY);
    ftpMarker.setAttribute('r', '3');
    ftpMarker.setAttribute('fill', colors.warning);
    svg.appendChild(ftpMarker);
    
    // Labels de watts
    const minLabel = document.createElementNS(svgNS, 'text');
    minLabel.setAttribute('x', '5');
    minLabel.setAttribute('y', '54');
    minLabel.setAttribute('fill', colors.textDark);
    minLabel.setAttribute('font-size', '6');
    minLabel.textContent = '0';
    svg.appendChild(minLabel);
    
    const maxLabel = document.createElementNS(svgNS, 'text');
    maxLabel.setAttribute('x', '88');
    maxLabel.setAttribute('y', '54');
    maxLabel.setAttribute('fill', colors.textDark);
    maxLabel.setAttribute('font-size', '6');
    maxLabel.textContent = maxPower;
    svg.appendChild(maxLabel);
    
    // Construir componente
    const container = div({ styles: containerStyles });
    
    const gaugeContainer = div({ styles: gaugeContainerStyles });
    gaugeContainer.appendChild(svg);
    
    // Valor central
    const valueContainer = div({
        styles: valueContainerStyles,
        children: [
            div({
                children: [
                    createElement('span', { text: String(power), styles: powerValueStyles }),
                    createElement('span', { text: 'W', styles: unitStyles }),
                ]
            }),
            createElement('div', { 
                text: `${ftpPercentage}% FTP`, 
                styles: ftpPercentStyles 
            }),
        ]
    });
    gaugeContainer.appendChild(valueContainer);
    
    container.appendChild(gaugeContainer);
    
    // Zona actual debajo del gauge
    const zoneLabel = div({
        styles: {
            marginTop: spacing.md,
            padding: `${spacing.xs} ${spacing.md}`,
            backgroundColor: zoneColor,
            color: colors.background,
            borderRadius: '20px',
            fontSize: typography.sizes.sm,
            fontWeight: typography.weights.semibold,
        },
        text: zoneName,
    });
    container.appendChild(zoneLabel);
    
    return container;
}
