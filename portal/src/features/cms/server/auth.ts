import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { assertCmsQuery, CmsError } from "./errors";
import type { CmsItem, CmsSession } from "./types";
import { CmsId } from "./validation";

export async function requireCmsSession(): Promise<CmsSession> {
  const client = await createSupabaseServerClient();
  const {
    data: { user },
    error,
  } = await client.auth.getUser();
  if (error || !user) throw new CmsError(401, "Logg inn for å åpne CMS-et.");
  const admin = createSupabaseAdminClient();
  const account = await admin
    .from("user_accounts")
    .select("profile_id")
    .eq("user_id", user.id)
    .eq("is_active", true)
    .maybeSingle();
  assertCmsQuery(account.error);
  if (!account.data)
    throw new CmsError(403, "Brukerkontoen har ikke tilgang til portalen.");
  const assignments = await admin
    .from("role_assignments")
    .select("role,course_run_id,course_template_id")
    .eq("profile_id", account.data.profile_id)
    .is("revoked_at", null);
  assertCmsQuery(assignments.error);
  const roles = assignments.data ?? [];
  const isGlobalManager = roles.some(
    (role) =>
      ["administrator", "editor"].includes(role.role) &&
      role.course_run_id === null &&
      role.course_template_id === null,
  );
  const staffRoles = roles.filter((role) =>
    ["course_teacher", "course_lead"].includes(role.role),
  );
  const courseIds = new Set<string>(
    staffRoles.flatMap((role) =>
      role.course_run_id ? [role.course_run_id as string] : [],
    ),
  );
  const templateIds = staffRoles.flatMap((role) =>
    role.course_template_id ? [role.course_template_id as string] : [],
  );
  if (templateIds.length) {
    const courses = await admin
      .from("course_runs")
      .select("id")
      .in("template_id", templateIds);
    assertCmsQuery(courses.error);
    for (const course of courses.data ?? []) courseIds.add(course.id);
  }
  return {
    client,
    admin,
    profileId: account.data.profile_id,
    isGlobalManager,
    courseIds: [...courseIds],
  };
}

export function requireCmsStaff(session: CmsSession) {
  if (!session.isGlobalManager && !session.courseIds.length)
    throw new CmsError(403, "Du har ikke redigeringstilgang til CMS-et.");
}

export function canEditCmsItem(
  session: Pick<CmsSession, "isGlobalManager" | "courseIds">,
  item: Pick<CmsItem, "courseRunId">,
) {
  return (
    session.isGlobalManager ||
    (item.courseRunId !== null && session.courseIds.includes(item.courseRunId))
  );
}

export async function readCmsItem(
  session: CmsSession,
  itemId: string,
): Promise<CmsItem> {
  CmsId.parse(itemId);
  const [item, metadata] = await Promise.all([
    session.admin
      .from("content_items")
      .select("id,title,slug,kind")
      .eq("id", itemId)
      .maybeSingle(),
    session.admin
      .from("cms_content_metadata")
      .select("level,course_run_id,source_item_id,source_revision_id")
      .eq("content_item_id", itemId)
      .maybeSingle(),
  ]);
  assertCmsQuery(item.error);
  assertCmsQuery(metadata.error);
  if (!item.data) throw new CmsError(404, "Innholdet finnes ikke.");
  return {
    ...item.data,
    level: metadata.data?.level ?? null,
    courseRunId: metadata.data?.course_run_id ?? null,
    sourceItemId: metadata.data?.source_item_id ?? null,
    sourceRevisionId: metadata.data?.source_revision_id ?? null,
  } as CmsItem;
}

export async function authorizeCmsItem(
  session: CmsSession,
  itemId: string,
): Promise<CmsItem> {
  requireCmsStaff(session);
  const item = await readCmsItem(session, itemId);
  if (!canEditCmsItem(session, item))
    throw new CmsError(
      403,
      "Du kan bare redigere innhold for kursene du underviser på.",
    );
  return item;
}
