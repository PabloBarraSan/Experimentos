/**
 * GameRenderer - Renderizado 3D con Three.js
 * Smart Trainer - Power Rush (Versión Corregida: Perspectiva Frontal)
 */

export const UI_STRIP_HEIGHT = 100; // Necesario para que el Engine calcule el suelo

import * as THREE from 'https://unpkg.com/three@0.160.0/build/three.module.js';
import { GLTFLoader } from 'https://unpkg.com/three@0.160.0/examples/jsm/loaders/GLTFLoader.js';
import { getCurrentPowerZone, GAME_STATUS, LANE_WIDTH } from './GameState.js';

// =============================================================================
// COLORES Y CONFIGURACIÓN UI
// =============================================================================
const BG_COLORS = { 1: '#1a1a2e', 2: '#16213e', 3: '#1a1a1a', 4: '#2d132c', 5: '#3d0000', 6: '#4a0000', 7: '#4a004a' };

export function createGameRenderer(canvas) {
    // 1. CONFIGURACIÓN THREE.JS
    // --------------------------------------------------------
    const renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, alpha: false });
    renderer.setSize(canvas.width, canvas.height);
    renderer.shadowMap.enabled = true;

    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x111111, 0.02);
    scene.background = new THREE.Color(0x111111);

    // CÁMARA: La bajamos un poco para ver más "carretera"
    const camera = new THREE.PerspectiveCamera(60, canvas.width / canvas.height, 0.1, 1000);
    camera.position.set(0, 2.5, 6); 
    camera.lookAt(0, 1, -10); // Miramos hacia el horizonte infinito

    // LUCES
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0x00d4aa, 2);
    dirLight.position.set(5, 10, 7);
    dirLight.castShadow = true;
    scene.add(dirLight);

    // Luz del ciclista (Faro delantero)
    const headLight = new THREE.SpotLight(0xffffff, 10);
    headLight.position.set(0, 2, 0);
    headLight.target.position.set(0, 0, -10);
    headLight.angle = Math.PI / 6;
    headLight.penumbra = 0.5;
    scene.add(headLight);
    scene.add(headLight.target);

    // SUELO
    const gridHelper = new THREE.GridHelper(200, 200, 0x00d4aa, 0x222222);
    scene.add(gridHelper);
    
    const planeGeometry = new THREE.PlaneGeometry(50, 200);
    const planeMaterial = new THREE.MeshBasicMaterial({ color: 0x0a0a0a });
    const plane = new THREE.Mesh(planeGeometry, planeMaterial);
    plane.rotation.x = -Math.PI / 2;
    plane.position.y = -0.1;
    scene.add(plane);

    const collectiblesGroup = new THREE.Group();
    scene.add(collectiblesGroup);

    const obstaclesGroup = new THREE.Group();
    scene.add(obstaclesGroup);

    const streetlightsGroup = new THREE.Group();
    scene.add(streetlightsGroup);

    // 2. CARGAR ASSETS
    // --------------------------------------------------------
    const loader = new GLTFLoader();
    
    // A) CICLISTA
    let bikeModel = null;
    loader.load('./assets/models/ciclista.glb', (gltf) => {
        bikeModel = gltf.scene;
        bikeModel.scale.set(1.5, 1.5, 1.5); 
        bikeModel.position.set(0, 0, 0);
        
        // CORRECCIÓN 1: ROTARLO 180 GRADOS PARA QUE MIRE AL FRENTE
        bikeModel.rotation.y = Math.PI; 
        
        scene.add(bikeModel);
        console.log("✅ Ciclista cargado");
    }, undefined, (err) => console.error("Error ciclista:", err));

    // B) MONEDA
    let coinTemplate = null;
    loader.load('./assets/models/moneda.glb', (gltf) => {
        coinTemplate = gltf.scene;
        coinTemplate.scale.set(0.5, 0.5, 0.5);
        console.log("✅ Moneda cargada");
    }, undefined, (err) => console.error("Error moneda:", err));

    // C) BARRERA (obstáculo) — escala grande y rojo neón
    let obstacleTemplate = null;
    loader.load('./assets/models/barrera.glb', (gltf) => {
        obstacleTemplate = gltf.scene;
        obstacleTemplate.scale.set(5, 5, 5);
        obstacleTemplate.traverse((child) => {
            if (child.isMesh) {
                child.material = new THREE.MeshStandardMaterial({
                    color: 0xff0000,
                    emissive: 0xff0000,
                    emissiveIntensity: 0.8,
                    roughness: 0.4
                });
            }
        });
        console.log("✅ Barrera cargada, escalada y pintada");
    }, undefined, (err) => console.error("Error barrera:", err));

    // D) FAROLAS (decoración, borde carretera)
    let streetlightTemplate = null;
    loader.load('./assets/models/farola.glb', (gltf) => {
        streetlightTemplate = gltf.scene;
        streetlightTemplate.scale.set(2, 2, 2);
        streetlightTemplate.traverse((child) => {
            if (child.isMesh) {
                child.material = new THREE.MeshStandardMaterial({
                    color: 0x333333,
                    emissive: 0xffaa33,
                    emissiveIntensity: 0.6,
                    roughness: 0.5
                });
            }
        });
        console.log("✅ Farola cargada");
    }, undefined, (err) => console.error("Error farola:", err));

    // 3. CAPA DE INTERFAZ 2D (HUD)
    // --------------------------------------------------------
    const hudCanvas = document.createElement('canvas');
    hudCanvas.style.position = 'absolute';
    hudCanvas.style.top = canvas.offsetTop + 'px';
    hudCanvas.style.left = canvas.offsetLeft + 'px';
    hudCanvas.style.pointerEvents = 'none';
    hudCanvas.width = canvas.width;
    hudCanvas.height = canvas.height;
    document.body.appendChild(hudCanvas);
    const ctx = hudCanvas.getContext('2d');

    function resize() {
        const parent = canvas.parentElement;
        if (parent) {
            canvas.width = parent.clientWidth;
            canvas.height = parent.clientHeight;
            renderer.setSize(canvas.width, canvas.height);
            camera.aspect = canvas.width / canvas.height;
            camera.updateProjectionMatrix();
            hudCanvas.width = canvas.width;
            hudCanvas.height = canvas.height;
            hudCanvas.style.top = canvas.offsetTop + 'px';
            hudCanvas.style.left = canvas.offsetLeft + 'px';
        }
    }
    window.addEventListener('resize', resize);
    resize();

    // 4. BUCLE DE RENDERIZADO PRINCIPAL (CORREGIDO)
    // --------------------------------------------------------
    function render(state) {
        // --- A) MUNDO 3D ---

        // 1. CICLISTA (posición X = carril suavizado, Y = salto) + faro que persigue
        if (bikeModel) {
            bikeModel.position.x = state.cyclist.x;
            const jumpHeight = Math.max(0, state.cyclist.y * 0.05);
            bikeModel.position.y = jumpHeight;
            if (state.bikeData.cadence > 0) {
                bikeModel.rotation.z = Math.sin(Date.now() * 0.005) * 0.05;
            }
            headLight.position.x = bikeModel.position.x;
            headLight.position.y = bikeModel.position.y + 2;
            headLight.target.position.x = bikeModel.position.x;
            headLight.target.position.z = bikeModel.position.z - 10;
        }

        // 2. SUELO (scroll por distancia recorrida)
        const distance = state.distanceTraveled != null ? state.distanceTraveled : 0;
        gridHelper.position.z = (distance * 0.5) % 10;

        // 3. OBSTÁCULOS (barreras) y MONEDAS
        while (obstaclesGroup.children.length) obstaclesGroup.remove(obstaclesGroup.children[0]);
        while (collectiblesGroup.children.length) collectiblesGroup.remove(collectiblesGroup.children[0]);

        // 3a. Obstáculos (barreras) — lane y z desde el engine
        if (obstacleTemplate && state.obstacles && state.obstacles.length > 0) {
            state.obstacles.forEach(obs => {
                if (obs.active) {
                    const mesh = obstacleTemplate.clone();
                    mesh.position.x = obs.lane * LANE_WIDTH;
                    mesh.position.z = obs.z;
                    mesh.position.y = 0;
                    if (mesh.position.z < 10 && mesh.position.z > -110) {
                        obstaclesGroup.add(mesh);
                    }
                }
            });
        }

        // 3b. Monedas — lane y z desde el engine
        if (coinTemplate && state.collectibles && state.collectibles.length > 0) {
            state.collectibles.forEach(coin => {
                if (coin.active) {
                    const mesh = coinTemplate.clone();
                    mesh.position.x = coin.lane * LANE_WIDTH;
                    mesh.position.z = coin.z;
                    mesh.position.y = 0.5;
                    if (mesh.position.z < 10 && mesh.position.z > -110) {
                        mesh.rotation.y = Date.now() * 0.003;
                        collectiblesGroup.add(mesh);
                    }
                }
            });
        }

        // 3c. Farolas (decoración, borde carretera, scroll con el mundo)
        while (streetlightsGroup.children.length) streetlightsGroup.remove(streetlightsGroup.children[0]);
        if (streetlightTemplate) {
            const baseZ = 10 - (distance * 0.5) % 25;
            for (let n = 0; n < 12; n++) {
                const z = baseZ - n * 25;
                if (z > -100 && z < 15) {
                    const left = streetlightTemplate.clone();
                    left.position.set(-6, 0, z);
                    streetlightsGroup.add(left);
                    const right = streetlightTemplate.clone();
                    right.position.set(6, 0, z);
                    streetlightsGroup.add(right);
                }
            }
        }

        renderer.render(scene, camera);

        // --- B) HUD 2D ---
        ctx.clearRect(0, 0, hudCanvas.width, hudCanvas.height);
        
        if (state.status === GAME_STATUS.PLAYING || state.status === GAME_STATUS.PAUSED) {
            renderTopDashboard(ctx, state, hudCanvas.width, hudCanvas.height);
            if (state.status === GAME_STATUS.PAUSED) {
                ctx.fillStyle = 'rgba(0,0,0,0.6)';
                ctx.fillRect(0, 0, hudCanvas.width, hudCanvas.height);
                ctx.fillStyle = '#00d4aa';
                ctx.font = 'bold 28px sans-serif';
                ctx.textAlign = 'center';
                ctx.fillText('PAUSADO', hudCanvas.width / 2, hudCanvas.height / 2);
            }
        } else if (state.status === GAME_STATUS.MENU) {
            renderMenuScreen(ctx, state, hudCanvas.width, hudCanvas.height);
        } else if (state.status === GAME_STATUS.GAME_OVER) {
            renderGameOverScreen(ctx, state, hudCanvas.width, hudCanvas.height);
        }
    }

    // Dashboard superior: métricas del entrenamiento
    function renderTopDashboard(ctx, state, w, h) {
        const barHeight = 56;
        ctx.fillStyle = 'rgba(0,0,0,0.75)';
        ctx.fillRect(0, 0, w, barHeight);
        ctx.strokeStyle = 'rgba(0, 212, 170, 0.4)';
        ctx.lineWidth = 1;
        ctx.strokeRect(0, 0, w, barHeight);

        const pad = 16;
        const col = (x, text, color) => {
            ctx.fillStyle = color || '#e0e0e0';
            ctx.font = '14px monospace';
            ctx.textAlign = 'left';
            ctx.fillText(text, x, 22);
        };
        const val = (x, text, color) => {
            ctx.fillStyle = color || '#fff';
            ctx.font = 'bold 18px monospace';
            ctx.fillText(text, x, 42);
        };

        let x = pad;
        const zone = getCurrentPowerZone(state.bikeData.power, state.ftp);
        col(x, 'Potencia', zone.color);
        val(x, `${state.bikeData.power || 0} W`, zone.color);
        x += 90;
        col(x, 'Cadencia', '#aaa');
        val(x, `${state.bikeData.cadence || 0} RPM`, '#fff');
        x += 90;
        col(x, 'Velocidad', '#aaa');
        val(x, `${state.bikeData.speed || 0} km/h`, '#fff');
        x += 85;
        col(x, 'FC', '#aaa');
        val(x, state.bikeData.heartRate != null ? `${state.bikeData.heartRate} bpm` : '--', '#fff');

        ctx.textAlign = 'left';
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 16px monospace';
        ctx.fillText(`SCORE: ${state.score}`, w * 0.5 - 60, 36);
        ctx.textAlign = 'right';
        ctx.fillText(`❤️ ${state.lives}`, w - pad, 36);
    }

    function renderMenuScreen(ctx, state, w, h) {
        ctx.fillStyle = 'rgba(0,0,0,0.8)';
        ctx.fillRect(0,0,w,h);
        ctx.fillStyle = '#00d4aa';
        ctx.font = 'bold 40px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText("POWER RUSH 3D", w/2, h/2);
        ctx.fillStyle = 'white';
        ctx.font = '20px sans-serif';
        ctx.fillText("Pedalea para empezar", w/2, h/2 + 50);
    }

    function renderGameOverScreen(ctx, state, w, h) {
        ctx.fillStyle = 'rgba(50,0,0,0.8)';
        ctx.fillRect(0,0,w,h);
        ctx.fillStyle = 'red';
        ctx.font = 'bold 40px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText("GAME OVER", w/2, h/2);
    }

    return {
        render,
        resize,
        destroy: () => {
            window.removeEventListener('resize', resize);
            if(hudCanvas.parentNode) hudCanvas.parentNode.removeChild(hudCanvas);
        }
    };
}