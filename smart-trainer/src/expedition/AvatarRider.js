/**
 * AvatarRider - Ciclista con malla real (GLB con esqueleto estilo Mixamo)
 *
 * Carga un avatar una sola vez, lo clona para cada ciclista y mueve sus huesos hacia los
 * puntos que calcula la expedición (pedales, manillar, curva de la espalda). El GLB se genera
 * con 3d/scripts/build_rider.py (cuerpo CC0 de MakeHuman con el kit ya modelado) y trae un
 * material por pieza: aquí solo se recolorea el maillot ("TopMain" y su ribete "TopTrim").
 */

import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { getCyclistEnvMap } from './environmentMap.js';

const BASE = (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.BASE_URL) || './';
const MODEL_URL = `${BASE}models/rider.glb`;
const GHOST_COLOR = 0x8ed9ff;

// Alcance de la pierna de la bici (muslo + espinilla): el avatar se escala para igualarlo.
const LEG_REACH = 0.86;

// Cuerpo apoyado en la bici (en el espacio del grupo del ciclista).
const PELVIS = new THREE.Vector3(0, 1.01, -0.215);
// Por posición: inclinación de cada tramo de la espalda respecto a la vertical (rad, se va tumbando hacia el manillar),
// del cuello y de la cabeza (la cabeza sigue mirando al frente); wrist = desfase de la muñeca respecto al centro del
// agarre (el agarre es la mano, la muñeca queda detrás); fingers = cabeceo de la mano; pole = hacia dónde se dobla el codo;
// knuckles = dirección de los nudillos del índice al meñique (x hacia fuera, y arriba, z adelante): palma hacia abajo sobre
// las manetas (los dedos abrazan la maneta), más de canto en las caídas y plana en el acople.
const AVATAR_POSES = {
    hoods: {
        spine: [0.62, 0.74, 0.86, 0.98], neck: 1.05, head: 0.2,
        wrist: [0, -0.012, -0.055], fingers: 0.35, pole: [0.9, -0.25, -0.2], knuckles: [1, -0.45, 0],
    },
    drops: {
        spine: [0.78, 0.9, 1.02, 1.14], neck: 1.2, head: 0.3,
        wrist: [0, 0.03, -0.035], fingers: 0.75, pole: [0.9, -0.25, -0.2], knuckles: [0.5, -1, 0],
    },
    aero: {
        spine: [0.95, 1.05, 1.15, 1.25], neck: 1.3, head: 0.35,
        wrist: [0, 0.012, -0.07], fingers: 0, pole: [0.3, -1, -0.2], knuckles: [1, -0.2, 0],
    },
};
const DEFAULT_POSE = 'hoods';
// Fracción del camino hacia la nueva posición que se recorre en cada frame (cambio de manetas a aero sin saltos).
const POSE_BLEND = 0.1;
// De pie sobre los pedales: pelvis más alta y adelantada (sobre la punta del sillín) y espalda más erguida.
const STAND_POSE = { pelvis: new THREE.Vector3(0, 1.06, 0.0), spine: [0.5, 0.66, 0.82, 0.98], neck: 1.0, head: 0.2 };
// Vaivén con la pedalada (rad de alabeo de hombros; m de desplazamiento lateral de la cadera de pie).
const SWAY = { seated: 0.015, standing: 0.11, hips: 0.035 };

// Acabado de cada material del GLB (por nombre): rugosidad, metalizado, intensidad de reflejos, tejido y barniz.
const FINISH = {
    Skin: { rough: 0.5, env: 0.2 },
    TopMain: { rough: 0.55, env: 0.35, fabric: true },
    TopTrim: { rough: 0.55, env: 0.35, fabric: true },
    Bib: { rough: 0.38, env: 0.55, fabric: true },
    BibBand: { rough: 0.45, env: 0.4 },
    Sock: { rough: 0.8, env: 0.15, fabric: true },
    Glove: { rough: 0.5, env: 0.3 },
    Shoe: { rough: 0.3, env: 0.7 },
    ShoeSole: { rough: 0.7, env: 0.2 },
    HelmetShell: { rough: 0.25, env: 0.9, coat: true },
    HelmetDark: { rough: 0.6, env: 0.2 },
    Lens: { rough: 0.05, metal: 0.7, env: 1.4 },
    GlassesFrame: { rough: 0.3, env: 0.6 },
    Strap: { rough: 0.6, env: 0.1 },
    Buzz: { rough: 0.8, env: 0.1 },
    Eye: { rough: 0.1, env: 0.8 },
};
// Punto de punto del tejido: repeticiones sobre el mapa UV del cuerpo (~1 cm por celda) y relieve.
const FABRIC_REPEAT = 140;
const FABRIC_STRENGTH = 0.35;

const GHOST_OPACITY = 0.45;
const HELMET_WHITE_MIX = 0.3;
// Ajuste del casco y las gafas sobre la cabeza del modelo: centro (fracción del alto de la cabeza sobre el hueso Head) y escala.
const GEAR_CENTER = { y: 0.38, z: 0.06 };
const GEAR_SCALE = 0.98;

const POSED = [
    'Hips', 'Spine', 'Spine1', 'Spine2', 'Neck', 'Head',
    'LeftShoulder', 'LeftArm', 'LeftForeArm', 'LeftHand',
    'RightShoulder', 'RightArm', 'RightForeArm', 'RightHand',
    'LeftUpLeg', 'LeftLeg', 'LeftFoot', 'LeftToeBase',
    'RightUpLeg', 'RightLeg', 'RightFoot', 'RightToeBase',
];

let template = null;
let fabricNormal = null;

// Mapa de normales del punto de lycra (columnas de bucles), generado una vez sin archivos.
function getFabricNormal() {
    if (fabricNormal) return fabricNormal;
    const size = 64;
    const height = (x, y) => {
        const column = (x / size) * 8;
        const row = (y / size) * 8 + (Math.floor(column) % 2) * 0.5;
        return Math.abs(Math.cos(Math.PI * column)) * (0.6 + 0.4 * Math.abs(Math.sin(Math.PI * row)));
    };
    const data = new Uint8Array(size * size * 4);
    for (let y = 0; y < size; y += 1) {
        for (let x = 0; x < size; x += 1) {
            const dx = height((x + 1) % size, y) - height((x + size - 1) % size, y);
            const dy = height(x, (y + 1) % size) - height(x, (y + size - 1) % size);
            const normal = new THREE.Vector3(-dx * 2, -dy * 2, 1).normalize();
            const index = (y * size + x) * 4;
            data[index] = (normal.x * 0.5 + 0.5) * 255;
            data[index + 1] = (normal.y * 0.5 + 0.5) * 255;
            data[index + 2] = (normal.z * 0.5 + 0.5) * 255;
            data[index + 3] = 255;
        }
    }
    fabricNormal = new THREE.DataTexture(data, size, size);
    fabricNormal.wrapS = fabricNormal.wrapT = THREE.RepeatWrapping;
    fabricNormal.repeat.set(FABRIC_REPEAT, FABRIC_REPEAT);
    fabricNormal.magFilter = THREE.LinearFilter;
    fabricNormal.minFilter = THREE.LinearMipmapLinearFilter;
    fabricNormal.generateMipmaps = true;
    fabricNormal.needsUpdate = true;
    return fabricNormal;
}

// Da a los materiales de la plantilla su acabado (reflejos, tejido, barniz). Los clones los comparten.
function finishTemplateMaterials() {
    const envMap = getCyclistEnvMap();
    template.traverse((object) => {
        if (!object.isMesh || !object.material) return;
        const name = object.material.name.replace(/\.\d+$/, '');
        const finish = FINISH[name];
        if (!finish) return;
        let material = object.material;
        if (finish.coat) {
            material = new THREE.MeshPhysicalMaterial({ name: material.name, color: material.color, clearcoat: 1, clearcoatRoughness: 0.06 });
            object.material = material;
        }
        material.roughness = finish.rough;
        material.metalness = finish.metal ?? 0;
        if (envMap) {
            material.envMap = envMap;
            material.envMapIntensity = finish.env;
        }
        if (finish.fabric) {
            material.normalMap = getFabricNormal();
            material.normalScale.set(FABRIC_STRENGTH, FABRIC_STRENGTH);
        }
        material.needsUpdate = true;
    });
}
let loading = null;

export function isRiderAvatarReady() {
    return Boolean(template);
}

/** Descarga el avatar (una vez). Resuelve true si hay avatar utilizable. */
export function preloadRiderAvatar() {
    if (template) return Promise.resolve(true);
    if (loading) return loading;
    loading = (async () => {
        try {
            const gltf = await new GLTFLoader().loadAsync(MODEL_URL);
            const bones = findBones(gltf.scene);
            if (!bones.Hips || !bones.LeftUpLeg || !bones.LeftArm || !bones.Head) {
                console.warn('rider.glb no tiene el esqueleto de Mixamo; se usa el ciclista procedural.');
                loading = null;
                return false;
            }
            gltf.scene.updateMatrixWorld(true);
            template = gltf.scene;
            return true;
        } catch {
            // Sin rider.glb (o no se pudo leer): se usa el ciclista procedural.
            loading = null;
            return false;
        }
    })();
    return loading;
}

function boneKey(name) {
    return name.replace(/^mixamorig[:_]?/i, '');
}

// El GLB trae, junto a cada hueso real, copias de nombre idéntico y transformación nula (una por malla skinned,
// colgando de él). Se usa la primera de cada nombre (la real, el padre): las copias la siguen sin hacer nada.
function findBones(root) {
    const bones = {};
    root.traverse((object) => {
        if (!object.isBone) return;
        const key = boneKey(object.name);
        if (!bones[key]) bones[key] = object;
    });
    return bones;
}

const _p = new THREE.Vector3();
const _c = new THREE.Vector3();
const _cur = new THREE.Vector3();
const _des = new THREE.Vector3();
const _q = new THREE.Quaternion();
const _pq = new THREE.Quaternion();
const _delta = new THREE.Quaternion();

// Gira el hueso (en mundo) para que su hijo quede en la dirección del objetivo. Sirve con cualquier
// orientación de reposo, por eso funciona con avatares distintos.
function aim(bone, child, targetWorld) {
    bone.getWorldPosition(_p);
    child.getWorldPosition(_c);
    _cur.copy(_c).sub(_p);
    _des.copy(targetWorld).sub(_p);
    if (_cur.lengthSq() < 1e-12 || _des.lengthSq() < 1e-12) return;
    _delta.setFromUnitVectors(_cur.normalize(), _des.normalize());
    bone.getWorldQuaternion(_q).premultiply(_delta);
    bone.parent.getWorldQuaternion(_pq);
    bone.quaternion.copy(_pq.invert().multiply(_q));
    bone.updateMatrixWorld(true);
}

const _axis = new THREE.Vector3();
const _from = new THREE.Vector3();
const _to = new THREE.Vector3();

// Gira el hueso sobre su propio eje (en mundo) para que `across` (vector del mundo que el hueso arrastra al girar)
// apunte lo más posible hacia `desired`. Controla el giro que aim() deja libre, p. ej. la palma de la mano.
function twist(bone, axisWorld, across, desired) {
    _axis.copy(axisWorld).normalize();
    _from.copy(across).addScaledVector(_axis, -across.dot(_axis));
    _to.copy(desired).addScaledVector(_axis, -desired.dot(_axis));
    if (_from.lengthSq() < 1e-12 || _to.lengthSq() < 1e-12) return;
    _from.normalize();
    _to.normalize();
    const angle = Math.atan2(_axis.dot(_from.clone().cross(_to)), _from.dot(_to));
    _delta.setFromAxisAngle(_axis, angle);
    bone.getWorldQuaternion(_q).premultiply(_delta);
    bone.parent.getWorldQuaternion(_pq);
    bone.quaternion.copy(_pq.invert().multiply(_q));
    bone.updateMatrixWorld(true);
}

// Gira el hueso un ángulo alrededor de un eje del mundo (alabeo de hombros, etc.).
function rotateWorld(bone, axisWorld, angle) {
    if (!angle) return;
    _delta.setFromAxisAngle(_axis.copy(axisWorld).normalize(), angle);
    bone.getWorldQuaternion(_q).premultiply(_delta);
    bone.parent.getWorldQuaternion(_pq);
    bone.quaternion.copy(_pq.invert().multiply(_q));
    bone.updateMatrixWorld(true);
}

// Acerca cada número (o lista de números) de `current` a `target` una fracción `amount`.
function blendPose(current, target, amount) {
    for (const key of Object.keys(target)) {
        if (Array.isArray(target[key])) {
            target[key].forEach((value, index) => { current[key][index] += (value - current[key][index]) * amount; });
        } else if (typeof target[key] === 'number') {
            current[key] += (target[key] - current[key]) * amount;
        }
    }
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

function distanceBetween(a, b) {
    a.getWorldPosition(_p);
    b.getWorldPosition(_c);
    return _p.distanceTo(_c);
}

// Escala el avatar para que su pierna alcance los pedales de nuestra bici.
function avatarScale() {
    const bones = findBones(template);
    const leg = distanceBetween(bones.LeftUpLeg, bones.LeftLeg) + distanceBetween(bones.LeftLeg, bones.LeftFoot);
    return LEG_REACH / Math.max(leg, 0.01);
}

// ---- Datos comunes a todos los clones (se calculan una vez a partir de la plantilla) ----

function meshKind(object) {
    const name = `${object.name || ''} ${object.material?.name || ''}`.toLowerCase();
    if (name.includes('helmetshell')) return 'helmet';
    if (name.includes('toptrim')) return 'jerseyTrim';
    if (name.includes('topmain')) return 'jersey';
    if (name.includes('eye')) return 'eyes';
    return 'kit';
}

let shared = null;

function getShared() {
    if (shared) return shared;
    template.updateMatrixWorld(true);
    finishTemplateMaterials();
    const bones = findBones(template);
    const scale = avatarScale();

    // Casco y gafas: matriz local al hueso Head que los centra en la cabeza, con la escala del avatar deshecha.
    const head = bones.Head.getWorldPosition(new THREE.Vector3());
    const headHeight = bones.HeadTop_End ? head.distanceTo(bones.HeadTop_End.getWorldPosition(new THREE.Vector3())) : 0.23 / scale;
    const gearWorld = new THREE.Matrix4().compose(
        head.clone().add(new THREE.Vector3(0, headHeight * GEAR_CENTER.y, headHeight * GEAR_CENTER.z)),
        new THREE.Quaternion(),
        new THREE.Vector3().setScalar((headHeight / 0.2) * GEAR_SCALE), // m del ciclista -> unidades del modelo, ajustado a su cabeza
    );
    const gearLocal = bones.Head.matrixWorld.clone().invert().multiply(gearWorld);

    // Material del ghost, compartido por todos los avatares (no se libera con cada ciclista).
    const ghostMaterial = new THREE.MeshStandardMaterial({
        color: GHOST_COLOR,
        emissive: GHOST_COLOR,
        emissiveIntensity: 0.35,
        roughness: 0.8,
        metalness: 0,
        transparent: true,
        opacity: GHOST_OPACITY,
        depthWrite: false,
    });
    ghostMaterial.userData.shared = true;

    // Si el GLB trae su propio casco (y gafas), no se añaden los de Cyclist.js.
    let ownHelmet = false;
    template.traverse((object) => {
        if (object.isMesh && meshKind(object) === 'helmet') ownHelmet = true;
    });

    shared = { scale, gearLocal, ghostMaterial, ownHelmet };
    return shared;
}

// Maillot: color del ciclista sobre el material del GLB (conserva su rugosidad y mapas).
function createJerseyMaterial(source, color) {
    const material = source.clone();
    material.color.set(color);
    return material;
}

// Tono de contraste del maillot (mismo criterio que el ciclista procedural).
function secondaryTone(accent) {
    const color = new THREE.Color(accent);
    const luminance = color.r * 0.3 + color.g * 0.59 + color.b * 0.11;
    return luminance > 0.62 ? 0x1f2a36 : 0xf2f4f5;
}

// Asigna a cada malla su material de kit. El cuerpo y los ojos comparten el material de la plantilla.
function prepareAvatarMaterials(root, { accent, ghost }, info) {
    const own = [];
    root.traverse((object) => {
        if (!object.isMesh) return;
        object.frustumCulled = false;
        object.castShadow = !ghost;
        object.receiveShadow = !ghost;
        const kind = meshKind(object);
        // En el ghost los ojos solo ensucian la silueta.
        if (ghost && kind === 'eyes') {
            object.visible = false;
            return;
        }
        if (ghost) {
            object.material = info.ghostMaterial;
            return;
        }
        if (kind === 'jersey' || kind === 'jerseyTrim') {
            object.material = createJerseyMaterial(object.material, kind === 'jersey' ? accent : secondaryTone(accent));
            own.push(object.material);
        } else if (kind === 'helmet') {
            // El casco hace juego con el maillot, aclarado.
            object.material = createJerseyMaterial(object.material, new THREE.Color(accent).lerp(new THREE.Color(0xffffff), HELMET_WHITE_MIX));
            own.push(object.material);
        } else {
            // Piel, culotte, zapatillas...: el material de la plantilla se comparte entre clones.
            object.material.userData.shared = true;
        }
    });
    return own;
}

// Casco aerodinámico, gafas y correas (geometrías compartidas de Cyclist.js) colgando del hueso Head.
function createHeadGear(headGear, accent, ghost, info) {
    if (!headGear?.geometries) return { group: null, ownMaterials: [] };
    const { geometries, materials } = headGear;
    const group = new THREE.Group();
    group.matrixAutoUpdate = false;
    group.matrix.copy(info.gearLocal);
    const ownMaterials = [];
    let helmetMaterial = info.ghostMaterial;
    if (!ghost) {
        // El casco hace juego con el maillot.
        helmetMaterial = new THREE.MeshStandardMaterial({
            color: new THREE.Color(accent).lerp(new THREE.Color(0xffffff), HELMET_WHITE_MIX),
            roughness: 0.45,
            metalness: 0.02,
        });
        ownMaterials.push(helmetMaterial);
    }
    for (const slot of ['helmet', 'vent', 'glasses', 'strap']) {
        const geometry = geometries[slot];
        if (!geometry) continue;
        const material = ghost ? info.ghostMaterial : (slot === 'helmet' ? helmetMaterial : materials?.[slot]);
        if (!material) continue;
        const mesh = new THREE.Mesh(geometry, material);
        mesh.castShadow = !ghost;
        mesh.receiveShadow = !ghost;
        group.add(mesh);
    }
    return { group, ownMaterials };
}

/**
 * Crea un avatar listo para colocar dentro del grupo de un ciclista.
 * @param {Object} options - { accent, ghost, headGear: { geometries, materials } } (headGear: casco y gafas de Cyclist.js)
 * @returns {{ holder: THREE.Group, update: Function, setPose: Function, dispose: Function } | null}
 */
export function createAvatarRig({ accent, ghost, headGear }) {
    if (!template) return null;
    const info = getShared();
    const root = cloneSkinned(template);
    const bones = findBones(root);
    if (!bones.Hips) return null;

    const holder = new THREE.Group();
    holder.add(root);
    holder.scale.setScalar(info.scale);
    const ownMaterials = prepareAvatarMaterials(root, { accent, ghost }, info);
    const gear = info.ownHelmet ? { group: null, ownMaterials: [] } : createHeadGear(headGear, accent, ghost, info);
    if (gear.group) bones.Head.add(gear.group);
    ownMaterials.push(...gear.ownMaterials);

    // Lado de la bici (x < 0: -1, x > 0: 1) en el que queda la mitad «Left» del avatar: depende de hacia dónde mira el
    // modelo, así que se mide en lugar de suponerlo (si no, cada pierna busca el pedal contrario y se cruzan).
    root.updateMatrixWorld(true);
    const leftSide = bones.LeftUpLeg.getWorldPosition(new THREE.Vector3()).x > bones.Hips.getWorldPosition(new THREE.Vector3()).x ? 1 : -1;
    const prefixFor = (side) => (side === leftSide ? 'Left' : 'Right');

    const rest = new Map(POSED.filter((name) => bones[name]).map((name) => [
        name,
        { position: bones[name].position.clone(), quaternion: bones[name].quaternion.clone() },
    ]));

    // Posición sobre la bici: objetivo de las manos (centro del agarre, en el espacio de la bici) y postura.
    // Posición actual (se acerca poco a poco a la elegida) y agarre de las manos.
    let target = AVATAR_POSES[DEFAULT_POSE];
    const pose = JSON.parse(JSON.stringify(target));
    const gripTarget = new THREE.Vector3(0.207, 0.99, 0.62);
    const grip = gripTarget.clone();

    const worldPoint = (group, point) => group.localToWorld(point.clone());
    const worldDirection = (group, direction) => {
        const origin = group.localToWorld(new THREE.Vector3());
        return group.localToWorld(direction.clone()).sub(origin);
    };

    /** @param {{ id: string, hand: THREE.Vector3 }} next - id de posición y centro del agarre del lado derecho */
    function setPose(next) {
        target = AVATAR_POSES[next.id] || AVATAR_POSES[DEFAULT_POSE];
        if (next.hand) gripTarget.copy(next.hand);
    }

    /**
     * @param {{ angle?: number, standing?: number }} motion - ángulo de biela (para el vaivén) y cuánto va de pie (0..1)
     */
    function update(group, pedalLeft, pedalRight, motion = {}) {
        group.updateWorldMatrix(true, false);
        const angle = motion.angle ?? 0;
        const standing = motion.standing ?? 0;
        blendPose(pose, target, POSE_BLEND);
        grip.lerp(gripTarget, POSE_BLEND);
        // De pie: la postura se mezcla con la de pie y la cadera se mece hacia el pie que empuja.
        const lerp = THREE.MathUtils.lerp;
        const spine = pose.spine.map((value, index) => lerp(value, STAND_POSE.spine[index], standing));
        const neck = lerp(pose.neck, STAND_POSE.neck, standing);
        const headPitch = lerp(pose.head, STAND_POSE.head, standing);
        const pelvis = PELVIS.clone().lerp(STAND_POSE.pelvis, standing);
        pelvis.x -= Math.sin(angle) * SWAY.hips * standing;

        // 1) Pose de reposo y pelvis sobre el sillín.
        rest.forEach(({ position, quaternion }, name) => {
            bones[name].position.copy(position);
            bones[name].quaternion.copy(quaternion);
        });
        const hips = bones.Hips;
        holder.updateMatrixWorld(true);
        const pelvisWorld = worldPoint(group, pelvis);
        hips.position.copy(hips.parent.worldToLocal(pelvisWorld.clone()));
        hips.updateMatrixWorld(true);

        // 2) Espalda: cada tramo se inclina un poco más hacia delante, hasta el cuello.
        const chain = ['Hips', 'Spine', 'Spine1', 'Spine2', 'Neck'];
        const groupScale = group.getWorldScale(_p).x;
        const points = [pelvis.clone()];
        for (let index = 0; index < spine.length; index += 1) {
            const length = distanceBetween(bones[chain[index]], bones[chain[index + 1]]) / groupScale;
            const lean = spine[index];
            points.push(points[index].clone().add(new THREE.Vector3(0, Math.cos(lean), Math.sin(lean)).multiplyScalar(length)));
        }
        for (let index = 0; index < spine.length; index += 1) {
            aim(bones[chain[index]], bones[chain[index + 1]], worldPoint(group, points[index + 1]));
        }
        // Sin control del giro sobre su eje, la espalda doblada queda retorcida: cadera y hombros se nivelan con la bici.
        const lateral = worldDirection(group, new THREE.Vector3(-leftSide, 0, 0)); // de la mitad «Left» a la «Right»
        const across = (left, right) => bones[right].getWorldPosition(new THREE.Vector3()).sub(bones[left].getWorldPosition(_c));
        const boneAxis = (bone, child) => bones[child].getWorldPosition(new THREE.Vector3()).sub(bones[bone].getWorldPosition(_c));
        twist(hips, boneAxis('Hips', 'Spine'), across('LeftUpLeg', 'RightUpLeg'), lateral);
        for (let index = 1; index < chain.length - 1; index += 1) {
            twist(bones[chain[index]], boneAxis(chain[index], chain[index + 1]), across('LeftArm', 'RightArm'), lateral);
        }
        // Los hombros se mecen con cada pedalada (apenas sentado, mucho de pie); las manos siguen en el manillar.
        rotateWorld(bones.Spine1, worldDirection(group, new THREE.Vector3(0, 0, 1)), Math.sin(angle) * (SWAY.seated + SWAY.standing * standing));

        // Cabeza mirando al frente, más agachada cuanto más aerodinámica es la posición.
        const neckLength = distanceBetween(bones.Neck, bones.Head) / group.getWorldScale(_p).x;
        const headPoint = points[points.length - 1].clone().add(new THREE.Vector3(0, Math.cos(neck), Math.sin(neck)).multiplyScalar(neckLength));
        aim(bones.Neck, bones.Head, worldPoint(group, headPoint));
        const headTop = bones.HeadTop_End;
        if (headTop) {
            bones.Head.getWorldPosition(_p);
            const lookTarget = _p.clone().add(worldDirection(group, new THREE.Vector3(0, Math.cos(headPitch), Math.sin(headPitch))));
            aim(bones.Head, headTop, lookTarget);
        }

        // 3) Brazos hacia el agarre (maneta, caída o extensión); la muñeca queda detrás de la mano.
        for (const side of [-1, 1]) {
            const prefix = prefixFor(side);
            const arm = bones[`${prefix}Arm`];
            const foreArm = bones[`${prefix}ForeArm`];
            const hand = bones[`${prefix}Hand`];
            if (!arm || !foreArm || !hand) continue;
            const wrist = new THREE.Vector3(side * grip.x + side * pose.wrist[0], grip.y + pose.wrist[1], grip.z + pose.wrist[2]);
            const handTarget = worldPoint(group, wrist);
            arm.getWorldPosition(_p);
            const shoulder = _p.clone();
            const elbow = solveTwoBone(
                shoulder,
                handTarget,
                distanceBetween(arm, foreArm),
                distanceBetween(foreArm, hand),
                worldDirection(group, new THREE.Vector3(side * pose.pole[0], pose.pole[1], pose.pole[2])),
            );
            aim(arm, foreArm, elbow);
            aim(foreArm, hand, handTarget);
            // Mano alineada con la bici y cabeceada según el agarre (los dedos rodean la maneta o la caída).
            const knuckle = bones[`${prefix}HandMiddle1`];
            if (knuckle) {
                const fingerDirection = worldDirection(group, new THREE.Vector3(0, -Math.sin(pose.fingers), Math.cos(pose.fingers)));
                aim(hand, knuckle, handTarget.clone().add(fingerDirection));
                // Giro de la mano: la línea de nudillos (índice -> meñique) se orienta según el agarre.
                const index = bones[`${prefix}HandIndex1`];
                const pinky = bones[`${prefix}HandPinky1`];
                if (index && pinky) {
                    const across = pinky.getWorldPosition(new THREE.Vector3()).sub(index.getWorldPosition(_c));
                    const axis = knuckle.getWorldPosition(new THREE.Vector3()).sub(hand.getWorldPosition(_p));
                    const [out, up, forward] = pose.knuckles;
                    twist(hand, axis, across, worldDirection(group, new THREE.Vector3(side * out, up, forward)));
                }
            }
        }

        // 4) Piernas hacia los pedales.
        for (const [side, pedal] of [[-1, pedalLeft], [1, pedalRight]]) {
            const prefix = prefixFor(side);
            const upLeg = bones[`${prefix}UpLeg`];
            const leg = bones[`${prefix}Leg`];
            const foot = bones[`${prefix}Foot`];
            const toe = bones[`${prefix}ToeBase`];
            if (!upLeg || !leg || !foot) continue;
            const ankleTarget = worldPoint(group, pedal.clone().add(new THREE.Vector3(0, 0.085, -0.09)));
            upLeg.getWorldPosition(_p);
            const knee = solveTwoBone(
                _p.clone(),
                ankleTarget,
                distanceBetween(upLeg, leg),
                distanceBetween(leg, foot),
                worldDirection(group, new THREE.Vector3(side * 0.12, 0.3, 1)),
            );
            aim(upLeg, leg, knee);
            aim(leg, foot, ankleTarget);
            if (toe) {
                const toeTarget = ankleTarget.clone().add(worldDirection(group, new THREE.Vector3(0, -0.22, 1).normalize().multiplyScalar(0.2)));
                aim(foot, toe, toeTarget);
            }
        }
    }

    // Libera lo propio del clon (esqueletos y materiales de maillot/casco); geometrías y materiales compartidos se conservan.
    function dispose() {
        root.traverse((object) => {
            if (object.isSkinnedMesh) object.skeleton?.dispose();
        });
        ownMaterials.forEach((material) => material.dispose());
        ownMaterials.length = 0;
    }

    return { holder, update, setPose, dispose };
}
