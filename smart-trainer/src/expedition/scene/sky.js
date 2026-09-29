import * as THREE from 'three';

// Dirección del sol compartida por cielo, agua y luz direccional. Sol bajo
// (~30°) para una luz dorada con sombras largas.
export const SUN_DIRECTION = new THREE.Vector3(-0.5, 0.5, 0.72).normalize();

const NOISE_GLSL = /* glsl */`
    float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123); }
    float noise(vec2 p) {
        vec2 i = floor(p);
        vec2 f = fract(p);
        f = f * f * (3.0 - 2.0 * f);
        return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x),
                   mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
    }
    float fbm(vec2 p) {
        float amplitude = 0.5;
        float sum = 0.0;
        for (int i = 0; i < 5; i++) {
            sum += amplitude * noise(p);
            p = p * 2.03 + vec2(11.0, 7.0);
            amplitude *= 0.5;
        }
        return sum;
    }
`;

export function createSky({ zenith, horizon }) {
    const material = new THREE.ShaderMaterial({
        side: THREE.BackSide,
        depthWrite: false,
        fog: false,
        uniforms: {
            zenithColor: { value: zenith },
            horizonColor: { value: horizon },
            sunDirection: { value: SUN_DIRECTION.clone() },
            time: { value: 0 },
            cloudCover: { value: 0.5 },
        },
        vertexShader: /* glsl */`
            varying vec3 vWorldPosition;
            void main() {
                vec4 worldPosition = modelMatrix * vec4(position, 1.0);
                vWorldPosition = worldPosition.xyz;
                gl_Position = projectionMatrix * viewMatrix * worldPosition;
            }
        `,
        fragmentShader: /* glsl */`
            uniform vec3 zenithColor;
            uniform vec3 horizonColor;
            uniform vec3 sunDirection;
            uniform float time;
            uniform float cloudCover;
            varying vec3 vWorldPosition;
            ${NOISE_GLSL}
            void main() {
                vec3 dir = normalize(vWorldPosition - cameraPosition);
                float h = dir.y;
                float sunDot = max(dot(dir, sunDirection), 0.0);

                // Degradado atmosférico: horizonte brumoso, cénit más profundo.
                float gradient = smoothstep(0.0, 0.72, pow(clamp(h, 0.0, 1.0), 0.6));
                vec3 sky = mix(horizonColor, zenithColor * 0.86, gradient);

                // Dispersión de Mie: resplandor cálido alrededor del sol.
                vec3 warm = vec3(1.0, 0.66, 0.38);
                float lowSun = 1.0 - smoothstep(0.0, 0.55, h);
                sky += warm * pow(sunDot, 5.0) * 0.20 * (0.4 + lowSun);
                sky += warm * pow(sunDot, 28.0) * 0.42;
                sky += vec3(1.0, 0.88, 0.7) * pow(sunDot, 200.0) * 1.2;
                // Disco solar en HDR: alimenta el bloom.
                sky += vec3(1.0, 0.9, 0.72) * smoothstep(0.99935, 0.99975, sunDot) * 16.0;

                if (h > 0.0) {
                    vec2 uv = dir.xz / (h + 0.14) * 0.5 + vec2(time * 0.0045, time * 0.0016);
                    float density = fbm(uv * 1.35);
                    float cover = smoothstep(cloudCover, cloudCover + 0.3, density);
                    // Iluminación: comparar densidad hacia el sol da bordes plateados.
                    vec2 towardSun = normalize(sunDirection.xz + 1e-4) * 0.045;
                    float shaded = fbm((uv + towardSun) * 1.35);
                    float light = clamp((density - shaded) * 5.0 + 0.55, 0.0, 1.0);
                    vec3 shadow = mix(horizonColor, zenithColor, 0.35) * 0.78 + vec3(0.04, 0.05, 0.07);
                    vec3 lit = mix(vec3(1.0, 0.95, 0.9), warm * 1.25, pow(sunDot, 3.0) * 0.6);
                    vec3 cloud = mix(shadow, lit, light);
                    float fadeAtHorizon = smoothstep(0.02, 0.2, h);
                    sky = mix(sky, cloud, cover * fadeAtHorizon * 0.94);
                } else {
                    sky = horizonColor;
                }

                gl_FragColor = vec4(sky, 1.0);
                #include <tonemapping_fragment>
                #include <colorspace_fragment>
            }
        `,
    });
    const dome = new THREE.Mesh(new THREE.SphereGeometry(760, 48, 28), material);
    dome.frustumCulled = false;
    dome.renderOrder = -10;
    return dome;
}

export { NOISE_GLSL };
