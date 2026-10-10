import { describe, expect, it } from 'vitest';
import { mergeTrainerData } from '../src/utils/liveData.js';

describe('mergeTrainerData', () => {
    it('no borra el pulso de la banda con el 0 que manda el rodillo', () => {
        const live = { power: 0, heartRate: 142 };
        mergeTrainerData(live, { power: 180, cadence: 88, heartRate: 0 });
        expect(live).toMatchObject({ power: 180, cadence: 88, heartRate: 142 });
    });

    it('conserva el pulso cuando el rodillo no lo envía', () => {
        const live = { heartRate: 150 };
        mergeTrainerData(live, { power: 200 });
        expect(live.heartRate).toBe(150);
    });

    it('acepta el pulso del rodillo si es válido', () => {
        const live = { heartRate: 0 };
        mergeTrainerData(live, { heartRate: 133 });
        expect(live.heartRate).toBe(133);
    });
});
