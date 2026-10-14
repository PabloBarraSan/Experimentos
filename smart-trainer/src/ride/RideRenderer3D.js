/**
 * RideRenderer3D - Motor visual estilo Zwift
 * Convierte datos matemáticos de la ruta en carretera 3D
 * Smart Trainer - Virtual Cycling
 */

import * as THREE from 'three';
import { createCyclist, animateCyclist, disposeCyclist, getCyclistStyle, BIKE, BIKE_PAINTS, DEFAULT_RIDER_POSITION } from '../expedition/Cyclist.js';
import { preloadRiderAvatar, isRiderAvatarReady } from '../expedition/AvatarRider.js';
import { createProfileRibbon, createAsphaltTextures, createGravelTexture } from '../expedition/scene/road.js';
import { createSky } from '../expedition/scene/sky.js';
import { RideTerrain } from './scenery/RideTerrain.js';
import { RideDecor } from './scenery/RideDecor.js';
import { buildRouteCurve } from './RouteCurve.js';

// Escala del ciclista en la escena (el modelo está en metros reales)
const RIDER_SCALE = 1.4;
const PLAYER_JERSEY = 0x63e0b5;
const GHOST_JERSEY = 0x9ad0ff;
const GHOST_CADENCE = 85; // rpm con las que pedalea el fantasma (no se graba la cadencia)
const TWO_PI = Math.PI * 2;
const ROAD_CLEARANCE = 0.05; // Altura del asfalto sobre la curva (lift del ribbon de asfalto)

// Geometría de la carretera: asfalto de 7,2 m con arcén de grava hasta 6,4 m a cada lado
const ASPHALT_HALF_WIDTH = 3.0;
const SHOULDER_HALF_WIDTH = 4.4;
const MARKING_LIFT = 0.085;      // Pintura ligeramente sobre el asfalto (más polygonOffset)
const MARKING_STEP = 1.5;        // Longitud (m) de cada tramo de pintura
const DASH_STEPS = 3;            // Trazo y hueco de la línea central: 3 tramos (4,5 m)
const ROAD_SEGMENT_LENGTH = 2.5; // Separación (m) entre filas de la cinta
// La carretera se construye por tramos de ruta que entran y salen de una ventana
const CHUNK_LENGTH = 250;
const CHUNKS_BEHIND = 1;
const CHUNKS_AHEAD = 3;

// Distancia de la luz direccional al ciclista y semilado de su cámara de sombras
const SUN_DISTANCE = 220;
const SHADOW_EXTENT = 60;

// Iluminación por hora del día (calibrada para luces físicas + tone mapping ACES, como la expedición)
const LIGHTING = {
    morning: { sun: 2.5, sunColor: '#fff0d6', hemi: 1.4, hemiSky: '#cfe0ee', direction: [80, 100, 100], clouds: 0.5 },
    afternoon: { sun: 2.9, sunColor: '#fff1dc', hemi: 1.55, hemiSky: '#bcd6ee', direction: [100, 150, 80], clouds: 0.5 },
    sunset: { sun: 2.3, sunColor: '#ff9a55', hemi: 1.05, hemiSky: '#ffc9a8', direction: [150, 50, 50], clouds: 0.45 },
    night: { sun: 0.55, sunColor: '#7a86c8', hemi: 0.5, hemiSky: '#46507a', direction: [50, 100, 50], clouds: 0.62 },
};

// Mundo por defecto hasta que llegue el worldConfig real
const DEFAULT_WORLD = {
    id: '__default',
    skyColors: { top: '#87CEEB', middle: '#E0F4FF', horizon: '#98D8AA' },
    roadColors: { main: '#555555', line: '#FFFFFF', shoulder: '#8B7355' },
    landscape: { groundColor: '#7CFC00', objects: ['tree', 'bush'], objectDensity: 0.6, mountains: [{ height: 0.15 }] },
    ambient: { fog: false },
    timeOfDay: 'afternoon',
};

/**
 * Hash estable de un id (número o texto) para repartir colores y posiciones entre bots
 */
function hashId(id) {
    const text = String(id);
    let hash = 0;
    for (let i = 0; i < text.length; i++) hash = (hash * 31 + text.charCodeAt(i)) >>> 0;
    return hash;
}
/** Altura de la barra de métricas (compatibilidad con RideView) */
export const METRICS_BAR_HEIGHT = 60;

/**
 * Geometría de pintura (cintas planas sobre el asfalto) para un tramo [t0, t1] de la curva.
 * Los tramos de pintura siguen una rejilla global de MARKING_STEP metros, así el trazo
 * de la línea central es continuo entre tramos de carretera.
 * @param {Array<[number, number]>} strips - Franjas laterales [desde, hasta] en metros desde el eje
 * @param {boolean} dashed - Línea discontinua (trazo/hueco de DASH_STEPS tramos)
 * @returns {THREE.BufferGeometry|null}
 */
function createMarkingGeometry(curve, length, [t0, t1], strips, dashed) {
    const first = Math.ceil((t0 * length) / MARKING_STEP - 1e-9);
    const last = Math.ceil((t1 * length) / MARKING_STEP - 1e-9) - 1;
    const positions = [];
    const indices = [];
    const point = new THREE.Vector3();
    const tangent = new THREE.Vector3();
    const sections = [{ x: 0, y: 0, z: 0, sx: 0, sz: 0 }, { x: 0, y: 0, z: 0, sx: 0, sz: 0 }];

    const sample = (section, distance) => {
        const t = Math.min(1, Math.max(0, distance / length));
        curve.getPointAt(t, point);
        curve.getTangentAt(t, tangent);
        const norm = Math.hypot(tangent.x, tangent.z) || 1;
        section.x = point.x;
        section.y = point.y + MARKING_LIFT;
        section.z = point.z;
        section.sx = -tangent.z / norm;
        section.sz = tangent.x / norm;
    };

    for (let k = first; k <= last; k++) {
        if (dashed && k % (DASH_STEPS * 2) >= DASH_STEPS) continue;
        sample(sections[0], k * MARKING_STEP);
        sample(sections[1], (k + 1) * MARKING_STEP);
        for (const [lo, hi] of strips) {
            const base = positions.length / 3;
            for (const section of sections) {
                positions.push(section.x + section.sx * lo, section.y, section.z + section.sz * lo);
                positions.push(section.x + section.sx * hi, section.y, section.z + section.sz * hi);
            }
            // Mismo sentido de giro que createProfileRibbon (cara visible hacia arriba)
            indices.push(base, base + 1, base + 2, base + 2, base + 1, base + 3);
        }
    }
    if (positions.length === 0) return null;

    const normals = new Float32Array(positions.length);
    for (let i = 1; i < normals.length; i += 3) normals[i] = 1;
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
    geometry.setIndex(indices);
    return geometry;
}

export class RideRenderer3D {
    /**
     * @param {HTMLCanvasElement} canvas
     * @param {Object} options - { bikeColor, position } del ciclista del jugador (ver Cyclist.js)
     */
    constructor(canvas, options = {}) {
        this.canvas = canvas;
        this.riderOptions = {
            bikeColor: options.bikeColor ?? BIKE_PAINTS[0].color,
            position: options.position ?? DEFAULT_RIDER_POSITION,
        };
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.player = null;           // Ciclista del jugador (Cyclist.js)
        this.playerWheelAngle = 0;
        this.lastFrameTime = 0;
        this.frameDelta = 0;
        this.roadCurve = null;
        this.roadChunks = new Map();  // índice de tramo -> { meshes: Mesh[] }
        this.roadChunksNeedFull = false;
        this.routeSeed = 0;           // Semilla determinista del decorado (id de ruta + mundo)
        this.generatedRouteLength = 0; // Longitud de la ruta (m, sin las prolongaciones de salida y meta)
        this.routeCurve = null;       // Curva extendida (RouteCurve): distancia de ruta -> curva
        this.curveLength = 0;         // Longitud de arco (m) de la curva extendida
        this.roadPoints = null;       // Referencia a los puntos con los que se construyó la carretera
        this.horizontalPath = null;   // Trayectoria real (rutas GPX) o null para la sinusoide
        this.snapCamera = false;      // Colocar la cámara sin interpolar tras construir una ruta real
        this.dummyTarget = new THREE.Vector3();
        
        // Referencias a elementos que se actualizan con worldConfig
        this.terrain = null;
        this.decor = null;
        this.skyDome = null;
        this.skyTime = 0;
        this.zenithColor = new THREE.Color();
        this.horizonColor = new THREE.Color();
        this.dirLight = null;
        this.hemiLight = null;
        this.sunOffset = new THREE.Vector3(100, 150, 80).normalize().multiplyScalar(SUN_DISTANCE);
        this.currentWorldId = null;
        this.currentWorld = null;
        this.asphaltMaterial = null;
        this.shoulderMaterial = null;
        this.centerLineMaterial = null;
        this.edgeLineMaterial = null;
        
        // Sistema de bots 3D
        this.botRiders = new Map(); // id -> ciclista (Cyclist.js)
        this.ghostRider = null; // Fantasma de un ride pasado (semitransparente)
        
        // Guardar referencia bound para poder eliminar el listener correctamente
        this._boundOnResize = this.onResize.bind(this);

        this.init();
    }

    init() {
        this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true });
        this.renderer.setSize(this.canvas.clientWidth, this.canvas.clientHeight);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        // Mismo tratamiento de luz que la expedición (el ciclista está calibrado para él)
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 1;
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x87ceeb);
        this.scene.fog = new THREE.Fog(0x87ceeb, 120, 600);

        this.camera = new THREE.PerspectiveCamera(
            60,
            this.canvas.clientWidth / this.canvas.clientHeight,
            0.3,
            1500
        );

        // Cielo en degradado (cenit -> horizonte = color de la niebla); sigue a la cámara
        this.skyDome = createSky({ zenith: this.zenithColor, horizon: this.horizonColor });
        this.scene.add(this.skyDome);

        this.hemiLight = new THREE.HemisphereLight(0xbcd6ee, 0x3d4a33, 1.55);
        this.scene.add(this.hemiLight);

        this.dirLight = new THREE.DirectionalLight(0xffffff, 2.9);
        this.dirLight.castShadow = true;
        this.dirLight.shadow.mapSize.set(2048, 2048);
        // Cámara de sombras pequeña centrada en el ciclista (la luz lo sigue en render)
        Object.assign(this.dirLight.shadow.camera, {
            left: -SHADOW_EXTENT,
            right: SHADOW_EXTENT,
            top: SHADOW_EXTENT,
            bottom: -SHADOW_EXTENT,
            near: 1,
            far: SUN_DISTANCE * 2.2,
        });
        this.dirLight.shadow.camera.updateProjectionMatrix();
        this.dirLight.shadow.bias = -0.0004;
        this.dirLight.shadow.normalBias = 0.05;
        this.scene.add(this.dirLight);
        this.scene.add(this.dirLight.target);

        // Materiales de la carretera (compartidos por todos los tramos)
        const asphaltTextures = createAsphaltTextures();
        asphaltTextures.map.dispose(); // solo se aprovecha el relieve del grano; la pintura va aparte
        this.asphaltMaterial = new THREE.MeshStandardMaterial({
            color: 0x555555,
            roughness: 0.9,
            metalness: 0,
            bumpMap: asphaltTextures.bumpMap,
            bumpScale: 0.4,
            polygonOffset: true,
            polygonOffsetFactor: -1,
            polygonOffsetUnits: -1,
        });
        this.shoulderMaterial = new THREE.MeshStandardMaterial({ map: createGravelTexture(), roughness: 1, metalness: 0 });
        const markingOptions = { roughness: 0.8, metalness: 0, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 };
        this.centerLineMaterial = new THREE.MeshStandardMaterial({ color: 0xffffff, ...markingOptions });
        this.edgeLineMaterial = new THREE.MeshStandardMaterial({ color: 0xffffff, ...markingOptions });

        // Terreno con relieve y decorado: ambos siguen al ciclista y se apoyan en la ruta
        this.terrain = new RideTerrain(this.scene);
        this.decor = new RideDecor(this.scene, this.terrain);

        // Un solo ciclista en toda la app: el mismo modelo procedural que la expedición
        // Jugador y fantasma llevan el avatar con malla real; los rivales, el ciclista procedural (50 mallas
        // skinned de 114 huesos serían demasiadas). Si el avatar aún se está descargando, se parte del
        // procedural y se sustituye de golpe (en un solo frame) cuando llega.
        this.player = createCyclist({ accent: PLAYER_JERSEY, ghost: false, ...this.riderOptions });
        this.player.group.scale.setScalar(RIDER_SCALE);
        this.scene.add(this.player.group);
        if (!isRiderAvatarReady()) {
            preloadRiderAvatar().then((ready) => {
                if (ready && this.scene && getCyclistStyle().avatar) this.upgradeRidersToAvatar();
            });
        }

        this.applyWorldConfig(DEFAULT_WORLD);

        window.addEventListener('resize', this._boundOnResize);
    }

    /**
     * Sustituir de golpe el ciclista del jugador (y el fantasma, si existe) por su versión con avatar,
     * conservando posición, orientación y fase del pedaleo para que no haya salto visible.
     */
    upgradeRidersToAvatar() {
        const rebuild = (old, build) => {
            const next = build();
            next.group.position.copy(old.group.position);
            next.group.quaternion.copy(old.group.quaternion);
            next.group.scale.copy(old.group.scale);
            next.group.visible = old.group.visible;
            next.crankAngle = old.crankAngle;
            next.wheelAngle = old.wheelAngle;
            this.scene.add(next.group);
            disposeCyclist(old);
            return next;
        };
        if (this.player && !this.player.avatar) {
            this.player = rebuild(this.player, () => createCyclist({ accent: PLAYER_JERSEY, ghost: false, ...this.riderOptions }));
        }
        if (this.ghostRider && !this.ghostRider.avatar) {
            this.ghostRider = rebuild(this.ghostRider, () => createCyclist({ accent: GHOST_JERSEY, ghost: true, position: this.riderOptions.position }));
        }
    }

    /**
     * Construir la carretera a partir de state.route.points
     * Crea la curva (CatmullRom con elevación absoluta), el índice del terreno y el decorado;
     * la geometría de la carretera se genera por tramos (ver updateRoadChunks)
     * @param {Array} points - Puntos de la ruta
     * @param {number} totalLength - Longitud total de la ruta
     * @param {Object} worldConfig - Configuración del mundo (opcional)
     */
    generateRoadGeometry(points, totalLength, worldConfig = null) {
        if (worldConfig) this.applyWorldConfig(worldConfig);
        this.disposeRoadChunks();

        this.roadPoints = points;
        // Siempre se coloca la cámara directamente: la cota es absoluta y partir del origen sería un barrido enorme
        this.snapCamera = true;

        // Curva prolongada antes de la salida y después de la meta (ver RouteCurve.js)
        const routeCurve = buildRouteCurve(points, totalLength);
        if (!routeCurve) {
            this.routeCurve = null;
            this.roadCurve = null;
            return;
        }

        this.routeCurve = routeCurve;
        this.horizontalPath = routeCurve.horizontalPath;
        this.roadCurve = routeCurve.curve;
        this.curveLength = routeCurve.curveLength;
        this.generatedRouteLength = totalLength;
        this.roadChunksNeedFull = true;

        this.terrain.setRoute(routeCurve.threePoints);
        this.decor.setRoute({ curve: this.roadCurve, length: this.curveLength, seed: this.routeSeed });
    }

    /**
     * Parámetro de longitud de arco (0..1) de la curva para una distancia de ruta.
     * Única conversión distancia -> curva: jugador, bots, fantasma y cámara pasan por aquí.
     */
    curveU(distance) {
        return this.routeCurve.distanceToU(distance);
    }

    /** Metros de arco desde el inicio de la curva extendida (tramos de carretera y decorado) */
    curveMeters(distance) {
        return this.routeCurve.distanceToMeters(distance);
    }

    /**
     * Construir el tramo `index` de la carretera: arcén de grava, asfalto y pintura
     * @returns {{meshes: THREE.Mesh[]}|null}
     */
    buildRoadChunk(index) {
        const length = this.curveLength;
        const t0 = (index * CHUNK_LENGTH) / length;
        const t1 = Math.min(1, ((index + 1) * CHUNK_LENGTH) / length);
        if (!(t1 > t0)) return null;
        const tRange = [t0, t1];
        const curve = this.roadCurve;
        const meshes = [];

        // Arcén: baja hacia el terreno por los bordes (la parte central queda tapada por el asfalto)
        meshes.push(createProfileRibbon(curve, {
            profile: [
                [-SHOULDER_HALF_WIDTH, -0.3],
                [-(ASPHALT_HALF_WIDTH - 0.2), -0.03],
                [ASPHALT_HALF_WIDTH - 0.2, -0.03],
                [SHOULDER_HALF_WIDTH, -0.3],
            ],
            material: this.shoulderMaterial,
            tileMeters: SHOULDER_HALF_WIDTH,
            uSpan: SHOULDER_HALF_WIDTH,
            tRange,
            segmentLength: ROAD_SEGMENT_LENGTH,
        }));

        meshes.push(createProfileRibbon(curve, {
            profile: [[-ASPHALT_HALF_WIDTH, 0], [ASPHALT_HALF_WIDTH, 0]],
            material: this.asphaltMaterial,
            tileMeters: ASPHALT_HALF_WIDTH * 2,
            lift: ROAD_CLEARANCE,
            tRange,
            segmentLength: ROAD_SEGMENT_LENGTH,
        }));

        // Línea central discontinua y bordes continuos
        const center = createMarkingGeometry(curve, length, tRange, [[-0.09, 0.09]], true);
        if (center) meshes.push(new THREE.Mesh(center, this.centerLineMaterial));
        const edges = createMarkingGeometry(curve, length, tRange, [
            [-(ASPHALT_HALF_WIDTH - 0.2), -(ASPHALT_HALF_WIDTH - 0.34)],
            [ASPHALT_HALF_WIDTH - 0.34, ASPHALT_HALF_WIDTH - 0.2],
        ], false);
        if (edges) meshes.push(new THREE.Mesh(edges, this.edgeLineMaterial));

        for (const mesh of meshes) {
            mesh.receiveShadow = true;
            this.scene.add(mesh);
        }
        return { meshes };
    }

    disposeRoadChunk(chunk) {
        for (const mesh of chunk.meshes) {
            this.scene?.remove(mesh);
            mesh.geometry.dispose();
        }
    }

    disposeRoadChunks() {
        for (const chunk of this.roadChunks.values()) this.disposeRoadChunk(chunk);
        this.roadChunks.clear();
    }

    /**
     * Mantiene la ventana de tramos de carretera alrededor del ciclista.
     * Normalmente construye como mucho un tramo por frame; con `full` construye todos los pendientes.
     * @param {number} curveMeters - Posición del ciclista en metros de arco de la curva (curveMeters)
     * @param {boolean} full
     */
    updateRoadChunks(curveMeters, full = false) {
        if (!this.roadCurve || !(this.curveLength > 0)) return;
        const lastChunk = Math.max(0, Math.ceil(this.curveLength / CHUNK_LENGTH) - 1);
        const current = Math.min(lastChunk, Math.max(0, Math.floor(curveMeters / CHUNK_LENGTH)));
        const from = Math.max(0, current - CHUNKS_BEHIND);
        const to = Math.min(lastChunk, current + CHUNKS_AHEAD);

        for (const [index, chunk] of this.roadChunks) {
            if (index < from || index > to) {
                this.disposeRoadChunk(chunk);
                this.roadChunks.delete(index);
            }
        }

        let budget = full ? Infinity : 1;
        for (let index = from; index <= to && budget > 0; index++) {
            if (this.roadChunks.has(index)) continue;
            const chunk = this.buildRoadChunk(index);
            if (chunk) this.roadChunks.set(index, chunk);
            budget--;
        }
    }

    /**
     * Marcas de carretera (línea central y bordes): aplica los colores del mundo.
     * La geometría de la pintura se genera junto a cada tramo de carretera.
     * @param {number|string} roadColor - Color del asfalto del mundo (no cambia la pintura)
     * @param {Object} worldConfig
     */
    addRoadMarkings(roadColor, worldConfig) {
        const line = new THREE.Color(worldConfig?.roadColors?.line || 0xffffff);
        this.centerLineMaterial.color.copy(line);
        // Los bordes van en un tono más claro que la línea central para no competir con ella
        this.edgeLineMaterial.color.copy(line).lerp(new THREE.Color(0xffffff), 0.6);
    }

    /**
     * Aplicar configuración visual del mundo
     * @param {Object} worldConfig - Configuración del mundo
     */
    applyWorldConfig(worldConfig) {
        if (!worldConfig || this.currentWorldId === worldConfig.id) {
            return; // Ya está aplicada o no hay config
        }

        this.currentWorldId = worldConfig.id;
        this.currentWorld = worldConfig;

        const skyColors = worldConfig.skyColors || {};
        const ambient = worldConfig.ambient || {};
        const landscape = worldConfig.landscape || {};
        const roadColors = worldConfig.roadColors || {};

        // Cielo y niebla comparten color en el horizonte para que no se vea una costura
        this.zenithColor.set(skyColors.top || '#87ceeb');
        if (ambient.fog && ambient.fogColor) {
            this.horizonColor.set(ambient.fogColor);
        } else {
            this.horizonColor.set(skyColors.middle || '#e0f4ff').lerp(new THREE.Color(skyColors.horizon || '#98d8aa'), 0.35);
        }
        this.scene.background.copy(this.horizonColor);

        // Niebla lineal: legible a media distancia y cerrando el horizonte donde acaba el terreno (~580 m)
        const fogDensity = ambient.fog ? THREE.MathUtils.clamp(ambient.fogDensity || 0.2, 0, 0.6) : 0;
        const fogNear = ambient.fog ? 25 : 120;
        const fogFar = 600 * (1 - fogDensity * 0.9);
        this.scene.fog = new THREE.Fog(this.horizonColor.clone(), fogNear, fogFar);

        // Terreno y decorado según el paisaje del mundo
        const mountains = Array.isArray(landscape.mountains) ? landscape.mountains : [];
        const reliefScale = THREE.MathUtils.clamp(0.6 + (mountains[0]?.height ?? 0.15) * 3, 0.7, 1.8);
        this.terrain.setStyle({
            ground: landscape.groundColor || '#6f8a4c',
            shoulder: roadColors.shoulder || '#8b7355',
            reliefScale,
        });
        this.decor.setWorld(worldConfig);

        // Carretera: el color del asfalto se mezcla con blanco porque la textura de grano ya lo oscurece
        const roadColor = roadColors.main || 0x333333;
        this.asphaltMaterial.color.set(0xffffff).lerp(new THREE.Color(roadColor), 0.9);
        this.shoulderMaterial.color.set(0xffffff).lerp(new THREE.Color(roadColors.shoulder || '#8b7355'), 0.6);
        this.addRoadMarkings(roadColor, worldConfig);

        this.adjustLightingForTimeOfDay(worldConfig.timeOfDay || 'afternoon', landscape.groundColor);
    }

    /**
     * Ajustar iluminación y cielo según hora del día (morning, afternoon, sunset, night)
     */
    adjustLightingForTimeOfDay(timeOfDay, groundColor = '#3d4a33') {
        const preset = LIGHTING[timeOfDay] || LIGHTING.afternoon;
        this.dirLight.intensity = preset.sun;
        this.dirLight.color.set(preset.sunColor);
        this.hemiLight.intensity = preset.hemi;
        this.hemiLight.color.set(preset.hemiSky);
        // El rebote del suelo toma el color del paisaje, oscurecido
        this.hemiLight.groundColor.set(groundColor).multiplyScalar(timeOfDay === 'night' ? 0.15 : 0.4);

        const direction = new THREE.Vector3(...preset.direction).normalize();
        this.sunOffset.copy(direction).multiplyScalar(SUN_DISTANCE);

        const uniforms = this.skyDome.material.uniforms;
        // De noche el disco solar queda bajo el horizonte
        uniforms.sunDirection.value.copy(direction);
        if (timeOfDay === 'night') uniforms.sunDirection.value.set(-0.3, -0.2, 0.5).normalize();
        uniforms.cloudCover.value = preset.clouds;
    }

    /**
     * Cambiar el color de la bici del jugador (hex, id de BIKE_PAINTS o color CSS)
     */
    setRiderBikeColor(color) {
        this.riderOptions.bikeColor = color;
        this.player?.setBikeColor(color);
    }
    
    /**
     * Cambiar la posición del jugador sobre la bici ('hoods' | 'drops' | 'aero')
     */
    setRiderPosition(position) {
        this.riderOptions.position = position;
        this.player?.setPosition(position);
    }
    
    /**
     * Crear (o reutilizar) el ciclista de un bot: color de maillot del bot, bici y postura repartidas por su id
     * @param {Object} bot - Datos del bot
     * @returns {Object} - Ciclista (Cyclist.js)
     */
    getOrCreateBotRider(bot) {
        if (this.botRiders.has(bot.id)) {
            return this.botRiders.get(bot.id);
        }
        
        const hash = hashId(bot.id);
        const rider = createCyclist({
            accent: new THREE.Color(bot.color || '#00aaff').getHex(),
            ghost: false,
            style: { ...getCyclistStyle(), avatar: false }, // los rivales siempre procedurales (coste)
            bikeColor: BIKE_PAINTS[hash % BIKE_PAINTS.length].color,
            position: hash % 3 === 0 ? 'drops' : 'hoods',
        });
        rider.crankAngle = (hash % 628) / 100; // Fase distinta para que no pedaleen al unísono
        rider.cadence = 80 + (hash % 15);
        rider.wheelAngle = 0;
        this.scene.add(rider.group);
        this.botRiders.set(bot.id, rider);
        
        return rider;
    }
    
    /**
     * Colocar (o crear) el fantasma en su distancia sobre la ruta; null lo oculta
     * @param {number|null} distance - Distancia del fantasma en metros
     * @param {number} speed - Velocidad aproximada del fantasma en m/s (para girar sus ruedas)
     */
    updateGhost(distance, speed = 0) {
        if (distance === null || distance === undefined || !this.roadCurve) {
            if (this.ghostRider) this.ghostRider.group.visible = false;
            return;
        }
        if (!this.ghostRider) {
            // Conserva su look semitransparente azul claro (opción ghost del ciclista)
            this.ghostRider = createCyclist({ accent: GHOST_JERSEY, ghost: true, position: this.riderOptions.position });
            this.ghostRider.group.scale.setScalar(RIDER_SCALE * 0.96);
            this.ghostRider.wheelAngle = 0;
            this.scene.add(this.ghostRider.group);
        }
        
        const t = this.curveU(distance);
        const position = this.roadCurve.getPointAt(t);
        const tangent = this.roadCurve.getTangentAt(t).clone().normalize();
        
        const ghost = this.ghostRider;
        ghost.group.visible = true;
        ghost.group.position.copy(position);
        ghost.group.position.y = position.y + ROAD_CLEARANCE;
        ghost.group.lookAt(position.clone().add(tangent));
        this.pedalRider(ghost, GHOST_CADENCE, speed);
    }
    
    /**
     * Avanzar el pedaleo y el giro de ruedas de un ciclista según la cadencia (rpm) y la velocidad (m/s)
     */
    pedalRider(rider, cadence, speed) {
        const dt = this.frameDelta;
        rider.crankAngle = (rider.crankAngle + dt * (cadence / 60) * TWO_PI) % (TWO_PI * 1000);
        rider.wheelAngle = ((rider.wheelAngle || 0) + dt * (speed / BIKE.wheelRadius)) % (TWO_PI * 1000);
        animateCyclist(rider, rider.crankAngle, speed, 0.5, cadence > 0, rider.wheelAngle);
    }
    
    /**
     * Quitar el fantasma de la escena
     */
    clearGhost() {
        if (!this.ghostRider) return;
        disposeCyclist(this.ghostRider);
        this.ghostRider = null;
    }
    
    /**
     * Actualizar posiciones de los bots
     * @param {Array} bots - Array de bots visibles
     * @param {number} playerDistance - Distancia del jugador
     */
    updateBots(bots, playerDistance) {
        if (!this.roadCurve || !bots) return;
        
        // Set de IDs de bots activos
        const activeBotIds = new Set(bots.map(b => b.id));
        
        // Ocultar bots que ya no están visibles
        for (const [id, rider] of this.botRiders) {
            if (!activeBotIds.has(id)) {
                rider.group.visible = false;
            }
        }
        
        // Actualizar o crear meshes para bots visibles
        for (const bot of bots) {
            if (!bot.visible) continue;
            
            const rider = this.getOrCreateBotRider(bot);
            const mesh = rider.group;
            mesh.visible = true;
            
            // Calcular posición en la curva
            const t = this.curveU(bot.distance);
            const position = this.roadCurve.getPointAt(t);
            const tangent = this.roadCurve.getTangentAt(t).clone().normalize();
            
            // Posicionar el bot
            mesh.position.copy(position);
            mesh.position.y = position.y + ROAD_CLEARANCE; // Ligeramente sobre la carretera
            
            // Orientar hacia la dirección de movimiento
            const lookAtPoint = position.clone().add(tangent);
            mesh.lookAt(lookAtPoint);
            
            // Escalar según distancia (perspectiva)
            const scale = bot.scale || 1;
            mesh.scale.setScalar(RIDER_SCALE * scale);
            
            // Pedaleo: cadencia propia del bot y ruedas según su velocidad
            this.pedalRider(rider, rider.cadence, bot.speed || 0);
        }
    }
    
    /**
     * Limpiar meshes de bots
     */
    clearBots() {
        for (const rider of this.botRiders.values()) {
            disposeCyclist(rider);
        }
        this.botRiders.clear();
    }

    /**
     * Renderizar un frame
     * @param {Object} state - Estado del RideEngine (position.distance, route.points, route.length, status)
     * @param {Object} worldConfig - Configuración del mundo (opcional)
     */
    render(state, worldConfig) {
        // Aplicar configuración del mundo si cambió
        if (worldConfig) {
            this.applyWorldConfig(worldConfig);
        }
        
        const points = state.route?.points || [];
        const totalLength = state.route?.length || 0;

        if (points.length > 0 && totalLength > 0) {
            const needBuild = !this.roadCurve
                || this.generatedRouteLength !== totalLength
                || this.roadPoints !== points;
            if (needBuild) {
                // Semilla del decorado: misma ruta y mundo -> mismo paisaje siempre
                const worldId = worldConfig?.id ?? this.currentWorldId ?? '';
                this.routeSeed = hashId(`${state.route?.id ?? state.route?.name ?? ''}|${worldId}|${totalLength}|${points.length}`);
                this.generateRoadGeometry(points, totalLength, worldConfig);
            }
        }

        if (!this.roadCurve) {
            this.renderer.render(this.scene, this.camera);
            return;
        }

        // Tiempo entre frames para el pedaleo (acotado: tras una pausa de pestaña no da un salto)
        const now = performance.now();
        this.frameDelta = this.lastFrameTime ? Math.min(0.1, (now - this.lastFrameTime) / 1000) : 0;
        this.lastFrameTime = now;

        const rawDistance = state.position?.distance;
        const distance = Number.isFinite(rawDistance) ? rawDistance : 0;
        const t = this.curveU(distance);
        const currentGrade = state.currentGrade || 0;

        const position = this.roadCurve.getPointAt(t);
        const tangent = this.roadCurve.getTangentAt(t).clone().normalize();
        
        // Calcular posición del ciclista sobre la carretera
        const bikePosition = position.clone();
        bikePosition.y += 0.5; // Elevar ciclista para que esté sobre el asfalto

        if (this.player) {
            // El ciclista apoya las ruedas sobre el asfalto; la cámara sigue usando bikePosition
            this.player.group.position.copy(position);
            this.player.group.position.y = position.y + ROAD_CLEARANCE;
            this.player.group.lookAt(position.clone().add(tangent));
            
            // Cadencia del rodillo (si no hay sensor pero hay potencia, pedaleo estimado) y velocidad calculada
            const bikeData = state.bikeData || {};
            const cadence = bikeData.cadence > 0 ? bikeData.cadence : (bikeData.power > 0 ? 70 : 0);
            this.pedalRider(this.player, cadence, state.position?.speed || 0);
        }

        // Ajustar cámara según pendiente - más lejos en rampas
        const gradeAbs = Math.abs(currentGrade);
        const cameraDistance = 10 + gradeAbs * 0.3; // Más lejos en pendientes fuertes
        const cameraHeight = 4 + gradeAbs * 0.15; // Más alto en pendientes
        
        // Offset lateral ligeramente a la izquierda para ver mejor al ciclista
        const perpendicular = new THREE.Vector3(-tangent.z, 0, tangent.x).normalize();
        const lateralOffset = perpendicular.multiplyScalar(1.5);
        
        const cameraOffset = tangent.clone().multiplyScalar(-cameraDistance)
            .add(new THREE.Vector3(0, cameraHeight, 0))
            .add(lateralOffset);
        const cameraPos = bikePosition.clone().add(cameraOffset);

        // Escenario: terreno, decorado y carretera acompañan al ciclista (la cota de la ruta es absoluta)
        // Tras construir una ruta se genera la ventana completa de golpe; después, un tramo por frame
        const curveMeters = this.curveMeters(distance);
        this.updateRoadChunks(curveMeters, this.roadChunksNeedFull);
        this.roadChunksNeedFull = false;
        this.terrain.update(position.x, position.z);
        this.decor.update(curveMeters);

        // La cámara nunca queda bajo el terreno (crestas, bajadas fuertes)
        const minCameraY = this.terrain.heightAt(cameraPos.x, cameraPos.z) + 1.0;
        if (cameraPos.y < minCameraY) cameraPos.y = minCameraY;

        // Seguimiento suave independiente de los fps; si hay un salto grande (reinicio) se coloca directamente
        const followFactor = 1 - Math.exp(-3.6 * (this.frameDelta || 1 / 60));
        if (this.snapCamera || this.camera.position.distanceToSquared(cameraPos) > 40 * 40) {
            this.camera.position.copy(cameraPos);
            this.snapCamera = false;
        } else {
            this.camera.position.lerp(cameraPos, followFactor);
        }
        const groundUnderCamera = this.terrain.heightAt(this.camera.position.x, this.camera.position.z) + 0.8;
        if (this.camera.position.y < groundUnderCamera) this.camera.position.y = groundUnderCamera;

        // Cielo pegado a la cámara y sombra direccional centrada en el ciclista
        this.skyTime += this.frameDelta;
        this.skyDome.position.copy(this.camera.position);
        this.skyDome.material.uniforms.time.value = this.skyTime;
        this.dirLight.target.position.copy(position);
        this.dirLight.position.copy(position).add(this.sunOffset);

        this.camera.lookAt(bikePosition.clone().add(new THREE.Vector3(0, 1.0, 0)));
        
        // Actualizar bots
        if (state.bots && state.bots.length > 0) {
            this.updateBots(state.bots, distance);
        }
        
        // Fantasma de un ride pasado
        this.updateGhost(state.ghost ? state.ghost.distance : null, state.position?.speed || 0);

        this.renderer.render(this.scene, this.camera);
    }

    onResize() {
        const parent = this.canvas.parentElement;
        if (!parent) return;
        const w = parent.clientWidth;
        const h = parent.clientHeight;
        this.renderer.setSize(w, h);
        this.camera.aspect = w / h;
        this.camera.updateProjectionMatrix();
    }

    destroy() {
        window.removeEventListener('resize', this._boundOnResize);
        
        // Limpiar bots y fantasma
        this.clearBots();
        this.clearGhost();
        
        this.disposeRoadChunks();
        this.terrain?.dispose();
        this.decor?.dispose();
        this.terrain = null;
        this.decor = null;
        if (this.skyDome) {
            this.scene.remove(this.skyDome);
            this.skyDome.geometry.dispose();
            this.skyDome.material.dispose();
            this.skyDome = null;
        }
        this.asphaltMaterial?.bumpMap?.dispose();
        this.shoulderMaterial?.map?.dispose();
        for (const material of [this.asphaltMaterial, this.shoulderMaterial, this.centerLineMaterial, this.edgeLineMaterial]) {
            material?.dispose();
        }
        this.dirLight?.shadow.map?.dispose();
        if (this.player) {
            disposeCyclist(this.player);
            this.player = null;
        }
        this.renderer.dispose();
        this.scene = null;
        this.camera = null;
        this.renderer = null;
    }
}

/**
 * Factory para compatibilidad con createRideRenderer(canvas)
 */
export function createRideRenderer3D(canvas, options) {
    return new RideRenderer3D(canvas, options);
}
