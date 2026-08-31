import type { SupabaseClient } from "@supabase/supabase-js";

export type PracticeSubmissionStatus =
  "submitted" | "approved_manual" | "approved_auto" | "revision_required";

type SubmissionRow = Readonly<{
  id: string;
  enrollment_id: string;
  course_run_id: string;
  activity_id: string;
  version_number: number;
  status: PracticeSubmissionStatus;
  included_entry_ids: string[];
  total_minutes: number;
  planning_minutes: number;
  delivery_minutes: number;
  approval_mode: "manual_review" | "auto_approve";
  submitted_at: string;
  updated_at: string;
}>;

export type TeacherPracticeQueueItem = Readonly<{
  submissionId: string;
  studentName: string;
  clubName: string;
  activityTitle: string;
  courseTitle: string;
  versionNumber: number;
  status: PracticeSubmissionStatus;
  totalMinutes: number;
  planningMinutes: number;
  submittedAt: string;
}>;

export type TeacherPracticeView = TeacherPracticeQueueItem &
  Readonly<{
    approvalMode: "manual_review" | "auto_approve";
    entries: readonly Readonly<{
      id: string;
      occurredOn: string;
      minutes: number;
      category: "delivery" | "planning";
      description: string;
    }>[];
    events: readonly Readonly<{
      id: number;
      type:
        | "submitted"
        | "approved_manual"
        | "approved_auto"
        | "revision_required"
        | "spot_check_revoked";
      reason: string | null;
      occurredAt: string;
    }>[];
  }>;

function assertNoQueryError(error: { message: string } | null): void {
  if (error) throw new Error(`TEACHER_PRACTICE_QUERY_FAILED:${error.message}`);
}

async function loadReferenceMaps(
  client: SupabaseClient,
  submissions: readonly SubmissionRow[],
) {
  const [enrollmentsResult, activitiesResult, coursesResult] =
    await Promise.all([
      client
        .from("enrollments")
        .select("id,profile_id")
        .in(
          "id",
          submissions.map((submission) => submission.enrollment_id),
        ),
      client
        .from("activities")
        .select("id,title")
        .in(
          "id",
          submissions.map((submission) => submission.activity_id),
        ),
      client
        .from("course_runs")
        .select("id,title")
        .in(
          "id",
          submissions.map((submission) => submission.course_run_id),
        ),
    ]);
  assertNoQueryError(enrollmentsResult.error);
  assertNoQueryError(activitiesResult.error);
  assertNoQueryError(coursesResult.error);

  const enrollments = enrollmentsResult.data ?? [];
  const profilesResult = await client
    .from("profiles")
    .select("id,display_name,club_name")
    .in(
      "id",
      enrollments.map((enrollment) => enrollment.profile_id),
    );
  assertNoQueryError(profilesResult.error);

  return {
    enrollmentById: new Map(
      enrollments.map((enrollment) => [enrollment.id, enrollment]),
    ),
    profileById: new Map(
      (profilesResult.data ?? []).map((profile) => [profile.id, profile]),
    ),
    activityById: new Map(
      (activitiesResult.data ?? []).map((activity) => [activity.id, activity]),
    ),
    courseById: new Map(
      (coursesResult.data ?? []).map((course) => [course.id, course]),
    ),
  };
}

function toQueueItem(
  submission: SubmissionRow,
  references: Awaited<ReturnType<typeof loadReferenceMaps>>,
): TeacherPracticeQueueItem {
  const enrollment = references.enrollmentById.get(submission.enrollment_id);
  const profile = enrollment
    ? references.profileById.get(enrollment.profile_id)
    : undefined;

  return {
    submissionId: submission.id,
    studentName: profile?.display_name ?? "Ukjent deltaker",
    clubName: profile?.club_name ?? "Ukjent klubb",
    activityTitle:
      references.activityById.get(submission.activity_id)?.title ?? "Praksis",
    courseTitle:
      references.courseById.get(submission.course_run_id)?.title ??
      "Ukjent kurs",
    versionNumber: submission.version_number,
    status: submission.status,
    totalMinutes: submission.total_minutes,
    planningMinutes: submission.planning_minutes,
    submittedAt: submission.submitted_at,
  };
}

export async function loadTeacherPracticeQueue(
  client: SupabaseClient,
): Promise<TeacherPracticeQueueItem[]> {
  const result = await client
    .from("practice_submissions")
    .select(
      "id,enrollment_id,course_run_id,activity_id,version_number,status,included_entry_ids,total_minutes,planning_minutes,delivery_minutes,approval_mode,submitted_at,updated_at",
    )
    .order("version_number", { ascending: false })
    .order("submitted_at", { ascending: false });
  assertNoQueryError(result.error);

  const all = (result.data ?? []) as SubmissionRow[];
  const latestByActivity = new Map<string, SubmissionRow>();

  for (const submission of all) {
    const key = `${submission.enrollment_id}:${submission.activity_id}`;
    if (!latestByActivity.has(key)) latestByActivity.set(key, submission);
  }

  const submissions = [...latestByActivity.values()];
  if (submissions.length === 0) return [];
  const references = await loadReferenceMaps(client, submissions);

  return submissions
    .map((submission) => toQueueItem(submission, references))
    .sort((left, right) => right.submittedAt.localeCompare(left.submittedAt));
}

export async function loadTeacherPractice(
  client: SupabaseClient,
  submissionId: string,
): Promise<TeacherPracticeView | null> {
  const submissionResult = await client
    .from("practice_submissions")
    .select(
      "id,enrollment_id,course_run_id,activity_id,version_number,status,included_entry_ids,total_minutes,planning_minutes,delivery_minutes,approval_mode,submitted_at,updated_at",
    )
    .eq("id", submissionId)
    .maybeSingle();
  assertNoQueryError(submissionResult.error);
  if (!submissionResult.data) return null;
  const submission = submissionResult.data as SubmissionRow;

  const [references, entriesResult, eventsResult] = await Promise.all([
    loadReferenceMaps(client, [submission]),
    client
      .from("practice_entries")
      .select("id,occurred_on,minutes,category,description")
      .in("id", submission.included_entry_ids)
      .order("occurred_on", { ascending: false }),
    client
      .from("practice_submission_events")
      .select("id,event_type,reason,occurred_at")
      .eq("submission_id", submission.id)
      .order("occurred_at", { ascending: false }),
  ]);
  assertNoQueryError(entriesResult.error);
  assertNoQueryError(eventsResult.error);

  return {
    ...toQueueItem(submission, references),
    approvalMode: submission.approval_mode,
    entries: (entriesResult.data ?? []).map((entry) => ({
      id: entry.id,
      occurredOn: entry.occurred_on,
      minutes: entry.minutes,
      category: entry.category as "delivery" | "planning",
      description: entry.description,
    })),
    events: (eventsResult.data ?? []).map((event) => ({
      id: event.id,
      type: event.event_type as TeacherPracticeView["events"][number]["type"],
      reason: event.reason,
      occurredAt: event.occurred_at,
    })),
  };
}
