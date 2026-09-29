import * as THREE from 'three';
import { fbm, ridged, smoothstep, hash2 } from './noise.js';

export const WATER_LEVEL = -5.4;
// Ancho del corredor totalmente plano bajo la carretera y su talud.
export const ROAD_CORRIDOR = 9;
const ROAD_SINK = 0.85;

const ROUTE_SAMPLES = 320;

// Terreno fractal: valle plano junto a la ruta, colinas suaves, lagos y una
// cordillera perimetral que cierra el horizonte. Devuelve la malla, una
// consulta rápida de altura (rejilla bilineal) y un mapa de alturas para el agua.
export function createTerrain({ routeCurve, worldStyle, quality }) {
    const segments = quality === 'low' ? 200 : quality === 'medium' ? 300 : 380;
    const size = 1300;
    const half = size / 2;
    const cell = size / segments;
    const routeSamples = Array.from({ length: ROUTE_SAMPLES + 1 }, (_, index) => (
        routeCurve.getPointAt(index / ROUTE_SAMPLES)
    ));

    // Distancia a la polilínea de la ruta y altura interpolada en el punto más cercano.
    function nearestRoute(x, z) {
        let best = Infinity;
        let bestIndex = 0;
        for (let index = 0; index < ROUTE_SAMPLES; index += 1) {
            const point = routeSamples[index];
            const dx = point.x - x;
            const dz = point.z - z;
            const distanceSq = dx * dx + dz * dz;
            if (distanceSq < best) {
                best = distanceSq;
                bestIndex = index;
            }
        }
        let distance = Math.sqrt(best);
        let height = routeSamples[bestIndex].y;
        if (distance < 60) {
            distance = Infinity;
            for (const offset of [-1, 0]) {
                const a = routeSamples[(bestIndex + offset + ROUTE_SAMPLES) % ROUTE_SAMPLES];
                const b = routeSamples[(bestIndex + offset + 1 + ROUTE_SAMPLES) % ROUTE_SAMPLES];
                const abx = b.x - a.x;
                const abz = b.z - a.z;
                const lengthSq = abx * abx + abz * abz || 1;
                const t = THREE.MathUtils.clamp(((x - a.x) * abx + (z - a.z) * abz) / lengthSq, 0, 1);
                const px = a.x + abx * t;
                const pz = a.z + abz * t;
                const d = Math.hypot(px - x, pz - z);
                if (d < distance) {
                    distance = d;
                    height = a.y + (b.y - a.y) * t;
                }
            }
        }
        return { distance, height };
    }

    function baseHeight(x, z) {
        const hills = fbm(x * 0.0055 + 3.1, z * 0.0055 - 1.7, 5);
        const rolling = fbm(x * 0.021 - 8, z * 0.021 + 4, 3) - 0.5;
        let height = 6 + (hills - 0.5) * 32 + rolling * 3.2;
        const lakes = smoothstep(0.56, 0.72, fbm(x * 0.0029 + 40, z * 0.0029 + 9, 3));
        height -= lakes * 28;
        const ellipse = Math.hypot(x, z * 0.82);
        const mountainMask = smoothstep(205, 345, ellipse);
        if (mountainMask > 0) {
            const crest = ridged(x * 0.0064 + 7, z * 0.0064 - 3, 5);
            const massif = fbm(x * 0.003 + 21, z * 0.003, 3);
            height += Math.pow(mountainMask, 1.25) * (24 + crest * 150 * (0.55 + massif * 0.8));
        }
        return height;
    }

    const stride = segments + 1;
    const grid = new Float32Array(stride * stride);
    const routeDistances = new Float32Array(stride * stride);
    for (let row = 0; row <= segments; row += 1) {
        const z = -half + row * cell;
        for (let column = 0; column <= segments; column += 1) {
            const x = -half + column * cell;
            const { distance, height: routeHeight } = nearestRoute(x, z);
            const roadFloor = routeHeight - ROAD_SINK;
            grid[row * stride + column] = THREE.MathUtils.lerp(
                roadFloor,
                baseHeight(x, z),
                smoothstep(ROAD_CORRIDOR, 40, distance),
            );
            routeDistances[row * stride + column] = distance;
        }
    }

    function heightAt(x, z) {
        const fx = THREE.MathUtils.clamp((x + half) / cell, 0, segments - 0.001);
        const fz = THREE.MathUtils.clamp((z + half) / cell, 0, segments - 0.001);
        const column = Math.floor(fx);
        const row = Math.floor(fz);
        const tx = fx - column;
        const tz = fz - row;
        const i = row * stride + column;
        const top = grid[i] + (grid[i + 1] - grid[i]) * tx;
        const bottom = grid[i + stride] + (grid[i + stride + 1] - grid[i + stride]) * tx;
        return top + (bottom - top) * tz;
    }

    // Pendiente 0 (llano) → 1 (vertical) a partir de diferencias finitas.
    function slopeAt(x, z) {
        const dx = heightAt(x + 1.5, z) - heightAt(x - 1.5, z);
        const dz = heightAt(x, z + 1.5) - heightAt(x, z - 1.5);
        return 1 - 1 / Math.sqrt(1 + (dx * dx + dz * dz) / 9);
    }

    function distanceToRoute(x, z) {
        return nearestRoute(x, z).distance;
    }

    const mesh = buildMesh();
    const heightTexture = buildHeightTexture();

    function buildMesh() {
        const vertexCount = stride * stride;
        const positions = new Float32Array(vertexCount * 3);
        const uvs = new Float32Array(vertexCount * 2);
        const colors = new Float32Array(vertexCount * 3);
        const indices = new Uint32Array(segments * segments * 6);
        for (let row = 0; row <= segments; row += 1) {
            for (let column = 0; column <= segments; column += 1) {
                const index = row * stride + column;
                const x = -half + column * cell;
                const z = -half + row * cell;
                positions.set([x, grid[index], z], index * 3);
                uvs.set([x * 0.13, z * 0.13], index * 2);
            }
        }
        let cursor = 0;
        for (let row = 0; row < segments; row += 1) {
            for (let column = 0; column < segments; column += 1) {
                const a = row * stride + column;
                const b = a + stride;
                indices.set([a, b, a + 1, b, b + 1, a + 1], cursor);
                cursor += 6;
            }
        }
        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        geometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
        geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
        geometry.setIndex(new THREE.BufferAttribute(indices, 1));
        geometry.computeVertexNormals();

        const normals = geometry.getAttribute('normal');
        const palette = createPalette(worldStyle);
        const scratch = new THREE.Color();
        for (let index = 0; index < vertexCount; index += 1) {
            const x = positions[index * 3];
            const y = positions[index * 3 + 1];
            const z = positions[index * 3 + 2];
            const slope = 1 - normals.getY(index);
            terrainColor(scratch, palette, x, y, z, slope, routeDistances[index]);
            colors.set([scratch.r, scratch.g, scratch.b], index * 3);
        }

        const material = new THREE.MeshStandardMaterial({
            vertexColors: true,
            roughness: 1,
            metalness: 0,
            map: createGroundTexture(),
        });
        material.onBeforeCompile = (shader) => {
            // Una segunda muestra de la textura a otra escala rompe la repetición visible.
            shader.fragmentShader = shader.fragmentShader.replace(
                '#include <map_fragment>',
                `#include <map_fragment>
                vec3 farDetail = texture2D(map, vMapUv * 0.071 + vec2(0.37, 0.11)).rgb;
                diffuseColor.rgb *= mix(vec3(1.0), farDetail / 0.72, 0.55);`,
            );
        };
        const terrain = new THREE.Mesh(geometry, material);
        terrain.receiveShadow = true;
        terrain.frustumCulled = false;
        return terrain;
    }

    function buildHeightTexture() {
        const data = new Uint16Array(stride * stride);
        for (let index = 0; index < grid.length; index += 1) {
            data[index] = THREE.DataUtils.toHalfFloat(grid[index]);
        }
        const texture = new THREE.DataTexture(data, stride, stride, THREE.RedFormat, THREE.HalfFloatType);
        texture.minFilter = THREE.LinearFilter;
        texture.magFilter = THREE.LinearFilter;
        texture.wrapS = THREE.ClampToEdgeWrapping;
        texture.wrapT = THREE.ClampToEdgeWrapping;
        texture.needsUpdate = true;
        return texture;
    }

    return {
        mesh,
        size,
        heightAt,
        slopeAt,
        distanceToRoute,
        heightTexture,
        dispose() {
            mesh.geometry.dispose();
            mesh.material.map?.dispose();
            mesh.material.dispose();
            heightTexture.dispose();
        },
    };
}

function createPalette(worldStyle) {
    const meadow = new THREE.Color(worldStyle.ground);
    return {
        forestFloor: new THREE.Color(0x385436),
        meadow,
        lush: meadow.clone().offsetHSL(0.012, 0.02, 0.055),
        dry: new THREE.Color(0x9c9762),
        alpine: new THREE.Color(0x84907a),
        rock: new THREE.Color(0x7b7a72),
        rockDark: new THREE.Color(0x4c4f4c),
        snow: new THREE.Color(0xeef3f5),
        sand: new THREE.Color(0xb9ab86),
        mud: new THREE.Color(0x5d5241),
        gravel: new THREE.Color(worldStyle.shoulder).offsetHSL(0, -0.18, 0.02),
    };
}

function terrainColor(target, palette, x, y, z, slope, routeDistance) {
    const patches = fbm(x * 0.021, z * 0.021, 3);
    target.copy(palette.forestFloor).lerp(palette.meadow, smoothstep(0.28, 0.58, patches));
    target.lerp(palette.lush, smoothstep(0.55, 0.82, fbm(x * 0.009 + 9, z * 0.009 - 4, 3)) * 0.8);
    target.lerp(palette.dry, smoothstep(0.6, 0.85, fbm(x * 0.038 - 3, z * 0.038 + 8, 3)) * 0.55);
    target.lerp(palette.alpine, smoothstep(22, 58, y) * 0.65);

    const rockNoise = fbm(x * 0.06, z * 0.06, 3);
    const rockAmount = smoothstep(0.13, 0.3, slope + (rockNoise - 0.5) * 0.08);
    const rockColor = palette.rockDark.clone().lerp(palette.rock, smoothstep(0.3, 0.7, rockNoise));
    target.lerp(rockColor, rockAmount);

    const snowLine = 72 + (fbm(x * 0.03, z * 0.03, 3) - 0.5) * 26;
    const snowAmount = smoothstep(snowLine, snowLine + 24, y) * (1 - smoothstep(0.24, 0.42, slope));
    target.lerp(palette.snow, snowAmount);

    const shore = 1 - smoothstep(WATER_LEVEL + 0.2, WATER_LEVEL + 1.7, y);
    target.lerp(palette.sand, shore * 0.85);
    target.lerp(palette.mud, (1 - smoothstep(WATER_LEVEL - 4, WATER_LEVEL, y)) * 0.8);

    const roadFringe = 1 - smoothstep(ROAD_CORRIDOR - 1, ROAD_CORRIDOR + 3.5, routeDistance);
    target.lerp(palette.gravel, roadFringe * 0.75);
    target.offsetHSL(0, 0, (hash2(x * 0.7, z * 0.7) - 0.5) * 0.035);
}

// Textura de detalle en tonos medios: modula el color de vértice sin cambiar su tono.
function createGroundTexture() {
    const size = 256;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const context = canvas.getContext('2d');
    context.fillStyle = '#b8b8b0';
    context.fillRect(0, 0, size, size);
    const image = context.getImageData(0, 0, size, size);
    for (let py = 0; py < size; py += 1) {
        for (let px = 0; px < size; px += 1) {
            // Ruido periódico para que la textura sea teselable sin costuras.
            const u = px / size;
            const v = py / size;
            const fine = periodicNoise(u * 48, v * 48, 48);
            const medium = periodicNoise(u * 16, v * 16, 16);
            const coarse = periodicNoise(u * 5, v * 5, 5);
            const blade = periodicNoise(u * 90, v * 12, 90, 12);
            const value = 0.66 + fine * 0.22 + medium * 0.22 + coarse * 0.12 + (blade - 0.5) * 0.12;
            const shade = Math.round(THREE.MathUtils.clamp(value, 0, 1) * 255);
            const offset = (py * size + px) * 4;
            image.data[offset] = shade;
            image.data[offset + 1] = shade;
            image.data[offset + 2] = Math.round(shade * 0.96);
            image.data[offset + 3] = 255;
        }
    }
    context.putImageData(image, 0, 0);
    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 8;
    return texture;
}

function periodicNoise(x, y, periodX, periodY = periodX) {
    const xi = Math.floor(x);
    const yi = Math.floor(y);
    const xf = x - xi;
    const yf = y - yi;
    const sx = xf * xf * (3 - 2 * xf);
    const sy = yf * yf * (3 - 2 * yf);
    const at = (ix, iy) => hash2(((ix % periodX) + periodX) % periodX, ((iy % periodY) + periodY) % periodY);
    const a = at(xi, yi);
    const b = at(xi + 1, yi);
    const c = at(xi, yi + 1);
    const d = at(xi + 1, yi + 1);
    return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
}
