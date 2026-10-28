/**
 * BikeModel - Bici modelada en Blender (GLB) para el ciclista
 *
 * Carga `models/bike.glb` una sola vez y expone sus piezas como geometrías compartidas por slot de
 * material. Del GLB solo se usa la geometría: los materiales los pone createCyclist (el nombre de cada
 * material del GLB es la clave del slot: paint, accent, rubber, tape, tire, rim, metal, bottle).
 * Si el archivo no existe o no cumple el contrato, la bici procedural sigue usándose.
 *
 * Nodos de primer nivel esperados (geometría en el espacio local del nodo, con el origen en su pivote):
 * BikeFrame, WheelFront, WheelRear, Crankset y Pedal.
 */

import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

const BASE = (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.BASE_URL) || './';
const MODEL_URL = `${BASE}models/bike.glb`;

const NODE_NAMES = {
    frame: 'BikeFrame',
    wheelFront: 'WheelFront',
    wheelRear: 'WheelRear',
    crankset: 'Crankset',
    pedal: 'Pedal',
};

let parts = null;
let loading = null;

export function isBikeModelReady() {
    return Boolean(parts);
}

/** Piezas de la bici: `{ frame, wheelFront, wheelRear, crankset, pedal }`, cada una `[{ slot, geometry }]`. */
export function getBikeParts() {
    return parts;
}

/** Descarga la bici (una vez). Resuelve true si hay un modelo utilizable. */
export function preloadBikeModel() {
    if (parts) return Promise.resolve(true);
    if (loading) return loading;
    loading = (async () => {
        try {
            const gltf = await new GLTFLoader().loadAsync(MODEL_URL);
            gltf.scene.updateMatrixWorld(true);
            const built = {};
            for (const [key, name] of Object.entries(NODE_NAMES)) {
                const node = gltf.scene.children.find((child) => child.name === name);
                const list = node ? extractSlots(node) : [];
                if (!list.length) {
                    console.warn(`bike.glb no tiene el nodo "${name}"; se usa la bici procedural.`);
                    loading = null;
                    return false;
                }
                built[key] = list;
            }
            parts = built;
            return true;
        } catch {
            // Sin bike.glb (o no se pudo leer): se usa la bici procedural.
            loading = null;
            return false;
        }
    })();
    return loading;
}

// "paint.001" -> "paint"
function slotOf(material) {
    return (Array.isArray(material) ? material[0] : material)?.name?.replace(/\.\d+$/, '') || 'metal';
}

// Fusiona los meshes del nodo por slot, en el espacio local del nodo (se ignora la transformación del propio nodo).
function extractSlots(node) {
    const inverse = new THREE.Matrix4().copy(node.matrixWorld).invert();
    const bySlot = new Map();
    node.traverse((object) => {
        if (!object.isMesh || !object.geometry) return;
        const geometry = object.geometry.clone();
        for (const name of Object.keys(geometry.attributes)) {
            if (name !== 'position' && name !== 'normal') geometry.deleteAttribute(name);
        }
        geometry.clearGroups();
        // Al fusionar todos deben compartir indexado; se pasa todo a no indexado.
        const flat = geometry.index ? geometry.toNonIndexed() : geometry;
        if (!flat.attributes.normal) flat.computeVertexNormals();
        // Si el nodo es el propio mesh, su transformación se ignora (identidad).
        if (object !== node) flat.applyMatrix4(inverse.clone().multiply(object.matrixWorld));
        const slot = slotOf(object.material);
        if (!bySlot.has(slot)) bySlot.set(slot, []);
        bySlot.get(slot).push(flat);
    });
    return [...bySlot.entries()].map(([slot, list]) => {
        const geometry = list.length === 1 ? list[0] : mergeGeometries(list);
        geometry.userData.shared = true;
        return { slot, geometry };
    });
}
