import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";

import { getSupabasePublicEnvironment } from "./environment";

export type SupabaseCookieWrite = Readonly<{
  name: string;
  value: string;
  options: CookieOptions;
}>;

type CookieWriteObserver = (
  cookiesToSet: readonly SupabaseCookieWrite[],
  headers: Readonly<Record<string, string>>,
) => void;

export async function createSupabaseServerClient(
  observeCookieWrites?: CookieWriteObserver,
) {
  const cookieStore = await cookies();
  const environment = getSupabasePublicEnvironment();

  return createServerClient(environment.url, environment.publishableKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet, headers) {
        observeCookieWrites?.(cookiesToSet, headers);

        try {
          for (const cookie of cookiesToSet) {
            cookieStore.set(cookie.name, cookie.value, cookie.options);
          }
        } catch {
          // Server Components cannot write cookies. Route handlers and server
          // actions can, while auth callbacks use the observer above.
        }
      },
    },
  });
}
