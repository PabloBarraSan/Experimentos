/**
 * RouteIndex - Índice espacial de una ruta (polilínea con puntos cada ~5 m).
 * Devuelve la distancia horizontal a la ruta y la altura de la ruta en el punto
 * más cercano. Dos niveles: rejilla fina (64 m) para consultas cercanas y rejilla
 * gruesa (256 m, puntos decimados) para el resto; ambas se refinan con la
 * proyección exacta sobre los segmentos originales para que el resultado sea continuo.
 * Smart Trainer - Virtual Cycling
 */

const FINE_BUCKET = 64;
const COARSE_BUCKET = 256;
const DECIMATION = 8;
const MAX_RINGS = 6;
const KEY_OFFSET = 50000;
const KEY_STRIDE = 100000;

function bucketKey(bx, bz) {
    return (bx + KEY_OFFSET) * KEY_STRIDE + (bz + KEY_OFFSET);
}

export class RouteIndex {
    /**
     * @param {Array<{x:number,y:number,z:number}>} points - Puntos de la ruta (THREE.Vector3 o similar)
     */
    constructor(points) {
        const count = points.length;
        this.count = count;
        this.xs = new Float64Array(count);
        this.ys = new Float64Array(count);
        this.zs = new Float64Array(count);
        this.fine = new Map();
        this.coarse = new Map();
        this.decimated = [];
        this.result = { distance: Infinity, height: 0 };

        for (let i = 0; i < count; i++) {
            const p = points[i];
            this.xs[i] = p.x;
            this.ys[i] = p.y;
            this.zs[i] = p.z;
            this._push(this.fine, Math.floor(p.x / FINE_BUCKET), Math.floor(p.z / FINE_BUCKET), i);
            if (i % DECIMATION === 0 || i === count - 1) {
                this.decimated.push(i);
                this._push(this.coarse, Math.floor(p.x / COARSE_BUCKET), Math.floor(p.z / COARSE_BUCKET), i);
            }
        }
    }

    _push(map, bx, bz, index) {
        const key = bucketKey(bx, bz);
        const list = map.get(key);
        if (list) list.push(index);
        else map.set(key, [index]);
    }

    /**
     * Distancia y altura de la ruta más cercana a (x, z).
     * Devuelve siempre el mismo objeto (no reservar memoria por consulta): copiar antes de reutilizar.
     */
    query(x, z) {
        let bestSq = Infinity;
        let bestIndex = -1;

        // 1) Vecindad fina 3x3: exacta si el punto más cercano está a menos de FINE_BUCKET
        const fbx = Math.floor(x / FINE_BUCKET);
        const fbz = Math.floor(z / FINE_BUCKET);
        for (let ox = -1; ox <= 1; ox++) {
            for (let oz = -1; oz <= 1; oz++) {
                const list = this.fine.get(bucketKey(fbx + ox, fbz + oz));
                if (!list) continue;
                for (let k = 0; k < list.length; k++) {
                    const i = list[k];
                    const dx = this.xs[i] - x;
                    const dz = this.zs[i] - z;
                    const d = dx * dx + dz * dz;
                    if (d < bestSq) {
                        bestSq = d;
                        bestIndex = i;
                    }
                }
            }
        }

        if (bestIndex < 0 || bestSq > FINE_BUCKET * FINE_BUCKET) {
            bestIndex = this._coarseNearest(x, z);
        }

        return this._refine(x, z, bestIndex);
    }

    /** Punto decimado más cercano, buscando por anillos de celdas gruesas */
    _coarseNearest(x, z) {
        const cbx = Math.floor(x / COARSE_BUCKET);
        const cbz = Math.floor(z / COARSE_BUCKET);
        let bestSq = Infinity;
        let bestIndex = -1;

        for (let ring = 0; ring <= MAX_RINGS; ring++) {
            for (let ox = -ring; ox <= ring; ox++) {
                for (let oz = -ring; oz <= ring; oz++) {
                    // Solo el borde del anillo (el interior ya se visitó)
                    if (Math.max(Math.abs(ox), Math.abs(oz)) !== ring) continue;
                    const list = this.coarse.get(bucketKey(cbx + ox, cbz + oz));
                    if (!list) continue;
                    for (let k = 0; k < list.length; k++) {
                        const i = list[k];
                        const dx = this.xs[i] - x;
                        const dz = this.zs[i] - z;
                        const d = dx * dx + dz * dz;
                        if (d < bestSq) {
                            bestSq = d;
                            bestIndex = i;
                        }
                    }
                }
            }
            // Todo lo no visitado está al menos a ring * COARSE_BUCKET
            if (bestIndex >= 0 && Math.sqrt(bestSq) <= ring * COARSE_BUCKET) break;
        }

        if (bestIndex < 0) {
            // Respaldo (no debería ocurrir): barrido de los puntos decimados
            for (const i of this.decimated) {
                const dx = this.xs[i] - x;
                const dz = this.zs[i] - z;
                const d = dx * dx + dz * dz;
                if (d < bestSq) {
                    bestSq = d;
                    bestIndex = i;
                }
            }
        }

        // Afinar entre los puntos originales cercanos al decimado
        const from = Math.max(0, bestIndex - DECIMATION);
        const to = Math.min(this.count - 1, bestIndex + DECIMATION);
        let refinedSq = Infinity;
        let refinedIndex = bestIndex;
        for (let i = from; i <= to; i++) {
            const dx = this.xs[i] - x;
            const dz = this.zs[i] - z;
            const d = dx * dx + dz * dz;
            if (d < refinedSq) {
                refinedSq = d;
                refinedIndex = i;
            }
        }
        return refinedIndex;
    }

    /** Proyección exacta sobre los segmentos adyacentes al punto más cercano */
    _refine(x, z, index) {
        const out = this.result;
        let bestDist = Infinity;
        let bestHeight = this.ys[index];

        for (let s = index - 1; s <= index; s++) {
            if (s < 0 || s + 1 >= this.count) continue;
            const ax = this.xs[s];
            const az = this.zs[s];
            const abx = this.xs[s + 1] - ax;
            const abz = this.zs[s + 1] - az;
            const lengthSq = abx * abx + abz * abz || 1;
            let t = ((x - ax) * abx + (z - az) * abz) / lengthSq;
            t = t < 0 ? 0 : t > 1 ? 1 : t;
            const d = Math.hypot(ax + abx * t - x, az + abz * t - z);
            if (d < bestDist) {
                bestDist = d;
                bestHeight = this.ys[s] + (this.ys[s + 1] - this.ys[s]) * t;
            }
        }

        if (!Number.isFinite(bestDist)) {
            bestDist = Math.hypot(this.xs[index] - x, this.zs[index] - z);
        }
        out.distance = bestDist;
        out.height = bestHeight;
        return out;
    }
}
