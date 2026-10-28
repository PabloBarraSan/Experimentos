/**
 * RideDecor - Árboles, arbustos y rocas a los lados de la carretera del ride.
 *
 * La ruta puede medir 100+ km, así que solo se genera una ventana deslizante
 * alrededor del ciclista, dividida en celdas de 20 m de ruta. Cada celda se
 * genera de forma determinista (semilla de ruta + índice de celda) y se
 * cachea mientras está en la ventana: al avanzar solo se calculan las celdas
 * nuevas (con presupuesto por frame) y se reescriben las matrices de unos
 * pocos InstancedMesh de capacidad fija. No se crean geometrías por frame.
 * Smart Trainer - Virtual Cycling
 */

import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { fbm, hash2, smoothstep } from '../../expedition/scene/noise.js';
import { buildFarTree, buildRock, buildTrunk, createRandom, finalize, withColor } from '../../expedition/scene/vegetation.js';

const CELL = 20;            // metros de ruta por celda
const BEHIND = 150;         // metros de ventana por detrás del ciclista
const AHEAD = 550;          // metros de ventana por delante
const CELLS_PER_FRAME = 2;  // celdas nuevas que se calculan por frame

// Capacidad máxima de instancias por tipo (limita el coste de render)
const CAPACITY = { conifer: 420, round: 420, bush: 220, rock: 220 };

const TREE_OBJECTS = ['tree', 'pine_tree', 'palm', 'olive_tree'];

/** Copa redondeada: blobs de icosaedro con normales radiales y sombreado por altura */
function buildBlob(cx, cy, cz, radius, squash) {
    const geometry = new THREE.IcosahedronGeometry(1, 1);
    const position = geometry.getAttribute('position');
    const normal = geometry.getAttribute('normal');
    const dir = new THREE.Vector3();
    for (let i = 0; i < position.count; i++) {
        dir.set(position.getX(i), position.getY(i), position.getZ(i)).normalize();
        const lump = 0.9 + hash2(Math.round(dir.x * 9) + cx * 3, Math.round(dir.z * 9) + cy) * 0.2;
        position.setXYZ(i,
            cx + dir.x * radius * lump,
            cy + dir.y * radius * squash * lump,
            cz + dir.z * radius * lump);
        normal.setXYZ(i, dir.x, dir.y, dir.z);
    }
    return withColor(finalize(geometry), (x, y) => {
        const shade = 0.55 + 0.45 * smoothstep(cy - radius, cy + radius, y);
        return [shade, shade, shade * 0.94];
    });
}

function buildRoundFoliage() {
    return mergeGeometries([
        buildBlob(0, 3.6, 0, 1.7, 0.9),
        buildBlob(-1.0, 3.0, 0.3, 1.15, 0.9),
        buildBlob(1.0, 3.1, -0.25, 1.2, 0.9),
        buildBlob(0.15, 4.5, 0.1, 1.1, 0.9),
    ]);
}

function buildBushGeometry() {
    return buildBlob(0, 0.55, 0, 1, 0.75);
}

export class RideDecor {
    /**
     * @param {THREE.Scene} scene
     * @param {RideTerrain} terrain - Consulta de altura/distancia a la ruta
     */
    constructor(scene, terrain) {
        this.scene = scene;
        this.terrain = terrain;
        this.group = new THREE.Group();
        scene.add(this.group);

        this.curve = null;
        this.length = 0;
        this.seed = 0;
        this.cache = new Map();     // índice de celda -> placements
        this.stale = new Set();     // celdas que siguen dibujándose pero hay que recalcular (curva cambiada)
        this.firstCell = null;
        this.lastCell = null;
        this.needsFill = true;
        this.needsFullWindow = true;

        this.flags = { conifers: 0, rounds: 0, bushes: false, density: 0.5 };
        this.palettes = null;

        this.tmpPoint = new THREE.Vector3();
        this.tmpTangent = new THREE.Vector3();
        this.dummy = new THREE.Object3D();
        this.color = new THREE.Color();

        // Materiales y geometrías compartidos
        this.disposables = [];
        const foliageMaterial = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.92, metalness: 0 });
        const barkMaterial = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1 });
        const rockMaterial = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.96 });
        this.disposables.push(foliageMaterial, barkMaterial, rockMaterial);

        const roundTrunk = buildTrunk(2.8, 0.1, 0.22, new THREE.Color(0x6e5640));

        this.kinds = {
            conifer: [this._makeMesh(buildFarTree(), foliageMaterial, CAPACITY.conifer, true, true)],
            round: [
                this._makeMesh(buildRoundFoliage(), foliageMaterial, CAPACITY.round, true, true),
                this._makeMesh(roundTrunk, barkMaterial, CAPACITY.round, false, true),
            ],
            bush: [this._makeMesh(buildBushGeometry(), foliageMaterial, CAPACITY.bush, true, false)],
            rock: [this._makeMesh(buildRock(), rockMaterial, CAPACITY.rock, true, true)],
        };
    }

    _makeMesh(geometry, material, capacity, colored, castShadow) {
        const mesh = new THREE.InstancedMesh(geometry, material, capacity);
        mesh.count = 0;
        mesh.frustumCulled = false; // las instancias se reescriben: la esfera inicial no vale
        mesh.castShadow = castShadow;
        mesh.receiveShadow = false;
        if (colored) mesh.setColorAt(0, new THREE.Color(1, 1, 1)); // reserva el buffer de color
        this.group.add(mesh);
        this.disposables.push(geometry);
        return { mesh, colored };
    }

    /**
     * @param {Object} route - { curve, length, seed }
     */
    setRoute({ curve, length, seed }) {
        this.curve = curve;
        this.length = length;
        this.seed = seed >>> 0;
        this._reset();
    }

    /**
     * Sustituye la curva sin vaciar el decorado: la curva nueva coincide con la anterior hasta `fromMeters`
     * (replanificación en directo). Las celdas siguientes se recalculan poco a poco y, mientras tanto, se sigue
     * dibujando su versión anterior.
     * @param {Object} route - { curve, length }
     * @param {number} fromMeters - Metros de arco desde los que la curva ha cambiado
     */
    updateCurve({ curve, length }, fromMeters) {
        this.curve = curve;
        this.length = length;
        const firstStale = Math.max(0, Math.floor(fromMeters / CELL));
        for (const key of this.cache.keys()) {
            if (key >= firstStale) this.stale.add(key);
        }
    }

    /**
     * Densidad y especies según el mundo (landscape.objects / objectDensity)
     */
    setWorld(worldConfig) {
        const landscape = worldConfig?.landscape || {};
        const objects = Array.isArray(landscape.objects) ? landscape.objects : [];
        const density = THREE.MathUtils.clamp(landscape.objectDensity ?? 0.5, 0, 1);
        const hasTrees = objects.some((name) => TREE_OBJECTS.includes(name));

        let conifers = 0;
        let rounds = 0;
        if (hasTrees) {
            if (objects.includes('pine_tree')) {
                conifers = 1;
            } else if (objects.includes('olive_tree') || objects.includes('palm')) {
                rounds = 0.85;
                conifers = 0.15;
            } else {
                rounds = 0.7;
                conifers = 0.3;
            }
        }

        const ground = new THREE.Color(landscape.groundColor || '#6f8a4c');
        const hsl = { h: 0, s: 0, l: 0 };
        ground.getHSL(hsl);
        const snowy = hsl.l > 0.85;
        const dark = hsl.l < 0.25;

        const conifer = [0x24492f, 0x2b5637, 0x31603c, 0x3a6a40].map((c) => new THREE.Color(c));
        const olive = objects.includes('olive_tree');
        const round = (olive ? [0x7d8a4a, 0x6b7a3e, 0x8f9552, 0x768444] : [0x6d8a3e, 0x7f9a44, 0x5f8446, 0x9aa246]).map((c) => new THREE.Color(c));
        if (snowy) conifer.forEach((c) => c.lerp(new THREE.Color(0xe8eef0), 0.3));

        this.flags = { conifers, rounds, bushes: hasTrees, density };
        this.palettes = { conifer, round, snowy, dark };
        this._reset();
    }

    _reset() {
        this.cache.clear();
        this.stale.clear();
        this.firstCell = null;
        this.lastCell = null;
        this.needsFill = true;
        this.needsFullWindow = true;
    }

    /** Celdas generadas actualmente (diagnóstico) */
    get cellCount() {
        return this.cache.size;
    }

    /**
     * Genera de forma determinista el contenido de una celda de 20 m de ruta
     * @returns {Array<Object>} placements { kind, x, y, z, scale, sy, yaw, tiltX, tiltZ, sink, hue }
     */
    computeCell(index) {
        const out = [];
        const start = index * CELL;
        if (!this.curve || !this.palettes || start < 0 || start > this.length) return out;

        const random = createRandom((this.seed ^ Math.imul(index + 7919, 2654435761)) >>> 0);
        const { conifers, rounds, bushes, density } = this.flags;
        const treeAttempts = conifers + rounds > 0 ? Math.ceil(density * 16) : 0;
        const bushAttempts = bushes ? Math.ceil(density * 5) : 0;
        const rockAttempts = 2 + Math.round((1 - density) * 3);
        const terrain = this.terrain;

        // Punto lateral a la carretera; null si cae en una ladera o cerca de otro tramo de ruta
        const roadside = (minOffset, maxOffset, power, maxSlope) => {
            const along = random();
            const side = random() < 0.5 ? -1 : 1;
            const spread = random();
            const t = THREE.MathUtils.clamp((start + along * CELL) / this.length, 0, 1);
            this.curve.getPointAt(t, this.tmpPoint);
            this.curve.getTangentAt(t, this.tmpTangent);
            const norm = Math.hypot(this.tmpTangent.x, this.tmpTangent.z) || 1;
            const offset = minOffset + Math.pow(spread, power) * (maxOffset - minOffset);
            const x = this.tmpPoint.x - (this.tmpTangent.z / norm) * side * offset;
            const z = this.tmpPoint.z + (this.tmpTangent.x / norm) * side * offset;
            terrain.field(x, z);
            if (terrain.fieldDistance < offset * 0.7) return null;
            const y = terrain.fieldHeight;
            if (maxSlope < 1) {
                const gx = (terrain.heightAt(x + 2, z) - y) / 2;
                const gz = (terrain.heightAt(x, z + 2) - y) / 2;
                if (1 - 1 / Math.sqrt(1 + gx * gx + gz * gz) > maxSlope) return null;
            }
            return { x, y, z };
        };

        for (let i = 0; i < treeAttempts; i++) {
            const point = roadside(9, 75, 1.25, 0.2);
            if (!point) continue;
            const grove = smoothstep(0.34, 0.62, fbm(point.x * 0.02 + 5, point.z * 0.02 - 2, 3));
            const accept = random();
            const pick = random();
            const scale = 0.85 + random() * 0.85;
            const yaw = random() * Math.PI * 2;
            const hue = random();
            const squash = 0.9 + random() * 0.3;
            if (accept > 0.15 + grove * 0.85) continue;
            const isConifer = pick * (conifers + rounds) < conifers;
            out.push({
                kind: isConifer ? 'conifer' : 'round',
                ...point,
                scale,
                sy: scale * squash,
                yaw,
                tiltX: 0,
                tiltZ: 0,
                sink: -0.15,
                hue,
            });
        }

        for (let i = 0; i < bushAttempts; i++) {
            const point = roadside(7, 35, 1.4, 0.22);
            const scale = 0.5 + random() * 0.7;
            const yaw = random() * Math.PI * 2;
            const hue = random();
            if (!point) continue;
            out.push({ kind: 'bush', ...point, scale, sy: scale, yaw, tiltX: 0, tiltZ: 0, sink: -0.1, hue });
        }

        for (let i = 0; i < rockAttempts; i++) {
            const point = roadside(6.5, 60, 1.3, 0.3);
            const scale = 0.4 + Math.pow(random(), 2.2) * 1.9;
            const flat = 0.7 + random() * 0.5;
            const yaw = random() * Math.PI * 2;
            const tiltX = (random() - 0.5) * 0.4;
            const tiltZ = (random() - 0.5) * 0.4;
            const hue = random();
            if (!point) continue;
            out.push({ kind: 'rock', ...point, scale, sy: scale * flat, yaw, tiltX, tiltZ, sink: -scale * 0.25, hue });
        }

        return out;
    }

    /**
     * Mantiene la ventana de decorado alrededor de la distancia del ciclista
     * @param {number} distance - Distancia recorrida sobre la ruta (m)
     */
    update(distance) {
        if (!this.curve || !this.palettes) return;

        const maxCell = Math.floor(this.length / CELL);
        const first = Math.max(0, Math.floor((distance - BEHIND) / CELL));
        const last = Math.min(maxCell, Math.floor((distance + AHEAD) / CELL));
        const center = Math.floor(distance / CELL);

        if (first !== this.firstCell || last !== this.lastCell) {
            this.firstCell = first;
            this.lastCell = last;
            this.needsFill = true;
            // Libera las celdas que han quedado fuera de la ventana
            for (const key of this.cache.keys()) {
                if (key < first - 2 || key > last + 2) {
                    this.cache.delete(key);
                    this.stale.delete(key);
                }
            }
        }

        // Celdas pendientes: primero las más cercanas al ciclista
        let budget = this.needsFullWindow ? Infinity : CELLS_PER_FRAME;
        const missing = [];
        for (let k = first; k <= last; k++) {
            if (!this.cache.has(k) || this.stale.has(k)) missing.push(k);
        }
        missing.sort((a, b) => Math.abs(a - center) - Math.abs(b - center));
        for (const k of missing) {
            if (budget-- <= 0) break;
            this.cache.set(k, this.computeCell(k));
            this.stale.delete(k);
            this.needsFill = true;
        }
        if (this.needsFullWindow) this.needsFullWindow = false;

        if (this.needsFill) this._fill(first, last);
    }

    /** Reescribe las matrices y colores de los InstancedMesh con las celdas de la ventana */
    _fill(first, last) {
        const counts = { conifer: 0, round: 0, bush: 0, rock: 0 };
        const { dummy, color, palettes } = this;

        for (let k = first; k <= last; k++) {
            const placements = this.cache.get(k);
            if (!placements) continue;
            for (const p of placements) {
                const slot = counts[p.kind];
                if (slot >= CAPACITY[p.kind]) continue;
                counts[p.kind] = slot + 1;

                dummy.position.set(p.x, p.y + p.sink, p.z);
                dummy.rotation.set(p.tiltX, p.yaw, p.tiltZ);
                dummy.scale.set(p.scale, p.sy, p.scale);
                dummy.updateMatrix();

                for (const part of this.kinds[p.kind]) {
                    part.mesh.setMatrixAt(slot, dummy.matrix);
                    if (part.colored) part.mesh.setColorAt(slot, this._colorFor(p, color, palettes));
                }
            }
        }

        for (const [kind, parts] of Object.entries(this.kinds)) {
            for (const part of parts) {
                part.mesh.count = counts[kind];
                part.mesh.instanceMatrix.needsUpdate = true;
                if (part.mesh.instanceColor) part.mesh.instanceColor.needsUpdate = true;
            }
        }
        this.needsFill = false;
    }

    _colorFor(p, color, palettes) {
        switch (p.kind) {
            case 'conifer': {
                const base = palettes.conifer[Math.floor(p.hue * palettes.conifer.length) % palettes.conifer.length];
                return color.copy(base).offsetHSL((p.hue - 0.5) * 0.02, 0, (p.hue - 0.5) * 0.05);
            }
            case 'round': {
                const base = palettes.round[Math.floor(p.hue * palettes.round.length) % palettes.round.length];
                return color.copy(base).offsetHSL((p.hue - 0.5) * 0.03, 0, (p.hue - 0.5) * 0.06);
            }
            case 'bush': {
                const base = palettes.round[Math.floor(p.hue * palettes.round.length) % palettes.round.length];
                return color.copy(base).offsetHSL(0, -0.03, -0.04);
            }
            default: {
                if (palettes.dark) return color.setHSL(0.02 + p.hue * 0.04, 0.12, 0.1 + p.hue * 0.1);
                if (palettes.snowy) return color.setHSL(0.6, 0.05, 0.5 + p.hue * 0.25);
                return color.setHSL(0.09 + p.hue * 0.06, 0.06, 0.42 + p.hue * 0.2);
            }
        }
    }

    dispose() {
        this.group.removeFromParent();
        for (const parts of Object.values(this.kinds)) {
            for (const part of parts) part.mesh.dispose();
        }
        new Set(this.disposables).forEach((resource) => resource.dispose());
        this.cache.clear();
        this.stale.clear();
        this.curve = null;
    }
}
