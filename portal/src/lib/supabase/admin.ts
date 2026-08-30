import { createClient } from "@supabase/supabase-js";

import {
  getSupabasePublicEnvironment,
  getSupabaseSecretKey,
} from "./environment";

export function createSupabaseAdminClient() {
  const environment = getSupabasePublicEnvironment();

  return createClient(environment.url, getSupabaseSecretKey(), {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
