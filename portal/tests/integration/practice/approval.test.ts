import { randomUUID } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { beforeAll, describe, expect, it } from "vitest";

const practiceActivityId = "a3200000-0000-0000-0000-000000000005";
const courseRunId = "b1030000-0000-0000-0000-000000000001";
const emilProfileId = "c0000000-0000-0000-0000-000000000006";
const selmaProfileId = "c0000000-0000-0000-0000-000000000007";

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
        storageKey: `practice-${email}-${randomUUID()}`,
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

async function enrollmentId(
  adminClient: SupabaseClient,
  profileId: string,
): Promise<string> {
  const result = await adminClient
    .from("enrollments")
    .select("id")
    .eq("course_run_id", courseRunId)
    .eq("profile_id", profileId)
    .single();
  assertNoError(result.error);
  if (!result.data) throw new Error("Practice enrollment was not found");
  return result.data.id;
}

async function addEntry(
  studentClient: SupabaseClient,
  targetEnrollmentId: string,
  input: Readonly<{
    minutes: number;
    category: "delivery" | "planning";
    idempotencyKey?: string;
  }>,
) {
  return studentClient.rpc("add_practice_entry", {
    target_enrollment_id: targetEnrollmentId,
    target_activity_id: practiceActivityId,
    target_occurred_on: "2026-08-20",
    target_minutes: input.minutes,
    target_category: input.category,
    target_description: "Praksis i egen klubb",
    target_idempotency_key: input.idempotencyKey ?? randomUUID(),
  });
}

describe.sequential("practice approval workflow", () => {
  let adminClient: SupabaseClient;
  let teacherClient: SupabaseClient;
  let emilClient: SupabaseClient;
  let selmaClient: SupabaseClient;
  let emilEnrollmentId: string;
  let selmaEnrollmentId: string;

  beforeAll(async () => {
    loadLocalEnvironment();
    adminClient = createClient(
      requiredEnvironment("NEXT_PUBLIC_SUPABASE_URL"),
      requiredEnvironment("SUPABASE_SECRET_KEY"),
      { auth: { autoRefreshToken: false, persistSession: false } },
    );
    [teacherClient, emilClient, selmaClient] = await Promise.all([
      signedInClient("lead.t3@nivaa.invalid"),
      signedInClient("emil.berg@nivaa.invalid"),
      signedInClient("selma.dahl@nivaa.invalid"),
    ]);
    [emilEnrollmentId, selmaEnrollmentId] = await Promise.all([
      enrollmentId(adminClient, emilProfileId),
      enrollmentId(adminClient, selmaProfileId),
    ]);
  });

  it("rejects 44h59m and supports manual approval", async () => {
    const definition = await adminClient
      .from("practice_definitions")
      .update({ approval_mode: "manual_review", auto_delay_hours: null })
      .eq("activity_id", practiceActivityId);
    assertNoError(definition.error);

    const idempotencyKey = randomUUID();
    const first = await addEntry(emilClient, emilEnrollmentId, {
      minutes: 2699,
      category: "delivery",
      idempotencyKey,
    });
    assertNoError(first.error);

    const duplicate = await addEntry(emilClient, emilEnrollmentId, {
      minutes: 2699,
      category: "delivery",
      idempotencyKey,
    });
    assertNoError(duplicate.error);
    expect(duplicate.data.entryId).toBe(first.data.entryId);

    const hiddenFromAnotherStudent = await selmaClient
      .from("practice_entries")
      .select("id")
      .eq("id", first.data.entryId);
    assertNoError(hiddenFromAnotherStudent.error);
    expect(hiddenFromAnotherStudent.data).toEqual([]);

    const tooEarly = await emilClient.rpc("submit_practice", {
      target_enrollment_id: emilEnrollmentId,
      target_activity_id: practiceActivityId,
    });
    expect(tooEarly.error?.message).toBe("PRACTICE_MINUTES_MISSING:1");

    const finalMinute = await addEntry(emilClient, emilEnrollmentId, {
      minutes: 1,
      category: "delivery",
    });
    assertNoError(finalMinute.error);

    const submitted = await emilClient.rpc("submit_practice", {
      target_enrollment_id: emilEnrollmentId,
      target_activity_id: practiceActivityId,
    });
    assertNoError(submitted.error);
    expect(submitted.data).toMatchObject({
      status: "submitted",
      versionNumber: 1,
      autoApproveAt: null,
    });

    const forbiddenSelfApproval = await emilClient.rpc(
      "review_practice_submission",
      {
        target_submission_id: submitted.data.submissionId,
        target_action: "approve",
        target_comment: "Studenten prøver å godkjenne egne timer.",
      },
    );
    expect(forbiddenSelfApproval.error?.message).toBe(
      "PRACTICE_REVIEW_FORBIDDEN",
    );

    const approved = await teacherClient.rpc("review_practice_submission", {
      target_submission_id: submitted.data.submissionId,
      target_action: "approve",
      target_comment: "Timene er kontrollert og godkjent.",
    });
    assertNoError(approved.error);
    expect(approved.data).toMatchObject({ status: "approved_manual" });
  });

  it("delays auto approval for 24 hours and supports a reversible spot-check", async () => {
    const definition = await adminClient
      .from("practice_definitions")
      .update({ approval_mode: "auto_approve", auto_delay_hours: 24 })
      .eq("activity_id", practiceActivityId);
    assertNoError(definition.error);

    assertNoError(
      (
        await addEntry(selmaClient, selmaEnrollmentId, {
          minutes: 2160,
          category: "delivery",
        })
      ).error,
    );
    assertNoError(
      (
        await addEntry(selmaClient, selmaEnrollmentId, {
          minutes: 540,
          category: "planning",
        })
      ).error,
    );

    const planningOverflow = await addEntry(selmaClient, selmaEnrollmentId, {
      minutes: 1,
      category: "planning",
    });
    expect(planningOverflow.error?.message).toBe(
      "PRACTICE_PLANNING_LIMIT_EXCEEDED:1",
    );

    const submitted = await selmaClient.rpc("submit_practice", {
      target_enrollment_id: selmaEnrollmentId,
      target_activity_id: practiceActivityId,
    });
    assertNoError(submitted.error);
    expect(submitted.data).toMatchObject({
      status: "submitted",
      versionNumber: 1,
    });

    const dueAt = new Date(submitted.data.autoApproveAt);
    const beforeDue = new Date(dueAt.getTime() - 60_000).toISOString();
    const notYet = await adminClient.rpc("process_due_practice_submissions", {
      process_at: beforeDue,
    });
    assertNoError(notYet.error);
    expect(notYet.data).toBe(0);

    const afterDue = new Date(dueAt.getTime() + 1_000).toISOString();
    const due = await adminClient.rpc("process_due_practice_submissions", {
      process_at: afterDue,
    });
    assertNoError(due.error);
    expect(due.data).toBe(1);

    const duplicateRun = await adminClient.rpc(
      "process_due_practice_submissions",
      { process_at: afterDue },
    );
    assertNoError(duplicateRun.error);
    expect(duplicateRun.data).toBe(0);

    const revoked = await teacherClient.rpc("review_practice_submission", {
      target_submission_id: submitted.data.submissionId,
      target_action: "spot_check_revoke",
      target_comment: "En stikkprøve mangler dokumentasjon.",
    });
    assertNoError(revoked.error);
    expect(revoked.data).toMatchObject({ status: "revision_required" });

    assertNoError(
      (
        await addEntry(selmaClient, selmaEnrollmentId, {
          minutes: 60,
          category: "delivery",
        })
      ).error,
    );
    const resubmitted = await selmaClient.rpc("submit_practice", {
      target_enrollment_id: selmaEnrollmentId,
      target_activity_id: practiceActivityId,
    });
    assertNoError(resubmitted.error);
    expect(resubmitted.data).toMatchObject({
      status: "submitted",
      versionNumber: 2,
    });

    const completion = await adminClient
      .from("activity_completions")
      .select("id,activity_completion_states(is_active)")
      .eq("enrollment_id", selmaEnrollmentId)
      .eq("activity_id", practiceActivityId)
      .single();
    assertNoError(completion.error);
    if (!completion.data) throw new Error("Practice completion was not found");
    expect(completion.data.activity_completion_states).toMatchObject({
      is_active: false,
    });
  });
});
