/**
 * Colocación de un ciclista sobre la carretera.
 *
 * El punto de contacto de cada rueda se toma de la propia curva de la ruta (más el bombeo central del asfalto),
 * así la bici sigue pendientes, cambios de rasante y curvas sin hundirse ni quedar en el aire. Devuelve además
 * la inclinación hacia el interior de la curva (la de equilibrio v²·κ/g).
 */

import * as THREE from 'three';
import { ASPHALT_WIDTH } from './scene/road.js';

// El perfil del asfalto (buildWorld) es [-half, 0], [0, CROWN], [half, 0] más LIFT sobre la curva.
export const ROAD_LIFT = 0.012;
export const ROAD_CROWN = 0.03;
// Holgura para que la cubierta no pelee con el asfalto (z-fighting) sin que se note el hueco.
const TIRE_CLEARANCE = 0.004;
const MAX_BANK = 0.38;
const GRAVITY = 9.81;
const CURVATURE_SPAN = 3;

const tangent = new THREE.Vector3();
const rear = new THREE.Vector3();
const front = new THREE.Vector3();
const behind = new THREE.Vector3();
const ahead = new THREE.Vector3();
const axle = new THREE.Vector3();

/** Altura del asfalto sobre la curva a `lane` metros del eje (positivo = izquierda del sentido de marcha). */
export function roadSurfaceY(lane) {
    const half = ASPHALT_WIDTH / 2;
    return ROAD_LIFT + ROAD_CROWN * (1 - Math.min(1, Math.abs(lane) / half)) + TIRE_CLEARANCE;
}

export function createPlacement() {
    return { position: new THREE.Vector3(), yaw: 0, pitch: 0, bank: 0 };
}

function sample(curve, length, meters, lane, out) {
    const t = (((meters / length) % 1) + 1) % 1;
    curve.getPointAt(t, out);
    curve.getTangentAt(t, tangent);
    const norm = Math.hypot(tangent.x, tangent.z) || 1;
    out.x += (-tangent.z / norm) * lane;
    out.z += (tangent.x / norm) * lane;
    out.y += roadSurfaceY(lane);
    return out;
}

/**
 * @param {THREE.Curve} curve - Curva cerrada de la ruta
 * @param {{distance:number, lane:number, scale:number, speed:number, wheelbase:[number, number]}} options
 *   distance: metros recorridos del origen del ciclista; wheelbase: z de los ejes trasero y delantero (sin escalar)
 * @param {object} out - resultado reutilizable (createPlacement)
 * Giro: yaw en Y, pitch en X (orden de Euler 'YXZ'); bank es el balanceo objetivo en Z (negativo = hacia la izquierda).
 */
export function placeOnRoad(curve, { distance, lane, scale, speed, wheelbase }, out = createPlacement()) {
    const length = curve.getLength();
    const rearOffset = wheelbase[0] * scale;
    const frontOffset = wheelbase[1] * scale;
    sample(curve, length, distance + rearOffset, lane, rear);
    // La bici es rígida: el eje delantero se busca a la distancia exacta de la base de ruedas (no a los mismos metros
    // de arco, que en curvas y rasantes serían un poco más largos que la cuerda).
    const rigid = frontOffset - rearOffset;
    let frontMeters = distance + frontOffset;
    for (let pass = 0; pass < 3; pass += 1) {
        sample(curve, length, frontMeters, lane, front);
        frontMeters += rigid - front.distanceTo(rear);
    }
    sample(curve, length, frontMeters, lane, front);
    axle.subVectors(front, rear);
    const horizontal = Math.max(0.0001, Math.hypot(axle.x, axle.z));
    out.position.copy(rear).addScaledVector(axle, -rearOffset / rigid);
    out.yaw = Math.atan2(axle.x, axle.z);
    out.pitch = -Math.atan2(axle.y, horizontal);

    sample(curve, length, distance - CURVATURE_SPAN, lane, behind);
    sample(curve, length, distance + CURVATURE_SPAN, lane, ahead);
    let turn = Math.atan2(ahead.x - front.x, ahead.z - front.z) - Math.atan2(front.x - behind.x, front.z - behind.z);
    turn = Math.atan2(Math.sin(turn), Math.cos(turn));
    const v = Math.max(0, speed);
    out.bank = THREE.MathUtils.clamp(-Math.atan((v * v * (turn / CURVATURE_SPAN)) / GRAVITY), -MAX_BANK, MAX_BANK);
    return out;
}
