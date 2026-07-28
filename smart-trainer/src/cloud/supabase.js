let clientPromise = null;

export function isCloudConfigured() {
    return Boolean(import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY);
}

export async function getSupabaseClient() {
    if (!isCloudConfigured()) return null;
    if (!clientPromise) {
        clientPromise = import('@supabase/supabase-js').then(({ createClient }) => createClient(
            import.meta.env.VITE_SUPABASE_URL,
            import.meta.env.VITE_SUPABASE_ANON_KEY,
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
