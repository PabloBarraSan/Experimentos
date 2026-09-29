import * as THREE from 'three';
import { seeded } from './scene/noise.js';
import { createTerrain } from './scene/terrain.js';
import { createSky, SUN_DIRECTION } from './scene/sky.js';
import { createWater } from './scene/water.js';
import { createVegetation } from './scene/vegetation.js';
import { createProfileRibbon, createAsphaltTextures, createGravelTexture, ASPHALT_WIDTH } from './scene/road.js';
import { createStartGate, createSummitBeacon, createFence, createCabin, createRoadPosts } from './scene/props.js';
import { createPostProcessing } from './scene/post.js';
import { createPrecipitation } from './scene/weather.js';

const CAMERA_PRESETS = {
    close: { distance: 5.9, height: 2.6, lookHeight: 1.15, lookAhead: 5.2, fov: 46 },
    standard: { distance: 8.0, height: 3.1, lookHeight: 1.05, lookAhead: 7.2, fov: 47 },
    wide: { distance: 13.2, height: 5.1, lookHeight: 0.9, lookAhead: 12, fov: 51 },
};

const QUALITY_PRESETS = {
    low: { pixelRatio: 1, shadows: false, shadowMap: 0, shadowExtent: 0, post: false, particles: 40, rivals: 2, precipitation: 600 },
    medium: { pixelRatio: 1.35, shadows: true, shadowMap: 2048, shadowExtent: 46, post: true, particles: 80, rivals: 4, precipitation: 1400 },
    high: { pixelRatio: 2, shadows: true, shadowMap: 4096, shadowExtent: 42, post: true, particles: 140, rivals: 5, precipitation: 2600 },
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

// Pelotón: la fuerza es la fracción de la potencia objetivo que empujan. Los ritmos
// son parecidos a propósito para que tu esfuerzo real decida si los pasas o te pasan.
const RIVALS = [
    { name: 'Marta', color: 0xff5c93, strength: 0.99, lane: -1.8, phase: 0.1, attacker: false, startGap: 14 },
    { name: 'Iker', color: 0xf1f1ec, strength: 1.0, lane: 1.7, phase: 0.45, attacker: true, startGap: 6 },
    { name: 'Lucía', color: 0x9b6bff, strength: 0.96, lane: -1.0, phase: 0.7, attacker: false, startGap: -9 },
    { name: 'Diego', color: 0x3a63e0, strength: 1.02, lane: 1.0, phase: 0.2, attacker: true, startGap: -17 },
    { name: 'Carla', color: 0xc2283a, strength: 0.975, lane: -2.4, phase: 0.85, attacker: false, startGap: 27 },
];

// Clima por mundo: la lluvia de Bruma empeora con el esfuerzo; la nieve del Norte
// llega al ganar altura (progreso de la ruta).
const WEATHER = {
    mist: { kind: 'rain', byBlock: { interval: 0.95, ramp: 0.8, steady: 0.6, warmup: 0.35, rest: 0.3, cooldown: 0.4 } },
    north: { kind: 'snow', fromProgress: 0.3, toProgress: 0.75, max: 0.95 },
};

// El ciclista se modela en metros reales y se amplía para leerse bien desde la cámara.
const RIDER_SCALE = 1.4;
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
            raceEnabled: true,
        };
        this.wetness = 0;
        this.referencePower = 0;
        this.raceStatus = { rank: 1, total: 1, entries: [] };
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
        this.player.group.scale.setScalar(RIDER_SCALE);
        this.ghost.group.scale.setScalar(RIDER_SCALE * 0.96);
        this.ghost.group.visible = false;
        this.scene.add(this.player.group, this.ghost.group);
        this.buildFlowParticles();
        this.buildRivals();
        this.buildWeather();
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
            t: 0.055,
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
        this.roadMaterial = roadMaterial;
        // El talud baja del borde del asfalto hasta el suelo del corredor.
        const shoulderMaterial = new THREE.MeshStandardMaterial({
            color: 0xb4aa94,
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

    buildRivals() {
        const count = QUALITY_PRESETS[this.quality].rivals;
        this.rivals = RIVALS.slice(0, count).map((config) => {
            const cyclist = createCyclist({ accent: config.color, ghost: false });
            cyclist.group.scale.setScalar(RIDER_SCALE);
            const label = createNameLabel(config.name, config.color);
            label.sprite.position.set(0, 2.0, 0);
            cyclist.group.add(label.sprite);
            this.scene.add(cyclist.group);
            return {
                config,
                cyclist,
                label,
                distance: this.visualDistance + config.startGap,
                gap: config.startGap,
                crank: Math.random() * Math.PI * 2,
                labelText: '',
                labelClock: 0,
            };
        });
    }

    disposeRivals() {
        this.rivals?.forEach(({ cyclist, label }) => {
            label.dispose();
            cyclist.group.traverse((child) => {
                if (!child.isMesh || child.geometry.userData.shared) return;
                child.geometry.dispose();
            });
            cyclist.group.removeFromParent();
        });
        this.rivals = [];
    }

    // Cada rival avanza como avanzaría el jugador con su potencia: v = k·P. Así, con la
    // misma potencia que ellos os mantenéis juntos, y empujar más o menos os separa.
    updateRivals(delta, playerSpeed, active) {
        const enabled = this.state.raceEnabled !== false;
        const length = this.routeLength;
        const target = Number(this.state.targetPower) || 0;
        const playerPower = Math.max(0, Number(this.state.power) || 0);
        this.referencePower += (playerPower - this.referencePower) * Math.min(1, delta * 0.15);
        const reference = target > 0 ? target : Math.max(120, this.referencePower);
        const blockType = this.state.blockType;
        const surge = blockType === 'interval' || blockType === 'ramp';
        const entries = [{ name: 'Tú', gap: 0, isPlayer: true, color: 0x63e0b5 }];

        for (const rival of this.rivals) {
            const { config, cyclist, label } = rival;
            cyclist.group.visible = enabled;
            label.sprite.visible = enabled;
            if (!enabled) continue;
            const wave = 1 + Math.sin(this.elapsed * 0.23 + config.phase * 6.28) * 0.03;
            const tactic = config.attacker ? (surge ? 1.05 : 0.95) : 1;
            const rivalPower = reference * config.strength * wave * tactic;
            const base = playerPower > 40 ? playerPower : reference;
            let ratio = THREE.MathUtils.clamp(rivalPower / Math.max(base, 60), 0.75, 1.3);
            // Goma elástica suave: el pelotón nunca se pierde de vista.
            if (rival.gap > 70) ratio *= 1 - Math.min(0.12, (rival.gap - 70) / 600);
            if (rival.gap < -70) ratio *= 1 + Math.min(0.12, (-70 - rival.gap) / 600);
            const speed = active ? playerSpeed * ratio : 0;
            rival.distance += delta * speed * (0.88 + this.state.flow * 0.28);

            const raw = rival.distance - this.visualDistance;
            rival.gap = ((raw + length / 2) % length + length) % length - length / 2;
            entries.push({ name: config.name, gap: rival.gap, color: config.color });

            const near = Math.abs(rival.gap) < 160;
            cyclist.group.visible = near;
            label.sprite.visible = Math.abs(rival.gap) < 75;
            if (!near) continue;
            // Tamaño angular constante: legible de lejos y discreta de cerca.
            const labelWidth = THREE.MathUtils.clamp(this.camera.position.distanceTo(cyclist.group.position) * 0.11, 2.2, 5);
            label.sprite.scale.set(labelWidth, labelWidth * (80 / 384) * 1.15, 1);

            const t = (((rival.distance % length) + length) % length) / length;
            const point = this.routeCurve.getPointAt(t);
            const tangent = this.routeCurve.getTangentAt(t).normalize();
            const sideX = -tangent.z;
            const sideZ = tangent.x;
            const norm = Math.hypot(sideX, sideZ) || 1;
            point.x += (sideX / norm) * config.lane;
            point.z += (sideZ / norm) * config.lane;
            point.y += 0.025;
            orientAlongCurve(cyclist.group, point, tangent);
            const cadence = 84 + Math.sin(this.elapsed * 0.4 + config.phase * 9) * 5 + (surge && config.attacker ? 6 : 0);
            rival.crank += delta * (active ? cadence * Math.PI * 2 / 60 : 0);
            animateCyclist(cyclist, rival.crank, speed, 0.5, active);

            rival.labelClock += delta;
            if (rival.labelClock > 0.3) {
                rival.labelClock = 0;
                const meters = Math.round(Math.abs(rival.gap));
                const text = `${config.name}  ${rival.gap >= 0 ? '+' : '−'}${meters} m`;
                if (text !== rival.labelText) {
                    rival.labelText = text;
                    label.setText(text, rival.gap >= 0);
                }
            }
        }

        entries.sort((a, b) => b.gap - a.gap);
        this.raceStatus = {
            rank: entries.findIndex((entry) => entry.isPlayer) + 1,
            total: entries.length,
            entries,
        };
    }

    // Clasificación en vivo para el HUD: posición, hueco y lista ordenada.
    getRaceStatus() {
        return this.raceStatus;
    }

    buildWeather() {
        this.weatherConfig = WEATHER[this.mission.world] || null;
        this.precipitation = null;
        if (!this.weatherConfig) return;
        this.precipitation = createPrecipitation({
            kind: this.weatherConfig.kind,
            count: Math.round(QUALITY_PRESETS[this.quality].precipitation * (this.weatherConfig.kind === 'snow' ? 0.9 : 2)),
        });
        this.scene.add(this.precipitation.object);
    }

    updateWeather(delta) {
        const config = this.weatherConfig;
        let target = 0;
        if (config?.kind === 'rain') {
            target = config.byBlock[this.state.blockType] ?? 0.5;
        } else if (config?.kind === 'snow') {
            const span = config.toProgress - config.fromProgress;
            target = THREE.MathUtils.clamp((this.state.progress - config.fromProgress) / span, 0, 1) * config.max;
        }
        this.wetness += (target - this.wetness) * (1 - Math.exp(-delta * 0.35));
        if (!this.precipitation) return;
        const fov = THREE.MathUtils.degToRad(this.camera.fov);
        this.precipitation.update({
            elapsed: this.elapsed,
            camera: this.camera,
            intensity: this.reducedMotion ? this.wetness * 0.3 : this.wetness,
            pixelScale: this.canvas.height / (2 * Math.tan(fov / 2)),
        });
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
        if (this.moteMaterial) this.moteMaterial.opacity = this.reducedMotion ? 0 : 0.5;
        if (this.particleMaterial) this.particleMaterial.opacity = this.reducedMotion ? 0 : 0.22;
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
        this.disposeRivals();
        this.buildRivals();
        this.precipitation?.dispose();
        this.buildWeather();
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

        this.updateRivals(delta, visualSpeed, active);
        this.updateWeather(delta);
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
        // El mal tiempo apaga los colores: cielo plomizo, niebla densa y luz difusa.
        const wet = this.wetness;
        const storm = this.weatherConfig?.kind === 'snow' ? 0xe1e8ee : 0x8d99a3;
        goal.fog.lerp(new THREE.Color(storm), wet * 0.65);
        goal.sky.lerp(new THREE.Color(this.weatherConfig?.kind === 'snow' ? 0x9fb0c0 : 0x56626d), wet * 0.6);
        goal.sun.lerp(new THREE.Color(0xdfe3e6), wet * 0.5);
        this.scene.fog.density = this.worldStyle.fogDensity * (1 + wet * 1.8);
        this.skyDome.material.uniforms.cloudCover.value = this.worldStyle.clouds - wet * 0.3;
        if (this.roadMaterial) {
            const rain = this.weatherConfig?.kind === 'rain' ? wet : 0;
            this.roadMaterial.roughness = 0.9 - rain * 0.5;
            this.roadMaterial.color.setScalar(1 - rain * 0.28);
        }

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
        this.sunLight.intensity = (2.5 + this.state.flow * 0.6) * (1 - wet * 0.55);
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
        this.disposeRivals();
        this.precipitation?.dispose();
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

// Etiqueta flotante con el nombre y el hueco respecto al jugador.
function createNameLabel(name, colorHex) {
    const canvas = document.createElement('canvas');
    canvas.width = 384;
    canvas.height = 80;
    const context = canvas.getContext('2d');
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    const material = new THREE.SpriteMaterial({ map: texture, transparent: true, depthWrite: false, fog: false });
    const sprite = new THREE.Sprite(material);
    sprite.scale.set(3.6, 0.75, 1);
    sprite.renderOrder = 8;
    const accent = `#${new THREE.Color(colorHex).getHexString()}`;
    const setText = (text, ahead) => {
        context.clearRect(0, 0, canvas.width, canvas.height);
        context.fillStyle = 'rgba(8, 14, 18, 0.72)';
        context.beginPath();
        context.roundRect(6, 8, canvas.width - 12, canvas.height - 16, 26);
        context.fill();
        context.fillStyle = accent;
        context.fillRect(6, 8, 10, canvas.height - 16);
        context.fillStyle = ahead ? '#ffe2b3' : '#bfe6ff';
        context.font = '700 34px "Inter", "Helvetica Neue", Arial, sans-serif';
        context.textAlign = 'center';
        context.textBaseline = 'middle';
        context.fillText(text, canvas.width / 2 + 6, canvas.height / 2 + 1);
        texture.needsUpdate = true;
    };
    setText(name, true);
    return { sprite, setText, dispose: () => { texture.dispose(); material.dispose(); } };
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

// Ciclista en medidas reales (metros, +z hacia delante): rueda 700c, cuadro de ~55 cm y
// ciclista de ~1,75 m en postura de carretera. Se escala el grupo entero al colocarlo.
const BIKE = {
    wheelRadius: 0.335,
    bottomBracket: new THREE.Vector3(0, 0.27, 0),
    rearHub: new THREE.Vector3(0, 0.335, -0.41),
    frontHub: new THREE.Vector3(0, 0.335, 0.6),
    seatCluster: new THREE.Vector3(0, 0.88, -0.17),
    saddle: new THREE.Vector3(0, 0.95, -0.2),
    headTop: new THREE.Vector3(0, 0.93, 0.4),
    headBottom: new THREE.Vector3(0, 0.75, 0.435),
    crankLength: 0.172,
};
const BODY = {
    thigh: 0.43,
    shin: 0.43,
    upperArm: 0.29,
    forearm: 0.27,
    hipHalfWidth: 0.085,
    hipHeight: 1.0,
    hipZ: -0.21,
};

function createCyclist({ accent, ghost }) {
    const group = new THREE.Group();
    const ghostOpacity = (value) => ({ transparent: ghost, opacity: ghost ? value : 1, depthWrite: !ghost });
    const frameMaterial = new THREE.MeshStandardMaterial({ color: ghost ? 0x8ed9ff : 0x1c2529, roughness: 0.32, metalness: 0.6, ...ghostOpacity(0.38) });
    const accentMaterial = new THREE.MeshStandardMaterial({
        color: accent, emissive: accent, emissiveIntensity: ghost ? 0.9 : 0.35, roughness: 0.4, metalness: 0.2, ...ghostOpacity(0.45),
    });
    const unlitAccentMaterial = new THREE.MeshBasicMaterial({ color: accent, ...ghostOpacity(0.5) });
    const rubberMaterial = new THREE.MeshStandardMaterial({ color: 0x0b0f12, roughness: 0.9, ...ghostOpacity(0.3) });
    const metalMaterial = new THREE.MeshStandardMaterial({ color: ghost ? 0x8ed9ff : 0xc5d0d0, roughness: 0.35, metalness: 0.75, ...ghostOpacity(0.34) });
    const skinMaterial = new THREE.MeshStandardMaterial({ color: 0xd9a98a, roughness: 0.78, ...ghostOpacity(0.32) });
    const fabric = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.82, ...ghostOpacity(0.34), ...extra });
    const jerseyMaterial = new THREE.MeshStandardMaterial({
        color: accent, emissive: accent, emissiveIntensity: ghost ? 0.5 : 0.08, roughness: 0.75,
        map: createJerseyTexture(), ...ghostOpacity(0.42),
    });
    const shortsMaterial = fabric(0x14191c, { roughness: 0.68 });
    const sockMaterial = fabric(0xf2f0e8);
    const helmetMaterial = fabric(0xf4f1e8, { roughness: 0.3 });
    const gloveMaterial = fabric(0x1a1e21, { roughness: 0.9 });
    const shoeMaterial = fabric(0xecece6, { roughness: 0.5 });
    const v = (x, y, z) => new THREE.Vector3(x, y, z);

    // ---- Ruedas: cubierta fina, llanta de perfil medio y radios finos ----
    const buildWheel = () => {
        const wheel = new THREE.Group();
        const tire = new THREE.Mesh(new THREE.TorusGeometry(BIKE.wheelRadius, 0.0145, 8, 64), rubberMaterial);
        tire.rotation.y = Math.PI / 2;
        const rim = new THREE.Mesh(
            new THREE.CylinderGeometry(BIKE.wheelRadius - 0.016, BIKE.wheelRadius - 0.016, 0.026, 64, 1, true),
            new THREE.MeshStandardMaterial({ color: ghost ? 0x8ed9ff : 0x11161a, roughness: 0.3, metalness: 0.7, side: THREE.DoubleSide, ...ghostOpacity(0.3) }),
        );
        rim.rotation.z = Math.PI / 2;
        const spokePoints = [];
        for (let index = 0; index < 20; index += 1) {
            const angle = (index / 20) * Math.PI * 2;
            const side = index % 2 === 0 ? 0.018 : -0.018;
            spokePoints.push(side, 0, 0, 0, Math.cos(angle) * (BIKE.wheelRadius - 0.03), Math.sin(angle) * (BIKE.wheelRadius - 0.03));
        }
        const spokeGeometry = new THREE.BufferGeometry();
        spokeGeometry.setAttribute('position', new THREE.Float32BufferAttribute(spokePoints, 3));
        const spokes = new THREE.LineSegments(spokeGeometry, new THREE.LineBasicMaterial({ color: ghost ? 0x8ed9ff : 0x9aa5a8, transparent: true, opacity: ghost ? 0.25 : 0.7 }));
        const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.1, 12), metalMaterial);
        hub.rotation.z = Math.PI / 2;
        wheel.add(tire, rim, spokes, hub);
        return wheel;
    };
    const rearWheel = buildWheel();
    rearWheel.position.copy(BIKE.rearHub);
    const frontWheel = buildWheel();
    frontWheel.position.copy(BIKE.frontHub);
    group.add(rearWheel, frontWheel);

    // ---- Cuadro, horquilla y manillar ----
    const { bottomBracket: bb, rearHub, frontHub, seatCluster, headTop, headBottom } = BIKE;
    const barCenter = v(0, 0.97, 0.5);
    [
        [bb, seatCluster, 0.017, accentMaterial],
        [seatCluster, headTop, 0.015, accentMaterial],
        [bb, headBottom, 0.021, accentMaterial],
        [headBottom, headTop, 0.02, frameMaterial],
        [seatCluster, rearHub, 0.009, frameMaterial],
        [bb, rearHub, 0.011, frameMaterial],
        [headHubStart(headBottom), frontHub, 0.012, frameMaterial],
        [headTop, barCenter, 0.013, frameMaterial],
        [seatCluster, BIKE.saddle.clone().add(v(0, -0.02, 0)), 0.011, frameMaterial],
    ].forEach(([start, end, radius, material]) => group.add(createTube(start, end, radius, material)));
    for (const side of [-1, 1]) {
        group.add(
            createTube(v(side * 0.2, 0.97, 0.5), barCenter, 0.0115, frameMaterial),
            createTube(v(side * 0.2, 0.97, 0.5), v(side * 0.205, 0.955, 0.6), 0.0115, frameMaterial),
            createTube(v(side * 0.205, 0.955, 0.6), v(side * 0.205, 0.83, 0.645), 0.0115, frameMaterial),
            createTube(v(side * 0.205, 0.83, 0.645), v(side * 0.2, 0.805, 0.57), 0.0115, frameMaterial),
        );
        const hood = new THREE.Mesh(new THREE.SphereGeometry(0.03, 10, 8), rubberMaterial);
        hood.scale.set(0.8, 1.1, 1.5);
        hood.position.set(side * 0.2, 0.965, 0.585);
        group.add(hood);
    }
    const saddle = new THREE.Mesh(new THREE.SphereGeometry(1, 14, 8), rubberMaterial);
    saddle.scale.set(0.065, 0.02, 0.135);
    saddle.position.copy(BIKE.saddle).add(v(0, 0.01, -0.02));
    saddle.rotation.x = -0.05;
    const bottle = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.035, 0.2, 10), new THREE.MeshStandardMaterial({ color: 0xe5e3d6, roughness: 0.4, ...ghostOpacity(0.4) }));
    bottle.position.set(0, 0.55, 0.19);
    bottle.rotation.x = 0.5;
    const chainring = new THREE.Mesh(new THREE.TorusGeometry(0.095, 0.006, 6, 32), metalMaterial);
    chainring.rotation.y = Math.PI / 2;
    chainring.position.copy(bb).add(v(0.045, 0, 0));
    const cassette = new THREE.Mesh(new THREE.TorusGeometry(0.05, 0.012, 6, 20), metalMaterial);
    cassette.rotation.y = Math.PI / 2;
    cassette.position.copy(rearHub).add(v(0.045, 0, 0));
    const chain = new THREE.MeshStandardMaterial({ color: 0x969d98, roughness: 0.6, metalness: 0.6, ...ghostOpacity(0.3) });
    group.add(
        saddle, bottle, chainring, cassette,
        createTube(v(0.045, 0.365, -0.41), v(0.045, 0.365, 0), 0.004, chain),
        createTube(v(0.045, 0.175, -0.41), v(0.045, 0.175, 0), 0.004, chain),
    );
    const leftCrank = createTube(bb, bb, 0.011, frameMaterial);
    const rightCrank = createTube(bb, bb, 0.011, frameMaterial);
    group.add(leftCrank, rightCrank);

    // ---- Ciclista: torso entallado, cabeza con casco, brazos apoyados en las manetas ----
    const pelvis = v(0, BODY.hipHeight + 0.01, BODY.hipZ);
    const shoulders = v(0, 1.35, 0.18);
    const spineAt = (t) => pelvis.clone().lerp(shoulders, t).add(v(0, 0.022 * Math.sin(Math.PI * t), 0));
    const torsoSections = [
        { t: 0, width: 0.33, depth: 0.23 },
        { t: 0.3, width: 0.28, depth: 0.2 },
        { t: 0.65, width: 0.33, depth: 0.22 },
        { t: 0.93, width: 0.4, depth: 0.17 },
        { t: 1.06, width: 0.2, depth: 0.14 },
    ].map(({ t, width, depth }) => ({ center: spineAt(t), width, depth }));
    const torso = new THREE.Mesh(createLoft(torsoSections, 22), jerseyMaterial);
    const shorts = new THREE.Mesh(new THREE.SphereGeometry(1, 18, 12), shortsMaterial);
    shorts.scale.set(0.15, 0.09, 0.13);
    shorts.position.set(0, 0.99, -0.235);
    group.add(torso, shorts);

    const headCenter = v(0, 1.46, 0.31);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.095, 18, 14), skinMaterial);
    head.scale.set(0.92, 1.1, 1.05);
    head.position.copy(headCenter);
    const neck = createTube(v(0, 1.36, 0.2), headCenter.clone().add(v(0, -0.06, -0.02)), 0.04, skinMaterial);
    const helmet = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 16), helmetMaterial);
    helmet.scale.set(0.1, 0.082, 0.15);
    helmet.position.copy(headCenter).add(v(0, 0.035, -0.03));
    helmet.rotation.x = -0.32;
    const helmetBand = createTube(headCenter.clone().add(v(-0.098, -0.005, 0.02)), headCenter.clone().add(v(0.098, -0.005, 0.02)), 0.008, unlitAccentMaterial);
    const glasses = new THREE.Mesh(
        new THREE.SphereGeometry(0.098, 16, 8, 0, Math.PI * 2, Math.PI * 0.4, Math.PI * 0.11),
        new THREE.MeshStandardMaterial({ color: 0x0f1a20, roughness: 0.12, metalness: 0.5, ...ghostOpacity(0.3) }),
    );
    glasses.scale.set(1, 1, 1.12);
    glasses.position.copy(headCenter).add(v(0, -0.005, 0.02));
    glasses.rotation.x = 0.1;
    group.add(head, neck, helmet, helmetBand, glasses);

    for (const side of [-1, 1]) {
        const shoulder = v(side * 0.165, 1.315, 0.15);
        const hand = v(side * 0.2, 0.97, 0.575);
        const elbow = solveTwoBone(shoulder, hand, BODY.upperArm, BODY.forearm, v(side * 1, -0.25, -0.15));
        const sleeveEnd = shoulder.clone().lerp(elbow, 0.5);
        const sleeve = makeTaperedTube(0.044, 0.042, jerseyMaterial);
        const upperSkin = makeTaperedTube(0.045, 0.038, skinMaterial);
        const forearm = makeTaperedTube(0.037, 0.028, skinMaterial);
        alignTube(sleeve, shoulder, sleeveEnd);
        alignTube(upperSkin, sleeveEnd, elbow);
        alignTube(forearm, elbow, hand);
        const shoulderCap = new THREE.Mesh(new THREE.SphereGeometry(0.043, 12, 10), jerseyMaterial);
        shoulderCap.position.copy(shoulder);
        const elbowJoint = new THREE.Mesh(new THREE.SphereGeometry(0.038, 10, 8), skinMaterial);
        elbowJoint.position.copy(elbow);
        const glove = new THREE.Mesh(new THREE.SphereGeometry(0.04, 12, 10), gloveMaterial);
        glove.scale.set(0.9, 0.85, 1.4);
        glove.position.copy(hand).add(v(0, 0.012, 0.015));
        group.add(sleeve, upperSkin, forearm, shoulderCap, elbowJoint, glove);
    }

    // ---- Piernas: muslo, gemelo, calcetín y zapatilla; se recolocan por frame con IK ----
    const makeLeg = () => ({
        short: makeTaperedTube(0.068, 0.058, shortsMaterial),
        thigh: makeTaperedTube(0.058, 0.048, skinMaterial),
        calf: makeTaperedTube(0.05, 0.03, skinMaterial),
        sock: makeTaperedTube(0.032, 0.03, sockMaterial),
        knee: new THREE.Mesh(new THREE.SphereGeometry(0.05, 12, 10), skinMaterial),
        shoe: new THREE.Mesh(new THREE.SphereGeometry(1, 14, 10), shoeMaterial),
        stripe: new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.012, 0.07), new THREE.MeshBasicMaterial({ color: accent, transparent: ghost, opacity: ghost ? 0.35 : 0.95 })),
        pedal: new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.014, 0.1), frameMaterial),
    });
    const leftLeg = makeLeg();
    const rightLeg = makeLeg();
    for (const leg of [leftLeg, rightLeg]) {
        leg.shoe.scale.set(0.042, 0.038, 0.13);
        group.add(...Object.values(leg));
    }

    const blob = new THREE.Mesh(
        new THREE.PlaneGeometry(0.9, 1.9),
        new THREE.MeshBasicMaterial({ map: getBlobShadowTexture(), transparent: true, opacity: ghost ? 0.12 : 0.5, depthWrite: false }),
    );
    blob.rotation.x = -Math.PI / 2;
    blob.position.set(0, 0.02, 0);
    group.add(blob);

    group.traverse((child) => {
        if (!child.isMesh || child === blob) return;
        child.castShadow = !ghost;
        child.receiveShadow = !ghost;
    });

    return {
        group,
        rearWheel,
        frontWheel,
        leftLeg,
        rightLeg,
        leftCrank,
        rightCrank,
        crankRing: chainring,
        outerRing: chainring,
        accentMaterial,
        accentMaterials: [accentMaterial, jerseyMaterial],
        crankAngle: 0,
    };
}

function headHubStart(headBottom) {
    return headBottom.clone().add(new THREE.Vector3(0, -0.005, 0.005));
}

// Cinemática inversa de dos huesos: devuelve la articulación intermedia (rodilla/codo).
function solveTwoBone(root, target, lengthA, lengthB, pole) {
    const toTarget = target.clone().sub(root);
    const distance = THREE.MathUtils.clamp(toTarget.length(), 0.001, lengthA + lengthB - 0.002);
    const direction = toTarget.normalize();
    const along = (lengthA * lengthA - lengthB * lengthB + distance * distance) / (2 * distance);
    const height = Math.sqrt(Math.max(lengthA * lengthA - along * along, 0));
    const perpendicular = pole.clone().sub(direction.clone().multiplyScalar(pole.dot(direction))).normalize();
    return root.clone().addScaledVector(direction, along).addScaledVector(perpendicular, height);
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

const _hip = new THREE.Vector3();
const _pedal = new THREE.Vector3();
const _ankle = new THREE.Vector3();
const _pole = new THREE.Vector3();
const _mid = new THREE.Vector3();
const _shoeOffset = new THREE.Vector3(0, 0.02, 0.035);
const _stripeOffset = new THREE.Vector3(0, 0.038, 0.0);

function poseLeg(leg, side, angle) {
    const { bottomBracket, crankLength } = BIKE;
    _hip.set(side * BODY.hipHalfWidth, BODY.hipHeight, BODY.hipZ);
    _pedal.set(side * 0.11, bottomBracket.y + Math.sin(angle) * crankLength, Math.cos(angle) * crankLength);
    // El tobillo queda unos centímetros detrás y encima del eje del pedal.
    _ankle.copy(_pedal).add(_shoeOffsetAnkle).add(_ankleDrop.set(0, Math.max(0, Math.cos(angle) * 0.01), 0));
    _pole.set(side * 0.18, 0.35, 1);
    const knee = solveTwoBone(_hip, _ankle, BODY.thigh, BODY.shin, _pole);
    _mid.copy(_hip).lerp(knee, 0.62);
    const sockStart = knee.clone().lerp(_ankle, 0.72);
    alignTube(leg.short, _hip, _mid);
    alignTube(leg.thigh, _mid, knee);
    alignTube(leg.calf, knee, sockStart);
    alignTube(leg.sock, sockStart, _ankle);
    leg.knee.position.copy(knee);
    leg.pedal.position.copy(_pedal);
    leg.shoe.position.copy(_pedal).add(_shoeOffset);
    leg.shoe.rotation.x = -Math.sin(angle) * 0.12;
    leg.stripe.position.copy(leg.shoe.position).add(_stripeOffset);
    leg.stripe.rotation.x = leg.shoe.rotation.x;
    return _pedal;
}
const _shoeOffsetAnkle = new THREE.Vector3(0, 0.085, -0.1);
const _ankleDrop = new THREE.Vector3();

function animateCyclist(cyclist, angle, speed, flow, active) {
    const wheelRotation = active ? angle * 1.85 : angle;
    cyclist.rearWheel.rotation.x = wheelRotation;
    cyclist.frontWheel.rotation.x = wheelRotation;
    // Un pie por lado: el izquierdo va con el ángulo, el derecho desfasado 180°.
    const leftPedal = poseLeg(cyclist.leftLeg, -1, angle).clone();
    const rightPedal = poseLeg(cyclist.rightLeg, 1, angle + Math.PI).clone();
    const bb = BIKE.bottomBracket;
    alignTube(cyclist.leftCrank, bb.clone().add(_crankSide.set(-0.075, 0, 0)), leftPedal);
    alignTube(cyclist.rightCrank, bb.clone().add(_crankSide.set(0.075, 0, 0)), rightPedal);
    cyclist.crankRing.rotation.x = angle;
    const lean = Math.min(0.055, speed * 0.0018) + flow * 0.012;
    cyclist.group.rotation.z = Math.sin(angle * 0.5) * lean * 0.08;
}
const _crankSide = new THREE.Vector3();

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
