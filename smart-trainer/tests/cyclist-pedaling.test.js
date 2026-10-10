import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { animateCyclist, BIKE } from '../src/expedition/Cyclist.js';

function fakeLeg() {
  const part = () => new THREE.Mesh(new THREE.BufferGeometry(), new THREE.MeshBasicMaterial());
  return { short: part(), thigh: part(), calf: part(), sock: part(), knee: part(), shoe: part(), stripe: part(), pedal: part() };
}

function fakeCyclist() {
  const part = () => new THREE.Mesh(new THREE.BufferGeometry(), new THREE.MeshBasicMaterial());
  return {
    group: new THREE.Group(),
    rearWheel: new THREE.Group(),
    frontWheel: new THREE.Group(),
    leftLeg: fakeLeg(),
    rightLeg: fakeLeg(),
    leftCrank: part(),
    rightCrank: part(),
    crankRing: new THREE.Group(),
  };
}

// Pedal izquierdo (el derecho va desfasado 180°) respecto al eje del pedalier: z hacia delante, y hacia arriba.
function pedalAt(angle) {
  const cyclist = fakeCyclist();
  animateCyclist(cyclist, angle, 8, 0.5, true);
  const { x, y, z } = cyclist.leftLeg.pedal.position;
  return { x, y: y - BIKE.bottomBracket.y, z };
}

describe('sentido del pedaleo', () => {
  it('el pie va de delante hacia abajo al aumentar el ángulo', () => {
    const front = pedalAt(0);
    const quarter = pedalAt(Math.PI / 2);
    const half = pedalAt(Math.PI);
    const threeQuarters = pedalAt(Math.PI * 1.5);
    expect(front.z).toBeGreaterThan(0.15);
    expect(quarter.y).toBeLessThan(-0.15); // abajo
    expect(half.z).toBeLessThan(-0.15); // detrás
    expect(threeQuarters.y).toBeGreaterThan(0.15); // arriba
  });

  it('el plato y las piernas giran en el mismo sentido', () => {
    const cyclist = fakeCyclist();
    animateCyclist(cyclist, 0.4, 8, 0.5, true);
    // Rotación positiva sobre x: el punto de arriba pasa a delante (pedaleo hacia delante).
    const top = new THREE.Vector3(0, 1, 0).applyEuler(new THREE.Euler(cyclist.crankRing.rotation.x, 0, 0));
    expect(top.z).toBeGreaterThan(0);
    // Con el mismo ángulo, el pie ya ha pasado de delante hacia abajo.
    expect(pedalAt(0.4).y).toBeLessThan(0);
  });
});
