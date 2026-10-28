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
import { createCyclist, animateCyclist, updateRiderStance, RIDER_POSITIONS, DEFAULT_RIDER_POSITION } from './Cyclist.js';
import { stepSpeed } from '../ride/RidePhysics.js';
import { getRiderPrefs } from '../storage/settings.js';

// Puerto del circuito (fracciones de vuelta): pie, cima y final del descenso, y desnivel en metros.
// ~260 m de subida al 4,5 % de media (rampas de ~7,5 %) y un descenso igual de largo.
const LOOP_CLIMB = { start: 0.4, top: 0.68, end: 0.96, height: 12 };
const BIKE_MASS = 8; // kg
const RIVAL_MASS = 76; // kg (ciclista + bici)

// Altura de la carretera en cada punto de la vuelta (0..1): llano ondulado con un puerto.
function loopElevation(u) {
    const ease = (x) => x * x * (3 - 2 * x);
    const { start, top, end, height } = LOOP_CLIMB;
    let climb = 0;
    if (u >= start && u <= top) climb = height * ease((u - start) / (top - start));
    else if (u > top && u <= end) climb = height * (1 - ease((u - top) / (end - top)));
    return 4.5 + Math.sin(u * Math.PI * 6) * 1.1 + climb;
}

const CAMERA_PRESETS = {
    close: { distance: 5.9, height: 2.6, lookHeight: 1.15, lookAhead: 5.2, fov: 46 },
    standard: { distance: 8.0, height: 3.1, lookHeight: 1.05, lookAhead: 7.2, fov: 47 },
    wide: { distance: 13.2, height: 5.1, lookHeight: 0.9, lookAhead: 12, fov: 51 },
};

const QUALITY_PRESETS = {
    low: { pixelRatio: 1, shadows: false, shadowMap: 0, shadowExtent: 0, post: false, particles: 40, rivals: 2, precipitation: 600 },
    // Sombras solo cerca del ciclista (sin árboles ni hierba) y sin postproceso: ~3x más fluido en GPUs integradas.
    medium: { pixelRatio: 1, shadows: true, shadowMap: 1024, shadowExtent: 16, post: false, particles: 80, rivals: 4, precipitation: 1400 },
    high: { pixelRatio: 1.25, shadows: true, shadowMap: 2048, shadowExtent: 28, post: true, particles: 140, rivals: 5, precipitation: 2600 },
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
        onQualityAdapt = null,
        riderWeight = 70,
    } = {}) {
        this.canvas = canvas;
        // Física de la velocidad: masa total y CdA de la posición elegida para el ciclista.
        this.riderMass = riderWeight + BIKE_MASS;
        this.riderCda = (RIDER_POSITIONS[getRiderPrefs().position] || RIDER_POSITIONS[DEFAULT_RIDER_POSITION]).cda;
        this.playerSpeed = 0;
        this.onQualityAdapt = onQualityAdapt;
        this.frameAverageMs = 16.7;
        this.perfElapsedMs = 0;
        this.slowMs = 0;
        this.pixelRatioScale = 1;
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
        this.renderer.shadowMap.type = THREE.PCFShadowMap;
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
                loopElevation(index / pointCount),
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
            t: this.summitT(),
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
            const ratio = THREE.MathUtils.clamp(rivalPower / Math.max(base, 60), 0.75, 1.3);
            // Goma elástica suave: el pelotón nunca se pierde de vista (ajusta la potencia del rival, no su velocidad).
            let rubber = 1;
            if (rival.gap > 70) rubber = 1 - Math.min(0.35, (rival.gap - 70) / 250);
            if (rival.gap < -70) rubber = 1 + Math.min(0.35, (-70 - rival.gap) / 250);
            // Misma física que el jugador, con la pendiente de su punto del circuito.
            rival.speed = active
                ? stepSpeed(rival.speed || playerSpeed, {
                    power: base * ratio * rubber,
                    grade: this.gradeAt(rival.distance),
                    mass: RIVAL_MASS,
                    cda: 0.34,
                    dt: delta,
                })
                : 0;
            const speed = rival.speed;
            rival.distance += delta * speed;

            const raw = rival.distance - this.visualDistance;
            rival.gap = ((raw + length / 2) % length + length) % length - length / 2;
            entries.push({ name: config.name, gap: rival.gap, color: config.color });

            const near = Math.abs(rival.gap) < 160;
            cyclist.group.visible = near;
            label.sprite.visible = Math.abs(rival.gap) < 75;
            if (!near) continue;
            // Tamaño angular constante: legible de lejos y discreta de cerca.
            const labelWidth = THREE.MathUtils.clamp(this.camera.position.distanceTo(cyclist.group.position) * 0.06, 1.2, 2.6);
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

        // Solo se etiquetan los dos rivales más cercanos: con más, los carteles se pisan.
        const labelled = new Set(this.rivals
            .filter(({ gap }) => Math.abs(gap) < 75)
            .sort((a, b) => Math.abs(a.gap) - Math.abs(b.gap))
            .slice(0, 2));
        // Un rival pegado a la cámara taparía media pantalla con su cartel.
        for (const rival of this.rivals) {
            const farEnough = this.camera.position.distanceTo(rival.cyclist.group.position) > 9;
            rival.label.sprite.visible = enabled && labelled.has(rival) && farEnough;
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

    /**
     * Datos del minimapa: contorno del circuito (plano XZ, se calcula una vez) y la posición (0..1) del jugador,
     * los rivales y el fantasma sobre él.
     */
    getMapState() {
        if (!this.routeCurve) return null;
        if (!this.mapOutline) {
            this.mapOutline = this.routeCurve.getSpacedPoints(96).map(({ x, z }) => ({ x, z }));
        }
        const length = this.routeLength;
        const along = (distance) => (((distance % length) + length) % length) / length;
        const enabled = this.state.raceEnabled !== false;
        return {
            outline: this.mapOutline,
            player: along(this.visualDistance),
            rivals: enabled ? this.rivals.map(({ distance, config }) => ({ t: along(distance), color: config.color })) : [],
            ghost: this.ghost?.group.visible ? this.ghostT ?? null : null,
        };
    }

    // Pendiente (%) de la carretera a una distancia dada del circuito (diferencia de alturas a ±4 m).
    gradeAt(distance) {
        const length = this.routeLength;
        const at = (d) => this.routeCurve.getPointAt((((d % length) + length) % length) / length).y;
        return ((at(distance + 4) - at(distance - 4)) / 8) * 100;
    }

    // Fracción de vuelta en la cima del puerto (donde está la baliza).
    summitT() {
        return LOOP_CLIMB.top;
    }

    /**
     * Perfil del circuito para el HUD: altura por tramo (se calcula una vez), longitud de la vuelta, posición del
     * jugador en la vuelta, pendiente actual, velocidad y distancia a la cima (null si ya la pasó en esta vuelta).
     */
    getProfileState() {
        if (!this.routeCurve) return null;
        const length = this.routeLength;
        if (!this.profileSamples) {
            this.profileSamples = Array.from({ length: 121 }, (_, index) => this.routeCurve.getPointAt((index % 120) / 120).y);
        }
        const lapDistance = ((this.visualDistance % length) + length) % length;
        const summit = LOOP_CLIMB.top * length;
        const climbStart = LOOP_CLIMB.start * length;
        return {
            samples: this.profileSamples,
            length,
            position: lapDistance / length,
            grade: this.playerGrade || 0,
            speed: this.playerSpeed || 0,
            toSummit: lapDistance >= climbStart - 400 && lapDistance < summit ? summit - lapDistance : null,
            climb: { start: LOOP_CLIMB.start, top: LOOP_CLIMB.top },
        };
    }

    /** Velocidad con la que se mueve el ciclista en pantalla (m/s); el sonido ambiente la sigue. */
    getPlayerSpeed() {
        return this.playerSpeed || 0;
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

    // Si la GPU no da la talla, baja la calidad sola en vez de dejar que la sesión vaya a tirones.
    monitorPerformance(rawMs) {
        // Un fotograma de más de 0,6 s es una pausa del navegador (pestaña oculta, ventana tapada), no una GPU lenta.
        if (document.hidden || rawMs <= 0 || rawMs > 600) {
            this.slowMs = 0;
            return;
        }
        this.perfElapsedMs += rawMs;
        if (this.perfElapsedMs < 6000) return; // la compilación de shaders al arrancar no cuenta
        this.frameAverageMs += (rawMs - this.frameAverageMs) * 0.05;
        this.slowMs = this.frameAverageMs > 30 ? this.slowMs + rawMs : Math.max(0, this.slowMs - rawMs);
        if (this.slowMs > 3000) {
            this.slowMs = 0;
            this.frameAverageMs = 16.7;
            this.degradeQuality();
        }
    }

    // Bajadas en caliente, sin reconstruir el mundo (reconstruirlo en una GPU que ya va justa empeora el tirón).
    degradeQuality() {
        const step = this.degradeStep || 0;
        this.degradeStep = step + 1;
        if (step === 0 && this.post) {
            this.post.dispose();
            this.post = null;
            this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1));
            this.resize();
        } else if (step <= 1 && this.renderer.shadowMap.enabled) {
            this.degradeStep = 2;
            this.sunLight.castShadow = false;
            this.renderer.shadowMap.enabled = false;
            this.scene.traverse((object) => {
                const materials = Array.isArray(object.material) ? object.material : [object.material];
                materials.forEach((material) => { if (material) material.needsUpdate = true; });
            });
        } else if (this.pixelRatioScale > 0.7) {
            this.degradeStep = 3;
            this.pixelRatioScale = 0.75;
            this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1) * this.pixelRatioScale);
            this.resize();
        } else {
            return;
        }
        this.onQualityAdapt?.(this.quality, this.degradeStep);
    }

    draw(timestamp) {
        // Límite de 60 fps: en pantallas de 120-144 Hz se renderizaba el doble sin que se note.
        const interval = 1000 / 60;
        this.frameDebt = (this.frameDebt || 0) + (timestamp - (this.lastRafTimestamp ?? timestamp));
        this.lastRafTimestamp = timestamp;
        if (this.frameDebt < interval - 1) {
            this.frameId = requestAnimationFrame((nextTimestamp) => this.draw(nextTimestamp));
            return;
        }
        this.frameDebt = Math.min(this.frameDebt - interval, interval);
        this.monitorPerformance(timestamp - this.lastTimestamp);
        const delta = Math.min(0.05, Math.max(0, (timestamp - this.lastTimestamp) / 1000));
        this.lastTimestamp = timestamp;
        this.elapsed += delta;
        const active = !this.state.paused;
        // Velocidad con física: la potencia real empuja contra la pendiente, la rodadura y el aire. En el puerto se va
        // despacio y en la bajada se acelera aunque no se pedalee; el Flow alto es como ir a rueda (menos aire).
        const playerPower = active ? Math.max(0, Number(this.state.power) || 0) : 0;
        this.playerGrade = this.gradeAt(this.visualDistance);
        this.playerSpeed = active
            ? stepSpeed(this.playerSpeed, {
                power: playerPower,
                grade: this.playerGrade,
                mass: this.riderMass,
                cda: this.riderCda * (1 - 0.12 * (this.state.flow || 0)),
                dt: delta,
            })
            : this.playerSpeed * Math.max(0, 1 - delta * 2.5);
        const visualSpeed = this.playerSpeed;
        this.visualDistance += delta * visualSpeed;

        const t = (this.visualDistance % this.routeLength) / this.routeLength;
        const position = this.routeCurve.getPointAt(t);
        const routeTangent = this.routeCurve.getTangentAt(t).normalize();
        const tangent = flattenTangent(routeTangent);
        const playerPosition = position.clone().add(new THREE.Vector3(0, 0.025, 0));
        orientAlongCurve(this.player.group, playerPosition, routeTangent);

        const cadence = active ? Math.max(0, Number(this.state.cadence) || 0) : 0;
        const crankSpeed = cadence > 0 ? cadence * Math.PI * 2 / 60 : visualSpeed * 0.9;
        this.player.crankAngle += delta * crankSpeed;
        updateRiderStance(this.player, {
            grade: this.playerGrade,
            cadence,
            power: active ? Number(this.state.power) || 0 : 0,
            dt: delta,
        });
        animateCyclist(this.player, this.player.crankAngle, visualSpeed, this.state.flow, active);

        this.ghost.group.visible = Boolean(this.state.ghostVisible);
        const ghostLead = 12 + (1 - this.state.ghostProgress) * 26;
        const ghostT = Number.isFinite(this.state.ghostRouteProgress)
            ? ((this.state.ghostRouteProgress % 1) + 1) % 1
            : ((this.visualDistance + ghostLead) % this.routeLength) / this.routeLength;
        this.ghostT = ghostT;
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
    return 'medium';
}
