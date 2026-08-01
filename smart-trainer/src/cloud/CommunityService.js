import { getCloudUser, getSupabaseClient } from './supabase.js';

async function requireCloud() {
    const [client, user] = await Promise.all([getSupabaseClient(), getCloudUser()]);
    if (!client || !user) throw new Error('Inicia sesión con Google para usar retos');
    return { client, user };
}

export async function listChallenges() {
    const { client } = await requireCloud();
    const { data, error } = await client
        .from('challenges')
        .select('*, challenge_entries(user_id,score,max_combo,completed_at)')
        .gte('ends_at', new Date().toISOString())
        .order('ends_at', { ascending: true });
    if (error) throw error;
    return data || [];
}

export async function createChallenge({ mission, days = 7, visibility = 'friends' }) {
    const { client, user } = await requireCloud();
    const startsAt = new Date();
    const endsAt = new Date(startsAt.getTime() + days * 86400000);
    const { data, error } = await client.from('challenges').insert({
        owner_id: user.id,
        workout_id: mission.id,
        mission_version: mission.version,
        title: `${mission.title} · reto de ${days} días`,
        starts_at: startsAt.toISOString(),
        ends_at: endsAt.toISOString(),
        visibility,
    }).select().single();
    if (error) throw error;
    await joinChallenge(data.id);
    return data;
}

export async function joinChallenge(challengeId) {
    const { client, user } = await requireCloud();
    const { error } = await client.from('challenge_entries').upsert({
        challenge_id: challengeId,
        user_id: user.id,
    }, { onConflict: 'challenge_id,user_id', ignoreDuplicates: true });
    if (error) throw error;
}

export async function joinChallengeByCode(inviteCode) {
    const { client } = await requireCloud();
    const { data, error } = await client.rpc('join_challenge_by_code', { code: inviteCode.trim() });
    if (error || !data) throw error || new Error('Código no encontrado');
    return { id: data };
}

export async function listConnections() {
    const { client } = await requireCloud();
    const { data, error } = await client.from('connections').select('*').order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
}

export async function requestConnection(addresseeId) {
    const { client, user } = await requireCloud();
    if (addresseeId === user.id) throw new Error('No puedes añadirte a ti mismo');
    const { error } = await client.from('connections').insert({ requester_id: user.id, addressee_id: addresseeId, status: 'pending' });
    if (error) throw error;
}

export async function acceptConnection(requesterId) {
    const { client, user } = await requireCloud();
    const { error } = await client.from('connections').update({ status: 'accepted' })
        .eq('requester_id', requesterId).eq('addressee_id', user.id);
    if (error) throw error;
}
