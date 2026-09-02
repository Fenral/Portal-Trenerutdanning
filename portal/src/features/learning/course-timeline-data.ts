import type { SupabaseClient } from "@supabase/supabase-js";

import type { StudentLearningPathView } from "./student-learning-data";
import {
  buildCourseTimeline,
  sessionDateLabel,
  type CourseTimelineView,
  type TimelineDeadlineInput,
} from "./course-timeline";

type SessionRow = Readonly<{
  id: string;
  title: string;
  starts_at: string;
  ends_at: string;
  location_text: string | null;
  session_type: "regular" | "youth_drive";
  sort_order: number;
}>;

type DefinitionRow = Readonly<{
  activity_id: string;
  default_deadline: string;
}>;

type OverrideRow = Readonly<{
  activity_id: string;
  deadline: string;
}>;

export type CourseSessionInfo = Readonly<{
  id: string;
  title: string;
  dateLabel: string;
  locationText: string | null;
  isYouthDrive: boolean;
}>;

export type CourseScheduleView = Readonly<{
  timeline: CourseTimelineView;
  sessions: readonly CourseSessionInfo[];
}>;

function toSessionInfo(session: SessionRow, now: Date): CourseSessionInfo {
  return {
    id: session.id,
    title: session.title,
    dateLabel: sessionDateLabel(
      new Date(session.starts_at),
      new Date(session.ends_at),
      now,
    ),
    locationText: session.location_text,
    isYouthDrive: session.session_type === "youth_drive",
  };
}

export async function loadCourseSessionInfos(
  client: SupabaseClient,
  courseRunId: string,
  now: Date = new Date(),
): Promise<readonly CourseSessionInfo[]> {
  const { data, error } = await client
    .from("course_sessions")
    .select("id,title,starts_at,ends_at,location_text,session_type,sort_order")
    .eq("course_run_id", courseRunId)
    .order("starts_at");

  if (error) {
    throw new Error(`COURSE_SESSIONS_QUERY_FAILED:${error.message}`);
  }

  return ((data ?? []) as SessionRow[]).map((session) =>
    toSessionInfo(session, now),
  );
}

export async function loadCourseSchedule(
  client: SupabaseClient,
  learningPath: StudentLearningPathView,
  now: Date = new Date(),
): Promise<CourseScheduleView> {
  const assignmentActivities = learningPath.activities.filter(
    (activity) => activity.activityType === "assignment",
  );
  const assignmentIds = assignmentActivities.map((activity) => activity.id);

  const [sessionsResult, definitionsResult, overridesResult] =
    await Promise.all([
      client
        .from("course_sessions")
        .select(
          "id,title,starts_at,ends_at,location_text,session_type,sort_order",
        )
        .eq("course_run_id", learningPath.courseRunId)
        .order("starts_at"),
      assignmentIds.length > 0
        ? client
            .from("assignment_definitions")
            .select("activity_id,default_deadline")
            .in("activity_id", assignmentIds)
        : Promise.resolve({ data: [], error: null }),
      assignmentIds.length > 0
        ? client
            .from("assignment_deadline_overrides")
            .select("activity_id,deadline")
            .eq("enrollment_id", learningPath.enrollmentId)
            .in("activity_id", assignmentIds)
            .order("created_at", { ascending: false })
        : Promise.resolve({ data: [], error: null }),
    ]);

  for (const result of [sessionsResult, definitionsResult, overridesResult]) {
    if (result.error) {
      throw new Error(`COURSE_SCHEDULE_QUERY_FAILED:${result.error.message}`);
    }
  }

  const sessionRows = (sessionsResult.data ?? []) as SessionRow[];
  const definitionRows = (definitionsResult.data ?? []) as DefinitionRow[];
  const overrideRows = (overridesResult.data ?? []) as OverrideRow[];

  // Nyeste override per aktivitet vinner (radene er sortert synkende).
  const overrideByActivity = new Map<string, string>();
  for (const override of overrideRows) {
    if (!overrideByActivity.has(override.activity_id)) {
      overrideByActivity.set(override.activity_id, override.deadline);
    }
  }

  const titleByActivity = new Map(
    assignmentActivities.map((activity) => [activity.id, activity.title]),
  );
  const completedByActivity = new Map(
    assignmentActivities.map((activity) => [activity.id, activity.completed]),
  );

  const deadlines: TimelineDeadlineInput[] = definitionRows.map(
    (definition) => ({
      activityId: definition.activity_id,
      title: titleByActivity.get(definition.activity_id) ?? "Innlevering",
      deadline: new Date(
        overrideByActivity.get(definition.activity_id) ??
          definition.default_deadline,
      ),
      completed: completedByActivity.get(definition.activity_id) ?? false,
    }),
  );

  const timeline = buildCourseTimeline(
    sessionRows.map((session) => ({
      id: session.id,
      title: session.title,
      startsAt: new Date(session.starts_at),
      endsAt: new Date(session.ends_at),
    })),
    deadlines,
    now,
  );

  return {
    timeline,
    sessions: sessionRows.map((session) => toSessionInfo(session, now)),
  };
}
