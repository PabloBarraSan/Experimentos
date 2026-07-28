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
      raw_summary: { controlMode: session.controlMode, experienceMode: session.experienceMode },
    }, { onConflict: 'user_id,client_session_id' })
    .select('id')
    .single();
  if (error) return Response.json({ error: error.message }, { status: 400 });

  if (session.gameResult?.ghostTrace) {
    await supabase.from('ghost_traces').upsert({
      session_id: saved.id,
      user_id: user.id,
      trace: session.gameResult.ghostTrace,
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
      updated_at: new Date().toISOString(),
    });
  }
  return Response.json({ sessionId: saved.id }, { headers: cors });
});
