import type { SupabaseClient } from "@supabase/supabase-js";

export type ContentManagerIdentity = Readonly<{
  profileId: string;
  role: "administrator" | "editor";
}>;

export async function getContentManagerIdentity(
  userId: string,
  adminClient: SupabaseClient,
): Promise<ContentManagerIdentity | null> {
  const { data: account, error: accountError } = await adminClient
    .from("user_accounts")
    .select("profile_id")
    .eq("user_id", userId)
    .eq("is_active", true)
    .maybeSingle();

  if (accountError) {
    throw new Error("CONTENT_AUTHORIZATION_LOOKUP_FAILED");
  }

  if (!account) {
    return null;
  }

  const { data: assignments, error: roleError } = await adminClient
    .from("role_assignments")
    .select("role")
    .eq("profile_id", account.profile_id)
    .in("role", ["administrator", "editor"])
    .is("course_template_id", null)
    .is("course_run_id", null)
    .is("revoked_at", null);

  if (roleError) {
    throw new Error("CONTENT_AUTHORIZATION_LOOKUP_FAILED");
  }

  const roles = new Set(
    (assignments ?? []).map((assignment) => assignment.role as string),
  );
  const role = roles.has("administrator")
    ? "administrator"
    : roles.has("editor")
      ? "editor"
      : null;

  return role ? { profileId: account.profile_id, role } : null;
}
