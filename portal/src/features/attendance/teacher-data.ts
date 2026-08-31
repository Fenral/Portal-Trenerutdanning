import type { SupabaseClient } from "@supabase/supabase-js";

import { sortDemoParticipants } from "@/features/demo/participants";

import { calculateAttendance } from "./percentage";

type EnrollmentRow = Readonly<{
  id: string;
  course_run_id: string;
  profile_id: string;
  status: "invited" | "active" | "withdrawn" | "completed";
}>;

export type TeacherParticipantListItem = Readonly<{
  enrollmentId: string;
  studentName: string;
  clubName: string;
  courseTitle: string;
  status: EnrollmentRow["status"];
  progressPercentage: number;
  attendancePercentage: number;
}>;

export type TeacherParticipantView = TeacherParticipantListItem &
  Readonly<{
    universityCompleted: boolean | null;
    sessions: readonly Readonly<{
      id: string;
      title: string;
      startsAt: string;
      plannedMinutes: number;
      presentMinutes: number;
      recorded: boolean;
    }>[];
  }>;

function assertNoQueryError(error: { message: string } | null): void {
  if (error)
    throw new Error(`TEACHER_PARTICIPANT_QUERY_FAILED:${error.message}`);
}

async function loadParticipantsForEnrollments(
  client: SupabaseClient,
  enrollments: readonly EnrollmentRow[],
): Promise<TeacherParticipantListItem[]> {
  if (enrollments.length === 0) return [];
  const enrollmentIds = enrollments.map((enrollment) => enrollment.id);
  const [profiles, courses, progress, attendance] = await Promise.all([
    client
      .from("profiles")
      .select("id,display_name,club_name")
      .in(
        "id",
        enrollments.map((enrollment) => enrollment.profile_id),
      ),
    client
      .from("course_runs")
      .select("id,title")
      .in(
        "id",
        enrollments.map((enrollment) => enrollment.course_run_id),
      ),
    client
      .from("enrollment_progress")
      .select("enrollment_id,percentage")
      .in("enrollment_id", enrollmentIds),
    client
      .from("attendance_records")
      .select("enrollment_id,planned_minutes,present_minutes")
      .in("enrollment_id", enrollmentIds),
  ]);
  for (const result of [profiles, courses, progress, attendance]) {
    assertNoQueryError(result.error);
  }

  const profileById = new Map(
    (profiles.data ?? []).map((profile) => [profile.id, profile]),
  );
  const courseById = new Map(
    (courses.data ?? []).map((course) => [course.id, course]),
  );
  const progressByEnrollment = new Map(
    (progress.data ?? []).map((row) => [row.enrollment_id, row.percentage]),
  );

  return sortDemoParticipants(
    enrollments.map((enrollment) => {
      const profile = profileById.get(enrollment.profile_id);
      const attendanceSummary = calculateAttendance(
        (attendance.data ?? [])
          .filter((row) => row.enrollment_id === enrollment.id)
          .map((row) => ({
            plannedMinutes: row.planned_minutes,
            presentMinutes: row.present_minutes,
          })),
      );

      return {
        enrollmentId: enrollment.id,
        studentName: profile?.display_name ?? "Ukjent deltaker",
        clubName: profile?.club_name ?? "Ukjent klubb",
        courseTitle:
          courseById.get(enrollment.course_run_id)?.title ?? "Ukjent kurs",
        status: enrollment.status,
        progressPercentage: progressByEnrollment.get(enrollment.id) ?? 0,
        attendancePercentage: attendanceSummary.displayPercentage,
      };
    }),
    (participant) => participant.studentName,
  );
}

export async function loadTeacherParticipants(
  client: SupabaseClient,
): Promise<TeacherParticipantListItem[]> {
  const enrollments = await client
    .from("enrollments")
    .select("id,course_run_id,profile_id,status")
    .neq("status", "withdrawn");
  assertNoQueryError(enrollments.error);

  return loadParticipantsForEnrollments(
    client,
    (enrollments.data ?? []) as EnrollmentRow[],
  );
}

export async function loadTeacherParticipant(
  client: SupabaseClient,
  enrollmentId: string,
): Promise<TeacherParticipantView | null> {
  const enrollmentResult = await client
    .from("enrollments")
    .select("id,course_run_id,profile_id,status")
    .eq("id", enrollmentId)
    .maybeSingle();
  assertNoQueryError(enrollmentResult.error);
  if (!enrollmentResult.data) return null;
  const enrollment = enrollmentResult.data as EnrollmentRow;
  const [participant] = await loadParticipantsForEnrollments(client, [
    enrollment,
  ]);
  if (!participant) return null;

  const [sessions, attendance, university] = await Promise.all([
    client
      .from("course_sessions")
      .select("id,title,starts_at")
      .eq("course_run_id", enrollment.course_run_id)
      .eq("session_type", "regular")
      .eq("is_required", true)
      .order("sort_order"),
    client
      .from("attendance_records")
      .select("session_id,planned_minutes,present_minutes")
      .eq("enrollment_id", enrollment.id),
    client
      .from("university_requirements")
      .select("completed")
      .eq("enrollment_id", enrollment.id)
      .maybeSingle(),
  ]);
  for (const result of [sessions, attendance, university]) {
    assertNoQueryError(result.error);
  }
  const attendanceBySession = new Map(
    (attendance.data ?? []).map((row) => [row.session_id, row]),
  );

  return {
    ...participant,
    universityCompleted: university.data?.completed ?? null,
    sessions: (sessions.data ?? []).map((session) => {
      const record = attendanceBySession.get(session.id);
      return {
        id: session.id,
        title: session.title,
        startsAt: session.starts_at,
        plannedMinutes: record?.planned_minutes ?? 420,
        presentMinutes: record?.present_minutes ?? 420,
        recorded: Boolean(record),
      };
    }),
  };
}
