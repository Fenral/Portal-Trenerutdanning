import type { SupabaseClient } from "@supabase/supabase-js";

import {
  suggestDuplicates,
  type DuplicateProfile,
} from "@/features/people/duplicate-score";

/**
 * Én typed projeksjon for administratorens driftsside: åpne
 * Ungdomsdriven-oppgaver, varslingshendelser, duplikatforslag og
 * kursportefølje. Kullsnitt følger course_progress-definisjonen i
 * definitions.ts (snitt av progresjon, ekskl. trukket).
 */

export type InvoiceTask = Readonly<{
  id: string;
  participantName: string;
  courseTitle: string;
  createdAt: string;
}>;

export type NotificationIncident = Readonly<{
  id: string;
  lastErrorCode: string | null;
  createdAt: string;
}>;

export type PortfolioLevel = Readonly<{
  level: number;
  templateTitle: string;
  activeRunCount: number;
  activeParticipantCount: number;
  cohortAverageProgress: number | null;
}>;

export type AdminDashboardData = Readonly<{
  invoiceTasks: readonly InvoiceTask[];
  incidents: readonly NotificationIncident[];
  duplicateSuggestionCount: number;
  portfolio: readonly PortfolioLevel[];
  lastNotificationDeliveredAt: string | null;
}>;

function ensureQuerySucceeded(error: { message: string } | null, code: string) {
  if (error) throw new Error(`${code}: ${error.message}`);
}

export async function loadAdminDashboard(
  adminClient: SupabaseClient,
): Promise<AdminDashboardData> {
  const [
    tasksResult,
    incidentsResult,
    profilesResult,
    mergesResult,
    runsResult,
    templatesResult,
    enrollmentsResult,
    progressResult,
    deliveriesResult,
  ] = await Promise.all([
    adminClient
      .from("completion_admin_tasks")
      .select("id,enrollment_id,course_run_id,created_at")
      .eq("status", "pending")
      .order("created_at"),
    adminClient
      .from("notification_incidents")
      .select("id,last_error_code,created_at")
      .order("created_at", { ascending: false }),
    adminClient
      .from("profiles")
      .select("id,display_name,normalized_email,club_name,phone"),
    adminClient
      .from("person_merges")
      .select("source_profile_id")
      .is("reversed_at", null),
    adminClient
      .from("course_runs")
      .select("id,title,template_id")
      .eq("status", "active"),
    adminClient.from("course_templates").select("id,title,level"),
    adminClient
      .from("enrollments")
      .select("id,profile_id,course_run_id,status"),
    adminClient.from("enrollment_progress").select("enrollment_id,percentage"),
    adminClient
      .from("notification_deliveries")
      .select("delivered_at")
      .not("delivered_at", "is", null)
      .order("delivered_at", { ascending: false })
      .limit(1),
  ]);
  ensureQuerySucceeded(tasksResult.error, "DASHBOARD_TASKS_QUERY_FAILED");
  ensureQuerySucceeded(
    incidentsResult.error,
    "DASHBOARD_INCIDENTS_QUERY_FAILED",
  );
  ensureQuerySucceeded(profilesResult.error, "DASHBOARD_PROFILES_QUERY_FAILED");
  ensureQuerySucceeded(mergesResult.error, "DASHBOARD_MERGES_QUERY_FAILED");
  ensureQuerySucceeded(runsResult.error, "DASHBOARD_RUNS_QUERY_FAILED");
  ensureQuerySucceeded(
    templatesResult.error,
    "DASHBOARD_TEMPLATES_QUERY_FAILED",
  );
  ensureQuerySucceeded(
    enrollmentsResult.error,
    "DASHBOARD_ENROLLMENTS_QUERY_FAILED",
  );
  ensureQuerySucceeded(progressResult.error, "DASHBOARD_PROGRESS_QUERY_FAILED");
  ensureQuerySucceeded(
    deliveriesResult.error,
    "DASHBOARD_DELIVERIES_QUERY_FAILED",
  );

  type ProfileRow = Readonly<{
    id: string;
    display_name: string;
    normalized_email: string;
    club_name: string | null;
    phone: string | null;
  }>;
  type EnrollmentRow = Readonly<{
    id: string;
    profile_id: string;
    course_run_id: string;
    status: string;
  }>;

  const profiles = (profilesResult.data ?? []) as ProfileRow[];
  const enrollments = (enrollmentsResult.data ?? []) as EnrollmentRow[];
  const profileById = new Map(profiles.map((profile) => [profile.id, profile]));
  const enrollmentById = new Map(
    enrollments.map((enrollment) => [enrollment.id, enrollment]),
  );
  const runs = (runsResult.data ?? []) as {
    id: string;
    title: string;
    template_id: string;
  }[];
  const runById = new Map(runs.map((run) => [run.id, run]));

  const invoiceTasks: InvoiceTask[] = (tasksResult.data ?? []).map((task) => {
    const enrollment = enrollmentById.get(task.enrollment_id);
    const profile = enrollment
      ? profileById.get(enrollment.profile_id)
      : undefined;
    return {
      id: task.id,
      participantName: profile?.display_name ?? "Ukjent deltaker",
      courseTitle: runById.get(task.course_run_id)?.title ?? "Ukjent kurs",
      createdAt: task.created_at,
    };
  });

  const incidents: NotificationIncident[] = (incidentsResult.data ?? []).map(
    (incident) => ({
      id: incident.id,
      lastErrorCode: incident.last_error_code ?? null,
      createdAt: incident.created_at,
    }),
  );

  // Duplikatforslag: samme filter som duplikatsiden — anonymiserte profiler
  // og profiler i aktiv sammenslåing foreslås ikke. Terskel ≥ 80 ligger i
  // suggestDuplicates.
  const activelyMergedSources = new Set(
    (mergesResult.data ?? []).map((merge) => merge.source_profile_id),
  );
  const candidates: DuplicateProfile[] = profiles
    .filter(
      (profile) =>
        !profile.normalized_email.endsWith("@anonymisert.invalid") &&
        !activelyMergedSources.has(profile.id),
    )
    .map((profile) => ({
      id: profile.id,
      name: profile.display_name,
      club: profile.club_name,
      email: profile.normalized_email,
      phone: profile.phone,
    }));
  const duplicateSuggestionCount = suggestDuplicates(candidates).length;

  const progressByEnrollment = new Map(
    (progressResult.data ?? []).map((row) => [
      row.enrollment_id,
      row.percentage as number,
    ]),
  );
  const templates = (templatesResult.data ?? []) as {
    id: string;
    title: string;
    level: number;
  }[];
  const portfolio: PortfolioLevel[] = [...templates]
    .sort((left, right) => left.level - right.level)
    .map((template) => {
      const levelRunIds = new Set(
        runs
          .filter((run) => run.template_id === template.id)
          .map((run) => run.id),
      );
      const activeEnrollments = enrollments.filter(
        (enrollment) =>
          levelRunIds.has(enrollment.course_run_id) &&
          enrollment.status !== "withdrawn",
      );
      const cohortAverageProgress =
        activeEnrollments.length === 0
          ? null
          : Math.round(
              activeEnrollments.reduce(
                (sum, enrollment) =>
                  sum + (progressByEnrollment.get(enrollment.id) ?? 0),
                0,
              ) / activeEnrollments.length,
            );
      return {
        level: template.level,
        templateTitle: template.title,
        activeRunCount: levelRunIds.size,
        activeParticipantCount: activeEnrollments.length,
        cohortAverageProgress,
      };
    });

  const lastNotificationDeliveredAt =
    ((deliveriesResult.data ?? [])[0]?.delivered_at as string | undefined) ??
    null;

  return {
    invoiceTasks,
    incidents,
    duplicateSuggestionCount,
    portfolio,
    lastNotificationDeliveredAt,
  };
}
