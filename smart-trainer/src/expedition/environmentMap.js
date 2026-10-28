/**
 * environmentMap - Reflejos de exterior para los materiales del ciclista y la bici
 *
 * Mapa de entorno procedural (cielo, horizonte claro y suelo) hecho con canvas: sin archivos y válido en cualquier
 * renderer, porque three.js lo convierte a PMREM por su cuenta en cada contexto WebGL. Da a la pintura, el carbono,
 * las gafas y el casco el brillo que les falta con solo luces directas.
 */

import * as THREE from 'three';

const SIZE = 64;
const SKY = '#9ec3e6';
const HORIZON = '#f1eee6';
const GROUND = '#4f4c47';

let envMap = null;

function face(draw) {
    const canvas = document.createElement('canvas');
    canvas.width = SIZE;
    canvas.height = SIZE;
    draw(canvas.getContext('2d'));
    return canvas;
}

// Cara lateral: cielo arriba, banda clara en el horizonte y suelo abajo.
function sideFace(ctx) {
    const gradient = ctx.createLinearGradient(0, 0, 0, SIZE);
    gradient.addColorStop(0, SKY);
    gradient.addColorStop(0.46, HORIZON);
    gradient.addColorStop(0.54, '#8d877d');
    gradient.addColorStop(1, GROUND);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, SIZE, SIZE);
}

/** Mapa de entorno compartido (se crea una vez). Devuelve null fuera del navegador (tests). */
export function getCyclistEnvMap() {
    if (envMap) return envMap;
    if (typeof document === 'undefined') return null;
    const flat = (color) => (ctx) => {
        ctx.fillStyle = color;
        ctx.fillRect(0, 0, SIZE, SIZE);
    };
    // Orden de CubeTexture: +x, -x, +y, -y, +z, -z.
    envMap = new THREE.CubeTexture([
        face(sideFace), face(sideFace), face(flat(SKY)), face(flat(GROUND)), face(sideFace), face(sideFace),
    ]);
    envMap.colorSpace = THREE.SRGBColorSpace;
    envMap.needsUpdate = true;
    return envMap;
}
