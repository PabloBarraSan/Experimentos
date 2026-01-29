/**
 * PowerGauge - Indicador visual de potencia
 * Smart Trainer Controller
 */

import { colors, spacing, typography, shadows, borderRadius, getZoneColor, getZoneName } from '../utils/theme.js';
import { createElement, div } from '../utils/dom.js';

// Umbrales de zona en % FTP (igual que getZoneColor/getZoneName en theme.js)
const ZONE_THRESHOLDS_PCT = [0, 55, 76, 91, 106, 121, 151];
const ZONE_COLORS = [
    colors.zones.z1, colors.zones.z2, colors.zones.z3, colors.zones.z4,
    colors.zones.z5, colors.zones.z6, colors.zones.z7,
];

const GAUGE_SIZE = 260;
const GAUGE_R = 120;
const CIRCUMFERENCE = 2 * Math.PI * GAUGE_R; // ~754

/**
 * Gauge circular centrado para vista de entrenamiento (estilo mockup)
 */
function createTrainingGauge({ power, ftp, maxPower, percentage, zoneColor, zoneName }) {
    const outer = div({
        styles: {
            position: 'relative',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            width: '100%',
            maxWidth: `${GAUGE_SIZE}px`,
            minHeight: '280px',
        },
    });

    // Ring glow (color de zona)
    const glowRing = div({
        styles: {
            position: 'absolute',
            width: `${GAUGE_SIZE}px`,
            height: `${GAUGE_SIZE}px`,
            borderRadius: '50%',
            boxShadow: `0 0 60px ${zoneColor}`,
            opacity: 0.2,
        },
    });
    outer.appendChild(glowRing);

    // SVG: arco de fondo (gris) + arco de progreso (color zona)
    const strokeDashFull = CIRCUMFERENCE * 0.75; // 270° de arco visible
    const strokeDashOffsetBg = CIRCUMFERENCE * 0.25;
    const strokeDashOffsetFill = strokeDashFull - (percentage / 100) * strokeDashFull;

    const svgNS = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(svgNS, 'svg');
    svg.setAttribute('viewBox', `0 0 ${GAUGE_SIZE} ${GAUGE_SIZE}`);
    svg.setAttribute('width', String(GAUGE_SIZE));
    svg.setAttribute('height', String(GAUGE_SIZE));
    Object.assign(svg.style, {
        position: 'absolute',
        transform: 'rotate(135deg)',
    });

    const cx = GAUGE_SIZE / 2;
    const cy = GAUGE_SIZE / 2;

    const bgCircle = document.createElementNS(svgNS, 'circle');
    bgCircle.setAttribute('cx', cx);
    bgCircle.setAttribute('cy', cy);
    bgCircle.setAttribute('r', GAUGE_R);
    bgCircle.setAttribute('fill', 'none');
    bgCircle.setAttribute('stroke', '#333');
    bgCircle.setAttribute('stroke-width', '12');
    bgCircle.setAttribute('stroke-dasharray', String(strokeDashFull));
    bgCircle.setAttribute('stroke-dashoffset', String(strokeDashOffsetBg));
    svg.appendChild(bgCircle);

    const fillCircle = document.createElementNS(svgNS, 'circle');
    fillCircle.setAttribute('cx', cx);
    fillCircle.setAttribute('cy', cy);
    fillCircle.setAttribute('r', GAUGE_R);
    fillCircle.setAttribute('fill', 'none');
    fillCircle.setAttribute('stroke', zoneColor);
    fillCircle.setAttribute('stroke-width', '12');
    fillCircle.setAttribute('stroke-dasharray', String(strokeDashFull));
    fillCircle.setAttribute('stroke-dashoffset', String(strokeDashOffsetFill));
    fillCircle.setAttribute('stroke-linecap', 'round');
    fillCircle.style.filter = `drop-shadow(0 0 4px ${zoneColor})`;
    fillCircle.style.transition = 'stroke-dashoffset 0.35s ease, stroke 0.3s ease';
    svg.appendChild(fillCircle);

    outer.appendChild(svg);

    // Valor centrado: número + "Watts" + zone pill
    const wattValue = div({
        styles: {
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            textAlign: 'center',
        },
        children: [
            createElement('div', {
                text: String(Math.round(power)),
                styles: {
                    fontFamily: "'Barlow', sans-serif",
                    fontSize: '82px',
                    fontWeight: 800,
                    lineHeight: 1,
                    letterSpacing: '-2px',
                    background: 'linear-gradient(180deg, #fff 20%, #ccc 100%)',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    backgroundClip: 'text',
                },
            }),
            createElement('div', {
                text: 'Watts',
                styles: {
                    fontSize: '14px',
                    textTransform: 'uppercase',
                    color: colors.textMuted,
                    letterSpacing: '2px',
                    marginTop: '4px',
                },
            }),
            createElement('div', {
                text: zoneName,
                styles: {
                    marginTop: '8px',
                    fontSize: '12px',
                    fontWeight: 700,
                    color: zoneColor,
                    background: `${zoneColor}26`,
                    padding: '4px 12px',
                    borderRadius: '12px',
                    display: 'inline-block',
                },
            }),
        ],
    });
    outer.appendChild(wattValue);

    return outer;
}

/**
 * Gauge semicircular de potencia con arco por zonas, o circular centrado (variant: 'training')
 * @param {Object} props
 * @param {number} props.power - Potencia actual en watts
 * @param {number} props.ftp - FTP del usuario
 * @param {number} props.maxPower - Potencia máxima del gauge
 * @param {string} props.variant - 'default' | 'training' (circular centrado, estilo mockup)
 */
export function PowerGauge({ power = 0, ftp = 200, maxPower = 400, variant = 'default' }) {
    const percentage = Math.min(100, maxPower > 0 ? (power / maxPower) * 100 : 0);
    const zoneColor = getZoneColor(power, ftp);
    const zoneName = getZoneName(power, ftp);
    const ftpPercentage = ftp ? Math.round((power / ftp) * 100) : 0;

    // Variante training: gauge circular centrado como en mockup
    if (variant === 'training') {
        return createTrainingGauge({ power, ftp, maxPower, percentage, zoneColor, zoneName });
    }

    const radius = 45;
    const strokeWidth = 10;
    const strokeWidthProgress = 12;
    const circumference = Math.PI * radius;

    const containerStyles = {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        width: '100%',
        maxWidth: '320px',
        padding: spacing.lg,
        background: 'linear-gradient(145deg, rgba(28, 28, 28, 0.95) 0%, rgba(18, 18, 18, 0.98) 100%)',
        border: `1px solid ${colors.border}`,
        borderRadius: borderRadius.xl,
        boxShadow: shadows.lg,
    };

    const gaugeContainerStyles = {
        position: 'relative',
        width: '100%',
        paddingTop: '50%',
    };

    const svgStyles = {
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
    };

    const valueContainerStyles = {
        position: 'absolute',
        bottom: '8%',
        left: '50%',
        transform: 'translateX(-50%)',
        textAlign: 'center',
    };

    const powerValueStyles = {
        fontSize: typography.sizes.metricHero,
        fontWeight: typography.weights.bold,
        color: colors.text,
        fontFamily: typography.fontMono,
        lineHeight: '1',
        letterSpacing: '-0.02em',
    };

    const unitStyles = {
        fontSize: typography.sizes.md,
        color: colors.textMuted,
        marginLeft: spacing.xs,
        fontWeight: typography.weights.medium,
    };

    const ftpPercentStyles = {
        fontSize: typography.sizes.sm,
        color: colors.textMuted,
        fontWeight: typography.weights.semibold,
        marginTop: spacing.xs,
    };

    const zoneLabelStyles = {
        marginTop: spacing.sm,
        padding: `${spacing.xs} ${spacing.md}`,
        backgroundColor: zoneColor,
        color: colors.background,
        borderRadius: borderRadius.full,
        fontSize: typography.sizes.xs,
        fontWeight: typography.weights.semibold,
        letterSpacing: '0.02em',
    };

    const angleForPower = (p) => Math.PI * (1 - Math.min(1, p / maxPower));
    const pointOnArc = (angle) => ({
        x: 50 + radius * Math.cos(angle),
        y: 50 - radius * Math.sin(angle),
    });

    const svgNS = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(svgNS, 'svg');
    svg.setAttribute('viewBox', '0 0 100 55');
    Object.assign(svg.style, {
        position: 'absolute',
        top: '0',
        left: '0',
        width: '100%',
        height: '100%',
    });

    // Arco de fondo por zonas (segmentos)
    for (let i = 0; i < ZONE_THRESHOLDS_PCT.length; i++) {
        const pctStart = ZONE_THRESHOLDS_PCT[i];
        const powerStart = (pctStart / 100) * ftp;
        const powerEnd = i < ZONE_THRESHOLDS_PCT.length - 1
            ? Math.min(maxPower, (ZONE_THRESHOLDS_PCT[i + 1] / 100) * ftp)
            : maxPower;
        if (powerStart >= powerEnd) continue;

        const startAngle = angleForPower(powerStart);
        const endAngle = angleForPower(powerEnd);
        const start = pointOnArc(startAngle);
        const end = pointOnArc(endAngle);

        const path = document.createElementNS(svgNS, 'path');
        path.setAttribute('d', `M ${start.x} ${start.y} A ${radius} ${radius} 0 0 1 ${end.x} ${end.y}`);
        path.setAttribute('fill', 'none');
        path.setAttribute('stroke', ZONE_COLORS[i]);
        path.setAttribute('stroke-width', strokeWidth);
        path.setAttribute('stroke-linecap', 'round');
        path.setAttribute('opacity', '0.85');
        svg.appendChild(path);
    }

    // Arco de progreso (valor actual) encima
    const strokeDashoffset = circumference - (percentage / 100) * circumference;
    const startAngle = angleForPower(0);
    const endAngle = angleForPower(power);
    const start = pointOnArc(startAngle);
    const end = pointOnArc(endAngle);

    const progressArc = document.createElementNS(svgNS, 'path');
    progressArc.setAttribute('d', `M ${start.x} ${start.y} A ${radius} ${radius} 0 0 1 ${end.x} ${end.y}`);
    progressArc.setAttribute('fill', 'none');
    progressArc.setAttribute('stroke', zoneColor);
    progressArc.setAttribute('stroke-width', strokeWidthProgress);
    progressArc.setAttribute('stroke-linecap', 'round');
    progressArc.setAttribute('stroke-dasharray', circumference);
    progressArc.setAttribute('stroke-dashoffset', strokeDashoffset);
    progressArc.style.transition = 'stroke-dashoffset 0.35s ease, stroke 0.3s ease';
    svg.appendChild(progressArc);

    // Marcador FTP (tick hacia el centro)
    const ftpAngle = angleForPower(ftp);
    const ftpCenter = pointOnArc(ftpAngle);
    const ftpInner = {
        x: 50 + (ftpCenter.x - 50) * 0.82,
        y: 50 + (ftpCenter.y - 50) * 0.82,
    };
    const ftpLine = document.createElementNS(svgNS, 'line');
    ftpLine.setAttribute('x1', ftpCenter.x);
    ftpLine.setAttribute('y1', ftpCenter.y);
    ftpLine.setAttribute('x2', ftpInner.x);
    ftpLine.setAttribute('y2', ftpInner.y);
    ftpLine.setAttribute('stroke', colors.warning);
    ftpLine.setAttribute('stroke-width', '2.5');
    ftpLine.setAttribute('stroke-linecap', 'round');
    svg.appendChild(ftpLine);

    const ftpLabel = document.createElementNS(svgNS, 'text');
    const ftpLabelPos = pointOnArc(ftpAngle);
    ftpLabelPos.x -= 8;
    ftpLabelPos.y += 4;
    ftpLabel.setAttribute('x', ftpLabelPos.x);
    ftpLabel.setAttribute('y', ftpLabelPos.y);
    ftpLabel.setAttribute('fill', colors.warning);
    ftpLabel.setAttribute('font-size', '8');
    ftpLabel.setAttribute('font-weight', '700');
    ftpLabel.setAttribute('text-anchor', 'end');
    ftpLabel.textContent = 'FTP';
    svg.appendChild(ftpLabel);

    // Labels 0 y max
    const minLabel = document.createElementNS(svgNS, 'text');
    minLabel.setAttribute('x', '6');
    minLabel.setAttribute('y', '54');
    minLabel.setAttribute('fill', colors.textMuted);
    minLabel.setAttribute('font-size', '9');
    minLabel.setAttribute('font-weight', '600');
    minLabel.textContent = '0';
    svg.appendChild(minLabel);

    const maxLabel = document.createElementNS(svgNS, 'text');
    maxLabel.setAttribute('x', '94');
    maxLabel.setAttribute('y', '54');
    maxLabel.setAttribute('fill', colors.textMuted);
    maxLabel.setAttribute('font-size', '9');
    maxLabel.setAttribute('font-weight', '600');
    maxLabel.setAttribute('text-anchor', 'end');
    maxLabel.textContent = maxPower;
    svg.appendChild(maxLabel);

    const outer = div({ styles: containerStyles });
    const gaugeWrap = div({ styles: gaugeContainerStyles });
    gaugeWrap.appendChild(svg);

    const valueContainer = div({
        styles: valueContainerStyles,
        children: [
            div({
                children: [
                    createElement('span', { text: String(Math.round(power)), styles: powerValueStyles }),
                    createElement('span', { text: ' W', styles: unitStyles }),
                ]
            }),
            createElement('div', {
                text: `${ftpPercentage}% FTP`,
                styles: ftpPercentStyles
            }),
        ]
    });
    gaugeWrap.appendChild(valueContainer);
    outer.appendChild(gaugeWrap);

    const zoneLabel = div({
        styles: zoneLabelStyles,
        text: zoneName,
    });
    outer.appendChild(zoneLabel);

    return outer;
}
