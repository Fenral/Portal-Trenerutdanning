"use server";

import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function loginAction(formData: FormData): Promise<never> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const client = await createSupabaseServerClient();
  if (!email || !password || email.length > 254 || password.length > 1024)
    redirect("/login?error=1");
  const { error } = await client.auth.signInWithPassword({ email, password });
  if (error) redirect("/login?error=1");
  redirect("/editor/studio");
}

export async function logoutAction(): Promise<never> {
  const client = await createSupabaseServerClient();
  await client.auth.signOut();
  redirect("/login");
}
