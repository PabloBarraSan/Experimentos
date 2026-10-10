/**
 * Ciclista cartoon rechoncho: cabeza y casco enormes, formas redondeadas, sombreado de tres
 * escalones y contorno oscuro. Se lee bien desde la cámara en el jugador, el ghost y el pelotón.
 *
 * Se modela en metros (z+ = delante, y+ = arriba). El renderer lo amplía con RIDER_SCALE.
 */

import * as THREE from 'three';
import { createAvatarRig, isRiderAvatarReady } from './AvatarRider.js';

const Y_AXIS = new THREE.Vector3(0, 1, 0);
const GHOST_COLOR = 0x8ed9ff;

export const BIKE = {
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

export const BODY = {
    thigh: 0.43,
    shin: 0.43,
    upperArm: 0.31,
    forearm: 0.29,
    hipHalfWidth: 0.085,
    hipHeight: 1.0,
    hipZ: -0.21,
};

const PALETTE = {
    skin: 0xf6b98f,
    hair: 0x4a3226,
    shorts: 0x2a3138,
    helmet: 0xfff4dc,
    helmetVent: 0x1b2328,
    shoe: 0x2a3138,
    sock: 0xffffff,
    glove: 0x3a4248,
    frame: 0x4f6a68,
    tire: 0x1d2328,
    rim: 0x8a9a9c,
    spoke: 0xc7d0d1,
    metal: 0xc9d2d3,
    eye: 0x141b1f,
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
    outlineMaterials.set(thickness, material);
    return material;
}

const STYLE_KEY = 'smartTrainer_cyclistStyle';
const DEFAULT_STYLE = { outline: false, shading: 'soft', avatar: true };

export function getCyclistStyle() {
    try {
        const saved = JSON.parse(localStorage.getItem(STYLE_KEY) || 'null');
        return {
            outline: typeof saved?.outline === 'boolean' ? saved.outline : DEFAULT_STYLE.outline,
            shading: saved?.shading === 'toon' ? 'toon' : DEFAULT_STYLE.shading,
            avatar: saved?.avatar === false ? false : DEFAULT_STYLE.avatar,
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

export function createCyclist({ accent, ghost, style = getCyclistStyle() }) {
    const group = new THREE.Group();
    const tone = (color) => (ghost ? GHOST_COLOR : color);
    const ghostProps = ghost
        ? { transparent: true, opacity: 0.4, depthWrite: false, emissive: GHOST_COLOR, emissiveIntensity: 0.5 }
        : {};
    // 'toon' = tres escalones de luz; 'soft' = sombreado suave, más cercano a un juego realista.
    const toon = (color, extra = {}) => (style.shading === 'toon'
        ? new THREE.MeshToonMaterial({ color: tone(color), gradientMap: getToonGradient(), ...ghostProps, ...extra })
        : new THREE.MeshStandardMaterial({ color: tone(color), roughness: 0.78, metalness: 0.02, ...ghostProps, ...extra }));

    const jerseyMaterial = toon(accent, { emissive: accent, emissiveIntensity: ghost ? 0.5 : 0.12 });
    // Detalles de color (tubo superior, franja de las zapatillas): es el material que el renderer anima con el flow.
    const accentMaterial = toon(accent, { emissive: accent, emissiveIntensity: ghost ? 0.9 : 0.35 });
    const skinMaterial = toon(PALETTE.skin);
    const hairMaterial = toon(PALETTE.hair);
    const shortsMaterial = toon(PALETTE.shorts);
    const helmetMaterial = toon(PALETTE.helmet);
    const ventMaterial = toon(PALETTE.helmetVent);
    const shoeMaterial = toon(PALETTE.shoe);
    const sockMaterial = toon(PALETTE.sock);
    const gloveMaterial = toon(PALETTE.glove);
    const frameMaterial = toon(PALETTE.frame);
    const tireMaterial = toon(PALETTE.tire);
    const rimMaterial = toon(PALETTE.rim);
    const metalMaterial = toon(PALETTE.metal);
    const darkMetalMaterial = toon(0x6f7b7e, { roughness: 0.55 });
    const eyeMaterial = toon(PALETTE.eye);
    const spokeMaterial = new THREE.LineBasicMaterial({
        color: tone(PALETTE.spoke), transparent: true, opacity: ghost ? 0.3 : 0.9,
    });
    const v = (x, y, z) => new THREE.Vector3(x, y, z);
    const sphere = (radius, material, scale = [1, 1, 1]) => {
        const mesh = new THREE.Mesh(new THREE.SphereGeometry(radius, 18, 14), material);
        mesh.scale.set(...scale);
        return mesh;
    };
    // Los meshes que llevan contorno se anotan aquí y se les añade al final.
    const outlined = new Map();
    const mark = (mesh, thickness = OUTLINE.normal) => {
        outlined.set(mesh, thickness);
        return mesh;
    };
    const tube = (start, end, radius, material, thickness = OUTLINE.thin) => mark(createTube(start, end, radius, material), thickness);

    // ---- Ruedas: la cubierta apoya justo en el suelo (el radio exterior es BIKE.wheelRadius) ----
    const TIRE_TUBE = 0.029;
    const tireRadius = BIKE.wheelRadius - TIRE_TUBE; // radio de la línea central de la goma
    const buildWheel = ({ rear }) => {
        const wheel = new THREE.Group();
        const tire = mark(new THREE.Mesh(new THREE.TorusGeometry(tireRadius, TIRE_TUBE, 12, 48), tireMaterial), OUTLINE.thin);
        tire.rotation.y = Math.PI / 2;
        const rim = new THREE.Mesh(new THREE.TorusGeometry(tireRadius - 0.03, 0.012, 6, 48), rimMaterial);
        rim.rotation.y = Math.PI / 2;
        const spokePoints = [];
        for (let index = 0; index < 12; index += 1) {
            const angle = (index / 12) * Math.PI * 2;
            spokePoints.push(0, 0, 0, 0, Math.cos(angle) * (tireRadius - 0.04), Math.sin(angle) * (tireRadius - 0.04));
        }
        const spokeGeometry = new THREE.BufferGeometry();
        spokeGeometry.setAttribute('position', new THREE.Float32BufferAttribute(spokePoints, 3));
        const spokes = new THREE.LineSegments(spokeGeometry, spokeMaterial);
        const hub = mark(new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.07, 12), metalMaterial), OUTLINE.thin);
        hub.rotation.z = Math.PI / 2;
        // Disco de freno a la izquierda y, en la rueda trasera, el cassette a la derecha.
        const disc = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.005, 24), darkMetalMaterial);
        disc.rotation.z = Math.PI / 2;
        disc.position.x = -0.04;
        wheel.add(tire, rim, spokes, hub, disc);
        if (rear) {
            const cassette = new THREE.Mesh(new THREE.CylinderGeometry(0.056, 0.04, 0.04, 14), darkMetalMaterial);
            cassette.rotation.z = Math.PI / 2;
            cassette.position.x = 0.05;
            wheel.add(cassette);
        }
        return wheel;
    };
    const rearWheel = buildWheel({ rear: true });
    rearWheel.position.copy(BIKE.rearHub);
    const frontWheel = buildWheel({ rear: false });
    frontWheel.position.copy(BIKE.frontHub);
    group.add(rearWheel, frontWheel);
    // Sombra de contacto bajo cada cubierta: ancla la bici al suelo.
    for (const hubPosition of [BIKE.rearHub, BIKE.frontHub]) {
        const contact = new THREE.Mesh(
            new THREE.PlaneGeometry(0.2, 0.5),
            new THREE.MeshBasicMaterial({ map: getBlobShadowTexture(), transparent: true, opacity: ghost ? 0 : 0.75, depthWrite: false }),
        );
        contact.rotation.x = -Math.PI / 2;
        contact.position.set(0, 0.012, hubPosition.z);
        group.add(contact);
    }

    // ---- Cuadro, horquilla y manillar: tubos gruesos y redondeados ----
    const { bottomBracket: bb, rearHub, frontHub, seatCluster, headTop, headBottom } = BIKE;
    const barCenter = v(0, 0.97, 0.5);
    [
        [bb, seatCluster, 0.03, frameMaterial],
        [seatCluster, headTop, 0.028, accentMaterial],
        [bb, headBottom, 0.036, frameMaterial],
        [headBottom, headTop, 0.034, frameMaterial],
        [seatCluster, rearHub, 0.018, frameMaterial],
        [bb, rearHub, 0.02, frameMaterial],
        [headBottom.clone().add(v(0, -0.005, 0.005)), frontHub, 0.022, frameMaterial],
        [headTop, barCenter, 0.024, frameMaterial],
        [seatCluster, BIKE.saddle.clone().add(v(0, -0.02, 0)), 0.02, frameMaterial],
    ].forEach(([start, end, radius, material]) => group.add(tube(start, end, radius, material)));
    for (const side of [-1, 1]) {
        group.add(
            tube(v(side * 0.2, 0.97, 0.5), barCenter, 0.019, frameMaterial),
            tube(v(side * 0.2, 0.97, 0.5), v(side * 0.205, 0.955, 0.6), 0.017, tireMaterial),
            tube(v(side * 0.205, 0.955, 0.6), v(side * 0.205, 0.855, 0.63), 0.017, tireMaterial),
            tube(v(side * 0.205, 0.855, 0.63), v(side * 0.2, 0.84, 0.58), 0.017, tireMaterial),
        );
        const hood = mark(sphere(0.036, tireMaterial, [0.8, 1, 1.5]), OUTLINE.thin);
        hood.position.set(side * 0.2, 0.965, 0.585);
        group.add(hood);
    }
    const saddle = mark(sphere(1, tireMaterial, [0.085, 0.032, 0.16]), OUTLINE.thin);
    saddle.position.copy(BIKE.saddle).add(v(0, 0.014, -0.02));
    saddle.rotation.x = -0.05;
    const chainring = mark(new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.014, 16), metalMaterial), OUTLINE.thin);
    chainring.rotation.z = Math.PI / 2;
    chainring.position.copy(bb).add(v(0.05, 0, 0));
    group.add(saddle, chainring);
    const leftCrank = tube(bb, bb, 0.02, metalMaterial);
    const rightCrank = tube(bb, bb, 0.02, metalMaterial);
    group.add(leftCrank, rightCrank);

    // Bidón, cadena, desviador y potencia: detalles de bici de carretera moderna.
    const bottleMaterial = toon(0xf4f1e6);
    const bottle = createTube(v(0, 0.45, 0.115), v(0, 0.61, 0.255), 0.03, bottleMaterial);
    const bottleCap = createTube(v(0, 0.61, 0.255), v(0, 0.635, 0.28), 0.019, tireMaterial);
    const chainTop = createTube(v(0.05, 0.38, 0), v(0.05, 0.392, -0.41), 0.005, tireMaterial);
    const chainBottom = createTube(v(0.05, 0.16, 0), v(0.05, 0.285, -0.41), 0.005, tireMaterial);
    const derailleur = mark(new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.1, 0.045), tireMaterial), OUTLINE.thin);
    derailleur.position.copy(BIKE.rearHub).add(v(0.05, -0.075, -0.015));
    const forkCrown = mark(sphere(0.04, frameMaterial, [0.8, 0.7, 1]), OUTLINE.thin);
    forkCrown.position.copy(BIKE.headBottom).add(v(0, -0.01, 0.01));
    group.add(bottle, bottleCap, chainTop, chainBottom, derailleur, forkCrown);

    const body = new THREE.Group();
    group.add(body);

    // ---- Ciclista rechoncho: cabeza y casco enormes, torso redondo, extremidades gruesas ----
    const pelvis = v(0, BODY.hipHeight + 0.01, BODY.hipZ);
    const shoulders = v(0, 1.35, 0.18);
    const spineAt = (t) => pelvis.clone().lerp(shoulders, t).add(v(0, 0.022 * Math.sin(Math.PI * t), 0));
    // Cadera ancha, cintura marcada, caja torácica y hombros anchos; el eje se arquea hacia la espalda.
    const torsoSections = [
        { t: 0, width: 0.36, depth: 0.27, lift: 0 },
        { t: 0.18, width: 0.32, depth: 0.24, lift: 0.012 },
        { t: 0.4, width: 0.31, depth: 0.25, lift: 0.02 },
        { t: 0.66, width: 0.38, depth: 0.28, lift: 0.024 },
        { t: 0.88, width: 0.46, depth: 0.25, lift: 0.014 },
        { t: 1.0, width: 0.42, depth: 0.2, lift: 0 },
        { t: 1.08, width: 0.2, depth: 0.15, lift: 0 },
    ].map(({ t, width, depth, lift }) => ({ center: spineAt(t).add(v(0, lift, 0)), width, depth }));
    const torso = mark(new THREE.Mesh(createLoft(torsoSections, 22), jerseyMaterial), OUTLINE.normal);
    // Culote: dos glúteos redondeados unidos por una zona central, asentados sobre el sillín.
    const shorts = new THREE.Group();
    for (const side of [-1, 1]) {
        const glute = mark(sphere(1, shortsMaterial, [0.104, 0.1, 0.108]), OUTLINE.normal);
        glute.position.set(side * 0.05, 0.99, -0.238);
        shorts.add(glute);
    }
    const hipBand = mark(sphere(1, shortsMaterial, [0.165, 0.098, 0.15]), OUTLINE.normal);
    hipBand.position.set(0, 0.998, -0.218);
    shorts.add(hipBand);
    body.add(torso, shorts);

    const headCenter = v(0, 1.52, 0.33);
    // Casco, gafas y correas: van en el cuerpo procedural o, con avatar, siguen a la cabeza del avatar.
    const headAccessories = new THREE.Group();
    body.add(headAccessories);
    const head = mark(sphere(0.146, skinMaterial, [0.95, 1.03, 1]), OUTLINE.normal);
    head.position.copy(headCenter);
    // Cara: mandíbula y mentón, mejillas, nariz con puente y boca.
    const jaw = sphere(0.095, skinMaterial, [0.9, 0.8, 0.96]);
    jaw.position.copy(headCenter).add(v(0, -0.082, 0.004));
    const chin = sphere(0.024, skinMaterial, [1, 0.85, 0.9]);
    chin.position.copy(headCenter).add(v(0, -0.13, 0.07));
    const cheeks = [-1, 1].map((side) => {
        const cheek = sphere(0.03, skinMaterial, [1, 0.9, 0.7]);
        cheek.position.copy(headCenter).add(v(side * 0.068, -0.05, 0.066));
        return cheek;
    });
    const nose = sphere(1, skinMaterial, [0.017, 0.03, 0.024]);
    nose.position.copy(headCenter).add(v(0, -0.03, 0.138));
    nose.rotation.x = 0.25;
    const noseTip = sphere(0.015, skinMaterial);
    noseTip.position.copy(headCenter).add(v(0, -0.048, 0.149));
    const mouth = sphere(1, toon(0x9a5656), [0.036, 0.007, 0.012]);
    mouth.position.copy(headCenter).add(v(0, -0.092, 0.122));
    const eyes = [-1, 1].map((side) => {
        const eye = sphere(0.013, eyeMaterial, [0.7, 1.2, 0.5]);
        eye.position.copy(headCenter).add(v(side * 0.058, 0.016, 0.134));
        return eye;
    });
    const hair = mark(sphere(0.1, hairMaterial, [0.98, 0.62, 0.62]), OUTLINE.thin);
    hair.position.copy(headCenter).add(v(0, -0.055, -0.1));
    const glassesMaterial = toon(0x151c20, { roughness: 0.25, metalness: 0.3 });
    // Dos lentes y un puente fino pegados a la cara: de lado y de frente se leen como gafas de sol.
    const glasses = new THREE.Group();
    for (const side of [-1, 1]) {
        const lens = sphere(1, glassesMaterial, [0.052, 0.032, 0.022]);
        lens.position.set(side * 0.058, 0, 0);
        glasses.add(lens);
    }
    glasses.add(sphere(1, glassesMaterial, [0.02, 0.008, 0.012]));
    glasses.position.copy(headCenter).add(v(0, 0.012, 0.128));
    glasses.rotation.x = 0.1;
    const ears = [-1, 1].map((side) => {
        const ear = sphere(0.027, skinMaterial, [0.5, 1, 0.8]);
        ear.position.copy(headCenter).add(v(side * 0.14, -0.005, -0.015));
        return ear;
    });
    const neck = tube(v(0, 1.36, 0.2), headCenter.clone().add(v(0, -0.1, -0.03)), 0.065, skinMaterial, OUTLINE.thin);

    // Casco aerodinámico de carretera: cúpula alargada con cola, ranuras de ventilación y correas.
    // Perfil de cabeza a cola en el sistema del casco (z hacia delante, y arriba).
    const helmetProfile = [
        { z: 0.215, y: -0.005, w: 0.15, h: 0.09 },
        { z: 0.15, y: 0.02, w: 0.245, h: 0.165 },
        { z: 0.05, y: 0.036, w: 0.28, h: 0.215 },
        { z: -0.06, y: 0.034, w: 0.268, h: 0.215 },
        { z: -0.17, y: 0.018, w: 0.21, h: 0.17 },
        { z: -0.27, y: -0.004, w: 0.12, h: 0.1 },
        { z: -0.34, y: -0.022, w: 0.04, h: 0.036 },
    ];
    const helmet = new THREE.Group();
    helmet.position.copy(headCenter).add(v(0, 0.082, -0.03));
    helmet.rotation.x = -0.1;
    const helmetShell = mark(new THREE.Mesh(
        createLoft(helmetProfile.map(({ z, y, w, h }) => ({ center: v(0, y, z), width: w, depth: h })), 24),
        helmetMaterial,
    ), OUTLINE.bold);
    helmet.add(helmetShell);
    // Altura de la cúpula en (x, z): interpola entre secciones del perfil.
    const helmetTopY = (x, z) => {
        for (let index = 0; index < helmetProfile.length - 1; index += 1) {
            const a = helmetProfile[index];
            const b = helmetProfile[index + 1];
            if (z <= a.z && z >= b.z) {
                const t = (a.z - z) / (a.z - b.z);
                const lerp = (key) => a[key] + (b[key] - a[key]) * t;
                const across = Math.min(Math.abs(x) / (lerp('w') / 2), 0.98);
                return lerp('y') + (lerp('h') / 2) * Math.sqrt(1 - across * across);
            }
        }
        return 0;
    };
    // Ranuras de ventilación alargadas a cada lado de la cresta, más una entrada frontal.
    for (const z of [0.085, -0.035, -0.15]) {
        for (const x of [-0.05, 0.05]) {
            const slot = sphere(1, ventMaterial, [0.011, 0.005, 0.048]);
            slot.position.set(x, helmetTopY(x, z) - 0.003, z);
            slot.rotation.z = -x * 2.2;
            helmet.add(slot);
        }
    }
    const intake = sphere(1, ventMaterial, [0.05, 0.01, 0.018]);
    intake.position.set(0, helmetTopY(0, 0.19) - 0.002, 0.19);
    helmet.add(intake);
    // Correas bajo la barbilla (sistema de la cabeza, no del casco).
    const strapMaterial = toon(0x1b2227);
    const straps = [];
    for (const side of [-1, 1]) {
        straps.push(
            createTube(headCenter.clone().add(v(side * 0.118, 0.012, 0.02)), headCenter.clone().add(v(side * 0.06, -0.128, 0.058)), 0.006, strapMaterial),
        );
    }
    straps.push(createTube(
        headCenter.clone().add(v(-0.06, -0.128, 0.058)),
        headCenter.clone().add(v(0.06, -0.128, 0.058)),
        0.006,
        strapMaterial,
    ));
    body.add(head, jaw, chin, ...cheeks, nose, noseTip, mouth, ...eyes, ...ears, hair, neck);
    headAccessories.add(helmet, glasses, ...straps);

    for (const side of [-1, 1]) {
        const shoulder = v(side * 0.2, 1.31, 0.15);
        const hand = v(side * 0.2, 0.97, 0.575);
        const elbow = solveTwoBone(shoulder, hand, BODY.upperArm, BODY.forearm, v(side * 1, -0.25, -0.15));
        const sleeveEnd = shoulder.clone().lerp(elbow, 0.55);
        const sleeve = mark(makeTaperedTube(0.07, 0.062, jerseyMaterial), OUTLINE.thin);
        const upperSkin = mark(makeTaperedTube(0.058, 0.05, skinMaterial), OUTLINE.thin);
        const forearm = mark(makeTaperedTube(0.05, 0.04, skinMaterial), OUTLINE.thin);
        alignTube(sleeve, shoulder, sleeveEnd);
        alignTube(upperSkin, sleeveEnd, elbow);
        alignTube(forearm, elbow, hand);
        const shoulderCap = mark(sphere(0.066, jerseyMaterial), OUTLINE.thin);
        shoulderCap.position.copy(shoulder);
        // El codo es del mismo radio que el brazo: sin bulto, solo cierra la unión.
        const elbowJoint = sphere(0.05, skinMaterial);
        elbowJoint.position.copy(elbow);
        const sleeveDirection = sleeveEnd.clone().sub(shoulder).normalize();
        const cuff = makeTaperedTube(0.067, 0.067, sockMaterial);
        alignTube(cuff, sleeveEnd.clone().addScaledVector(sleeveDirection, -0.03), sleeveEnd.clone().addScaledVector(sleeveDirection, 0.004));
        const glove = mark(sphere(0.05, gloveMaterial, [0.95, 0.9, 1.2]), OUTLINE.thin);
        glove.position.copy(hand).add(v(0, 0.016, 0.015));
        body.add(sleeve, cuff, upperSkin, forearm, shoulderCap, elbowJoint, glove);
    }

    // ---- Piernas gruesas: pantalón, muslo, gemelo, calcetín y zapatilla; se recolocan por frame con IK ----
    const makeLeg = () => ({
        short: mark(makeTaperedTube(0.098, 0.082, shortsMaterial), OUTLINE.thin),
        thigh: mark(makeTaperedTube(0.078, 0.064, skinMaterial), OUTLINE.thin),
        calf: mark(makeTaperedTube(0.066, 0.042, skinMaterial), OUTLINE.thin),
        sock: mark(makeTaperedTube(0.047, 0.044, sockMaterial), OUTLINE.thin),
        knee: sphere(0.064, skinMaterial),
        shoe: mark(sphere(1, shoeMaterial, [0.06, 0.052, 0.145]), OUTLINE.thin),
        stripe: sphere(1, accentMaterial, [0.052, 0.014, 0.085]),
        pedal: new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.016, 0.105), frameMaterial),
    });
    const leftLeg = makeLeg();
    const rightLeg = makeLeg();
    for (const leg of [leftLeg, rightLeg]) body.add(...Object.values(leg));

    const blob = new THREE.Mesh(
        new THREE.PlaneGeometry(0.9, 1.9),
        new THREE.MeshBasicMaterial({ map: getBlobShadowTexture(), transparent: true, opacity: ghost ? 0.12 : 0.5, depthWrite: false }),
    );
    blob.rotation.x = -Math.PI / 2;
    blob.position.set(0, 0.02, 0);
    group.add(blob);

    // Avatar con malla real: sustituye al cuerpo procedural (que queda como respaldo si no carga).
    const avatar = style.avatar !== false && isRiderAvatarReady() ? createAvatarRig({ accent, ghost }) : null;
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
        if (!child.isMesh || child === blob || child.material?.isShaderMaterial) return;
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
        // El jersey conserva su color de identidad; solo los detalles se tiñen con el ambiente del bloque.
        accentMaterials: [accentMaterial],
        crankAngle: 0,
        avatar,
    };
}

export function animateCyclist(cyclist, angle, speed, flow, active) {
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
    cyclist.avatar?.update(cyclist.group, leftPedal, rightPedal);
    const lean = Math.min(0.055, speed * 0.0018) + flow * 0.012;
    cyclist.group.rotation.z = Math.sin(angle * 0.5) * lean * 0.08;
}

// ---- Cinemática y geometría auxiliar ----

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

const _hip = new THREE.Vector3();
const _pedal = new THREE.Vector3();
const _ankle = new THREE.Vector3();
const _pole = new THREE.Vector3();
const _mid = new THREE.Vector3();
const _crankSide = new THREE.Vector3();
const _ankleDrop = new THREE.Vector3();
const _shoeOffset = new THREE.Vector3(0, 0.025, 0.035);
const _stripeOffset = new THREE.Vector3(0, 0.038, 0.02);
const _shoeOffsetAnkle = new THREE.Vector3(0, 0.085, -0.1);

function poseLeg(leg, side, angle) {
    const { bottomBracket, crankLength } = BIKE;
    _hip.set(side * BODY.hipHalfWidth, BODY.hipHeight, BODY.hipZ);
    // Delante -> abajo -> detrás -> arriba al aumentar el ángulo (pedaleo hacia delante), igual que el plato.
    _pedal.set(side * 0.11, bottomBracket.y - Math.sin(angle) * crankLength, Math.cos(angle) * crankLength);
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
    leg.shoe.rotation.x = Math.sin(angle) * 0.12;
    leg.stripe.position.copy(leg.shoe.position).add(_stripeOffset);
    leg.stripe.rotation.x = leg.shoe.rotation.x;
    return _pedal;
}

function createTube(start, end, radius, material) {
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, 1, 14), material);
    alignTube(mesh, start, end);
    return mesh;
}

// Cilindro unitario orientado por alignTube: la base (-y) es el inicio y la tapa (+y) el final.
function makeTaperedTube(startRadius, endRadius, material) {
    return new THREE.Mesh(new THREE.CylinderGeometry(endRadius, startRadius, 1, 14, 1), material);
}

function alignTube(mesh, start, end) {
    const midpoint = start.clone().add(end).multiplyScalar(0.5);
    const direction = end.clone().sub(start);
    const length = Math.max(0.001, direction.length());
    mesh.position.copy(midpoint);
    mesh.quaternion.setFromUnitVectors(Y_AXIS, direction.normalize());
    mesh.scale.set(1, length, 1);
}

// Superficie elíptica que recorre una lista de secciones (tronco, etc.) con tapas.
function createLoft(sections, radial = 16) {
    const positions = [];
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
        }
    });
    const stride = radial + 1;
    for (let row = 0; row < sections.length - 1; row += 1) {
        for (let step = 0; step < radial; step += 1) {
            const a = row * stride + step;
            const b = a + stride;
            indices.push(a, b, a + 1, a + 1, b, b + 1);
        }
    }
    for (const [ringIndex, flip] of [[0, true], [sections.length - 1, false]]) {
        const centerIndex = positions.length / 3;
        const center = sections[ringIndex].center;
        positions.push(center.x, center.y, center.z);
        for (let step = 0; step < radial; step += 1) {
            const a = ringIndex * stride + step;
            indices.push(...(flip ? [centerIndex, a, a + 1] : [centerIndex, a + 1, a]));
        }
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();
    return geometry;
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
