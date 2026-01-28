/**
 * RidePhysics - Física del ciclismo virtual
 * Smart Trainer - Virtual Cycling
 * 
 * Calcula velocidad realista basada en potencia, pendiente y resistencias
 */

// Constantes físicas
const GRAVITY = 9.81; // m/s²
const AIR_DENSITY = 1.225; // kg/m³
const DEFAULT_CRR = 0.004; // Coeficiente de resistencia a la rodadura (asfalto)
const DEFAULT_CDA = 0.35; // Coeficiente aerodinámico * área frontal (m²)

/**
 * Crear instancia del sistema de física
 */
export function createRidePhysics(options = {}) {
    const {
        crr = DEFAULT_CRR,
        cda = DEFAULT_CDA,
        drivetrainLoss = 0.03, // 3% pérdida en transmisión
    } = options;
    
    let currentVelocity = 0; // m/s
    
    /**
     * Calcular velocidad dado poder y condiciones
     * Usa método iterativo de Newton-Raphson para resolver la ecuación cúbica
     * 
     * @param {number} power - Potencia en watts
     * @param {number} grade - Pendiente en % (positivo = subida)
     * @param {number} mass - Masa total (ciclista + bici) en kg
     * @param {number} windSpeed - Velocidad del viento en m/s (positivo = en contra)
     * @returns {number} Velocidad en m/s
     */
    function calculateVelocity(power, grade, mass, windSpeed = 0) {
        // Sin potencia, desacelerar gradualmente
        if (power <= 0) {
            currentVelocity = Math.max(0, currentVelocity * 0.98);
            return currentVelocity;
        }
        
        // Potencia efectiva (descontando pérdidas)
        const effectivePower = power * (1 - drivetrainLoss);
        
        // Convertir pendiente de % a fracción
        const gradeFraction = grade / 100;
        const theta = Math.atan(gradeFraction);
        
        // Fuerza gravitatoria (negativa si subida)
        const Fg = mass * GRAVITY * Math.sin(theta);
        
        // Fuerza de rodadura
        const Fr = mass * GRAVITY * crr * Math.cos(theta);
        
        // Resolver para velocidad usando Newton-Raphson
        // P = v * (Fg + Fr + 0.5 * rho * CdA * (v + vw)²)
        // Esta es una ecuación cúbica que necesita resolución numérica
        
        let v = currentVelocity > 0 ? currentVelocity : 5; // Velocidad inicial para iteración
        
        for (let i = 0; i < 20; i++) {
            const vRel = v + windSpeed; // Velocidad relativa al aire
            const Fa = 0.5 * AIR_DENSITY * cda * vRel * Math.abs(vRel);
            
            // f(v) = v * (Fg + Fr + Fa) - P = 0
            const Ftotal = Fg + Fr + Fa;
            const f = v * Ftotal - effectivePower;
            
            // f'(v) = Ftotal + v * dFa/dv
            // dFa/dv = 0.5 * rho * CdA * 2 * vRel * sign(vRel) = rho * CdA * |vRel|
            const dFa = AIR_DENSITY * cda * Math.abs(vRel);
            const df = Ftotal + v * dFa;
            
            if (Math.abs(df) < 0.0001) break;
            
            const vNew = v - f / df;
            
            // Limitar cambio para estabilidad
            v = Math.max(0.1, Math.min(vNew, 30)); // Max 30 m/s = 108 km/h
            
            if (Math.abs(vNew - v) < 0.001) break;
        }
        
        // Suavizar cambios de velocidad (inercia)
        const inertiaFactor = 0.1; // Cuánto se ajusta por frame
        currentVelocity = currentVelocity + (v - currentVelocity) * inertiaFactor;
        
        // Limitar velocidad mínima en bajadas sin pedalear
        if (currentVelocity < 0) currentVelocity = 0;
        
        return currentVelocity;
    }
    
    /**
     * Calcular velocidad simplificada (para casos donde no necesitamos precisión extrema)
     */
    function calculateSimpleVelocity(power, grade, mass) {
        if (power <= 0) {
            currentVelocity = Math.max(0, currentVelocity * 0.95);
            return currentVelocity;
        }
        
        // Potencia efectiva
        const effectivePower = power * (1 - drivetrainLoss);
        
        // Pendiente afecta la resistencia base
        const gradeResistance = mass * GRAVITY * (grade / 100);
        const baseResistance = mass * GRAVITY * crr;
        
        // Estimación simplificada: P = F * v, F = resistencias + aero
        // v ≈ P / (resistencias + k * v²) → resolver aproximadamente
        
        const totalResistance = baseResistance + gradeResistance;
        
        // Velocidad aproximada ignorando aerodinámica para resistencia base
        let targetV = effectivePower / Math.max(1, totalResistance);
        
        // Añadir efecto aerodinámico (reduce velocidad a altas velocidades)
        const aeroEffect = 0.5 * AIR_DENSITY * cda * targetV * targetV;
        if (aeroEffect > 0) {
            targetV = effectivePower / (totalResistance + aeroEffect / targetV);
        }
        
        // Limitar rango realista
        targetV = Math.max(0, Math.min(targetV, 25)); // Max 25 m/s = 90 km/h
        
        // Suavizar con inercia
        currentVelocity = currentVelocity + (targetV - currentVelocity) * 0.15;
        
        return currentVelocity;
    }
    
    /**
     * Obtener velocidad actual en km/h
     */
    function getSpeedKmh() {
        return currentVelocity * 3.6;
    }
    
    /**
     * Obtener velocidad actual en m/s
     */
    function getSpeedMs() {
        return currentVelocity;
    }
    
    /**
     * Resetear velocidad
     */
    function reset() {
        currentVelocity = 0;
    }
    
    /**
     * Calcular parámetros de simulación para enviar al rodillo FTMS
     */
    function getSimulationParams(grade, windSpeed = 0) {
        return {
            windSpeed: windSpeed,
            grade: grade,
            crr: crr,
            cw: cda * AIR_DENSITY, // El protocolo FTMS espera cw en kg/m
        };
    }
    
    return {
        calculateVelocity,
        calculateSimpleVelocity,
        getSpeedKmh,
        getSpeedMs,
        reset,
        getSimulationParams,
    };
}

/**
 * Calcular VAM (Velocidad Ascensional Media)
 * Metros de desnivel por hora
 */
export function calculateVAM(elevationGain, timeSeconds) {
    if (timeSeconds <= 0) return 0;
    return (elevationGain / timeSeconds) * 3600;
}

/**
 * Estimar tiempo para completar distancia dada potencia
 */
export function estimateTime(distance, power, grade, mass) {
    const physics = createRidePhysics();
    const velocity = physics.calculateSimpleVelocity(power, grade, mass);
    if (velocity <= 0) return Infinity;
    return distance / velocity; // segundos
}
