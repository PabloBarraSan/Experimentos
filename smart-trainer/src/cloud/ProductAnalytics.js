import { getCloudUser, getSupabaseClient } from './supabase.js';

const ALLOWED_EVENTS = new Set([
    'mission_started', 'mission_completed', 'mission_abandoned', 'trainer_control_error',
    'route_decision', 'ghost_selected', 'render_preset', 'sync_error',
]);

export async function trackProductEvent(eventName, properties = {}) {
    if (!ALLOWED_EVENTS.has(eventName) || !navigator.onLine) return false;
    const [client, user] = await Promise.all([getSupabaseClient(), getCloudUser()]);
    if (!client || !user) return false;
    const safeProperties = Object.fromEntries(Object.entries(properties).filter(([, value]) => (
        ['string', 'number', 'boolean'].includes(typeof value) || value === null
    )));
    const { error } = await client.from('product_events').insert({
        user_id: user.id,
        event_name: eventName,
        properties: safeProperties,
    });
    return !error;
}

