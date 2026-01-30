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
 * Interpolar punto de ruta a una distancia dada (búsqueda binaria O(log n))
 */
function getPointAtDistance(points, distance) {
    if (!points || points.length === 0) {
        return { distance: 0, elevation: 0, grade: 0 };
    }
    
    // Casos límite
    if (distance <= points[0].distance) {
        return points[0];
    }
    if (distance >= points[points.length - 1].distance) {
        return points[points.length - 1];
    }
    
    // Búsqueda binaria
    let left = 0;
    let right = points.length - 1;
    
    while (left < right - 1) {
        const mid = Math.floor((left + right) / 2);
        if (points[mid].distance <= distance) {
            left = mid;
        } else {
            right = mid;
        }
    }
    
    const p1 = points[left];
    const p2 = points[right];
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
        
        // Referencias a elementos que se actualizan con worldConfig
        this.ground = null;
        this.dirLight = null;
        this.hemiLight = null;
        this.currentWorldId = null;
        this.roadMarkings = null;
        
        // Sistema de bots 3D
        this.botMeshes = new Map(); // id -> mesh
        
        // Guardar referencia bound para poder eliminar el listener correctamente
        this._boundOnResize = this.onResize.bind(this);

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

        this.hemiLight = new THREE.HemisphereLight(0xffffff, 0x444444, 0.6);
        this.scene.add(this.hemiLight);

        this.dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
        this.dirLight.position.set(100, 150, 80);
        this.dirLight.castShadow = true;
        this.dirLight.shadow.mapSize.width = 2048;
        this.dirLight.shadow.mapSize.height = 2048;
        this.dirLight.shadow.camera.near = 0.5;
        this.dirLight.shadow.camera.far = 500;
        this.dirLight.shadow.camera.left = -150;
        this.dirLight.shadow.camera.right = 150;
        this.dirLight.shadow.camera.top = 150;
        this.dirLight.shadow.camera.bottom = -150;
        this.scene.add(this.dirLight);

        const groundGeo = new THREE.PlaneGeometry(3000, 3000);
        const groundMat = new THREE.MeshStandardMaterial({ color: 0x2b4a2c });
        this.ground = new THREE.Mesh(groundGeo, groundMat);
        this.ground.rotation.x = -Math.PI / 2;
        this.ground.position.y = -10;
        this.ground.receiveShadow = true;
        this.scene.add(this.ground);

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

        window.addEventListener('resize', this._boundOnResize);
    }

    /**
     * Construir geometría de la carretera a partir de state.route.points
     * Usa geometría de ribbon (cinta) para crear una carretera plana que sigue la curva
     * @param {Array} points - Puntos de la ruta
     * @param {number} totalLength - Longitud total de la ruta
     * @param {Object} worldConfig - Configuración del mundo (opcional)
     */
    generateRoadGeometry(points, totalLength, worldConfig = null) {
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
        
        // Crear geometría de carretera como ribbon (cinta plana)
        const roadWidth = 8;
        const segments = Math.max(10, Math.floor(threePoints.length * 2));
        
        const vertices = [];
        const indices = [];
        const uvs = [];
        
        for (let i = 0; i <= segments; i++) {
            const t = i / segments;
            const point = this.roadCurve.getPointAt(t);
            const tangent = this.roadCurve.getTangentAt(t).normalize();
            
            // Vector perpendicular en el plano XZ (horizontal)
            const perpendicular = new THREE.Vector3(-tangent.z, 0, tangent.x).normalize();
            
            // Puntos izquierdo y derecho de la carretera
            const left = point.clone().add(perpendicular.clone().multiplyScalar(-roadWidth / 2));
            const right = point.clone().add(perpendicular.clone().multiplyScalar(roadWidth / 2));
            
            // Elevar ligeramente sobre el terreno
            left.y += 0.05;
            right.y += 0.05;
            
            vertices.push(left.x, left.y, left.z);
            vertices.push(right.x, right.y, right.z);
            
            // UVs para textura
            uvs.push(0, t);
            uvs.push(1, t);
            
            // Crear triángulos (excepto en el último segmento)
            if (i < segments) {
                const base = i * 2;
                // Triángulo 1
                indices.push(base, base + 1, base + 2);
                // Triángulo 2
                indices.push(base + 1, base + 3, base + 2);
            }
        }
        
        const roadGeometry = new THREE.BufferGeometry();
        roadGeometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
        roadGeometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
        roadGeometry.setIndex(indices);
        roadGeometry.computeVertexNormals();
        
        // Usar color de carretera del worldConfig si está disponible
        const roadColor = worldConfig?.roadColors?.main || 0x333333;
        const roadMaterial = new THREE.MeshStandardMaterial({
            color: roadColor,
            roughness: 0.85,
            metalness: 0.1,
            side: THREE.DoubleSide, // Visible desde ambos lados
        });
        
        this.roadMesh = new THREE.Mesh(roadGeometry, roadMaterial);
        this.roadMesh.receiveShadow = true;
        this.roadMesh.castShadow = true;
        this.scene.add(this.roadMesh);
        
        // Añadir línea central de la carretera
        this.addRoadMarkings(roadColor, worldConfig);

        this.generatedRouteLength = totalLength;
    }
    
    /**
     * Añadir marcas de carretera (línea central)
     */
    addRoadMarkings(roadColor, worldConfig) {
        if (this.roadMarkings) {
            this.scene.remove(this.roadMarkings);
            this.roadMarkings.geometry?.dispose();
            this.roadMarkings.material?.dispose();
        }
        
        if (!this.roadCurve) return;
        
        // Línea central discontinua
        const linePoints = [];
        const segments = 200;
        const dashLength = 0.02; // Proporción de cada dash
        
        for (let i = 0; i < segments; i++) {
            const t = i / segments;
            // Crear línea discontinua (solo cada 2 segmentos)
            if (Math.floor(i / 2) % 2 === 0) {
                const point = this.roadCurve.getPointAt(t);
                point.y += 0.1; // Ligeramente sobre la carretera
                linePoints.push(point);
            }
        }
        
        if (linePoints.length < 2) return;
        
        const lineGeometry = new THREE.BufferGeometry().setFromPoints(linePoints);
        const lineColor = worldConfig?.roadColors?.line || 0xffffff;
        const lineMaterial = new THREE.LineBasicMaterial({ 
            color: lineColor,
            linewidth: 2,
        });
        
        this.roadMarkings = new THREE.Line(lineGeometry, lineMaterial);
        this.scene.add(this.roadMarkings);
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
        
        // Colores del cielo
        const skyColors = worldConfig.skyColors || {};
        const skyColor = new THREE.Color(skyColors.top || '#87ceeb');
        this.scene.background = skyColor;
        
        // Niebla según configuración del mundo
        const ambient = worldConfig.ambient || {};
        if (ambient.fog && ambient.fogColor) {
            const fogColor = new THREE.Color(ambient.fogColor);
            const fogDensity = ambient.fogDensity || 0.2;
            // Ajustar distancias de niebla según densidad
            const fogNear = 50 / (1 + fogDensity);
            const fogFar = 800 * (1 - fogDensity * 0.5);
            this.scene.fog = new THREE.Fog(fogColor, fogNear, fogFar);
        } else {
            // Niebla por defecto basada en el color del cielo
            this.scene.fog = new THREE.Fog(skyColor, 50, 800);
        }
        
        // Color del suelo según paisaje
        const landscape = worldConfig.landscape || {};
        if (landscape.groundColor && this.ground) {
            this.ground.material.color.set(landscape.groundColor);
        }
        
        // Ajustar iluminación según hora del día
        const timeOfDay = worldConfig.timeOfDay || 'afternoon';
        this.adjustLightingForTimeOfDay(timeOfDay, skyColors);
        
        // Color de la carretera según mundo
        const roadColors = worldConfig.roadColors || {};
        if (this.roadMesh && roadColors.main) {
            this.roadMesh.material.color.set(roadColors.main);
        }
    }
    
    /**
     * Ajustar iluminación según hora del día
     */
    adjustLightingForTimeOfDay(timeOfDay, skyColors) {
        switch (timeOfDay) {
            case 'morning':
                this.dirLight.intensity = 0.7;
                this.dirLight.color.set('#fffaf0');
                this.hemiLight.intensity = 0.5;
                this.dirLight.position.set(80, 100, 100);
                break;
            case 'afternoon':
                this.dirLight.intensity = 0.8;
                this.dirLight.color.set('#ffffff');
                this.hemiLight.intensity = 0.6;
                this.dirLight.position.set(100, 150, 80);
                break;
            case 'sunset':
                this.dirLight.intensity = 0.6;
                this.dirLight.color.set('#ffaa66');
                this.hemiLight.intensity = 0.4;
                this.hemiLight.color.set('#ffccaa');
                this.dirLight.position.set(150, 50, 50);
                break;
            case 'night':
                this.dirLight.intensity = 0.2;
                this.dirLight.color.set('#6666aa');
                this.hemiLight.intensity = 0.15;
                this.hemiLight.color.set(skyColors.horizon || '#333355');
                this.dirLight.position.set(50, 100, 50);
                break;
            default:
                this.dirLight.intensity = 0.8;
                this.hemiLight.intensity = 0.6;
        }
    }
    
    /**
     * Crear o actualizar mesh de un bot
     * @param {Object} bot - Datos del bot
     * @returns {THREE.Mesh} - Mesh del bot
     */
    getOrCreateBotMesh(bot) {
        if (this.botMeshes.has(bot.id)) {
            return this.botMeshes.get(bot.id);
        }
        
        // Crear un grupo para el bot (ciclista simplificado)
        const botGroup = new THREE.Group();
        
        // Cuerpo del ciclista (cilindro)
        const bodyGeometry = new THREE.CylinderGeometry(0.3, 0.3, 1.2, 8);
        const bodyMaterial = new THREE.MeshStandardMaterial({ 
            color: bot.color || '#00aaff',
            roughness: 0.7,
            metalness: 0.2,
        });
        const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
        body.position.y = 1.0;
        body.castShadow = true;
        botGroup.add(body);
        
        // Cabeza (esfera)
        const headGeometry = new THREE.SphereGeometry(0.25, 8, 8);
        const headMaterial = new THREE.MeshStandardMaterial({ 
            color: '#ffcc99',
            roughness: 0.8,
        });
        const head = new THREE.Mesh(headGeometry, headMaterial);
        head.position.y = 1.8;
        head.castShadow = true;
        botGroup.add(head);
        
        // Bicicleta simplificada (caja)
        const bikeGeometry = new THREE.BoxGeometry(0.4, 0.5, 1.5);
        const bikeMaterial = new THREE.MeshStandardMaterial({ 
            color: '#333333',
            roughness: 0.5,
            metalness: 0.5,
        });
        const bike = new THREE.Mesh(bikeGeometry, bikeMaterial);
        bike.position.y = 0.4;
        bike.castShadow = true;
        botGroup.add(bike);
        
        // Ruedas (cilindros)
        const wheelGeometry = new THREE.CylinderGeometry(0.35, 0.35, 0.1, 16);
        const wheelMaterial = new THREE.MeshStandardMaterial({ 
            color: '#1a1a1a',
            roughness: 0.9,
        });
        
        const frontWheel = new THREE.Mesh(wheelGeometry, wheelMaterial);
        frontWheel.rotation.x = Math.PI / 2;
        frontWheel.position.set(0, 0.35, 0.5);
        frontWheel.castShadow = true;
        botGroup.add(frontWheel);
        
        const backWheel = new THREE.Mesh(wheelGeometry, wheelMaterial);
        backWheel.rotation.x = Math.PI / 2;
        backWheel.position.set(0, 0.35, -0.5);
        backWheel.castShadow = true;
        botGroup.add(backWheel);
        
        this.scene.add(botGroup);
        this.botMeshes.set(bot.id, botGroup);
        
        return botGroup;
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
        for (const [id, mesh] of this.botMeshes) {
            if (!activeBotIds.has(id)) {
                mesh.visible = false;
            }
        }
        
        // Actualizar o crear meshes para bots visibles
        for (const bot of bots) {
            if (!bot.visible) continue;
            
            const mesh = this.getOrCreateBotMesh(bot);
            mesh.visible = true;
            
            // Calcular posición en la curva
            const t = Math.min(1, Math.max(0, bot.distance / this.generatedRouteLength));
            const position = this.roadCurve.getPointAt(t);
            const tangent = this.roadCurve.getTangentAt(t).clone().normalize();
            
            // Posicionar el bot
            mesh.position.copy(position);
            mesh.position.y = position.y + 0.1; // Ligeramente sobre la carretera
            
            // Orientar hacia la dirección de movimiento
            const lookAtPoint = position.clone().add(tangent);
            mesh.lookAt(lookAtPoint);
            
            // Escalar según distancia (perspectiva)
            const scale = bot.scale || 1;
            mesh.scale.set(scale, scale, scale);
        }
    }
    
    /**
     * Limpiar meshes de bots
     */
    clearBots() {
        for (const [id, mesh] of this.botMeshes) {
            this.scene.remove(mesh);
            // Dispose de geometrías y materiales
            mesh.traverse((child) => {
                if (child.geometry) child.geometry.dispose();
                if (child.material) child.material.dispose();
            });
        }
        this.botMeshes.clear();
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
            const needBuild = !this.roadCurve || this.generatedRouteLength !== totalLength;
            if (needBuild) {
                this.generateRoadGeometry(points, totalLength, worldConfig);
            }
        }

        if (!this.roadCurve) {
            this.renderer.render(this.scene, this.camera);
            return;
        }

        const distance = state.position?.distance ?? 0;
        const t = Math.min(1, Math.max(0, distance / this.generatedRouteLength));
        const currentGrade = state.currentGrade || 0;

        const position = this.roadCurve.getPointAt(t);
        const tangent = this.roadCurve.getTangentAt(t).clone().normalize();
        
        // Calcular posición del ciclista sobre la carretera
        const bikePosition = position.clone();
        bikePosition.y += 0.5; // Elevar ciclista para que esté sobre el asfalto

        if (this.bikeMesh) {
            this.bikeMesh.position.copy(bikePosition);
            const lookAtPoint = bikePosition.clone().add(tangent);
            this.bikeMesh.lookAt(lookAtPoint);
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
        
        this.camera.position.lerp(cameraPos, 0.06); // Lerp más suave
        this.camera.lookAt(bikePosition.clone().add(new THREE.Vector3(0, 1.0, 0)));
        
        // Actualizar bots
        if (state.bots && state.bots.length > 0) {
            this.updateBots(state.bots, distance);
        }

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
        
        // Limpiar bots
        this.clearBots();
        
        if (this.roadMesh) {
            this.scene.remove(this.roadMesh);
            this.roadMesh.geometry?.dispose();
            this.roadMesh.material?.dispose();
        }
        if (this.roadMarkings) {
            this.scene.remove(this.roadMarkings);
            this.roadMarkings.geometry?.dispose();
            this.roadMarkings.material?.dispose();
        }
        if (this.bikeMesh) {
            this.scene.remove(this.bikeMesh);
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
export function createRideRenderer3D(canvas) {
    return new RideRenderer3D(canvas);
}
