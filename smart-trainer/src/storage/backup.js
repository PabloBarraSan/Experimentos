/**
 * Backup - Copia de seguridad local completa (sesiones, rutinas, progreso, cola de sync, ajustes)
 * Smart Trainer Controller
 */

import {
    getAllSessions,
    getSavedWorkouts,
    getProgress,
    getSyncJobs,
    getActiveSession,
    saveSession,
    saveWorkout,
    saveProgress,
} from './sessions.js';

const BACKUP_FORMAT = 'smart-trainer-backup';
const BACKUP_VERSION = 1;
const SETTINGS_KEY = 'smartTrainer_settings';

export async function buildBackup() {
    const [sessions, workouts, progress, syncOutbox, activeSession] = await Promise.all([
        getAllSessions(),
        getSavedWorkouts(),
        getProgress(),
        getSyncJobs(),
        getActiveSession(),
    ]);

    let settings = null;
    try {
        settings = JSON.parse(localStorage.getItem(SETTINGS_KEY) || 'null');
    } catch {
        settings = null;
    }

    return {
        format: BACKUP_FORMAT,
        version: BACKUP_VERSION,
        exportedAt: new Date().toISOString(),
        counts: { sessions: sessions.length, workouts: workouts.length, syncOutbox: syncOutbox.length },
        sessions,
        workouts,
        progress,
        syncOutbox,
        activeSession,
        settings,
    };
}

export async function downloadBackup() {
    const backup = await buildBackup();
    const blob = new Blob([JSON.stringify(backup)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `smart-trainer-backup-${backup.exportedAt.slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    return backup.counts;
}

/**
 * Restaura un backup. Es aditivo e idempotente: las sesiones y rutinas se guardan por id,
 * así que repetir la restauración no duplica nada. No toca ajustes ni progreso existentes
 * salvo que no haya ninguno.
 */
export async function restoreBackup(backup) {
    if (!backup || backup.format !== BACKUP_FORMAT || !Array.isArray(backup.sessions)) {
        throw new Error('El archivo no es una copia de seguridad de Smart Trainer.');
    }

    for (const session of backup.sessions) await saveSession(session);
    for (const workout of backup.workouts || []) await saveWorkout(workout);

    if (backup.progress && !(await getProgress())) await saveProgress(backup.progress);
    if (backup.settings && !localStorage.getItem(SETTINGS_KEY)) {
        localStorage.setItem(SETTINGS_KEY, JSON.stringify(backup.settings));
    }

    return { sessions: backup.sessions.length, workouts: (backup.workouts || []).length };
}

export async function restoreBackupFromFile(file) {
    let backup;
    try {
        backup = JSON.parse(await file.text());
    } catch {
        throw new Error('El archivo no es un JSON válido.');
    }
    return restoreBackup(backup);
}
