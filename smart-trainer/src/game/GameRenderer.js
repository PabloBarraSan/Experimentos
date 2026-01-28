/**
 * GameRenderer - Renderizado del juego
 * Smart Trainer - Power Rush
 */

import { renderCyclist } from './entities/Cyclist.js';
import { renderObstacle } from './entities/Obstacle.js';
import { renderCollectible } from './entities/Collectible.js';
import { getCurrentPowerZone, GAME_STATUS } from './GameState.js';

/** Altura de la franja inferior reservada para UI (métricas + controles) */
export const UI_STRIP_HEIGHT = 140;
/** Altura visual de la carretera por encima de la franja UI */
const ROAD_HEIGHT = 60;

// Colores del fondo según zona
const BG_COLORS = {
    1: '#1a1a2e',
    2: '#16213e',
    3: '#1a1a1a',
    4: '#2d132c',
    5: '#3d0000',
    6: '#4a0000',
    7: '#4a004a',
};

/**
 * Crear instancia del renderer
 */
export function createGameRenderer(canvas) {
    const ctx = canvas.getContext('2d');
    let width = canvas.width;
    let height = canvas.height;
    
    // Offscreen canvas para optimización
    const bgCanvas = document.createElement('canvas');
    const bgCtx = bgCanvas.getContext('2d');
    
    /**
     * Redimensionar canvas
     */
    function resize() {
        const rect = canvas.getBoundingClientRect();
        const dpr = window.devicePixelRatio || 1;
        
        canvas.width = rect.width * dpr;
        canvas.height = rect.height * dpr;
        ctx.scale(dpr, dpr);
        
        bgCanvas.width = canvas.width;
        bgCanvas.height = canvas.height;
        bgCtx.scale(dpr, dpr);
        
        width = rect.width;
        height = rect.height;
    }
    
    /**
     * Renderizar frame completo
     */
    function render(state) {
        // Aplicar screen shake
        ctx.save();
        if (state.screenShake > 0) {
            const intensity = state.screenShake / 100;
            const shakeX = (Math.random() - 0.5) * intensity * 10;
            const shakeY = (Math.random() - 0.5) * intensity * 10;
            ctx.translate(shakeX, shakeY);
        }
        
        // Limpiar
        ctx.clearRect(0, 0, width, height);
        
        // Fondo
        renderBackground(ctx, state, width, height);
        
        // Carretera (por encima de la franja UI)
        const groundY = height - UI_STRIP_HEIGHT;
        renderRoad(ctx, state, width, height, groundY);
        
        // Obstáculos
        for (const obstacle of state.obstacles) {
            if (obstacle.active) {
                renderObstacle(ctx, obstacle, groundY);
            }
        }
        
        // Coleccionables
        for (const collectible of state.collectibles) {
            if (collectible.active) {
                renderCollectible(ctx, collectible, groundY);
            }
        }
        
        // Ciclista
        renderCyclist(ctx, state.cyclist, groundY, state.cyclist.isTurbo);
        
        // Partículas
        renderParticles(ctx, state.particles, groundY);
        
        // Flash effect
        if (state.flashEffect) {
            renderFlashEffect(ctx, state.flashEffect, width, height);
        }
        
        ctx.restore();
        
        // HUD (sin shake)
        renderHUD(ctx, state, width, height);
        
        // Métricas del rodillo
        renderBikeMetrics(ctx, state, width, height);
        
        // Pantallas especiales
        if (state.status === GAME_STATUS.PAUSED) {
            renderPausedScreen(ctx, width, height);
        } else if (state.status === GAME_STATUS.GAME_OVER) {
            renderGameOverScreen(ctx, state, width, height);
        } else if (state.status === GAME_STATUS.MENU) {
            renderMenuScreen(ctx, state, width, height);
        }
    }
    
    /**
     * Renderizar fondo
     */
    function renderBackground(ctx, state, w, h) {
        const zone = getCurrentPowerZone(state.bikeData.power, state.ftp);
        const bgColor = BG_COLORS[zone.zone] || BG_COLORS[3];
        
        // Gradiente vertical
        const gradient = ctx.createLinearGradient(0, 0, 0, h);
        gradient.addColorStop(0, bgColor);
        gradient.addColorStop(0.6, '#000000');
        gradient.addColorStop(1, '#111111');
        
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, w, h);
        
        // Línea de horizonte
        ctx.strokeStyle = '#333333';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(0, h * 0.4);
        ctx.lineTo(w, h * 0.4);
        ctx.stroke();
        
        // Estrellas (solo en zonas bajas)
        if (zone.zone <= 3) {
            ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
            const starOffset = (state.worldPosition * 0.1) % 100;
            for (let i = 0; i < 20; i++) {
                const x = ((i * 73 + starOffset) % w);
                const y = (i * 37) % (h * 0.35);
                ctx.beginPath();
                ctx.arc(x, y, 1, 0, Math.PI * 2);
                ctx.fill();
            }
        }
    }
    
    /**
     * Renderizar carretera (solo en zona de juego, por encima de la franja UI)
     */
    function renderRoad(ctx, state, w, h, groundY) {
        const roadTop = groundY - ROAD_HEIGHT;
        // Carretera principal (solo ROAD_HEIGHT px por encima de groundY)
        ctx.fillStyle = '#222222';
        ctx.fillRect(0, roadTop, w, ROAD_HEIGHT);
        
        // Borde superior de la carretera
        ctx.strokeStyle = '#444444';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(0, roadTop);
        ctx.lineTo(w, roadTop);
        ctx.stroke();
        
        // Líneas de carretera (animadas)
        ctx.strokeStyle = '#555555';
        ctx.lineWidth = 4;
        ctx.setLineDash([40, 30]);
        
        const lineOffset = (state.worldPosition * 2) % 70;
        ctx.beginPath();
        ctx.moveTo(-lineOffset, roadTop + 40);
        ctx.lineTo(w, roadTop + 40);
        ctx.stroke();
        ctx.setLineDash([]);
        
        // Marcadores de distancia
        const distanceMarkerInterval = 500; // Cada 500 metros virtuales
        const markerOffset = state.distance % distanceMarkerInterval;
        
        ctx.fillStyle = '#666666';
        ctx.font = '12px monospace';
        ctx.textAlign = 'center';
        
        for (let i = 0; i < 3; i++) {
            const x = w - (markerOffset * 0.5 + i * distanceMarkerInterval * 0.5);
            if (x > 0 && x < w) {
                const km = Math.floor((state.distance + i * distanceMarkerInterval) / 1000);
                ctx.fillText(`${km}km`, x, roadTop + 55);
                
                // Línea vertical
                ctx.strokeStyle = '#444444';
                ctx.lineWidth = 1;
                ctx.beginPath();
                ctx.moveTo(x, roadTop + 50);
                ctx.lineTo(x, roadTop + 55);
                ctx.stroke();
            }
        }
    }
    
    /**
     * Renderizar partículas
     */
    function renderParticles(ctx, particles, groundY) {
        for (const p of particles) {
            if (p.life <= 0) continue;
            
            ctx.globalAlpha = p.life;
            ctx.fillStyle = p.color;
            ctx.beginPath();
            ctx.arc(p.x, groundY - p.y, p.size, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.globalAlpha = 1;
    }
    
    /**
     * Renderizar efecto de flash
     */
    function renderFlashEffect(ctx, flash, w, h) {
        ctx.fillStyle = flash.color;
        ctx.globalAlpha = flash.duration / 300 * 0.3;
        ctx.fillRect(0, 0, w, h);
        ctx.globalAlpha = 1;
    }
    
    /**
     * Renderizar HUD
     */
    function renderHUD(ctx, state, w, h) {
        const padding = 20;
        
        // Fondo del HUD
        ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
        ctx.fillRect(0, 0, w, 60);
        
        // Vidas
        ctx.font = '24px sans-serif';
        ctx.textAlign = 'left';
        for (let i = 0; i < state.maxLives; i++) {
            ctx.fillStyle = i < state.lives ? '#ff4444' : '#444444';
            ctx.fillText('❤️', padding + i * 30, 38);
        }
        
        // Puntuación
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 24px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(state.score.toLocaleString(), w / 2, 40);
        
        // Combo / Multiplicador
        if (state.combo > 0) {
            ctx.fillStyle = '#ffd700';
            ctx.font = 'bold 18px sans-serif';
            ctx.textAlign = 'right';
            ctx.fillText(`x${state.multiplier}`, w - padding - 80, 25);
            ctx.fillStyle = '#ffffff';
            ctx.font = '14px sans-serif';
            ctx.fillText(`COMBO ${state.combo}`, w - padding - 80, 45);
        }
        
        // High Score
        ctx.fillStyle = '#888888';
        ctx.font = '12px sans-serif';
        ctx.textAlign = 'right';
        ctx.fillText(`HI: ${state.highScore.toLocaleString()}`, w - padding, 40);
    }
    
    /**
     * Renderizar métricas del rodillo
     */
    function renderBikeMetrics(ctx, state, w, h) {
        const barHeight = 50;
        const y = h - barHeight;
        
        // Fondo
        ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        ctx.fillRect(0, y, w, barHeight);
        
        // Borde superior
        ctx.strokeStyle = '#333333';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
        ctx.stroke();
        
        const zone = getCurrentPowerZone(state.bikeData.power, state.ftp);
        
        // Potencia
        ctx.fillStyle = zone.color;
        ctx.font = 'bold 24px monospace';
        ctx.textAlign = 'left';
        ctx.fillText(`${state.bikeData.power}W`, 20, y + 33);
        
        // Barra de potencia
        const barWidth = 150;
        const barX = 120;
        const powerRatio = Math.min(2, state.bikeData.power / state.ftp);
        
        ctx.fillStyle = '#333333';
        ctx.fillRect(barX, y + 15, barWidth, 20);
        
        ctx.fillStyle = zone.color;
        ctx.fillRect(barX, y + 15, barWidth * (powerRatio / 2), 20);
        
        // Marca de FTP
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(barX + barWidth / 2, y + 12);
        ctx.lineTo(barX + barWidth / 2, y + 38);
        ctx.stroke();
        
        // Cadencia
        ctx.fillStyle = '#ffffff';
        ctx.font = '18px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(`${state.bikeData.cadence} rpm`, w / 2, y + 33);
        
        // Velocidad virtual
        const virtualSpeed = (state.worldSpeed * 3.2).toFixed(1);
        ctx.fillText(`${virtualSpeed} km/h`, w / 2 + 100, y + 33);
        
        // Distancia
        ctx.fillStyle = '#888888';
        ctx.font = '14px monospace';
        ctx.textAlign = 'right';
        ctx.fillText(`${(state.distance / 1000).toFixed(2)} km`, w - 20, y + 33);
    }
    
    /**
     * Renderizar pantalla de pausa
     */
    function renderPausedScreen(ctx, w, h) {
        // Overlay oscuro
        ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        ctx.fillRect(0, 0, w, h);
        
        // Texto
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 48px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('PAUSADO', w / 2, h / 2);
        
        ctx.font = '18px sans-serif';
        ctx.fillStyle = '#888888';
        ctx.fillText('Pedalea para continuar', w / 2, h / 2 + 40);
    }
    
    /**
     * Renderizar pantalla de game over
     */
    function renderGameOverScreen(ctx, state, w, h) {
        // Overlay oscuro
        ctx.fillStyle = 'rgba(0, 0, 0, 0.85)';
        ctx.fillRect(0, 0, w, h);
        
        // Título
        ctx.fillStyle = '#ff4444';
        ctx.font = 'bold 48px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('GAME OVER', w / 2, h / 2 - 80);
        
        // Puntuación
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 36px monospace';
        ctx.fillText(state.score.toLocaleString(), w / 2, h / 2 - 20);
        
        // Estadísticas
        ctx.font = '16px sans-serif';
        ctx.fillStyle = '#888888';
        ctx.fillText(`Distancia: ${(state.distance / 1000).toFixed(2)} km`, w / 2, h / 2 + 30);
        ctx.fillText(`Tiempo: ${formatTime(state.playTime)}`, w / 2, h / 2 + 55);
        
        // High score
        if (state.score >= state.highScore) {
            ctx.fillStyle = '#ffd700';
            ctx.font = 'bold 20px sans-serif';
            ctx.fillText('🏆 NUEVO RÉCORD! 🏆', w / 2, h / 2 + 100);
        }
        
        // Instrucciones
        ctx.fillStyle = '#00d4aa';
        ctx.font = '18px sans-serif';
        ctx.fillText('Sprint para reiniciar', w / 2, h / 2 + 150);
    }
    
    /**
     * Renderizar pantalla de menú
     */
    function renderMenuScreen(ctx, state, w, h) {
        // Fondo
        ctx.fillStyle = '#0a0a0a';
        ctx.fillRect(0, 0, w, h);
        
        // Título
        ctx.fillStyle = '#00d4aa';
        ctx.font = 'bold 56px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('POWER RUSH', w / 2, h / 2 - 60);
        
        // Subtítulo
        ctx.fillStyle = '#888888';
        ctx.font = '18px sans-serif';
        ctx.fillText('Smart Trainer Game Mode', w / 2, h / 2 - 20);
        
        // High score
        ctx.fillStyle = '#ffd700';
        ctx.font = '20px monospace';
        ctx.fillText(`High Score: ${state.highScore.toLocaleString()}`, w / 2, h / 2 + 30);
        
        // Instrucciones
        ctx.fillStyle = '#ffffff';
        ctx.font = '24px sans-serif';
        ctx.fillText('¡Pedalea para comenzar!', w / 2, h / 2 + 100);
        
        // Controles
        ctx.fillStyle = '#00d4aa';
        ctx.font = 'bold 16px sans-serif';
        ctx.fillText('CONTROLES', w / 2, h / 2 + 150);
        
        ctx.fillStyle = '#888888';
        ctx.font = '14px sans-serif';
        ctx.fillText('⬆️ Botón o Espacio = Saltar', w / 2, h / 2 + 180);
        ctx.fillText('⬇️ Botón o S = Agacharse', w / 2, h / 2 + 205);
        ctx.fillText('O automático: Sprint >120% FTP = Saltar | Cadencia <60 = Agacharse', w / 2, h / 2 + 230);
    }
    
    /**
     * Formatear tiempo
     */
    function formatTime(ms) {
        const seconds = Math.floor(ms / 1000);
        const minutes = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${minutes}:${secs.toString().padStart(2, '0')}`;
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
