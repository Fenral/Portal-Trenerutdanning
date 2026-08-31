import { notFound, redirect } from "next/navigation";

import { resolveTestLogin } from "@/features/access/test-login";
import { getE2EDemoPassword, isE2ETestMode } from "@/lib/supabase/environment";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET(request: Request): Promise<never> {
  const demoLoginEnabled = isE2ETestMode() || process.env.DEMO_MODE === "true";
  const resolution = resolveTestLogin(demoLoginEnabled, () =>
    new URL(request.url).searchParams.get("as"),
  );

  if (resolution.status !== "allowed") {
    notFound();
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: resolution.email,
    password: getE2EDemoPassword(),
  });

  if (error) {
    notFound();
  }

  redirect(resolution.destination);
}
