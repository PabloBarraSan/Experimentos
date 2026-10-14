import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { fbm, hash2, smoothstep } from './noise.js';
import { WATER_LEVEL, ROAD_CORRIDOR } from './terrain.js';

const VEGETATION_QUALITY = {
    low: { nearTrees: 60, farTrees: 160, grass: 3500, blades: 4, flowers: 300, rocks: 36, bushes: 40, shadows: false },
    medium: { nearTrees: 130, farTrees: 480, grass: 11000, blades: 5, flowers: 900, rocks: 64, bushes: 90, shadows: false },
    high: { nearTrees: 240, farTrees: 1000, grass: 26000, blades: 6, flowers: 2200, rocks: 110, bushes: 170, shadows: true },
};

const GRASS_CHUNKS = 14;

export function createRandom(seed) {
    let state = seed >>> 0;
    return () => {
        state = (state + 0x6d2b79f5) >>> 0;
        let t = state;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

function ensureNonIndexed(geometry) {
    return geometry.index ? geometry.toNonIndexed() : geometry;
}

// Balanceo por viento en el vértice: la punta se mueve más que la base.
function applyWind(material, wind, strength, frequency = 1) {
    material.onBeforeCompile = (shader) => {
        shader.uniforms.windTime = wind;
        shader.vertexShader = shader.vertexShader
            .replace('#include <common>', `#include <common>
                uniform float windTime;`)
            .replace('#include <begin_vertex>', `#include <begin_vertex>
                #ifdef USE_INSTANCING
                    vec2 windOrigin = instanceMatrix[3].xz;
                #else
                    vec2 windOrigin = vec2(0.0);
                #endif
                float windPhase = windTime * ${(1.3 * frequency).toFixed(2)} + windOrigin.x * 0.09 + windOrigin.y * 0.06;
                float windBend = max(position.y, 0.0);
                transformed.x += (sin(windPhase) + 0.45 * sin(windPhase * 2.3 + windOrigin.y)) * ${strength.toFixed(3)} * windBend * windBend * 0.5;
                transformed.z += cos(windPhase * 0.8 + windOrigin.x * 0.2) * ${(strength * 0.6).toFixed(3)} * windBend * windBend * 0.5;`);
        // La hierba es de doble cara pero se ilumina siempre como la cara frontal.
        shader.fragmentShader = shader.fragmentShader.replace(
            '#include <normal_fragment_begin>',
            THREE.ShaderChunk.normal_fragment_begin.replace('gl_FrontFacing ? 1.0 : - 1.0', '1.0'),
        );
    };
}

export function finalize(geometry) {
    geometry.deleteAttribute('uv');
    return geometry;
}

export function withColor(geometry, colorFn) {
    const position = geometry.getAttribute('position');
    const colors = new Float32Array(position.count * 3);
    for (let index = 0; index < position.count; index += 1) {
        const [r, g, b] = colorFn(position.getX(index), position.getY(index), position.getZ(index), index);
        colors.set([r, g, b], index * 3);
    }
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    return geometry;
}

// Copas cónicas por capas con borde irregular y caída de ramas.
function buildConiferFoliage() {
    const tiers = 9;
    const parts = [];
    for (let tier = 0; tier < tiers; tier += 1) {
        const f = tier / (tiers - 1);
        const baseY = 1.25 + f * 4.7;
        const radius = 2.05 * Math.pow(1 - f, 0.85) + 0.32;
        const height = 1.75 - f * 0.55;
        const cone = ensureNonIndexed(new THREE.ConeGeometry(radius, height, 16, 3, true));
        cone.translate(0, baseY + height / 2, 0);
        const position = cone.getAttribute('position');
        const normal = new Float32Array(position.count * 3);
        const tint = new Float32Array(position.count * 3);
        for (let index = 0; index < position.count; index += 1) {
            const x = position.getX(index);
            const y = position.getY(index);
            const z = position.getZ(index);
            const rel = THREE.MathUtils.clamp((y - baseY) / height, 0, 1);
            const rimAmount = 1 - rel;
            const angle = Math.atan2(z, x);
            const jitter = 1 + (hash2(Math.round(angle * 40) + tier * 13, tier) - 0.5) * 0.4 * rimAmount;
            const nx = x * jitter;
            const nz = z * jitter;
            const droop = rimAmount * rimAmount * 0.32 * radius * 0.5;
            position.setXYZ(index, nx, y - droop, nz);
            const n = new THREE.Vector3(nx, 0.55 + rel * 0.4, nz).normalize();
            normal.set([n.x, n.y, n.z], index * 3);
            // Interior oscuro, puntas iluminadas; más luz cuanto más alta la capa.
            const shade = (0.42 + 0.58 * Math.pow(rel, 0.8)) * (0.7 + 0.3 * f) * (0.94 + hash2(index, tier) * 0.1);
            tint.set([shade * 0.98, shade, shade * 0.9], index * 3);
        }
        cone.setAttribute('normal', new THREE.BufferAttribute(normal, 3));
        cone.setAttribute('color', new THREE.BufferAttribute(tint, 3));
        parts.push(finalize(cone));
    }
    return mergeGeometries(parts);
}

export function buildTrunk(height, topRadius, baseRadius, color) {
    const geometry = ensureNonIndexed(new THREE.CylinderGeometry(topRadius, baseRadius, height, 8, 3));
    geometry.translate(0, height / 2, 0);
    geometry.computeVertexNormals();
    withColor(geometry, (x, y, z) => {
        const bark = 0.8 + hash2(Math.atan2(z, x) * 9, Math.floor(y * 3)) * 0.3;
        const foot = 0.55 + 0.45 * smoothstep(0, 1.4, y);
        return [color.r * bark * foot, color.g * bark * foot, color.b * bark * foot];
    });
    return finalize(geometry);
}

// Copa de árbol frondoso: cúmulo de blobs deformados con normales de "copa
// unificada" para que se ilumine como un volumen, no como bolas sueltas.
function buildCrown(blobs, crownCenter, crownRadius) {
    const parts = blobs.map((blob, blobIndex) => {
        const geometry = new THREE.IcosahedronGeometry(1, 3);
        const position = geometry.getAttribute('position');
        const normal = new Float32Array(position.count * 3);
        const tint = new Float32Array(position.count * 3);
        for (let index = 0; index < position.count; index += 1) {
            const dir = new THREE.Vector3(position.getX(index), position.getY(index), position.getZ(index)).normalize();
            const lump = 1 + (fbm(dir.x * 2.6 + blobIndex * 3.1, dir.y * 2.6 + dir.z * 2.6, 3) - 0.5) * 0.55;
            const world = new THREE.Vector3(
                blob.x + dir.x * blob.r * blob.sx * lump,
                blob.y + dir.y * blob.r * blob.sy * lump,
                blob.z + dir.z * blob.r * blob.sx * lump,
            );
            position.setXYZ(index, world.x, world.y, world.z);
            const crownNormal = world.clone().sub(crownCenter).normalize();
            const n = crownNormal.multiplyScalar(0.65).add(dir.multiplyScalar(0.35)).normalize();
            normal.set([n.x, n.y, n.z], index * 3);
            const rel = THREE.MathUtils.clamp((world.y - (crownCenter.y - crownRadius)) / (crownRadius * 2), 0, 1);
            const shade = (0.5 + 0.5 * Math.pow(rel, 0.9)) * (0.9 + hash2(index, blobIndex) * 0.16);
            tint.set([shade, shade, shade * 0.93], index * 3);
        }
        geometry.setAttribute('normal', new THREE.BufferAttribute(normal, 3));
        geometry.setAttribute('color', new THREE.BufferAttribute(tint, 3));
        return finalize(geometry);
    });
    return mergeGeometries(parts);
}

function buildBroadleaf() {
    const crownCenter = new THREE.Vector3(0, 4.1, 0);
    const blobs = [
        { x: 0, y: 4.1, z: 0, r: 1.5, sx: 1, sy: 0.92 },
        { x: -1.05, y: 3.55, z: 0.25, r: 1.05, sx: 1, sy: 0.95 },
        { x: 1.0, y: 3.6, z: -0.2, r: 1.1, sx: 1, sy: 0.9 },
        { x: 0.2, y: 5.05, z: 0.15, r: 1.05, sx: 1, sy: 0.9 },
        { x: -0.35, y: 3.45, z: -1.0, r: 0.95, sx: 1, sy: 0.9 },
        { x: 0.4, y: 3.55, z: 1.0, r: 0.92, sx: 1, sy: 0.9 },
    ];
    const trunk = buildTrunk(3.4, 0.12, 0.27, new THREE.Color(0x6e5640));
    const branchA = ensureNonIndexed(new THREE.CylinderGeometry(0.05, 0.09, 1.6, 6));
    branchA.rotateZ(0.7);
    branchA.translate(-0.55, 3.0, 0);
    withColor(branchA, () => [0.42, 0.32, 0.24]);
    const branchB = ensureNonIndexed(new THREE.CylinderGeometry(0.05, 0.09, 1.5, 6));
    branchB.rotateZ(-0.65);
    branchB.translate(0.5, 3.05, 0.1);
    withColor(branchB, () => [0.42, 0.32, 0.24]);
    return {
        foliage: buildCrown(blobs, crownCenter, 2.4),
        trunk: mergeGeometries([trunk, finalize(branchA), finalize(branchB)]),
    };
}

export function buildFarTree() {
    const parts = [0, 1, 2].map((tier) => {
        const radius = 1.7 - tier * 0.42;
        const height = 2.6 - tier * 0.3;
        const cone = ensureNonIndexed(new THREE.ConeGeometry(radius, height, 7, 1, false));
        cone.translate(0, 1.2 + tier * 1.55 + height / 2, 0);
        cone.computeVertexNormals();
        return finalize(withColor(cone, (x, y) => {
            const shade = 0.5 + 0.5 * smoothstep(0.6, 6.4, y);
            return [shade, shade, shade * 0.92];
        }));
    });
    const trunk = ensureNonIndexed(new THREE.CylinderGeometry(0.16, 0.22, 1.4, 5));
    trunk.translate(0, 0.7, 0);
    trunk.computeVertexNormals();
    parts.push(finalize(withColor(trunk, () => [0.3, 0.24, 0.18])));
    return mergeGeometries(parts);
}

export function buildRock() {
    const geometry = new THREE.IcosahedronGeometry(1, 1);
    const position = geometry.getAttribute('position');
    for (let index = 0; index < position.count; index += 1) {
        const x = position.getX(index);
        const y = position.getY(index);
        const z = position.getZ(index);
        // Desplazamiento por posición: los vértices compartidos se mueven igual.
        const displacement = 0.74 + hash2(x * 7.13 + y * 3.1, z * 5.7 + y * 1.3) * 0.5;
        position.setXYZ(index, x * displacement, y * displacement * 0.72, z * displacement);
    }
    geometry.computeVertexNormals();
    return finalize(withColor(geometry, (x, y) => {
        const shade = 0.66 + 0.34 * smoothstep(-0.7, 0.7, y);
        return [shade, shade, shade * 0.97];
    }));
}

function buildGrassTuft(bladeCount) {
    const positions = [];
    const colors = [];
    const normals = [];
    const random = createRandom(4242);
    for (let blade = 0; blade < bladeCount; blade += 1) {
        const angle = random() * Math.PI * 2;
        const distance = Math.sqrt(random()) * 0.3;
        const bx = Math.cos(angle) * distance;
        const bz = Math.sin(angle) * distance;
        const height = 0.5 + random() * 0.6;
        const width = 0.045 + random() * 0.04;
        const facing = random() * Math.PI;
        const lean = (random() - 0.35) * 0.3;
        const leanAngle = random() * Math.PI * 2;
        const sx = Math.cos(facing) * width;
        const sz = Math.sin(facing) * width;
        const leanX = Math.cos(leanAngle) * lean;
        const leanZ = Math.sin(leanAngle) * lean;
        const midX = bx + leanX * 0.35;
        const midZ = bz + leanZ * 0.35;
        const tipX = bx + leanX;
        const tipZ = bz + leanZ;
        const verts = [
            [bx - sx, 0, bz - sz], [bx + sx, 0, bz + sz],
            [midX - sx * 0.7, height * 0.55, midZ - sz * 0.7], [midX + sx * 0.7, height * 0.55, midZ + sz * 0.7],
            [tipX, height, tipZ],
        ];
        const shades = [0.32, 0.32, 0.72, 0.72, 1.05];
        const order = [0, 1, 2, 1, 3, 2, 2, 3, 4];
        for (const vertexIndex of order) {
            const [x, y, z] = verts[vertexIndex];
            positions.push(x, y, z);
            const shade = shades[vertexIndex];
            colors.push(shade * 0.95, shade, shade * 0.72);
            normals.push(0, 1, 0);
        }
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
    return geometry;
}

function buildFlower() {
    const geometry = ensureNonIndexed(new THREE.CircleGeometry(0.075, 6));
    geometry.rotateX(-Math.PI / 2 + 0.35);
    geometry.translate(0, 0.42, 0);
    const position = geometry.getAttribute('position');
    const normals = new Float32Array(position.count * 3);
    for (let index = 0; index < position.count; index += 1) normals.set([0, 1, 0], index * 3);
    geometry.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
    return finalize(withColor(geometry, () => [1, 1, 1]));
}

export function createVegetation({ terrain, routeCurve, worldStyle, quality }) {
    const preset = VEGETATION_QUALITY[quality] || VEGETATION_QUALITY.medium;
    const group = new THREE.Group();
    const wind = { value: 0 };
    const disposables = [];
    const random = createRandom(1337);

    const tangentAt = (t) => {
        const tangent = routeCurve.getTangentAt(t);
        return new THREE.Vector2(tangent.x, tangent.z).normalize();
    };

    // Punto aleatorio junto a la ruta; devuelve null si cae en agua o ladera.
    function roadsidePoint(minOffset, maxOffset, { maxSlope = 0.2, power = 1, t: fixedT } = {}) {
        const t = fixedT ?? random();
        const center = routeCurve.getPointAt(t);
        const tangent = tangentAt(t);
        const side = random() < 0.5 ? -1 : 1;
        const offset = minOffset + Math.pow(random(), power) * (maxOffset - minOffset);
        const x = center.x - tangent.y * side * offset;
        const z = center.z + tangent.x * side * offset;
        const y = terrain.heightAt(x, z);
        if (y < WATER_LEVEL + 0.5 || terrain.slopeAt(x, z) > maxSlope) return null;
        return { x, y, z, t };
    }

    const addInstanced = (geometry, material, placements, { cast = false, receive = true, colorFn } = {}) => {
        if (!placements.length) return null;
        const mesh = new THREE.InstancedMesh(geometry, material, placements.length);
        const dummy = new THREE.Object3D();
        const color = new THREE.Color();
        placements.forEach((placement, index) => {
            dummy.position.set(placement.x, placement.y + (placement.sink || 0), placement.z);
            dummy.rotation.set(placement.tiltX || 0, placement.yaw || 0, placement.tiltZ || 0);
            dummy.scale.set(placement.sx ?? placement.scale, placement.sy ?? placement.scale, placement.sz ?? placement.scale);
            dummy.updateMatrix();
            mesh.setMatrixAt(index, dummy.matrix);
            if (colorFn) mesh.setColorAt(index, colorFn(color, placement, index));
        });
        mesh.instanceMatrix.needsUpdate = true;
        if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
        mesh.castShadow = cast && preset.shadows;
        mesh.receiveShadow = receive && preset.shadows;
        mesh.computeBoundingSphere();
        group.add(mesh);
        disposables.push(geometry, material);
        return mesh;
    };

    // ---- Árboles cercanos (alta calidad) ----
    const conifers = [];
    const broadleaves = [];
    let attempts = 0;
    while (conifers.length + broadleaves.length < preset.nearTrees && attempts < preset.nearTrees * 12) {
        attempts += 1;
        const point = roadsidePoint(12, 70, { maxSlope: 0.24, power: 1.25 });
        if (!point) continue;
        const density = smoothstep(0.36, 0.62, fbm(point.x * 0.024 + 5, point.z * 0.024 - 2, 3));
        if (random() > 0.18 + density * 0.82) continue;
        const scale = 0.8 + random() * 1.15;
        const placement = {
            ...point,
            scale,
            sx: scale * (0.9 + random() * 0.2),
            sz: scale * (0.9 + random() * 0.2),
            sy: scale * (0.9 + random() * 0.25),
            yaw: random() * Math.PI * 2,
            tiltX: (random() - 0.5) * 0.05,
            tiltZ: (random() - 0.5) * 0.05,
            sink: -0.08,
            hue: random(),
        };
        (random() < 0.3 ? broadleaves : conifers).push(placement);
    }

    const foliageMaterial = () => {
        const material = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.92, metalness: 0 });
        applyWind(material, wind, 0.02, 1);
        return material;
    };
    const barkMaterial = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1 });
    const coniferColors = [0x24492f, 0x2b5637, 0x31603c, 0x3a6a40].map((c) => new THREE.Color(c));
    const broadleafColors = [0x6d8a3e, 0x7f9a44, 0x5f8446, 0x9aa246, 0xb08a3a].map((c) => new THREE.Color(c));
    if (worldStyle.tree) coniferColors.push(new THREE.Color(worldStyle.tree));

    addInstanced(buildConiferFoliage(), foliageMaterial(), conifers, {
        cast: true,
        colorFn: (color, placement) => color.copy(coniferColors[Math.floor(placement.hue * coniferColors.length)])
            .offsetHSL((placement.hue - 0.5) * 0.02, 0, (placement.hue - 0.5) * 0.05),
    });
    const trunkGeometry = buildTrunk(3.4, 0.09, 0.24, new THREE.Color(0x5f4933));
    addInstanced(trunkGeometry, barkMaterial, conifers, { cast: true });

    const broadleaf = buildBroadleaf();
    addInstanced(broadleaf.foliage, foliageMaterial(), broadleaves, {
        cast: true,
        colorFn: (color, placement) => color.copy(broadleafColors[Math.floor(placement.hue * broadleafColors.length)])
            .offsetHSL((placement.hue - 0.5) * 0.03, 0, (placement.hue - 0.5) * 0.06),
    });
    addInstanced(broadleaf.trunk, barkMaterial, broadleaves, { cast: true });

    // ---- Arbustos: copas pequeñas a ras de suelo ----
    const bushes = [];
    attempts = 0;
    while (bushes.length < preset.bushes && attempts < preset.bushes * 8) {
        attempts += 1;
        const point = roadsidePoint(ROAD_CORRIDOR + 1, 30, { maxSlope: 0.22, power: 1.4 });
        if (!point) continue;
        const scale = 0.28 + random() * 0.42;
        bushes.push({ ...point, scale, sy: scale * 0.8, yaw: random() * 6.28, sink: -0.1, hue: random() });
    }
    const bushGeometry = buildBroadleaf().foliage;
    addInstanced(bushGeometry, foliageMaterial(), bushes, {
        cast: true,
        colorFn: (color, placement) => color.copy(broadleafColors[Math.floor(placement.hue * broadleafColors.length)])
            .offsetHSL(0, -0.03, -0.03),
    });

    // ---- Bosque lejano: siluetas baratas que llenan el valle y las laderas ----
    const farTrees = [];
    attempts = 0;
    while (farTrees.length < preset.farTrees && attempts < preset.farTrees * 10) {
        attempts += 1;
        const angle = random() * Math.PI * 2;
        const radius = 45 + Math.sqrt(random()) * 300;
        const x = Math.cos(angle) * radius;
        const z = Math.sin(angle) * radius * 1.2;
        const y = terrain.heightAt(x, z);
        if (y < WATER_LEVEL + 1 || y > 52 || terrain.slopeAt(x, z) > 0.2) continue;
        if (terrain.distanceToRoute(x, z) < 26) continue;
        const grove = smoothstep(0.42, 0.62, fbm(x * 0.012 + 2, z * 0.012 + 8, 3));
        if (random() > grove) continue;
        const scale = 1.5 + random() * 1.9;
        farTrees.push({ x, y, z, scale, sy: scale * (1 + random() * 0.4), yaw: random() * 6.28, sink: -0.2, hue: random() });
    }
    addInstanced(buildFarTree(), foliageMaterial(), farTrees, {
        cast: false,
        receive: false,
        colorFn: (color, placement) => color.copy(coniferColors[Math.floor(placement.hue * coniferColors.length)])
            .offsetHSL(0, -0.05, -0.02),
    });

    // ---- Rocas ----
    const rocks = [];
    attempts = 0;
    while (rocks.length < preset.rocks && attempts < preset.rocks * 8) {
        attempts += 1;
        const point = roadsidePoint(ROAD_CORRIDOR + 1.2, 55, { maxSlope: 0.3, power: 1.3 });
        if (!point) continue;
        const scale = 0.35 + Math.pow(random(), 2.2) * 2.4;
        rocks.push({
            ...point,
            scale,
            sy: scale * (0.7 + random() * 0.5),
            yaw: random() * 6.28,
            tiltX: (random() - 0.5) * 0.4,
            tiltZ: (random() - 0.5) * 0.4,
            sink: -scale * 0.25,
            hue: random(),
        });
    }
    addInstanced(buildRock(), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.96 }), rocks, {
        cast: true,
        colorFn: (color, placement) => color.setHSL(0.09 + placement.hue * 0.06, 0.06, 0.42 + placement.hue * 0.2),
    });

    // ---- Hierba en chunks a lo largo de la ruta (culling por tramo) ----
    const grassGeometry = buildGrassTuft(preset.blades);
    const grassMaterial = new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide });
    applyWind(grassMaterial, wind, 0.09, 1.25);
    const grassBase = new THREE.Color(worldStyle.ground).offsetHSL(0.01, 0.12, 0.02);
    const perChunk = Math.ceil(preset.grass / GRASS_CHUNKS);
    for (let chunk = 0; chunk < GRASS_CHUNKS; chunk += 1) {
        const placements = [];
        let tries = 0;
        while (placements.length < perChunk && tries < perChunk * 4) {
            tries += 1;
            const t = (chunk + random()) / GRASS_CHUNKS;
            const point = roadsidePoint(ROAD_CORRIDOR, 34, { maxSlope: 0.25, power: 1.7, t });
            if (!point) continue;
            const meadow = fbm(point.x * 0.03, point.z * 0.03, 3);
            if (random() > 0.35 + smoothstep(0.3, 0.55, meadow) * 0.65) continue;
            const scale = 0.7 + random() * 0.9;
            placements.push({
                ...point,
                scale,
                sy: scale * (0.8 + meadow * 0.7),
                yaw: random() * 6.28,
                hue: random(),
                dry: smoothstep(0.62, 0.85, fbm(point.x * 0.038 - 3, point.z * 0.038 + 8, 3)),
            });
        }
        addInstanced(grassGeometry, grassMaterial, placements, {
            receive: false,
            colorFn: (color, placement) => color.copy(grassBase)
                .lerp(new THREE.Color(0xb8a85a), placement.dry * 0.7)
                .offsetHSL((placement.hue - 0.5) * 0.04, 0, (placement.hue - 0.5) * 0.12),
        });
    }

    // ---- Flores silvestres ----
    const flowerColors = [0xf6f1e0, 0xf7d64a, 0xe58ab8, 0xa98be0, 0xf08a4b].map((c) => new THREE.Color(c));
    const flowers = [];
    attempts = 0;
    while (flowers.length < preset.flowers && attempts < preset.flowers * 5) {
        attempts += 1;
        const point = roadsidePoint(ROAD_CORRIDOR + 1.5, 26, { maxSlope: 0.16, power: 1.6 });
        if (!point) continue;
        // Las flores crecen en manchas, no uniformes.
        if (fbm(point.x * 0.05 + 30, point.z * 0.05, 3) < 0.55) continue;
        const scale = 0.7 + random() * 0.7;
        flowers.push({ ...point, scale, yaw: random() * 6.28, hue: random() });
    }
    const flowerMaterial = new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide, emissive: 0x1a1a10 });
    applyWind(flowerMaterial, wind, 0.06, 1.4);
    addInstanced(buildFlower(), flowerMaterial, flowers, {
        receive: false,
        colorFn: (color, placement) => color.copy(flowerColors[Math.floor(placement.hue * flowerColors.length)]),
    });

    return {
        group,
        update(elapsed) {
            wind.value = elapsed;
        },
        dispose() {
            group.removeFromParent();
            new Set(disposables).forEach((resource) => resource.dispose());
            barkMaterial.dispose();
            group.children.forEach((child) => child.dispose?.());
        },
    };
}
