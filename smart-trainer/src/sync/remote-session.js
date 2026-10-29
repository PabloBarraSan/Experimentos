/**
 * Reconstruye una sesión local a partir de la copia que guarda training-app.
 * El servidor no conserva todo (p. ej. el tiempo en pausa), pero sí lo que usan el historial, las rutas y los fantasmas.
 */
export function sessionFromRemote(remote) {
    const startTime = new Date(remote.startedAt).getTime();
    const duration = remote.activeDurationSeconds || 0;
    const session = {
        schemaVersion: 2,
        id: `remote_${remote.clientSessionId}`,
        clientSessionId: remote.clientSessionId,
        workoutId: remote.workoutId ?? null,
        plannedWorkoutId: remote.plannedWorkoutId ?? null,
        workoutName: remote.workoutName,
        ftp: remote.ftp ?? 200,
        routeId: remote.routeId ?? null,
        routeName: remote.routeName ?? null,
        date: new Date(startTime).toISOString(),
        startTime,
        endTime: remote.endedAt ? new Date(remote.endedAt).getTime() : null,
        duration,
        activeDuration: duration,
        pausedDuration: 0,
        dataPoints: remote.dataPoints || [],
        status: remote.status,
        metrics: remote.metrics && Object.keys(remote.metrics).length ? remote.metrics : null,
        controlMode: remote.controlMode || 'manual',
        experienceMode: remote.experienceMode || 'metrics',
        adherence: remote.adherence ?? null,
        gameResult: remote.gameResult ?? null,
        syncStatus: { strava: { synced: false, activityId: null, syncedAt: null, error: null } },
    };
    if (remote.feedback) session.feedback = remote.feedback;
    return session;
}
