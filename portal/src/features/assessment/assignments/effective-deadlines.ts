import type { SupabaseClient } from "@supabase/supabase-js";

export type EffectiveDeadlines = Readonly<{
  /**
   * Latest deadline override for the enrollment/activity pair, otherwise the
   * assignment definition default. `null` when the activity has no assignment
   * definition.
   */
  effectiveDeadline: (
    enrollmentId: string,
    activityId: string,
  ) => string | null;
}>;

function assertNoQueryError(error: { message: string } | null): void {
  if (error) {
    throw new Error(`EFFECTIVE_DEADLINE_QUERY_FAILED:${error.message}`);
  }
}

export async function loadEffectiveDeadlines(
  client: SupabaseClient,
  enrollmentIds: readonly string[],
): Promise<EffectiveDeadlines> {
  if (enrollmentIds.length === 0) {
    return { effectiveDeadline: () => null };
  }

  const [definitions, overrides] = await Promise.all([
    client
      .from("assignment_definitions")
      .select("activity_id,default_deadline"),
    client
      .from("assignment_deadline_overrides")
      .select("enrollment_id,activity_id,deadline,created_at")
      .in("enrollment_id", [...enrollmentIds])
      .order("created_at", { ascending: false }),
  ]);
  assertNoQueryError(definitions.error);
  assertNoQueryError(overrides.error);

  const defaultByActivity = new Map<string, string>(
    (definitions.data ?? []).map((row) => [
      row.activity_id,
      row.default_deadline,
    ]),
  );
  const overrideByKey = new Map<string, string>();
  for (const row of overrides.data ?? []) {
    const key = `${row.enrollment_id}:${row.activity_id}`;
    if (!overrideByKey.has(key)) overrideByKey.set(key, row.deadline);
  }

  return {
    effectiveDeadline: (enrollmentId, activityId) =>
      overrideByKey.get(`${enrollmentId}:${activityId}`) ??
      defaultByActivity.get(activityId) ??
      null,
  };
}
