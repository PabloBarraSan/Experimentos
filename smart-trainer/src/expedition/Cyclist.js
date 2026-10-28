/**
 * Ciclista de carretera low-poly con proporciones realistas: cabeza pequeña, torso esbelto, piernas largas,
 * casco aerodinámico, gafas, maillot con diseño, culotte con tirantes y una bici de tubos finos.
 * Se lee bien desde la cámara en el jugador, el ghost y el pelotón.
 *
 * Se modela en metros (z+ = delante, y+ = arriba). El renderer lo amplía con RIDER_SCALE.
 *
 * Rendimiento: las geometrías son compartidas entre instancias (marcadas con userData.shared) y las piezas
 * estáticas se fusionan por material, así que cada ciclista son unas 55 mallas. Los materiales neutros
 * también se comparten; solo son propios de cada ciclista el maillot, el detalle de color y la pintura de la bici.
 *
 * Personalización: createCyclist({ bikeColor, position }) o, después, rider.setBikeColor() / rider.setPosition().
 */

import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { createAvatarRig, isRiderAvatarReady } from './AvatarRider.js';
import { getBikeParts, isBikeModelReady } from './BikeModel.js';
import { getCyclistEnvMap } from './environmentMap.js';
import { getRiderPrefs } from '../storage/settings.js';

const Y_AXIS = new THREE.Vector3(0, 1, 0);
const X_AXIS = new THREE.Vector3(1, 0, 0);
const GHOST_COLOR = 0x8ed9ff;
const v = (x, y, z) => new THREE.Vector3(x, y, z);

export const BIKE = {
    wheelRadius: 0.335,
    bottomBracket: v(0, 0.27, 0),
    rearHub: v(0, 0.335, -0.41),
    frontHub: v(0, 0.335, 0.6),
    seatCluster: v(0, 0.88, -0.17),
    saddle: v(0, 0.945, -0.2),
    headTop: v(0, 0.93, 0.4),
    headBottom: v(0, 0.75, 0.435),
    crankLength: 0.172,
};

export const BODY = {
    thigh: 0.44,
    shin: 0.44,
    upperArm: 0.31,
    forearm: 0.29,
    hipHalfWidth: 0.085,
    hipHeight: 1.02,
    hipZ: -0.21,
};

// Los 8 colores de pintura de la bici.
export const BIKE_PAINTS = [
    { id: 'blue', name: 'Azul', color: 0x2f6fed },
    { id: 'red', name: 'Rojo', color: 0xd8343c },
    { id: 'green', name: 'Verde', color: 0x2f9e5b },
    { id: 'orange', name: 'Naranja', color: 0xf08a24 },
    { id: 'violet', name: 'Violeta', color: 0x8a55e0 },
    { id: 'white', name: 'Blanco', color: 0xf0f2f2 },
    { id: 'cyan', name: 'Cian', color: 0x22c3d6 },
    { id: 'black', name: 'Negro', color: 0x23282c },
];

// Posiciones sobre la bici. cda = área frontal * coeficiente aerodinámico orientativo (m²) para la física.
export const RIDER_POSITIONS = {
    hoods: { id: 'hoods', label: 'Manetas', cda: 0.36 },
    drops: { id: 'drops', label: 'Cuernos', cda: 0.32 },
    aero: { id: 'aero', label: 'Aero', cda: 0.27 },
};
export const DEFAULT_RIDER_POSITION = 'hoods';

// Manillar (lado derecho, x > 0; el izquierdo es su espejo). Una única definición alimenta la geometría
// y el agarre de las manos, así que las manos siempre quedan sobre el manillar, las manetas o las extensiones.
// Curva continua: barra superior -> codo de las manetas -> caída (drops) -> punta trasera.
const BAR_CURVE_POINTS = [
    [0.2, 0.97, 0.5],
    [0.203, 0.972, 0.55],
    [0.207, 0.969, 0.6],
    [0.21, 0.952, 0.642],
    [0.21, 0.918, 0.668],
    [0.21, 0.878, 0.668],
    [0.208, 0.846, 0.645],
    [0.205, 0.828, 0.605],
    [0.203, 0.826, 0.565],
];
const HOOD = { center: v(0.207, 0.978, 0.62), radii: [0.027, 0.033, 0.06], tilt: -0.22 };
// Extensiones de triatlón: del anclaje a la punta; el agarre es la goma de la parte delantera.
const AERO_BAR = { clamp: v(0.07, 0.975, 0.5), end: v(0.065, 1.0, 0.72), tip: v(0.065, 1.027, 0.778) };
// El codo descansa en un apoyo fijo de la bici (la pose aero fija el codo, no lo deja a la cinemática inversa).
const AERO_ELBOW = v(0.085, 1.032, 0.43);
const AERO_PAD_DROP = 0.042;

const barCurve = (side) => new THREE.CatmullRomCurve3(
    BAR_CURVE_POINTS.map(([x, y, z]) => v(side * x, y, z)),
    false,
    'centripetal',
);
const DROP_GRIP = barCurve(1).getPointAt(0.56);

// Geometría de cada posición. lean = inclinación del torso desde la vertical; neck y head = cabeceo (rad, hacia abajo)
// del cuello y de la cabeza en el mundo (la cabeza sigue mirando al frente); hand = centro del guante en el espacio
// de la bici (sobre el manillar); glove = cabeceo extra del guante; elbow = codo fijo (solo aero).
const POSES = {
    hoods: { lean: 0.9, neck: 0.52, head: 0.2, hand: HOOD.center.clone().add(v(0, 0.012, 0)), glove: 0.2, aero: false },
    drops: { lean: 1.08, neck: 0.66, head: 0.3, hand: DROP_GRIP.clone(), glove: 0.75, aero: false },
    aero: {
        lean: 1.2,
        neck: 0.8,
        head: 0.35,
        hand: AERO_BAR.clamp.clone().lerp(AERO_BAR.end, 0.75),
        glove: 0,
        elbow: AERO_ELBOW,
        aero: true,
    },
};

const PALETTE = {
    skin: 0xf0b48c,
    hair: 0x4a3226,
    shorts: 0x22282e,
    helmet: 0xf3f1ea,
    helmetVent: 0x1b2328,
    shoe: 0x20262b,
    sock: 0xffffff,
    glove: 0x30373c,
    rubber: 0x1b2024,
    tape: 0x2a3035,
    tire: 0x15191c,
    rim: 0x98a4a7,
    spoke: 0xc7d0d1,
    metal: 0xb8c2c4,
    bottle: 0xf2efe4,
};

const OUTLINE_COLOR = 0x1d2a2c;
// Grosores de contorno (en metros de vista): fino para tubos, normal para volúmenes.
const OUTLINE = { thin: 0.008, normal: 0.015, bold: 0.019 };

// Tres escalones de luz: lo que da el aspecto de dibujo animado.
let toonGradient = null;
function getToonGradient() {
    if (toonGradient) return toonGradient;
    toonGradient = new THREE.DataTexture(
        new Uint8Array([150, 150, 150, 255, 205, 205, 205, 255, 255, 255, 255, 255]),
        3,
        1,
        THREE.RGBAFormat,
    );
    toonGradient.minFilter = THREE.NearestFilter;
    toonGradient.magFilter = THREE.NearestFilter;
    toonGradient.needsUpdate = true;
    return toonGradient;
}

// Contorno por casco invertido: cada vértice se infla a lo largo de su normal en espacio de vista,
// así el grosor es el mismo en metros (más lejos = más fino) aunque el mesh esté escalado de forma no uniforme.
const outlineMaterials = new Map();
function getOutlineMaterial(thickness) {
    if (outlineMaterials.has(thickness)) return outlineMaterials.get(thickness);
    const material = new THREE.ShaderMaterial({
        side: THREE.BackSide,
        uniforms: { uThickness: { value: thickness }, uColor: { value: new THREE.Color(OUTLINE_COLOR) } },
        vertexShader: `
            uniform float uThickness;
            void main() {
                vec4 mv = modelViewMatrix * vec4(position, 1.0);
                vec3 vn = normalize(normalMatrix * normal);
                mv.xyz += vn * uThickness;
                gl_Position = projectionMatrix * mv;
            }`,
        fragmentShader: `
            uniform vec3 uColor;
            void main() { gl_FragColor = vec4(uColor, 1.0); }`,
    });
    material.userData.shared = true;
    outlineMaterials.set(thickness, material);
    return material;
}

const STYLE_KEY = 'smartTrainer_cyclistStyle';
// El avatar 3D (public/models/rider.glb) es la opción inicial; el ciclista procedural queda como respaldo y en el visor.
const DEFAULT_STYLE = { outline: false, shading: 'soft', avatar: true };

export function getCyclistStyle() {
    try {
        const saved = JSON.parse(localStorage.getItem(STYLE_KEY) || 'null');
        return {
            outline: typeof saved?.outline === 'boolean' ? saved.outline : DEFAULT_STYLE.outline,
            shading: saved?.shading === 'toon' ? 'toon' : DEFAULT_STYLE.shading,
            avatar: typeof saved?.avatar === 'boolean' ? saved.avatar : DEFAULT_STYLE.avatar,
        };
    } catch {
        return { ...DEFAULT_STYLE };
    }
}

export function saveCyclistStyle(style) {
    try {
        localStorage.setItem(STYLE_KEY, JSON.stringify({ outline: Boolean(style.outline), shading: style.shading === 'toon' ? 'toon' : 'soft', avatar: style.avatar !== false }));
    } catch {
        // Sin almacenamiento: el estilo solo dura lo que dure la pantalla.
    }
}

/** Preferencias de ciclista guardadas en los ajustes; si no hay almacenamiento, vacío. */
function readSavedRiderPrefs() {
    try {
        const prefs = getRiderPrefs() || {};
        return {
            bikeColor: prefs.bikeColor,
            position: POSES[prefs.position] ? prefs.position : undefined,
        };
    } catch {
        return {};
    }
}

/** Acepta un hex numérico, un id de BIKE_PAINTS o un color CSS; devuelve siempre un hex numérico. */
function resolveBikeColor(value) {
    if (typeof value === 'number') return value;
    const paint = BIKE_PAINTS.find((item) => item.id === value);
    if (paint) return paint.color;
    try {
        return new THREE.Color(value).getHex();
    } catch {
        return BIKE_PAINTS[0].color;
    }
}

// ---- Caché de geometrías y piezas fusionadas (compartidas entre ciclistas) ----

const geometryCache = new Map();
function sharedGeometry(key, build) {
    let geometry = geometryCache.get(key);
    if (!geometry) {
        geometry = build();
        geometry.userData.shared = true;
        geometryCache.set(key, geometry);
    }
    return geometry;
}

const unitSphere = () => sharedGeometry('sphere', () => new THREE.SphereGeometry(1, 12, 9));
// Cilindro unitario orientado por alignTube: la base (-y) es el inicio y la tapa (+y) el final.
const tubeGeometry = (startRadius, endRadius = startRadius) => sharedGeometry(
    `tube:${startRadius}:${endRadius}`,
    () => new THREE.CylinderGeometry(endRadius, startRadius, 1, 10, 1),
);

/**
 * Acumula primitivas ya colocadas y las fusiona en una sola geometría por material ("slot").
 * Así toda la bici estática o la cabeza son un puñado de mallas en lugar de decenas.
 */
class Baker {
    constructor() {
        this.parts = {};
        this.base = null;
    }

    push(slot, geometry) {
        geometry.deleteAttribute('uv');
        if (this.base) geometry.applyMatrix4(this.base);
        (this.parts[slot] ||= []).push(geometry);
        return this;
    }

    tube(slot, start, end, startRadius, endRadius = startRadius, radial = 8) {
        const geometry = new THREE.CylinderGeometry(endRadius, startRadius, 1, radial, 1);
        const direction = end.clone().sub(start);
        const length = Math.max(0.001, direction.length());
        geometry.scale(1, length, 1);
        geometry.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(Y_AXIS, direction.normalize()));
        geometry.translate(...start.clone().add(end).multiplyScalar(0.5).toArray());
        return this.push(slot, geometry);
    }

    // Perfil elíptico para los tubos de carbono, estrecho de frente y profundo de lado.
    aeroTube(slot, start, end, width, depth) {
        const geometry = new THREE.CylinderGeometry(1, 1, 1, 16, 1);
        const direction = end.clone().sub(start);
        geometry.scale(width / 2, direction.length(), depth / 2);
        geometry.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(Y_AXIS, direction.normalize()));
        geometry.translate(...start.clone().add(end).multiplyScalar(0.5).toArray());
        return this.push(slot, geometry);
    }

    blob(slot, center, radii, rotation = null) {
        const geometry = new THREE.SphereGeometry(1, 12, 9);
        geometry.scale(...radii);
        if (rotation) geometry.applyQuaternion(new THREE.Quaternion().setFromEuler(new THREE.Euler(...rotation)));
        geometry.translate(...center);
        return this.push(slot, geometry);
    }

    box(slot, center, size, rotationX = 0) {
        const geometry = new THREE.BoxGeometry(...size);
        geometry.rotateX(rotationX);
        geometry.translate(...center);
        return this.push(slot, geometry);
    }

    loft(slot, sections, radial = 16, shade = null) {
        return this.push(slot, createLoft(sections, radial, shade));
    }

    finish() {
        const result = {};
        Object.entries(this.parts).forEach(([slot, list]) => {
            result[slot] = mergeGeometries(list);
            result[slot].userData.shared = true;
            list.forEach((geometry) => geometry.dispose());
        });
        return result;
    }
}

const bakedCache = new Map();
function getBaked(key, build) {
    if (!bakedCache.has(key)) bakedCache.set(key, build());
    return bakedCache.get(key);
}

const loftSections = (list, zShift = () => 0) => list.map(({ y, width, depth }) => ({
    center: v(0, y, zShift(y)),
    width,
    depth,
}));

// ---- Cuadro, manillar, sillín y transmisión (todo lo que no se mueve respecto a la bici) ----
function buildBikeStatic() {
    const b = new Baker();
    const { bottomBracket: bb, rearHub, frontHub, seatCluster, saddle, headTop, headBottom } = BIKE;

    // Cuadro de carretera moderno con perfiles aerodinámicos y un detalle de color discreto.
    b.aeroTube('paint', bb, seatCluster, 0.038, 0.055);
    b.aeroTube('paint', seatCluster, headTop, 0.038, 0.047);
    b.aeroTube('paint', bb, headBottom, 0.052, 0.073);
    b.aeroTube('paint', headBottom, headTop, 0.048, 0.06);
    b.aeroTube('accent', bb.clone().lerp(headBottom, 0.3), bb.clone().lerp(headBottom, 0.68), 0.055, 0.076);
    b.tube('metal', seatCluster, v(0, 0.935, -0.198), 0.0125);
    for (const side of [-1, 1]) {
        b.tube('paint', v(side * 0.004, seatCluster.y, seatCluster.z), v(side * 0.055, rearHub.y, rearHub.z), 0.0085);
        b.tube('paint', v(side * 0.01, bb.y, bb.z), v(side * 0.055, rearHub.y, rearHub.z), 0.0095);
        b.tube('paint', v(side * 0.03, headBottom.y, headBottom.z), v(side * 0.048, frontHub.y, frontHub.z), 0.012);
    }
    b.blob('paint', [0, headBottom.y - 0.005, headBottom.z], [0.05, 0.02, 0.03]);

    // Potencia y manillar: barra superior de aluminio y curva continua con cinta (de la barra a las manetas y por
    // la caída hasta la punta). Las manetas se asientan sobre el codo de la curva, con su palanca de freno.
    b.tube('rubber', v(0, 0.935, 0.4), v(0, 0.968, 0.488), 0.016);
    b.tube('metal', v(-0.2, 0.97, 0.5), v(0.2, 0.97, 0.5), 0.0115);
    b.blob('metal', [0, 0.97, 0.5], [0.03, 0.022, 0.026]);
    for (const side of [-1, 1]) {
        const tube = new THREE.TubeGeometry(barCurve(side), 32, 0.0125, 8, false);
        b.push('tape', tube);
        const end = barCurve(side).getPointAt(1);
        b.blob('tape', end.toArray(), [0.0125, 0.0125, 0.0125]);
        const [hx, hy, hz] = HOOD.center.toArray();
        b.blob('rubber', [side * hx, hy, hz], HOOD.radii, [HOOD.tilt, 0, 0]);
        // Palanca de freno: baja desde la punta de la maneta, justo delante de la caída.
        b.tube('rubber', v(side * hx, hy - 0.012, hz + 0.05), v(side * hx, 0.885, 0.7), 0.0055, 0.0045);
    }

    // Sillín y raíles.
    b.blob('rubber', [0, 0.955, -0.215], [0.07, 0.022, 0.09], [-0.04, 0, 0]);
    b.blob('rubber', [0, 0.953, -0.125], [0.03, 0.016, 0.07], [-0.04, 0, 0]);
    for (const side of [-1, 1]) b.tube('metal', v(side * 0.025, 0.937, -0.285), v(side * 0.02, 0.937, -0.1), 0.003);

    // Bidón con su portabidón sobre el tubo diagonal.
    const downDirection = headBottom.clone().sub(bb).normalize();
    const upBack = v(0, downDirection.z, -downDirection.y).normalize();
    const downLength = headBottom.distanceTo(bb);
    const bottleStart = bb.clone().addScaledVector(downDirection, downLength * 0.3).addScaledVector(upBack, 0.052);
    const bottleEnd = bb.clone().addScaledVector(downDirection, downLength * 0.62).addScaledVector(upBack, 0.052);
    b.tube('bottle', bottleStart, bottleEnd, 0.03, 0.028);
    b.tube('rubber', bottleEnd, bottleEnd.clone().addScaledVector(downDirection, 0.03), 0.017, 0.012);
    b.tube('rubber', bb.clone().addScaledVector(downDirection, downLength * 0.28).addScaledVector(upBack, 0.03), bb.clone().addScaledVector(downDirection, downLength * 0.64).addScaledVector(upBack, 0.03), 0.006);

    // Cadena y cambio trasero.
    b.tube('rubber', v(0.045, 0.365, 0), v(0.045, 0.38, -0.41), 0.004);
    b.tube('rubber', v(0.045, 0.175, 0), v(0.045, 0.29, -0.41), 0.004);
    b.blob('rubber', [0.045, rearHub.y - 0.06, rearHub.z - 0.02], [0.012, 0.05, 0.025]);

    // Caja del pedalier y tija; las bielas y el plato se animan aparte.
    b.blob('metal', [0, bb.y, bb.z], [0.045, 0.026, 0.026]);
    b.blob('rubber', [0, saddle.y - 0.02, saddle.z], [0.012, 0.012, 0.012]);
    return b.finish();
}

// Extensiones de triatlón y apoyos de antebrazo (solo visibles en posición aero).
function buildAeroBars() {
    const b = new Baker();
    const { clamp, end, tip } = AERO_BAR;
    for (const side of [-1, 1]) {
        const m = (point) => v(side * point.x, point.y, point.z);
        b.tube('metal', m(clamp), m(end), 0.0125);
        b.tube('rubber', m(clamp.clone().lerp(end, 0.5)), m(end), 0.0165);
        b.tube('metal', m(end), m(tip), 0.011);
        b.blob('metal', m(end).toArray(), [0.011, 0.011, 0.011]);
        // Apoyo de antebrazo bajo el codo, atornillado al anclaje de la extensión.
        const pad = m(AERO_ELBOW).add(v(0, -AERO_PAD_DROP, 0));
        b.blob('rubber', pad.toArray(), [0.04, 0.012, 0.07]);
        b.tube('metal', pad.clone().add(v(0, -0.004, 0.02)), m(clamp), 0.008);
    }
    return b.finish();
}

// Piezas del mismo plato y piñón en el espacio de la rueda (eje x).
function buildWheelParts() {
    const tubeRadius = 0.017;
    const tire = new THREE.TorusGeometry(BIKE.wheelRadius - tubeRadius, tubeRadius, 8, 40);
    tire.rotateY(Math.PI / 2);
    tire.userData.shared = true;

    // Llanta con perfil: anillo de sección rectangular (alto 24 mm, ancho 22 mm).
    const rimInner = 0.265;
    const rimOuter = BIKE.wheelRadius - tubeRadius * 2 + 0.002;
    const rimProfile = [
        new THREE.Vector2(rimInner, -0.011), new THREE.Vector2(rimOuter, -0.011),
        new THREE.Vector2(rimOuter, 0.011), new THREE.Vector2(rimInner, 0.011),
        new THREE.Vector2(rimInner, -0.011),
    ];
    const makeRim = (rear) => {
        const b = new Baker();
        const rim = new THREE.LatheGeometry(rimProfile, 40);
        rim.rotateZ(Math.PI / 2);
        b.push('rim', rim);
        const hub = new THREE.CylinderGeometry(0.018, 0.018, 0.1, 10);
        hub.rotateZ(Math.PI / 2);
        b.push('rim', hub);
        // Disco de freno a la izquierda.
        const disc = new THREE.CylinderGeometry(0.075, 0.075, 0.003, 20);
        disc.rotateZ(Math.PI / 2);
        disc.translate(-0.045, 0, 0);
        b.push('rim', disc);
        if (rear) {
            const cassette = new THREE.CylinderGeometry(0.025, 0.045, 0.045, 12);
            cassette.rotateZ(-Math.PI / 2);
            cassette.translate(0.05, 0, 0);
            b.push('rim', cassette);
        }
        return b.finish().rim;
    };

    // Radios cruzados: de las bridas del buje a la llanta.
    const spokeCount = 20;
    const points = [];
    for (let index = 0; index < spokeCount; index += 1) {
        const rimAngle = (index / spokeCount) * Math.PI * 2;
        const hubAngle = rimAngle + (index % 4 < 2 ? 0.45 : -0.45);
        const flange = index % 2 === 0 ? 0.03 : -0.03;
        points.push(
            flange, Math.cos(hubAngle) * 0.026, Math.sin(hubAngle) * 0.026,
            0, Math.cos(rimAngle) * (rimInner + 0.002), Math.sin(rimAngle) * (rimInner + 0.002),
        );
    }
    const spokes = new THREE.BufferGeometry();
    spokes.setAttribute('position', new THREE.Float32BufferAttribute(points, 3));
    spokes.userData.shared = true;
    return { tire, rimFront: makeRim(false), rimRear: makeRim(true), spokes };
}

// Plato con brazos (gira con la cadencia); el eje es x y se desplaza al lado de la transmisión.
function buildChainring() {
    const b = new Baker();
    const ring = new THREE.LatheGeometry([
        new THREE.Vector2(0.075, -0.003), new THREE.Vector2(0.098, -0.003),
        new THREE.Vector2(0.098, 0.003), new THREE.Vector2(0.075, 0.003), new THREE.Vector2(0.075, -0.003),
    ], 24);
    ring.rotateZ(Math.PI / 2);
    ring.translate(0.045, 0, 0);
    b.push('metal', ring);
    for (let index = 0; index < 5; index += 1) {
        const arm = new THREE.BoxGeometry(0.006, 0.07, 0.014);
        arm.translate(0, 0.04, 0);
        arm.rotateX((index / 5) * Math.PI * 2);
        arm.translate(0.045, 0, 0);
        b.push('metal', arm);
    }
    return b.finish().metal;
}

// ---- Cuerpo en el espacio del torso (origen en la pelvis, y a lo largo de la espalda, z hacia el pecho) ----
const NECK_BASE = v(0, 0.575, 0.01);
const SHOULDER_Y = 0.48;
const SHOULDER_X = 0.185;

const jerseyArch = (y) => -0.012 * Math.sin(Math.PI * (y / 0.58));
const JERSEY_SECTIONS = [
    { y: 0.03, width: 0.3, depth: 0.2 },
    { y: 0.16, width: 0.29, depth: 0.2 },
    { y: 0.28, width: 0.28, depth: 0.2 },
    { y: 0.4, width: 0.335, depth: 0.22 },
    { y: 0.48, width: 0.385, depth: 0.19 },
    { y: 0.54, width: 0.3, depth: 0.14 },
    { y: 0.575, width: 0.13, depth: 0.11 },
];

// Sombreado por vértice del maillot: más oscuro en el bajo, en el pliegue de la cintura y en los costados;
// da volumen sin coste extra (el color se multiplica con el del material). angle: 0 = costado, PI/2 = pecho.
function jerseyShade(y, angle) {
    const t = THREE.MathUtils.smoothstep(y, 0.05, 0.5);
    const crease = 0.1 * Math.exp(-(((y - 0.16) / 0.05) ** 2));
    const side = 0.1 * Math.cos(angle) ** 2;
    const back = 0.06 * Math.max(0, -Math.sin(angle));
    return THREE.MathUtils.clamp(0.8 + 0.2 * t - crease - side - back, 0.5, 1);
}

// Interpola ancho y profundidad del tronco a una altura dada (mismo perfil lineal que el loft).
function jerseySectionAt(y) {
    for (let index = 0; index < JERSEY_SECTIONS.length - 1; index += 1) {
        const a = JERSEY_SECTIONS[index];
        const c = JERSEY_SECTIONS[index + 1];
        if (y >= a.y && y <= c.y) {
            const t = (y - a.y) / (c.y - a.y);
            return { width: a.width + (c.width - a.width) * t, depth: a.depth + (c.depth - a.depth) * t };
        }
    }
    return JERSEY_SECTIONS[JERSEY_SECTIONS.length - 1];
}

// Bolsillo trasero: parche fino que copia la superficie elíptica del maillot (sobresale solo `lift` metros),
// con color de vértice más oscuro que el maillot.
function createPocketPatch(centerX, yMin, yMax, halfWidth, lift = 0.004, shade = 0.58) {
    const cols = 4;
    const rows = 3;
    const positions = [];
    const colors = [];
    const outward = [];
    for (let row = 0; row <= rows; row += 1) {
        const y = yMin + ((yMax - yMin) * row) / rows;
        const { width, depth } = jerseySectionAt(y);
        const a = width / 2;
        const c = depth / 2;
        for (let col = 0; col <= cols; col += 1) {
            const x = centerX - halfWidth + ((2 * halfWidth) * col) / cols;
            const k = Math.sqrt(Math.max(0, 1 - (x / a) ** 2));
            const normal = v(x / (a * a), 0, -k / c).normalize();
            positions.push(x + normal.x * lift, y, jerseyArch(y) - c * k + normal.z * lift);
            colors.push(shade, shade, shade);
            outward.push(normal);
        }
    }
    const indices = [];
    for (let row = 0; row < rows; row += 1) {
        for (let col = 0; col < cols; col += 1) {
            const i = row * (cols + 1) + col;
            indices.push(i, i + 1, i + cols + 1, i + 1, i + cols + 2, i + cols + 1);
        }
    }
    // Garantiza que la cara visible mire hacia fuera (la espalda es -z).
    const pa = v(positions[indices[0] * 3], positions[indices[0] * 3 + 1], positions[indices[0] * 3 + 2]);
    const pb = v(positions[indices[1] * 3], positions[indices[1] * 3 + 1], positions[indices[1] * 3 + 2]);
    const pc = v(positions[indices[2] * 3], positions[indices[2] * 3 + 1], positions[indices[2] * 3 + 2]);
    const face = pb.sub(pa).cross(pc.sub(pa));
    if (face.dot(outward[indices[0]]) < 0) {
        for (let index = 0; index < indices.length; index += 3) [indices[index + 1], indices[index + 2]] = [indices[index + 2], indices[index + 1]];
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('normal', new THREE.Float32BufferAttribute(outward.flatMap((n) => [n.x, n.y, n.z]), 3));
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    geometry.setIndex(indices);
    return geometry;
}

function buildTorsoParts() {
    const b = new Baker();
    // Cintura marcada, caja torácica y hombros: esbelto, sin barriga.
    b.loft('jersey', loftSections(JERSEY_SECTIONS, jerseyArch), 18, jerseyShade);
    // Diseño: canesú de hombros y franja en el bajo con el color secundario, cremallera y tres bolsillos
    // traseros pegados al maillot (en un tono oscuro del propio maillot).
    b.loft('jerseySec', loftSections([
        { y: 0.41, width: 0.34, depth: 0.226 },
        { y: 0.48, width: 0.392, depth: 0.196 },
        { y: 0.535, width: 0.31, depth: 0.15 },
    ], jerseyArch), 18, jerseyShade);
    b.loft('jerseySec', loftSections([
        { y: 0.028, width: 0.306, depth: 0.206 },
        { y: 0.1, width: 0.298, depth: 0.204 },
    ], jerseyArch), 18, jerseyShade);
    for (const x of [-0.085, 0, 0.085]) b.push('jersey', createPocketPatch(x, 0.17, 0.25, 0.031));
    b.tube('zip', v(0, 0.3, 0.1), v(0, 0.55, 0.073), 0.004);
    return b.finish();
}

// Culotte con una silueta continua sobre el sillín.
function buildHipsParts() {
    const b = new Baker();
    b.blob('shorts', [0, 0, 0], [0.14, 0.09, 0.105]);
    return b.finish();
}

// Cabeza pequeña, casco aerodinámico con ventilaciones, gafas y correas (origen en el centro de la cabeza).
function buildHeadParts() {
    const b = new Baker();
    b.blob('skin', [0, 0, 0], [0.072, 0.1, 0.088]);
    b.blob('skin', [0, -0.008, 0.083], [0.009, 0.014, 0.009], [0.3, 0, 0]);
    for (const side of [-1, 1]) b.blob('skin', [side * 0.073, -0.005, -0.012], [0.01, 0.02, 0.016]);
    // Pelo que asoma bajo el casco: nuca y patillas.
    b.blob('hair', [0, -0.025, -0.067], [0.06, 0.033, 0.022]);
    for (const side of [-1, 1]) b.blob('hair', [side * 0.068, -0.015, -0.02], [0.008, 0.022, 0.014]);

    // Gafas envolventes: dos lentes, puente y patillas.
    for (const side of [-1, 1]) {
        b.blob('glasses', [side * 0.032, 0.012, 0.08], [0.032, 0.02, 0.012], [0, side * 0.3, 0]);
        b.tube('glasses', v(side * 0.062, 0.01, 0.07), v(side * 0.075, 0.005, -0.02), 0.003);
    }
    b.blob('glasses', [0, 0.016, 0.088], [0.01, 0.004, 0.006]);

    // Casco: cúpula alargada con cola; el perfil va de la frente a la cola (z hacia delante, y arriba).
    const scale = 0.62;
    const profile = [
        { z: 0.215, y: -0.005, w: 0.15, h: 0.09 },
        { z: 0.15, y: 0.02, w: 0.245, h: 0.165 },
        { z: 0.05, y: 0.036, w: 0.28, h: 0.215 },
        { z: -0.06, y: 0.034, w: 0.268, h: 0.215 },
        { z: -0.17, y: 0.018, w: 0.21, h: 0.17 },
        { z: -0.23, y: -0.004, w: 0.15, h: 0.11 },
        { z: -0.27, y: -0.022, w: 0.06, h: 0.045 },
    ].map(({ z, y, w, h }) => ({ z: z * scale, y: y * scale, w: w * scale, h: h * scale }));
    const topY = (x, z) => {
        for (let index = 0; index < profile.length - 1; index += 1) {
            const a = profile[index];
            const c = profile[index + 1];
            if (z <= a.z && z >= c.z) {
                const t = (a.z - z) / (a.z - c.z);
                const lerp = (key) => a[key] + (c[key] - a[key]) * t;
                const across = Math.min(Math.abs(x) / (lerp('w') / 2), 0.98);
                return lerp('y') + (lerp('h') / 2) * Math.sqrt(1 - across * across);
            }
        }
        return 0;
    };
    b.base = new THREE.Matrix4().makeTranslation(0, 0.04, -0.012).multiply(new THREE.Matrix4().makeRotationX(-0.06));
    b.loft('helmet', profile.map(({ z, y, w, h }) => ({ center: v(0, y, z), width: w, depth: h })), 20);
    for (const z of [0.085, -0.035, -0.15]) {
        for (const x of [-0.05, 0.05]) {
            b.blob('vent', [x * scale, topY(x * scale, z * scale) - 0.002, z * scale], [0.011 * scale, 0.005, 0.048 * scale], [0, 0, -x * 2.2]);
        }
    }
    b.blob('vent', [0, topY(0, 0.19 * scale) - 0.001, 0.19 * scale], [0.05 * scale, 0.006, 0.018 * scale]);
    b.base = null;

    // Correas bajo la barbilla.
    for (const side of [-1, 1]) b.tube('strap', v(side * 0.075, 0.0, 0.02), v(side * 0.04, -0.105, 0.04), 0.0035);
    b.tube('strap', v(-0.04, -0.105, 0.04), v(0.04, -0.105, 0.04), 0.0035);
    return b.finish();
}

// ---- Materiales neutros compartidos ----
const neutralMaterials = new Map();

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

export function createCyclist({
    accent,
    ghost,
    style = getCyclistStyle(),
    bikeColor,
    position,
    secondary,
} = {}) {
    const group = new THREE.Group();
    const tone = (color) => (ghost ? GHOST_COLOR : color);
    const ghostProps = ghost
        ? { transparent: true, opacity: 0.4, depthWrite: false, emissive: GHOST_COLOR, emissiveIntensity: 0.5 }
        : {};
    // 'toon' = tres escalones de luz; 'soft' = sombreado suave, más cercano a un juego realista.
    // Solo en 'soft' y sin ghost: reflejos con el mapa de entorno procedural (envIntensity) y, si se pide, barniz (coat).
    const envMap = !ghost && style.shading !== 'toon' ? getCyclistEnvMap() : null;
    const makeMaterial = (color, { rough = 0.78, metal = 0.02, flatShading, envIntensity = 0.45, coat, ...extra } = {}) => {
        if (style.shading === 'toon') return new THREE.MeshToonMaterial({ color: tone(color), gradientMap: getToonGradient(), ...ghostProps, ...extra });
        const params = {
            color: tone(color),
            roughness: rough,
            metalness: metal,
            ...(flatShading ? { flatShading } : {}),
            ...(envMap ? { envMap, envMapIntensity: envIntensity } : {}),
            ...ghostProps,
            ...extra,
        };
        if (coat && !ghost) return new THREE.MeshPhysicalMaterial({ ...params, ...coat });
        return new THREE.MeshStandardMaterial(params);
    };
    const neutral = (name, color, extra) => {
        const key = `${style.shading}|${ghost ? 1 : 0}|${name}`;
        if (!neutralMaterials.has(key)) {
            const material = makeMaterial(color, extra);
            material.userData.shared = true;
            neutralMaterials.set(key, material);
        }
        return neutralMaterials.get(key);
    };

    // Propios de cada ciclista: el renderer anima el detalle de color y el usuario cambia maillot y pintura.
    const accentColor = new THREE.Color(accent);
    const luminance = accentColor.r * 0.3 + accentColor.g * 0.59 + accentColor.b * 0.11;
    const secondaryColor = secondary ?? (luminance > 0.62 ? 0x1f2a36 : 0xf2f4f5);
    // Sin opciones explícitas (expedición, rivales) se usan las preferencias guardadas del usuario.
    const saved = bikeColor === undefined || position === undefined ? readSavedRiderPrefs() : null;
    const initialPaint = resolveBikeColor(bikeColor ?? saved?.bikeColor ?? BIKE_PAINTS[0].color);
    const initialPosition = position ?? saved?.position ?? DEFAULT_RIDER_POSITION;
    const M = {
        // El tronco lleva color por vértice (volumen); mangas y hombreras usan el mismo color sin degradado.
        jersey: makeMaterial(accent, { emissive: accent, emissiveIntensity: ghost ? 0.5 : 0.1, vertexColors: true }),
        jerseyArm: makeMaterial(accent, { emissive: accent, emissiveIntensity: ghost ? 0.5 : 0.1 }),
        jerseySec: makeMaterial(secondaryColor, { ...(ghost ? {} : { emissive: secondaryColor, emissiveIntensity: 0.04 }), vertexColors: true }),
        jerseyTrim: makeMaterial(secondaryColor),
        // Detalles de color (franja de las zapatillas, tubo diagonal): es el material que el renderer anima con el flow.
        accent: makeMaterial(accent, { emissive: accent, emissiveIntensity: ghost ? 0.9 : 0.35 }),
        // Pintura metalizada barnizada; setBikeColor solo cambia su color.
        paint: makeMaterial(initialPaint, { rough: 0.38, metal: 0.35, envIntensity: 0.9, coat: { clearcoat: 1, clearcoatRoughness: 0.08 } }),
        skin: neutral('skin', PALETTE.skin),
        hair: neutral('hair', PALETTE.hair),
        glasses: neutral('glasses', 0x141b22, { rough: 0.25, metal: 0.3 }),
        helmet: neutral('helmet', PALETTE.helmet, { rough: 0.45 }),
        vent: neutral('vent', PALETTE.helmetVent, { flatShading: true }),
        strap: neutral('strap', 0x1b2227),
        shorts: neutral('shorts', PALETTE.shorts),
        shortCuff: neutral('shortCuff', 0x38444a),
        zip: neutral('zip', 0xe9ecec, { flatShading: true }),
        shoe: neutral('shoe', PALETTE.shoe),
        sock: neutral('sock', PALETTE.sock),
        glove: neutral('glove', PALETTE.glove),
        rubber: neutral('rubber', PALETTE.rubber, { rough: 0.6 }),
        tape: neutral('tape', PALETTE.tape, { rough: 0.6 }),
        tire: neutral('tire', PALETTE.tire, { rough: 0.85 }),
        rim: neutral('rim', 0x303a40, { rough: 0.3, metal: 0.2, envIntensity: 0.7 }),
        metal: neutral('metal', PALETTE.metal, { rough: 0.3, metal: 0.8, envIntensity: 1, flatShading: true }),
        bottle: neutral('bottle', PALETTE.bottle, { flatShading: true }),
    };
    const spokeKey = `spoke|${ghost ? 1 : 0}`;
    if (!neutralMaterials.has(spokeKey)) {
        const material = new THREE.LineBasicMaterial({ color: tone(PALETTE.spoke), transparent: true, opacity: ghost ? 0.3 : 0.9 });
        material.userData.shared = true;
        neutralMaterials.set(spokeKey, material);
    }
    const spokeMaterial = neutralMaterials.get(spokeKey);

    // Los meshes que llevan contorno se anotan aquí y se les añade al final.
    const outlined = new Map();
    const mark = (mesh, thickness = OUTLINE.normal) => {
        outlined.set(mesh, thickness);
        return mesh;
    };
    const blobMesh = (radii, material) => {
        const mesh = new THREE.Mesh(unitSphere(), material);
        mesh.scale.set(...(Array.isArray(radii) ? radii : [radii, radii, radii]));
        return mesh;
    };
    const taperedMesh = (startRadius, endRadius, material) => new THREE.Mesh(tubeGeometry(startRadius, endRadius), material);
    const addBaked = (parent, parts, outlineSlots = {}) => {
        Object.entries(parts).forEach(([slot, geometry]) => {
            const mesh = new THREE.Mesh(geometry, M[slot]);
            parent.add(mesh);
            if (outlineSlots[slot]) mark(mesh, outlineSlots[slot]);
        });
    };

    // ---- Ruedas: cubierta + llanta con perfil + radios; la cubierta apoya justo en el suelo ----
    const wheelParts = getBaked('wheels', buildWheelParts);
    // Bici modelada en Blender (bike.glb): si está cargada sustituye a cuadro, ruedas, bielas y pedales procedurales.
    const bikeModel = isBikeModelReady() ? getBikeParts() : null;
    const addModelPart = (parent, list, outlineSlots = {}) => {
        for (const { slot, geometry } of list) {
            const mesh = new THREE.Mesh(geometry, M[slot] ?? M.metal);
            parent.add(mesh);
            if (outlineSlots[slot]) mark(mesh, outlineSlots[slot]);
        }
    };
    const buildWheel = (rear) => {
        const wheel = new THREE.Group();
        if (bikeModel) {
            addModelPart(wheel, rear ? bikeModel.wheelRear : bikeModel.wheelFront);
            return wheel;
        }
        const tire = mark(new THREE.Mesh(wheelParts.tire, M.tire), OUTLINE.thin);
        const rim = new THREE.Mesh(rear ? wheelParts.rimRear : wheelParts.rimFront, M.rim);
        wheel.add(tire, rim, new THREE.LineSegments(wheelParts.spokes, spokeMaterial));
        return wheel;
    };
    const rearWheel = buildWheel(true);
    rearWheel.position.copy(BIKE.rearHub);
    const frontWheel = buildWheel(false);
    frontWheel.position.copy(BIKE.frontHub);
    group.add(rearWheel, frontWheel);

    // ---- Cuadro, manillar, sillín: un mesh por material ----
    if (bikeModel) addModelPart(group, bikeModel.frame, { paint: OUTLINE.thin });
    else addBaked(group, getBaked('bike', buildBikeStatic), { paint: OUTLINE.thin });
    const { bottomBracket: bb } = BIKE;
    // Con el modelo, el plato y las dos bielas van en el Crankset (gira entero); las bielas procedurales se ocultan.
    let chainring;
    if (bikeModel) {
        chainring = new THREE.Group();
        addModelPart(chainring, bikeModel.crankset);
    } else {
        chainring = new THREE.Mesh(getBaked('chainring', buildChainring), M.metal);
    }
    chainring.position.copy(bb);
    group.add(chainring);
    const leftCrank = new THREE.Mesh(tubeGeometry(0.011), M.metal);
    const rightCrank = new THREE.Mesh(tubeGeometry(0.011), M.metal);
    leftCrank.visible = !bikeModel;
    rightCrank.visible = !bikeModel;
    group.add(leftCrank, rightCrank);

    // Extensiones de triatlón y apoyos de antebrazo (fijos a la bici): solo en posición aero.
    const aeroBars = new THREE.Group();
    addBaked(aeroBars, getBaked('aero', buildAeroBars));
    group.add(aeroBars);

    // ---- Cuerpo: pelvis fija sobre el sillín, torso que se inclina y piernas con IK ----
    const body = new THREE.Group();
    group.add(body);
    const pelvis = v(0, BODY.hipHeight, BODY.hipZ);

    const hips = new THREE.Group();
    hips.rotation.order = 'ZXY';
    hips.position.copy(pelvis);
    addBaked(hips, getBaked('hips', buildHipsParts), { shorts: OUTLINE.normal });
    const torso = new THREE.Group();
    // Orden ZXY: el balanceo se aplica sobre el eje longitudinal de la bici, no sobre el de la espalda inclinada.
    torso.rotation.order = 'ZXY';
    torso.position.copy(pelvis);
    addBaked(torso, getBaked('torso', buildTorsoParts), { jersey: OUTLINE.normal });
    body.add(hips, torso);

    // Cabeza, cuello, casco y gafas: siguen al torso y se contrarrotan para seguir mirando al frente.
    const headGroup = new THREE.Group();
    const headParts = getBaked('head', buildHeadParts);
    addBaked(headGroup, headParts, { skin: OUTLINE.thin, helmet: OUTLINE.bold });
    const neck = mark(taperedMesh(0.043, 0.039, M.skin), OUTLINE.thin);
    torso.add(headGroup, neck);

    // Brazos finos: manga corta, brazo, antebrazo y guante; se recolocan al cambiar de posición.
    const makeArm = () => ({
        sleeve: mark(taperedMesh(0.056, 0.049, M.jerseyArm), OUTLINE.thin),
        cuff: taperedMesh(0.05, 0.049, M.jerseyTrim),
        upper: mark(taperedMesh(0.043, 0.038, M.skin), OUTLINE.thin),
        fore: mark(taperedMesh(0.036, 0.027, M.skin), OUTLINE.thin),
        cap: mark(blobMesh(0.057, M.jerseyArm), OUTLINE.thin),
        elbow: blobMesh(0.038, M.skin),
        glove: mark(blobMesh([0.036, 0.031, 0.05], M.glove), OUTLINE.thin),
    });
    const arms = [makeArm(), makeArm()];
    arms.forEach((arm) => torso.add(...Object.values(arm)));

    // ---- Piernas: culotte, muslo, gemelo, calcetín y zapatilla; se recolocan por frame con IK ----
    const makePedal = () => {
        if (!bikeModel) return new THREE.Mesh(sharedGeometry('pedal', () => new THREE.BoxGeometry(0.07, 0.014, 0.1)), M.rubber);
        const pedal = new THREE.Group();
        addModelPart(pedal, bikeModel.pedal);
        return pedal;
    };
    const makeLeg = () => ({
        short: mark(taperedMesh(0.077, 0.066, M.shorts), OUTLINE.thin),
        cuff: taperedMesh(0.068, 0.066, M.shortCuff),
        thigh: mark(taperedMesh(0.063, 0.05, M.skin), OUTLINE.thin),
        calf: mark(taperedMesh(0.05, 0.034, M.skin), OUTLINE.thin),
        sock: mark(taperedMesh(0.037, 0.036, M.sock), OUTLINE.thin),
        knee: blobMesh(0.05, M.skin),
        shoe: mark(blobMesh([0.039, 0.045, 0.105], M.shoe), OUTLINE.thin),
        stripe: blobMesh([0.03, 0.008, 0.06], M.accent),
        pedal: makePedal(),
    });
    const leftLeg = makeLeg();
    const rightLeg = makeLeg();
    for (const leg of [leftLeg, rightLeg]) body.add(...Object.values(leg));

    // Sombras de contacto (suelo bajo cada cubierta y bajo el conjunto); el ghost no proyecta.
    if (!ghost) {
        const shadowMaterial = (opacity) => {
            const key = `shadow|${opacity}`;
            if (!neutralMaterials.has(key)) {
                const material = new THREE.MeshBasicMaterial({ map: getBlobShadowTexture(), transparent: true, opacity, depthWrite: false });
                material.userData.shared = true;
                neutralMaterials.set(key, material);
            }
            return neutralMaterials.get(key);
        };
        const contactGeometry = sharedGeometry('contact', () => new THREE.PlaneGeometry(0.2, 0.5));
        for (const hubPosition of [BIKE.rearHub, BIKE.frontHub]) {
            const contact = new THREE.Mesh(contactGeometry, shadowMaterial(0.75));
            contact.rotation.x = -Math.PI / 2;
            contact.position.set(0, 0.012, hubPosition.z);
            contact.userData.noShadow = true;
            group.add(contact);
        }
        const blob = new THREE.Mesh(sharedGeometry('blob', () => new THREE.PlaneGeometry(0.9, 1.9)), shadowMaterial(0.5));
        blob.rotation.x = -Math.PI / 2;
        blob.position.set(0, 0.02, 0);
        blob.userData.noShadow = true;
        group.add(blob);
    }

    // Avatar con malla real: sustituye al cuerpo procedural (que queda como respaldo si no carga).
    const avatar = style.avatar !== false && isRiderAvatarReady() ? createAvatarRig({
        accent,
        ghost,
        headGear: { geometries: headParts, materials: { vent: M.vent, glasses: M.glasses, strap: M.strap } },
    }) : null;
    if (avatar) {
        body.visible = false;
        group.add(avatar.holder);
        // Los pedales son de la bici, no del cuerpo oculto.
        group.add(leftLeg.pedal, rightLeg.pedal);
    }

    // Contorno: una copia invertida hija de cada mesh marcado (hereda su escala y su animación).
    if (!ghost && style.outline) {
        outlined.forEach((thickness, mesh) => {
            const outline = new THREE.Mesh(mesh.geometry, getOutlineMaterial(thickness));
            outline.castShadow = false;
            outline.receiveShadow = false;
            mesh.add(outline);
        });
    }

    group.traverse((child) => {
        if (!child.isMesh || child.userData.noShadow || child.material?.isShaderMaterial) return;
        child.castShadow = !ghost;
        child.receiveShadow = !ghost;
    });

    const cyclist = {
        group,
        rearWheel,
        frontWheel,
        leftLeg,
        rightLeg,
        leftCrank,
        rightCrank,
        crankRing: chainring,
        outerRing: chainring,
        torso,
        hips,
        accentMaterial: M.accent,
        // El jersey conserva su color de identidad; solo los detalles se tiñen con el ambiente del bloque.
        accentMaterials: [M.accent],
        paintMaterial: M.paint,
        crankAngle: 0,
        crankOffset: 0,
        standing: 0,
        avatar,
        hasBikeModel: Boolean(bikeModel),
        position: DEFAULT_RIDER_POSITION,
        bikeColor: initialPaint,
        cda: RIDER_POSITIONS[DEFAULT_RIDER_POSITION].cda,
        setBikeColor(color) {
            cyclist.bikeColor = resolveBikeColor(color);
            // El ghost conserva su tono azul translúcido.
            if (!ghost) M.paint.color.setHex(cyclist.bikeColor);
            return cyclist;
        },
        setPosition(name) {
            const id = POSES[name] ? name : DEFAULT_RIDER_POSITION;
            const pose = POSES[id];
            cyclist.position = id;
            cyclist.cda = RIDER_POSITIONS[id].cda;
            applyPose(pose);
            return cyclist;
        },
    };

    // Inclina el torso, orienta la cabeza y recoloca los brazos sobre manetas, cuernos o extensiones.
    function applyPose(pose) {
        const { lean } = pose;
        torso.rotation.x = lean;
        hips.rotation.x = lean * 0.3;

        // Cuello y cabeza: en el espacio del torso el cuello se echa hacia atrás lo que se inclina la espalda.
        const neckAngle = pose.neck - lean;
        const neckDirection = v(0, Math.cos(neckAngle), Math.sin(neckAngle));
        alignTube(neck, NECK_BASE.clone().addScaledVector(neckDirection, -0.04), NECK_BASE.clone().addScaledVector(neckDirection, 0.085));
        headGroup.position.copy(NECK_BASE).addScaledVector(neckDirection, 0.15);
        headGroup.rotation.x = pose.head - lean;

        // Brazos: IK de dos huesos en el espacio del torso, hacia la mano fijada en el manillar.
        // En aero el codo queda fijo en el apoyo de antebrazo y solo se orientan los dos huesos.
        const toTorso = (point) => point.clone().sub(pelvis).applyAxisAngle(X_AXIS, -lean);
        [-1, 1].forEach((side, index) => {
            const arm = arms[index];
            const shoulder = v(side * SHOULDER_X, SHOULDER_Y, 0);
            const hand = toTorso(v(side * pose.hand.x, pose.hand.y, pose.hand.z));
            let elbow;
            if (pose.elbow) {
                elbow = toTorso(v(side * pose.elbow.x, pose.elbow.y, pose.elbow.z));
            } else {
                const pole = v(side * 0.7, -0.6, -0.2).applyAxisAngle(X_AXIS, -lean);
                elbow = solveTwoBone(shoulder, hand, BODY.upperArm, BODY.forearm, pole, new THREE.Vector3());
            }
            const sleeveEnd = shoulder.clone().lerp(elbow, 0.5);
            alignTube(arm.sleeve, shoulder, sleeveEnd);
            alignTube(arm.cuff, shoulder.clone().lerp(elbow, 0.43), sleeveEnd);
            alignTube(arm.upper, sleeveEnd, elbow);
            alignTube(arm.fore, elbow, hand);
            arm.cap.position.copy(shoulder);
            arm.elbow.position.copy(elbow);
            arm.glove.position.copy(hand);
            // Guante en el mundo: alineado con la bici y cabeceado según la presa (sobre maneta, caída o extensión).
            arm.glove.rotation.x = -lean + pose.glove;
        });
        aeroBars.visible = pose.aero;
        avatar?.setPose({ id: cyclist.position, hand: pose.hand });
    }

    cyclist.setPosition(initialPosition);
    return cyclist;
}

/**
 * Libera lo propio de un ciclista (materiales de maillot/pintura y geometrías no compartidas).
 * Las geometrías y materiales marcados como compartidos se conservan para el resto de ciclistas.
 */
export function disposeCyclist(cyclist) {
    cyclist.group.removeFromParent();
    cyclist.avatar?.dispose();
    cyclist.group.traverse((object) => {
        if (!object.isMesh && !object.isLineSegments) return;
        if (object.geometry && !object.geometry.userData.shared && !object.isSkinnedMesh) object.geometry.dispose();
        const materials = Array.isArray(object.material) ? object.material : [object.material];
        materials.forEach((material) => {
            if (material && !material.userData.shared) material.dispose();
        });
    });
}

// Pedales nivelados al rodar sin pedalear: ángulo de biela múltiplo de PI (un pedal delante y otro detrás).
const COAST_SMOOTHING = 0.08;
const STAND_SWAY = 0.12;

/**
 * Mantiene cyclist.standing (0..1) con histéresis: de pie si (pendiente >= 7 % y cadencia baja) o potencia alta
 * de forma sostenida; vuelve a sentarse cuando deja de cumplirse. `force` (true/false) fija el estado (visor).
 */
export function updateRiderStance(cyclist, { grade = 0, cadence = 0, power = 0, dt = 1 / 60, force } = {}) {
    const step = Math.max(0, dt) || 0;
    const wants = (grade >= 7 && cadence > 0 && cadence < 82) || power >= 550;
    if (typeof force === 'boolean') {
        cyclist.standTarget = force;
        cyclist.standHold = 0;
    } else {
        cyclist.standTarget = Boolean(cyclist.standTarget);
        if (wants === cyclist.standTarget) {
            cyclist.standHold = 0;
        } else {
            cyclist.standHold = (cyclist.standHold || 0) + step;
            if (cyclist.standHold >= (wants ? 1.2 : 1.5)) {
                cyclist.standTarget = wants;
                cyclist.standHold = 0;
            }
        }
    }
    const goal = cyclist.standTarget ? 1 : 0;
    const current = cyclist.standing || 0;
    cyclist.standing = current + (goal - current) * (1 - Math.exp(-step / 0.35));
    return cyclist.standing;
}

export function animateCyclist(cyclist, rawAngle, speed, flow, active, wheelAngle) {
    // Si el llamante conoce el giro real de la rueda (velocidad / radio) lo usa; si no, deriva de la biela.
    const wheelRotation = wheelAngle ?? (active ? rawAngle * 1.85 : rawAngle);
    cyclist.rearWheel.rotation.x = wheelRotation;
    cyclist.frontWheel.rotation.x = wheelRotation;

    // Rueda libre: las bielas se acercan al nivelado más próximo; al pedalear de nuevo el desfase decae sin salto.
    let offset = cyclist.crankOffset || 0;
    if (active) {
        offset *= 1 - COAST_SMOOTHING;
        if (Math.abs(offset) < 1e-4) offset = 0;
    } else {
        const shown = rawAngle + offset;
        offset += (Math.round(shown / Math.PI) * Math.PI - shown) * COAST_SMOOTHING;
    }
    cyclist.crankOffset = offset;
    const angle = rawAngle + offset;

    // Ligera oscilación de cadera y torso: sube y baja dos veces por vuelta de biela y se balancea de lado a lado.
    const bob = active ? Math.sin(angle * 2) * 0.003 : 0;
    const roll = active ? Math.sin(angle) * 0.018 : 0;
    const hipY = BODY.hipHeight + bob;
    cyclist.hips.position.y = hipY;
    cyclist.hips.rotation.z = roll * 0.5;
    cyclist.torso.position.y = hipY;
    cyclist.torso.rotation.z = roll;

    // Un pie por lado: el izquierdo va con el ángulo, el derecho desfasado 180°.
    poseLeg(cyclist.leftLeg, -1, angle, hipY, _pedalLeft);
    poseLeg(cyclist.rightLeg, 1, angle + Math.PI, hipY, _pedalRight);
    const bb = BIKE.bottomBracket;
    alignTube(cyclist.leftCrank, _crankStart.copy(bb).add(_crankSide.set(-0.07, 0, 0)), _pedalLeft);
    alignTube(cyclist.rightCrank, _crankStart.copy(bb).add(_crankSide.set(0.07, 0, 0)), _pedalRight);
    cyclist.crankRing.rotation.x = angle;
    const standing = cyclist.standing || 0;
    cyclist.avatar?.update(cyclist.group, _pedalLeft, _pedalRight, { angle, standing });
    // De pie la bici se balancea más, hacia el lado contrario al pie que baja.
    const lean = Math.min(0.055, speed * 0.0018) + flow * 0.012;
    cyclist.group.rotation.z = active ? Math.sin(angle) * lean * 0.08 - Math.sin(angle) * STAND_SWAY * standing : 0;
}

// ---- Cinemática y geometría auxiliar ----

const _toTarget = new THREE.Vector3();
const _perpendicular = new THREE.Vector3();

// Cinemática inversa de dos huesos: escribe en `out` la articulación intermedia (rodilla/codo).
function solveTwoBone(root, target, lengthA, lengthB, pole, out) {
    _toTarget.subVectors(target, root);
    const distance = THREE.MathUtils.clamp(_toTarget.length(), 0.001, lengthA + lengthB - 0.002);
    _toTarget.normalize();
    const along = (lengthA * lengthA - lengthB * lengthB + distance * distance) / (2 * distance);
    const height = Math.sqrt(Math.max(lengthA * lengthA - along * along, 0));
    _perpendicular.copy(pole).addScaledVector(_toTarget, -pole.dot(_toTarget)).normalize();
    return out.copy(root).addScaledVector(_toTarget, along).addScaledVector(_perpendicular, height);
}

const _hip = new THREE.Vector3();
const _ankle = new THREE.Vector3();
const _knee = new THREE.Vector3();
const _pole = new THREE.Vector3();
const _mid = new THREE.Vector3();
const _cuffStart = new THREE.Vector3();
const _sockStart = new THREE.Vector3();
const _crankSide = new THREE.Vector3();
const _crankStart = new THREE.Vector3();
const _pedalLeft = new THREE.Vector3();
const _pedalRight = new THREE.Vector3();
const _shoeOffset = new THREE.Vector3(0, 0.04, 0.015);
const _stripeOffset = new THREE.Vector3(0, 0.03, 0.015);
const _ankleOffset = new THREE.Vector3(0, 0.075, -0.065);

function poseLeg(leg, side, angle, hipY, pedalOut) {
    const { bottomBracket, crankLength } = BIKE;
    _hip.set(side * BODY.hipHalfWidth, hipY, BODY.hipZ);
    // Delante -> abajo -> detrás -> arriba al aumentar el ángulo (pedaleo hacia delante), igual que el plato.
    pedalOut.set(side * 0.1, bottomBracket.y - Math.sin(angle) * crankLength, Math.cos(angle) * crankLength);
    // El tobillo queda unos centímetros detrás y encima del eje del pedal.
    _ankle.copy(pedalOut).add(_ankleOffset);
    _ankle.y += Math.max(0, Math.cos(angle) * 0.01);
    _pole.set(side * 0.18, 0.35, 1);
    solveTwoBone(_hip, _ankle, BODY.thigh, BODY.shin, _pole, _knee);
    _mid.copy(_hip).lerp(_knee, 0.55);
    _sockStart.copy(_knee).lerp(_ankle, 0.72);
    alignTube(leg.short, _hip, _mid);
    alignTube(leg.cuff, _cuffStart.copy(_hip).lerp(_knee, 0.49), _mid);
    alignTube(leg.thigh, _mid, _knee);
    alignTube(leg.calf, _knee, _sockStart);
    alignTube(leg.sock, _sockStart, _ankle);
    leg.knee.position.copy(_knee);
    leg.pedal.position.copy(pedalOut);
    leg.shoe.position.copy(pedalOut).add(_shoeOffset);
    leg.shoe.rotation.x = Math.sin(angle) * 0.12;
    leg.stripe.position.copy(leg.shoe.position).add(_stripeOffset);
    leg.stripe.rotation.x = leg.shoe.rotation.x;
}

const _alignDirection = new THREE.Vector3();
function alignTube(mesh, start, end) {
    _alignDirection.subVectors(end, start);
    const length = Math.max(0.001, _alignDirection.length());
    mesh.position.addVectors(start, end).multiplyScalar(0.5);
    mesh.quaternion.setFromUnitVectors(Y_AXIS, _alignDirection.divideScalar(length));
    mesh.scale.set(1, length, 1);
}

// Superficie elíptica que recorre una lista de secciones (tronco, casco...) con tapas.
// Normales suaves (la costura queda soldada) y tapas con vértices propios para que no contaminen el sombreado
// del borde. Con `shade(y, angle)` añade un color por vértice (gradiente suave sobre el color del material).
function createLoft(sections, radial = 16, shade = null) {
    const stride = radial + 1;
    const right = new THREE.Vector3(1, 0, 0);
    const positions = [];
    const colors = [];
    const directions = [];
    sections.forEach((section, index) => {
        const next = sections[Math.min(index + 1, sections.length - 1)].center;
        const previous = sections[Math.max(index - 1, 0)].center;
        const direction = next.clone().sub(previous).normalize();
        directions.push(direction);
        const front = new THREE.Vector3().crossVectors(right, direction).normalize();
        for (let step = 0; step <= radial; step += 1) {
            const angle = (step / radial) * Math.PI * 2;
            const point = section.center.clone()
                .addScaledVector(right, Math.cos(angle) * section.width / 2)
                .addScaledVector(front, Math.sin(angle) * section.depth / 2);
            positions.push(point.x, point.y, point.z);
            if (shade) {
                const value = shade(section.center.y, angle);
                colors.push(value, value, value);
            }
        }
    });
    const indices = [];
    for (let row = 0; row < sections.length - 1; row += 1) {
        for (let step = 0; step < radial; step += 1) {
            const a = row * stride + step;
            const b = a + stride;
            indices.push(a, b, a + 1, a + 1, b, b + 1);
        }
    }

    // Normales del costado y soldadura de la costura (primer y último vértice de cada anillo coinciden).
    const side = new THREE.BufferGeometry();
    side.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    side.setIndex(indices);
    side.computeVertexNormals();
    const normals = Array.from(side.getAttribute('normal').array);
    side.dispose();
    for (let row = 0; row < sections.length; row += 1) {
        const first = row * stride * 3;
        const last = (row * stride + radial) * 3;
        for (let axis = 0; axis < 3; axis += 1) {
            const mean = (normals[first + axis] + normals[last + axis]) / 2;
            normals[first + axis] = mean;
            normals[last + axis] = mean;
        }
    }

    // Tapas planas: centro + copia del anillo con la normal de la tapa.
    for (const [ringIndex, flip] of [[0, true], [sections.length - 1, false]]) {
        const center = sections[ringIndex].center;
        const capNormal = directions[ringIndex].clone().multiplyScalar(flip ? -1 : 1);
        const centerIndex = positions.length / 3;
        const capShade = shade ? shade(center.y, Math.PI / 2) : 1;
        positions.push(center.x, center.y, center.z);
        normals.push(capNormal.x, capNormal.y, capNormal.z);
        if (shade) colors.push(capShade, capShade, capShade);
        const ringStart = positions.length / 3;
        for (let step = 0; step <= radial; step += 1) {
            const source = (ringIndex * stride + step) * 3;
            positions.push(positions[source], positions[source + 1], positions[source + 2]);
            normals.push(capNormal.x, capNormal.y, capNormal.z);
            if (shade) colors.push(capShade, capShade, capShade);
        }
        for (let step = 0; step < radial; step += 1) {
            const a = ringStart + step;
            indices.push(...(flip ? [centerIndex, a, a + 1] : [centerIndex, a + 1, a]));
        }
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
    if (shade) geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    geometry.setIndex(indices);
    return geometry;
}
