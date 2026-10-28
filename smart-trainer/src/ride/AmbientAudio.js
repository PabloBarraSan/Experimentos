/**
 * AmbientAudio - Sonido ambiente del ride, sintetizado con Web Audio (sin archivos)
 *
 * Capas:
 * - Viento: ruido filtrado que sube de volumen y se vuelve más agudo con la velocidad.
 * - Rodadura: rumor grave proporcional a la velocidad (más áspero en tierra).
 * - Rueda libre: el «tic-tic» de los trinquetes al dejar de pedalear, al ritmo de la rueda.
 * - Transmisión: zumbido suave de la cadena mientras se pedalea.
 * - Entorno: pájaros de vez en cuando y público que el juego sube en las subidas o en meta.
 *
 * El navegador solo deja arrancar audio tras un gesto del usuario: start() debe llamarse desde un clic
 * (o tras uno). update() se llama cada frame con el estado del ciclista.
 */

const WHEEL_CIRCUMFERENCE = 2.1; // m
const FREEWHEEL_PAWLS = 36; // clics por vuelta de rueda (buje de 36 dientes)
const MAX_CLICK_RATE = 140; // clics/s: por encima suena como un zumbido y se deja de programar uno a uno
const SCHEDULE_AHEAD = 0.12; // s de audio programado por adelantado
const SMOOTH = 0.15; // s de suavizado de los cambios de volumen

// Volúmenes máximos de cada capa (antes del volumen general).
const LEVELS = { wind: 0.5, rolling: 0.35, freewheel: 0.22, chain: 0.06, birds: 0.08, crowd: 0.35 };

function noiseBuffer(context, seconds, brown = false) {
    const length = Math.floor(context.sampleRate * seconds);
    const buffer = context.createBuffer(1, length, context.sampleRate);
    const data = buffer.getChannelData(0);
    let last = 0;
    for (let i = 0; i < length; i += 1) {
        const white = Math.random() * 2 - 1;
        // Ruido marrón: integra el blanco (más grave, como rodadura o viento lejano).
        last = brown ? (last + 0.02 * white) / 1.02 : white;
        data[i] = brown ? last * 3.5 : white;
    }
    return buffer;
}

function clickBuffer(context) {
    const length = Math.floor(context.sampleRate * 0.006);
    const buffer = context.createBuffer(1, length, context.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i += 1) {
        const decay = Math.exp(-i / (length * 0.18));
        data[i] = (Math.random() * 2 - 1) * decay;
    }
    return buffer;
}

export function createAmbientAudio() {
    const AudioCtor = typeof window !== 'undefined' ? (window.AudioContext || window.webkitAudioContext) : null;
    let context = null;
    let master = null;
    let nodes = null;
    let volume = 0.7;
    let enabled = true;
    let nextClick = 0;
    let nextBird = 0;
    const state = { speed: 0, cadence: 0, surface: 'asphalt', crowd: 0 };

    function loop(buffer, destination) {
        const source = context.createBufferSource();
        source.buffer = buffer;
        source.loop = true;
        source.connect(destination);
        source.start();
        return source;
    }

    function gainNode(value = 0) {
        const gain = context.createGain();
        gain.gain.value = value;
        gain.connect(master);
        return gain;
    }

    function build() {
        context = new AudioCtor();
        master = context.createGain();
        master.gain.value = enabled ? volume : 0;
        master.connect(context.destination);
        const white = noiseBuffer(context, 2);
        const brown = noiseBuffer(context, 2, true);

        const wind = gainNode();
        const windFilter = context.createBiquadFilter();
        windFilter.type = 'lowpass';
        windFilter.frequency.value = 400;
        windFilter.Q.value = 0.7;
        windFilter.connect(wind);
        loop(white, windFilter);

        const rolling = gainNode();
        const rollingFilter = context.createBiquadFilter();
        rollingFilter.type = 'lowpass';
        rollingFilter.frequency.value = 220;
        rollingFilter.connect(rolling);
        loop(brown, rollingFilter);
        // Grava: crujido agudo que solo suena en tierra.
        const gravel = gainNode();
        const gravelFilter = context.createBiquadFilter();
        gravelFilter.type = 'bandpass';
        gravelFilter.frequency.value = 2400;
        gravelFilter.Q.value = 0.8;
        gravelFilter.connect(gravel);
        loop(white, gravelFilter);

        const chain = gainNode();
        const chainFilter = context.createBiquadFilter();
        chainFilter.type = 'bandpass';
        chainFilter.frequency.value = 1800;
        chainFilter.Q.value = 3;
        chainFilter.connect(chain);
        loop(white, chainFilter);

        // Público: ruido de banda media modulado lentamente (murmullo con oleadas).
        const crowd = gainNode();
        const crowdFilter = context.createBiquadFilter();
        crowdFilter.type = 'bandpass';
        crowdFilter.frequency.value = 900;
        crowdFilter.Q.value = 0.6;
        const crowdSwell = context.createGain();
        crowdSwell.gain.value = 0.7;
        const swell = context.createOscillator();
        swell.frequency.value = 0.35;
        const swellDepth = context.createGain();
        swellDepth.gain.value = 0.3;
        swell.connect(swellDepth).connect(crowdSwell.gain);
        swell.start();
        crowdFilter.connect(crowdSwell).connect(crowd);
        loop(white, crowdFilter);

        const freewheel = gainNode(LEVELS.freewheel);
        const freewheelFilter = context.createBiquadFilter();
        freewheelFilter.type = 'highpass';
        freewheelFilter.frequency.value = 2500;
        freewheelFilter.connect(freewheel);

        const birds = gainNode(LEVELS.birds);
        nodes = { wind, windFilter, rolling, gravel, chain, chainFilter, crowd, freewheel: freewheelFilter, birds, click: clickBuffer(context) };
    }

    function ramp(param, value) {
        param.setTargetAtTime(value, context.currentTime, SMOOTH);
    }

    // Rueda libre: clics programados con antelación al ritmo de la rueda (solo sin pedalear y en marcha).
    function scheduleFreewheel(coasting) {
        const rate = (state.speed / WHEEL_CIRCUMFERENCE) * FREEWHEEL_PAWLS;
        if (!coasting || rate < 2) {
            nextClick = context.currentTime;
            return;
        }
        const interval = 1 / Math.min(rate, MAX_CLICK_RATE);
        if (nextClick < context.currentTime) nextClick = context.currentTime;
        while (nextClick < context.currentTime + SCHEDULE_AHEAD) {
            const source = context.createBufferSource();
            source.buffer = nodes.click;
            source.playbackRate.value = 0.9 + Math.random() * 0.2;
            source.connect(nodes.freewheel);
            source.start(nextClick);
            nextClick += interval;
        }
    }

    // Pájaro: dos o tres trinos cortos (barridos de seno) a intervalos aleatorios.
    function scheduleBirds() {
        if (context.currentTime < nextBird) return;
        const start = context.currentTime + 0.05;
        const notes = 2 + Math.floor(Math.random() * 3);
        const base = 2600 + Math.random() * 1800;
        for (let i = 0; i < notes; i += 1) {
            const at = start + i * (0.09 + Math.random() * 0.05);
            const oscillator = context.createOscillator();
            const envelope = context.createGain();
            oscillator.type = 'sine';
            oscillator.frequency.setValueAtTime(base, at);
            oscillator.frequency.exponentialRampToValueAtTime(base * (1.2 + Math.random() * 0.4), at + 0.07);
            envelope.gain.setValueAtTime(0, at);
            envelope.gain.linearRampToValueAtTime(1, at + 0.01);
            envelope.gain.exponentialRampToValueAtTime(0.001, at + 0.08);
            oscillator.connect(envelope).connect(nodes.birds);
            oscillator.start(at);
            oscillator.stop(at + 0.1);
        }
        nextBird = context.currentTime + 3 + Math.random() * 9;
    }

    return {
        /** Arranca (o reanuda) el audio. Llamar tras un gesto del usuario. */
        start() {
            if (!AudioCtor) return;
            if (!context) build();
            if (context.state === 'suspended') context.resume().catch(() => {});
        },

        /**
         * @param {{ speed?: number, cadence?: number, surface?: 'asphalt'|'gravel', crowd?: number }} next
         *   speed en m/s, cadence en rpm, crowd 0..1 (público en subidas, sprint o meta)
         */
        update(next = {}) {
            Object.assign(state, next);
            if (!context || context.state !== 'running') return;
            const speed = Math.max(0, state.speed || 0);
            const kmh = speed * 3.6;
            const moving = Math.min(1, kmh / 8);
            const coasting = (state.cadence || 0) <= 0 && kmh > 3;
            ramp(nodes.wind.gain, LEVELS.wind * Math.min(1, (kmh / 55) ** 2));
            ramp(nodes.windFilter.frequency, 250 + kmh * 28);
            ramp(nodes.rolling.gain, LEVELS.rolling * moving * Math.min(1, 0.35 + kmh / 50));
            ramp(nodes.gravel.gain, state.surface === 'gravel' ? 0.12 * moving : 0);
            ramp(nodes.chain.gain, coasting || kmh < 2 ? 0 : LEVELS.chain * Math.min(1, (state.cadence || 0) / 90));
            ramp(nodes.chainFilter.frequency, 1200 + (state.cadence || 0) * 8);
            ramp(nodes.crowd.gain, LEVELS.crowd * Math.max(0, Math.min(1, state.crowd || 0)));
            scheduleFreewheel(coasting);
            scheduleBirds();
        },

        setVolume(value) {
            volume = Math.max(0, Math.min(1, value));
            if (master) ramp(master.gain, enabled ? volume : 0);
        },

        setEnabled(value) {
            enabled = Boolean(value);
            if (master) ramp(master.gain, enabled ? volume : 0);
        },

        /** Silencia y libera el contexto de audio (al salir de la vista). */
        stop() {
            if (!context) return;
            context.close().catch(() => {});
            context = null;
            nodes = null;
        },
    };
}
