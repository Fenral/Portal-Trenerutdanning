import type { SupabaseClient } from "@supabase/supabase-js";

type SubmissionRow = Readonly<{
  id: string;
  enrollment_id: string;
  course_run_id: string;
  activity_id: string;
  status: "draft" | "submitted" | "revision_required" | "approved" | "graded";
  current_version_number: number;
  updated_at: string;
}>;

type VersionRow = Readonly<{
  id: string;
  submission_id: string;
  version_number: number;
  note: string;
  submitted_at: string;
}>;

type ReviewRow = Readonly<{
  id: string;
  action: "request_revision" | "approve" | "grade" | "reopen";
  scale: "pass_fail" | "letter" | null;
  result_value: string | null;
  comment: string;
  reviewed_at: string;
}>;

export type TeacherAssignmentQueueItem = Readonly<{
  submissionId: string;
  studentName: string;
  clubName: string;
  courseTitle: string;
  activityTitle: string;
  status: SubmissionRow["status"];
  versionNumber: number;
  updatedAt: string;
}>;

export type TeacherAssignmentView = Readonly<{
  submissionId: string;
  studentName: string;
  clubName: string;
  courseTitle: string;
  activityTitle: string;
  assessmentScale: "pass_fail" | "letter";
  effectiveDeadline: string;
  status: SubmissionRow["status"];
  versions: readonly Readonly<{
    id: string;
    versionNumber: number;
    note: string;
    submittedAt: string;
    attachments: readonly Readonly<{
      id: string;
      filename: string;
      mimeType: string;
      byteSize: number;
    }>[];
  }>[];
  reviews: readonly Readonly<{
    id: string;
    action: ReviewRow["action"];
    scale: ReviewRow["scale"];
    resultValue: string | null;
    comment: string;
    reviewedAt: string;
  }>[];
}>;

function assertNoQueryError(error: { message: string } | null): void {
  if (error)
    throw new Error(`TEACHER_ASSIGNMENT_QUERY_FAILED:${error.message}`);
}

export async function loadTeacherAssignmentQueue(
  client: SupabaseClient,
): Promise<TeacherAssignmentQueueItem[]> {
  const submissionsResult = await client
    .from("assignment_submissions")
    .select(
      "id,enrollment_id,course_run_id,activity_id,status,current_version_number,updated_at",
    )
    .in("status", ["submitted", "revision_required"])
    .order("updated_at", { ascending: false });
  assertNoQueryError(submissionsResult.error);
  const submissions = (submissionsResult.data ?? []) as SubmissionRow[];
  if (submissions.length === 0) return [];

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

  const enrollmentById = new Map(
    enrollments.map((enrollment) => [enrollment.id, enrollment]),
  );
  const profileById = new Map(
    (profilesResult.data ?? []).map((profile) => [profile.id, profile]),
  );
  const activityById = new Map(
    (activitiesResult.data ?? []).map((activity) => [activity.id, activity]),
  );
  const courseById = new Map(
    (coursesResult.data ?? []).map((course) => [course.id, course]),
  );

  return submissions.map((submission) => {
    const enrollment = enrollmentById.get(submission.enrollment_id);
    const profile = enrollment
      ? profileById.get(enrollment.profile_id)
      : undefined;

    return {
      submissionId: submission.id,
      studentName: profile?.display_name ?? "Ukjent deltaker",
      clubName: profile?.club_name ?? "Ukjent klubb",
      courseTitle:
        courseById.get(submission.course_run_id)?.title ?? "Ukjent kurs",
      activityTitle:
        activityById.get(submission.activity_id)?.title ?? "Innlevering",
      status: submission.status,
      versionNumber: submission.current_version_number,
      updatedAt: submission.updated_at,
    };
  });
}

export async function loadTeacherAssignment(
  client: SupabaseClient,
  submissionId: string,
): Promise<TeacherAssignmentView | null> {
  const submissionResult = await client
    .from("assignment_submissions")
    .select(
      "id,enrollment_id,course_run_id,activity_id,status,current_version_number,updated_at",
    )
    .eq("id", submissionId)
    .maybeSingle();
  assertNoQueryError(submissionResult.error);
  if (!submissionResult.data) return null;
  const submission = submissionResult.data as SubmissionRow;

  const [
    enrollmentResult,
    activityResult,
    courseResult,
    definitionResult,
    versionsResult,
    reviewsResult,
    deadlineResult,
  ] = await Promise.all([
    client
      .from("enrollments")
      .select("id,profile_id")
      .eq("id", submission.enrollment_id)
      .single(),
    client
      .from("activities")
      .select("id,title")
      .eq("id", submission.activity_id)
      .single(),
    client
      .from("course_runs")
      .select("id,title")
      .eq("id", submission.course_run_id)
      .single(),
    client
      .from("assignment_definitions")
      .select("assessment_scale,default_deadline")
      .eq("activity_id", submission.activity_id)
      .single(),
    client
      .from("assignment_submission_versions")
      .select("id,submission_id,version_number,note,submitted_at")
      .eq("submission_id", submission.id)
      .order("version_number", { ascending: false }),
    client
      .from("assignment_reviews")
      .select("id,action,scale,result_value,comment,reviewed_at")
      .eq("submission_id", submission.id)
      .order("reviewed_at", { ascending: false }),
    client
      .from("assignment_deadline_overrides")
      .select("deadline")
      .eq("enrollment_id", submission.enrollment_id)
      .eq("activity_id", submission.activity_id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);
  for (const result of [
    enrollmentResult,
    activityResult,
    courseResult,
    definitionResult,
    versionsResult,
    reviewsResult,
    deadlineResult,
  ]) {
    assertNoQueryError(result.error);
  }

  if (
    !enrollmentResult.data ||
    !activityResult.data ||
    !courseResult.data ||
    !definitionResult.data
  ) {
    throw new Error("TEACHER_ASSIGNMENT_RELATED_DATA_MISSING");
  }

  const profileResult = await client
    .from("profiles")
    .select("display_name,club_name")
    .eq("id", enrollmentResult.data.profile_id)
    .single();
  assertNoQueryError(profileResult.error);

  if (!profileResult.data) {
    throw new Error("TEACHER_ASSIGNMENT_PROFILE_MISSING");
  }
  const versions = (versionsResult.data ?? []) as VersionRow[];
  const attachmentsResult = versions.length
    ? await client
        .from("assignment_attachments")
        .select("submission_version_id,media_asset_id")
        .in(
          "submission_version_id",
          versions.map((version) => version.id),
        )
    : { data: [], error: null };
  assertNoQueryError(attachmentsResult.error);
  const attachments = attachmentsResult.data ?? [];
  const assetsResult = attachments.length
    ? await client
        .from("media_assets")
        .select("id,original_filename,mime_type,byte_size")
        .in(
          "id",
          attachments.map((attachment) => attachment.media_asset_id),
        )
    : { data: [], error: null };
  assertNoQueryError(assetsResult.error);
  const assetById = new Map(
    (assetsResult.data ?? []).map((asset) => [asset.id, asset]),
  );

  return {
    submissionId: submission.id,
    studentName: profileResult.data.display_name,
    clubName: profileResult.data.club_name,
    courseTitle: courseResult.data.title,
    activityTitle: activityResult.data.title,
    assessmentScale: definitionResult.data.assessment_scale,
    effectiveDeadline:
      deadlineResult.data?.deadline ?? definitionResult.data.default_deadline,
    status: submission.status,
    versions: versions.map((version) => ({
      id: version.id,
      versionNumber: version.version_number,
      note: version.note,
      submittedAt: version.submitted_at,
      attachments: attachments
        .filter((attachment) => attachment.submission_version_id === version.id)
        .flatMap((attachment) => {
          const asset = assetById.get(attachment.media_asset_id);
          return asset
            ? [
                {
                  id: asset.id,
                  filename: asset.original_filename,
                  mimeType: asset.mime_type,
                  byteSize: asset.byte_size,
                },
              ]
            : [];
        }),
    })),
    reviews: ((reviewsResult.data ?? []) as ReviewRow[]).map((review) => ({
      id: review.id,
      action: review.action,
      scale: review.scale,
      resultValue: review.result_value,
      comment: review.comment,
      reviewedAt: review.reviewed_at,
    })),
  };
}
