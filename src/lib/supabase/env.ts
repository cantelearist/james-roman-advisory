export function getSupabasePublicConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) return null;
  return { url, anonKey };
}

export function getSupabaseServiceConfig() {
  const publicConfig = getSupabasePublicConfig();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!publicConfig || !serviceRoleKey) return null;
  return { ...publicConfig, serviceRoleKey };
}

export function requireSupabasePublicConfig() {
  const config = getSupabasePublicConfig();
  if (!config) {
    throw new Error("Supabase public environment variables are not configured.");
  }
  return config;
}

export function requireSupabaseServiceConfig() {
  const config = getSupabaseServiceConfig();
  if (!config) {
    throw new Error("Supabase service environment variables are not configured.");
  }
  return config;
}
