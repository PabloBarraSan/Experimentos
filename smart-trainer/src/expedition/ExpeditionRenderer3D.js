import * as THREE from 'three';

const CAMERA_PRESETS = {
    close: { distance: 6.1, height: 3.45, lookHeight: 1.35, lateral: 7.2 },
    standard: { distance: 8.8, height: 4.35, lookHeight: 1.2, lateral: 5.8 },
    wide: { distance: 12.8, height: 6.1, lookHeight: 1.08, lateral: 7.2 },
};

const QUALITY_PRESETS = {
    low: { pixelRatio: 1, shadows: false, trees: 70, particles: 40 },
    medium: { pixelRatio: 1.35, shadows: true, trees: 120, particles: 80 },
    high: { pixelRatio: 2, shadows: true, trees: 190, particles: 140 },
};

const BLOCK_PALETTES = {
    warmup: { accent: 0xffbf69, fog: 0xc7a47f, sky: 0x809fc0 },
    cooldown: { accent: 0x89d8ff, fog: 0x7894b4, sky: 0x536f9a },
    rest: { accent: 0x72e6c1, fog: 0x94b8aa, sky: 0x6e9fb0 },
    interval: { accent: 0xff6b45, fog: 0xba7a68, sky: 0x7f6682 },
    ramp: { accent: 0xff9c4a, fog: 0x9b8178, sky: 0x687fa4 },
    steady: { accent: 0x63e0b5, fog: 0x86b5ad, sky: 0x70a8c7 },
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
    } = {}) {
        this.canvas = canvas;
        this.cameraMode = CAMERA_PRESETS[cameraMode] ? cameraMode : 'standard';
        this.quality = QUALITY_PRESETS[quality] ? quality : 'medium';
        this.reducedMotion = reducedMotion;
        this.state = {
            flow: 0,
            power: 0,
            cadence: 0,
            speed: 0,
            targetPower: 0,
            blockType: 'steady',
            ghostProgress: 0.72,
            progress: 0,
            paused: true,
        };
        this.visualDistance = 0;
        this.lastTimestamp = performance.now();
        this.frameId = null;
        this.elapsed = 0;
        this._tmp = {
            position: new THREE.Vector3(),
            tangent: new THREE.Vector3(),
            side: new THREE.Vector3(),
            camera: new THREE.Vector3(),
            lookAt: new THREE.Vector3(),
            matrix: new THREE.Matrix4(),
            quaternion: new THREE.Quaternion(),
            scale: new THREE.Vector3(1, 1, 1),
        };

        this.setupRenderer();
        this.setupScene();
        this.buildValley();
        this.player = createCyclist({ accent: 0x63e0b5, ghost: false });
        this.ghost = createCyclist({ accent: 0x8ed9ff, ghost: true });
        this.player.group.scale.setScalar(1.5);
        this.scene.add(this.player.group, this.ghost.group);
        this.buildFlowParticles();
        this.resize();

        this._boundResize = () => this.resize();
        window.addEventListener('resize', this._boundResize);
        this.frameId = requestAnimationFrame((timestamp) => this.draw(timestamp));
    }

    setupRenderer() {
        const quality = QUALITY_PRESETS[this.quality];
        this.renderer = new THREE.WebGLRenderer({
            canvas: this.canvas,
            antialias: this.quality !== 'low',
            powerPreference: 'high-performance',
            alpha: false,
        });
        this.renderer.outputColorSpace = THREE.SRGBColorSpace;
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 1.08;
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, quality.pixelRatio));
        this.renderer.shadowMap.enabled = quality.shadows;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    }

    setupScene() {
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x70a8c7);
        this.scene.fog = new THREE.FogExp2(0x86b5ad, 0.0048);

        this.camera = new THREE.PerspectiveCamera(48, 1, 0.1, 900);
        this.camera.position.set(0, 5, -10);

        this.hemiLight = new THREE.HemisphereLight(0xcdeaff, 0x294332, 1.15);
        this.scene.add(this.hemiLight);

        this.sunLight = new THREE.DirectionalLight(0xfff0cf, 2.15);
        this.sunLight.position.set(-65, 95, -35);
        this.sunLight.castShadow = QUALITY_PRESETS[this.quality].shadows;
        this.sunLight.shadow.mapSize.set(1024, 1024);
        this.sunLight.shadow.camera.near = 1;
        this.sunLight.shadow.camera.far = 260;
        this.sunLight.shadow.camera.left = -80;
        this.sunLight.shadow.camera.right = 80;
        this.sunLight.shadow.camera.top = 80;
        this.sunLight.shadow.camera.bottom = -80;
        this.scene.add(this.sunLight);

        const sun = new THREE.Mesh(
            new THREE.SphereGeometry(7, 24, 16),
            new THREE.MeshBasicMaterial({ color: 0xffd18a, fog: false }),
        );
        sun.position.set(-145, 105, 210);
        this.scene.add(sun);
    }

    buildValley() {
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

        this.groundMaterial = new THREE.MeshStandardMaterial({
            color: 0x345b43,
            roughness: 1,
            metalness: 0,
        });
        const ground = new THREE.Mesh(new THREE.CircleGeometry(440, 96), this.groundMaterial);
        ground.rotation.x = -Math.PI / 2;
        // La ruta baja hasta aproximadamente -3 m en algunos valles. El terreno
        // debe quedar claramente por debajo para no atravesar el asfalto y crear
        // falsos tramos verdes.
        ground.position.y = -4.5;
        ground.receiveShadow = true;
        this.scene.add(ground);

        this.shoulderMaterial = new THREE.MeshStandardMaterial({
            color: 0xb79b72,
            roughness: 1,
        });
        this.roadMaterial = new THREE.MeshStandardMaterial({
            color: 0x242a2d,
            roughness: 0.92,
            metalness: 0.02,
        });
        this.roadEdgeMaterial = new THREE.MeshStandardMaterial({
            color: 0xd7c69e,
            roughness: 0.8,
        });
        this.scene.add(
            createRibbon(this.routeCurve, 9.8, this.shoulderMaterial, 520, -0.1),
            createRibbon(this.routeCurve, 7.2, this.roadEdgeMaterial, 520, -0.03),
            createRibbon(this.routeCurve, 6.65, this.roadMaterial, 520, 0),
        );
        this.buildRoadMarkings();
        this.buildMountains();
        this.buildTrees();
        this.buildSceneryDetails();
        this.buildLandmarks();
    }

    buildRoadMarkings() {
        const count = 104;
        const geometry = new THREE.BoxGeometry(0.13, 0.035, 2.5);
        const material = new THREE.MeshStandardMaterial({
            color: 0xf4df9b,
            emissive: 0x604d24,
            emissiveIntensity: 0.25,
        });
        this.roadMarkings = new THREE.InstancedMesh(geometry, material, count);
        const dummy = new THREE.Object3D();
        for (let index = 0; index < count; index += 1) {
            const t = index / count;
            const nextT = (t + 0.001) % 1;
            const position = this.routeCurve.getPointAt(t);
            const next = this.routeCurve.getPointAt(nextT);
            dummy.position.copy(position).add(new THREE.Vector3(0, 0.085, 0));
            dummy.lookAt(next);
            dummy.updateMatrix();
            this.roadMarkings.setMatrixAt(index, dummy.matrix);
        }
        this.roadMarkings.instanceMatrix.needsUpdate = true;
        this.scene.add(this.roadMarkings);
    }

    buildMountains() {
        this.mountains = new THREE.Group();
        const palette = [0x46635d, 0x557269, 0x668078, 0x3b5551, 0x738982];
        for (let index = 0; index < 22; index += 1) {
            const angle = (index / 22) * Math.PI * 2 + seeded(index) * 0.16;
            const distance = 300 + seeded(index + 50) * 105;
            const radius = 30 + seeded(index + 100) * 40;
            const height = 58 + seeded(index + 200) * 78;
            const mountain = new THREE.Mesh(
                createMountainGeometry(radius, height, index + 1),
                new THREE.MeshStandardMaterial({
                    color: palette[index % palette.length],
                    roughness: 1,
                    flatShading: true,
                }),
            );
            mountain.position.set(
                Math.sin(angle) * distance,
                height / 2 - 4,
                Math.cos(angle) * distance,
            );
            mountain.rotation.y = seeded(index + 300) * Math.PI;
            mountain.receiveShadow = true;
            this.mountains.add(mountain);

            if (index % 2 === 0) {
                const capHeight = height * 0.22;
                const snowCap = new THREE.Mesh(
                    new THREE.ConeGeometry(radius * 0.24, capHeight, 10, 2),
                    new THREE.MeshStandardMaterial({
                        color: 0xdce8df,
                        roughness: 1,
                        flatShading: true,
                    }),
                );
                snowCap.position.set(
                    mountain.position.x,
                    mountain.position.y + height * 0.5 - capHeight * 0.48,
                    mountain.position.z,
                );
                snowCap.rotation.y = mountain.rotation.y;
                this.mountains.add(snowCap);
            }
        }
        this.scene.add(this.mountains);
    }

    buildTrees() {
        const treeCount = QUALITY_PRESETS[this.quality].trees;
        const trunkGeometry = new THREE.CylinderGeometry(0.15, 0.23, 2.3, 6);
        const canopyGeometry = new THREE.ConeGeometry(1.25, 3.9, 7);
        const upperCanopyGeometry = new THREE.ConeGeometry(0.92, 3.2, 7);
        const trunkMaterial = new THREE.MeshStandardMaterial({ color: 0x6e4d33, roughness: 1 });
        const canopyMaterial = new THREE.MeshStandardMaterial({
            color: 0x27583f,
            roughness: 0.95,
            flatShading: true,
        });
        const upperCanopyMaterial = canopyMaterial.clone();
        const trunks = new THREE.InstancedMesh(trunkGeometry, trunkMaterial, treeCount);
        const canopies = new THREE.InstancedMesh(canopyGeometry, canopyMaterial, treeCount);
        const upperCanopies = new THREE.InstancedMesh(
            upperCanopyGeometry,
            upperCanopyMaterial,
            treeCount,
        );
        const dummy = new THREE.Object3D();
        const treePalette = [0x285844, 0x326e4d, 0x3f7d58, 0x2c6048];

        for (let index = 0; index < treeCount; index += 1) {
            const t = seeded(index + 450);
            const route = this.routeCurve.getPointAt(t);
            const tangent = this.routeCurve.getTangentAt(t).normalize();
            const side = new THREE.Vector3(-tangent.z, 0, tangent.x).normalize();
            const direction = index % 2 === 0 ? 1 : -1;
            const offset = direction * (16 + seeded(index + 500) * 40);
            const scale = 0.7 + seeded(index + 550) * 1.4;
            const position = route.clone().add(side.multiplyScalar(offset));

            dummy.position.set(position.x, position.y + 1.1 * scale, position.z);
            dummy.scale.set(scale, scale, scale);
            dummy.rotation.y = seeded(index + 600) * Math.PI * 2;
            dummy.updateMatrix();
            trunks.setMatrixAt(index, dummy.matrix);

            dummy.position.y = position.y + 3.1 * scale;
            dummy.updateMatrix();
            canopies.setMatrixAt(index, dummy.matrix);

            dummy.position.y = position.y + 5.05 * scale;
            dummy.scale.setScalar(scale * 0.76);
            dummy.updateMatrix();
            upperCanopies.setMatrixAt(index, dummy.matrix);
            dummy.scale.setScalar(scale);

            const treeColor = new THREE.Color(treePalette[index % treePalette.length]);
            canopies.setColorAt(index, treeColor);
            upperCanopies.setColorAt(index, treeColor.clone().offsetHSL(0.01, 0, 0.035));
        }
        trunks.instanceMatrix.needsUpdate = true;
        canopies.instanceMatrix.needsUpdate = true;
        upperCanopies.instanceMatrix.needsUpdate = true;
        canopies.instanceColor.needsUpdate = true;
        upperCanopies.instanceColor.needsUpdate = true;
        trunks.castShadow = QUALITY_PRESETS[this.quality].shadows;
        canopies.castShadow = QUALITY_PRESETS[this.quality].shadows;
        upperCanopies.castShadow = QUALITY_PRESETS[this.quality].shadows;
        trunks.receiveShadow = true;
        canopies.receiveShadow = true;
        upperCanopies.receiveShadow = true;
        this.scene.add(trunks, canopies, upperCanopies);
        this.treeMeshes = [trunks, canopies, upperCanopies];
    }

    buildSceneryDetails() {
        const water = new THREE.Mesh(
            new THREE.CircleGeometry(72, 48),
            new THREE.MeshStandardMaterial({
                color: 0x4d8c91,
                emissive: 0x193b45,
                emissiveIntensity: 0.22,
                roughness: 0.28,
                metalness: 0.12,
                transparent: true,
                opacity: 0.86,
            }),
        );
        water.rotation.x = -Math.PI / 2;
        water.position.set(-118, -4.32, 18);
        this.scene.add(water);

        const postCount = 72;
        const postGeometry = new THREE.BoxGeometry(0.16, 1.05, 0.16);
        const postMaterial = new THREE.MeshStandardMaterial({
            color: 0xe6e1cf,
            emissive: 0x324b49,
            emissiveIntensity: 0.25,
            roughness: 0.65,
        });
        const posts = new THREE.InstancedMesh(postGeometry, postMaterial, postCount);
        const dummy = new THREE.Object3D();
        for (let index = 0; index < postCount; index += 1) {
            const t = index / postCount;
            const position = this.routeCurve.getPointAt(t);
            const tangent = flattenTangent(this.routeCurve.getTangentAt(t));
            const side = new THREE.Vector3(-tangent.z, 0, tangent.x);
            const direction = index % 2 === 0 ? 1 : -1;
            dummy.position.copy(position)
                .add(side.multiplyScalar(direction * 4.15))
                .add(new THREE.Vector3(0, 0.5, 0));
            dummy.rotation.set(0, Math.atan2(tangent.x, tangent.z), 0);
            dummy.updateMatrix();
            posts.setMatrixAt(index, dummy.matrix);
        }
        posts.instanceMatrix.needsUpdate = true;
        posts.castShadow = QUALITY_PRESETS[this.quality].shadows;
        this.scene.add(posts);

        const clouds = new THREE.Group();
        const cloudMaterial = new THREE.MeshBasicMaterial({
            color: 0xeaf4ef,
            transparent: true,
            opacity: 0.34,
            depthWrite: false,
            fog: true,
        });
        for (let index = 0; index < 11; index += 1) {
            const cloud = new THREE.Group();
            const scale = 2.5 + seeded(index + 1200) * 3.5;
            for (let puffIndex = 0; puffIndex < 4; puffIndex += 1) {
                const puff = new THREE.Mesh(
                    new THREE.SphereGeometry(1, 10, 7),
                    cloudMaterial,
                );
                puff.position.set(
                    (puffIndex - 1.5) * 1.15,
                    Math.sin(puffIndex * 1.7) * 0.32,
                    seeded(index * 9 + puffIndex + 1300) * 0.7,
                );
                puff.scale.set(1.55, 0.72, 0.95);
                cloud.add(puff);
            }
            const angle = seeded(index + 1400) * Math.PI * 2;
            const distance = 135 + seeded(index + 1500) * 115;
            cloud.position.set(
                Math.sin(angle) * distance,
                44 + seeded(index + 1600) * 24,
                Math.cos(angle) * distance,
            );
            cloud.scale.setScalar(scale);
            clouds.add(cloud);
        }
        this.clouds = clouds;
        this.scene.add(clouds);
    }

    buildLandmarks() {
        const arch = new THREE.Group();
        const stoneMaterial = new THREE.MeshStandardMaterial({
            color: 0xd0bd92,
            roughness: 0.8,
        });
        const left = new THREE.Mesh(new THREE.BoxGeometry(0.8, 5.4, 0.8), stoneMaterial);
        const right = left.clone();
        left.position.set(-4, 2.7, 0);
        right.position.set(4, 2.7, 0);
        const top = new THREE.Mesh(new THREE.BoxGeometry(8.8, 0.8, 0.8), stoneMaterial);
        top.position.set(0, 5.1, 0);
        arch.add(left, right, top);
        const checkpointMaterial = new THREE.MeshBasicMaterial({
            color: 0x71f1c5,
            transparent: true,
            opacity: 0.82,
        });
        const leftGlow = new THREE.Mesh(
            new THREE.BoxGeometry(0.08, 4.35, 0.86),
            checkpointMaterial,
        );
        leftGlow.position.set(-3.55, 2.72, 0);
        const rightGlow = leftGlow.clone();
        rightGlow.position.x = 3.55;
        const topGlow = new THREE.Mesh(
            new THREE.BoxGeometry(7.15, 0.08, 0.86),
            checkpointMaterial,
        );
        topGlow.position.set(0, 4.66, 0);
        arch.add(leftGlow, rightGlow, topGlow);
        positionOnCurve(arch, this.routeCurve, 0.025, 0);
        arch.traverse((child) => {
            if (child.isMesh) child.castShadow = true;
        });
        this.scene.add(arch);

        const beaconMaterial = new THREE.MeshStandardMaterial({
            color: 0xffc66d,
            emissive: 0xff8b35,
            emissiveIntensity: 1.2,
        });
        const beacon = new THREE.Mesh(new THREE.OctahedronGeometry(2.4, 0), beaconMaterial);
        positionOnCurve(beacon, this.routeCurve, 0.62, 8);
        this.scene.add(beacon);
        this.beacon = beacon;
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
            transparent: true,
            opacity: 0,
            depthWrite: false,
            blending: THREE.AdditiveBlending,
        });
        this.flowParticles = new THREE.Points(geometry, this.particleMaterial);
        this.scene.add(this.flowParticles);
    }

    update(next) {
        this.state = { ...this.state, ...next };
    }

    setCameraMode(mode) {
        if (CAMERA_PRESETS[mode]) this.cameraMode = mode;
    }

    setQuality(quality) {
        if (!QUALITY_PRESETS[quality] || this.quality === quality) return;
        this.quality = quality;
        const preset = QUALITY_PRESETS[quality];
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, preset.pixelRatio));
        this.renderer.shadowMap.enabled = preset.shadows;
        this.sunLight.castShadow = preset.shadows;
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
        const tangent = flattenTangent(this.routeCurve.getTangentAt(t));
        const side = new THREE.Vector3(-tangent.z, 0, tangent.x).normalize();
        const playerPosition = position.clone().add(new THREE.Vector3(0, 0.58, 0));
        orientAlongCurve(this.player.group, playerPosition, tangent);

        const cadence = active ? Math.max(0, Number(this.state.cadence) || 0) : 0;
        const crankSpeed = cadence > 0 ? cadence * Math.PI * 2 / 60 : visualSpeed * 0.9;
        this.player.crankAngle += delta * crankSpeed;
        animateCyclist(this.player, this.player.crankAngle, visualSpeed, this.state.flow, active);

        const ghostLead = 12 + (1 - this.state.ghostProgress) * 26;
        const ghostT = ((this.visualDistance + ghostLead) % this.routeLength) / this.routeLength;
        const ghostPosition = this.routeCurve.getPointAt(ghostT).add(new THREE.Vector3(0, 0.58, 0));
        const ghostTangent = flattenTangent(this.routeCurve.getTangentAt(ghostT));
        orientAlongCurve(this.ghost.group, ghostPosition, ghostTangent);
        this.ghost.crankAngle += delta * Math.max(4.8, crankSpeed * 0.96);
        animateCyclist(this.ghost, this.ghost.crankAngle, visualSpeed, 0.5, active);

        const preset = CAMERA_PRESETS[this.cameraMode];
        const motionScale = this.reducedMotion ? 0 : 1;
        const breathing = Math.sin(this.elapsed * 2.2) * 0.06 * motionScale * (0.2 + this.state.flow);
        const lateral = side.clone().multiplyScalar(preset.lateral);
        const cameraTarget = playerPosition.clone()
            .add(tangent.clone().multiplyScalar(-preset.distance))
            .add(new THREE.Vector3(0, preset.height + breathing, 0))
            .add(lateral);
        this.camera.position.lerp(cameraTarget, this.reducedMotion ? 0.18 : 0.075);
        const lookAt = playerPosition.clone()
            .add(tangent.clone().multiplyScalar(this.cameraMode === 'close' ? 0.15 : 0.7))
            .add(new THREE.Vector3(0, preset.lookHeight, 0));
        this.camera.lookAt(lookAt);

        this.flowParticles.position.copy(playerPosition);
        this.flowParticles.position.y += 0.8;
        this.flowParticles.rotation.y = -this.elapsed * (0.25 + this.state.flow * 0.9);
        this.particleMaterial.opacity = this.reducedMotion
            ? 0
            : Math.max(0, Math.min(0.28, (this.state.flow - 0.62) * 0.75));
        this.particleMaterial.size = 0.04 + this.state.flow * 0.075;

        this.beacon.rotation.y += delta * 0.8;
        this.beacon.position.y += Math.sin(this.elapsed * 1.6) * 0.002;
        this.updateAtmosphere(delta);
        this.renderer.render(this.scene, this.camera);
        this.frameId = requestAnimationFrame((nextTimestamp) => this.draw(nextTimestamp));
    }

    updateAtmosphere(delta) {
        const palette = BLOCK_PALETTES[this.state.blockType] || BLOCK_PALETTES.steady;
        const accent = new THREE.Color(palette.accent);
        const intensity = 0.22 + this.state.flow * 0.78;
        this.player.accentMaterial.color.lerp(accent, Math.min(1, delta * 3));
        this.player.accentMaterial.emissive.lerp(accent, Math.min(1, delta * 2));
        this.player.accentMaterial.emissiveIntensity = 0.65 + intensity * 0.5;
        this.particleMaterial.color.lerp(accent, Math.min(1, delta * 4));
        this.scene.background.lerp(new THREE.Color(palette.sky), Math.min(1, delta * 0.45));
        this.scene.fog.color.lerp(new THREE.Color(palette.fog), Math.min(1, delta * 0.45));
        this.sunLight.intensity = 1.65 + this.state.flow * 0.8;
        this.renderer.toneMappingExposure = 0.96 + this.state.flow * 0.2;
    }

    resize() {
        const width = Math.max(1, this.canvas.clientWidth);
        const height = Math.max(1, this.canvas.clientHeight);
        this.renderer.setSize(width, height, false);
        this.camera.aspect = width / height;
        this.camera.updateProjectionMatrix();
    }

    destroy() {
        if (this.frameId) cancelAnimationFrame(this.frameId);
        window.removeEventListener('resize', this._boundResize);
        this.scene.traverse((object) => {
            if (!object.isMesh && !object.isPoints) return;
            object.geometry?.dispose?.();
            if (Array.isArray(object.material)) {
                object.material.forEach((material) => material.dispose?.());
            } else {
                object.material?.dispose?.();
            }
        });
        this.renderer.dispose();
    }
}

function createRibbon(curve, width, material, segments = 500, yOffset = 0) {
    const vertices = [];
    const uvs = [];
    const indices = [];
    for (let index = 0; index <= segments; index += 1) {
        const t = index / segments;
        const point = curve.getPointAt(t);
        const tangent = curve.getTangentAt(t).normalize();
        const side = new THREE.Vector3(-tangent.z, 0, tangent.x).normalize();
        const left = point.clone().add(side.clone().multiplyScalar(-width / 2));
        const right = point.clone().add(side.clone().multiplyScalar(width / 2));
        left.y += yOffset;
        right.y += yOffset;
        vertices.push(left.x, left.y, left.z, right.x, right.y, right.z);
        uvs.push(0, t * 30, 1, t * 30);
        if (index < segments) {
            const base = index * 2;
            indices.push(base, base + 1, base + 2, base + 1, base + 3, base + 2);
        }
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();
    const mesh = new THREE.Mesh(geometry, material);
    mesh.receiveShadow = true;
    return mesh;
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

    const rearHub = new THREE.Vector3(0, 0.72, -0.9);
    const frontHub = new THREE.Vector3(0, 0.72, 0.9);
    const crank = new THREE.Vector3(0, 0.82, -0.05);
    const seat = new THREE.Vector3(0, 1.55, -0.36);
    const handle = new THREE.Vector3(0, 1.42, 0.67);
    const wheelGeometry = new THREE.TorusGeometry(0.69, 0.045, 10, 30);

    const rearWheel = new THREE.Group();
    const rearTire = new THREE.Mesh(wheelGeometry, rubberMaterial);
    rearTire.rotation.y = Math.PI / 2;
    const rearRim = new THREE.Mesh(
        new THREE.TorusGeometry(0.63, 0.018, 8, 28),
        unlitAccentMaterial,
    );
    rearRim.rotation.y = Math.PI / 2;
    rearWheel.add(rearTire, rearRim);
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
            index === 6 ? 0.035 : 0.052,
            index === 6 ? frameMaterial : accentMaterial,
        ));
    });
    const handlebar = createTube(
        new THREE.Vector3(-0.28, 1.42, 0.67),
        new THREE.Vector3(0.28, 1.42, 0.67),
        0.035,
        frameMaterial,
    );
    group.add(handlebar);

    const torso = createTube(
        new THREE.Vector3(0, 1.62, -0.32),
        new THREE.Vector3(0, 2.28, 0.12),
        0.18,
        accentMaterial,
    );
    group.add(torso);
    const jerseyBack = new THREE.Mesh(
        new THREE.CylinderGeometry(0.2, 0.27, 1, 7),
        unlitAccentMaterial,
    );
    alignTube(
        jerseyBack,
        new THREE.Vector3(0, 1.66, -0.28),
        new THREE.Vector3(0, 2.27, 0.12),
    );
    const shorts = new THREE.Mesh(
        new THREE.SphereGeometry(0.25, 10, 7),
        frameMaterial,
    );
    shorts.scale.set(1.05, 0.72, 1.18);
    shorts.position.set(0, 1.62, -0.3);
    group.add(jerseyBack, shorts);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.19, 14, 10), skinMaterial);
    head.position.set(0, 2.46, 0.22);
    group.add(head);
    const helmet = new THREE.Mesh(
        new THREE.SphereGeometry(0.205, 14, 8, 0, Math.PI * 2, 0, Math.PI * 0.58),
        frameMaterial,
    );
    helmet.position.set(0, 2.5, 0.2);
    group.add(helmet);

    const leftArm = createAnimatedLimb(accentMaterial, skinMaterial);
    const rightArm = createAnimatedLimb(accentMaterial, skinMaterial);
    group.add(leftArm.upper, leftArm.lower, rightArm.upper, rightArm.lower);
    alignTube(leftArm.upper, new THREE.Vector3(-0.13, 2.2, 0.06), new THREE.Vector3(-0.24, 1.78, 0.42));
    alignTube(leftArm.lower, new THREE.Vector3(-0.24, 1.78, 0.42), new THREE.Vector3(-0.2, 1.44, 0.67));
    alignTube(rightArm.upper, new THREE.Vector3(0.13, 2.2, 0.06), new THREE.Vector3(0.24, 1.78, 0.42));
    alignTube(rightArm.lower, new THREE.Vector3(0.24, 1.78, 0.42), new THREE.Vector3(0.2, 1.44, 0.67));

    const leftLeg = createAnimatedLimb(accentMaterial, skinMaterial, 0.085);
    const rightLeg = createAnimatedLimb(accentMaterial, skinMaterial, 0.085);
    group.add(leftLeg.upper, leftLeg.lower, rightLeg.upper, rightLeg.lower);

    group.traverse((child) => {
        if (!child.isMesh) return;
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
        accentMaterial,
        crankAngle: 0,
    };
}

function createAnimatedLimb(upperMaterial, lowerMaterial, radius = 0.065) {
    const geometry = new THREE.CylinderGeometry(radius, radius * 0.92, 1, 8);
    return {
        upper: new THREE.Mesh(geometry, upperMaterial),
        lower: new THREE.Mesh(geometry.clone(), lowerMaterial),
    };
}

function animateCyclist(cyclist, angle, speed, flow, active) {
    const wheelRotation = active ? angle * 1.85 : angle;
    cyclist.rearWheel.rotation.x = wheelRotation;
    cyclist.frontWheel.rotation.x = wheelRotation;
    const radius = 0.19;
    const hipLeft = new THREE.Vector3(-0.11, 1.68, -0.31);
    const hipRight = new THREE.Vector3(0.11, 1.68, -0.31);
    const leftFoot = new THREE.Vector3(-0.16, 0.83 + Math.sin(angle) * radius, -0.05 + Math.cos(angle) * radius);
    const rightFoot = new THREE.Vector3(0.16, 0.83 + Math.sin(angle + Math.PI) * radius, -0.05 + Math.cos(angle + Math.PI) * radius);
    const leftKnee = hipLeft.clone().lerp(leftFoot, 0.53);
    leftKnee.z += 0.17;
    leftKnee.y -= 0.05;
    const rightKnee = hipRight.clone().lerp(rightFoot, 0.53);
    rightKnee.z += 0.17;
    rightKnee.y -= 0.05;
    alignTube(cyclist.leftLeg.upper, hipLeft, leftKnee);
    alignTube(cyclist.leftLeg.lower, leftKnee, leftFoot);
    alignTube(cyclist.rightLeg.upper, hipRight, rightKnee);
    alignTube(cyclist.rightLeg.lower, rightKnee, rightFoot);
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
    object.rotation.set(0, Math.atan2(tangent.x, tangent.z), 0);
}

function positionOnCurve(object, curve, t, height) {
    const position = curve.getPointAt(t);
    const tangent = flattenTangent(curve.getTangentAt(t));
    object.position.copy(position).add(new THREE.Vector3(0, height, 0));
    object.rotation.set(0, Math.atan2(tangent.x, tangent.z), 0);
}

function flattenTangent(tangent) {
    const horizontal = new THREE.Vector3(tangent.x, 0, tangent.z);
    if (horizontal.lengthSq() < 0.0001) return FORWARD_AXIS.clone();
    return horizontal.normalize();
}

function createMountainGeometry(radius, height, seed) {
    const geometry = new THREE.ConeGeometry(radius, height, 12, 5, false);
    const positions = geometry.getAttribute('position');
    for (let index = 0; index < positions.count; index += 1) {
        const x = positions.getX(index);
        const y = positions.getY(index);
        const z = positions.getZ(index);
        const angle = Math.atan2(z, x);
        const normalizedHeight = Math.max(0, Math.min(1, (y + height / 2) / height));
        const ridge = Math.sin(angle * 3 + seed * 0.73) * 0.14
            + Math.sin(angle * 5 - seed * 0.41) * 0.07;
        const irregularity = 1 + ridge * (1 - normalizedHeight * 0.72);
        positions.setXYZ(index, x * irregularity, y, z * irregularity);
    }
    positions.needsUpdate = true;
    geometry.computeVertexNormals();
    return geometry;
}

function seeded(value) {
    const x = Math.sin(value * 12.9898 + 78.233) * 43758.5453;
    return x - Math.floor(x);
}
