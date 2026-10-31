const EXPEDITION_VISUAL_SETTINGS_KEY = 'smartTrainer_expedition_visuals_v1';

export const DEFAULT_VISUAL_SETTINGS = {
    camera: 'standard',
    hud: 'essential',
    hudSize: 'normal',
    quality: 'auto',
    reducedMotion: false,
    rivals: true,
};

export function loadVisualSettings() {
    try {
        const saved = JSON.parse(localStorage.getItem(EXPEDITION_VISUAL_SETTINGS_KEY) || '{}');
        return { ...DEFAULT_VISUAL_SETTINGS, ...saved };
    } catch {
        return { ...DEFAULT_VISUAL_SETTINGS };
    }
}

export function saveVisualSettings(settings) {
    try {
        localStorage.setItem(EXPEDITION_VISUAL_SETTINGS_KEY, JSON.stringify(settings));
    } catch {
        // Las preferencias visuales no deben bloquear un entrenamiento.
    }
}
