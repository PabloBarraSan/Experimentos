/**
 * CyclistViewerView - Visor del ciclista
 * Smart Trainer Controller
 *
 * Muestra el modelo del ciclista (el mismo que usa la expedición) con la luz del juego:
 * se puede girar con el ratón o el dedo, hacer zoom, cambiar de color y ver el pelotón y el ghost.
 */

import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import {
    createCyclist, animateCyclist, disposeCyclist, getCyclistStyle, saveCyclistStyle,
    BIKE_PAINTS, RIDER_POSITIONS, DEFAULT_RIDER_POSITION,
} from '../expedition/Cyclist.js';
import { getRiderPrefs, saveRiderPrefs } from '../storage/settings.js';
import { preloadRiderAvatar, isRiderAvatarReady } from '../expedition/AvatarRider.js';
import { colors, spacing, typography } from '../utils/theme.js';
import { button, createElement, div } from '../utils/dom.js';

const RIDER_SCALE = 1.4;
const TARGET = new THREE.Vector3(0, 1.05, 0);
const GHOST_COLOR = 0x8ed9ff;

const JERSEYS = [
    { name: 'Menta', color: 0x63e0b5 },
    { name: 'Rosa', color: 0xff5c93 },
    { name: 'Azul', color: 0x3a63e0 },
    { name: 'Rojo', color: 0xc2283a },
    { name: 'Morado', color: 0x9b6bff },
    { name: 'Blanco', color: 0xf1f1ec },
];
const PELOTON_COLORS = [0xff5c93, 0x3a63e0, 0xc2283a, 0x9b6bff];

// Azimut en grados: 0 = de frente, 90 = lateral, 180 = de espaldas.
const VIEWS = [
    { id: 'rear', label: 'Trasera', azimuth: 205, distance: 4.6 },
    { id: 'three', label: '3/4', azimuth: 140, distance: 4.6 },
    { id: 'side', label: 'Lateral', azimuth: 90, distance: 4.8 },
    { id: 'front', label: 'Delantera', azimuth: 25, distance: 4.6 },
];

const hex = (value) => `#${value.toString(16).padStart(6, '0')}`;

export function CyclistViewerView({ onBack }) {
    // La posición y la pintura de la bici son las mismas que se eligen en el ride (se guardan en los ajustes).
    const savedRider = getRiderPrefs();
    const settings = {
        jersey: JERSEYS[0].color,
        position: RIDER_POSITIONS[savedRider.position] ? savedRider.position : DEFAULT_RIDER_POSITION,
        bikeColor: (BIKE_PAINTS.find((paint) => paint.id === savedRider.bikeColor) || BIKE_PAINTS[0]).id,
        view: 'rear',
        peloton: false,
        ghost: false,
        rpm: 85,
        playing: true,
        autoRotate: false,
        ...getCyclistStyle(),
    };

    const container = div({
        attrs: { 'data-view': 'cyclist-viewer' },
        styles: {
            position: 'fixed',
            inset: '0',
            zIndex: '20',
            background: '#0d1417',
            overflow: 'hidden',
            touchAction: 'none',
        },
    });
    const canvasHost = div({ styles: { position: 'absolute', inset: '0' } });
    container.appendChild(canvasHost);

    // ---- Escena: misma luz que la expedición (cielo/suelo + sol cálido con sombras) ----
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    canvasHost.appendChild(renderer.domElement);
    renderer.domElement.style.cssText = 'display:block;width:100%;height:100%;cursor:grab;';

    const scene = new THREE.Scene();
    // Fondo y niebla del mismo color: el suelo se funde con el cielo en el horizonte sin banda dura.
    scene.background = new THREE.Color(0xa9c4d6);
    scene.fog = new THREE.Fog(0xa9c4d6, 12, 46);
    scene.add(new THREE.HemisphereLight(0xcfe6ff, 0x6a7a50, 1.35));
    const sun = new THREE.DirectionalLight(0xffe2b8, 2.6);
    sun.position.set(-4, 7, -5);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    Object.assign(sun.shadow.camera, { left: -6, right: 6, top: 6, bottom: -6, near: 1, far: 24 });
    scene.add(sun);

    // Luz de relleno pegada a la cámara: así la cara y el frente no se quedan a oscuras al girar.
    const fill = new THREE.DirectionalLight(0xffffff, 1.0);
    fill.position.set(0.6, 0.9, 1);
    const road = new THREE.Mesh(
        new THREE.CircleGeometry(90, 64),
        new THREE.MeshStandardMaterial({ color: 0x4a5257, roughness: 0.95 }),
    );
    road.rotation.x = -Math.PI / 2;
    road.receiveShadow = true;
    scene.add(road);
    const laneLine = new THREE.Mesh(
        new THREE.PlaneGeometry(0.12, 60),
        new THREE.MeshStandardMaterial({ color: 0xe9e6dc, roughness: 0.9 }),
    );
    laneLine.rotation.x = -Math.PI / 2;
    laneLine.position.set(-3.2, 0.005, 0);
    scene.add(laneLine);

    const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 80);
    camera.add(fill);
    scene.add(camera);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.copy(TARGET);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.minDistance = 1.8;
    controls.maxDistance = 16;
    controls.maxPolarAngle = Math.PI * 0.52;
    controls.autoRotateSpeed = 1.6;

    // Distancia mínima para que quepan todos los ciclistas (cada bici ocupa ~1,9 m de media anchura).
    function fitDistance() {
        const halfWidthFov = Math.tan((camera.fov * Math.PI) / 360) * camera.aspect;
        const spread = entries.reduce((max, { rider }) => Math.max(max, Math.abs(rider.group.position.x)), 0);
        return (1.9 + spread) / Math.max(halfWidthFov, 0.05);
    }

    // Aleja la cámara lo justo si hace falta, sin cambiar el ángulo.
    function refit() {
        const needed = Math.min(fitDistance(), controls.maxDistance);
        if (camera.position.distanceTo(TARGET) < needed) {
            camera.position.sub(TARGET).setLength(needed).add(TARGET);
            controls.update();
        }
    }

    function setView(id) {
        const view = VIEWS.find((item) => item.id === id) || VIEWS[0];
        settings.view = view.id;
        const azimuth = (view.azimuth * Math.PI) / 180;
        const distance = Math.min(Math.max(view.distance, fitDistance()), controls.maxDistance);
        camera.position.set(
            TARGET.x + Math.sin(azimuth) * distance,
            TARGET.y + 0.45,
            TARGET.z + Math.cos(azimuth) * distance,
        );
        controls.update();
    }

    // ---- Ciclistas ----
    let entries = [];
    function disposeEntries() {
        // Las geometrías y materiales compartidos entre ciclistas (incluidos los de contorno) se conservan.
        entries.forEach(({ rider }) => disposeCyclist(rider));
        entries = [];
    }

    function buildRiders() {
        disposeEntries();
        const specs = [{ color: settings.jersey, ghost: false, x: 0, phase: 0 }];
        if (settings.peloton) {
            specs.push(
                { color: PELOTON_COLORS[0], ghost: false, x: -1.9, phase: 1.3 },
                { color: PELOTON_COLORS[1], ghost: false, x: 1.9, phase: 2.6 },
            );
        }
        if (settings.ghost) specs.push({ color: GHOST_COLOR, ghost: true, x: settings.peloton ? 3.8 : 1.9, phase: 0.6 });
        entries = specs.map(({ color, ghost, x, phase }) => {
            const rider = createCyclist({
                accent: color,
                ghost,
                style: { outline: settings.outline, shading: settings.shading, avatar: settings.avatar },
                bikeColor: settings.bikeColor,
                position: settings.position,
            });
            rider.group.scale.setScalar(ghost ? RIDER_SCALE * 0.96 : RIDER_SCALE);
            rider.group.position.x = x;
            scene.add(rider.group);
            return { rider, phase };
        });
        refit();
    }

    // ---- Interfaz ----
    const topBar = div({
        styles: {
            position: 'absolute',
            top: '0',
            left: '0',
            right: '0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: spacing.md,
            pointerEvents: 'none',
        },
    });
    const pill = {
        background: 'rgba(10,16,20,.72)',
        backdropFilter: 'blur(10px)',
        border: '1px solid rgba(255,255,255,.12)',
        borderRadius: '999px',
        color: colors.text,
        fontSize: typography.sizes.sm,
        padding: '8px 14px',
        pointerEvents: 'auto',
    };
    // Plegado por defecto en pantallas de poca altura: el panel tapaba media bici.
    let controlsVisible = window.innerHeight >= 760;
    const toggleControlsButton = button({
        text: controlsVisible ? 'Ocultar controles' : 'Mostrar controles',
        attrs: { 'aria-expanded': String(controlsVisible) },
        styles: { ...pill, cursor: 'pointer', fontWeight: '600' },
        events: { click: () => setControlsVisible(!controlsVisible) },
    });
    topBar.append(
        button({ text: '← Volver', styles: { ...pill, cursor: 'pointer', fontWeight: '600' }, events: { click: onBack } }),
        div({
            styles: { display: 'flex', alignItems: 'center', gap: spacing.sm },
            children: [
                toggleControlsButton,
                createElement('span', { text: 'Visor del ciclista', styles: { ...pill, pointerEvents: 'none' } }),
            ],
        }),
    );

    const panel = div({
        styles: {
            position: 'absolute',
            left: '50%',
            bottom: spacing.md,
            transform: 'translateX(-50%)',
            width: 'min(640px, calc(100% - 24px))',
            background: 'rgba(10,16,20,.78)',
            backdropFilter: 'blur(12px)',
            border: '1px solid rgba(255,255,255,.12)',
            borderRadius: '18px',
            padding: spacing.md,
            display: 'flex',
            flexDirection: 'column',
            gap: spacing.md,
            color: colors.text,
            maxHeight: 'calc(100% - 84px)',
            overflowY: 'auto',
        },
    });
    panel.style.display = controlsVisible ? 'flex' : 'none';

    const label = (text) => createElement('span', {
        text,
        styles: { fontSize: '11px', letterSpacing: '.08em', textTransform: 'uppercase', color: colors.textMuted, minWidth: '70px' },
    });
    const row = (title, ...children) => div({
        styles: { display: 'flex', alignItems: 'center', gap: spacing.sm, flexWrap: 'wrap' },
        children: [label(title), ...children],
    });
    const chipStyles = (active) => ({
        cursor: 'pointer',
        padding: '7px 12px',
        borderRadius: '999px',
        fontSize: typography.sizes.sm,
        fontWeight: '600',
        color: active ? '#0b1114' : colors.text,
        background: active ? '#63e0b5' : 'rgba(255,255,255,.08)',
        border: '1px solid rgba(255,255,255,.14)',
    });

    // Vistas
    const viewButtons = VIEWS.map((view) => button({
        text: view.label,
        styles: chipStyles(view.id === settings.view),
        events: { click: () => { controls.autoRotate = false; settings.autoRotate = false; setView(view.id); refreshChips(); } },
    }));
    const spinButton = button({
        text: 'Girar solo',
        styles: chipStyles(false),
        events: { click: () => { settings.autoRotate = !settings.autoRotate; controls.autoRotate = settings.autoRotate; refreshChips(); } },
    });

    // Colores del jersey
    const swatches = JERSEYS.map((jersey) => button({
        attrs: { 'aria-label': `Jersey ${jersey.name}`, title: jersey.name },
        styles: {
            width: '28px',
            height: '28px',
            borderRadius: '50%',
            cursor: 'pointer',
            background: hex(jersey.color),
            border: '2px solid rgba(255,255,255,.25)',
        },
        events: { click: () => { settings.jersey = jersey.color; buildRiders(); refreshChips(); } },
    }));

    // Posición sobre la bici y pintura de la bici: se aplican sin reconstruir los ciclistas
    const positionButtons = Object.values(RIDER_POSITIONS).map((position) => button({
        text: position.label,
        attrs: { title: `CdA ${position.cda.toFixed(2)} m²` },
        styles: chipStyles(position.id === settings.position),
        events: {
            click: () => {
                settings.position = position.id;
                saveRiderPrefs({ position: position.id });
                entries.forEach(({ rider }) => rider.setPosition(position.id));
                refreshChips();
            },
        },
    }));
    const bikeSwatches = BIKE_PAINTS.map((paint) => button({
        attrs: { 'aria-label': `Bici ${paint.name}`, title: paint.name },
        styles: {
            width: '28px',
            height: '28px',
            borderRadius: '50%',
            cursor: 'pointer',
            background: hex(paint.color),
            border: '2px solid rgba(255,255,255,.25)',
        },
        events: {
            click: () => {
                settings.bikeColor = paint.id;
                saveRiderPrefs({ bikeColor: paint.id });
                entries.forEach(({ rider }) => rider.setBikeColor(paint.color));
                refreshChips();
            },
        },
    }));

    // Opciones
    const toggle = (text, key) => button({
        text,
        styles: chipStyles(settings[key]),
        events: { click: () => { settings[key] = !settings[key]; buildRiders(); refreshChips(); } },
    });
    const pelotonButton = toggle('Pelotón', 'peloton');
    const ghostButton = toggle('Ghost', 'ghost');
    // El estilo se guarda y lo usa también la expedición.
    const outlineButton = button({
        text: 'Contorno',
        styles: chipStyles(settings.outline),
        events: { click: () => { settings.outline = !settings.outline; saveCyclistStyle(settings); buildRiders(); refreshChips(); } },
    });
    const shadingButton = button({
        text: settings.shading === 'toon' ? 'Sombreado: toon' : 'Sombreado: suave',
        styles: chipStyles(false),
        events: {
            click: () => {
                settings.shading = settings.shading === 'toon' ? 'soft' : 'toon';
                saveCyclistStyle(settings);
                buildRiders();
                refreshChips();
            },
        },
    });
    const avatarButton = button({
        text: 'Avatar 3D',
        styles: chipStyles(settings.avatar),
        events: {
            click: () => {
                if (!isRiderAvatarReady()) return;
                settings.avatar = !settings.avatar;
                saveCyclistStyle(settings);
                buildRiders();
                refreshChips();
            },
        },
    });
    const playButton = button({
        text: 'Pausar',
        styles: chipStyles(true),
        events: { click: () => { settings.playing = !settings.playing; refreshChips(); } },
    });

    // Cadencia
    const rpmValue = createElement('span', { text: `${settings.rpm} rpm`, styles: { minWidth: '64px', fontVariantNumeric: 'tabular-nums' } });
    const rpmSlider = createElement('input', {
        attrs: { type: 'range', min: '0', max: '120', step: '1', value: String(settings.rpm), 'aria-label': 'Cadencia' },
        styles: { flex: '1', minWidth: '140px', accentColor: '#63e0b5' },
        events: {
            input: () => {
                settings.rpm = Number(rpmSlider.value);
                rpmValue.textContent = `${settings.rpm} rpm`;
            },
        },
    });

    function refreshChips() {
        viewButtons.forEach((chip, index) => Object.assign(chip.style, chipStyles(VIEWS[index].id === settings.view && !settings.autoRotate)));
        Object.assign(spinButton.style, chipStyles(settings.autoRotate));
        Object.assign(pelotonButton.style, chipStyles(settings.peloton));
        Object.assign(ghostButton.style, chipStyles(settings.ghost));
        Object.assign(playButton.style, chipStyles(settings.playing));
        Object.assign(outlineButton.style, chipStyles(settings.outline));
        Object.assign(avatarButton.style, chipStyles(settings.avatar && isRiderAvatarReady()));
        avatarButton.textContent = isRiderAvatarReady() ? 'Avatar 3D' : 'Avatar 3D: falta rider.glb';
        avatarButton.style.opacity = isRiderAvatarReady() ? '1' : '0.55';
        Object.assign(shadingButton.style, chipStyles(false));
        shadingButton.textContent = settings.shading === 'toon' ? 'Sombreado: toon' : 'Sombreado: suave';
        playButton.textContent = settings.playing ? 'Pausar' : 'Pedalear';
        positionButtons.forEach((chip, index) => Object.assign(chip.style, chipStyles(Object.values(RIDER_POSITIONS)[index].id === settings.position)));
        bikeSwatches.forEach((swatch, index) => {
            swatch.style.borderColor = BIKE_PAINTS[index].id === settings.bikeColor ? '#ffffff' : 'rgba(255,255,255,.25)';
            swatch.style.transform = BIKE_PAINTS[index].id === settings.bikeColor ? 'scale(1.15)' : 'none';
        });
        swatches.forEach((swatch, index) => {
            swatch.style.borderColor = JERSEYS[index].color === settings.jersey ? '#ffffff' : 'rgba(255,255,255,.25)';
            swatch.style.transform = JERSEYS[index].color === settings.jersey ? 'scale(1.15)' : 'none';
        });
    }

    panel.append(
        row('Vista', ...viewButtons, spinButton),
        row('Jersey', ...swatches),
        row('Bici', ...bikeSwatches),
        row('Posición', ...positionButtons),
        row('Escena', pelotonButton, ghostButton, playButton),
        row('Estilo', avatarButton, outlineButton, shadingButton),
        row('Cadencia', rpmSlider, rpmValue),
        createElement('span', {
            text: 'Arrastra para girar · rueda o pellizco para acercar',
            styles: { fontSize: '12px', color: colors.textMuted },
        }),
    );
    container.append(topBar, panel);

    // Con el panel abierto el ciclista se centra en el espacio libre de arriba (desplazando la imagen, no la
    // cámara); con el panel oculto ocupa toda la vista.
    function applyLayout() {
        const width = canvasHost.clientWidth || window.innerWidth;
        const height = canvasHost.clientHeight || window.innerHeight;
        const panelHeight = controlsVisible ? panel.offsetHeight + 12 : 0;
        if (panelHeight > 0 && panelHeight < height * 0.8) {
            camera.setViewOffset(width, height, 0, Math.round(panelHeight / 2), width, height);
        } else {
            camera.clearViewOffset();
        }
    }

    function setControlsVisible(visible) {
        controlsVisible = visible;
        panel.style.display = visible ? 'flex' : 'none';
        toggleControlsButton.textContent = visible ? 'Ocultar controles' : 'Mostrar controles';
        toggleControlsButton.setAttribute('aria-expanded', String(visible));
        applyLayout();
    }

    // ---- Bucle ----
    const clock = new THREE.Clock();
    let angle = 0;
    let frameId = 0;
    function draw() {
        frameId = requestAnimationFrame(draw);
        const delta = Math.min(0.05, clock.getDelta());
        if (settings.playing && settings.rpm > 0) angle += delta * (settings.rpm / 60) * Math.PI * 2;
        const active = settings.playing && settings.rpm > 0;
        entries.forEach(({ rider, phase }) => animateCyclist(rider, angle + phase, 8, 0.5, active));
        controls.update();
        renderer.render(scene, camera);
    }

    function resize() {
        const width = canvasHost.clientWidth || window.innerWidth;
        const height = canvasHost.clientHeight || window.innerHeight;
        renderer.setSize(width, height, false);
        camera.aspect = width / height;
        // En vertical hay que alejar la cámara para que quepa la bici entera.
        camera.fov = width / height < 0.8 ? 52 : 38;
        camera.updateProjectionMatrix();
        applyLayout();
        refit();
    }
    const resizeObserver = new window.ResizeObserver(resize);
    resizeObserver.observe(canvasHost);

    let disposed = false;
    buildRiders();
    setView(settings.view);
    refreshChips();
    resize();
    draw();
    // El avatar se descarga en segundo plano: cuando llega, se sustituye el cuerpo procedural.
    preloadRiderAvatar().then((ready) => {
        if (ready && !disposed) {
            buildRiders();
            refreshChips();
        }
    });

    container.cleanup = () => {
        disposed = true;
        cancelAnimationFrame(frameId);
        resizeObserver.disconnect();
        controls.dispose();
        disposeEntries();
        scene.traverse((object) => {
            if (!object.isMesh) return;
            object.geometry?.dispose?.();
            object.material?.dispose?.();
        });
        renderer.dispose();
    };
    return container;
}
