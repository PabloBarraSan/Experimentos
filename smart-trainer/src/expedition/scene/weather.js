import * as THREE from 'three';

// Precipitación en GPU: las partículas viven en una caja que rodea la cámara y se
// reciclan con `mod`, así que son estables en el mundo (paralaje correcto) y no
// cuestan nada en CPU. `intensity` (0..1) controla cuántas gotas se ven.
export function createPrecipitation({ kind, count }) {
    const isRain = kind === 'rain';
    const box = isRain ? new THREE.Vector3(46, 26, 46) : new THREE.Vector3(38, 20, 38);
    const seeds = new Float32Array(count * (isRain ? 2 : 1) * 4);
    const tips = new Float32Array(count * (isRain ? 2 : 1));
    for (let index = 0; index < count; index += 1) {
        const seed = [Math.random(), Math.random(), Math.random(), Math.random()];
        if (isRain) {
            seeds.set(seed, index * 8);
            seeds.set(seed, index * 8 + 4);
            tips[index * 2] = 0;
            tips[index * 2 + 1] = 1;
        } else {
            seeds.set(seed, index * 4);
        }
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(tips.length * 3), 3));
    geometry.setAttribute('seed', new THREE.BufferAttribute(seeds, 4));
    geometry.setAttribute('tip', new THREE.BufferAttribute(tips, 1));

    const material = new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        uniforms: {
            time: { value: 0 },
            intensity: { value: 0 },
            center: { value: new THREE.Vector3() },
            box: { value: box },
            speed: { value: isRain ? 17 : 1.7 },
            slant: { value: new THREE.Vector2(isRain ? 0.16 : 0.5, 0.05) },
            pixelScale: { value: 500 },
            tint: { value: new THREE.Color(isRain ? 0xc9d8e4 : 0xffffff) },
        },
        vertexShader: /* glsl */`
            attribute vec4 seed;
            attribute float tip;
            uniform float time;
            uniform float intensity;
            uniform vec3 center;
            uniform vec3 box;
            uniform float speed;
            uniform vec2 slant;
            uniform float pixelScale;
            varying float vAlpha;
            void main() {
                vec3 p;
                p.xz = mod(seed.xz * box.xz - center.xz + slant * time * 3.0, box.xz) + center.xz - box.xz * 0.5;
                p.y = mod(seed.y * box.y - time * speed * (0.85 + seed.w * 0.3) - center.y, box.y) + center.y - box.y * 0.35;
                ${kind === 'snow' ? 'p.x += sin(time * 0.9 + seed.z * 20.0) * 0.6; p.z += cos(time * 0.7 + seed.x * 20.0) * 0.6;' : ''}
                ${isRain ? 'p += tip * normalize(vec3(slant.x, 1.0, slant.y)) * 1.2;' : ''}
                vec4 mv = viewMatrix * vec4(p, 1.0);
                float dist = length(mv.xyz);
                float edge = 1.0 - smoothstep(0.55, 1.0, dist / (box.x * 0.5));
                float visible = step(seed.w, intensity) * smoothstep(1.5, 5.0, dist);
                vAlpha = edge * visible * ${isRain ? '0.55' : '0.9'};
                gl_Position = projectionMatrix * mv;
                ${isRain ? '' : `gl_PointSize = min((0.05 + seed.z * 0.05) * pixelScale / max(0.5, -mv.z), 9.0);`}
            }
        `,
        fragmentShader: /* glsl */`
            uniform vec3 tint;
            varying float vAlpha;
            void main() {
                ${isRain ? '' : `
                float d = length(gl_PointCoord - 0.5);
                if (d > 0.5) discard;
                float soft = 1.0 - smoothstep(0.1, 0.5, d);
                gl_FragColor = vec4(tint, vAlpha * soft);
                return;`}
                gl_FragColor = vec4(tint, vAlpha);
            }
        `,
    });
    const object = isRain ? new THREE.LineSegments(geometry, material) : new THREE.Points(geometry, material);
    object.frustumCulled = false;
    object.renderOrder = 5;
    object.visible = false;

    return {
        object,
        update({ elapsed, camera, intensity, pixelScale }) {
            object.visible = intensity > 0.01;
            if (!object.visible) return;
            material.uniforms.time.value = elapsed;
            material.uniforms.intensity.value = intensity;
            material.uniforms.center.value.copy(camera.position);
            material.uniforms.pixelScale.value = pixelScale;
        },
        dispose() {
            geometry.dispose();
            material.dispose();
            object.removeFromParent();
        },
    };
}
