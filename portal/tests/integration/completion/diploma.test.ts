import { randomUUID } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { PDFDocument } from "pdf-lib";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { ensureDiplomaStored } from "@/features/completion/diploma-storage";

const courseRunId = "b1030000-0000-0000-0000-000000000001";
const learningPathId = "a3000000-0000-0000-0000-000000000001";
const completionProfileId = "cf100000-0000-0000-0000-000000000001";
const completionEnrollmentId = "cf200000-0000-0000-0000-000000000001";
const completionEmail = "completion.student@nivaa.invalid";
const practiceActivityId = "a3200000-0000-0000-0000-000000000005";
const practiceEntryIds = [
  "cf300000-0000-0000-0000-000000000001",
  "cf300000-0000-0000-0000-000000000002",
] as const;
const practiceSubmissionId = "cf400000-0000-0000-0000-000000000001";

function loadLocalEnvironment(): void {
  if (!existsSync(".env.local")) return;

  for (const line of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
    const separator = line.indexOf("=");
    if (separator > 0 && !line.startsWith("#")) {
      process.env[line.slice(0, separator)] ??= line.slice(separator + 1);
    }
  }
}

function requiredEnvironment(name: string): string {
  const value = process.env[name];
  if (!value)
    throw new Error(`Missing integration environment variable: ${name}`);
  return value;
}

function assertNoError(error: { message: string } | null): void {
  if (error) throw new Error(error.message);
}

async function signedInClient(email: string): Promise<SupabaseClient> {
  const client = createClient(
    requiredEnvironment("NEXT_PUBLIC_SUPABASE_URL"),
    requiredEnvironment("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"),
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
        storageKey: `completion-${email}-${randomUUID()}`,
      },
    },
  );
  const { error } = await client.auth.signInWithPassword({
    email,
    password: requiredEnvironment("E2E_DEMO_PASSWORD"),
  });
  assertNoError(error);
  return client;
}

async function completeRequiredActivities(
  adminClient: SupabaseClient,
  enrollmentId: string,
  completedByProfileId: string,
) {
  const [activitiesResult, completionsResult, bindingsResult] =
    await Promise.all([
      adminClient
        .from("activities")
        .select("id,content_item_id")
        .eq("learning_path_id", learningPathId)
        .eq("required", true),
      adminClient
        .from("activity_completions")
        .select("activity_id")
        .eq("enrollment_id", enrollmentId),
      adminClient
        .from("course_content_bindings")
        .select("content_item_id,content_revision_id")
        .eq("course_run_id", courseRunId),
    ]);
  assertNoError(activitiesResult.error);
  assertNoError(completionsResult.error);
  assertNoError(bindingsResult.error);

  const completedIds = new Set(
    (completionsResult.data ?? []).map((row) => row.activity_id),
  );
  const revisionByItem = new Map(
    (bindingsResult.data ?? []).map((row) => [
      row.content_item_id,
      row.content_revision_id,
    ]),
  );
  const missing = (activitiesResult.data ?? []).filter(
    (activity) => !completedIds.has(activity.id),
  );

  if (missing.length === 0) return;
  const completion = await adminClient.from("activity_completions").insert(
    missing.map((activity) => ({
      enrollment_id: enrollmentId,
      course_run_id: courseRunId,
      learning_path_id: learningPathId,
      activity_id: activity.id,
      content_item_id: activity.content_item_id,
      content_revision_id: activity.content_item_id
        ? revisionByItem.get(activity.content_item_id)
        : null,
      source: "system",
      completed_by: completedByProfileId,
    })),
  );
  assertNoError(completion.error);
}

async function ensureCompletionStudent(adminClient: SupabaseClient) {
  const users = await adminClient.auth.admin.listUsers({
    page: 1,
    perPage: 1000,
  });
  assertNoError(users.error);
  let authUser = users.data.users.find(
    (user) => user.email === completionEmail,
  );

  if (!authUser) {
    const created = await adminClient.auth.admin.createUser({
      email: completionEmail,
      password: requiredEnvironment("E2E_DEMO_PASSWORD"),
      email_confirm: true,
    });
    assertNoError(created.error);
    authUser = created.data.user ?? undefined;
  }
  if (!authUser) throw new Error("Completion auth user not created");

  const profile = await adminClient.from("profiles").upsert(
    {
      id: completionProfileId,
      display_name: "Ada Fullført",
      normalized_email: completionEmail,
    },
    { onConflict: "id" },
  );
  assertNoError(profile.error);
  const account = await adminClient.from("user_accounts").upsert(
    {
      user_id: authUser.id,
      profile_id: completionProfileId,
      normalized_email: completionEmail,
    },
    { onConflict: "user_id" },
  );
  assertNoError(account.error);
  const enrollment = await adminClient.from("enrollments").upsert(
    {
      id: completionEnrollmentId,
      course_run_id: courseRunId,
      profile_id: completionProfileId,
      status: "active",
      status_reason: null,
    },
    { onConflict: "id" },
  );
  assertNoError(enrollment.error);

  const existingEntries = await adminClient
    .from("practice_entries")
    .select("id")
    .eq("enrollment_id", completionEnrollmentId);
  assertNoError(existingEntries.error);
  if ((existingEntries.data ?? []).length === 0) {
    const entries = await adminClient.from("practice_entries").insert([
      {
        id: practiceEntryIds[0],
        enrollment_id: completionEnrollmentId,
        course_run_id: courseRunId,
        learning_path_id: learningPathId,
        activity_id: practiceActivityId,
        occurred_on: "2027-06-01",
        minutes: 540,
        category: "planning",
        description: "Planlegging for isolert sluttføringstest",
        idempotency_key: "cf500000-0000-0000-0000-000000000001",
        created_by: completionProfileId,
      },
      {
        id: practiceEntryIds[1],
        enrollment_id: completionEnrollmentId,
        course_run_id: courseRunId,
        learning_path_id: learningPathId,
        activity_id: practiceActivityId,
        occurred_on: "2027-06-02",
        minutes: 2160,
        category: "delivery",
        description: "Gjennomføring for isolert sluttføringstest",
        idempotency_key: "cf500000-0000-0000-0000-000000000002",
        created_by: completionProfileId,
      },
    ]);
    assertNoError(entries.error);
  }

  const existingSubmission = await adminClient
    .from("practice_submissions")
    .select("id")
    .eq("id", practiceSubmissionId)
    .maybeSingle();
  assertNoError(existingSubmission.error);
  if (existingSubmission.data) {
    const approval = await adminClient
      .from("practice_submissions")
      .update({ status: "approved_manual" })
      .eq("id", practiceSubmissionId);
    assertNoError(approval.error);
  } else {
    const submission = await adminClient.from("practice_submissions").insert({
      id: practiceSubmissionId,
      enrollment_id: completionEnrollmentId,
      course_run_id: courseRunId,
      learning_path_id: learningPathId,
      activity_id: practiceActivityId,
      version_number: 1,
      status: "approved_manual",
      included_entry_ids: practiceEntryIds,
      total_minutes: 2700,
      planning_minutes: 540,
      delivery_minutes: 2160,
      approval_mode: "manual_review",
      auto_approve_at: null,
      submitted_by: completionProfileId,
    });
    assertNoError(submission.error);
  }
}

async function resetCompletionFixture(
  adminClient: SupabaseClient,
  enrollmentId: string,
) {
  const existingCertificate = await adminClient
    .from("certificates")
    .select("storage_path")
    .eq("enrollment_id", enrollmentId)
    .maybeSingle();
  assertNoError(existingCertificate.error);
  if (existingCertificate.data?.storage_path) {
    const removal = await adminClient.storage
      .from("certificates")
      .remove([existingCertificate.data.storage_path]);
    assertNoError(removal.error);
  }

  const cleanups = await Promise.all([
    adminClient
      .from("outbox_events")
      .delete()
      .eq("event_type", "certificate.issue_requested")
      .eq("payload->>enrollmentId", enrollmentId),
    adminClient
      .from("completion_admin_tasks")
      .delete()
      .eq("enrollment_id", enrollmentId),
    adminClient
      .from("university_requirements")
      .delete()
      .eq("enrollment_id", enrollmentId),
    adminClient
      .from("completion_overrides")
      .delete()
      .eq("enrollment_id", enrollmentId),
    adminClient
      .from("attendance_records")
      .delete()
      .eq("enrollment_id", enrollmentId),
  ]);
  for (const cleanup of cleanups) assertNoError(cleanup.error);

  const certificateCleanup = await adminClient
    .from("certificates")
    .delete()
    .eq("enrollment_id", enrollmentId);
  assertNoError(certificateCleanup.error);
  const enrollmentReset = await adminClient
    .from("enrollments")
    .update({
      status: "active",
      status_reason: null,
      status_changed_at: new Date().toISOString(),
    })
    .eq("id", enrollmentId);
  assertNoError(enrollmentReset.error);
}

describe.sequential("course completion and diploma", () => {
  let adminClient: SupabaseClient;
  let administratorClient: SupabaseClient;
  let teacherClient: SupabaseClient;
  let studentClient: SupabaseClient;
  let otherStudentClient: SupabaseClient;
  let enrollmentId: string;

  beforeAll(async () => {
    loadLocalEnvironment();
    adminClient = createClient(
      requiredEnvironment("NEXT_PUBLIC_SUPABASE_URL"),
      requiredEnvironment("SUPABASE_SECRET_KEY"),
      { auth: { autoRefreshToken: false, persistSession: false } },
    );
    await ensureCompletionStudent(adminClient);
    [administratorClient, teacherClient, studentClient, otherStudentClient] =
      await Promise.all([
        signedInClient("admin.demo@nivaa.invalid"),
        signedInClient("lead.t3@nivaa.invalid"),
        signedInClient(completionEmail),
        signedInClient("student.demo@nivaa.invalid"),
      ]);
    enrollmentId = completionEnrollmentId;
    await resetCompletionFixture(adminClient, enrollmentId);
  });

  afterAll(async () => {
    if (adminClient && enrollmentId) {
      await resetCompletionFixture(adminClient, enrollmentId);
    }
  });

  it("completes once after explicit gates and exposes only the student's certificate", async () => {
    await completeRequiredActivities(
      adminClient,
      enrollmentId,
      completionProfileId,
    );

    const sessions = await adminClient
      .from("course_sessions")
      .select("id")
      .eq("course_run_id", courseRunId)
      .eq("is_required", true)
      .eq("session_type", "regular")
      .order("sort_order");
    assertNoError(sessions.error);

    for (const session of sessions.data ?? []) {
      const attendance = await teacherClient.rpc("record_attendance", {
        target_enrollment_id: enrollmentId,
        target_session_id: session.id,
        target_planned_minutes: 1000,
        target_present_minutes: 799,
        target_reason: "Oppmøte registrert etter samlingen",
      });
      assertNoError(attendance.error);
    }

    const beforeOverride = await administratorClient.rpc(
      "evaluate_course_completion",
      { target_enrollment_id: enrollmentId },
    );
    assertNoError(beforeOverride.error);
    expect(beforeOverride.data).toMatchObject({
      complete: false,
      attendanceDisplayPercentage: 80,
    });
    expect(beforeOverride.data.missing).toEqual(["attendance", "university"]);

    const teacherCannotSetUniversity = await teacherClient.rpc(
      "set_university_completion",
      {
        target_enrollment_id: enrollmentId,
        target_completed: true,
        target_note: "Forsøkt registrert av kurslærer",
      },
    );
    expect(teacherCannotSetUniversity.error?.message).toBe(
      "UNIVERSITY_REQUIREMENT_ADMIN_ONLY",
    );

    const override = await administratorClient.rpc(
      "set_attendance_completion_override",
      {
        target_enrollment_id: enrollmentId,
        target_reason: "Dokumentert gyldig fravær",
      },
    );
    assertNoError(override.error);

    const university = await administratorClient.rpc(
      "set_university_completion",
      {
        target_enrollment_id: enrollmentId,
        target_completed: true,
        target_note: "Universitetets emne er kontrollert manuelt",
      },
    );
    assertNoError(university.error);
    expect(university.data).toMatchObject({ complete: true, missing: [] });

    const secondEvaluation = await administratorClient.rpc(
      "evaluate_course_completion",
      { target_enrollment_id: enrollmentId },
    );
    assertNoError(secondEvaluation.error);
    expect(secondEvaluation.data.certificateId).toBe(
      university.data.certificateId,
    );

    const [enrollment, certificates, outbox] = await Promise.all([
      adminClient
        .from("enrollments")
        .select("status")
        .eq("id", enrollmentId)
        .single(),
      adminClient
        .from("certificates")
        .select(
          "id,course_run_id,certificate_number,template_version,display_name,course_title,completed_on,storage_path,sha256",
        )
        .eq("enrollment_id", enrollmentId),
      adminClient
        .from("outbox_events")
        .select("id", { count: "exact" })
        .eq("event_type", "certificate.issue_requested")
        .eq("payload->>enrollmentId", enrollmentId),
    ]);
    assertNoError(enrollment.error);
    assertNoError(certificates.error);
    assertNoError(outbox.error);
    expect(enrollment.data?.status).toBe("completed");
    expect(certificates.data).toHaveLength(1);
    expect(certificates.data?.[0]).toMatchObject({
      display_name: "Ada Fullført",
      course_title: "Trener 3 · 2026–2027",
    });
    expect(outbox.count).toBe(1);

    const ownCertificate = await studentClient
      .from("certificates")
      .select("id")
      .eq("id", university.data.certificateId);
    assertNoError(ownCertificate.error);
    expect(ownCertificate.data).toHaveLength(1);

    const hiddenCertificate = await otherStudentClient
      .from("certificates")
      .select("id")
      .eq("id", university.data.certificateId);
    assertNoError(hiddenCertificate.error);
    expect(hiddenCertificate.data).toEqual([]);

    const certificate = certificates.data?.[0];
    if (!certificate) throw new Error("Issued certificate not found");

    const firstFile = await ensureDiplomaStored(adminClient, certificate);
    const secondFile = await ensureDiplomaStored(adminClient, certificate);
    expect(firstFile.created).toBe(true);
    expect(secondFile).toMatchObject({
      path: firstFile.path,
      sha256: firstFile.sha256,
      created: false,
    });

    const files = await adminClient.storage
      .from("certificates")
      .list(`${courseRunId}/${certificate.id}`);
    assertNoError(files.error);
    expect(files.data?.map((file) => file.name)).toEqual(["diplom.pdf"]);

    const ownSignedUrl = await studentClient.storage
      .from("certificates")
      .createSignedUrl(firstFile.path, 60);
    assertNoError(ownSignedUrl.error);
    if (!ownSignedUrl.data) throw new Error("Signed diploma URL not created");
    const pdfResponse = await fetch(ownSignedUrl.data.signedUrl);
    const pdfBytes = new Uint8Array(await pdfResponse.arrayBuffer());
    const pdf = await PDFDocument.load(pdfBytes);
    expect(new TextDecoder().decode(pdfBytes.slice(0, 8))).toMatch(/^%PDF-/);
    expect(pdf.getTitle()).toBe("Diplom - Ada Fullført");
    expect(pdf.getSubject()).toContain("Ada Fullført");
    expect(pdf.getSubject()).toContain("Trener 3 · 2026–2027");

    const forbiddenSignedUrl = await otherStudentClient.storage
      .from("certificates")
      .createSignedUrl(firstFile.path, 60);
    expect(forbiddenSignedUrl.error).not.toBeNull();
  });
});
