import * as THREE from 'three';
import { hash2, valueNoise } from './noise.js';

export const ASPHALT_WIDTH = 5.9;

// Cinta que sigue la curva con perfil transversal arbitrario: [[offset, dy], ...].
// `tileMeters` fija cuántos metros de ruta abarca una repetición de la textura
// para que los texels sean cuadrados y no salgan vetas alargadas.
// Opcionales: `tRange` limita la cinta a un tramo [t0, t1] de la curva (la
// textura sigue siendo continua entre tramos) y `segmentLength` fija la
// separación entre filas en metros.
export function createProfileRibbon(curve, { profile, material, tileMeters, lift = 0, uSpan = null, tRange = [0, 1], segmentLength = 1.4 }) {
    const length = curve.getLength();
    const [t0, t1] = tRange;
    const segments = Math.max(1, Math.ceil(((t1 - t0) * length) / segmentLength));
    const columns = profile.length;
    const positions = new Float32Array((segments + 1) * columns * 3);
    const uvs = new Float32Array((segments + 1) * columns * 2);
    const indices = [];
    const minOffset = profile[0][0];
    const maxOffset = profile[columns - 1][0];
    const span = uSpan ?? (maxOffset - minOffset);
    for (let row = 0; row <= segments; row += 1) {
        const t = t0 + ((t1 - t0) * row) / segments;
        const point = curve.getPointAt(t);
        const tangent = curve.getTangentAt(t);
        const sideX = -tangent.z;
        const sideZ = tangent.x;
        const norm = Math.hypot(sideX, sideZ) || 1;
        for (let column = 0; column < columns; column += 1) {
            const [offset, dy] = profile[column];
            const index = row * columns + column;
            positions.set([
                point.x + (sideX / norm) * offset,
                point.y + dy + lift,
                point.z + (sideZ / norm) * offset,
            ], index * 3);
            uvs.set([(offset - minOffset) / span, (t * length) / tileMeters], index * 2);
        }
        if (row < segments) {
            for (let column = 0; column < columns - 1; column += 1) {
                const a = row * columns + column;
                const b = a + columns;
                indices.push(a, a + 1, b, b, a + 1, b + 1);
            }
        }
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();
    const mesh = new THREE.Mesh(geometry, material);
    mesh.receiveShadow = true;
    return mesh;
}

// Textura de asfalto con grano, rodadas, grietas, parches y pintura desgastada
// (línea central discontinua y bordes) integrada para evitar z-fighting.
export function createAsphaltTextures() {
    const size = 512;
    const color = document.createElement('canvas');
    color.width = size;
    color.height = size;
    const bump = document.createElement('canvas');
    bump.width = size;
    bump.height = size;
    const context = color.getContext('2d');
    const bumpContext = bump.getContext('2d');
    const image = context.createImageData(size, size);
    const bumpImage = bumpContext.createImageData(size, size);

    for (let py = 0; py < size; py += 1) {
        for (let px = 0; px < size; px += 1) {
            const u = px / size;
            const grain = hash2(px * 1.7, py * 1.3);
            const fine = hash2(px * 0.5 + 91, py * 0.5 - 13);
            const blotch = valueNoise(px * 0.03, py * 0.03);
            // Rodadas de neumáticos: dos bandas más oscuras y pulidas.
            const track = Math.exp(-Math.pow((u - 0.3) / 0.075, 2)) + Math.exp(-Math.pow((u - 0.7) / 0.075, 2));
            let value = 0.245 + grain * 0.07 + fine * 0.045 + blotch * 0.05 - track * 0.03;
            // Piedra clara ocasional en la superficie.
            if (grain > 0.965) value += 0.12;
            const offset = (py * size + px) * 4;
            image.data[offset] = value * 255 * 1.0;
            image.data[offset + 1] = value * 255 * 1.01;
            image.data[offset + 2] = value * 255 * 1.03;
            image.data[offset + 3] = 255;
            const height = (0.35 + grain * 0.4 + fine * 0.25) * (1 - track * 0.25);
            bumpImage.data[offset] = bumpImage.data[offset + 1] = bumpImage.data[offset + 2] = height * 255;
            bumpImage.data[offset + 3] = 255;
        }
    }
    context.putImageData(image, 0, 0);
    bumpContext.putImageData(bumpImage, 0, 0);

    // Grietas y juntas de reparación.
    context.lineCap = 'round';
    for (let crack = 0; crack < 5; crack += 1) {
        let x = hash2(crack, 3.3) * size;
        let y = hash2(crack, 7.7) * size;
        context.strokeStyle = 'rgba(8, 9, 10, 0.55)';
        context.lineWidth = 1.2;
        context.beginPath();
        context.moveTo(x, y);
        for (let step = 0; step < 9; step += 1) {
            x += (hash2(crack * 9 + step, 1.1) - 0.5) * 34;
            y += 12 + hash2(crack * 9 + step, 2.2) * 24;
            context.lineTo(x, y);
        }
        context.stroke();
    }

    // Pintura: bordes continuos y eje discontinuo (3 m de trazo por cada 5,9 m).
    const paint = (x, y, w, h, alpha) => {
        for (let py = Math.floor(y); py < y + h; py += 1) {
            for (let px = Math.floor(x); px < x + w; px += 1) {
                const wear = 0.55 + hash2(px * 0.9, py * 0.9) * 0.45;
                context.fillStyle = `rgba(236, 232, 214, ${(alpha * wear).toFixed(3)})`;
                context.fillRect(px, py, 1, 1);
            }
        }
    };
    const edgeWidth = size * 0.022;
    paint(size * 0.055, 0, edgeWidth, size, 0.86);
    paint(size * 0.945 - edgeWidth, 0, edgeWidth, size, 0.86);
    paint(size * 0.5 - size * 0.012, size * 0.04, size * 0.024, size * 0.5, 0.86);

    const make = (canvas, srgb) => {
        const texture = new THREE.CanvasTexture(canvas);
        texture.wrapS = THREE.ClampToEdgeWrapping;
        texture.wrapT = THREE.RepeatWrapping;
        texture.anisotropy = 16;
        if (srgb) texture.colorSpace = THREE.SRGBColorSpace;
        return texture;
    };
    return { map: make(color, true), bumpMap: make(bump, false) };
}

// Grava y tierra del arcén, teselable en ambos ejes.
export function createGravelTexture() {
    const size = 256;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const context = canvas.getContext('2d');
    context.fillStyle = '#7c735f';
    context.fillRect(0, 0, size, size);
    for (let index = 0; index < 3800; index += 1) {
        const x = hash2(index, 1.9) * size;
        const y = hash2(index, 4.1) * size;
        const radius = 0.8 + hash2(index, 8.3) * 2.2;
        const tone = hash2(index, 6.1);
        context.fillStyle = tone > 0.5
            ? `rgba(191, 181, 159, ${0.2 + tone * 0.22})`
            : `rgba(55, 51, 43, ${0.2 + (1 - tone) * 0.3})`;
        context.beginPath();
        context.arc(x, y, radius, 0, Math.PI * 2);
        context.fill();
    }
    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 8;
    return texture;
}
