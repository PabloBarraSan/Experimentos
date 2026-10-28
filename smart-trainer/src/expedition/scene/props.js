import * as THREE from 'three';
import { hash2 } from './noise.js';

function bannerTexture(title, subtitle, accent) {
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 256;
    const context = canvas.getContext('2d');
    const gradient = context.createLinearGradient(0, 0, 1024, 0);
    gradient.addColorStop(0, '#0d1f22');
    gradient.addColorStop(0.5, '#173238');
    gradient.addColorStop(1, '#0d1f22');
    context.fillStyle = gradient;
    context.fillRect(0, 0, 1024, 256);
    context.fillStyle = accent;
    context.fillRect(0, 0, 1024, 12);
    context.fillRect(0, 244, 1024, 12);
    context.fillStyle = '#f4efe0';
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.font = '800 96px "Inter", "Helvetica Neue", Arial, sans-serif';
    context.fillText(title.toUpperCase(), 512, 108);
    context.fillStyle = accent;
    context.font = '600 36px "Inter", Arial, sans-serif';
    context.fillText(subtitle.toUpperCase().split('').join(' '), 512, 194);
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 8;
    return texture;
}

function placeOnRoute(object, curve, t, lateral = 0) {
    const point = curve.getPointAt(t);
    const tangent = curve.getTangentAt(t);
    const yaw = Math.atan2(tangent.x, tangent.z);
    object.position.set(point.x - tangent.z * lateral, point.y, point.z + tangent.x * lateral);
    object.rotation.set(0, yaw, 0);
}

// Pórtico de salida: estructura de acero con pancarta y tira LED emisiva.
export function createStartGate({ curve, t, title, accentHex }) {
    const gate = new THREE.Group();
    const steel = new THREE.MeshStandardMaterial({ color: 0x9aa4a6, roughness: 0.4, metalness: 0.85 });
    const dark = new THREE.MeshStandardMaterial({ color: 0x1b2427, roughness: 0.6, metalness: 0.4 });
    const led = new THREE.MeshBasicMaterial({ color: new THREE.Color(accentHex).multiplyScalar(2.2), toneMapped: true });
    for (const side of [-1, 1]) {
        const post = new THREE.Mesh(new THREE.BoxGeometry(0.28, 6.4, 0.28), steel);
        post.position.set(side * 4.7, 3.2, 0);
        const foot = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.3, 0.7), dark);
        foot.position.set(side * 4.7, 0.15, 0);
        const brace = new THREE.Mesh(new THREE.BoxGeometry(0.1, 1.9, 0.1), steel);
        brace.position.set(side * 4.35, 5.5, 0);
        brace.rotation.z = side * -0.62;
        gate.add(post, foot, brace);
    }
    const beam = new THREE.Mesh(new THREE.BoxGeometry(9.7, 0.42, 0.42), steel);
    beam.position.y = 6.3;
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(9.2, 0.07, 0.07), led);
    stripe.position.set(0, 6.05, 0.22);
    const stripeBack = stripe.clone();
    stripeBack.position.z = -0.22;
    const bannerMap = bannerTexture(title, 'Salida', `#${new THREE.Color(accentHex).getHexString()}`);
    const bannerMaterial = new THREE.MeshStandardMaterial({
        map: bannerMap,
        emissive: 0xffffff,
        emissiveMap: bannerMap,
        emissiveIntensity: 0.35,
        roughness: 0.75,
        side: THREE.FrontSide,
    });
    const bannerFront = new THREE.Mesh(new THREE.PlaneGeometry(8.6, 2.15), bannerMaterial);
    bannerFront.position.set(0, 5.0, 0.24);
    const bannerBack = new THREE.Mesh(new THREE.PlaneGeometry(8.6, 2.15), bannerMaterial);
    bannerBack.position.set(0, 5.0, -0.24);
    bannerBack.rotation.y = Math.PI;
    gate.add(beam, stripe, stripeBack, bannerFront, bannerBack);
    gate.traverse((child) => {
        if (child.isMesh) child.castShadow = true;
    });
    gate.scale.setScalar(0.82);
    placeOnRoute(gate, curve, t);
    return { object: gate, dispose: () => disposeTree(gate) };
}

// Baliza de cima: haz de luz volumétrico, cristal flotante y anillo de suelo.
export function createSummitBeacon({ curve, terrain, t, lateral, accentHex }) {
    const group = new THREE.Group();
    const point = curve.getPointAt(t);
    const tangent = curve.getTangentAt(t);
    const x = point.x - tangent.z * lateral;
    const z = point.z + tangent.x * lateral;
    const y = terrain.heightAt(x, z);
    group.position.set(x, y, z);
    const accent = new THREE.Color(accentHex);

    const pillar = new THREE.Mesh(
        new THREE.CylinderGeometry(0.9, 1.9, 90, 28, 1, true),
        new THREE.ShaderMaterial({
            transparent: true,
            depthWrite: false,
            blending: THREE.AdditiveBlending,
            side: THREE.DoubleSide,
            fog: false,
            uniforms: { tint: { value: accent }, time: { value: 0 } },
            vertexShader: `varying vec2 vUv; varying vec3 vPos; varying vec3 vNormalView; varying vec3 vViewPosition; void main(){ vUv = uv; vPos = position; vNormalView = normalize(normalMatrix * normal); vec4 mv = modelViewMatrix * vec4(position, 1.0); vViewPosition = -mv.xyz; gl_Position = projectionMatrix * mv; }`,
            fragmentShader: `
                uniform vec3 tint; uniform float time; varying vec2 vUv; varying vec3 vPos; varying vec3 vNormalView; varying vec3 vViewPosition;
                void main() {
                    float fade = pow(1.0 - vUv.y, 1.6) * smoothstep(0.0, 0.06, vUv.y);
                    float bands = 0.75 + 0.25 * sin(vPos.y * 0.35 - time * 1.8 + vUv.x * 12.0);
                    float facing = abs(dot(normalize(vNormalView), normalize(vViewPosition)));
                    gl_FragColor = vec4(tint * 1.6 * bands, fade * 0.5 * pow(facing, 1.8));
                }
            `,
        }),
    );
    pillar.position.y = 45;

    const crystal = new THREE.Mesh(
        new THREE.OctahedronGeometry(1.35, 0),
        new THREE.MeshStandardMaterial({ color: accent, emissive: accent, emissiveIntensity: 1.9, roughness: 0.15, metalness: 0.3 }),
    );
    crystal.scale.y = 1.6;
    crystal.position.y = 4.4;

    const ring = new THREE.Mesh(
        new THREE.RingGeometry(1.7, 2.6, 48),
        new THREE.MeshBasicMaterial({ color: accent.clone().multiplyScalar(1.8), transparent: true, opacity: 0.7, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending }),
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.15;

    const plinth = new THREE.Mesh(
        new THREE.CylinderGeometry(1.5, 2.1, 0.8, 10),
        new THREE.MeshStandardMaterial({ color: 0x59605d, roughness: 0.95 }),
    );
    plinth.position.y = 0.2;
    plinth.castShadow = true;
    crystal.castShadow = true;
    group.add(pillar, crystal, ring, plinth);

    return {
        object: group,
        update(elapsed, delta) {
            crystal.rotation.y += delta * 0.9;
            crystal.position.y = 4.4 + Math.sin(elapsed * 1.5) * 0.28;
            pillar.material.uniforms.time.value = elapsed;
            ring.scale.setScalar(1 + Math.sin(elapsed * 2.1) * 0.06);
        },
        setAccent(color) {
            pillar.material.uniforms.tint.value.copy(color);
            crystal.material.color.copy(color);
            crystal.material.emissive.copy(color);
        },
        dispose: () => disposeTree(group),
    };
}

// Valla de madera de dos travesaños en un tramo de la ruta.
export function createFence({ curve, terrain, tStart, tEnd, lateral, quality }) {
    const length = curve.getLength() * (tEnd - tStart);
    const spacing = 2.8;
    const count = Math.max(2, Math.floor(length / spacing));
    const wood = new THREE.MeshStandardMaterial({ color: 0x8a6c4a, roughness: 0.95, map: woodTexture() });
    const posts = new THREE.InstancedMesh(new THREE.BoxGeometry(0.16, 1.25, 0.16), wood, count + 1);
    const rails = new THREE.InstancedMesh(new THREE.BoxGeometry(0.07, 0.11, spacing + 0.08), wood, (count) * 2);
    const dummy = new THREE.Object3D();
    const points = [];
    for (let index = 0; index <= count; index += 1) {
        const t = tStart + (tEnd - tStart) * (index / count);
        const point = curve.getPointAt(t);
        const tangent = curve.getTangentAt(t);
        const x = point.x - tangent.z * lateral;
        const z = point.z + tangent.x * lateral;
        points.push(new THREE.Vector3(x, terrain.heightAt(x, z), z));
        dummy.position.set(x, points[index].y + 0.55, z);
        dummy.rotation.set(0, Math.atan2(tangent.x, tangent.z) + (hash2(index, 2) - 0.5) * 0.06, (hash2(index, 5) - 0.5) * 0.05);
        dummy.scale.set(1, 0.92 + hash2(index, 9) * 0.16, 1);
        dummy.updateMatrix();
        posts.setMatrixAt(index, dummy.matrix);
    }
    for (let index = 0; index < count; index += 1) {
        const a = points[index];
        const b = points[index + 1];
        for (let rail = 0; rail < 2; rail += 1) {
            const height = 0.42 + rail * 0.43;
            dummy.position.set((a.x + b.x) / 2, (a.y + b.y) / 2 + height, (a.z + b.z) / 2);
            dummy.lookAt(b.x, b.y + height, b.z);
            dummy.scale.set(1, 1, a.distanceTo(b) / spacing);
            dummy.updateMatrix();
            rails.setMatrixAt(index * 2 + rail, dummy.matrix);
        }
    }
    const shadows = quality !== 'low';
    for (const mesh of [posts, rails]) {
        mesh.castShadow = shadows;
        mesh.receiveShadow = shadows;
        mesh.instanceMatrix.needsUpdate = true;
    }
    const group = new THREE.Group();
    group.add(posts, rails);
    return { object: group, dispose: () => { posts.geometry.dispose(); rails.geometry.dispose(); wood.map.dispose(); wood.dispose(); } };
}

function woodTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 128;
    const context = canvas.getContext('2d');
    context.fillStyle = '#c9b18e';
    context.fillRect(0, 0, 128, 128);
    for (let row = 0; row < 128; row += 1) {
        const tone = hash2(row, 3.7);
        context.fillStyle = `rgba(${tone > 0.5 ? '255,240,210' : '60,40,25'}, ${0.08 + tone * 0.16})`;
        context.fillRect(0, row, 128, 1);
    }
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    return texture;
}

// Cabaña de montaña con tejado a dos aguas, chimenea y ventana encendida.
export function createCabin({ curve, terrain, t, lateral }) {
    const group = new THREE.Group();
    const point = curve.getPointAt(t);
    const tangent = curve.getTangentAt(t);
    const side = Math.sign(lateral);
    const x = point.x - tangent.z * lateral;
    const z = point.z + tangent.x * lateral;
    const y = terrain.heightAt(x, z);
    group.position.set(x, y, z);
    // La fachada mira hacia la carretera.
    group.rotation.y = Math.atan2(tangent.x, tangent.z) + (side > 0 ? -Math.PI / 2 : Math.PI / 2);

    const wood = new THREE.MeshStandardMaterial({ color: 0x9a7650, roughness: 0.95, map: woodTexture() });
    const roofMaterial = new THREE.MeshStandardMaterial({ color: 0x4a3a35, roughness: 0.9 });
    const stone = new THREE.MeshStandardMaterial({ color: 0x77766e, roughness: 1 });
    const glow = new THREE.MeshStandardMaterial({ color: 0x2b2113, emissive: 0xffb45c, emissiveIntensity: 1.7, roughness: 0.4 });

    const base = new THREE.Mesh(new THREE.BoxGeometry(5.6, 3, 4.6), stone);
    base.position.y = -0.4;
    const body = new THREE.Mesh(new THREE.BoxGeometry(5.2, 2.7, 4.2), wood);
    body.position.y = 1.35;
    body.material.map.repeat.set(2, 2);

    const roofShape = new THREE.Shape();
    roofShape.moveTo(-2.9, 0);
    roofShape.lineTo(0, 1.9);
    roofShape.lineTo(2.9, 0);
    roofShape.lineTo(-2.9, 0);
    const gable = new THREE.Mesh(new THREE.ExtrudeGeometry(roofShape, { depth: 4.9, bevelEnabled: false }), roofMaterial);
    gable.position.set(0, 2.7, -2.45);
    const chimney = new THREE.Mesh(new THREE.BoxGeometry(0.55, 1.6, 0.55), stone);
    chimney.position.set(1.6, 3.6, -0.8);
    const door = new THREE.Mesh(new THREE.BoxGeometry(0.95, 1.85, 0.08), new THREE.MeshStandardMaterial({ color: 0x4d3423, roughness: 0.9 }));
    door.position.set(-1.1, 0.95, 2.13);
    const window1 = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.8, 0.08), glow);
    window1.position.set(1.1, 1.5, 2.13);
    const window2 = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.8, 1.0), glow);
    window2.position.set(2.63, 1.5, 0.3);
    group.add(base, body, gable, chimney, door, window1, window2);
    group.traverse((child) => {
        if (child.isMesh) {
            child.castShadow = true;
            child.receiveShadow = true;
        }
    });
    return { object: group, dispose: () => disposeTree(group) };
}

// Hitos con reflectante alternos a cada lado; `tRange` limita los hitos a un tramo [t0, t1] de la curva.
export function createRoadPosts({ curve, tRange = [0, 1] }) {
    const [t0, t1] = tRange;
    const length = curve.getLength() * (t1 - t0);
    const count = Math.max(1, Math.floor(length / 16));
    const material = new THREE.MeshStandardMaterial({ color: 0xece7d6, roughness: 0.6 });
    const reflectorMaterial = new THREE.MeshBasicMaterial({ color: 0xff7a3d });
    const posts = new THREE.InstancedMesh(new THREE.BoxGeometry(0.13, 1, 0.13), material, count);
    const reflectors = new THREE.InstancedMesh(new THREE.BoxGeometry(0.135, 0.14, 0.135), reflectorMaterial, count);
    const dummy = new THREE.Object3D();
    for (let index = 0; index < count; index += 1) {
        const t = t0 + ((t1 - t0) * index) / count;
        const point = curve.getPointAt(t);
        const tangent = curve.getTangentAt(t);
        const side = index % 2 === 0 ? 1 : -1;
        const x = point.x - tangent.z * side * 3.5;
        const z = point.z + tangent.x * side * 3.5;
        const yGround = point.y - 0.12;
        dummy.position.set(x, yGround + 0.5, z);
        dummy.rotation.set(0, Math.atan2(tangent.x, tangent.z), 0);
        dummy.updateMatrix();
        posts.setMatrixAt(index, dummy.matrix);
        dummy.position.y = yGround + 0.85;
        dummy.updateMatrix();
        reflectors.setMatrixAt(index, dummy.matrix);
    }
    posts.castShadow = true;
    const group = new THREE.Group();
    group.add(posts, reflectors);
    return { object: group, dispose: () => { posts.geometry.dispose(); reflectors.geometry.dispose(); material.dispose(); reflectorMaterial.dispose(); } };
}

function disposeTree(root) {
    root.traverse((child) => {
        if (!child.isMesh) return;
        child.geometry.dispose();
        const materials = Array.isArray(child.material) ? child.material : [child.material];
        materials.forEach((material) => {
            material.map?.dispose?.();
            material.emissiveMap?.dispose?.();
            material.dispose();
        });
    });
}
