import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

Deno.serve(async (request) => {
  const cors = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  };
  if (request.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (request.method !== 'POST') return new Response('Method not allowed', { status: 405 });

  const authorization = request.headers.get('Authorization');
  if (!authorization) return new Response('Unauthorized', { status: 401 });
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: authorization } } },
  );
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response('Unauthorized', { status: 401 });

  const { clientSessionId, session, progress } = await request.json();
  if (!clientSessionId || !session) return new Response('Invalid payload', { status: 400 });

  const { data: saved, error } = await supabase
    .from('sessions')
    .upsert({
      user_id: user.id,
      client_session_id: clientSessionId,
      workout_id: session.workoutId,
      started_at: new Date(session.startTime).toISOString(),
      completed_at: session.endTime ? new Date(session.endTime).toISOString() : new Date().toISOString(),
      active_duration_seconds: Math.round(session.activeDuration || session.duration || 0),
      metrics: session.metrics || {},
      adherence: session.adherence,
      game_result: session.gameResult,
      raw_summary: {
        controlMode: session.controlMode,
        experienceMode: session.experienceMode,
        status: session.status,
        missionId: session.missionId,
        missionVersion: session.missionVersion,
      },
    }, { onConflict: 'user_id,client_session_id' })
    .select('id')
    .single();
  if (error) return Response.json({ error: error.message }, { status: 400 });

  if (session.status === 'completed' && session.gameResult?.ghostTrace) {
    await supabase.from('ghost_traces').upsert({
      session_id: saved.id,
      user_id: user.id,
      trace: session.gameResult.ghostTrace,
      mission_id: session.missionId || session.workoutId,
      mission_version: session.missionVersion || 1,
      score: session.gameResult.score || 0,
      visibility: 'private',
      metadata: {
        maxCombo: session.gameResult.maxCombo || 0,
        scoreAlgorithmVersion: session.gameResult.scoreAlgorithmVersion || 1,
        status: session.status,
      },
    }, { onConflict: 'session_id' });
  }
  if (progress) {
    await supabase.from('user_progress').upsert({
      user_id: user.id,
      xp: progress.xp,
      level: progress.level,
      completed_missions: progress.completedMissions,
      total_stars: progress.totalStars,
      weekly: progress.weekly,
      progress_version: progress.schemaVersion || 2,
      best_results: progress.bestResults || {},
      cosmetics: progress.cosmetics || {},
      streak: progress.streak || {},
      updated_at: new Date().toISOString(),
    });
  }

  if (session.challengeId && session.status === 'completed') {
    const { data: challenge } = await supabase
      .from('challenges')
      .select('id, workout_id, mission_version, starts_at, ends_at')
      .eq('id', session.challengeId)
      .single();
    const now = Date.now();
    const validChallenge = challenge
      && challenge.workout_id === (session.missionId || session.workoutId)
      && Number(challenge.mission_version) === Number(session.missionVersion || 1)
      && now >= new Date(challenge.starts_at).getTime()
      && now <= new Date(challenge.ends_at).getTime();
    if (validChallenge) {
      await supabase.from('challenge_entries').upsert({
        challenge_id: challenge.id,
        user_id: user.id,
        session_id: saved.id,
        score: Math.max(0, Math.min(10000, Math.round((session.gameResult?.adherence || 0) * 10000))),
        max_combo: Math.max(0, Math.round(session.gameResult?.maxCombo || 0)),
        completed_at: new Date().toISOString(),
      }, { onConflict: 'challenge_id,user_id' });
    }
  }
  return Response.json({ sessionId: saved.id }, { headers: cors });
});
