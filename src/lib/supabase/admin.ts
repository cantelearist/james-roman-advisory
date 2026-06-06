import { createClient } from "@supabase/supabase-js";

import { requireSupabaseServiceConfig } from "./env";

export function createSupabaseAdminClient() {
  const { url, serviceRoleKey } = requireSupabaseServiceConfig();

  return createClient(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
