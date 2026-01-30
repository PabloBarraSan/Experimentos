/**
 * GameEngine - Motor de 3 Carriles (Endless Runner)
 */

import { createGameState, resetGameState, calculateWorldSpeed, GAME_STATUS, LANES, LANE_WIDTH } from './GameState.js';

// CONFIGURACIÓN DEL JUEGO
const SPAWN_DISTANCE = -100; // Donde aparecen los objetos (al fondo)
const COLLISION_THRESHOLD = 1.5; // Distancia Z para considerar choque
const LANE_SWITCH_SPEED = 10.0; // Qué tan rápido se mueve lateralmente la bici

export function createGameEngine(options = {}) {
    const { canvas, ftp = 200, onScoreUpdate = () => {}, onGameOver = () => {} } = options;

    let state = createGameState(ftp);
    let lastTime = 0;
    let animId = null;
    let renderer = null;

    // --- BUCLE PRINCIPAL ---
    function gameLoop(timestamp) {
        const dt = (timestamp - lastTime) / 1000; // Delta time en SEGUNDOS
        lastTime = timestamp;

        if (state.status === GAME_STATUS.PLAYING) {
            update(dt);
        }

        if (renderer) renderer.render(state);
        animId = requestAnimationFrame(gameLoop);
    }

    // --- LÓGICA DEL JUEGO ---
    function update(dt) {
        // 1. Calcular velocidad basada en pedaleo
        const speed = calculateWorldSpeed(state.bikeData.power, state.ftp);
        state.worldSpeed = speed;
        state.distanceTraveled += speed * dt;

        // 2. Mover Ciclista (Suavizado lateral)
        // El 'lane' es el objetivo (-1, 0, 1), 'x' es la posición visual real
        const targetX = state.cyclist.lane * LANE_WIDTH;
        // Interpolación lineal (Lerp) para movimiento suave
        state.cyclist.x += (targetX - state.cyclist.x) * LANE_SWITCH_SPEED * dt;

        // 3. Generador de Obstáculos (Spawn System)
        state.timeSinceLastSpawn += dt;
        const spawnRate = 2.0; // Segundos entre objetos (base)

        if (state.timeSinceLastSpawn > spawnRate) {
            spawnEntity();
            state.timeSinceLastSpawn = 0;
        }

        // 4. Actualizar Entidades (Moverlas hacia el jugador)
        // OBSTÁCULOS
        for (let i = state.obstacles.length - 1; i >= 0; i--) {
            const obs = state.obstacles[i];
            obs.z += speed * dt; // Mover hacia positivo (hacia la cámara)

            // Detección de Colisión
            if (obs.active && Math.abs(obs.z) < COLLISION_THRESHOLD && obs.lane === state.cyclist.lane) {
                console.log("CRASH!");
                state.lives--;
                state.screenShake = 0.5;
                obs.active = false;

                if (state.lives <= 0) gameOver();
            }

            if (obs.z > 10) state.obstacles.splice(i, 1);
        }

        // COLECCIONABLES (Monedas)
        for (let i = state.collectibles.length - 1; i >= 0; i--) {
            const coin = state.collectibles[i];
            coin.z += speed * dt;

            if (coin.active && Math.abs(coin.z) < COLLISION_THRESHOLD && coin.lane === state.cyclist.lane) {
                state.score += 100;
                coin.active = false;
                onScoreUpdate({ score: state.score, lives: state.lives });
            }

            if (coin.z > 10) state.collectibles.splice(i, 1);
        }
    }

    // --- SISTEMA DE GENERACIÓN ---
    function spawnEntity() {
        const lane = Math.floor(Math.random() * 3) - 1;
        const isCoin = Math.random() < 0.3;

        if (isCoin) {
            state.collectibles.push({
                lane: lane,
                z: SPAWN_DISTANCE,
                active: true
            });
        } else {
            state.obstacles.push({
                lane: lane,
                z: SPAWN_DISTANCE,
                active: true
            });
        }
    }

    // --- CONTROLES PÚBLICOS ---
    function moveLeft() {
        if (state.cyclist.lane > -1) state.cyclist.lane--;
    }

    function moveRight() {
        if (state.cyclist.lane < 1) state.cyclist.lane++;
    }

    function updateBikeData(data) {
        state.bikeData = {
            power: data.power || 0,
            cadence: data.cadence || 0,
            speed: data.speed || 0,
            heartRate: data.heartRate != null ? data.heartRate : null
        };
    }

    function start() {
        if (state.status !== GAME_STATUS.PLAYING) {
            state = resetGameState(state);
            state.status = GAME_STATUS.PLAYING;
            lastTime = performance.now();
        }
        if (!animId) animId = requestAnimationFrame(gameLoop);
    }

    function stop() {
        if (animId) {
            cancelAnimationFrame(animId);
            animId = null;
        }
        if (state) state.status = GAME_STATUS.MENU;
    }

    function pause() {
        if (state.status === GAME_STATUS.PLAYING) {
            state.status = GAME_STATUS.PAUSED;
        }
    }

    function resume() {
        if (state.status === GAME_STATUS.PAUSED) {
            state.status = GAME_STATUS.PLAYING;
            lastTime = performance.now();
        }
    }

    function restart() {
        state = resetGameState(state);
        state.status = GAME_STATUS.PLAYING;
        lastTime = performance.now();
    }

    function gameOver() {
        state.status = GAME_STATUS.GAME_OVER;
        onGameOver({ score: state.score });
    }

    function destroy() {
        stop();
        state = null;
        renderer = null;
    }

    // Stubs para compatibilidad con GameView (controles salto/agacharse; por ahora solo carriles)
    function forceJump() {}
    function forceDuck() {}

    // Arrancar bucle para que se renderice desde el primer frame (menú, pausa, etc.)
    lastTime = performance.now();
    animId = requestAnimationFrame(gameLoop);

    // API
    return {
        start,
        stop,
        pause,
        resume,
        restart,
        destroy,
        updateBikeData,
        setRenderer: (r) => { renderer = r; },
        moveLeft,
        moveRight,
        forceJump,
        forceDuck,
        getState: () => state,
        setFTP: (ftp) => { state.ftp = ftp; }
    };
}
