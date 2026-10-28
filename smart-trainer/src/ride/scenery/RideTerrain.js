/**
 * RideTerrain - Terreno con relieve alrededor de la carretera del ride.
 *
 * La altura se define respecto a la propia ruta (no hay altura absoluta): junto
 * a la carretera el terreno es llano y queda ligeramente por debajo del asfalto;
 * lejos de ella se eleva y ondula con ruido. Así funciona con cualquier altitud
 * (rutas generadas a ~300 m, GPX reales a cualquier cota).
 *
 * Dos capas que siguen al ciclista, alineadas a la rejilla del mundo (sin "swimming"):
 *   - fina:   256 m x 256 m con celdas de 4 m
 *   - gruesa: 1280 m x 1280 m con celdas de 16 m, con un hueco donde está la fina
 * Las capas se recalculan por tramos de forma repartida entre frames (presupuesto
 * en ms) y reutilizan sus buffers: no se crean ni destruyen geometrías al avanzar.
 * Smart Trainer - Virtual Cycling
 */

import * as THREE from 'three';
import { fbm, smoothstep } from '../../expedition/scene/noise.js';
import { createPalette, terrainColor, createGroundTexture, ROAD_CORRIDOR } from '../../expedition/scene/terrain.js';
import { RouteIndex } from './RouteIndex.js';

// Cuánto queda el terreno por debajo de la cota de la carretera (evita z-fighting)
const ROAD_SINK = 0.45;
// Distancia a la ruta a partir de la cual el relieve alcanza su altura completa
const RELIEF_FULL_DISTANCE = 130;
// Cota "virtual" usada para colorear (la paleta de Expedición espera altitudes pequeñas)
const COLOR_BASE_HEIGHT = 8;

const FINE = { cells: 64, cell: 4, snap: 32 };      // 256 m
const COARSE = { cells: 80, cell: 16, snap: 64 };   // 1280 m

/**
 * Ajusta un color de paisaje (a veces muy saturado) a un verde/tierra natural
 */
function naturalGround(color) {
    const hsl = { h: 0, s: 0, l: 0 };
    color.getHSL(hsl);
    if (hsl.l < 0.9) {
        if (hsl.s > 0.8) hsl.s *= 0.65;
        else if (hsl.l > 0.7) hsl.s *= 0.7;
        hsl.l = Math.min(hsl.l, 0.55);
        color.setHSL(hsl.h, hsl.s, hsl.l);
    }
    return color;
}

/**
 * Capa de rejilla con buffers propios y reconstrucción incremental
 */
class TerrainLayer {
    constructor({ cells, cell, snap }, material, holeEnabled) {
        this.cells = cells;
        this.cell = cell;
        this.snap = snap;
        this.holeEnabled = holeEnabled;
        this.stride = cells + 1;          // vértices por lado
        this.nodeStride = cells + 3;      // nodos por lado (con margen de 1 para las normales)
        this.half = (cells * cell) / 2;

        const vertexCount = this.stride * this.stride;
        const nodeCount = this.nodeStride * this.nodeStride;
        this.heights = new Float32Array(nodeCount);
        this.distances = new Float32Array(nodeCount);
        this.refs = new Float32Array(nodeCount);

        this.positions = new Float32Array(vertexCount * 3);
        this.normals = new Float32Array(vertexCount * 3);
        this.colors = new Float32Array(vertexCount * 3);
        const uvs = new Float32Array(vertexCount * 2);
        this.indexArray = new Uint16Array(cells * cells * 6);

        this.geometry = new THREE.BufferGeometry();
        this.geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(vertexCount * 3), 3));
        this.geometry.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(vertexCount * 3), 3));
        this.geometry.setAttribute('color', new THREE.BufferAttribute(new Float32Array(vertexCount * 3), 3));
        this.geometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
        this.geometry.setIndex(new THREE.BufferAttribute(this.indexArray, 1));
        this.geometry.setDrawRange(0, 0);

        this.mesh = new THREE.Mesh(this.geometry, material);
        this.mesh.receiveShadow = true;
        this.mesh.frustumCulled = false; // los vértices cambian de sitio: la esfera inicial no vale
        this.mesh.visible = false;
        this.uvs = uvs;

        this.applied = null; // { ox, oz } de lo que se está dibujando
        this.job = null;     // trabajo en curso
    }

    /** Origen (esquina mínima) de la rejilla ideal para un ciclista en (cx, cz) */
    desiredOrigin(cx, cz) {
        return {
            ox: Math.round(cx / this.snap) * this.snap - this.half,
            oz: Math.round(cz / this.snap) * this.snap - this.half,
        };
    }

    start(origin) {
        this.job = { ox: origin.ox, oz: origin.oz, row: -1, phase: 0 };
    }

    /**
     * Avanza el trabajo en curso hasta que pase `deadline` (performance.now()). Devuelve true al terminar.
     * @param {number} deadline
     * @param {RideTerrain} terrain - Aporta field() (altura/distancia a la ruta) y colorAt()
     */
    step(deadline, terrain) {
        const job = this.job;
        if (!job) return false;
        const { cells, cell, stride, nodeStride } = this;

        // Fase 0: alturas de los nodos (con margen)
        if (job.phase === 0) {
            while (job.row < nodeStride - 1) {
                job.row++;
                const z = job.oz + (job.row - 1) * cell;
                for (let col = 0; col < nodeStride; col++) {
                    const x = job.ox + (col - 1) * cell;
                    const index = job.row * nodeStride + col;
                    terrain.field(x, z);
                    this.heights[index] = terrain.fieldHeight;
                    this.distances[index] = terrain.fieldDistance;
                    this.refs[index] = terrain.fieldRef;
                }
                if (performance.now() > deadline) return false;
            }
            job.phase = 1;
            job.row = -1;
        }

        // Fase 1: posiciones, normales, colores y uvs por vértice
        while (job.row < cells) {
            job.row++;
            const z = job.oz + job.row * cell;
            for (let col = 0; col <= cells; col++) {
                const x = job.ox + col * cell;
                const node = (job.row + 1) * nodeStride + (col + 1);
                const vertex = job.row * stride + col;
                const h = this.heights[node];

                // Normal por diferencias centrales (continua entre filas y bordes)
                const dx = (this.heights[node + 1] - this.heights[node - 1]) / (2 * cell);
                const dz = (this.heights[node + nodeStride] - this.heights[node - nodeStride]) / (2 * cell);
                const inv = 1 / Math.sqrt(dx * dx + 1 + dz * dz);
                const nx = -dx * inv;
                const ny = inv;
                const nz = -dz * inv;

                this.positions[vertex * 3] = x;
                this.positions[vertex * 3 + 1] = h;
                this.positions[vertex * 3 + 2] = z;
                this.normals[vertex * 3] = nx;
                this.normals[vertex * 3 + 1] = ny;
                this.normals[vertex * 3 + 2] = nz;
                this.uvs[vertex * 2] = x * 0.13;
                this.uvs[vertex * 2 + 1] = z * 0.13;

                const relHeight = COLOR_BASE_HEIGHT + (h - this.refs[node]);
                terrain.colorAt(x, relHeight, z, 1 - ny, this.distances[node]);
                this.colors[vertex * 3] = terrain.scratch.r;
                this.colors[vertex * 3 + 1] = terrain.scratch.g;
                this.colors[vertex * 3 + 2] = terrain.scratch.b;
            }
            if (performance.now() > deadline) return false;
        }
        return true;
    }

    /** Vuelca el trabajo terminado a la geometría visible */
    commit() {
        const job = this.job;
        this.job = null;
        this.applied = { ox: job.ox, oz: job.oz };
        const geo = this.geometry;
        geo.getAttribute('position').array.set(this.positions);
        geo.getAttribute('normal').array.set(this.normals);
        geo.getAttribute('color').array.set(this.colors);
        geo.getAttribute('position').needsUpdate = true;
        geo.getAttribute('normal').needsUpdate = true;
        geo.getAttribute('color').needsUpdate = true;
        geo.getAttribute('uv').needsUpdate = true;
        this.mesh.visible = true;
    }

    /**
     * Reconstruye el índice de triángulos; si `hole` ({minX,maxX,minZ,maxZ}) existe, omite las celdas
     * que quedan completamente dentro (las cubre la capa fina)
     */
    rebuildIndex(hole) {
        if (!this.applied) return;
        const { cells, cell, stride } = this;
        const { ox, oz } = this.applied;
        const out = this.indexArray;
        let cursor = 0;
        for (let row = 0; row < cells; row++) {
            const z0 = oz + row * cell;
            for (let col = 0; col < cells; col++) {
                const x0 = ox + col * cell;
                if (hole
                    && x0 >= hole.minX && x0 + cell <= hole.maxX
                    && z0 >= hole.minZ && z0 + cell <= hole.maxZ) {
                    continue;
                }
                const a = row * stride + col;
                const b = a + stride;
                out[cursor++] = a;
                out[cursor++] = b;
                out[cursor++] = a + 1;
                out[cursor++] = b;
                out[cursor++] = b + 1;
                out[cursor++] = a + 1;
            }
        }
        this.geometry.setDrawRange(0, cursor);
        this.geometry.index.needsUpdate = true;
    }

    dispose() {
        this.mesh.removeFromParent();
        this.geometry.dispose();
    }
}

export class RideTerrain {
    /**
     * @param {THREE.Scene} scene
     */
    constructor(scene) {
        this.scene = scene;
        this.route = null;
        this.reliefScale = 1;
        this.palette = null;
        this.scratch = new THREE.Color();
        this.dirty = true;

        // Resultado de la última consulta de field()
        this.fieldHeight = 0;
        this.fieldDistance = Infinity;
        this.fieldRef = 0;

        this.material = new THREE.MeshStandardMaterial({
            vertexColors: true,
            roughness: 1,
            metalness: 0,
            map: createGroundTexture(),
        });

        this.fine = new TerrainLayer(FINE, this.material, false);
        this.coarse = new TerrainLayer(COARSE, this.material, true);
        scene.add(this.coarse.mesh);
        scene.add(this.fine.mesh);

        this.setStyle({});
    }

    /**
     * Estilo del mundo: { ground, shoulder, reliefScale }
     */
    setStyle({ ground = '#6f8a4c', shoulder = '#8b7355', reliefScale = 1 } = {}) {
        const groundColor = naturalGround(new THREE.Color(ground));
        this.palette = createPalette({ ground: groundColor, shoulder: new THREE.Color(shoulder) });
        const hsl = { h: 0, s: 0, l: 0 };
        groundColor.getHSL(hsl);
        // Suelo del bosque derivado del propio color del mundo (no el verde fijo de Expedición)
        this.palette.forestFloor.copy(groundColor).offsetHSL(0, -0.05, -0.14);
        if (hsl.l > 0.85) {
            // Mundo nevado: sin parches de tierra ni tinte alpino
            this.palette.dry.copy(groundColor).multiplyScalar(0.94);
            this.palette.alpine.copy(groundColor).multiplyScalar(0.97);
        } else if (hsl.l < 0.25) {
            // Mundo oscuro: los parches se quedan en la misma gama
            this.palette.dry.copy(groundColor).offsetHSL(0, 0, 0.04);
            this.palette.alpine.copy(groundColor).offsetHSL(0, 0, 0.03);
        }
        this.groundColor = groundColor;
        this.reliefScale = reliefScale;
        this.dirty = true;
    }

    /**
     * Cambia la ruta sobre la que se construye el terreno
     * @param {Array<THREE.Vector3>} points - Puntos de la carretera (elevación absoluta)
     * @param {{ incremental?: boolean }} [options] - incremental: la ruta nueva solo difiere por delante del ciclista
     *   (replanificación en directo); las capas se recalculan repartidas entre frames en vez de todas de golpe
     */
    setRoute(points, { incremental = false } = {}) {
        this.route = points && points.length >= 2 ? new RouteIndex(points) : null;
        if (!incremental || !this.fine.applied || !this.coarse.applied) {
            this.dirty = true;
            return;
        }
        for (const layer of [this.fine, this.coarse]) layer.start(layer.applied);
    }

    /** Relieve (m) respecto a la cota de la ruta, sin atenuar por distancia */
    reliefAt(x, z) {
        const hills = fbm(x * 0.0042 + 3.1, z * 0.0042 - 1.7, 4);
        let relief = (hills - 0.42) * 55;
        if (relief < 0) relief *= 0.35; // los valles son más suaves que las colinas
        relief += (fbm(x * 0.012 + 7, z * 0.012 - 5, 2) - 0.5) * 2;
        return relief * this.reliefScale;
    }

    /**
     * Calcula altura, distancia a la ruta y cota de ruta en (x, z) y las deja en this.field*
     */
    field(x, z) {
        const q = this.route.query(x, z);
        const weight = smoothstep(ROAD_CORRIDOR + 5, RELIEF_FULL_DISTANCE, q.distance);
        this.fieldRef = q.height;
        this.fieldDistance = q.distance;
        this.fieldHeight = q.height - ROAD_SINK + (weight > 0 ? this.reliefAt(x, z) * weight : 0);
    }

    colorAt(x, relHeight, z, slope, distance) {
        terrainColor(this.scratch, this.palette, x, relHeight, z, slope, distance);
    }

    /** Altura del terreno en (x, z); 0 si no hay ruta */
    heightAt(x, z) {
        if (!this.route) return 0;
        this.field(x, z);
        return this.fieldHeight;
    }

    /** Pendiente 0 (llano) a 1 (vertical) */
    slopeAt(x, z) {
        const h = this.heightAt(x, z);
        const gx = (this.heightAt(x + 2, z) - h) / 2;
        const gz = (this.heightAt(x, z + 2) - h) / 2;
        return 1 - 1 / Math.sqrt(1 + gx * gx + gz * gz);
    }

    /**
     * Mantiene el terreno centrado en el ciclista
     * @param {number} cx - X del ciclista
     * @param {number} cz - Z del ciclista
     * @param {number} budgetMs - Tiempo máximo por frame para reconstruir capas
     */
    update(cx, cz, budgetMs = 4) {
        if (!this.route) return;

        if (this.dirty) {
            // Cambio de ruta o de mundo: reconstrucción completa y síncrona
            this.dirty = false;
            for (const layer of [this.fine, this.coarse]) {
                layer.start(layer.desiredOrigin(cx, cz));
                layer.step(Infinity, this);
                layer.commit();
            }
            this.refreshHole();
            return;
        }

        const deadline = performance.now() + budgetMs;
        for (const layer of [this.fine, this.coarse]) {
            if (!layer.job) {
                const wanted = layer.desiredOrigin(cx, cz);
                if (!layer.applied || wanted.ox !== layer.applied.ox || wanted.oz !== layer.applied.oz) {
                    layer.start(wanted);
                }
            }
            if (layer.job && layer.step(deadline, this)) {
                layer.commit();
                this.refreshHole();
            }
            if (performance.now() > deadline) break;
        }
    }

    /** Recoloca el hueco de la capa gruesa según la posición vigente de la fina */
    refreshHole() {
        const applied = this.fine.applied;
        if (!applied) return;
        const size = this.fine.cells * this.fine.cell;
        this.coarse.rebuildIndex({
            minX: applied.ox,
            maxX: applied.ox + size,
            minZ: applied.oz,
            maxZ: applied.oz + size,
        });
        this.fine.rebuildIndex(null);
    }

    dispose() {
        this.fine.dispose();
        this.coarse.dispose();
        this.material.map?.dispose();
        this.material.dispose();
        this.route = null;
    }
}
