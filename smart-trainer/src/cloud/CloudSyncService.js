import { getSyncJobs, removeSyncJob } from '../storage/sessions.js';
import { getCloudUser, getSupabaseClient, isCloudConfigured } from './supabase.js';
import { trackProductEvent } from './ProductAnalytics.js';

let flushPromise = null;

export async function flushSyncOutbox() {
    if (!isCloudConfigured() || !navigator.onLine) return { synced: 0, pending: 0 };
    if (flushPromise) return flushPromise;
    flushPromise = runFlush().finally(() => {
        flushPromise = null;
    });
    return flushPromise;
}

async function runFlush() {
    const [client, user, jobs] = await Promise.all([
        getSupabaseClient(),
        getCloudUser(),
        getSyncJobs(),
    ]);
    if (!client || !user) return { synced: 0, pending: jobs.length };

    let synced = 0;
    for (const job of jobs) {
        if (job.type !== 'complete_session') continue;
        const { error } = await client.functions.invoke('complete-session', {
            body: job.payload,
        });
        if (error) {
            trackProductEvent('sync_error', { jobType: job.type, message: error.message?.slice(0, 120) || 'unknown' });
            continue;
        }
        await removeSyncJob(job.id);
        synced++;
    }
    return { synced, pending: Math.max(0, jobs.length - synced) };
}

export function startBackgroundSync() {
    const handleOnline = () => flushSyncOutbox().catch(() => {});
    window.addEventListener('online', handleOnline);
    handleOnline();
    return () => window.removeEventListener('online', handleOnline);
}
