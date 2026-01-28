/**
 * RideRenderer - Renderizado en primera persona
 * Smart Trainer - Virtual Cycling
 */

import { RIDE_STATUS, getCurrentPowerZone, formatTime } from './RideState.js';
import { hexToRgb, lerpColor } from './worlds/WorldConfig.js';

/** Altura de la barra de métricas inferior */
export const METRICS_BAR_HEIGHT = 60;

/** Altura del HUD superior */
const HUD_HEIGHT = 50;

/** Punto de fuga (horizonte) */
const HORIZON_RATIO = 0.38;

/**
 * Crear instancia del renderer
 */
export function createRideRenderer(canvas) {
    const ctx = canvas.getContext('2d');
    let width = canvas.width;
    let height = canvas.height;
    
    /**
     * Redimensionar canvas
     */
    function resize() {
        const rect = canvas.getBoundingClientRect();
        const dpr = window.devicePixelRatio || 1;
        
        canvas.width = rect.width * dpr;
        canvas.height = rect.height * dpr;
        ctx.scale(dpr, dpr);
        
        width = rect.width;
        height = rect.height;
    }
    
    /**
     * Renderizar frame completo
     */
    function render(state, worldConfig) {
        // Limpiar
        ctx.clearRect(0, 0, width, height);
        
        const horizonY = height * HORIZON_RATIO;
        const gameHeight = height - METRICS_BAR_HEIGHT;
        
        // Renderizar cielo
        renderSky(ctx, worldConfig, width, horizonY);
        
        // Renderizar montañas/paisaje de fondo
        renderLandscape(ctx, state, worldConfig, width, horizonY, gameHeight);
        
        // Renderizar carretera en perspectiva
        renderRoad(ctx, state, worldConfig, width, horizonY, gameHeight);
        
        // Renderizar bots
        renderBots(ctx, state, width, horizonY, gameHeight);
        
        // Renderizar efectos ambientales
        renderAmbientEffects(ctx, state, worldConfig, width, gameHeight);
        
        // Renderizar HUD superior
        renderHUD(ctx, state, width);
        
        // Renderizar barra de métricas inferior
        renderMetricsBar(ctx, state, width, height);
        
        // Pantallas especiales
        if (state.status === RIDE_STATUS.PAUSED) {
            renderPausedScreen(ctx, width, height);
        } else if (state.status === RIDE_STATUS.FINISHED) {
            renderFinishedScreen(ctx, state, width, height);
        } else if (state.status === RIDE_STATUS.MENU) {
            renderMenuScreen(ctx, state, worldConfig, width, height);
        }
    }
    
    /**
     * Renderizar cielo con gradiente
     */
    function renderSky(ctx, worldConfig, w, horizonY) {
        const { skyColors } = worldConfig;
        
        const gradient = ctx.createLinearGradient(0, 0, 0, horizonY);
        gradient.addColorStop(0, skyColors.top);
        gradient.addColorStop(0.6, skyColors.middle);
        gradient.addColorStop(1, skyColors.horizon);
        
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, w, horizonY);
    }
    
    /**
     * Renderizar paisaje de fondo (montañas/siluetas)
     */
    function renderLandscape(ctx, state, worldConfig, w, horizonY, gameHeight) {
        const { landscape } = worldConfig;
        const scrollOffset = (state.position.distance * 0.02) % w;
        
        // Dibujar capas de montañas con parallax
        for (const mountain of landscape.mountains) {
            const layerOffset = scrollOffset * (1 - mountain.offset);
            const mountainHeight = horizonY * mountain.height;
            const baseY = horizonY;
            
            ctx.fillStyle = mountain.color;
            ctx.beginPath();
            ctx.moveTo(0, baseY);
            
            // Generar silueta de montaña
            const segments = 20;
            for (let i = 0; i <= segments; i++) {
                const x = (i / segments) * w;
                const noise = Math.sin((x + layerOffset) * 0.02) * 0.3 +
                             Math.sin((x + layerOffset) * 0.05) * 0.2 +
                             Math.sin((x + layerOffset) * 0.01) * 0.5;
                const y = baseY - mountainHeight * (0.5 + noise * 0.5);
                ctx.lineTo(x, y);
            }
            
            ctx.lineTo(w, baseY);
            ctx.closePath();
            ctx.fill();
            
            // Efecto de brillo si es lava o neón
            if (mountain.glow) {
                ctx.shadowColor = mountain.color;
                ctx.shadowBlur = 20;
                ctx.fill();
                ctx.shadowBlur = 0;
            }
        }
        
        // Suelo
        ctx.fillStyle = landscape.groundColor;
        ctx.fillRect(0, horizonY, w, gameHeight - horizonY);
    }
    
    /**
     * Renderizar carretera en perspectiva
     */
    function renderRoad(ctx, state, worldConfig, w, horizonY, gameHeight) {
        const { roadColors } = worldConfig;
        const roadBottom = gameHeight;
        const vanishX = w / 2;
        const vanishY = horizonY;
        
        // Ancho de la carretera en la parte inferior
        const roadWidthBottom = w * 0.4;
        const roadWidthTop = w * 0.02; // Casi un punto en el horizonte
        
        // Dibujar carretera con perspectiva
        ctx.fillStyle = roadColors.main;
        ctx.beginPath();
        ctx.moveTo(vanishX - roadWidthTop / 2, vanishY);
        ctx.lineTo(vanishX + roadWidthTop / 2, vanishY);
        ctx.lineTo(w / 2 + roadWidthBottom / 2, roadBottom);
        ctx.lineTo(w / 2 - roadWidthBottom / 2, roadBottom);
        ctx.closePath();
        ctx.fill();
        
        // Bordes de la carretera
        ctx.strokeStyle = roadColors.edge;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(vanishX - roadWidthTop / 2, vanishY);
        ctx.lineTo(w / 2 - roadWidthBottom / 2, roadBottom);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(vanishX + roadWidthTop / 2, vanishY);
        ctx.lineTo(w / 2 + roadWidthBottom / 2, roadBottom);
        ctx.stroke();
        
        // Arcenes
        const shoulderWidth = roadWidthBottom * 0.1;
        ctx.fillStyle = roadColors.shoulder;
        
        // Arcén izquierdo
        ctx.beginPath();
        ctx.moveTo(vanishX - roadWidthTop / 2, vanishY);
        ctx.lineTo(vanishX - roadWidthTop / 2 - 2, vanishY);
        ctx.lineTo(w / 2 - roadWidthBottom / 2 - shoulderWidth, roadBottom);
        ctx.lineTo(w / 2 - roadWidthBottom / 2, roadBottom);
        ctx.closePath();
        ctx.fill();
        
        // Arcén derecho
        ctx.beginPath();
        ctx.moveTo(vanishX + roadWidthTop / 2, vanishY);
        ctx.lineTo(vanishX + roadWidthTop / 2 + 2, vanishY);
        ctx.lineTo(w / 2 + roadWidthBottom / 2 + shoulderWidth, roadBottom);
        ctx.lineTo(w / 2 + roadWidthBottom / 2, roadBottom);
        ctx.closePath();
        ctx.fill();
        
        // Líneas centrales animadas
        renderRoadLines(ctx, state, roadColors, w, vanishX, vanishY, roadBottom, roadWidthBottom);
    }
    
    /**
     * Renderizar líneas de la carretera
     */
    function renderRoadLines(ctx, state, roadColors, w, vanishX, vanishY, roadBottom, roadWidthBottom) {
        const speed = state.position.virtualSpeed;
        const lineOffset = (state.position.distance * 2) % 100;
        
        ctx.strokeStyle = roadColors.line;
        ctx.lineWidth = 2;
        ctx.setLineDash([15, 25]);
        
        // Número de segmentos de línea
        const segments = 15;
        
        for (let i = 0; i < segments; i++) {
            const t1 = (i + lineOffset / 100) / segments;
            const t2 = (i + 0.3 + lineOffset / 100) / segments;
            
            if (t1 >= 1 || t2 <= 0) continue;
            
            const tStart = Math.max(0, t1);
            const tEnd = Math.min(1, t2);
            
            // Posición en perspectiva (exponencial para efecto de profundidad)
            const y1 = vanishY + (roadBottom - vanishY) * Math.pow(tStart, 1.5);
            const y2 = vanishY + (roadBottom - vanishY) * Math.pow(tEnd, 1.5);
            
            // Ancho de línea según perspectiva
            const lineWidth1 = 1 + tStart * 3;
            const lineWidth2 = 1 + tEnd * 3;
            
            ctx.lineWidth = (lineWidth1 + lineWidth2) / 2;
            ctx.globalAlpha = 0.3 + tStart * 0.7;
            
            ctx.beginPath();
            ctx.moveTo(vanishX, y1);
            ctx.lineTo(vanishX, y2);
            ctx.stroke();
        }
        
        ctx.globalAlpha = 1;
        ctx.setLineDash([]);
    }
    
    /**
     * Renderizar bots
     */
    function renderBots(ctx, state, w, horizonY, gameHeight) {
        const vanishX = w / 2;
        const vanishY = horizonY;
        const roadBottom = gameHeight;
        
        for (const bot of state.bots) {
            if (!bot.visible || bot.scale <= 0) continue;
            
            const relativeDistance = bot.distance - state.position.distance;
            if (relativeDistance < 0) continue; // No renderizar bots detrás
            
            // Calcular posición en perspectiva
            const t = Math.min(1, relativeDistance / 200); // Normalizar a 200m máximo
            const y = vanishY + (roadBottom - vanishY) * (1 - Math.pow(1 - t, 2));
            const x = vanishX; // Los bots están centrados en la carretera
            
            // Tamaño según distancia
            const baseSize = 30;
            const size = baseSize * bot.scale;
            
            if (size < 3) continue; // Muy pequeño para ver
            
            // Dibujar silueta del ciclista
            ctx.fillStyle = bot.color;
            ctx.globalAlpha = 0.6 + bot.scale * 0.4;
            
            // Cuerpo (elipse)
            ctx.beginPath();
            ctx.ellipse(x, y - size * 0.6, size * 0.3, size * 0.5, 0, 0, Math.PI * 2);
            ctx.fill();
            
            // Cabeza
            ctx.beginPath();
            ctx.arc(x, y - size * 1.1, size * 0.2, 0, Math.PI * 2);
            ctx.fill();
            
            // Ruedas
            ctx.beginPath();
            ctx.arc(x - size * 0.3, y, size * 0.15, 0, Math.PI * 2);
            ctx.arc(x + size * 0.3, y, size * 0.15, 0, Math.PI * 2);
            ctx.fill();
            
            ctx.globalAlpha = 1;
        }
    }
    
    /**
     * Renderizar efectos ambientales
     */
    function renderAmbientEffects(ctx, state, worldConfig, w, gameHeight) {
        const { ambient } = worldConfig;
        
        // Niebla
        if (ambient.fog) {
            const horizonY = gameHeight * HORIZON_RATIO;
            const gradient = ctx.createLinearGradient(0, horizonY - 50, 0, horizonY + 100);
            gradient.addColorStop(0, 'transparent');
            gradient.addColorStop(0.5, ambient.fogColor + '80');
            gradient.addColorStop(1, 'transparent');
            
            ctx.fillStyle = gradient;
            ctx.fillRect(0, horizonY - 50, w, 150);
        }
        
        // Partículas (simple placeholder)
        if (ambient.particles && ambient.particles.length > 0) {
            const particleCount = Math.floor(ambient.particleDensity * 20);
            const time = Date.now() / 1000;
            
            for (let i = 0; i < particleCount; i++) {
                const seed = i * 7919; // Número primo para distribución
                const x = ((seed + time * 20) % w);
                const y = ((seed * 1.3 + time * 10) % gameHeight);
                
                ctx.fillStyle = getParticleColor(ambient.particles[0], worldConfig);
                ctx.globalAlpha = 0.3 + Math.sin(time + i) * 0.2;
                ctx.beginPath();
                ctx.arc(x, y, 2 + Math.sin(time * 2 + i) * 1, 0, Math.PI * 2);
                ctx.fill();
            }
            ctx.globalAlpha = 1;
        }
    }
    
    /**
     * Obtener color de partícula según tipo
     */
    function getParticleColor(type, worldConfig) {
        switch (type) {
            case 'snowflake': return '#FFFFFF';
            case 'ember': return '#FF4500';
            case 'ash': return '#666666';
            case 'neon_spark': return '#00FFFF';
            case 'butterfly': return '#FFD700';
            case 'seagull': return '#FFFFFF';
            default: return '#FFFFFF';
        }
    }
    
    /**
     * Renderizar HUD superior
     */
    function renderHUD(ctx, state, w) {
        const padding = 15;
        
        // Fondo semi-transparente
        ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
        ctx.fillRect(0, 0, w, HUD_HEIGHT);
        
        // Pendiente actual (izquierda)
        const gradeIcon = state.currentGrade > 0 ? '↗' : state.currentGrade < 0 ? '↘' : '→';
        const gradeColor = state.currentGrade > 5 ? '#ff4444' : 
                          state.currentGrade > 2 ? '#ffaa00' : 
                          state.currentGrade < -2 ? '#00aaff' : '#ffffff';
        
        ctx.fillStyle = gradeColor;
        ctx.font = 'bold 24px sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText(`${gradeIcon} ${Math.abs(state.currentGrade).toFixed(1)}%`, padding, 35);
        
        // Elevación
        ctx.fillStyle = '#888888';
        ctx.font = '14px sans-serif';
        ctx.fillText(`${Math.round(state.position.elevation)}m`, padding + 90, 35);
        
        // Tiempo (centro)
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 22px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(formatTime(state.elapsedTime), w / 2, 35);
        
        // Distancia restante (derecha)
        const remaining = Math.max(0, state.route.length - state.position.distance);
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 18px sans-serif';
        ctx.textAlign = 'right';
        ctx.fillText(`${(remaining / 1000).toFixed(2)} km`, w - padding, 25);
        
        // Bot más cercano
        if (state.bots.length > 0) {
            const nextBot = state.bots.find(b => b.distance > state.position.distance);
            if (nextBot) {
                const dist = Math.round(nextBot.distance - state.position.distance);
                ctx.fillStyle = '#00aaff';
                ctx.font = '14px sans-serif';
                ctx.fillText(`🚴 +${dist}m`, w - padding, 45);
            }
        }
    }
    
    /**
     * Renderizar barra de métricas inferior
     */
    function renderMetricsBar(ctx, state, w, h) {
        const barY = h - METRICS_BAR_HEIGHT;
        
        // Fondo
        ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
        ctx.fillRect(0, barY, w, METRICS_BAR_HEIGHT);
        
        // Borde superior
        ctx.strokeStyle = '#333333';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(0, barY);
        ctx.lineTo(w, barY);
        ctx.stroke();
        
        // Zona de potencia
        const zone = getCurrentPowerZone(state.bikeData.power, state.ftp);
        
        // Potencia (izquierda)
        ctx.fillStyle = zone.color;
        ctx.font = 'bold 28px monospace';
        ctx.textAlign = 'left';
        ctx.fillText(`${state.bikeData.power}W`, 20, barY + 40);
        
        // Barra de potencia
        const barWidth = 120;
        const barHeight = 8;
        const barX = 110;
        const powerRatio = Math.min(2, state.bikeData.power / state.ftp);
        
        ctx.fillStyle = '#333333';
        ctx.fillRect(barX, barY + 28, barWidth, barHeight);
        
        ctx.fillStyle = zone.color;
        ctx.fillRect(barX, barY + 28, barWidth * (powerRatio / 2), barHeight);
        
        // Marca de FTP
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(barX + barWidth / 2, barY + 25);
        ctx.lineTo(barX + barWidth / 2, barY + 39);
        ctx.stroke();
        
        // Cadencia (centro-izquierda)
        ctx.fillStyle = '#ffffff';
        ctx.font = '20px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(`${state.bikeData.cadence} rpm`, w * 0.35, barY + 38);
        
        // Velocidad virtual (centro)
        ctx.fillStyle = '#00d4aa';
        ctx.font = 'bold 24px monospace';
        ctx.fillText(`${state.position.virtualSpeed.toFixed(1)} km/h`, w / 2, barY + 40);
        
        // Heart rate (centro-derecha)
        if (state.bikeData.heartRate > 0) {
            ctx.fillStyle = '#ff5252';
            ctx.font = '20px monospace';
            ctx.fillText(`❤ ${state.bikeData.heartRate}`, w * 0.65, barY + 38);
        }
        
        // Distancia recorrida (derecha)
        ctx.fillStyle = '#888888';
        ctx.font = '18px monospace';
        ctx.textAlign = 'right';
        ctx.fillText(`${(state.position.distance / 1000).toFixed(2)} km`, w - 20, barY + 38);
        
        // Zona actual
        ctx.fillStyle = zone.color;
        ctx.font = '12px sans-serif';
        ctx.fillText(`Z${zone.zone} ${zone.name}`, w - 20, barY + 55);
    }
    
    /**
     * Renderizar pantalla de pausa
     */
    function renderPausedScreen(ctx, w, h) {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        ctx.fillRect(0, 0, w, h);
        
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 48px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('PAUSADO', w / 2, h / 2);
        
        ctx.font = '18px sans-serif';
        ctx.fillStyle = '#888888';
        ctx.fillText('Pedalea para continuar', w / 2, h / 2 + 40);
    }
    
    /**
     * Renderizar pantalla de finalización
     */
    function renderFinishedScreen(ctx, state, w, h) {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.85)';
        ctx.fillRect(0, 0, w, h);
        
        // Título
        ctx.fillStyle = '#00d4aa';
        ctx.font = 'bold 48px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('¡RUTA COMPLETADA!', w / 2, h / 2 - 100);
        
        // Estadísticas
        ctx.fillStyle = '#ffffff';
        ctx.font = '20px sans-serif';
        
        const stats = [
            `Distancia: ${(state.position.distance / 1000).toFixed(2)} km`,
            `Tiempo: ${formatTime(state.elapsedTime)}`,
            `Potencia media: ${state.stats.avgPower} W`,
            `Potencia máxima: ${state.stats.maxPower} W`,
            `Velocidad media: ${state.stats.avgSpeed} km/h`,
            `Desnivel acumulado: ${Math.round(state.stats.totalAscent)} m`,
        ];
        
        stats.forEach((stat, i) => {
            ctx.fillText(stat, w / 2, h / 2 - 30 + i * 30);
        });
        
        // Instrucciones
        ctx.fillStyle = '#00d4aa';
        ctx.font = '18px sans-serif';
        ctx.fillText('Pulsa para volver al menú', w / 2, h / 2 + 160);
    }
    
    /**
     * Renderizar menú
     */
    function renderMenuScreen(ctx, state, worldConfig, w, h) {
        ctx.fillStyle = '#0a0a0a';
        ctx.fillRect(0, 0, w, h);
        
        // Título
        ctx.fillStyle = '#00d4aa';
        ctx.font = 'bold 42px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('CICLISMO VIRTUAL', w / 2, h / 2 - 60);
        
        // Subtítulo con mundo
        ctx.fillStyle = '#888888';
        ctx.font = '18px sans-serif';
        ctx.fillText(worldConfig.name, w / 2, h / 2 - 20);
        
        // Instrucciones
        ctx.fillStyle = '#ffffff';
        ctx.font = '24px sans-serif';
        ctx.fillText('¡Pedalea para comenzar!', w / 2, h / 2 + 40);
    }
    
    // Inicializar
    resize();
    window.addEventListener('resize', resize);
    
    // API pública
    return {
        render,
        resize,
        destroy: () => {
            window.removeEventListener('resize', resize);
        },
    };
}
