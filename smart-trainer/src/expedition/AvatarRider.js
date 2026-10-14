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
// Por posición: inclinación de cada tramo de la espalda respecto a la vertical (rad, se va tumbando hacia el manillar),
// del cuello y de la cabeza (la cabeza sigue mirando al frente); wrist = desfase de la muñeca respecto al centro del
// agarre (el agarre es la mano, la muñeca queda detrás); fingers = cabeceo de la mano; pole = hacia dónde se dobla el codo.
const AVATAR_POSES = {
    hoods: {
        spine: [0.62, 0.74, 0.86, 0.98], neck: 1.05, head: 0.3,
        wrist: [0, 0.02, -0.06], fingers: 0.2, pole: [0.9, -0.25, -0.2],
    },
    drops: {
        spine: [0.78, 0.9, 1.02, 1.14], neck: 1.2, head: 0.4,
        wrist: [0, 0.055, -0.035], fingers: 0.75, pole: [0.9, -0.25, -0.2],
    },
    aero: {
        spine: [0.95, 1.05, 1.15, 1.25], neck: 1.3, head: 0.45,
        wrist: [0, 0.012, -0.07], fingers: 0, pole: [0.3, -1, -0.2],
    },
};
const DEFAULT_POSE = 'hoods';

// Kit de ciclista sobre la ropa casual del modelo (se edita al clonar, el GLB no se toca).
const SHORTS_COLOR = 0x15191c;
const SHOE_COLOR = 0xeeeeea;
const SHORTS_TIGHTNESS = 0.82; // radio de la pernera respecto al original
const GHOST_OPACITY = 0.45;
const HELMET_WHITE_MIX = 0.3;
// Ajuste del casco y las gafas sobre la cabeza del modelo: centro (fracción del alto de la cabeza sobre el hueso Head) y escala.
const GEAR_CENTER = { y: 0.4, z: 0 };
const GEAR_SCALE = 1.15;

const POSED = [
    'Hips', 'Spine', 'Spine1', 'Spine2', 'Neck', 'Head',
    'LeftShoulder', 'LeftArm', 'LeftForeArm', 'LeftHand', 'LeftHandMiddle1',
    'RightShoulder', 'RightArm', 'RightForeArm', 'RightHand', 'RightHandMiddle1',
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
    if (name.includes('eyelash')) return 'eyelashes';
    if (name.includes('eye')) return 'eyes';
    if (name.includes('hair')) return 'hair';
    if (name.includes('top')) return 'tops';
    if (name.includes('bottom')) return 'bottoms';
    if (name.includes('shoe')) return 'shoes';
    return 'body';
}

let shared = null;

function getShared() {
    if (shared) return shared;
    template.updateMatrixWorld(true);
    const bones = findBones(template);
    const scale = avatarScale();

    // Ejes de los muslos (índice 0: lado x<0, 1: lado x>0) para ceñir las perneras del culotte.
    const legTop = [new THREE.Vector3(), new THREE.Vector3()];
    const legBottom = [new THREE.Vector3(), new THREE.Vector3()];
    for (const prefix of ['Left', 'Right']) {
        const top = bones[`${prefix}UpLeg`].getWorldPosition(new THREE.Vector3());
        const index = top.x > 0 ? 1 : 0;
        legTop[index] = top;
        legBottom[index] = bones[`${prefix}Leg`].getWorldPosition(new THREE.Vector3());
    }

    // Dimensiones de la camiseta en reposo (para situar la franja del pecho y los puños).
    const jerseyBounds = new THREE.Box3();
    template.traverse((object) => {
        if (object.isMesh && meshKind(object) === 'tops') {
            object.geometry.computeBoundingBox();
            jerseyBounds.union(object.geometry.boundingBox);
        }
    });

    // Casco y gafas: matriz local al hueso Head que los centra en la cabeza, con la escala del avatar deshecha.
    const head = bones.Head.getWorldPosition(new THREE.Vector3());
    const headHeight = bones.HeadTop_End ? head.distanceTo(bones.HeadTop_End.getWorldPosition(new THREE.Vector3())) : 0.23 / scale;
    const gearWorld = new THREE.Matrix4().compose(
        head.clone().add(new THREE.Vector3(0, headHeight * GEAR_CENTER.y, headHeight * GEAR_CENTER.z)),
        new THREE.Quaternion(),
        new THREE.Vector3().setScalar((headHeight / 0.2) * GEAR_SCALE), // m del ciclista -> unidades del modelo, ajustado a su cabeza
    );
    const gearLocal = bones.Head.matrixWorld.clone().invert().multiply(gearWorld);

    // Materiales compartidos por todos los avatares (no se liberan con cada ciclista).
    const shorts = new THREE.MeshStandardMaterial({ color: SHORTS_COLOR, roughness: 0.6, metalness: 0 });
    const uniforms = {
        uLegTop: { value: legTop },
        uLegBottom: { value: legBottom },
        uTight: { value: SHORTS_TIGHTNESS },
    };
    shorts.onBeforeCompile = (shader) => {
        Object.assign(shader.uniforms, uniforms);
        shader.vertexShader = `uniform vec3 uLegTop[2];\nuniform vec3 uLegBottom[2];\nuniform float uTight;\n${shader.vertexShader}`
            .replace('#include <begin_vertex>', `#include <begin_vertex>
            {
                // Ciñe la pernera hacia el eje del muslo (en pose de reposo, antes del skinning).
                int side = position.x > 0.0 ? 1 : 0;
                vec3 a = uLegTop[side];
                vec3 ab = uLegBottom[side] - a;
                float along = max(dot(position - a, ab) / dot(ab, ab), 0.0);
                float tight = mix(1.0, uTight, smoothstep(0.15, 0.5, along));
                vec3 axisPoint = a + ab * along;
                transformed = axisPoint + (position - axisPoint) * tight;
            }`);
    };
    shorts.customProgramCacheKey = () => 'rider-bib-shorts';
    const shoes = new THREE.MeshStandardMaterial({ color: SHOE_COLOR, roughness: 0.5, metalness: 0.05 });
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
    [shorts, shoes, ghostMaterial].forEach((material) => { material.userData.shared = true; });

    shared = { scale, gearLocal, jerseyBounds, shorts, shoes, ghostMaterial };
    return shared;
}

// Maillot: color plano del ciclista con el normalMap del tejido, franja en el pecho y puños en el segundo tono.
function createJerseyMaterial(source, accent, secondary, bounds) {
    const material = new THREE.MeshStandardMaterial({
        color: accent,
        normalMap: source.normalMap,
        roughness: 0.55,
        metalness: 0,
    });
    if (source.normalScale) material.normalScale.copy(source.normalScale);
    const height = bounds.max.y - bounds.min.y;
    const chestLow = (bounds.min.y + height * 0.6).toFixed(2);
    const chestHigh = (bounds.min.y + height * 0.7).toFixed(2);
    const cuffX = (bounds.max.x * 0.88).toFixed(2);
    const stripe = new THREE.Color(secondary);
    material.onBeforeCompile = (shader) => {
        shader.uniforms.uStripe = { value: stripe };
        shader.vertexShader = `varying vec3 vRestPosition;\n${shader.vertexShader}`
            .replace('#include <begin_vertex>', '#include <begin_vertex>\n vRestPosition = position;');
        shader.fragmentShader = `uniform vec3 uStripe;\nvarying vec3 vRestPosition;\n${shader.fragmentShader}`
            .replace('#include <color_fragment>', `#include <color_fragment>
            float chest = step(${chestLow}, vRestPosition.y) * step(vRestPosition.y, ${chestHigh});
            float cuff = step(${cuffX}, abs(vRestPosition.x));
            diffuseColor.rgb = mix(diffuseColor.rgb, uStripe, max(chest, cuff));`);
    };
    material.customProgramCacheKey = () => 'rider-jersey';
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
        // Pelo siempre oculto (lleva casco); en el ghost también pestañas y ojos, que solo ensucian la silueta.
        if (kind === 'hair' || (ghost && (kind === 'eyes' || kind === 'eyelashes'))) {
            object.visible = false;
            return;
        }
        if (ghost) {
            object.material = info.ghostMaterial;
            return;
        }
        if (kind === 'tops') {
            object.material = createJerseyMaterial(object.material, accent, secondaryTone(accent), info.jerseyBounds);
            own.push(object.material);
        } else if (kind === 'bottoms') {
            object.material = info.shorts;
        } else if (kind === 'shoes') {
            object.material = info.shoes;
        } else {
            // Piel y ojos: el material de la plantilla se comparte entre clones.
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
    const gear = createHeadGear(headGear, accent, ghost, info);
    if (gear.group) bones.Head.add(gear.group);
    ownMaterials.push(...gear.ownMaterials);

    const rest = new Map(POSED.filter((name) => bones[name]).map((name) => [
        name,
        { position: bones[name].position.clone(), quaternion: bones[name].quaternion.clone() },
    ]));

    // Posición sobre la bici: objetivo de las manos (centro del agarre, en el espacio de la bici) y postura.
    let pose = AVATAR_POSES[DEFAULT_POSE];
    let grip = new THREE.Vector3(0.207, 0.99, 0.62);

    const worldPoint = (group, point) => group.localToWorld(point.clone());
    const worldDirection = (group, direction) => {
        const origin = group.localToWorld(new THREE.Vector3());
        return group.localToWorld(direction.clone()).sub(origin);
    };

    /** @param {{ id: string, hand: THREE.Vector3 }} next - id de posición y centro del agarre del lado derecho */
    function setPose(next) {
        pose = AVATAR_POSES[next.id] || AVATAR_POSES[DEFAULT_POSE];
        if (next.hand) grip = next.hand.clone();
    }

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
        const groupScale = group.getWorldScale(_p).x;
        const points = [PELVIS.clone()];
        for (let index = 0; index < pose.spine.length; index += 1) {
            const length = distanceBetween(bones[chain[index]], bones[chain[index + 1]]) / groupScale;
            const lean = pose.spine[index];
            points.push(points[index].clone().add(new THREE.Vector3(0, Math.cos(lean), Math.sin(lean)).multiplyScalar(length)));
        }
        for (let index = 0; index < pose.spine.length; index += 1) {
            aim(bones[chain[index]], bones[chain[index + 1]], worldPoint(group, points[index + 1]));
        }
        // Cabeza mirando al frente, más agachada cuanto más aerodinámica es la posición.
        const neckLength = distanceBetween(bones.Neck, bones.Head) / group.getWorldScale(_p).x;
        const headPoint = points[points.length - 1].clone().add(new THREE.Vector3(0, Math.cos(pose.neck), Math.sin(pose.neck)).multiplyScalar(neckLength));
        aim(bones.Neck, bones.Head, worldPoint(group, headPoint));
        const headTop = bones.HeadTop_End;
        if (headTop) {
            bones.Head.getWorldPosition(_p);
            const lookTarget = _p.clone().add(worldDirection(group, new THREE.Vector3(0, Math.cos(pose.head), Math.sin(pose.head))));
            aim(bones.Head, headTop, lookTarget);
        }

        // 3) Brazos hacia el agarre (maneta, caída o extensión); la muñeca queda detrás de la mano.
        for (const side of [-1, 1]) {
            const prefix = side < 0 ? 'Left' : 'Right';
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
            }
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
