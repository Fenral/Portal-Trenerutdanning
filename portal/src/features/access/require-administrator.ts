import type { SupabaseClient } from "@supabase/supabase-js";

export async function isAdministrator(
  userId: string,
  adminClient: SupabaseClient,
): Promise<boolean> {
  const { data: account, error: accountError } = await adminClient
    .from("user_accounts")
    .select("profile_id")
    .eq("user_id", userId)
    .eq("is_active", true)
    .maybeSingle();

  if (accountError) {
    throw new Error("ADMIN_AUTHORIZATION_LOOKUP_FAILED");
  }

  if (!account) {
    return false;
  }

  const { count, error: roleError } = await adminClient
    .from("role_assignments")
    .select("id", { count: "exact", head: true })
    .eq("profile_id", account.profile_id)
    .eq("role", "administrator")
    .is("course_template_id", null)
    .is("course_run_id", null)
    .is("revoked_at", null);

  if (roleError) {
    throw new Error("ADMIN_AUTHORIZATION_LOOKUP_FAILED");
  }

  return count === 1;
}
