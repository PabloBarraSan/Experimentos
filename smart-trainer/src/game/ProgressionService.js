import { calculateMissionXp } from './FlowEngine.js';
import { enqueueSyncJob, getProgress, saveProgress } from '../storage/sessions.js';

const DEFAULT_PROGRESS = {
    schemaVersion: 2,
    xp: 0,
    level: 1,
    completedMissions: 0,
    totalStars: 0,
    weekly: { week: '', activeMinutes: 0, goalMinutes: 90 },
    unlocks: ['theme-alpine'],
    bestResults: {},
    cosmetics: {
        bikes: ['bike-starter'],
        jerseys: ['jersey-starter'],
        helmets: ['helmet-starter'],
        trails: ['trail-none'],
        badges: [],
        active: { bike: 'bike-starter', jersey: 'jersey-starter', helmet: 'helmet-starter', trail: 'trail-none' },
    },
    streak: { activeWeeks: 0, lastWeek: '' },
};

export function migrateProgress(progress = {}) {
    const migrated = {
        ...DEFAULT_PROGRESS,
        ...progress,
        schemaVersion: 2,
        weekly: { ...DEFAULT_PROGRESS.weekly, ...(progress.weekly || {}) },
        bestResults: { ...(progress.bestResults || {}) },
        cosmetics: {
            ...DEFAULT_PROGRESS.cosmetics,
            ...(progress.cosmetics || {}),
            active: { ...DEFAULT_PROGRESS.cosmetics.active, ...(progress.cosmetics?.active || {}) },
        },
        streak: { ...DEFAULT_PROGRESS.streak, ...(progress.streak || {}) },
    };
    migrated.unlocks = [...new Set([...(progress.unlocks || []), 'theme-alpine'])];
    return migrated;
}

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
    const current = migrateProgress(await getProgress() || {});
    const weekKey = getWeekKey();
    const weekly = current.weekly?.week === weekKey
        ? { ...current.weekly }
        : { week: weekKey, activeMinutes: 0, goalMinutes: current.weekly?.goalMinutes || 90 };
    const activeMinutes = Math.max(0, (session.activeDuration || session.duration || 0) / 60);
    const stars = session.gameResult?.totalStars || 0;
    const completed = session.status === 'completed';
    const gainedXp = calculateMissionXp({
        completed,
        activeMinutes,
        totalStars: stars,
    });
    weekly.activeMinutes += activeMinutes;

    const missionKey = `${session.missionId || session.workoutId}:v${session.missionVersion || 1}`;
    const priorBest = current.bestResults[missionKey];
    const score = session.gameResult?.score || 0;
    const bestResults = completed && (!priorBest || score > priorBest.score)
        ? { ...current.bestResults, [missionKey]: { score, sessionId: session.id, completedAt: new Date().toISOString() } }
        : current.bestResults;
    const activeWeeks = current.streak.lastWeek === weekKey
        ? current.streak.activeWeeks
        : current.streak.activeWeeks + 1;
    const unlocks = new Set(current.unlocks);
    if (current.totalStars + stars >= 9) unlocks.add('jersey-aurora');
    if (current.xp + gainedXp >= 600) unlocks.add('trail-mist');
    if (completed && session.missionId === 'northern-peaks-30' && score >= 9000) unlocks.add('bike-north');

    const next = {
        ...current,
        xp: current.xp + gainedXp,
        level: levelForXp(current.xp + gainedXp),
        completedMissions: current.completedMissions + (completed ? 1 : 0),
        totalStars: current.totalStars + stars,
        weekly,
        bestResults,
        unlocks: [...unlocks],
        streak: { activeWeeks, lastWeek: weekKey },
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
