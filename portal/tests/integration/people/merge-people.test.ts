import { randomUUID } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { beforeAll, describe, expect, it } from "vitest";

import { buildReport } from "@/features/reporting/report-builders";

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
        storageKey: `merge-${email}-${randomUUID()}`,
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

const suffix = randomUUID().slice(0, 8);
const seededAdminProfileId = "c0000000-0000-0000-0000-000000000001";

let adminClient: SupabaseClient;
let adminSession: SupabaseClient;

const runAId = randomUUID();
const runBId = randomUUID();
const sourceProfileId = randomUUID();
const targetProfileId = randomUUID();
let sourceUserId = "";
let targetUserId = "";
const sourceEnrollmentRunAId = randomUUID();
const targetEnrollmentRunAId = randomUUID();
const sourceEnrollmentRunBId = randomUUID();

type EnrollmentRow = Readonly<{
  id: string;
  profile_id: string;
  status: string;
  status_reason: string | null;
  status_changed_at: string;
}>;

async function enrollmentById(id: string): Promise<EnrollmentRow> {
  const result = await adminClient
    .from("enrollments")
    .select("id,profile_id,status,status_reason,status_changed_at")
    .eq("id", id)
    .single();
  assertNoError(result.error);
  return result.data as EnrollmentRow;
}

async function accountProfile(userId: string): Promise<string> {
  const result = await adminClient
    .from("user_accounts")
    .select("profile_id")
    .eq("user_id", userId)
    .single();
  assertNoError(result.error);
  return (result.data as { profile_id: string }).profile_id;
}

async function createPerson(input: {
  profileId: string;
  name: string;
  email: string;
  club: string;
  phone: string;
}): Promise<string> {
  const created = await adminClient.auth.admin.createUser({
    email: input.email,
    password: `Merge-test-${randomUUID()}`,
    email_confirm: true,
  });
  assertNoError(created.error);
  const userId = created.data.user?.id;
  if (!userId) throw new Error("auth user was not created");

  const profile = await adminClient.from("profiles").insert({
    id: input.profileId,
    display_name: input.name,
    normalized_email: input.email,
    club_name: input.club,
    phone: input.phone,
  });
  assertNoError(profile.error);

  const account = await adminClient.from("user_accounts").insert({
    user_id: userId,
    profile_id: input.profileId,
    normalized_email: input.email,
  });
  assertNoError(account.error);
  return userId;
}

let preMergeEnrollments: EnrollmentRow[] = [];
let mergeId = "";

beforeAll(async () => {
  loadLocalEnvironment();
  adminClient = createClient(
    requiredEnvironment("NEXT_PUBLIC_SUPABASE_URL"),
    requiredEnvironment("SUPABASE_SECRET_KEY"),
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
  adminSession = await signedInClient("admin.demo@nivaa.invalid");

  const templateId = randomUUID();
  const template = await adminClient.from("course_templates").insert({
    id: templateId,
    code: `MERGE-${suffix.toUpperCase()}`,
    title: "Sammenslåingstest",
    level: 2,
  });
  assertNoError(template.error);

  const runs = await adminClient.from("course_runs").insert([
    {
      id: runAId,
      template_id: templateId,
      title: "Sammenslåingstest A",
      start_year: 2027,
      starts_on: "2027-01-10",
      ends_on: "2027-11-20",
      status: "active",
    },
    {
      id: runBId,
      template_id: templateId,
      title: "Sammenslåingstest B",
      start_year: 2027,
      starts_on: "2027-01-10",
      ends_on: "2027-11-20",
      status: "active",
    },
  ]);
  assertNoError(runs.error);

  sourceUserId = await createPerson({
    profileId: sourceProfileId,
    name: "Nora Vik",
    email: `nora.vik.${suffix}@merge.invalid`,
    club: "Fjordglimt GK",
    phone: "90000101",
  });
  targetUserId = await createPerson({
    profileId: targetProfileId,
    name: "Nora K Vik",
    email: `nora.k.vik.${suffix}@merge.invalid`,
    club: "Fjordglimt GK",
    phone: "90000101",
  });

  // Konflikt i kurs A (begge aktive, lik progresjon → målets beholdes),
  // pluss en konfliktfri enrollment i kurs B som skal flyttes.
  const enrollments = await adminClient.from("enrollments").insert([
    {
      id: sourceEnrollmentRunAId,
      course_run_id: runAId,
      profile_id: sourceProfileId,
      status: "active",
    },
    {
      id: targetEnrollmentRunAId,
      course_run_id: runAId,
      profile_id: targetProfileId,
      status: "active",
    },
    {
      id: sourceEnrollmentRunBId,
      course_run_id: runBId,
      profile_id: sourceProfileId,
      status: "active",
    },
  ]);
  assertNoError(enrollments.error);

  const roles = await adminClient.from("role_assignments").insert([
    {
      profile_id: sourceProfileId,
      role: "student",
      course_run_id: runAId,
      granted_by: seededAdminProfileId,
    },
    {
      profile_id: targetProfileId,
      role: "student",
      course_run_id: runAId,
      granted_by: seededAdminProfileId,
    },
  ]);
  assertNoError(roles.error);

  preMergeEnrollments = await Promise.all(
    [
      sourceEnrollmentRunAId,
      targetEnrollmentRunAId,
      sourceEnrollmentRunBId,
    ].map(enrollmentById),
  );
});

describe("merge_people", () => {
  it("rejects a course teacher", async () => {
    const teacherSession = await signedInClient("teacher.demo@nivaa.invalid");
    const result = await teacherSession.rpc("merge_people", {
      source_id: sourceProfileId,
      target_id: targetProfileId,
      target_reason: "Forsøk fra lærer",
    });
    expect(result.error?.message).toBe("MERGE_FORBIDDEN");
  });

  it("moves two auth accounts to one person without duplicate enrollment", async () => {
    const result = await adminSession.rpc("merge_people", {
      source_id: sourceProfileId,
      target_id: targetProfileId,
      target_reason: "Duplikat bekreftet mot Checkin",
    });
    assertNoError(result.error);
    mergeId = result.data as string;
    expect(mergeId).toMatch(/^[0-9a-f-]{36}$/);

    // Begge auth-kontoene peker nå på målpersonen.
    expect(await accountProfile(sourceUserId)).toBe(targetProfileId);
    expect(await accountProfile(targetUserId)).toBe(targetProfileId);

    // Kurs A: målets enrollment beholdt aktiv, kildens trukket — ikke duplikat.
    const activeInRunA = await adminClient
      .from("enrollments")
      .select("id,profile_id,status")
      .eq("course_run_id", runAId)
      .neq("status", "withdrawn");
    assertNoError(activeInRunA.error);
    expect(activeInRunA.data).toEqual([
      {
        id: targetEnrollmentRunAId,
        profile_id: targetProfileId,
        status: "active",
      },
    ]);

    // Kurs B: konfliktfri enrollment er flyttet til målet med samme ID.
    const movedRunB = await enrollmentById(sourceEnrollmentRunBId);
    expect(movedRunB.profile_id).toBe(targetProfileId);
    expect(movedRunB.status).toBe("active");

    // Bare én aktiv studentrolle i kurs A etter sammenslåing.
    const activeRoles = await adminClient
      .from("role_assignments")
      .select("profile_id")
      .eq("course_run_id", runAId)
      .eq("role", "student")
      .is("revoked_at", null);
    assertNoError(activeRoles.error);
    expect(activeRoles.data).toEqual([{ profile_id: targetProfileId }]);
  });

  it("counts one person in the course progress report", async () => {
    const report = await buildReport(adminClient, "course_progress", runAId);
    const statusColumn = report.columns.indexOf("Status");
    const activeRows = report.rows.filter(
      (row) => row[statusColumn] !== "Trukket",
    );
    expect(activeRows).toHaveLength(1);
    expect(activeRows[0]?.[0]).toBe("Nora K Vik");
  });

  it("rejects a second merge of the same source", async () => {
    const result = await adminSession.rpc("merge_people", {
      source_id: sourceProfileId,
      target_id: targetProfileId,
      target_reason: "Dobbelt forsøk",
    });
    expect(result.error?.message).toBe("MERGE_ALREADY_MERGED");
  });

  it("reverses the merge and restores exact rows", async () => {
    const result = await adminSession.rpc("reverse_merge", {
      merge_id: mergeId,
    });
    assertNoError(result.error);
    expect((result.data as { status: string }).status).toBe("reversed");

    expect(await accountProfile(sourceUserId)).toBe(sourceProfileId);
    expect(await accountProfile(targetUserId)).toBe(targetProfileId);

    const restored = await Promise.all(
      [
        sourceEnrollmentRunAId,
        targetEnrollmentRunAId,
        sourceEnrollmentRunBId,
      ].map(enrollmentById),
    );
    expect(restored).toEqual(preMergeEnrollments);

    const activeRoles = await adminClient
      .from("role_assignments")
      .select("profile_id")
      .eq("course_run_id", runAId)
      .eq("role", "student")
      .is("revoked_at", null)
      .order("profile_id");
    assertNoError(activeRoles.error);
    expect(activeRoles.data).toHaveLength(2);
  });

  it("requires manual reversal when an affected row changed after merge", async () => {
    // Fersk konfliktfri sammenslåing: én enrollment flyttes.
    const freshSourceId = randomUUID();
    const freshTargetId = randomUUID();
    const freshEnrollmentId = randomUUID();
    const freshSourceUser = await createPerson({
      profileId: freshSourceId,
      name: "Ola Berg",
      email: `ola.berg.${suffix}@merge.invalid`,
      club: "Fjordglimt GK",
      phone: "90000202",
    });
    await createPerson({
      profileId: freshTargetId,
      name: "Ola B Berg",
      email: `ola.b.berg.${suffix}@merge.invalid`,
      club: "Fjordglimt GK",
      phone: "90000202",
    });
    const enrollment = await adminClient.from("enrollments").insert({
      id: freshEnrollmentId,
      course_run_id: runBId,
      profile_id: freshSourceId,
      status: "active",
    });
    assertNoError(enrollment.error);

    const merge = await adminSession.rpc("merge_people", {
      source_id: freshSourceId,
      target_id: freshTargetId,
      target_reason: "Duplikat",
    });
    assertNoError(merge.error);

    // Endre en berørt rad etter sammenslåingen.
    const change = await adminClient
      .from("enrollments")
      .update({ status_reason: "Endret etter sammenslåing" })
      .eq("id", freshEnrollmentId);
    assertNoError(change.error);

    const reversal = await adminSession.rpc("reverse_merge", {
      merge_id: merge.data as string,
    });
    assertNoError(reversal.error);
    const payload = reversal.data as {
      status: string;
      mismatches: readonly unknown[];
    };
    expect(payload.status).toBe("manual_reversal_required");
    expect(payload.mismatches.length).toBeGreaterThan(0);

    // Ingen delvise endringer: kontoen står fortsatt på målpersonen.
    expect(await accountProfile(freshSourceUser)).toBe(freshTargetId);
    const unchanged = await enrollmentById(freshEnrollmentId);
    expect(unchanged.profile_id).toBe(freshTargetId);
    expect(unchanged.status_reason).toBe("Endret etter sammenslåing");
  });
});

describe("anonymize_person", () => {
  it("rejects the acting administrator as their own approver", async () => {
    const result = await adminSession.rpc("anonymize_person", {
      target_profile_id: targetProfileId,
      case_reference: "SAK-2026-001",
      approver_profile_id: seededAdminProfileId,
    });
    expect(result.error?.message).toBe("ANONYMIZE_APPROVER_MUST_DIFFER");
  });

  it("rejects an approver who is not an administrator", async () => {
    const result = await adminSession.rpc("anonymize_person", {
      target_profile_id: targetProfileId,
      case_reference: "SAK-2026-001",
      approver_profile_id: sourceProfileId,
    });
    expect(result.error?.message).toBe("ANONYMIZE_APPROVER_NOT_ADMINISTRATOR");
  });

  it("replaces identifiers irreversibly and keeps pseudonymous aggregates", async () => {
    const approverProfileId = randomUUID();
    const approver = await adminClient.from("profiles").insert({
      id: approverProfileId,
      display_name: "Godkjenner Admin",
      normalized_email: `approver.${suffix}@merge.invalid`,
    });
    assertNoError(approver.error);
    const approverRole = await adminClient.from("role_assignments").insert({
      profile_id: approverProfileId,
      role: "administrator",
      granted_by: seededAdminProfileId,
    });
    assertNoError(approverRole.error);

    const result = await adminSession.rpc("anonymize_person", {
      target_profile_id: sourceProfileId,
      case_reference: "SAK-2026-002",
      approver_profile_id: approverProfileId,
    });
    assertNoError(result.error);

    const profile = await adminClient
      .from("profiles")
      .select("display_name,normalized_email,phone,club_name,birth_year")
      .eq("id", sourceProfileId)
      .single();
    assertNoError(profile.error);
    expect(profile.data).toEqual({
      display_name: "Anonymisert deltaker",
      normalized_email: `anonymisert-${sourceProfileId}@anonymisert.invalid`,
      phone: null,
      club_name: null,
      birth_year: null,
    });

    const account = await adminClient
      .from("user_accounts")
      .select("is_active,normalized_email")
      .eq("user_id", sourceUserId)
      .single();
    assertNoError(account.error);
    expect(
      (account.data as { is_active: boolean; normalized_email: string })
        .is_active,
    ).toBe(false);

    // Pseudonyme kursaggregater beholdes.
    const enrollments = await adminClient
      .from("enrollments")
      .select("id")
      .eq("profile_id", sourceProfileId);
    assertNoError(enrollments.error);
    expect(enrollments.data?.length).toBeGreaterThanOrEqual(2);
  });
});
