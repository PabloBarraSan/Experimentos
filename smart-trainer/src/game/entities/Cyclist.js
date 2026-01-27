/**
 * Cyclist - Avatar del jugador
 * Smart Trainer - Power Rush
 */

import { colors } from '../../utils/theme.js';

// Constantes físicas
const GRAVITY = 0.8;
const JUMP_FORCE = -15;
const GROUND_Y = 0;

/**
 * Actualizar estado del ciclista
 */
export function updateCyclist(cyclist, bikeData, ftp, deltaTime) {
    // Actualizar ángulo de pedaleo basado en cadencia
    if (bikeData.cadence > 0) {
        // Velocidad de rotación basada en RPM
        const rotationSpeed = (bikeData.cadence / 60) * Math.PI * 2;
        cyclist.pedalAngle += rotationSpeed * (deltaTime / 1000);
        cyclist.pedalAngle %= Math.PI * 2;
    }
    
    // Actualizar inclinación basada en potencia
    const powerRatio = bikeData.power / ftp;
    cyclist.lean = Math.min(1, Math.max(-0.2, (powerRatio - 0.5) * 0.5));
    
    // Física del salto
    if (cyclist.isJumping) {
        cyclist.vy += GRAVITY;
        cyclist.y += cyclist.vy;
        
        // Aterrizar
        if (cyclist.y >= GROUND_Y) {
            cyclist.y = GROUND_Y;
            cyclist.vy = 0;
            cyclist.isJumping = false;
        }
    }
    
    // Detectar si debería agacharse (cadencia baja)
    cyclist.isDucking = bikeData.cadence > 0 && bikeData.cadence < 60;
    
    return cyclist;
}

/**
 * Hacer saltar al ciclista
 */
export function jumpCyclist(cyclist) {
    if (!cyclist.isJumping && cyclist.y >= GROUND_Y) {
        cyclist.isJumping = true;
        cyclist.vy = JUMP_FORCE;
        cyclist.y = GROUND_Y - 1; // Pequeño offset para iniciar
        return true;
    }
    return false;
}

/**
 * Obtener hitbox del ciclista para colisiones
 */
export function getCyclistHitbox(cyclist, baseY) {
    const width = cyclist.isDucking ? 50 : 40;
    const height = cyclist.isDucking ? 30 : 50;
    const y = baseY - cyclist.y - height;
    
    return {
        x: cyclist.x - width / 2,
        y: y,
        width: width,
        height: height,
    };
}

/**
 * Renderizar ciclista en el canvas
 */
export function renderCyclist(ctx, cyclist, baseY, isTurbo = false) {
    const x = cyclist.x;
    const y = baseY - cyclist.y;
    
    ctx.save();
    ctx.translate(x, y);
    
    // Rotación por inclinación
    ctx.rotate(cyclist.lean * 0.15);
    
    // Escala si está agachado
    if (cyclist.isDucking) {
        ctx.scale(1.2, 0.6);
    }
    
    // Color principal
    const mainColor = isTurbo ? '#ffd700' : colors.primary;
    const accentColor = isTurbo ? '#ffaa00' : '#00a88a';
    
    // Efecto de glow si está en turbo
    if (isTurbo) {
        ctx.shadowColor = '#ffd700';
        ctx.shadowBlur = 20;
    }
    
    ctx.strokeStyle = mainColor;
    ctx.fillStyle = mainColor;
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    
    // === Ruedas ===
    const wheelRadius = 14;
    const wheelY = 12;
    const rearWheelX = -18;
    const frontWheelX = 18;
    
    // Rueda trasera
    ctx.beginPath();
    ctx.arc(rearWheelX, wheelY, wheelRadius, 0, Math.PI * 2);
    ctx.stroke();
    
    // Radios de rueda trasera (animados)
    drawWheelSpokes(ctx, rearWheelX, wheelY, wheelRadius - 3, cyclist.pedalAngle);
    
    // Rueda delantera
    ctx.beginPath();
    ctx.arc(frontWheelX, wheelY, wheelRadius, 0, Math.PI * 2);
    ctx.stroke();
    
    // Radios de rueda delantera
    drawWheelSpokes(ctx, frontWheelX, wheelY, wheelRadius - 3, cyclist.pedalAngle);
    
    // === Cuadro de la bicicleta ===
    ctx.strokeStyle = accentColor;
    ctx.lineWidth = 2;
    
    // Tubo diagonal
    ctx.beginPath();
    ctx.moveTo(rearWheelX, wheelY);
    ctx.lineTo(0, -8);
    ctx.stroke();
    
    // Tubo horizontal
    ctx.beginPath();
    ctx.moveTo(0, -8);
    ctx.lineTo(frontWheelX - 5, -5);
    ctx.stroke();
    
    // Tubo del asiento
    ctx.beginPath();
    ctx.moveTo(0, -8);
    ctx.lineTo(-5, -18);
    ctx.stroke();
    
    // Horquilla
    ctx.beginPath();
    ctx.moveTo(frontWheelX - 5, -5);
    ctx.lineTo(frontWheelX, wheelY);
    ctx.stroke();
    
    // Vainas traseras
    ctx.beginPath();
    ctx.moveTo(rearWheelX, wheelY);
    ctx.lineTo(0, 5);
    ctx.lineTo(0, -8);
    ctx.stroke();
    
    // === Ciclista ===
    ctx.strokeStyle = mainColor;
    ctx.lineWidth = 3;
    
    // Piernas (animadas con pedaleo)
    const pedalRadius = 8;
    const pedalX = 0;
    const pedalY = 5;
    
    // Posición del pedal
    const rightPedalAngle = cyclist.pedalAngle;
    const leftPedalAngle = cyclist.pedalAngle + Math.PI;
    
    const rightPedalX = pedalX + Math.cos(rightPedalAngle) * pedalRadius;
    const rightPedalY = pedalY + Math.sin(rightPedalAngle) * pedalRadius * 0.5;
    
    const leftPedalX = pedalX + Math.cos(leftPedalAngle) * pedalRadius;
    const leftPedalY = pedalY + Math.sin(leftPedalAngle) * pedalRadius * 0.5;
    
    // Cadera
    const hipX = -3;
    const hipY = -15;
    
    // Pierna derecha
    ctx.beginPath();
    ctx.moveTo(hipX, hipY);
    const rightKneeX = hipX + (rightPedalX - hipX) * 0.5 + 5;
    const rightKneeY = hipY + (rightPedalY - hipY) * 0.5 - 3;
    ctx.quadraticCurveTo(rightKneeX, rightKneeY, rightPedalX, rightPedalY);
    ctx.stroke();
    
    // Pierna izquierda (más tenue, atrás)
    ctx.globalAlpha = 0.5;
    ctx.beginPath();
    ctx.moveTo(hipX, hipY);
    const leftKneeX = hipX + (leftPedalX - hipX) * 0.5 + 5;
    const leftKneeY = hipY + (leftPedalY - hipY) * 0.5 - 3;
    ctx.quadraticCurveTo(leftKneeX, leftKneeY, leftPedalX, leftPedalY);
    ctx.stroke();
    ctx.globalAlpha = 1;
    
    // Torso
    const shoulderX = -8;
    const shoulderY = -28;
    
    ctx.beginPath();
    ctx.moveTo(hipX, hipY);
    ctx.lineTo(shoulderX, shoulderY);
    ctx.stroke();
    
    // Brazos hacia el manillar
    const handlebarX = frontWheelX - 8;
    const handlebarY = -12;
    
    ctx.beginPath();
    ctx.moveTo(shoulderX, shoulderY);
    ctx.quadraticCurveTo(shoulderX + 10, shoulderY + 5, handlebarX, handlebarY);
    ctx.stroke();
    
    // Cabeza
    ctx.beginPath();
    ctx.arc(shoulderX - 2, shoulderY - 8, 6, 0, Math.PI * 2);
    ctx.stroke();
    
    // Casco (línea superior)
    ctx.beginPath();
    ctx.arc(shoulderX - 2, shoulderY - 10, 7, Math.PI * 1.2, Math.PI * 1.8);
    ctx.stroke();
    
    ctx.restore();
    
    // Efecto de estela si va rápido
    if (isTurbo) {
        drawSpeedLines(ctx, x - 50, y, 3);
    }
}

/**
 * Dibujar radios de la rueda
 */
function drawWheelSpokes(ctx, cx, cy, radius, angle) {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(angle);
    ctx.lineWidth = 1;
    ctx.globalAlpha = 0.5;
    
    for (let i = 0; i < 6; i++) {
        const spokeAngle = (Math.PI * 2 / 6) * i;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(Math.cos(spokeAngle) * radius, Math.sin(spokeAngle) * radius);
        ctx.stroke();
    }
    
    ctx.globalAlpha = 1;
    ctx.restore();
}

/**
 * Dibujar líneas de velocidad
 */
function drawSpeedLines(ctx, x, y, count) {
    ctx.save();
    ctx.strokeStyle = 'rgba(255, 215, 0, 0.5)';
    ctx.lineWidth = 2;
    
    for (let i = 0; i < count; i++) {
        const offsetY = (i - count / 2) * 15;
        const length = 20 + Math.random() * 30;
        
        ctx.beginPath();
        ctx.moveTo(x - length, y + offsetY);
        ctx.lineTo(x, y + offsetY);
        ctx.stroke();
    }
    
    ctx.restore();
}
