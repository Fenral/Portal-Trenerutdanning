import type { SupabaseClient } from "@supabase/supabase-js";

export type CourseSessionView = Readonly<{
  id: string;
  title: string;
  startsAt: string;
  endsAt: string;
  locationText: string | null;
  sortOrder: number;
  sessionType: "regular" | "youth_drive";
  isRequired: boolean;
}>;

export type CourseRunView = Readonly<{
  id: string;
  templateCode: "T1" | "T2" | "T3";
  title: string;
  startYear: number;
  displayYear: string;
  locationName: string | null;
  sessions: CourseSessionView[];
}>;

type TemplateRow = Readonly<{ id: string; code: string }>;
type RunRow = Readonly<{
  id: string;
  template_id: string;
  title: string;
  start_year: number;
  location_name: string | null;
}>;
type SessionRow = Readonly<{
  id: string;
  course_run_id: string;
  title: string;
  starts_at: string;
  ends_at: string;
  location_text: string | null;
  sort_order: number;
  session_type: CourseSessionView["sessionType"];
  is_required: boolean;
}>;

function assertNoQueryError(error: { message: string } | null): void {
  if (error) {
    throw new Error("COURSE_PORTFOLIO_QUERY_FAILED");
  }
}

export async function loadParticipantCounts(
  adminClient: SupabaseClient,
): Promise<Map<string, number>> {
  const { data, error } = await adminClient
    .from("enrollments")
    .select("course_run_id,status")
    .neq("status", "withdrawn");

  assertNoQueryError(error);

  const counts = new Map<string, number>();
  for (const row of (data ?? []) as { course_run_id: string }[]) {
    counts.set(row.course_run_id, (counts.get(row.course_run_id) ?? 0) + 1);
  }
  return counts;
}

export async function loadCoursePortfolio(
  adminClient: SupabaseClient,
): Promise<CourseRunView[]> {
  const [templatesResult, runsResult, sessionsResult] = await Promise.all([
    adminClient.from("course_templates").select("id,code"),
    adminClient
      .from("course_runs")
      .select("id,template_id,title,start_year,location_name")
      .order("start_year")
      .order("location_name"),
    adminClient
      .from("course_sessions")
      .select(
        "id,course_run_id,title,starts_at,ends_at,location_text,sort_order,session_type,is_required",
      )
      .order("sort_order"),
  ]);

  assertNoQueryError(templatesResult.error);
  assertNoQueryError(runsResult.error);
  assertNoQueryError(sessionsResult.error);

  const templates = (templatesResult.data ?? []) as TemplateRow[];
  const runs = (runsResult.data ?? []) as RunRow[];
  const sessions = (sessionsResult.data ?? []) as SessionRow[];
  const templateCodeById = new Map(
    templates.map((template) => [template.id, template.code]),
  );

  return runs.flatMap((run) => {
    const templateCode = templateCodeById.get(run.template_id);

    if (!templateCode || !["T1", "T2", "T3"].includes(templateCode)) {
      return [];
    }

    return [
      {
        id: run.id,
        templateCode: templateCode as CourseRunView["templateCode"],
        title: run.title,
        startYear: run.start_year,
        displayYear:
          templateCode === "T3"
            ? String(run.start_year) + "–" + String(run.start_year + 1)
            : String(run.start_year),
        locationName: run.location_name,
        sessions: sessions
          .filter((session) => session.course_run_id === run.id)
          .map((session) => ({
            id: session.id,
            title: session.title,
            startsAt: session.starts_at,
            endsAt: session.ends_at,
            locationText: session.location_text,
            sortOrder: session.sort_order,
            sessionType: session.session_type,
            isRequired: session.is_required,
          })),
      },
    ];
  });
}
