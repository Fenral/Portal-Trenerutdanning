import type { SupabaseClient } from "@supabase/supabase-js";

import { sortDemoParticipants } from "@/features/demo/participants";

import { calculateAttendance } from "./percentage";

type EnrollmentRow = Readonly<{
  id: string;
  course_run_id: string;
  profile_id: string;
  status: "invited" | "active" | "withdrawn" | "completed";
}>;

type ModuleProgressRow = Readonly<{
  id: string;
  learning_path_id: string;
  title: string;
  sort_order: number;
}>;

type ActivityProgressRow = Readonly<{
  id: string;
  learning_path_id: string;
  module_id: string;
  title: string;
  required: boolean;
  sort_order: number;
}>;

type CompletionProgressRow = Readonly<{
  enrollment_id: string;
  learning_path_id: string;
  activity_id: string;
}>;

export type TeacherParticipantListItem = Readonly<{
  enrollmentId: string;
  studentName: string;
  clubName: string;
  courseTitle: string;
  status: EnrollmentRow["status"];
  progressPercentage: number;
  attendancePercentage: number;
  modules: readonly TeacherParticipantModuleProgress[];
}>;

export type TeacherParticipantActivityProgress = Readonly<{
  id: string;
  title: string;
  completed: boolean;
  required: boolean;
  sortOrder: number;
}>;

export type TeacherParticipantModuleProgress = Readonly<{
  id: string;
  title: string;
  sortOrder: number;
  completedCount: number;
  totalCount: number;
  percentage: number;
  activities: readonly TeacherParticipantActivityProgress[];
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
  const [profiles, courses, progress, attendance, paths] = await Promise.all([
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
    client
      .from("learning_paths")
      .select("id,course_run_id")
      .in(
        "course_run_id",
        enrollments.map((enrollment) => enrollment.course_run_id),
      )
      .eq("status", "published"),
  ]);
  for (const result of [profiles, courses, progress, attendance, paths]) {
    assertNoQueryError(result.error);
  }

  const pathIds = (paths.data ?? []).map((path) => path.id);
  const [modules, activities, completions] =
    pathIds.length === 0
      ? [
          { data: [], error: null },
          { data: [], error: null },
          { data: [], error: null },
        ]
      : await Promise.all([
          client
            .from("modules")
            .select("id,learning_path_id,title,sort_order")
            .in("learning_path_id", pathIds)
            .order("sort_order"),
          client
            .from("activities")
            .select("id,learning_path_id,module_id,title,required,sort_order")
            .in("learning_path_id", pathIds),
          client
            .from("activity_completions")
            .select("enrollment_id,learning_path_id,activity_id")
            .in("enrollment_id", enrollmentIds)
            .in("learning_path_id", pathIds),
        ]);
  for (const result of [modules, activities, completions]) {
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
  const pathByCourseRun = new Map(
    (paths.data ?? []).map((path) => [path.course_run_id, path.id]),
  );
  const moduleRows = (modules.data ?? []) as ModuleProgressRow[];
  const activityRows = (activities.data ?? []) as ActivityProgressRow[];
  const completionRows = (completions.data ?? []) as CompletionProgressRow[];
  const modulesByPath = new Map<string, ModuleProgressRow[]>();
  for (const learningModule of moduleRows) {
    const current = modulesByPath.get(learningModule.learning_path_id) ?? [];
    current.push(learningModule);
    modulesByPath.set(learningModule.learning_path_id, current);
  }
  const activitiesByModule = new Map<string, ActivityProgressRow[]>();
  for (const activity of activityRows) {
    const current = activitiesByModule.get(activity.module_id) ?? [];
    current.push(activity);
    activitiesByModule.set(activity.module_id, current);
  }
  const completedByEnrollment = new Map<string, Set<string>>();
  for (const completion of completionRows) {
    const current =
      completedByEnrollment.get(completion.enrollment_id) ?? new Set<string>();
    current.add(completion.activity_id);
    completedByEnrollment.set(completion.enrollment_id, current);
  }

  return sortDemoParticipants(
    enrollments.map((enrollment) => {
      const profile = profileById.get(enrollment.profile_id);
      const pathId = pathByCourseRun.get(enrollment.course_run_id);
      const completedIds =
        completedByEnrollment.get(enrollment.id) ?? new Set<string>();
      const attendanceSummary = calculateAttendance(
        (attendance.data ?? [])
          .filter((row) => row.enrollment_id === enrollment.id)
          .map((row) => ({
            plannedMinutes: row.planned_minutes,
            presentMinutes: row.present_minutes,
          })),
      );
      const moduleProgress = (pathId ? (modulesByPath.get(pathId) ?? []) : [])
        .sort((left, right) => left.sort_order - right.sort_order)
        .map<TeacherParticipantModuleProgress>((learningModule) => {
          const moduleActivities = [
            ...(activitiesByModule.get(learningModule.id) ?? []),
          ]
            .sort((left, right) => left.sort_order - right.sort_order)
            .map<TeacherParticipantActivityProgress>((activity) => ({
              id: activity.id,
              title: activity.title,
              completed: completedIds.has(activity.id),
              required: activity.required,
              sortOrder: activity.sort_order,
            }));
          const requiredActivities = moduleActivities.filter(
            (activity) => activity.required,
          );
          const completedCount = requiredActivities.filter(
            (activity) => activity.completed,
          ).length;

          return {
            id: learningModule.id,
            title: learningModule.title,
            sortOrder: learningModule.sort_order,
            completedCount,
            totalCount: requiredActivities.length,
            percentage:
              requiredActivities.length === 0
                ? 0
                : Math.round(
                    (completedCount / requiredActivities.length) * 100,
                  ),
            activities: moduleActivities,
          };
        });

      return {
        enrollmentId: enrollment.id,
        studentName: profile?.display_name ?? "Ukjent deltaker",
        clubName: profile?.club_name ?? "Ukjent klubb",
        courseTitle:
          courseById.get(enrollment.course_run_id)?.title ?? "Ukjent kurs",
        status: enrollment.status,
        progressPercentage: progressByEnrollment.get(enrollment.id) ?? 0,
        attendancePercentage: attendanceSummary.displayPercentage,
        modules: moduleProgress,
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
