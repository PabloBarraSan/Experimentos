// Ruido procedural determinista compartido por terreno, vegetación y texturas.

export function hash2(x, y) {
    const value = Math.sin(x * 127.1 + y * 311.7) * 43758.5453123;
    return value - Math.floor(value);
}

function fade(t) {
    return t * t * t * (t * (t * 6 - 15) + 10);
}

// Value noise 2D suave en el rango [0, 1].
export function valueNoise(x, y) {
    const xi = Math.floor(x);
    const yi = Math.floor(y);
    const xf = fade(x - xi);
    const yf = fade(y - yi);
    const a = hash2(xi, yi);
    const b = hash2(xi + 1, yi);
    const c = hash2(xi, yi + 1);
    const d = hash2(xi + 1, yi + 1);
    return a + (b - a) * xf + (c - a) * yf + (a - b - c + d) * xf * yf;
}

// Fractal Brownian motion en el rango aproximado [0, 1].
export function fbm(x, y, octaves = 4, lacunarity = 2.03, gain = 0.5) {
    let amplitude = 0.5;
    let frequency = 1;
    let sum = 0;
    let norm = 0;
    for (let octave = 0; octave < octaves; octave += 1) {
        sum += valueNoise(x * frequency + octave * 17.3, y * frequency - octave * 9.1) * amplitude;
        norm += amplitude;
        amplitude *= gain;
        frequency *= lacunarity;
    }
    return sum / norm;
}

// Ruido "ridged": crestas afiladas, ideal para cordilleras.
export function ridged(x, y, octaves = 5) {
    let amplitude = 0.5;
    let frequency = 1;
    let sum = 0;
    let norm = 0;
    let weight = 1;
    for (let octave = 0; octave < octaves; octave += 1) {
        let signal = 1 - Math.abs(valueNoise(x * frequency + octave * 5.7, y * frequency + octave * 3.1) * 2 - 1);
        signal *= signal;
        signal *= weight;
        weight = Math.min(1, signal * 1.6);
        sum += signal * amplitude;
        norm += amplitude;
        amplitude *= 0.5;
        frequency *= 2.05;
    }
    return sum / norm;
}

export function smoothstep(edge0, edge1, value) {
    const t = Math.min(1, Math.max(0, (value - edge0) / (edge1 - edge0)));
    return t * t * (3 - 2 * t);
}

export function seeded(value) {
    const x = Math.sin(value * 12.9898 + 78.233) * 43758.5453;
    return x - Math.floor(x);
}
