import type { SupabaseClient } from "@supabase/supabase-js";

import type { Role } from "@/features/access/permissions";
import { isAdministrator } from "@/features/access/require-administrator";

const ROLE_PRECEDENCE: readonly Role[] = [
  "course_lead",
  "course_teacher",
  "editor",
];

/**
 * Finner aktørens effektive rolle for can()-sjekker. Global administrator
 * gjenbruker isAdministrator (krever global, ikke-tilbakekalt rolle);
 * ellers gjelder høyeste aktive kursrolle, og alle andre er student.
 * Returnerer null når brukeren ikke har aktiv konto.
 */
export async function actorRoleFor(
  userId: string,
  adminClient: SupabaseClient,
): Promise<Role | null> {
  if (await isAdministrator(userId, adminClient)) return "administrator";

  const account = await adminClient
    .from("user_accounts")
    .select("profile_id")
    .eq("user_id", userId)
    .eq("is_active", true)
    .maybeSingle();
  if (account.error) throw new Error("ADMIN_QUERY_AUTHORIZATION_FAILED");
  if (!account.data) return null;

  const roles = await adminClient
    .from("role_assignments")
    .select("role")
    .eq("profile_id", account.data.profile_id)
    .is("revoked_at", null);
  if (roles.error) throw new Error("ADMIN_QUERY_AUTHORIZATION_FAILED");

  const assigned = new Set((roles.data ?? []).map((row) => row.role));
  return ROLE_PRECEDENCE.find((role) => assigned.has(role)) ?? "student";
}
