import { calculateMissionXp } from './FlowEngine.js';
import { enqueueSyncJob, getProgress, saveProgress } from '../storage/sessions.js';

const DEFAULT_PROGRESS = {
    schemaVersion: 1,
    xp: 0,
    level: 1,
    completedMissions: 0,
    totalStars: 0,
    weekly: { week: '', activeMinutes: 0, goalMinutes: 90 },
    unlocks: ['theme-alpine'],
};

export function getWeekKey(date = new Date()) {
    const utc = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const day = utc.getUTCDay() || 7;
    utc.setUTCDate(utc.getUTCDate() + 4 - day);
    const yearStart = new Date(Date.UTC(utc.getUTCFullYear(), 0, 1));
    const week = Math.ceil((((utc - yearStart) / 86400000) + 1) / 7);
    return `${utc.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

export function levelForXp(xp) {
    return Math.max(1, Math.floor(Math.sqrt(Math.max(0, xp) / 150)) + 1);
}

export async function recordMissionProgress(session) {
    const current = { ...DEFAULT_PROGRESS, ...(await getProgress() || {}) };
    const weekKey = getWeekKey();
    const weekly = current.weekly?.week === weekKey
        ? { ...current.weekly }
        : { week: weekKey, activeMinutes: 0, goalMinutes: current.weekly?.goalMinutes || 90 };
    const activeMinutes = Math.max(0, (session.activeDuration || session.duration || 0) / 60);
    const stars = session.gameResult?.totalStars || 0;
    const gainedXp = calculateMissionXp({
        completed: session.status === 'completed',
        activeMinutes,
        totalStars: stars,
    });
    weekly.activeMinutes += activeMinutes;

    const next = {
        ...current,
        xp: current.xp + gainedXp,
        level: levelForXp(current.xp + gainedXp),
        completedMissions: current.completedMissions + 1,
        totalStars: current.totalStars + stars,
        weekly,
        updatedAt: new Date().toISOString(),
    };
    await saveProgress(next);
    await enqueueSyncJob('complete_session', {
        clientSessionId: session.clientSessionId,
        session,
        progress: next,
    });
    return { progress: next, gainedXp };
}
