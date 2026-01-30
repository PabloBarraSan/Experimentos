/**
 * RideRenderer3D - Motor visual estilo Zwift
 * Convierte datos matemáticos de la ruta en carretera 3D
 * Smart Trainer - Virtual Cycling
 */

import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
/** Altura de la barra de métricas (compatibilidad con RideView) */
export const METRICS_BAR_HEIGHT = 60;

/**
 * Interpolar punto de ruta a una distancia dada (RouteGenerator usa points 1D: distance, elevation, grade)
 */
function getPointAtDistance(points, distance) {
    if (!points || points.length === 0) {
        return { distance: 0, elevation: 0, grade: 0 };
    }
    let i = 0;
    while (i < points.length - 1 && points[i + 1].distance <= distance) {
        i++;
    }
    if (i >= points.length - 1) {
        return points[points.length - 1];
    }
    const p1 = points[i];
    const p2 = points[i + 1];
    const t = (distance - p1.distance) / (p2.distance - p1.distance);
    return {
        distance,
        elevation: p1.elevation + t * (p2.elevation - p1.elevation),
        grade: p1.grade + t * (p2.grade - p1.grade),
    };
}

/**
 * Generar coordenadas X,Z en el plano (curva procedural: serpentina)
 * Three.js: Y = altura, X/Z = plano del suelo
 */
function getHorizontalPositionAtDistance(distance) {
    const curveAmplitude = 50;
    const curvePeriod = 200;
    const x = curveAmplitude * Math.sin(distance / curvePeriod);
    const z = distance;
    return { x, z };
}

export class RideRenderer3D {
    constructor(canvas) {
        this.canvas = canvas;
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.bikeMesh = null;
        this.roadCurve = null;
        this.roadMesh = null;
        this.generatedRouteLength = 0;
        this.dummyTarget = new THREE.Vector3();

        this.init();
    }

    init() {
        this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true });
        this.renderer.setSize(this.canvas.clientWidth, this.canvas.clientHeight);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x87ceeb);
        this.scene.fog = new THREE.Fog(0x87ceeb, 50, 800);

        this.camera = new THREE.PerspectiveCamera(
            60,
            this.canvas.clientWidth / this.canvas.clientHeight,
            0.1,
            2000
        );

        const hemiLight = new THREE.HemisphereLight(0xffffff, 0x444444, 0.6);
        this.scene.add(hemiLight);

        const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
        dirLight.position.set(100, 150, 80);
        dirLight.castShadow = true;
        dirLight.shadow.mapSize.width = 2048;
        dirLight.shadow.mapSize.height = 2048;
        dirLight.shadow.camera.near = 0.5;
        dirLight.shadow.camera.far = 500;
        dirLight.shadow.camera.left = -150;
        dirLight.shadow.camera.right = 150;
        dirLight.shadow.camera.top = 150;
        dirLight.shadow.camera.bottom = -150;
        this.scene.add(dirLight);

        const groundGeo = new THREE.PlaneGeometry(3000, 3000);
        const groundMat = new THREE.MeshStandardMaterial({ color: 0x2b4a2c });
        const ground = new THREE.Mesh(groundGeo, groundMat);
        ground.rotation.x = -Math.PI / 2;
        ground.position.y = -10;
        ground.receiveShadow = true;
        this.scene.add(ground);

        const loader = new GLTFLoader();
        // Ruta relativa al documento (index.html en la raíz del proyecto)
        loader.load('assets/models/ciclista.glb', (gltf) => {
            this.bikeMesh = gltf.scene;
            this.bikeMesh.scale.set(1.5, 1.5, 1.5);
            this.bikeMesh.traverse((child) => {
                if (child.isMesh) {
                    child.castShadow = true;
                    child.receiveShadow = true;
                }
            });
            this.scene.add(this.bikeMesh);
        }, undefined, (err) => {
            console.warn('RideRenderer3D: No se pudo cargar ciclista.glb', err);
        });

        window.addEventListener('resize', () => this.onResize());
    }

    /**
     * Construir geometría de la carretera a partir de state.route.points
     */
    generateRoadGeometry(points, totalLength) {
        if (this.roadMesh) {
            this.scene.remove(this.roadMesh);
            this.roadMesh.geometry.dispose();
            this.roadMesh.material.dispose();
        }

        const step = 5;
        const threePoints = [];

        for (let d = 0; d <= totalLength; d += step) {
            const pt = getPointAtDistance(points, d);
            const { x, z } = getHorizontalPositionAtDistance(d);
            threePoints.push(new THREE.Vector3(x, pt.elevation, z));
        }

        if (threePoints.length < 2) {
            return;
        }

        this.roadCurve = new THREE.CatmullRomCurve3(threePoints);

        const roadWidth = 6;
        const roadShape = new THREE.Shape();
        roadShape.moveTo(-roadWidth / 2, 0);
        roadShape.lineTo(roadWidth / 2, 0);
        roadShape.lineTo(roadWidth / 2, -0.15);
        roadShape.lineTo(-roadWidth / 2, -0.15);
        roadShape.closePath();

        const extrudeSettings = {
            steps: Math.max(1, Math.floor(threePoints.length * 1.5)),
            bevelEnabled: false,
            extrudePath: this.roadCurve,
        };

        const roadGeometry = new THREE.ExtrudeGeometry(roadShape, extrudeSettings);
        const roadMaterial = new THREE.MeshStandardMaterial({
            color: 0x333333,
            roughness: 0.85,
            metalness: 0.1,
        });
        this.roadMesh = new THREE.Mesh(roadGeometry, roadMaterial);
        this.roadMesh.receiveShadow = true;
        this.roadMesh.castShadow = true;
        this.scene.add(this.roadMesh);

        this.generatedRouteLength = totalLength;
    }

    /**
     * Renderizar un frame
     * @param {Object} state - Estado del RideEngine (position.distance, route.points, route.length, status)
     * @param {Object} worldConfig - Configuración del mundo (opcional)
     */
    render(state, worldConfig) {
        const points = state.route?.points || [];
        const totalLength = state.route?.length || 0;

        if (points.length > 0 && totalLength > 0) {
            const needBuild = !this.roadCurve || this.generatedRouteLength !== totalLength;
            if (needBuild) {
                this.generateRoadGeometry(points, totalLength);
            }
        }

        if (!this.roadCurve) {
            this.renderer.render(this.scene, this.camera);
            return;
        }

        const distance = state.position?.distance ?? 0;
        const t = Math.min(1, Math.max(0, distance / this.generatedRouteLength));

        const position = this.roadCurve.getPointAt(t);
        const tangent = this.roadCurve.getTangentAt(t).clone().normalize();

        if (this.bikeMesh) {
            this.bikeMesh.position.copy(position);
            const lookAtPoint = position.clone().add(tangent);
            this.bikeMesh.lookAt(lookAtPoint);
        }

        const cameraOffset = tangent.clone().multiplyScalar(-8).add(new THREE.Vector3(0, 3, 0));
        const cameraPos = position.clone().add(cameraOffset);
        this.camera.position.lerp(cameraPos, 0.08);
        this.camera.lookAt(position.clone().add(new THREE.Vector3(0, 1.2, 0)));

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
        window.removeEventListener('resize', () => this.onResize());
        if (this.roadMesh) {
            this.scene.remove(this.roadMesh);
            this.roadMesh.geometry?.dispose();
            this.roadMesh.material?.dispose();
        }
        this.renderer.dispose();
    }
}

/**
 * Factory para compatibilidad con createRideRenderer(canvas)
 */
export function createRideRenderer3D(canvas) {
    return new RideRenderer3D(canvas);
}
