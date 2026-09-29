import * as THREE from 'three';
import { NOISE_GLSL, SUN_DIRECTION } from './sky.js';
import { WATER_LEVEL } from './terrain.js';

// Agua con reflejo del cielo (Fresnel), destello solar, oleaje animado y
// espuma en la orilla calculada con el mapa de alturas del terreno.
export function createWater({ terrain, zenith, horizon }) {
    const material = new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        fog: true,
        uniforms: THREE.UniformsUtils.merge([
            THREE.UniformsLib.fog,
            {
                time: { value: 0 },
                sunDirection: { value: SUN_DIRECTION.clone() },
                zenithColor: { value: zenith },
                horizonColor: { value: horizon },
                shallowColor: { value: new THREE.Color(0x3f8f8a) },
                deepColor: { value: new THREE.Color(0x0c3a4a) },
                heightMap: { value: terrain.heightTexture },
                terrainSize: { value: terrain.size },
                waterLevel: { value: WATER_LEVEL },
            },
        ]),
        vertexShader: /* glsl */`
            varying vec3 vWorld;
            #include <fog_pars_vertex>
            void main() {
                vec4 worldPosition = modelMatrix * vec4(position, 1.0);
                vWorld = worldPosition.xyz;
                vec4 mvPosition = viewMatrix * worldPosition;
                gl_Position = projectionMatrix * mvPosition;
                #include <fog_vertex>
            }
        `,
        fragmentShader: /* glsl */`
            uniform float time;
            uniform vec3 sunDirection;
            uniform vec3 zenithColor;
            uniform vec3 horizonColor;
            uniform vec3 shallowColor;
            uniform vec3 deepColor;
            uniform sampler2D heightMap;
            uniform float terrainSize;
            uniform float waterLevel;
            varying vec3 vWorld;
            #include <fog_pars_fragment>
            ${NOISE_GLSL}

            float waves(vec2 p) {
                return noise(p * 0.32 + vec2(time * 0.05, time * 0.03)) * 0.55
                     + noise(p * 0.95 - vec2(time * 0.08, -time * 0.06)) * 0.28
                     + noise(p * 2.4 + vec2(time * 0.13, -time * 0.1)) * 0.14;
            }

            void main() {
                vec3 toCamera = cameraPosition - vWorld;
                float dist = length(toCamera);
                vec3 V = toCamera / dist;

                float e = 0.06;
                float h0 = waves(vWorld.xz);
                vec3 N = normalize(vec3((h0 - waves(vWorld.xz + vec2(e, 0.0))) / e * 0.5, 1.0,
                                        (h0 - waves(vWorld.xz + vec2(0.0, e))) / e * 0.5));
                N = normalize(mix(N, vec3(0.0, 1.0, 0.0), smoothstep(60.0, 420.0, dist)));

                float fresnel = 0.03 + 0.97 * pow(1.0 - max(dot(N, V), 0.0), 4.5);
                vec3 R = reflect(-V, N);
                float ry = max(R.y, 0.0);
                vec3 skyReflection = mix(horizonColor, zenithColor * 0.9, pow(ry, 0.45));
                float sunAlign = max(dot(R, sunDirection), 0.0);
                skyReflection += vec3(1.0, 0.72, 0.45) * pow(sunAlign, 10.0) * 0.28;

                vec2 heightUv = vWorld.xz / terrainSize + 0.5;
                float ground = texture2D(heightMap, heightUv).r;
                float depth = waterLevel - ground;
                float inside = step(0.0, heightUv.x) * step(heightUv.x, 1.0) * step(0.0, heightUv.y) * step(heightUv.y, 1.0);
                depth = mix(8.0, depth, inside);

                vec3 body = mix(shallowColor, deepColor, smoothstep(0.2, 4.5, depth));
                vec3 color = mix(body, skyReflection, clamp(fresnel * 0.9 + 0.10, 0.0, 1.0));
                color += vec3(1.0, 0.86, 0.62) * pow(sunAlign, 260.0) * 7.0;

                float foamNoise = noise(vWorld.xz * 1.7 + time * 0.25);
                float foamRipple = 0.5 + 0.5 * sin(time * 1.4 + depth * 9.0 + foamNoise * 6.0);
                float foam = (1.0 - smoothstep(0.0, 0.55, depth)) * smoothstep(0.32, 0.78, foamNoise * 0.7 + foamRipple * 0.45);
                color = mix(color, vec3(0.93, 0.97, 0.97), foam * 0.75);

                float alpha = clamp(smoothstep(0.0, 0.35, depth) * 0.93 + foam * 0.5, 0.0, 0.97);
                gl_FragColor = vec4(color, alpha);
                #include <tonemapping_fragment>
                #include <colorspace_fragment>
                #include <fog_fragment>
            }
        `,
    });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1500, 1500, 1, 1), material);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.y = WATER_LEVEL;
    mesh.renderOrder = 2;
    mesh.frustumCulled = false;
    return mesh;
}
