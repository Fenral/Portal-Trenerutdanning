import { randomUUID } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { beforeAll, describe, expect, it } from "vitest";

const assignmentActivityId = "a3200000-0000-0000-0000-000000000007";
const courseRunId = "b1030000-0000-0000-0000-000000000001";
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
        storageKey: `assignment-${email}-${randomUUID()}`,
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

async function createCleanAsset(
  adminClient: SupabaseClient,
  suffix: string,
): Promise<string> {
  const id = randomUUID();
  const { error } = await adminClient.from("media_assets").insert({
    id,
    storage_path: `demo/assignment/${suffix}-${id}.pdf`,
    original_filename: `${suffix}.pdf`,
    mime_type: "application/pdf",
    byte_size: 6,
    sha256: "a".repeat(64),
    scan_status: "clean",
    scanned_at: new Date().toISOString(),
    uploaded_by: selmaProfileId,
  });
  assertNoError(error);
  return id;
}

describe.sequential("versioned assignment flow", () => {
  let adminClient: SupabaseClient;
  let studentClient: SupabaseClient;
  let teacherClient: SupabaseClient;
  let enrollmentId: string;
  let submissionId: string;

  beforeAll(async () => {
    loadLocalEnvironment();
    adminClient = createClient(
      requiredEnvironment("NEXT_PUBLIC_SUPABASE_URL"),
      requiredEnvironment("SUPABASE_SECRET_KEY"),
      { auth: { autoRefreshToken: false, persistSession: false } },
    );
    [studentClient, teacherClient] = await Promise.all([
      signedInClient("selma.dahl@nivaa.invalid"),
      signedInClient("lead.t3@nivaa.invalid"),
    ]);

    const enrollment = await adminClient
      .from("enrollments")
      .select("id")
      .eq("course_run_id", courseRunId)
      .eq("profile_id", selmaProfileId)
      .single();
    assertNoError(enrollment.error);
    if (!enrollment.data) throw new Error("Selma enrollment was not found");
    enrollmentId = enrollment.data.id;
  });

  it("submits, requests revision, resubmits, and approves without losing history", async () => {
    const initialView = await studentClient.rpc("get_assignment_for_student", {
      target_activity_id: assignmentActivityId,
    });
    assertNoError(initialView.error);
    expect(initialView.data).toMatchObject({
      assessmentScale: "pass_fail",
      status: null,
      versions: [],
    });

    const firstAssetId = await createCleanAsset(adminClient, "første-utkast");
    const firstSubmission = await studentClient.rpc(
      "submit_assignment_version",
      {
        target_enrollment_id: enrollmentId,
        target_activity_id: assignmentActivityId,
        target_media_asset_id: firstAssetId,
        target_note: "Første versjon",
      },
    );
    assertNoError(firstSubmission.error);
    expect(firstSubmission.data).toMatchObject({
      status: "submitted",
      versionNumber: 1,
    });
    submissionId = firstSubmission.data.submissionId;

    const forbiddenReview = await studentClient.rpc(
      "review_assignment_submission",
      {
        target_submission_id: submissionId,
        target_action: "approve",
        target_result_value: "approved",
        target_comment: "Studenten prøver å godkjenne eget arbeid",
        target_new_deadline: null,
        target_deadline_reason: null,
      },
    );
    expect(forbiddenReview.error?.message).toBe("ASSIGNMENT_REVIEW_FORBIDDEN");

    const newDeadline = "2027-03-01T23:59:00+01:00";
    const revision = await teacherClient.rpc("review_assignment_submission", {
      target_submission_id: submissionId,
      target_action: "request_revision",
      target_result_value: null,
      target_comment: "Beskriv tydeligere hvordan økten tilpasses utøverne.",
      target_new_deadline: newDeadline,
      target_deadline_reason: "Tid til å utbedre tilbakemeldingen",
    });
    assertNoError(revision.error);
    expect(revision.data).toMatchObject({ status: "revision_required" });

    const revisionView = await studentClient.rpc("get_assignment_for_student", {
      target_activity_id: assignmentActivityId,
    });
    assertNoError(revisionView.error);
    expect(revisionView.data).toMatchObject({
      status: "revision_required",
      effectiveDeadline: "2027-03-01T22:59:00+00:00",
    });
    expect(revisionView.data.versions).toHaveLength(1);
    expect(revisionView.data.reviews[0].comment).toContain("tilpasses");

    const secondAssetId = await createCleanAsset(adminClient, "utbedret");
    const resubmission = await studentClient.rpc("submit_assignment_version", {
      target_enrollment_id: enrollmentId,
      target_activity_id: assignmentActivityId,
      target_media_asset_id: secondAssetId,
      target_note: "Utbedret etter tilbakemelding",
    });
    assertNoError(resubmission.error);
    expect(resubmission.data).toMatchObject({
      status: "submitted",
      versionNumber: 2,
    });

    const approval = await teacherClient.rpc("review_assignment_submission", {
      target_submission_id: submissionId,
      target_action: "approve",
      target_result_value: "approved",
      target_comment: "Godkjent etter utbedring.",
      target_new_deadline: null,
      target_deadline_reason: null,
    });
    assertNoError(approval.error);
    expect(approval.data).toMatchObject({ status: "approved" });

    const versions = await adminClient
      .from("assignment_submission_versions")
      .select("id,version_number")
      .eq("submission_id", submissionId)
      .order("version_number");
    assertNoError(versions.error);
    expect(versions.data?.map((version) => version.version_number)).toEqual([
      1, 2,
    ]);

    const submittedEvents = await adminClient
      .from("audit_events")
      .select("id", { count: "exact", head: true })
      .eq("action", "assignment.submitted")
      .eq("entity_id", submissionId);
    assertNoError(submittedEvents.error);
    expect(submittedEvents.count).toBe(2);

    const completion = await adminClient
      .from("activity_completions")
      .select("id", { count: "exact" })
      .eq("enrollment_id", enrollmentId)
      .eq("activity_id", assignmentActivityId);
    assertNoError(completion.error);
    expect(completion.count).toBe(1);

    const reopened = await teacherClient.rpc("review_assignment_submission", {
      target_submission_id: submissionId,
      target_action: "reopen",
      target_result_value: null,
      target_comment: "Stikkprøven må utbedres etter godkjenning.",
      target_new_deadline: null,
      target_deadline_reason: null,
    });
    assertNoError(reopened.error);
    expect(reopened.data).toMatchObject({ status: "revision_required" });

    const completionState = await adminClient
      .from("activity_completion_states")
      .select("is_active,reason")
      .eq("completion_id", completion.data?.[0]?.id ?? "")
      .single();
    assertNoError(completionState.error);
    expect(completionState.data).toMatchObject({
      is_active: false,
      reason: "Stikkprøven må utbedres etter godkjenning.",
    });
  });
});
