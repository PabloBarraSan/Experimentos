/**
 * RouteGenerator - Generador de rutas procedurales
 * Smart Trainer - Virtual Cycling
 * 
 * Genera perfiles de elevación usando Perlin Noise
 */

/**
 * Implementación simple de Perlin Noise 1D
 */
class PerlinNoise {
    constructor(seed = Math.random() * 10000) {
        this.seed = seed;
        this.permutation = this.generatePermutation();
    }
    
    generatePermutation() {
        const p = [];
        for (let i = 0; i < 256; i++) {
            p[i] = i;
        }
        
        // Shuffle usando seed
        let random = this.seed;
        for (let i = 255; i > 0; i--) {
            random = (random * 16807) % 2147483647;
            const j = random % (i + 1);
            [p[i], p[j]] = [p[j], p[i]];
        }
        
        // Duplicar para evitar overflow
        return [...p, ...p];
    }
    
    fade(t) {
        return t * t * t * (t * (t * 6 - 15) + 10);
    }
    
    lerp(a, b, t) {
        return a + t * (b - a);
    }
    
    grad(hash, x) {
        return (hash & 1) === 0 ? x : -x;
    }
    
    noise(x) {
        const X = Math.floor(x) & 255;
        x -= Math.floor(x);
        const u = this.fade(x);
        
        const a = this.permutation[X];
        const b = this.permutation[X + 1];
        
        return this.lerp(
            this.grad(a, x),
            this.grad(b, x - 1),
            u
        );
    }
    
    /**
     * Octave noise para más detalle
     */
    octaveNoise(x, octaves = 4, persistence = 0.5) {
        let total = 0;
        let frequency = 1;
        let amplitude = 1;
        let maxValue = 0;
        
        for (let i = 0; i < octaves; i++) {
            total += this.noise(x * frequency) * amplitude;
            maxValue += amplitude;
            amplitude *= persistence;
            frequency *= 2;
        }
        
        return total / maxValue;
    }
}

/**
 * Configuración de generación de rutas por tipo de mundo
 */
export const ROUTE_CONFIGS = {
    green_valley: {
        name: 'Valle Verde',
        baseElevation: 200,
        maxElevation: 400,
        noiseScale: 0.0003,
        octaves: 3,
        gradeMultiplier: 0.5, // Pendientes suaves
        minGrade: -3,
        maxGrade: 3,
    },
    med_coast: {
        name: 'Costa Mediterránea',
        baseElevation: 0,
        maxElevation: 300,
        noiseScale: 0.0005,
        octaves: 4,
        gradeMultiplier: 1.0,
        minGrade: -6,
        maxGrade: 6,
    },
    snowy_alps: {
        name: 'Alpes Nevados',
        baseElevation: 800,
        maxElevation: 2500,
        noiseScale: 0.0002,
        octaves: 5,
        gradeMultiplier: 1.5, // Pendientes pronunciadas
        minGrade: -12,
        maxGrade: 12,
    },
    night_volcano: {
        name: 'Volcán Nocturno',
        baseElevation: 500,
        maxElevation: 1500,
        noiseScale: 0.001,
        octaves: 3,
        gradeMultiplier: 2.0, // Rampas explosivas
        minGrade: -15,
        maxGrade: 15,
    },
    future_city: {
        name: 'Ciudad Futurista',
        baseElevation: 100,
        maxElevation: 400,
        noiseScale: 0.0008,
        octaves: 6,
        gradeMultiplier: 1.2,
        minGrade: -8,
        maxGrade: 8,
    },
};

/**
 * Crear generador de rutas
 */
export function createRouteGenerator(worldId = 'green_valley', seed = null) {
    const config = ROUTE_CONFIGS[worldId] || ROUTE_CONFIGS.green_valley;
    const perlin = new PerlinNoise(seed || Math.random() * 10000);
    
    /**
     * Generar puntos de ruta
     * @param {number} length - Longitud total en metros
     * @param {number} resolution - Distancia entre puntos en metros
     * @returns {Array} Array de { distance, elevation, grade }
     */
    function generate(length = 10000, resolution = 10) {
        const points = [];
        const numPoints = Math.ceil(length / resolution);
        
        let lastElevation = config.baseElevation;
        
        for (let i = 0; i <= numPoints; i++) {
            const distance = i * resolution;
            
            // Usar múltiples octavas de noise para variación natural
            const noiseValue = perlin.octaveNoise(
                distance * config.noiseScale,
                config.octaves,
                0.5
            );
            
            // Mapear noise (-1 a 1) a elevación
            const elevationRange = config.maxElevation - config.baseElevation;
            let elevation = config.baseElevation + ((noiseValue + 1) / 2) * elevationRange;
            
            // Calcular pendiente
            let grade = 0;
            if (i > 0) {
                const elevationChange = elevation - lastElevation;
                grade = (elevationChange / resolution) * 100; // %
                
                // Aplicar multiplicador de pendiente del mundo
                grade *= config.gradeMultiplier;
                
                // Limitar pendiente al rango del mundo
                grade = Math.max(config.minGrade, Math.min(config.maxGrade, grade));
                
                // Recalcular elevación con pendiente limitada
                elevation = lastElevation + (grade / 100) * resolution;
            }
            
            points.push({
                distance,
                elevation: Math.round(elevation * 10) / 10,
                grade: Math.round(grade * 10) / 10,
            });
            
            lastElevation = elevation;
        }
        
        return points;
    }
    
    /**
     * Generar ruta con características específicas
     * @param {object} options - Opciones de generación
     */
    function generateCustom(options = {}) {
        const {
            length = 10000,
            resolution = 10,
            startClimb = false, // Empezar con subida
            endClimb = false,   // Terminar con subida
            flatStart = 500,    // Metros planos al inicio
            flatEnd = 200,      // Metros planos al final
        } = options;
        
        const points = generate(length, resolution);
        
        // Modificar inicio plano
        if (flatStart > 0) {
            const flatPoints = Math.ceil(flatStart / resolution);
            for (let i = 0; i < flatPoints && i < points.length; i++) {
                points[i].grade = 0;
                points[i].elevation = points[0].elevation;
            }
        }
        
        // Modificar final plano
        if (flatEnd > 0) {
            const flatPoints = Math.ceil(flatEnd / resolution);
            const startIdx = Math.max(0, points.length - flatPoints);
            const flatElevation = points[startIdx]?.elevation || config.baseElevation;
            for (let i = startIdx; i < points.length; i++) {
                points[i].grade = 0;
                points[i].elevation = flatElevation;
            }
        }
        
        return points;
    }
    
    /**
     * Obtener punto de ruta interpolado para una distancia específica
     */
    function getPointAtDistance(points, distance) {
        if (!points || points.length === 0) {
            return { distance: 0, elevation: 0, grade: 0 };
        }
        
        // Encontrar los dos puntos más cercanos
        let i = 0;
        while (i < points.length - 1 && points[i + 1].distance <= distance) {
            i++;
        }
        
        if (i >= points.length - 1) {
            return points[points.length - 1];
        }
        
        const p1 = points[i];
        const p2 = points[i + 1];
        
        // Interpolar
        const t = (distance - p1.distance) / (p2.distance - p1.distance);
        
        return {
            distance,
            elevation: p1.elevation + t * (p2.elevation - p1.elevation),
            grade: p1.grade + t * (p2.grade - p1.grade),
        };
    }
    
    /**
     * Calcular estadísticas de la ruta
     */
    function getRouteStats(points) {
        if (!points || points.length < 2) {
            return { length: 0, totalAscent: 0, totalDescent: 0, maxGrade: 0, avgGrade: 0 };
        }
        
        let totalAscent = 0;
        let totalDescent = 0;
        let maxGrade = 0;
        let gradeSum = 0;
        
        for (let i = 1; i < points.length; i++) {
            const elevationChange = points[i].elevation - points[i - 1].elevation;
            if (elevationChange > 0) {
                totalAscent += elevationChange;
            } else {
                totalDescent += Math.abs(elevationChange);
            }
            
            const grade = Math.abs(points[i].grade);
            if (grade > maxGrade) {
                maxGrade = grade;
            }
            gradeSum += grade;
        }
        
        return {
            length: points[points.length - 1].distance,
            totalAscent: Math.round(totalAscent),
            totalDescent: Math.round(totalDescent),
            maxGrade: Math.round(maxGrade * 10) / 10,
            avgGrade: Math.round((gradeSum / (points.length - 1)) * 10) / 10,
            minElevation: Math.round(Math.min(...points.map(p => p.elevation))),
            maxElevation: Math.round(Math.max(...points.map(p => p.elevation))),
        };
    }
    
    return {
        generate,
        generateCustom,
        getPointAtDistance,
        getRouteStats,
        config,
    };
}

/**
 * Rutas predefinidas clásicas
 */
export const PRESET_ROUTES = {
    green_valley: [
        {
            id: 'rolling_hills',
            name: 'Colinas Suaves',
            description: 'Ruta ideal para calentamiento y recuperación',
            length: 8000,
            seed: 12345,
        },
        {
            id: 'valley_loop',
            name: 'Vuelta al Valle',
            description: 'Recorrido circular por el valle',
            length: 15000,
            seed: 67890,
        },
    ],
    med_coast: [
        {
            id: 'coastal_ride',
            name: 'Paseo Marítimo',
            description: 'Recorrido costero con vistas al mar',
            length: 12000,
            seed: 11111,
        },
        {
            id: 'cliff_challenge',
            name: 'Desafío de los Acantilados',
            description: 'Sube y baja por los acantilados',
            length: 10000,
            seed: 22222,
        },
    ],
    snowy_alps: [
        {
            id: 'col_du_galibier',
            name: 'Col du Galibier',
            description: 'Ascensión épica de 18km',
            length: 18000,
            seed: 33333,
        },
        {
            id: 'alpine_loop',
            name: 'Circuito Alpino',
            description: 'Combina subidas y bajadas técnicas',
            length: 25000,
            seed: 44444,
        },
    ],
    night_volcano: [
        {
            id: 'lava_sprint',
            name: 'Sprint Volcánico',
            description: 'Rampas explosivas entre ríos de lava',
            length: 6000,
            seed: 55555,
        },
        {
            id: 'crater_climb',
            name: 'Ascenso al Cráter',
            description: 'Sube hasta el borde del volcán',
            length: 8000,
            seed: 66666,
        },
    ],
    future_city: [
        {
            id: 'neon_streets',
            name: 'Calles de Neón',
            description: 'Recorre la ciudad del futuro',
            length: 10000,
            seed: 77777,
        },
        {
            id: 'skyway_race',
            name: 'Carrera en las Alturas',
            description: 'Por las autopistas elevadas',
            length: 12000,
            seed: 88888,
        },
    ],
};
