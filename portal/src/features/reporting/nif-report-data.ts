import type { SupabaseClient } from "@supabase/supabase-js";

import {
  expandNifCourseDays,
  type NifAttendance,
  type NifReportInput,
} from "./nif-report";

type CourseInput = Readonly<{
  title: string;
  templateCode: string;
  templateTitle: string;
}>;

type SessionRow = Readonly<{
  id: string;
  title: string;
  starts_at: string;
  ends_at: string;
  session_type: string;
  is_required: boolean;
}>;

type EnrollmentRow = Readonly<{
  id: string;
  profile_id: string;
  status: string;
}>;

type ProfileRow = Readonly<{
  id: string;
  display_name: string;
  normalized_email: string;
  phone: string | null;
}>;

type AttendanceRow = Readonly<{
  enrollment_id: string;
  session_id: string;
  planned_minutes: number;
  present_minutes: number;
}>;

export type NifReportRows = Readonly<{
  course: CourseInput;
  sessions: readonly SessionRow[];
  enrollments: readonly EnrollmentRow[];
  profiles: readonly ProfileRow[];
  attendance: readonly AttendanceRow[];
}>;

const COURSE_IDS: Readonly<Record<string, readonly string[]>> = {
  T1: [],
  T2: [],
  T3: ["19021785", "19021847 (praksis)"],
};

export function nifCourseIdsForTemplate(templateCode: string) {
  return COURSE_IDS[templateCode] ?? [];
}

function plannedMinutesForSession(
  session: SessionRow,
  attendance: readonly AttendanceRow[],
) {
  const recordedMinutes = attendance
    .filter((row) => row.session_id === session.id)
    .map((row) => row.planned_minutes)
    .filter((minutes) => Number.isInteger(minutes) && minutes > 0);

  if (recordedMinutes.length > 0) return Math.max(...recordedMinutes);

  const days = expandNifCourseDays([
    {
      id: session.id,
      title: session.title,
      startsAt: session.starts_at,
      endsAt: session.ends_at,
      plannedMinutes: 420,
    },
  ]);
  return days.length * 420;
}

export function buildNifReportInput(rows: NifReportRows): NifReportInput {
  const sessions = rows.sessions
    .filter(
      (session) => session.session_type === "regular" && session.is_required,
    )
    .map((session) => ({
      id: session.id,
      title: session.title,
      startsAt: session.starts_at,
      endsAt: session.ends_at,
      plannedMinutes: plannedMinutesForSession(session, rows.attendance),
    }));
  const profileById = new Map(
    rows.profiles.map((profile) => [profile.id, profile]),
  );

  const participants = rows.enrollments
    .filter((enrollment) => enrollment.status !== "withdrawn")
    .flatMap((enrollment) => {
      const profile = profileById.get(enrollment.profile_id);
      if (!profile) return [];

      const attendanceBySession: Record<string, NifAttendance> = {};
      rows.attendance
        .filter((record) => record.enrollment_id === enrollment.id)
        .forEach((record) => {
          attendanceBySession[record.session_id] = {
            plannedMinutes: record.planned_minutes,
            presentMinutes: record.present_minutes,
          };
        });

      return [
        {
          displayName: profile.display_name,
          email: profile.normalized_email,
          phone: profile.phone,
          attendanceBySession,
        },
      ];
    })
    .sort((left, right) =>
      left.displayName.localeCompare(right.displayName, "nb-NO"),
    );

  return {
    courseName: rows.course.templateTitle,
    courseIds: nifCourseIdsForTemplate(rows.course.templateCode),
    organizerName: "Norges Golfforbund",
    sessions,
    participants,
  };
}

function ensureQuerySucceeded(error: { message: string } | null, code: string) {
  if (error) throw new Error(`${code}: ${error.message}`);
}

export async function loadNifReportInput(
  adminClient: SupabaseClient,
  courseRunId: string,
) {
  const courseResult = await adminClient
    .from("course_runs")
    .select("id,title,template_id")
    .eq("id", courseRunId)
    .maybeSingle();
  ensureQuerySucceeded(courseResult.error, "NIF_COURSE_QUERY_FAILED");
  if (!courseResult.data) throw new Error("NIF_COURSE_NOT_FOUND");

  const [templateResult, sessionsResult, enrollmentsResult] = await Promise.all(
    [
      adminClient
        .from("course_templates")
        .select("code,title")
        .eq("id", courseResult.data.template_id)
        .single(),
      adminClient
        .from("course_sessions")
        .select("id,title,starts_at,ends_at,session_type,is_required")
        .eq("course_run_id", courseRunId)
        .order("sort_order"),
      adminClient
        .from("enrollments")
        .select("id,profile_id,status")
        .eq("course_run_id", courseRunId),
    ],
  );
  ensureQuerySucceeded(templateResult.error, "NIF_TEMPLATE_QUERY_FAILED");
  ensureQuerySucceeded(sessionsResult.error, "NIF_SESSIONS_QUERY_FAILED");
  ensureQuerySucceeded(enrollmentsResult.error, "NIF_ENROLLMENTS_QUERY_FAILED");
  if (!templateResult.data) throw new Error("NIF_TEMPLATE_NOT_FOUND");

  const enrollments = (enrollmentsResult.data ?? []) as EnrollmentRow[];
  const activeEnrollmentIds = enrollments
    .filter((enrollment) => enrollment.status !== "withdrawn")
    .map((enrollment) => enrollment.id);
  const profileIds = enrollments
    .filter((enrollment) => enrollment.status !== "withdrawn")
    .map((enrollment) => enrollment.profile_id);
  const [profilesResult, attendanceResult] = await Promise.all([
    profileIds.length
      ? adminClient
          .from("profiles")
          .select("id,display_name,normalized_email,phone")
          .in("id", profileIds)
      : Promise.resolve({ data: [], error: null }),
    activeEnrollmentIds.length
      ? adminClient
          .from("attendance_records")
          .select("enrollment_id,session_id,planned_minutes,present_minutes")
          .in("enrollment_id", activeEnrollmentIds)
      : Promise.resolve({ data: [], error: null }),
  ]);
  ensureQuerySucceeded(profilesResult.error, "NIF_PROFILES_QUERY_FAILED");
  ensureQuerySucceeded(attendanceResult.error, "NIF_ATTENDANCE_QUERY_FAILED");

  return buildNifReportInput({
    course: {
      title: courseResult.data.title,
      templateCode: templateResult.data.code,
      templateTitle: templateResult.data.title,
    },
    sessions: (sessionsResult.data ?? []) as SessionRow[],
    enrollments,
    profiles: (profilesResult.data ?? []) as ProfileRow[],
    attendance: (attendanceResult.data ?? []) as AttendanceRow[],
  });
}
