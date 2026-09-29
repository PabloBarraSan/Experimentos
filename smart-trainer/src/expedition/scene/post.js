import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';

const GradeShader = {
    uniforms: {
        tDiffuse: { value: null },
        time: { value: 0 },
        resolution: { value: new THREE.Vector2(1, 1) },
        vignette: { value: 0.42 },
        grain: { value: 0.014 },
        aberration: { value: 0.0035 },
        speedBlur: { value: 0 },
        warmth: { value: 1 },
    },
    vertexShader: /* glsl */`
        varying vec2 vUv;
        void main() {
            vUv = uv;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
    `,
    fragmentShader: /* glsl */`
        uniform sampler2D tDiffuse;
        uniform float time;
        uniform vec2 resolution;
        uniform float vignette;
        uniform float grain;
        uniform float aberration;
        uniform float speedBlur;
        uniform float warmth;
        varying vec2 vUv;

        float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }

        void main() {
            vec2 centered = vUv - 0.5;
            float radius = dot(centered, centered);

            // Aberración cromática sutil hacia los bordes de la lente.
            vec2 shift = centered * radius * aberration;
            vec3 color;
            color.r = texture2D(tDiffuse, vUv + shift).r;
            color.g = texture2D(tDiffuse, vUv).g;
            color.b = texture2D(tDiffuse, vUv - shift).b;

            // Desenfoque radial: sensación de velocidad en la periferia.
            if (speedBlur > 0.001) {
                vec3 accum = color;
                for (int i = 1; i <= 4; i++) {
                    float k = float(i) / 4.0;
                    accum += texture2D(tDiffuse, vUv - centered * speedBlur * k * radius * 3.0).rgb;
                }
                color = accum / 5.0;
            }

            // Gradación: luces cálidas, sombras frías, saturación algo mayor.
            float luma = dot(color, vec3(0.2126, 0.7152, 0.0722));
            color *= mix(vec3(1.0), vec3(1.06, 1.0, 0.93), smoothstep(0.25, 1.6, luma) * warmth);
            color *= mix(vec3(0.93, 1.0, 1.07), vec3(1.0), smoothstep(0.0, 0.32, luma));
            color = mix(vec3(luma), color, 1.1);

            color *= 1.0 - vignette * smoothstep(0.12, 0.62, radius * 2.0);
            color += (hash(vUv * resolution + fract(time)) - 0.5) * grain;
            gl_FragColor = vec4(max(color, 0.0), 1.0);
        }
    `,
};

// Cadena HDR: escena → bloom → gradación → tone mapping/sRGB.
export function createPostProcessing({ renderer, scene, camera, quality, width, height }) {
    const pixelRatio = renderer.getPixelRatio();
    const target = new THREE.WebGLRenderTarget(width * pixelRatio, height * pixelRatio, {
        type: THREE.HalfFloatType,
        samples: quality === 'high' ? 4 : 2,
    });
    const composer = new EffectComposer(renderer, target);
    composer.setPixelRatio(pixelRatio);
    composer.setSize(width, height);

    const bloom = new UnrealBloomPass(
        new THREE.Vector2(width, height),
        quality === 'high' ? 0.42 : 0.34,
        0.7,
        0.92,
    );
    const grade = new ShaderPass(GradeShader);
    grade.uniforms.resolution.value.set(width * pixelRatio, height * pixelRatio);

    composer.addPass(new RenderPass(scene, camera));
    composer.addPass(bloom);
    composer.addPass(grade);
    composer.addPass(new OutputPass());

    return {
        composer,
        bloom,
        grade,
        setSize(nextWidth, nextHeight) {
            composer.setPixelRatio(renderer.getPixelRatio());
            composer.setSize(nextWidth, nextHeight);
            bloom.setSize(nextWidth, nextHeight);
            grade.uniforms.resolution.value.set(
                nextWidth * renderer.getPixelRatio(),
                nextHeight * renderer.getPixelRatio(),
            );
        },
        render(delta, time) {
            grade.uniforms.time.value = time;
            composer.render(delta);
        },
        dispose() {
            composer.dispose();
            target.dispose();
            bloom.dispose();
        },
    };
}
