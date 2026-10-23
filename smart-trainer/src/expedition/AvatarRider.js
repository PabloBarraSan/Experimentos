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
const GHOST_OPACITY = 0.45;
const HELMET_WHITE_MIX = 0.82;
// Ajuste del casco y las gafas sobre la cabeza del modelo: centro (fracción del alto de la cabeza sobre el hueso Head) y escala.
const GEAR_CENTER = { y: 0.34, z: 0.02 };
const GEAR_SCALE = 0.8;

const FINGER_BONES = ['Left', 'Right'].flatMap((side) => [
    ...['Index', 'Middle', 'Ring', 'Pinky'].flatMap((finger) => [1, 2, 3].map((joint) => `${side}Hand${finger}${joint}`)),
    `${side}HandThumb2`, `${side}HandThumb3`,
]);
const POSED = [
    'Hips', 'Spine', 'Spine1', 'Spine2', 'Neck', 'Head',
    'LeftShoulder', 'LeftArm', 'LeftForeArm', 'LeftHand',
    'RightShoulder', 'RightArm', 'RightForeArm', 'RightHand',
    'LeftUpLeg', 'LeftLeg', 'LeftFoot', 'LeftToeBase',
    'RightUpLeg', 'RightLeg', 'RightFoot', 'RightToeBase',
    ...FINGER_BONES,
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
const _axisQ = new THREE.Quaternion();
const FINGER_CURL = [-0.95, -1.05, -0.7];

// Gira un hueso un ángulo sobre un eje del mundo (dedos que se cierran).
function curl(bone, axisWorld, angle) {
    if (!bone) return;
    _axisQ.setFromAxisAngle(axisWorld, angle);
    bone.getWorldQuaternion(_q).premultiply(_axisQ);
    bone.parent.getWorldQuaternion(_pq);
    bone.quaternion.copy(_pq.invert().multiply(_q));
    bone.updateMatrixWorld(true);
}

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
    if (name.includes('hair') || name.includes('headwear')) return 'hair';
    if (name.includes('top')) return 'tops';
    if (name.includes('bottom')) return 'bottoms';
    if (name.includes('shoe') || name.includes('footwear')) return 'shoes';
    return 'body';
}

let shared = null;

// ---- Kit de ciclista pintado sobre la ropa del avatar ----
// La ropa original (chaqueta, pantalón...) se convierte en maillot de manga corta y culotte: en el vertex shader se
// ciñe a la silueta de un cuerpo atlético (radio objetivo a lo largo de cada hueso) y en el fragment shader se pinta
// por zonas (maillot, puños, culotte, piel, calcetín) y se recorta lo que sobra (faldones bajo la cintura).
// Todo se calcula en el espacio de reposo de la malla, así que vale para cualquier avatar con esqueleto de Mixamo.

const SKIN_COLOR = 0xc98f6b;
const GLOVE_COLOR = 0x1a1f24;
const SOCK_COLOR = 0xf3f3ef;

const KIT_COMMON = /* glsl */`
uniform vec3 uLegA[2]; uniform vec3 uLegB[2]; uniform vec3 uLegC[2];
uniform vec3 uArmA[2]; uniform vec3 uArmB[2]; uniform vec3 uArmC[2];
uniform vec3 uSpineA; uniform vec3 uSpineB;
// Posición a lo largo de una cadena de dos huesos (0 = raíz, 1 = final; negativo = por encima de la raíz).
float kitChain(vec3 p, vec3 a, vec3 b, vec3 c, out vec3 axisPoint) {
    vec3 ab = b - a; vec3 bc = c - b;
    float lab = length(ab); float lbc = length(bc);
    float s1 = dot(p - a, ab) / (lab * lab);
    if (s1 < 1.0) { axisPoint = a + ab * clamp(s1, 0.0, 1.0); return s1 * lab / (lab + lbc); }
    float s2 = dot(p - b, bc) / (lbc * lbc);
    axisPoint = b + bc * clamp(s2, 0.0, 1.0);
    return (lab + s2 * lbc) / (lab + lbc);
}
float kitLength(vec3 a, vec3 b, vec3 c) { return length(b - a) + length(c - b); }
// Radio de la pierna (fracción de su largo): muslo potente, rodilla, gemelo y tobillo fino.
float kitLegRadius(float t) {
    if (t < 0.5) return mix(0.098, 0.06, smoothstep(0.0, 0.5, t));
    if (t < 0.66) return mix(0.06, 0.068, smoothstep(0.5, 0.66, t));
    return mix(0.068, 0.04, smoothstep(0.66, 1.0, t));
}
// Radio del brazo: hombro y bíceps, codo, antebrazo y muñeca.
float kitArmRadius(float t) {
    if (t < 0.48) return mix(0.092, 0.07, smoothstep(0.1, 0.48, t));
    if (t < 0.62) return mix(0.07, 0.076, smoothstep(0.48, 0.62, t));
    return mix(0.076, 0.052, smoothstep(0.62, 1.0, t));
}
vec3 kitFit(vec3 p, vec3 axisPoint, float radius, float amount) {
    vec3 offset = p - axisPoint;
    float d = length(offset);
    if (d < 1e-5) return p;
    // Mínimo suave y monótono: lo que ya cabe no se toca y las capas de ropa conservan su orden (sin z-fighting).
    float target = d / pow(1.0 + pow(d / radius, 6.0), 1.0 / 6.0);
    return axisPoint + offset * mix(1.0, target / d, amount);
}
`;

function kitShaderUniforms(uniforms) {
    return Object.fromEntries(Object.entries(uniforms).map(([key, value]) => [key, { value }]));
}

/**
 * Material de kit sobre la ropa del avatar.
 * kind: 'tops' (maillot), 'bottoms' (culotte y piernas), 'body' (manos con guante, cuello, tobillos).
 */
function createKitMaterial(kind, source, colors, uniforms) {
    const material = new THREE.MeshPhysicalMaterial({
        color: 0xffffff,
        roughness: kind === 'body' ? 0.6 : 0.55,
        metalness: 0,
        sheen: kind === 'tops' ? 0.6 : 0.25,
        sheenRoughness: 0.5,
        sheenColor: new THREE.Color(0xffffff),
        // Las manos y el cuello conservan la textura de piel del modelo; la ropa se pinta entera.
        map: kind === 'body' ? source.map : null,
    });
    const shaderUniforms = {
        ...kitShaderUniforms(uniforms),
        uJersey: { value: new THREE.Color(colors.jersey) },
        uSecondary: { value: new THREE.Color(colors.secondary) },
        uShorts: { value: new THREE.Color(colors.shorts) },
        uSkin: { value: new THREE.Color(SKIN_COLOR) },
        uGlove: { value: new THREE.Color(GLOVE_COLOR) },
        uSock: { value: new THREE.Color(SOCK_COLOR) },
    };
    material.userData.kitUniforms = shaderUniforms;
    material.onBeforeCompile = (shader) => {
        Object.assign(shader.uniforms, shaderUniforms);
        shader.vertexShader = `${KIT_COMMON}\nvarying vec3 vRest;\nvarying float vT;\nvarying float vS;\nvarying float vZone;\n${shader.vertexShader}`
            .replace('#include <begin_vertex>', `#include <begin_vertex>
            vRest = position;
            vT = 0.0;
            vS = 0.0;
            vZone = 0.0;
            int side = position.x > 0.0 ? 1 : 0;
            vec3 axisPoint;
            ${kind === 'tops' ? `
            float armT = kitChain(position, uArmA[side], uArmB[side], uArmC[side], axisPoint);
            float armLen = kitLength(uArmA[side], uArmB[side], uArmC[side]);
            vT = armT; // a lo largo del brazo, para todos los vértices: el color no salta en la costura del hombro
            {
                vec3 sp = uSpineB - uSpineA;
                vS = clamp(dot(position - uSpineA, sp) / dot(sp, sp), 0.0, 1.0);
            }
            // Solo es brazo lo que queda cerca de su eje (el costado bajo la axila sigue siendo tronco).
            if (armT > 0.03 && length(position - axisPoint) < armLen * 0.16) {
                // Manga y brazo: se ciñen al radio del brazo.
                transformed = kitFit(transformed, axisPoint, kitArmRadius(armT) * armLen, smoothstep(0.03, 0.14, armT));
                vZone = 1.0;
            } else {
                // Tronco: ceñido alrededor de la columna (la chaqueta holgada pasa a maillot ajustado).
                vec3 spine = uSpineB - uSpineA;
                float L = length(spine);
                float s = clamp(dot(position - uSpineA, spine) / dot(spine, spine), 0.0, 1.0);
                vec3 center = uSpineA + spine * s;
                vec3 offset = transformed - center;
                // Sección del tronco (elipse) a esa altura: cintura, pecho, hombros y cuello.
                float rx = s < 0.7 ? mix(0.27, 0.34, smoothstep(0.1, 0.7, s)) : mix(0.34, 0.14, smoothstep(0.76, 1.0, s));
                float rz = s < 0.7 ? mix(0.2, 0.24, smoothstep(0.1, 0.7, s)) : mix(0.22, 0.14, smoothstep(0.86, 1.0, s));
                float e = length(vec2(offset.x / (rx * L), offset.z / (rz * L)));
                float fitted = e / pow(1.0 + pow(e, 6.0), 1.0 / 6.0);
                if (e > 1e-4) offset.xz *= fitted / e;
                transformed = center + offset;
            }` : ''}
            ${kind === 'bottoms' ? `
            float legT = kitChain(position, uLegA[side], uLegB[side], uLegC[side], axisPoint);
            float len = kitLength(uLegA[side], uLegB[side], uLegC[side]);
            transformed = kitFit(transformed, axisPoint, kitLegRadius(max(legT, 0.0)) * len, smoothstep(0.02, 0.14, legT));
            vT = legT;` : ''}
            ${kind === 'body' ? `
            float handT = kitChain(position, uArmA[side], uArmB[side], uArmC[side], axisPoint);
            vT = handT;
            vZone = handT > 0.97 && length(position - uArmC[side]) < 0.16 ? 1.0 : 0.0;
            if (handT < 0.5 && position.y > uSpineA.y) {
                // Cuello y escote: se ciñen igual que el maillot (un poco más) para no asomar a través de él.
                vec3 spine = uSpineB - uSpineA;
                float L = length(spine);
                float s = clamp(dot(position - uSpineA, spine) / dot(spine, spine), 0.0, 1.0);
                vec3 center = uSpineA + spine * s;
                vec3 offset = transformed - center;
                float rx = (s < 0.7 ? mix(0.27, 0.34, smoothstep(0.1, 0.7, s)) : mix(0.36, 0.15, smoothstep(0.86, 1.0, s))) * 0.94;
                float rz = (s < 0.7 ? mix(0.2, 0.24, smoothstep(0.1, 0.7, s)) : mix(0.22, 0.14, smoothstep(0.86, 1.0, s))) * 0.94;
                float e = length(vec2(offset.x / (rx * L), offset.z / (rz * L)));
                float fitted = e / pow(1.0 + pow(e, 6.0), 1.0 / 6.0);
                if (e > 1e-4) offset.xz *= fitted / e;
                transformed = center + offset;
            }` : ''}
            `);
        shader.fragmentShader = `uniform vec3 uJersey; uniform vec3 uSecondary; uniform vec3 uShorts; uniform vec3 uSkin;
uniform vec3 uGlove; uniform vec3 uSock; uniform vec3 uSpineA; uniform vec3 uSpineB; uniform vec3 uLegC[2];
varying vec3 vRest; varying float vT; varying float vS; varying float vZone;\n${shader.fragmentShader}`
            .replace('#include <color_fragment>', `#include <color_fragment>
            ${kind === 'tops' ? `
            float spineLen = length(uSpineB - uSpineA);
            if (vZone < 0.5 && vRest.y < uSpineA.y + spineLen * 0.06) discard; // faldones bajo la cintura
            // Brazo: manga con puño y piel; tronco: maillot con franja y filete. Se mezclan por zona (sin costuras).
            vec3 arm = vT < 0.35 ? uJersey : uSkin;
            if (vT > 0.305 && vT < 0.35) arm = uSecondary;
            float h = vS;
            vec3 torso = uJersey;
            if (h < 0.13) torso = uSecondary;   // bajo del maillot
            diffuseColor.rgb = mix(torso, arm, smoothstep(0.3, 0.7, vZone));` : ''}
            ${kind === 'bottoms' ? `
            vec3 kit = uShorts;
            if (vT > 0.4) kit = uSkin;
            if (vT > 0.37 && vT <= 0.4) kit = uJersey;               // banda de la pernera
            if (vT > 0.9) kit = uSock;                               // calcetín
            diffuseColor.rgb = kit;` : ''}
            ${kind === 'body' ? `
            int s = vRest.x > 0.0 ? 1 : 0;
            // Del cuerpo solo se ven manos, cuello y tobillos: el resto (escote, hombros) queda bajo el maillot.
            if (vZone < 0.5 && vRest.y > uLegC[s].y + 0.12 && vRest.y < uSpineB.y - 0.015) discard;
            if (vZone > 0.5) diffuseColor.rgb = uGlove;              // guante
            else if (vRest.y < uLegC[s].y + 0.14) diffuseColor.rgb = uSock;
            else diffuseColor.rgb *= uSkin * 1.25;` : ''}
            `);
    };
    material.customProgramCacheKey = () => `rider-kit-${kind}`;
    return material;
}

function getShared() {
    if (shared) return shared;
    template.updateMatrixWorld(true);
    const bones = findBones(template);
    const scale = avatarScale();

    // Puntos del esqueleto en reposo, en el espacio de la malla (índice 0: lado x<0, 1: lado x>0).
    let meshInverse = null;
    template.traverse((object) => {
        if (!meshInverse && object.isSkinnedMesh) meshInverse = object.matrixWorld.clone().invert();
    });
    meshInverse ||= new THREE.Matrix4();
    const at = (bone) => bone.getWorldPosition(new THREE.Vector3()).applyMatrix4(meshInverse);
    const chain = (names) => {
        const out = [[new THREE.Vector3(), new THREE.Vector3()], [new THREE.Vector3(), new THREE.Vector3()], [new THREE.Vector3(), new THREE.Vector3()]];
        for (const prefix of ['Left', 'Right']) {
            const points = names.map((name) => at(bones[`${prefix}${name}`]));
            const index = points[0].x > 0 ? 1 : 0;
            points.forEach((point, k) => { out[k][index] = point; });
        }
        return out;
    };
    const [legA, legB, legC] = chain(['UpLeg', 'Leg', 'Foot']);
    const [armA, armB, armC] = chain(['Arm', 'ForeArm', 'Hand']);
    const kitUniforms = {
        uLegA: legA, uLegB: legB, uLegC: legC,
        uArmA: armA, uArmB: armB, uArmC: armC,
        uSpineA: at(bones.Hips), uSpineB: at(bones.Neck),
    };

    // Casco y gafas: matriz local al hueso Head que los centra en la cabeza, con la escala del avatar deshecha.
    const head = bones.Head.getWorldPosition(new THREE.Vector3());
    const headHeight = bones.HeadTop_End ? head.distanceTo(bones.HeadTop_End.getWorldPosition(new THREE.Vector3())) : 0.23 / scale;
    const gearWorld = new THREE.Matrix4().compose(
        head.clone().add(new THREE.Vector3(0, headHeight * GEAR_CENTER.y, headHeight * GEAR_CENTER.z)),
        new THREE.Quaternion(),
        new THREE.Vector3().setScalar((headHeight / 0.2) * GEAR_SCALE), // m del ciclista -> unidades del modelo, ajustado a su cabeza
    );
    const gearLocal = bones.Head.matrixWorld.clone().invert().multiply(gearWorld);

    const shoes = new THREE.MeshPhysicalMaterial({ color: SHOE_COLOR, roughness: 0.35, metalness: 0.05, clearcoat: 0.6 });
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
    [shoes, ghostMaterial].forEach((material) => { material.userData.shared = true; });

    shared = { scale, gearLocal, kitUniforms, shoes, ghostMaterial, headMaterials: new Map() };
    return shared;
}

function headMaterial(source, info) {
    if (info.headMaterials.has(source)) return info.headMaterials.get(source);
    const material = source.clone();
    const neckY = info.kitUniforms.uSpineB.y;
    material.onBeforeCompile = (shader) => {
        shader.vertexShader = `varying float vRestY;\n${shader.vertexShader}`
            .replace('#include <begin_vertex>', '#include <begin_vertex>\n vRestY = position.y;');
        shader.fragmentShader = `varying float vRestY;\n${shader.fragmentShader}`
            .replace('#include <clipping_planes_fragment>', `#include <clipping_planes_fragment>\n if (vRestY < ${(neckY + 0.012).toFixed(4)}) discard;`);
    };
    material.customProgramCacheKey = () => 'rider-head';
    material.userData.shared = true;
    info.headMaterials.set(source, material);
    return material;
}

// Tono de contraste del maillot (mismo criterio que el ciclista procedural).
function secondaryTone(accent) {
    const color = new THREE.Color(accent);
    const luminance = color.r * 0.3 + color.g * 0.59 + color.b * 0.11;
    return luminance > 0.62 ? 0x1f2a36 : 0xf2f4f5;
}

// Asigna a cada malla su material de kit. La cabeza y los ojos comparten el material de la plantilla.
function prepareAvatarMaterials(root, { accent, ghost }, info) {
    const own = [];
    const colors = { jersey: accent, secondary: secondaryTone(accent), shorts: SHORTS_COLOR };
    root.traverse((object) => {
        if (!object.isMesh) return;
        object.frustumCulled = false;
        object.castShadow = !ghost;
        object.receiveShadow = !ghost;
        const kind = meshKind(object);
        // Pelo y sombreros siempre ocultos (lleva casco); en el ghost también pestañas y ojos.
        if (kind === 'hair' || (ghost && (kind === 'eyes' || kind === 'eyelashes'))) {
            object.visible = false;
            return;
        }
        if (ghost) {
            object.material = info.ghostMaterial;
            return;
        }
        const isBodySkin = kind === 'body' && /body/i.test(`${object.name} ${object.material?.name || ''}`) && !/head/i.test(object.name);
        if (kind === 'tops' || kind === 'bottoms' || isBodySkin) {
            object.material = createKitMaterial(isBodySkin ? 'body' : kind, object.material, colors, info.kitUniforms);
            own.push(object.material);
        } else if (kind === 'shoes') {
            object.material = info.shoes;
        } else if (/head/i.test(object.name)) {
            // La cabeza trae la parte alta del cuello y los hombros: lo que queda bajo el cuello del maillot se recorta.
            object.material = headMaterial(object.material, info);
        } else {
            // Cabeza y ojos: el material de la plantilla se comparte entre clones.
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
        helmetMaterial = new THREE.MeshPhysicalMaterial({
            color: new THREE.Color(accent).lerp(new THREE.Color(0xffffff), HELMET_WHITE_MIX),
            roughness: 0.3,
            metalness: 0.02,
            clearcoat: 0.9,
            clearcoatRoughness: 0.12,
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

    // Lado del cuerpo (x en el espacio de la bici) en el que está el lado izquierdo del avatar: en los modelos que
    // miran a +Z el izquierdo queda en x > 0. Así cada mano y cada pie van a su lado sin cruzarse.
    root.updateMatrixWorld(true);
    const leftSide = Math.sign(
        bones.LeftUpLeg.getWorldPosition(new THREE.Vector3()).x - bones.RightUpLeg.getWorldPosition(new THREE.Vector3()).x,
    ) || 1;

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
            const prefix = side === leftSide ? 'Left' : 'Right';
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

        // Dedos cerrados alrededor del manillar: cada falange gira sobre el eje de los nudillos.
        for (const prefix of ['Left', 'Right']) {
            const index = bones[`${prefix}HandIndex1`];
            const pinky = bones[`${prefix}HandPinky1`];
            if (!index || !pinky) continue;
            const knuckleAxis = pinky.getWorldPosition(_p).sub(index.getWorldPosition(_c)).normalize();
            if (prefix === 'Left') knuckleAxis.negate();
            for (const finger of ['Index', 'Middle', 'Ring', 'Pinky']) {
                for (let joint = 1; joint <= 3; joint += 1) curl(bones[`${prefix}Hand${finger}${joint}`], knuckleAxis, FINGER_CURL[joint - 1]);
            }
            for (let joint = 2; joint <= 3; joint += 1) curl(bones[`${prefix}HandThumb${joint}`], knuckleAxis, -0.35);
        }

        // 4) Piernas hacia los pedales.
        for (const [side, pedal] of [[-1, pedalLeft], [1, pedalRight]]) {
            const prefix = side === leftSide ? 'Left' : 'Right';
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
