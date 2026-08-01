let clientPromise = null;

const PROJECT_DEFAULTS = {
    url: 'https://quovbcgoiirfxtpjxapy.supabase.co',
    publishableKey: 'sb_publishable_Nmjod5Mgrx_hUmseBYt17A_dRhsTKsf',
};

function getPublicKey() {
    return import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY
        || import.meta.env.VITE_SUPABASE_ANON_KEY
        || PROJECT_DEFAULTS.publishableKey;
}

function getProjectUrl() {
    return import.meta.env.VITE_SUPABASE_URL || PROJECT_DEFAULTS.url;
}

export function isCloudConfigured() {
    return Boolean(getProjectUrl() && getPublicKey());
}

export async function getSupabaseClient() {
    if (!isCloudConfigured()) return null;
    if (!clientPromise) {
        clientPromise = import('@supabase/supabase-js').then(({ createClient }) => createClient(
            getProjectUrl(),
            getPublicKey(),
            {
                auth: {
                    persistSession: true,
                    autoRefreshToken: true,
                    detectSessionInUrl: true,
                },
            },
        ));
    }
    return clientPromise;
}

export async function sendMagicLink(email) {
    const client = await getSupabaseClient();
    if (!client) throw new Error('La nube no está configurada');
    return client.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: window.location.origin + window.location.pathname },
    });
}

export async function signInWithGoogle() {
    const client = await getSupabaseClient();
    if (!client) throw new Error('La nube no está configurada');
    return client.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: window.location.origin + window.location.pathname },
    });
}

export async function signOut() {
    const client = await getSupabaseClient();
    return client?.auth.signOut();
}

export async function getCloudUser() {
    const client = await getSupabaseClient();
    if (!client) return null;
    const { data } = await client.auth.getUser();
    return data.user || null;
}

export async function getAuthProviders() {
    if (!isCloudConfigured()) return { google: false, email: false };
    try {
        const response = await fetch(`${getProjectUrl()}/auth/v1/settings`, {
            headers: { apikey: getPublicKey() },
        });
        const settings = await response.json();
        return { google: Boolean(settings.external?.google), email: Boolean(settings.external?.email) };
    } catch {
        return { google: false, email: true };
    }
}
