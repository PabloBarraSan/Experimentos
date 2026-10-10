/**
 * AvatarRider - Ciclista con malla real (GLB con esqueleto estilo Mixamo)
 *
 * Carga un avatar una sola vez, lo clona para cada ciclista y mueve sus huesos hacia los
 * puntos que calcula la expedición (pedales, manillar, curva de la espalda). Sirve cualquier
 * avatar con el esqueleto estándar de Mixamo ("mixamorig:Hips", "LeftUpLeg", ...), así que
 * para cambiar de modelo basta con sustituir public/models/rider.glb.
 */

import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js';

const BASE = (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.BASE_URL) || './';
const MODEL_URL = `${BASE}models/rider.glb`;
const GHOST_COLOR = 0x8ed9ff;

// Alcance de la pierna de la bici (muslo + espinilla): el avatar se escala para igualarlo.
const LEG_REACH = 0.86;

// Cuerpo apoyado en la bici (en el espacio del grupo del ciclista).
const PELVIS = new THREE.Vector3(0, 1.01, -0.215);
const HAND_TARGET = new THREE.Vector3(0.2, 0.975, 0.57);
// Inclinación de cada tramo de la espalda respecto a la vertical (rad): se va tumbando hacia el manillar.
const SPINE_LEAN = [0.62, 0.74, 0.86, 0.98];
const HEAD_LEAN = 0.32;

const POSED = [
    'Hips', 'Spine', 'Spine1', 'Spine2', 'Neck', 'Head',
    'LeftShoulder', 'LeftArm', 'LeftForeArm', 'LeftHand',
    'RightShoulder', 'RightArm', 'RightForeArm', 'RightHand',
    'LeftUpLeg', 'LeftLeg', 'LeftFoot', 'LeftToeBase',
    'RightUpLeg', 'RightLeg', 'RightFoot', 'RightToeBase',
];

let template = null;
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

function findBones(root) {
    const bones = {};
    root.traverse((object) => {
        if (object.isBone) bones[boneKey(object.name)] = object;
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

// Avatar final: se respetan sus materiales y texturas. Solo se copian (cada ciclista el suyo) y el maillot
// (materiales con "jersey", "shirt" o "top" en el nombre) se tiñe con el color del ciclista.
function prepareCustomAvatar(root, { accent, ghost }) {
    root.traverse((object) => {
        if (!object.isMesh) return;
        object.frustumCulled = false;
        object.castShadow = !ghost;
        object.receiveShadow = !ghost;
        const materials = (Array.isArray(object.material) ? object.material : [object.material]).map((material) => {
            const copy = material.clone();
            if (ghost) {
                Object.assign(copy, { transparent: true, opacity: 0.4, depthWrite: false });
                copy.color?.set(GHOST_COLOR);
                copy.map = null;
            } else if (/jersey|shirt|top/i.test(copy.name || '')) {
                copy.color?.multiply(new THREE.Color(accent));
            }
            return copy;
        });
        object.material = Array.isArray(object.material) ? materials : materials[0];
    });
}

/**
 * Crea un avatar listo para colocar dentro del grupo de un ciclista.
 * @returns {{ holder: THREE.Group, update: Function } | null}
 */
export function createAvatarRig({ accent, ghost }) {
    if (!template) return null;
    const root = cloneSkinned(template);
    const bones = findBones(root);
    if (!bones.Hips) return null;

    const holder = new THREE.Group();
    holder.add(root);
    holder.scale.setScalar(avatarScale());
    prepareCustomAvatar(root, { accent, ghost });

    const rest = new Map(POSED.filter((name) => bones[name]).map((name) => [
        name,
        { position: bones[name].position.clone(), quaternion: bones[name].quaternion.clone() },
    ]));

    const worldPoint = (group, point) => group.localToWorld(point.clone());
    const worldDirection = (group, direction) => {
        const origin = group.localToWorld(new THREE.Vector3());
        return group.localToWorld(direction.clone()).sub(origin);
    };

    function update(group, pedalLeft, pedalRight) {
        group.updateWorldMatrix(true, false);

        // 1) Pose de reposo y pelvis sobre el sillín.
        rest.forEach(({ position, quaternion }, name) => {
            bones[name].position.copy(position);
            bones[name].quaternion.copy(quaternion);
        });
        const hips = bones.Hips;
        holder.updateMatrixWorld(true);
        const pelvisWorld = worldPoint(group, PELVIS);
        hips.position.copy(hips.parent.worldToLocal(pelvisWorld.clone()));
        hips.updateMatrixWorld(true);

        // 2) Espalda: cada tramo se inclina un poco más hacia delante, hasta el cuello.
        const chain = ['Hips', 'Spine', 'Spine1', 'Spine2', 'Neck'];
        const points = [PELVIS.clone()];
        for (let index = 0; index < SPINE_LEAN.length; index += 1) {
            const length = distanceBetween(bones[chain[index]], bones[chain[index + 1]]) / group.getWorldScale(_p).x;
            const lean = SPINE_LEAN[index];
            points.push(points[index].clone().add(new THREE.Vector3(0, Math.cos(lean), Math.sin(lean)).multiplyScalar(length)));
        }
        for (let index = 0; index < SPINE_LEAN.length; index += 1) {
            aim(bones[chain[index]], bones[chain[index + 1]], worldPoint(group, points[index + 1]));
        }
        // Cabeza erguida mirando al frente.
        const neckLength = distanceBetween(bones.Neck, bones.Head) / group.getWorldScale(_p).x;
        const headPoint = points[points.length - 1].clone().add(new THREE.Vector3(0, Math.cos(1.05), Math.sin(1.05)).multiplyScalar(neckLength));
        aim(bones.Neck, bones.Head, worldPoint(group, headPoint));
        const headTop = bones.HeadTop_End;
        if (headTop) {
            bones.Head.getWorldPosition(_p);
            const lookTarget = _p.clone().add(worldDirection(group, new THREE.Vector3(0, Math.cos(HEAD_LEAN), Math.sin(HEAD_LEAN))));
            aim(bones.Head, headTop, lookTarget);
        }

        // 3) Brazos hacia las manetas.
        for (const side of [-1, 1]) {
            const prefix = side < 0 ? 'Left' : 'Right';
            const arm = bones[`${prefix}Arm`];
            const foreArm = bones[`${prefix}ForeArm`];
            const hand = bones[`${prefix}Hand`];
            if (!arm || !foreArm || !hand) continue;
            const handTarget = worldPoint(group, new THREE.Vector3(side * HAND_TARGET.x, HAND_TARGET.y, HAND_TARGET.z));
            arm.getWorldPosition(_p);
            const shoulder = _p.clone();
            const elbow = solveTwoBone(
                shoulder,
                handTarget,
                distanceBetween(arm, foreArm),
                distanceBetween(foreArm, hand),
                worldDirection(group, new THREE.Vector3(side, -0.25, -0.2)),
            );
            aim(arm, foreArm, elbow);
            aim(foreArm, hand, handTarget);
        }

        // 4) Piernas hacia los pedales.
        for (const [side, pedal] of [[-1, pedalLeft], [1, pedalRight]]) {
            const prefix = side < 0 ? 'Left' : 'Right';
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

    return { holder, update };
}
