import type { SupabaseClient } from "@supabase/supabase-js";

import { calculateAttendance } from "@/features/attendance/percentage";
import { evaluateCompletion } from "@/features/completion/evaluate-completion";
import {
  calculatePracticeTotals,
  type PracticeEntryDuration,
} from "@/features/practice/totals";

import {
  reportDefinitions,
  type ReportDefinition,
  type ReportType,
} from "./definitions";
import { formatOsloDateTime } from "./report-meta";

export type ReportCell = string | number;

export type ReportTable = Readonly<{
  definition: ReportDefinition;
  courseTitle: string;
  generatedAt: string;
  filters: readonly string[];
  summary: readonly string[];
  columns: readonly string[];
  rows: ReadonlyArray<ReadonlyArray<ReportCell>>;
}>;

type EnrollmentStatus = "invited" | "active" | "withdrawn" | "completed";

const ENROLLMENT_STATUS_LABELS: Readonly<Record<EnrollmentStatus, string>> = {
  invited: "Invitert",
  active: "Aktiv",
  withdrawn: "Trukket",
  completed: "Fullført",
};

const PRACTICE_STATUS_LABELS: Readonly<Record<string, string>> = {
  submitted: "Til vurdering",
  approved_manual: "Godkjent",
  approved_auto: "Godkjent (automatisk)",
  revision_required: "Må revideres",
};

const ASSIGNMENT_STATUS_LABELS: Readonly<Record<string, string>> = {
  draft: "Utkast",
  submitted: "Innlevert",
  revision_required: "Må revideres",
  approved: "Godkjent",
  graded: "Vurdert",
};

function fail(code: string, message?: string | null): never {
  throw new Error(message ? `${code}: ${message}` : code);
}

function assertNoQueryError(
  error: { message: string } | null,
  code = "REPORT_QUERY_FAILED",
): void {
  if (error) fail(code, error.message);
}

/**
 * Server-side autorisasjon for rapporteksport: administrator, eller
 * course_teacher/course_lead med rolle på kurset eller kursmalen.
 * t1_location_distribution aggregerer på tvers av alle kurssteder og er
 * derfor kun for administratorer. Ukjent kurs gir false, som ruten
 * oversetter til 404.
 */
export async function canExportCourseReport(
  adminClient: SupabaseClient,
  userId: string,
  courseRunId: string,
  reportType: ReportType,
): Promise<boolean> {
  const account = await adminClient
    .from("user_accounts")
    .select("profile_id")
    .eq("user_id", userId)
    .eq("is_active", true)
    .maybeSingle();
  assertNoQueryError(account.error, "REPORT_AUTHORIZATION_LOOKUP_FAILED");
  if (!account.data) return false;

  const run = await adminClient
    .from("course_runs")
    .select("template_id")
    .eq("id", courseRunId)
    .maybeSingle();
  assertNoQueryError(run.error, "REPORT_AUTHORIZATION_LOOKUP_FAILED");
  if (!run.data) return false;
  const templateId = run.data.template_id;

  const roles = await adminClient
    .from("role_assignments")
    .select("role,course_run_id,course_template_id")
    .eq("profile_id", account.data.profile_id)
    .is("revoked_at", null)
    .in("role", ["administrator", "course_teacher", "course_lead"]);
  assertNoQueryError(roles.error, "REPORT_AUTHORIZATION_LOOKUP_FAILED");

  return (roles.data ?? []).some(
    (assignment) =>
      assignment.role === "administrator" ||
      (reportType !== "t1_location_distribution" &&
        (assignment.course_run_id === courseRunId ||
          assignment.course_template_id === templateId)),
  );
}

type ParticipantBase = Readonly<{
  run: Readonly<{ id: string; title: string; template_id: string }>;
  template: Readonly<{ code: string; title: string; level: number }>;
  enrollments: readonly Readonly<{
    id: string;
    profile_id: string;
    status: EnrollmentStatus;
  }>[];
  profileById: ReadonlyMap<
    string,
    Readonly<{
      display_name: string;
      normalized_email: string;
      club_name: string | null;
    }>
  >;
}>;

async function loadParticipantBase(
  adminClient: SupabaseClient,
  courseRunId: string,
): Promise<ParticipantBase> {
  const runResult = await adminClient
    .from("course_runs")
    .select("id,title,template_id")
    .eq("id", courseRunId)
    .maybeSingle();
  assertNoQueryError(runResult.error);
  if (!runResult.data) fail("REPORT_COURSE_NOT_FOUND");

  const [templateResult, enrollmentsResult] = await Promise.all([
    adminClient
      .from("course_templates")
      .select("code,title,level")
      .eq("id", runResult.data.template_id)
      .single(),
    adminClient
      .from("enrollments")
      .select("id,profile_id,status")
      .eq("course_run_id", courseRunId),
  ]);
  assertNoQueryError(templateResult.error);
  assertNoQueryError(enrollmentsResult.error);
  if (!templateResult.data) fail("REPORT_TEMPLATE_NOT_FOUND");

  const enrollments = (enrollmentsResult.data ??
    []) as ParticipantBase["enrollments"];
  const profileIds = enrollments.map((enrollment) => enrollment.profile_id);
  const profilesResult = profileIds.length
    ? await adminClient
        .from("profiles")
        .select("id,display_name,normalized_email,club_name")
        .in("id", profileIds)
    : { data: [], error: null };
  assertNoQueryError(profilesResult.error);

  const profileById = new Map(
    (profilesResult.data ?? []).map((profile) => [profile.id, profile]),
  );
  const sorted = [...enrollments].sort((left, right) =>
    (profileById.get(left.profile_id)?.display_name ?? "").localeCompare(
      profileById.get(right.profile_id)?.display_name ?? "",
      "nb-NO",
    ),
  );

  return {
    run: runResult.data,
    template: templateResult.data,
    enrollments: sorted,
    profileById,
  };
}

function participantIdentity(base: ParticipantBase, profileId: string) {
  const profile = base.profileById.get(profileId);
  return {
    name: profile?.display_name ?? "Ukjent deltaker",
    club: profile?.club_name ?? "",
    email: profile?.normalized_email ?? "",
  };
}

/**
 * Kullsnitt per rapportdefinisjon: snitt av verdiene for påmeldinger som
 * ikke har en status i definition.excludeStatuses. Eksportert slik at
 * driftssiden bruker nøyaktig samme formel som rapportene.
 */
export function cohortAverage(
  definition: ReportDefinition,
  enrollments: ReadonlyArray<Readonly<{ id: string; status: string }>>,
  valueByEnrollment: ReadonlyMap<string, number>,
  decimals = 0,
): number {
  const included = enrollments.filter(
    (enrollment) => !definition.excludeStatuses.includes(enrollment.status),
  );
  if (included.length === 0) return 0;
  const total = included.reduce(
    (sum, enrollment) => sum + (valueByEnrollment.get(enrollment.id) ?? 0),
    0,
  );
  const factor = 10 ** decimals;
  return Math.round((total / included.length) * factor) / factor;
}

async function latestPracticeStatusByEnrollment(
  adminClient: SupabaseClient,
  enrollmentIds: readonly string[],
): Promise<Map<string, string>> {
  if (enrollmentIds.length === 0) return new Map();
  const result = await adminClient
    .from("practice_submissions")
    .select("enrollment_id,status,submitted_at")
    .in("enrollment_id", enrollmentIds)
    .order("submitted_at", { ascending: false });
  assertNoQueryError(result.error);

  const latest = new Map<string, string>();
  for (const row of result.data ?? []) {
    if (!latest.has(row.enrollment_id)) {
      latest.set(row.enrollment_id, row.status);
    }
  }
  return latest;
}

async function attendancePercentageByEnrollment(
  adminClient: SupabaseClient,
  enrollmentIds: readonly string[],
): Promise<Map<string, number>> {
  if (enrollmentIds.length === 0) return new Map();
  const result = await adminClient
    .from("attendance_records")
    .select("enrollment_id,planned_minutes,present_minutes")
    .in("enrollment_id", enrollmentIds);
  assertNoQueryError(result.error);

  const recordsByEnrollment = new Map<
    string,
    { plannedMinutes: number; presentMinutes: number }[]
  >();
  for (const row of result.data ?? []) {
    const records = recordsByEnrollment.get(row.enrollment_id) ?? [];
    records.push({
      plannedMinutes: row.planned_minutes,
      presentMinutes: row.present_minutes,
    });
    recordsByEnrollment.set(row.enrollment_id, records);
  }
  return new Map(
    [...recordsByEnrollment].map(([enrollmentId, records]) => [
      enrollmentId,
      calculateAttendance(records).displayPercentage,
    ]),
  );
}

function tableFor(
  definition: ReportDefinition,
  base: Pick<ParticipantBase, "run">,
  generatedAt: Date,
  input: Readonly<{
    filters?: readonly string[];
    summary: readonly string[];
    columns: readonly string[];
    rows: ReadonlyArray<ReadonlyArray<ReportCell>>;
  }>,
): ReportTable {
  return {
    definition,
    courseTitle: base.run.title,
    generatedAt: generatedAt.toISOString(),
    filters: input.filters ?? [`Kurs: ${base.run.title}`, "Status: alle"],
    summary: input.summary,
    columns: input.columns,
    rows: input.rows,
  };
}

async function buildCourseProgressReport(
  adminClient: SupabaseClient,
  courseRunId: string,
  generatedAt: Date,
): Promise<ReportTable> {
  const base = await loadParticipantBase(adminClient, courseRunId);
  const enrollmentIds = base.enrollments.map((enrollment) => enrollment.id);
  const [
    progressResult,
    submissionsResult,
    attendanceByEnrollment,
    practice,
    assignmentActivities,
  ] = await Promise.all([
    enrollmentIds.length
      ? adminClient
          .from("enrollment_progress")
          .select(
            "enrollment_id,percentage,completed_required_count,total_required_count",
          )
          .in("enrollment_id", enrollmentIds)
      : Promise.resolve({ data: [], error: null }),
    enrollmentIds.length
      ? adminClient
          .from("assignment_submissions")
          .select("enrollment_id,status")
          .in("enrollment_id", enrollmentIds)
      : Promise.resolve({ data: [], error: null }),
    attendancePercentageByEnrollment(adminClient, enrollmentIds),
    latestPracticeStatusByEnrollment(adminClient, enrollmentIds),
    loadAssignmentActivities(adminClient, courseRunId),
  ]);
  assertNoQueryError(progressResult.error);
  assertNoQueryError(submissionsResult.error);

  const progressByEnrollment = new Map(
    (progressResult.data ?? []).map((row) => [row.enrollment_id, row]),
  );
  // Nevneren er antall arbeidskrav i kurset (samme kilde som
  // vurderingsrapporten), ikke antall innsendingsrader per deltaker.
  const totalAssignmentCount = assignmentActivities.length;
  const approvedAssignments = new Map<string, number>();
  for (const row of submissionsResult.data ?? []) {
    if (row.status === "approved" || row.status === "graded") {
      approvedAssignments.set(
        row.enrollment_id,
        (approvedAssignments.get(row.enrollment_id) ?? 0) + 1,
      );
    }
  }

  const percentageByEnrollment = new Map(
    base.enrollments.map((enrollment) => [
      enrollment.id,
      progressByEnrollment.get(enrollment.id)?.percentage ?? 0,
    ]),
  );
  const rows = base.enrollments.map((enrollment) => {
    const identity = participantIdentity(base, enrollment.profile_id);
    const progress = progressByEnrollment.get(enrollment.id);
    return [
      identity.name,
      identity.club,
      identity.email,
      progress?.percentage ?? 0,
      progress?.completed_required_count ?? 0,
      progress?.total_required_count ?? 0,
      `${approvedAssignments.get(enrollment.id) ?? 0} av ${totalAssignmentCount}`,
      attendanceByEnrollment.get(enrollment.id) ?? 0,
      PRACTICE_STATUS_LABELS[practice.get(enrollment.id) ?? ""] ??
        "Ikke innsendt",
      ENROLLMENT_STATUS_LABELS[enrollment.status],
    ];
  });

  return tableFor(reportDefinitions.course_progress, base, generatedAt, {
    summary: [
      `Kullsnitt progresjon (ekskl. trukket): ${cohortAverage(reportDefinitions.course_progress, base.enrollments, percentageByEnrollment)} %`,
      `Antall deltakere i rapporten: ${rows.length}`,
    ],
    columns: [
      "Navn",
      "Klubb",
      "E-post",
      "Progresjon (%)",
      "Fullførte krav",
      "Totalt krav",
      "Innleveringer godkjent",
      "Oppmøte (%)",
      "Praksis",
      "Status",
    ],
    rows,
  });
}

async function buildPracticeReport(
  adminClient: SupabaseClient,
  courseRunId: string,
  generatedAt: Date,
): Promise<ReportTable> {
  const base = await loadParticipantBase(adminClient, courseRunId);
  const enrollmentIds = base.enrollments.map((enrollment) => enrollment.id);
  const [entriesResult, practice] = await Promise.all([
    enrollmentIds.length
      ? adminClient
          .from("practice_entries")
          .select("enrollment_id,minutes,category")
          .in("enrollment_id", enrollmentIds)
      : Promise.resolve({ data: [], error: null }),
    latestPracticeStatusByEnrollment(adminClient, enrollmentIds),
  ]);
  assertNoQueryError(entriesResult.error);

  const entriesByEnrollment = new Map<string, PracticeEntryDuration[]>();
  for (const row of entriesResult.data ?? []) {
    const entries = entriesByEnrollment.get(row.enrollment_id) ?? [];
    entries.push({ minutes: row.minutes, category: row.category });
    entriesByEnrollment.set(row.enrollment_id, entries);
  }
  const totalsByEnrollment = new Map(
    base.enrollments.map((enrollment) => [
      enrollment.id,
      calculatePracticeTotals(entriesByEnrollment.get(enrollment.id) ?? []),
    ]),
  );

  const hours = (minutes: number) => Math.round((minutes / 60) * 10) / 10;
  const totalHoursByEnrollment = new Map(
    base.enrollments.map((enrollment) => [
      enrollment.id,
      hours(totalsByEnrollment.get(enrollment.id)?.totalMinutes ?? 0),
    ]),
  );
  const rows = base.enrollments.map((enrollment) => {
    const identity = participantIdentity(base, enrollment.profile_id);
    const totals = totalsByEnrollment.get(enrollment.id) ?? {
      totalMinutes: 0,
      deliveryMinutes: 0,
      planningMinutes: 0,
    };
    return [
      identity.name,
      identity.email,
      hours(totals.totalMinutes),
      hours(totals.deliveryMinutes),
      hours(totals.planningMinutes),
      PRACTICE_STATUS_LABELS[practice.get(enrollment.id) ?? ""] ??
        "Ikke innsendt",
      ENROLLMENT_STATUS_LABELS[enrollment.status],
    ];
  });

  return tableFor(reportDefinitions.practice, base, generatedAt, {
    summary: [
      `Kullsnitt praksistimer (ekskl. trukket): ${cohortAverage(reportDefinitions.practice, base.enrollments, totalHoursByEnrollment, 1)}`,
    ],
    columns: [
      "Navn",
      "E-post",
      "Timer totalt",
      "Timer gjennomføring",
      "Timer planlegging",
      "Praksisstatus",
      "Status",
    ],
    rows,
  });
}

async function buildAttendanceReport(
  adminClient: SupabaseClient,
  courseRunId: string,
  generatedAt: Date,
): Promise<ReportTable> {
  const base = await loadParticipantBase(adminClient, courseRunId);
  const enrollmentIds = base.enrollments.map((enrollment) => enrollment.id);
  const recordsResult = enrollmentIds.length
    ? await adminClient
        .from("attendance_records")
        .select("enrollment_id,planned_minutes,present_minutes")
        .in("enrollment_id", enrollmentIds)
    : { data: [], error: null };
  assertNoQueryError(recordsResult.error);

  const recordsByEnrollment = new Map<
    string,
    { plannedMinutes: number; presentMinutes: number }[]
  >();
  for (const row of recordsResult.data ?? []) {
    const records = recordsByEnrollment.get(row.enrollment_id) ?? [];
    records.push({
      plannedMinutes: row.planned_minutes,
      presentMinutes: row.present_minutes,
    });
    recordsByEnrollment.set(row.enrollment_id, records);
  }

  const percentageByEnrollment = new Map<string, number>();
  const rows = base.enrollments.map((enrollment) => {
    const identity = participantIdentity(base, enrollment.profile_id);
    const totals = calculateAttendance(
      recordsByEnrollment.get(enrollment.id) ?? [],
    );
    percentageByEnrollment.set(enrollment.id, totals.displayPercentage);
    return [
      identity.name,
      identity.email,
      Math.round((totals.plannedMinutes / 60) * 10) / 10,
      Math.round((totals.presentMinutes / 60) * 10) / 10,
      totals.displayPercentage,
      totals.meetsRequirement ? "Ja" : "Nei",
      ENROLLMENT_STATUS_LABELS[enrollment.status],
    ];
  });

  return tableFor(reportDefinitions.attendance, base, generatedAt, {
    summary: [
      `Kullsnitt oppmøte (ekskl. trukket): ${cohortAverage(reportDefinitions.attendance, base.enrollments, percentageByEnrollment)} %`,
    ],
    columns: [
      "Navn",
      "E-post",
      "Planlagte timer",
      "Oppmøtte timer",
      "Oppmøte (%)",
      "Krav oppfylt",
      "Status",
    ],
    rows,
  });
}

async function loadAssignmentActivities(
  adminClient: SupabaseClient,
  courseRunId: string,
) {
  const pathsResult = await adminClient
    .from("learning_paths")
    .select("id")
    .eq("course_run_id", courseRunId)
    .eq("status", "published");
  assertNoQueryError(pathsResult.error);
  const pathIds = (pathsResult.data ?? []).map((path) => path.id);
  if (pathIds.length === 0) return [];

  const activitiesResult = await adminClient
    .from("activities")
    .select("id,title,sort_order")
    .in("learning_path_id", pathIds)
    .eq("activity_type", "assignment")
    .order("sort_order");
  assertNoQueryError(activitiesResult.error);
  return activitiesResult.data ?? [];
}

async function buildAssessmentsReport(
  adminClient: SupabaseClient,
  courseRunId: string,
  generatedAt: Date,
): Promise<ReportTable> {
  const base = await loadParticipantBase(adminClient, courseRunId);
  const [activities, submissionsResult] = await Promise.all([
    loadAssignmentActivities(adminClient, courseRunId),
    adminClient
      .from("assignment_submissions")
      .select("enrollment_id,activity_id,status,current_version_number")
      .eq("course_run_id", courseRunId),
  ]);
  assertNoQueryError(submissionsResult.error);

  const submissionByKey = new Map(
    (submissionsResult.data ?? []).map((row) => [
      `${row.enrollment_id}:${row.activity_id}`,
      row,
    ]),
  );
  const rows = base.enrollments.flatMap((enrollment) => {
    const identity = participantIdentity(base, enrollment.profile_id);
    return activities.map((activity) => {
      const submission = submissionByKey.get(`${enrollment.id}:${activity.id}`);
      return [
        identity.name,
        identity.email,
        activity.title,
        submission
          ? (ASSIGNMENT_STATUS_LABELS[submission.status] ?? submission.status)
          : "Ikke levert",
        submission?.current_version_number ?? 0,
        ENROLLMENT_STATUS_LABELS[enrollment.status],
      ];
    });
  });

  return tableFor(reportDefinitions.assessments, base, generatedAt, {
    summary: [`Antall arbeidskrav: ${activities.length}`],
    columns: [
      "Navn",
      "E-post",
      "Arbeidskrav",
      "Innleveringsstatus",
      "Versjon",
      "Status",
    ],
    rows,
  });
}

async function buildDeadlinesReport(
  adminClient: SupabaseClient,
  courseRunId: string,
  generatedAt: Date,
): Promise<ReportTable> {
  const base = await loadParticipantBase(adminClient, courseRunId);
  const activities = await loadAssignmentActivities(adminClient, courseRunId);
  const activityIds = activities.map((activity) => activity.id);
  const [definitionsResult, submissionsResult] = await Promise.all([
    activityIds.length
      ? adminClient
          .from("assignment_definitions")
          .select("activity_id,default_deadline")
          .in("activity_id", activityIds)
      : Promise.resolve({ data: [], error: null }),
    adminClient
      .from("assignment_submissions")
      .select("enrollment_id,activity_id,status")
      .eq("course_run_id", courseRunId)
      .neq("status", "draft"),
  ]);
  assertNoQueryError(definitionsResult.error);
  assertNoQueryError(submissionsResult.error);

  const deadlineByActivity = new Map(
    (definitionsResult.data ?? []).map((row) => [
      row.activity_id,
      row.default_deadline,
    ]),
  );
  const activeEnrollmentIds = new Set(
    base.enrollments
      .filter((enrollment) => enrollment.status !== "withdrawn")
      .map((enrollment) => enrollment.id),
  );
  const submittedByActivity = new Map<string, number>();
  for (const row of submissionsResult.data ?? []) {
    if (!activeEnrollmentIds.has(row.enrollment_id)) continue;
    submittedByActivity.set(
      row.activity_id,
      (submittedByActivity.get(row.activity_id) ?? 0) + 1,
    );
  }

  const rows = activities.map((activity) => {
    const submitted = submittedByActivity.get(activity.id) ?? 0;
    const deadline = deadlineByActivity.get(activity.id);
    return [
      activity.title,
      deadline ? formatOsloDateTime(deadline) : "Ingen frist",
      submitted,
      Math.max(activeEnrollmentIds.size - submitted, 0),
    ];
  });

  return tableFor(reportDefinitions.deadlines, base, generatedAt, {
    summary: [`Aktive deltakere (ekskl. trukket): ${activeEnrollmentIds.size}`],
    columns: ["Arbeidskrav", "Frist", "Innlevert", "Mangler"],
    rows,
  });
}

async function buildCompletionReport(
  adminClient: SupabaseClient,
  courseRunId: string,
  generatedAt: Date,
): Promise<ReportTable> {
  const base = await loadParticipantBase(adminClient, courseRunId);
  const enrollmentIds = base.enrollments.map((enrollment) => enrollment.id);
  const [progressResult, universityResult, attendanceByEnrollment, practice] =
    await Promise.all([
      enrollmentIds.length
        ? adminClient
            .from("enrollment_progress")
            .select("enrollment_id,percentage")
            .in("enrollment_id", enrollmentIds)
        : Promise.resolve({ data: [], error: null }),
      enrollmentIds.length
        ? adminClient
            .from("university_requirements")
            .select("enrollment_id,completed")
            .in("enrollment_id", enrollmentIds)
        : Promise.resolve({ data: [], error: null }),
      attendancePercentageByEnrollment(adminClient, enrollmentIds),
      latestPracticeStatusByEnrollment(adminClient, enrollmentIds),
    ]);
  assertNoQueryError(progressResult.error);
  assertNoQueryError(universityResult.error);

  const progressByEnrollment = new Map(
    (progressResult.data ?? []).map((row) => [
      row.enrollment_id,
      row.percentage,
    ]),
  );
  const universityByEnrollment = new Map(
    (universityResult.data ?? []).map((row) => [
      row.enrollment_id,
      row.completed,
    ]),
  );
  const gateLabels: Readonly<Record<string, string>> = {
    progress: "progresjon",
    attendance: "oppmøte",
    practice: "praksis",
    university: "universitetsemne",
  };

  let completedCount = 0;
  const rows = base.enrollments.map((enrollment) => {
    const identity = participantIdentity(base, enrollment.profile_id);
    const practiceStatus = practice.get(enrollment.id) ?? "";
    const practiceApproved =
      practiceStatus === "approved_manual" ||
      practiceStatus === "approved_auto";
    const evaluation = evaluateCompletion({
      level: base.template.level as 1 | 2 | 3,
      progress: progressByEnrollment.get(enrollment.id) ?? 0,
      attendance: (attendanceByEnrollment.get(enrollment.id) ?? 0) / 100,
      practiceApproved,
      universityCompleted: universityByEnrollment.get(enrollment.id) ?? null,
    });
    if (evaluation.complete && enrollment.status !== "withdrawn") {
      completedCount += 1;
    }
    return [
      identity.name,
      identity.email,
      progressByEnrollment.get(enrollment.id) ?? 0,
      attendanceByEnrollment.get(enrollment.id) ?? 0,
      practiceApproved ? "Ja" : "Nei",
      evaluation.complete ? "Ja" : "Nei",
      evaluation.missing.map((gate) => gateLabels[gate] ?? gate).join(", ") ||
        "Ingen",
      ENROLLMENT_STATUS_LABELS[enrollment.status],
    ];
  });

  const activeCount = base.enrollments.filter(
    (enrollment) => enrollment.status !== "withdrawn",
  ).length;

  return tableFor(reportDefinitions.completion, base, generatedAt, {
    summary: [
      `Antall fullført (ekskl. trukket): ${completedCount} av ${activeCount}`,
    ],
    columns: [
      "Navn",
      "E-post",
      "Progresjon (%)",
      "Oppmøte (%)",
      "Praksis godkjent",
      "Fullført",
      "Mangler",
      "Status",
    ],
    rows,
  });
}

async function buildT1LocationDistributionReport(
  adminClient: SupabaseClient,
  courseRunId: string,
  generatedAt: Date,
): Promise<ReportTable> {
  const base = await loadParticipantBase(adminClient, courseRunId);
  const [templatesResult, runsResult, enrollmentsResult] = await Promise.all([
    adminClient.from("course_templates").select("id,code"),
    adminClient
      .from("course_runs")
      .select("id,title,template_id,start_year,location_name")
      .order("location_name"),
    adminClient
      .from("enrollments")
      .select("course_run_id,status")
      .neq("status", "withdrawn"),
  ]);
  assertNoQueryError(templatesResult.error);
  assertNoQueryError(runsResult.error);
  assertNoQueryError(enrollmentsResult.error);

  const t1TemplateIds = new Set(
    (templatesResult.data ?? [])
      .filter((template) => template.code === "T1")
      .map((template) => template.id),
  );
  const counts = new Map<string, number>();
  for (const row of enrollmentsResult.data ?? []) {
    counts.set(row.course_run_id, (counts.get(row.course_run_id) ?? 0) + 1);
  }

  const t1Runs = (runsResult.data ?? []).filter((run) =>
    t1TemplateIds.has(run.template_id),
  );
  const rows = t1Runs.map((run) => [
    run.location_name ?? run.title,
    run.start_year,
    counts.get(run.id) ?? 0,
  ]);
  const total = t1Runs.reduce((sum, run) => sum + (counts.get(run.id) ?? 0), 0);

  return tableFor(
    reportDefinitions.t1_location_distribution,
    base,
    generatedAt,
    {
      filters: ["Kurs: alle Trener 1-kurssteder", "Status: ikke trukket"],
      summary: [`Antall deltakere totalt (ekskl. trukket): ${total}`],
      columns: ["Kurssted", "Kull", "Antall deltakere"],
      rows,
    },
  );
}

const builders: Readonly<
  Record<
    ReportType,
    (
      adminClient: SupabaseClient,
      courseRunId: string,
      generatedAt: Date,
    ) => Promise<ReportTable>
  >
> = {
  course_progress: buildCourseProgressReport,
  practice: buildPracticeReport,
  attendance: buildAttendanceReport,
  assessments: buildAssessmentsReport,
  deadlines: buildDeadlinesReport,
  completion: buildCompletionReport,
  t1_location_distribution: buildT1LocationDistributionReport,
};

export async function buildReport(
  adminClient: SupabaseClient,
  reportType: ReportType,
  courseRunId: string,
  generatedAt: Date = new Date(),
): Promise<ReportTable> {
  return builders[reportType](adminClient, courseRunId, generatedAt);
}
