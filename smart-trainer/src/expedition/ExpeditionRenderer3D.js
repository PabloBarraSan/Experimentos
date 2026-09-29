import * as THREE from 'three';
import { seeded } from './scene/noise.js';
import { createTerrain } from './scene/terrain.js';
import { createSky, SUN_DIRECTION } from './scene/sky.js';
import { createWater } from './scene/water.js';
import { createVegetation } from './scene/vegetation.js';
import { createProfileRibbon, createAsphaltTextures, createGravelTexture, ASPHALT_WIDTH } from './scene/road.js';
import { createStartGate, createSummitBeacon, createFence, createCabin, createRoadPosts } from './scene/props.js';
import { createPostProcessing } from './scene/post.js';

const CAMERA_PRESETS = {
    close: { distance: 5.9, height: 2.6, lookHeight: 1.15, lookAhead: 5.2, fov: 46 },
    standard: { distance: 8.0, height: 3.1, lookHeight: 1.05, lookAhead: 7.2, fov: 47 },
    wide: { distance: 13.2, height: 5.1, lookHeight: 0.9, lookAhead: 12, fov: 51 },
};

const QUALITY_PRESETS = {
    low: { pixelRatio: 1, shadows: false, shadowMap: 0, shadowExtent: 0, post: false, particles: 40 },
    medium: { pixelRatio: 1.35, shadows: true, shadowMap: 2048, shadowExtent: 46, post: true, particles: 80 },
    high: { pixelRatio: 2, shadows: true, shadowMap: 4096, shadowExtent: 42, post: true, particles: 140 },
};

const WORLD_STYLES = {
    aurora: { ground: 0x6f8a4c, shoulder: 0xa89a7a, sky: 0x5a94cc, fog: 0xb4cbd8, tree: 0x2d5a3a, fogDensity: 0.0025, clouds: 0.5 },
    mist: { ground: 0x5f7a55, shoulder: 0x8d8871, sky: 0x7d9aa6, fog: 0xb9c8c6, tree: 0x24493e, fogDensity: 0.0068, clouds: 0.36 },
    north: { ground: 0x718067, shoulder: 0x9d9788, sky: 0x5f88b8, fog: 0xc0cfd8, tree: 0x34524f, fogDensity: 0.0027, clouds: 0.46 },
};

// Cada bloque de entrenamiento tiñe la atmósfera (hora del día / ánimo).
const BLOCK_PALETTES = {
    warmup: { accent: 0xffbf69, fog: 0xe3cdaa, sky: 0x6296cd, sun: 0xffd9a6 },
    cooldown: { accent: 0x89d8ff, fog: 0xcaa9bb, sky: 0x40609c, sun: 0xffb38a },
    rest: { accent: 0x72e6c1, fog: 0xc6e2d8, sky: 0x5aa6c6, sun: 0xffe6c2 },
    interval: { accent: 0xff6b45, fog: 0xe6a681, sky: 0x6a6299, sun: 0xffa866 },
    ramp: { accent: 0xff9c4a, fog: 0xdcb28f, sky: 0x5673a2, sun: 0xffc484 },
    steady: { accent: 0x63e0b5, fog: 0xb6cddb, sky: 0x4f8fd0, sun: 0xffddb0 },
};

const Y_AXIS = new THREE.Vector3(0, 1, 0);
const FORWARD_AXIS = new THREE.Vector3(0, 0, 1);

export function createExpeditionRenderer3D(canvas, options = {}) {
    return new ExpeditionRenderer3D(canvas, options);
}

class ExpeditionRenderer3D {
    constructor(canvas, {
        cameraMode = 'standard',
        quality = 'medium',
        reducedMotion = false,
        mission = null,
    } = {}) {
        this.canvas = canvas;
        this.cameraMode = CAMERA_PRESETS[cameraMode] ? cameraMode : 'standard';
        this.quality = resolveQuality(quality);
        this.reducedMotion = reducedMotion;
        this.mission = mission || { world: 'aurora' };
        this.worldStyle = WORLD_STYLES[this.mission.world] || WORLD_STYLES.aurora;
        this.state = {
            flow: 0,
            power: 0,
            cadence: 0,
            speed: 0,
            targetPower: 0,
            blockType: 'steady',
            ghostProgress: 0.72,
            ghostRouteProgress: null,
            ghostVisible: false,
            progress: 0,
            paused: true,
        };
        this.visualDistance = 0;
        this.cameraLookTarget = new THREE.Vector3(0, 1, 0);
        this.cameraBank = 0;
        this.cameraFov = CAMERA_PRESETS[this.cameraMode].fov;
        this.lastTimestamp = performance.now();
        this.frameId = null;
        this.elapsed = 0;
        this.atmosphereTarget = {
            sky: new THREE.Color(),
            fog: new THREE.Color(),
            sun: new THREE.Color(),
            accent: new THREE.Color(),
        };

        this.setupRenderer();
        this.setupScene();
        this.buildWorld();
        this.player = createCyclist({ accent: 0x63e0b5, ghost: false });
        this.ghost = createCyclist({ accent: 0x8ed9ff, ghost: true });
        this.player.group.scale.setScalar(1.06);
        this.ghost.group.visible = false;
        this.scene.add(this.player.group, this.ghost.group);
        this.buildFlowParticles();
        this.setupPostProcessing();
        this.resize();

        this._boundResize = () => this.resize();
        window.addEventListener('resize', this._boundResize);
        this.frameId = requestAnimationFrame((timestamp) => this.draw(timestamp));
    }

    setupRenderer() {
        const quality = QUALITY_PRESETS[this.quality];
        this.renderer = new THREE.WebGLRenderer({
            canvas: this.canvas,
            antialias: this.quality !== 'low' && !quality.post,
            powerPreference: 'high-performance',
            alpha: false,
        });
        this.renderer.outputColorSpace = THREE.SRGBColorSpace;
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 1;
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, quality.pixelRatio));
        this.renderer.shadowMap.enabled = quality.shadows;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    }

    setupScene() {
        const style = this.worldStyle;
        this.scene = new THREE.Scene();
        // Colores compartidos entre cielo, niebla y agua: una sola transición los mueve a todos.
        this.zenithColor = new THREE.Color(style.sky);
        this.horizonColor = new THREE.Color(style.fog);
        this.scene.background = this.horizonColor;
        this.scene.fog = new THREE.FogExp2(0xffffff, style.fogDensity);
        this.scene.fog.color = this.horizonColor;

        this.skyDome = createSky({ zenith: this.zenithColor, horizon: this.horizonColor });
        this.skyDome.material.uniforms.cloudCover.value = style.clouds;
        this.scene.add(this.skyDome);

        this.camera = new THREE.PerspectiveCamera(48, 1, 0.1, 1200);
        this.camera.position.set(0, 5, -10);

        this.hemiLight = new THREE.HemisphereLight(0xbcd6ee, 0x3d4a33, 1.55);
        this.scene.add(this.hemiLight);

        this.sunLight = new THREE.DirectionalLight(0xffddb0, 2.9);
        this.sunLight.target = new THREE.Object3D();
        this.scene.add(this.sunLight, this.sunLight.target);
        this.configureShadows();

        const right = new THREE.Vector3().crossVectors(Y_AXIS, SUN_DIRECTION).normalize();
        this.lightBasis = { right, up: new THREE.Vector3().crossVectors(SUN_DIRECTION, right).normalize() };
    }

    configureShadows() {
        const preset = QUALITY_PRESETS[this.quality];
        this.sunLight.castShadow = preset.shadows;
        if (!preset.shadows) return;
        const { shadow } = this.sunLight;
        shadow.mapSize.set(preset.shadowMap, preset.shadowMap);
        const extent = preset.shadowExtent;
        Object.assign(shadow.camera, { left: -extent, right: extent, top: extent, bottom: -extent, near: 1, far: 420 });
        shadow.camera.updateProjectionMatrix();
        shadow.bias = -0.0004;
        shadow.normalBias = 0.05;
        shadow.map?.dispose();
        shadow.map = null;
    }

    setupPostProcessing() {
        this.post?.dispose();
        this.post = null;
        if (!QUALITY_PRESETS[this.quality].post) return;
        const width = Math.max(1, this.canvas.clientWidth);
        const height = Math.max(1, this.canvas.clientHeight);
        this.post = createPostProcessing({
            renderer: this.renderer,
            scene: this.scene,
            camera: this.camera,
            quality: this.quality,
            width,
            height,
        });
    }

    buildWorld() {
        const routePoints = [];
        const pointCount = 32;
        for (let index = 0; index < pointCount; index += 1) {
            const angle = (index / pointCount) * Math.PI * 2;
            const radiusX = 115 + Math.sin(angle * 3) * 20;
            const radiusZ = 155 + Math.cos(angle * 2) * 24;
            routePoints.push(new THREE.Vector3(
                Math.sin(angle) * radiusX,
                4.5 + Math.sin(angle * 2.5) * 5.5 + Math.cos(angle * 5) * 1.8,
                Math.cos(angle) * radiusZ,
            ));
        }
        this.routeCurve = new THREE.CatmullRomCurve3(routePoints, true, 'catmullrom', 0.42);
        this.routeLength = this.routeCurve.getLength();

        this.world = new THREE.Group();
        this.scene.add(this.world);
        this.worldDisposers = [];

        this.terrain = createTerrain({ routeCurve: this.routeCurve, worldStyle: this.worldStyle, quality: this.quality });
        this.world.add(this.terrain.mesh);
        this.worldDisposers.push(() => this.terrain.dispose());

        this.water = createWater({ terrain: this.terrain, zenith: this.zenithColor, horizon: this.horizonColor });
        this.world.add(this.water);
        this.worldDisposers.push(() => {
            this.water.geometry.dispose();
            this.water.material.dispose();
        });

        this.buildRoad();

        this.vegetation = createVegetation({
            terrain: this.terrain,
            routeCurve: this.routeCurve,
            worldStyle: this.worldStyle,
            quality: this.quality,
        });
        this.world.add(this.vegetation.group);
        this.worldDisposers.push(() => this.vegetation.dispose());

        const addProp = (prop) => {
            this.world.add(prop.object);
            this.worldDisposers.push(prop.dispose);
            return prop;
        };
        addProp(createRoadPosts({ curve: this.routeCurve }));
        addProp(createStartGate({
            curve: this.routeCurve,
            t: 0.022,
            title: this.mission.title || 'Expedición',
            accentHex: 0x63e0b5,
        }));
        this.beacon = addProp(createSummitBeacon({
            curve: this.routeCurve,
            terrain: this.terrain,
            t: 0.62,
            lateral: 9,
            accentHex: 0xffa64d,
        }));
        addProp(createFence({ curve: this.routeCurve, terrain: this.terrain, tStart: 0.07, tEnd: 0.16, lateral: -10.2, quality: this.quality }));
        addProp(createCabin({ curve: this.routeCurve, terrain: this.terrain, t: 0.235, lateral: 26 }));
    }

    buildRoad() {
        const asphalt = createAsphaltTextures();
        const gravel = createGravelTexture();
        const half = ASPHALT_WIDTH / 2;
        const roadMaterial = new THREE.MeshStandardMaterial({
            color: 0xffffff,
            map: asphalt.map,
            bumpMap: asphalt.bumpMap,
            bumpScale: 1.4,
            roughness: 0.9,
            metalness: 0,
        });
        // El talud baja del borde del asfalto hasta el suelo del corredor.
        const shoulderMaterial = new THREE.MeshStandardMaterial({
            color: 0xd4ccb7,
            map: gravel,
            roughness: 1,
        });
        gravel.repeat.set(1, 1);
        const shoulder = createProfileRibbon(this.routeCurve, {
            profile: [[-6, -0.835], [-4.6, -0.5], [-half - 0.15, -0.09], [half + 0.15, -0.09], [4.6, -0.5], [6, -0.835]],
            material: shoulderMaterial,
            tileMeters: 4,
            uSpan: 3.8,
        });
        const road = createProfileRibbon(this.routeCurve, {
            // Ligero bombeo central para que la luz revele el relieve.
            profile: [[-half, 0], [0, 0.03], [half, 0]],
            material: roadMaterial,
            tileMeters: ASPHALT_WIDTH,
            lift: 0.012,
        });
        this.world.add(shoulder, road);
        this.worldDisposers.push(() => {
            [shoulder, road].forEach((mesh) => mesh.geometry.dispose());
            asphalt.map.dispose();
            asphalt.bumpMap.dispose();
            gravel.dispose();
            roadMaterial.dispose();
            shoulderMaterial.dispose();
        });
    }

    disposeWorld() {
        this.worldDisposers?.forEach((dispose) => dispose());
        this.world?.removeFromParent();
    }

    buildFlowParticles() {
        const count = QUALITY_PRESETS[this.quality].particles;
        const positions = new Float32Array(count * 3);
        for (let index = 0; index < count; index += 1) {
            positions[index * 3] = (seeded(index + 800) - 0.5) * 12;
            positions[index * 3 + 1] = seeded(index + 900) * 6;
            positions[index * 3 + 2] = (seeded(index + 1000) - 0.5) * 24;
        }
        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        this.particleMaterial = new THREE.PointsMaterial({
            color: 0x63e0b5,
            size: 0.12,
            map: getSoftDotTexture(),
            transparent: true,
            opacity: 0,
            depthWrite: false,
            blending: THREE.AdditiveBlending,
        });
        this.flowParticles = new THREE.Points(geometry, this.particleMaterial);
        this.flowParticles.frustumCulled = false;
        this.scene.add(this.flowParticles);

        // Polvo en suspensión iluminado por el sol: da profundidad y sensación de aire.
        const motes = QUALITY_PRESETS[this.quality].particles * 3;
        const motePositions = new Float32Array(motes * 3);
        for (let index = 0; index < motes; index += 1) {
            motePositions[index * 3] = (seeded(index + 2100) - 0.5) * 60;
            motePositions[index * 3 + 1] = seeded(index + 2300) * 14;
            motePositions[index * 3 + 2] = (seeded(index + 2500) - 0.5) * 60;
        }
        const moteGeometry = new THREE.BufferGeometry();
        moteGeometry.setAttribute('position', new THREE.BufferAttribute(motePositions, 3));
        this.moteMaterial = new THREE.PointsMaterial({
            color: 0xfff1d6,
            size: 0.09,
            map: getSoftDotTexture(),
            transparent: true,
            opacity: this.reducedMotion ? 0 : 0.5,
            depthWrite: false,
            blending: THREE.AdditiveBlending,
        });
        this.dustMotes = new THREE.Points(moteGeometry, this.moteMaterial);
        this.dustMotes.frustumCulled = false;
        this.scene.add(this.dustMotes);
    }

    disposeParticles() {
        [this.flowParticles, this.dustMotes].forEach((points) => {
            this.scene.remove(points);
            points.geometry.dispose();
        });
        this.particleMaterial.dispose();
        this.moteMaterial.dispose();
    }

    update(next) {
        this.state = { ...this.state, ...next };
    }

    setCameraMode(mode) {
        if (!CAMERA_PRESETS[mode]) return;
        this.cameraMode = mode;
    }

    setReducedMotion(enabled) {
        this.reducedMotion = Boolean(enabled);
        if (this.particleMaterial) this.particleMaterial.opacity = this.reducedMotion ? 0 : 0.22;
        if (this.moteMaterial) this.moteMaterial.opacity = this.reducedMotion ? 0 : 0.5;
        if (this.post) this.post.grade.uniforms.speedBlur.value = this.reducedMotion ? 0 : 0.08;
    }

    setQuality(quality) {
        const resolved = resolveQuality(quality);
        if (this.quality === resolved) return;
        this.quality = resolved;
        const preset = QUALITY_PRESETS[resolved];
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, preset.pixelRatio));
        this.renderer.shadowMap.enabled = preset.shadows;
        this.renderer.shadowMap.needsUpdate = true;
        this.configureShadows();

        // El mundo depende de la calidad (resolución del terreno, densidad de vegetación).
        this.disposeWorld();
        this.buildWorld();
        this.disposeParticles();
        this.buildFlowParticles();
        this.setupPostProcessing();
        this.resize();
    }

    draw(timestamp) {
        const delta = Math.min(0.05, Math.max(0, (timestamp - this.lastTimestamp) / 1000));
        this.lastTimestamp = timestamp;
        this.elapsed += delta;
        const active = !this.state.paused;
        const visualSpeed = active
            ? Math.max(4.5, (Number(this.state.speed) || 0) / 3.6, (Number(this.state.power) || 0) / 28)
            : 0;
        this.visualDistance += delta * visualSpeed * (0.88 + this.state.flow * 0.28);

        const t = (this.visualDistance % this.routeLength) / this.routeLength;
        const position = this.routeCurve.getPointAt(t);
        const routeTangent = this.routeCurve.getTangentAt(t).normalize();
        const tangent = flattenTangent(routeTangent);
        const playerPosition = position.clone().add(new THREE.Vector3(0, 0.025, 0));
        orientAlongCurve(this.player.group, playerPosition, routeTangent);

        const cadence = active ? Math.max(0, Number(this.state.cadence) || 0) : 0;
        const crankSpeed = cadence > 0 ? cadence * Math.PI * 2 / 60 : visualSpeed * 0.9;
        this.player.crankAngle += delta * crankSpeed;
        animateCyclist(this.player, this.player.crankAngle, visualSpeed, this.state.flow, active);

        this.ghost.group.visible = Boolean(this.state.ghostVisible);
        const ghostLead = 12 + (1 - this.state.ghostProgress) * 26;
        const ghostT = Number.isFinite(this.state.ghostRouteProgress)
            ? ((this.state.ghostRouteProgress % 1) + 1) % 1
            : ((this.visualDistance + ghostLead) % this.routeLength) / this.routeLength;
        const ghostPosition = this.routeCurve.getPointAt(ghostT).add(new THREE.Vector3(0, 0.025, 0));
        const ghostTangent = this.routeCurve.getTangentAt(ghostT).normalize();
        orientAlongCurve(this.ghost.group, ghostPosition, ghostTangent);
        this.ghost.crankAngle += delta * Math.max(4.8, crankSpeed * 0.96);
        animateCyclist(this.ghost, this.ghost.crankAngle, visualSpeed, 0.5, active);

        this.updateCamera(delta, playerPosition, tangent, visualSpeed);
        this.updateLighting(playerPosition);

        this.flowParticles.position.copy(playerPosition);
        this.flowParticles.position.y += 0.8;
        this.flowParticles.rotation.y = -this.elapsed * (0.25 + this.state.flow * 0.9);
        this.particleMaterial.opacity = this.reducedMotion
            ? 0
            : Math.max(0, Math.min(0.3, (this.state.flow - 0.62) * 0.8));
        this.particleMaterial.size = 0.1 + this.state.flow * 0.16;

        // El polvo deriva con el viento y se mantiene alrededor de la cámara.
        this.dustMotes.position.set(playerPosition.x, playerPosition.y, playerPosition.z);
        this.dustMotes.rotation.y = this.elapsed * 0.012;

        this.beacon.update(this.elapsed, delta);
        this.vegetation.update(this.elapsed);
        this.water.material.uniforms.time.value = this.elapsed;
        this.skyDome.material.uniforms.time.value = this.elapsed;
        this.skyDome.position.copy(this.camera.position);
        this.updateAtmosphere(delta);

        if (this.post) {
            this.post.grade.uniforms.speedBlur.value = this.reducedMotion
                ? 0
                : Math.min(0.1, visualSpeed / 22 * 0.05 * (0.6 + this.state.flow * 0.6));
            this.post.render(delta, this.elapsed);
        } else {
            this.renderer.render(this.scene, this.camera);
        }
        this.frameId = requestAnimationFrame((nextTimestamp) => this.draw(nextTimestamp));
    }

    updateCamera(delta, playerPosition, tangent, visualSpeed) {
        const preset = CAMERA_PRESETS[this.cameraMode];
        const motionScale = this.reducedMotion ? 0 : 1;
        const breathing = Math.sin(this.elapsed * 1.8) * 0.025 * motionScale * (0.2 + this.state.flow);
        const cameraTarget = playerPosition.clone()
            .add(tangent.clone().multiplyScalar(-preset.distance))
            .add(new THREE.Vector3(0, preset.height + breathing, 0));
        const cameraDamping = 1 - Math.exp(-delta * (this.reducedMotion ? 10 : 6.8));
        this.camera.position.lerp(cameraTarget, cameraDamping);
        const aheadT = ((this.visualDistance + preset.lookAhead) % this.routeLength) / this.routeLength;
        const lookAt = this.routeCurve.getPointAt(aheadT)
            .add(new THREE.Vector3(0, preset.lookHeight, 0));
        this.cameraLookTarget.lerp(lookAt, 1 - Math.exp(-delta * 8.5));
        this.camera.lookAt(this.cameraLookTarget);

        // Inclinación lateral en las curvas (proporcional al giro del trazado).
        const farT = ((this.visualDistance + 22) % this.routeLength) / this.routeLength;
        const farTangent = flattenTangent(this.routeCurve.getTangentAt(farT));
        const turn = tangent.x * farTangent.z - tangent.z * farTangent.x;
        const bankTarget = THREE.MathUtils.clamp(turn * 0.55, -0.05, 0.05) * motionScale;
        this.cameraBank += (bankTarget - this.cameraBank) * (1 - Math.exp(-delta * 2.2));
        this.camera.rotateZ(this.cameraBank);

        // La velocidad abre ligeramente el campo de visión.
        const targetFov = preset.fov + Math.min(4.5, visualSpeed * 0.16) * motionScale;
        this.cameraFov += (targetFov - this.cameraFov) * (1 - Math.exp(-delta * 2.5));
        if (Math.abs(this.camera.fov - this.cameraFov) > 0.01) {
            this.camera.fov = this.cameraFov;
            this.camera.updateProjectionMatrix();
        }
    }

    // La luz sigue al ciclista y su frustum de sombras se ajusta al texel para no parpadear.
    updateLighting(focus) {
        const target = focus.clone();
        const preset = QUALITY_PRESETS[this.quality];
        if (preset.shadows) {
            const texel = (preset.shadowExtent * 2) / preset.shadowMap;
            const { right, up } = this.lightBasis;
            const r = target.dot(right);
            const u = target.dot(up);
            target.addScaledVector(right, Math.round(r / texel) * texel - r);
            target.addScaledVector(up, Math.round(u / texel) * texel - u);
        }
        this.sunLight.target.position.copy(target);
        this.sunLight.position.copy(target).addScaledVector(SUN_DIRECTION, 190);
        this.sunLight.target.updateMatrixWorld();
    }

    updateAtmosphere(delta) {
        const palette = BLOCK_PALETTES[this.state.blockType] || BLOCK_PALETTES.steady;
        const worldFog = new THREE.Color(this.worldStyle.fog);
        const worldSky = new THREE.Color(this.worldStyle.sky);
        const goal = this.atmosphereTarget;
        goal.accent.set(palette.accent);
        goal.fog.set(palette.fog).lerp(worldFog, 0.4);
        goal.sky.set(palette.sky).lerp(worldSky, 0.3);
        goal.sun.set(palette.sun);

        const blend = Math.min(1, delta * 0.55);
        this.horizonColor.lerp(goal.fog, blend);
        this.zenithColor.lerp(goal.sky, blend);
        this.sunLight.color.lerp(goal.sun, blend);
        this.hemiLight.color.copy(this.zenithColor).lerp(new THREE.Color(0xffffff), 0.45);
        this.hemiLight.groundColor.copy(new THREE.Color(this.worldStyle.ground)).multiplyScalar(0.62);

        const intensity = 0.22 + this.state.flow * 0.78;
        this.player.accentMaterials.forEach((material) => {
            material.color.lerp(goal.accent, Math.min(1, delta * 3));
            material.emissive.lerp(goal.accent, Math.min(1, delta * 2));
        });
        this.player.accentMaterial.emissiveIntensity = 0.35 + intensity * 0.35;
        this.particleMaterial.color.lerp(goal.accent, Math.min(1, delta * 4));
        this.sunLight.intensity = 2.5 + this.state.flow * 0.6;
        this.renderer.toneMappingExposure = 0.98 + this.state.flow * 0.12;
    }

    resize() {
        const width = Math.max(1, this.canvas.clientWidth);
        const height = Math.max(1, this.canvas.clientHeight);
        this.renderer.setSize(width, height, false);
        this.post?.setSize(width, height);
        this.camera.aspect = width / height;
        this.camera.updateProjectionMatrix();
    }

    destroy() {
        if (this.frameId) cancelAnimationFrame(this.frameId);
        window.removeEventListener('resize', this._boundResize);
        this.post?.dispose();
        this.disposeWorld();
        this.disposeParticles();
        this.scene.traverse((object) => {
            if (!object.isMesh) return;
            object.geometry?.dispose?.();
            const materials = Array.isArray(object.material) ? object.material : [object.material];
            materials.forEach((material) => {
                material?.map?.dispose?.();
                material?.dispose?.();
            });
        });
        this.renderer.dispose();
    }
}

let softDotTexture = null;
function getSoftDotTexture() {
    if (softDotTexture) return softDotTexture;
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const context = canvas.getContext('2d');
    const gradient = context.createRadialGradient(32, 32, 0, 32, 32, 32);
    gradient.addColorStop(0, 'rgba(255,255,255,1)');
    gradient.addColorStop(0.35, 'rgba(255,255,255,0.45)');
    gradient.addColorStop(1, 'rgba(255,255,255,0)');
    context.fillStyle = gradient;
    context.fillRect(0, 0, 64, 64);
    softDotTexture = new THREE.CanvasTexture(canvas);
    softDotTexture.colorSpace = THREE.SRGBColorSpace;
    return softDotTexture;
}

function createCyclist({ accent, ghost }) {
    const group = new THREE.Group();
    const frameMaterial = new THREE.MeshStandardMaterial({
        color: ghost ? 0x8ed9ff : 0x26383c,
        roughness: 0.36,
        metalness: 0.65,
        transparent: ghost,
        opacity: ghost ? 0.38 : 1,
        depthWrite: !ghost,
    });
    const accentMaterial = new THREE.MeshStandardMaterial({
        color: accent,
        emissive: accent,
        emissiveIntensity: ghost ? 0.9 : 0.75,
        roughness: 0.45,
        transparent: ghost,
        opacity: ghost ? 0.45 : 1,
        depthWrite: !ghost,
    });
    const unlitAccentMaterial = new THREE.MeshBasicMaterial({
        color: accent,
        transparent: ghost,
        opacity: ghost ? 0.5 : 1,
        depthWrite: !ghost,
    });
    const rubberMaterial = new THREE.MeshStandardMaterial({
        color: 0x0b0f12,
        roughness: 0.92,
        transparent: ghost,
        opacity: ghost ? 0.3 : 1,
        depthWrite: !ghost,
    });
    const skinMaterial = new THREE.MeshStandardMaterial({
        color: 0xd8a17e,
        roughness: 0.85,
        transparent: ghost,
        opacity: ghost ? 0.32 : 1,
        depthWrite: !ghost,
    });

    // Proporciones de una bici de carretera realista: rueda de 700c, batalla
    // compacta y ciclista apoyado sobre el manillar, no erguido sobre la bici.
    const rearHub = new THREE.Vector3(0, 0.57, -0.86);
    const frontHub = new THREE.Vector3(0, 0.57, 0.9);
    const crank = new THREE.Vector3(0, 0.67, -0.04);
    const seat = new THREE.Vector3(0, 1.25, -0.32);
    const handle = new THREE.Vector3(0, 1.15, 0.64);
    const wheelRadius = 0.55;
    const wheelGeometry = new THREE.TorusGeometry(wheelRadius, 0.032, 9, 36);

    const rearWheel = new THREE.Group();
    const rearTire = new THREE.Mesh(wheelGeometry, rubberMaterial);
    rearTire.rotation.y = Math.PI / 2;
    const rearRim = new THREE.Mesh(
        new THREE.TorusGeometry(wheelRadius - 0.055, 0.012, 7, 32),
        unlitAccentMaterial,
    );
    rearRim.rotation.y = Math.PI / 2;
    const hubMaterial = new THREE.MeshStandardMaterial({
        color: ghost ? 0x8ed9ff : 0xc5d0d0,
        roughness: 0.35,
        metalness: 0.72,
        transparent: ghost,
        opacity: ghost ? 0.34 : 1,
    });
    const rearAxle = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.18, 10), hubMaterial);
    rearAxle.rotation.z = Math.PI / 2;
    const spokeMaterial = new THREE.MeshBasicMaterial({ color: ghost ? 0x8ed9ff : 0x849092, transparent: true, opacity: ghost ? 0.22 : 0.5 });
    rearWheel.add(rearTire, rearRim, rearAxle);
    for (let index = 0; index < 10; index += 1) {
        const angle = index / 10 * Math.PI * 2;
        rearWheel.add(createTube(
            new THREE.Vector3(0, 0, 0),
            new THREE.Vector3(0, Math.cos(angle) * (wheelRadius - 0.06), Math.sin(angle) * (wheelRadius - 0.06)),
            0.006,
            spokeMaterial,
        ));
    }
    rearWheel.position.copy(rearHub);
    const frontWheel = rearWheel.clone();
    frontWheel.position.copy(frontHub);
    group.add(rearWheel, frontWheel);

    [
        [rearHub, crank],
        [rearHub, seat],
        [seat, crank],
        [crank, handle],
        [handle, frontHub],
        [crank, frontHub],
        [seat, handle],
    ].forEach(([start, end], index) => {
        group.add(createTube(
            start,
            end,
            index === 6 ? 0.026 : 0.042,
            index === 6 ? frameMaterial : accentMaterial,
        ));
    });
    for (const side of [-1, 1]) {
        group.add(
            createTube(new THREE.Vector3(side * 0.07, 1.13, 0.68), new THREE.Vector3(side * 0.095, 0.59, 0.9), 0.027, frameMaterial),
            createTube(new THREE.Vector3(side * 0.095, 0.59, 0.9), new THREE.Vector3(side * 0.12, 0.57, 0.83), 0.027, frameMaterial),
            createTube(new THREE.Vector3(side * 0.31, 1.15, 0.64), new THREE.Vector3(side * 0.4, 1.12, 0.7), 0.026, frameMaterial),
            createTube(new THREE.Vector3(side * 0.4, 1.12, 0.7), new THREE.Vector3(side * 0.39, 0.91, 0.77), 0.026, frameMaterial),
            createTube(new THREE.Vector3(side * 0.39, 0.91, 0.77), new THREE.Vector3(side * 0.26, 0.88, 0.75), 0.026, frameMaterial),
        );
        const brakeHood = new THREE.Mesh(new THREE.SphereGeometry(0.075, 10, 8), rubberMaterial);
        brakeHood.scale.set(0.78, 1.16, 1.26);
        brakeHood.position.set(side * 0.26, 1.19, 0.71);
        group.add(brakeHood);
    }

    const bottle = new THREE.Mesh(
        new THREE.CylinderGeometry(0.072, 0.095, 0.29, 10),
        new THREE.MeshStandardMaterial({ color: 0xe5e3d6, roughness: 0.38, transparent: ghost, opacity: ghost ? 0.4 : 1 }),
    );
    bottle.position.set(0, 0.97, 0.16);
    bottle.rotation.x = 0.54;
    const bottleCap = new THREE.Mesh(new THREE.CylinderGeometry(0.038, 0.038, 0.045, 8), accentMaterial);
    bottleCap.position.set(0, 1.12, 0.2);
    bottleCap.rotation.x = 0.54;
    group.add(bottle, bottleCap);

    const saddle = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.055, 0.4), frameMaterial);
    saddle.position.set(0, 1.29, -0.39);
    saddle.rotation.x = -0.06;
    const crankRing = new THREE.Mesh(new THREE.TorusGeometry(0.14, 0.018, 7, 22), hubMaterial);
    crankRing.rotation.y = Math.PI / 2;
    crankRing.position.copy(crank);
    const outerRing = new THREE.Mesh(new THREE.TorusGeometry(0.19, 0.009, 5, 28), frameMaterial);
    outerRing.rotation.y = Math.PI / 2;
    outerRing.position.copy(crank);
    const cassette = new THREE.Mesh(new THREE.TorusGeometry(0.105, 0.022, 6, 20), hubMaterial);
    cassette.rotation.y = Math.PI / 2;
    cassette.position.copy(rearHub).add(new THREE.Vector3(0.095, 0, 0));
    const chainMaterial = new THREE.MeshStandardMaterial({ color: 0x969d98, roughness: 0.62, metalness: 0.64, transparent: ghost, opacity: ghost ? 0.3 : 1 });
    group.add(
        saddle,
        crankRing,
        outerRing,
        cassette,
        createTube(new THREE.Vector3(0.105, 0.73, -0.78), new THREE.Vector3(0.105, 0.83, -0.02), 0.009, chainMaterial),
        createTube(new THREE.Vector3(0.105, 0.42, -0.91), new THREE.Vector3(0.105, 0.52, -0.1), 0.009, chainMaterial),
    );
    const leftCrank = createTube(crank, new THREE.Vector3(-0.15, 0.68, 0.12), 0.026, frameMaterial);
    const rightCrank = createTube(crank, new THREE.Vector3(0.15, 0.68, -0.2), 0.026, frameMaterial);
    group.add(leftCrank, rightCrank);

    // ---- Ciclista: torso modelado, extremidades cónicas y equipación ----
    const fabric = (color, extra = {}) => new THREE.MeshStandardMaterial({
        color,
        roughness: 0.82,
        transparent: ghost,
        opacity: ghost ? 0.34 : 1,
        depthWrite: !ghost,
        ...extra,
    });
    const jerseyMaterial = new THREE.MeshStandardMaterial({
        color: accent,
        emissive: accent,
        emissiveIntensity: ghost ? 0.5 : 0.1,
        roughness: 0.78,
        map: createJerseyTexture(),
        transparent: ghost,
        opacity: ghost ? 0.42 : 1,
        depthWrite: !ghost,
    });
    const shortsMaterial = fabric(0x14191c, { roughness: 0.7 });
    const sockMaterial = fabric(0xf2f0e8);
    const helmetMaterial = fabric(0xf4f1e8, { roughness: 0.32 });
    const gloveMaterial = fabric(0x1a1e21, { roughness: 0.9 });
    const shoeMaterial = fabric(0xecece6, { roughness: 0.5 });

    const spine = [
        { center: new THREE.Vector3(0, 1.36, -0.34), width: 0.36, depth: 0.27 },
        { center: new THREE.Vector3(0, 1.5, -0.24), width: 0.33, depth: 0.25 },
        { center: new THREE.Vector3(0, 1.69, -0.08), width: 0.4, depth: 0.27 },
        { center: new THREE.Vector3(0, 1.86, 0.06), width: 0.46, depth: 0.26 },
        { center: new THREE.Vector3(0, 1.95, 0.12), width: 0.3, depth: 0.2 },
    ];
    const torso = new THREE.Mesh(createLoft(spine, 20), jerseyMaterial);
    const hips = new THREE.Mesh(new THREE.SphereGeometry(0.22, 18, 12), shortsMaterial);
    hips.scale.set(1.12, 0.78, 1.05);
    hips.position.set(0, 1.37, -0.36);
    const neck = createTube(new THREE.Vector3(0, 1.95, 0.13), new THREE.Vector3(0, 2.07, 0.22), 0.055, skinMaterial);
    group.add(torso, hips, neck);

    const head = new THREE.Mesh(new THREE.SphereGeometry(0.115, 18, 14), skinMaterial);
    head.scale.set(0.95, 1.05, 1.1);
    head.position.set(0, 2.14, 0.3);
    // Casco aerodinámico con cola larga y ventilaciones.
    const helmet = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 16), helmetMaterial);
    helmet.scale.set(0.135, 0.115, 0.235);
    helmet.position.set(0, 2.2, 0.22);
    helmet.rotation.x = -0.16;
    for (const x of [-0.05, 0, 0.05]) {
        const vent = new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.012, 0.17), rubberMaterial);
        vent.position.set(x, 2.305, 0.2);
        vent.rotation.x = -0.16;
        group.add(vent);
    }
    const helmetBand = createTube(new THREE.Vector3(-0.118, 2.15, 0.29), new THREE.Vector3(0.118, 2.15, 0.29), 0.012, unlitAccentMaterial);
    const glasses = new THREE.Mesh(
        new THREE.SphereGeometry(0.115, 16, 8, 0, Math.PI * 2, Math.PI * 0.38, Math.PI * 0.12),
        new THREE.MeshStandardMaterial({ color: 0x0f1a20, roughness: 0.12, metalness: 0.5, transparent: ghost, opacity: ghost ? 0.3 : 1 }),
    );
    glasses.scale.set(1.03, 1, 1.15);
    glasses.position.set(0, 2.14, 0.31);
    group.add(head, helmet, helmetBand, glasses);

    // Brazos: manga corta del maillot, antebrazo desnudo y guante en el maneta.
    const leftArm = createAnimatedLimb(jerseyMaterial, skinMaterial, { upper: [0.062, 0.052], lower: [0.05, 0.04] });
    const rightArm = createAnimatedLimb(jerseyMaterial, skinMaterial, { upper: [0.062, 0.052], lower: [0.05, 0.04] });
    const armPose = (side) => ({
        shoulder: new THREE.Vector3(side * 0.21, 1.89, 0.07),
        elbow: new THREE.Vector3(side * 0.27, 1.6, 0.36),
        hand: new THREE.Vector3(side * 0.25, 1.2, 0.69),
    });
    for (const [arm, side] of [[leftArm, -1], [rightArm, 1]]) {
        const pose = armPose(side);
        alignTube(arm.upper, pose.shoulder, pose.elbow);
        alignTube(arm.lower, pose.elbow, pose.hand);
        const glove = new THREE.Mesh(new THREE.SphereGeometry(0.058, 12, 10), gloveMaterial);
        glove.scale.set(0.95, 0.9, 1.35);
        glove.position.copy(pose.hand).add(new THREE.Vector3(0, 0.015, 0.02));
        const shoulderJoint = new THREE.Mesh(new THREE.SphereGeometry(0.068, 12, 10), jerseyMaterial);
        shoulderJoint.position.copy(pose.shoulder);
        const elbowJoint = new THREE.Mesh(new THREE.SphereGeometry(0.05, 10, 8), skinMaterial);
        elbowJoint.position.copy(pose.elbow);
        group.add(arm.upper, arm.lower, glove, shoulderJoint, elbowJoint);
    }

    // Piernas: culotte, muslo, gemelo, calcetín y zapatilla; todo se reposiciona por frame.
    const makeLeg = () => ({
        short: makeTaperedTube(0.098, 0.078, shortsMaterial),
        thigh: makeTaperedTube(0.078, 0.064, skinMaterial),
        calf: makeTaperedTube(0.064, 0.046, skinMaterial),
        sock: makeTaperedTube(0.05, 0.045, sockMaterial),
        knee: new THREE.Mesh(new THREE.SphereGeometry(0.064, 12, 10), skinMaterial),
        shoe: new THREE.Mesh(new THREE.SphereGeometry(1, 14, 10), shoeMaterial),
        stripe: new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.02, 0.1), new THREE.MeshBasicMaterial({ color: accent, transparent: ghost, opacity: ghost ? 0.35 : 0.95 })),
    });
    const leftLeg = makeLeg();
    const rightLeg = makeLeg();
    for (const leg of [leftLeg, rightLeg]) {
        leg.shoe.scale.set(0.078, 0.06, 0.165);
        group.add(...Object.values(leg));
    }

    // Sombra de contacto suave que ancla la bici al asfalto incluso sin sombras dinámicas.
    const blob = new THREE.Mesh(
        new THREE.PlaneGeometry(1.6, 3.1),
        new THREE.MeshBasicMaterial({ map: getBlobShadowTexture(), transparent: true, opacity: ghost ? 0.12 : 0.5, depthWrite: false }),
    );
    blob.rotation.x = -Math.PI / 2;
    blob.position.set(0, 0.035, 0);
    group.add(blob);

    group.traverse((child) => {
        if (!child.isMesh || child === blob) return;
        child.castShadow = !ghost;
        child.receiveShadow = !ghost;
    });
    if (ghost) group.scale.setScalar(0.97);

    return {
        group,
        rearWheel,
        frontWheel,
        leftLeg,
        rightLeg,
        leftCrank,
        rightCrank,
        crankRing,
        outerRing,
        accentMaterial,
        accentMaterials: [accentMaterial, jerseyMaterial],
        crankAngle: 0,
    };
}

let jerseyTexture = null;
function createJerseyTexture() {
    if (jerseyTexture) return jerseyTexture;
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const context = canvas.getContext('2d');
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, 256, 256);
    // v = 0 en la cadera, v = 1 en el cuello (el canvas se lee de arriba abajo).
    const y = (v) => (1 - v) * 256;
    context.fillStyle = 'rgba(0,0,0,0.78)';
    context.fillRect(0, y(0.66), 256, y(0.6) - y(0.66));
    context.fillStyle = 'rgba(0,0,0,0.5)';
    context.fillRect(0, y(0.3), 256, 3);
    context.fillStyle = 'rgba(30,30,30,0.35)';
    for (const start of [0.66, 0.74, 0.82]) {
        // Tres bolsillos traseros (u ≈ 0.75 corresponde a la espalda).
        context.fillRect(start * 256 - 8, y(0.28), 20, y(0.06) - y(0.28));
    }
    context.fillStyle = 'rgba(0,0,0,0.3)';
    context.fillRect(0, 0, 256, 2);
    for (const seam of [0, 0.5]) context.fillRect(seam * 256, 0, 2, 256);
    jerseyTexture = new THREE.CanvasTexture(canvas);
    jerseyTexture.colorSpace = THREE.SRGBColorSpace;
    jerseyTexture.wrapS = THREE.RepeatWrapping;
    return jerseyTexture;
}

let blobTexture = null;
function getBlobShadowTexture() {
    if (blobTexture) return blobTexture;
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 256;
    const context = canvas.getContext('2d');
    context.translate(64, 128);
    context.scale(1, 2);
    const gradient = context.createRadialGradient(0, 0, 0, 0, 0, 62);
    gradient.addColorStop(0, 'rgba(0,0,0,0.85)');
    gradient.addColorStop(0.5, 'rgba(0,0,0,0.35)');
    gradient.addColorStop(1, 'rgba(0,0,0,0)');
    context.fillStyle = gradient;
    context.fillRect(-64, -64, 128, 128);
    blobTexture = new THREE.CanvasTexture(canvas);
    return blobTexture;
}

// Superficie elíptica que recorre una lista de secciones (tronco, etc.) con tapas.
function createLoft(sections, radial = 16) {
    const positions = [];
    const uvs = [];
    const indices = [];
    const right = new THREE.Vector3(1, 0, 0);
    sections.forEach((section, index) => {
        const next = sections[Math.min(index + 1, sections.length - 1)].center;
        const previous = sections[Math.max(index - 1, 0)].center;
        const direction = next.clone().sub(previous).normalize();
        const front = new THREE.Vector3().crossVectors(right, direction).normalize();
        for (let step = 0; step <= radial; step += 1) {
            const angle = (step / radial) * Math.PI * 2;
            const point = section.center.clone()
                .addScaledVector(right, Math.cos(angle) * section.width / 2)
                .addScaledVector(front, Math.sin(angle) * section.depth / 2);
            positions.push(point.x, point.y, point.z);
            uvs.push(step / radial, index / (sections.length - 1));
        }
    });
    const stride = radial + 1;
    for (let row = 0; row < sections.length - 1; row += 1) {
        for (let step = 0; step < radial; step += 1) {
            const a = row * stride + step;
            const b = a + stride;
            indices.push(a, a + 1, b, a + 1, b + 1, b);
        }
    }
    for (const [ringIndex, flip] of [[0, true], [sections.length - 1, false]]) {
        const centerIndex = positions.length / 3;
        const center = sections[ringIndex].center;
        positions.push(center.x, center.y, center.z);
        uvs.push(0.5, ringIndex === 0 ? 0 : 1);
        for (let step = 0; step < radial; step += 1) {
            const a = ringIndex * stride + step;
            indices.push(...(flip ? [centerIndex, a + 1, a] : [centerIndex, a, a + 1]));
        }
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();
    return geometry;
}

function makeTaperedTube(startRadius, endRadius, material) {
    // Cilindro unitario orientado por alignTube: la base (-y) es el inicio y la tapa (+y) el final.
    return new THREE.Mesh(new THREE.CylinderGeometry(endRadius, startRadius, 1, 14, 1), material);
}

function createAnimatedLimb(upperMaterial, lowerMaterial, radii) {
    return {
        upper: makeTaperedTube(radii.upper[0], radii.upper[1], upperMaterial),
        lower: makeTaperedTube(radii.lower[0], radii.lower[1], lowerMaterial),
    };
}

const _hip = new THREE.Vector3();
const _foot = new THREE.Vector3();
const _knee = new THREE.Vector3();
const _mid = new THREE.Vector3();
const _ankle = new THREE.Vector3();
const _crank = new THREE.Vector3(0, 0.67, -0.04);

function poseLeg(leg, side, angle) {
    const radius = 0.16;
    _hip.set(side * 0.11, 1.4, -0.34);
    _foot.set(side * 0.15, 0.68 + Math.sin(angle) * radius, -0.04 + Math.cos(angle) * radius);
    // Rodilla: punto de flexión adelantado respecto a la línea cadera-pie.
    _knee.copy(_hip).lerp(_foot, 0.5);
    _knee.z += 0.15;
    _knee.y += 0.02;
    _mid.copy(_hip).lerp(_knee, 0.62);
    _ankle.copy(_knee).lerp(_foot, 0.78);
    alignTube(leg.short, _hip, _mid);
    alignTube(leg.thigh, _mid, _knee);
    alignTube(leg.calf, _knee, _ankle);
    alignTube(leg.sock, _ankle, _foot);
    leg.knee.position.copy(_knee);
    leg.shoe.position.copy(_foot).add(_shoeOffset);
    leg.shoe.rotation.x = -Math.sin(angle) * 0.14;
    leg.stripe.position.copy(leg.shoe.position).add(_stripeOffset);
    leg.stripe.rotation.x = leg.shoe.rotation.x;
    return _foot;
}
const _shoeOffset = new THREE.Vector3(0, -0.03, 0.07);
const _stripeOffset = new THREE.Vector3(0, 0.05, -0.01);

function animateCyclist(cyclist, angle, speed, flow, active) {
    const wheelRotation = active ? angle * 1.85 : angle;
    cyclist.rearWheel.rotation.x = wheelRotation;
    cyclist.frontWheel.rotation.x = wheelRotation;
    // Un pie por lado: el izquierdo va con el ángulo, el derecho desfasado 180°.
    const leftFoot = poseLeg(cyclist.leftLeg, -1, angle).clone();
    const rightFoot = poseLeg(cyclist.rightLeg, 1, angle + Math.PI);
    alignTube(cyclist.leftCrank, _crank, leftFoot);
    alignTube(cyclist.rightCrank, _crank, rightFoot);
    cyclist.crankRing.rotation.x = angle;
    cyclist.outerRing.rotation.x = angle;
    const lean = Math.min(0.055, speed * 0.0018) + flow * 0.012;
    cyclist.group.rotation.z = Math.sin(angle * 0.5) * lean * 0.08;
}

function createTube(start, end, radius, material) {
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, 1, 10), material);
    alignTube(mesh, start, end);
    return mesh;
}

function alignTube(mesh, start, end) {
    const midpoint = start.clone().add(end).multiplyScalar(0.5);
    const direction = end.clone().sub(start);
    const length = Math.max(0.001, direction.length());
    mesh.position.copy(midpoint);
    mesh.quaternion.setFromUnitVectors(Y_AXIS, direction.normalize());
    mesh.scale.set(1, length, 1);
}

function orientAlongCurve(object, position, tangent) {
    object.position.copy(position);
    const horizontal = Math.max(0.0001, Math.hypot(tangent.x, tangent.z));
    object.rotation.set(-Math.atan2(tangent.y, horizontal), Math.atan2(tangent.x, tangent.z), 0);
}

function flattenTangent(tangent) {
    const horizontal = new THREE.Vector3(tangent.x, 0, tangent.z);
    if (horizontal.lengthSq() < 0.0001) return FORWARD_AXIS.clone();
    return horizontal.normalize();
}

function resolveQuality(quality) {
    if (QUALITY_PRESETS[quality]) return quality;
    const memory = Number(navigator.deviceMemory) || 4;
    const cores = Number(navigator.hardwareConcurrency) || 4;
    if (memory <= 2 || cores <= 2) return 'low';
    if (memory >= 8 && cores >= 8) return 'high';
    return 'medium';
}
