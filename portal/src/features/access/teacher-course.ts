import type { SupabaseClient } from "@supabase/supabase-js";

export type TeacherCourseRun = Readonly<{
  id: string;
  title: string;
  templateId: string;
}>;

export type TeacherCourseAccess = Readonly<
  | { isTeacher: false; run: null }
  | { isTeacher: true; run: TeacherCourseRun | null }
>;

function assertNoQueryError(error: { message: string } | null): void {
  if (error) throw new Error(`TEACHER_ACCESS_QUERY_FAILED:${error.message}`);
}

/**
 * Avgjør om innlogget bruker er kurslærer/kursleder, og velger i så fall
 * kurskjøringen deterministisk blant kjøringene brukeren faktisk har rolle på.
 * RLS begrenser role_assignments til egne rader for ikke-administratorer.
 */
export async function resolveTeacherCourseAccess(
  client: SupabaseClient,
): Promise<TeacherCourseAccess> {
  const roles = await client
    .from("role_assignments")
    .select("course_run_id,course_template_id")
    .in("role", ["course_teacher", "course_lead"])
    .is("revoked_at", null);
  assertNoQueryError(roles.error);

  const runIds = new Set<string>();
  const templateIds = new Set<string>();
  for (const role of roles.data ?? []) {
    if (role.course_run_id) runIds.add(role.course_run_id);
    if (role.course_template_id) templateIds.add(role.course_template_id);
  }
  if (runIds.size === 0 && templateIds.size === 0) {
    return { isTeacher: false, run: null };
  }

  const filters = [
    ...(runIds.size > 0 ? [`id.in.(${[...runIds].join(",")})`] : []),
    ...(templateIds.size > 0
      ? [`template_id.in.(${[...templateIds].join(",")})`]
      : []),
  ];
  // ponytail: én kjøring vises; kurs-switcher for lærere med flere kjøringer
  // er en egen fase. Deterministisk valg: nyeste kull, deretter id.
  const run = await client
    .from("course_runs")
    .select("id,title,template_id")
    .or(filters.join(","))
    .order("start_year", { ascending: false })
    .order("starts_on", { ascending: false })
    .order("id", { ascending: true })
    .limit(1)
    .maybeSingle();
  assertNoQueryError(run.error);

  return {
    isTeacher: true,
    run: run.data
      ? {
          id: run.data.id,
          title: run.data.title,
          templateId: run.data.template_id,
        }
      : null,
  };
}
