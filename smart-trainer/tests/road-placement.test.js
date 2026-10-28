import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { placeOnRoad, createPlacement, roadSurfaceY } from '../src/expedition/roadPlacement.js';

// Colina con curvas en ambos sentidos y rumbo en todas direcciones.
const points = [];
for (let i = 0; i < 24; i += 1) {
    const a = (i / 24) * Math.PI * 2;
    const radius = 220 + 40 * Math.sin(a * 3);
    points.push(new THREE.Vector3(Math.cos(a) * radius, 12 * Math.sin(a * 2) + 6 * Math.sin(a * 5), Math.sin(a) * radius));
}
const curve = new THREE.CatmullRomCurve3(points, true, 'catmullrom', 0.42);
const SCALE = 1.4;
const WHEELBASE = [-0.41, 0.6];

// Altura real del asfalto bajo un punto de la ruta (curva + bombeo) para comparar.
function wheelContactError(distance, lane, placement) {
    const length = curve.getLength();
    const worldFromLocal = new THREE.Matrix4().compose(
        placement.position,
        new THREE.Quaternion().setFromEuler(new THREE.Euler(placement.pitch, placement.yaw, 0, 'YXZ')),
        new THREE.Vector3(SCALE, SCALE, SCALE),
    );
    return WHEELBASE.map((z) => {
        const contact = new THREE.Vector3(0, 0, z).applyMatrix4(worldFromLocal);
        // El eje delantero se busca a distancia rígida del trasero: se reproduce con una búsqueda por arco.
        let meters = distance + z * SCALE;
        const pointAt = (m, out) => {
            const tt = ((m / length) % 1 + 1) % 1;
            out.copy(curve.getPointAt(tt));
            const tg = curve.getTangentAt(tt);
            const nn = Math.hypot(tg.x, tg.z);
            out.x += (-tg.z / nn) * lane;
            out.z += (tg.x / nn) * lane;
            out.y += roadSurfaceY(lane);
            return out;
        };
        const rearPoint = pointAt(distance + WHEELBASE[0] * SCALE, new THREE.Vector3());
        if (z === WHEELBASE[1]) {
            const probe = new THREE.Vector3();
            for (let pass = 0; pass < 6; pass += 1) {
                pointAt(meters, probe);
                meters += (WHEELBASE[1] - WHEELBASE[0]) * SCALE - probe.distanceTo(rearPoint);
            }
        }
        const t = ((meters / length) % 1 + 1) % 1;
        const road = curve.getPointAt(t);
        const tan = curve.getTangentAt(t);
        const norm = Math.hypot(tan.x, tan.z);
        road.x += (-tan.z / norm) * lane;
        road.z += (tan.x / norm) * lane;
        road.y += roadSurfaceY(lane);
        return contact.distanceTo(road);
    });
}

describe('placeOnRoad', () => {
    it('las dos ruedas apoyan en el asfalto en cualquier rumbo, pendiente y carril', () => {
        const length = curve.getLength();
        for (const lane of [0, -1.8, 1.7, 2.4]) {
            for (let step = 0; step < 120; step += 1) {
                const distance = (step / 120) * length;
                const placement = placeOnRoad(curve, { distance, lane, scale: SCALE, speed: 8, wheelbase: WHEELBASE }, createPlacement());
                for (const error of wheelContactError(distance, lane, placement)) expect(error).toBeLessThan(0.012);
            }
        }
    });

    it('se inclina hacia el interior de la curva y no en recta', () => {
        const length = curve.getLength();
        let maxLeft = 0;
        let maxRight = 0;
        for (let step = 0; step < 400; step += 1) {
            const { bank } = placeOnRoad(curve, { distance: (step / 400) * length, lane: 0, scale: SCALE, speed: 10, wheelbase: WHEELBASE });
            maxLeft = Math.min(maxLeft, bank);
            maxRight = Math.max(maxRight, bank);
        }
        expect(maxLeft).toBeLessThan(-0.02);
        expect(maxRight).toBeGreaterThan(0.02);
        const stopped = placeOnRoad(curve, { distance: 100, lane: 0, scale: SCALE, speed: 0, wheelbase: WHEELBASE });
        expect(stopped.bank).toBeCloseTo(0, 5);
    });
});
