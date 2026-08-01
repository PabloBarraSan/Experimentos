import { getAllSessions } from '../storage/sessions.js';

export function isGhostCompatible(session, mission) {
    return Boolean(
        session?.gameResult?.ghostTrace?.length
        && session.status === 'completed'
        && session.missionId === mission?.id
        && Number(session.missionVersion) === Number(mission?.version)
        && Number(session.gameResult.scoreAlgorithmVersion || 1) === 2
    );
}

export async function getPersonalGhost(mission, preference = 'best') {
    if (!mission) return null;
    const sessions = (await getAllSessions()).filter((session) => isGhostCompatible(session, mission));
    if (!sessions.length) return null;
    if (preference === 'last') return sessions.sort((a, b) => (b.endTime || 0) - (a.endTime || 0))[0];
    return sessions.sort((a, b) => (b.gameResult?.score || 0) - (a.gameResult?.score || 0))[0];
}

export function interpolateGhost(trace = [], elapsedSeconds = 0) {
    if (!trace.length) return null;
    const before = [...trace].reverse().find((point) => point.elapsed <= elapsedSeconds) || trace[0];
    const after = trace.find((point) => point.elapsed >= elapsedSeconds) || trace.at(-1);
    if (before === after || after.elapsed === before.elapsed) return { ...before };
    const t = (elapsedSeconds - before.elapsed) / (after.elapsed - before.elapsed);
    return {
        elapsed: elapsedSeconds,
        progress: before.progress + (after.progress - before.progress) * t,
        flow: before.flow + (after.flow - before.flow) * t,
    };
}
