import { randomUUID } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { beforeAll, describe, expect, it } from "vitest";

// Gjenskaper de fire beviste angrepene fra uavhengig review mot RPC-laget.
// Lukket i migrasjonen 20261105090000_person_merge_hardening.sql.

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

const suffix = randomUUID().slice(0, 8);
const seededAdminProfileId = "c0000000-0000-0000-0000-000000000001";

let adminClient: SupabaseClient;
let adminSession: SupabaseClient;

const runAId = randomUUID();
const runBId = randomUUID();
const sessionRunAId = randomUUID();
const sessionRunBId = randomUUID();
const approverProfileId = randomUUID();

async function createProfile(name: string, email: string): Promise<string> {
  const profileId = randomUUID();
  const result = await adminClient.from("profiles").insert({
    id: profileId,
    display_name: name,
    normalized_email: email,
    club_name: "Fjordglimt GK",
  });
  assertNoError(result.error);
  return profileId;
}

async function enroll(profileId: string, courseRunId: string): Promise<string> {
  const enrollmentId = randomUUID();
  const result = await adminClient.from("enrollments").insert({
    id: enrollmentId,
    course_run_id: courseRunId,
    profile_id: profileId,
    status: "active",
  });
  assertNoError(result.error);
  return enrollmentId;
}

async function recordAttendance(
  enrollmentId: string,
  courseRunId: string,
  sessionId: string,
  presentMinutes: number,
): Promise<void> {
  const result = await adminClient.from("attendance_records").insert({
    enrollment_id: enrollmentId,
    course_run_id: courseRunId,
    session_id: sessionId,
    planned_minutes: 780,
    present_minutes: presentMinutes,
    reason: "Registrert oppmøte",
    recorded_by: seededAdminProfileId,
  });
  assertNoError(result.error);
}

beforeAll(async () => {
  loadLocalEnvironment();
  adminClient = createClient(
    requiredEnvironment("NEXT_PUBLIC_SUPABASE_URL"),
    requiredEnvironment("SUPABASE_SECRET_KEY"),
    { auth: { autoRefreshToken: false, persistSession: false } },
  );

  adminSession = createClient(
    requiredEnvironment("NEXT_PUBLIC_SUPABASE_URL"),
    requiredEnvironment("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"),
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
        storageKey: `merge-hardening-${randomUUID()}`,
      },
    },
  );
  const signIn = await adminSession.auth.signInWithPassword({
    email: "admin.demo@nivaa.invalid",
    password: requiredEnvironment("E2E_DEMO_PASSWORD"),
  });
  assertNoError(signIn.error);

  const templateId = randomUUID();
  const template = await adminClient.from("course_templates").insert({
    id: templateId,
    code: `HARD-${suffix.toUpperCase()}`,
    title: "Herdingstest",
    level: 2,
  });
  assertNoError(template.error);

  const runs = await adminClient.from("course_runs").insert(
    [
      { id: runAId, title: "Herdingstest A" },
      { id: runBId, title: "Herdingstest B" },
    ].map((run) => ({
      ...run,
      template_id: templateId,
      start_year: 2027,
      starts_on: "2027-01-10",
      ends_on: "2027-11-20",
      status: "active",
    })),
  );
  assertNoError(runs.error);

  const sessions = await adminClient.from("course_sessions").insert([
    {
      id: sessionRunAId,
      course_run_id: runAId,
      title: "Samling 1",
      starts_at: "2027-03-01T17:00:00+01:00",
      ends_at: "2027-03-01T21:00:00+01:00",
      sort_order: 1,
    },
    {
      id: sessionRunBId,
      course_run_id: runBId,
      title: "Samling 1",
      starts_at: "2027-03-08T17:00:00+01:00",
      ends_at: "2027-03-08T21:00:00+01:00",
      sort_order: 1,
    },
  ]);
  assertNoError(sessions.error);

  const approver = await adminClient.from("profiles").insert({
    id: approverProfileId,
    display_name: "Herding Godkjenner",
    normalized_email: `hard.approver.${suffix}@merge.invalid`,
  });
  assertNoError(approver.error);
  const approverRole = await adminClient.from("role_assignments").insert({
    profile_id: approverProfileId,
    role: "administrator",
    granted_by: seededAdminProfileId,
  });
  assertNoError(approverRole.error);
});

describe("merge hardening: activity detection (finding 1)", () => {
  it("refuses a merge where both sides only have attendance in the same course", async () => {
    const sourceId = await createProfile(
      "Atle Oppmøte",
      `atle.${suffix}@merge.invalid`,
    );
    const targetId = await createProfile(
      "Atle O Oppmøte",
      `atle.o.${suffix}@merge.invalid`,
    );
    const sourceEnrollmentId = await enroll(sourceId, runAId);
    const targetEnrollmentId = await enroll(targetId, runAId);
    await recordAttendance(sourceEnrollmentId, runAId, sessionRunAId, 660);
    await recordAttendance(targetEnrollmentId, runAId, sessionRunAId, 780);

    const merge = await adminSession.rpc("merge_people", {
      source_id: sourceId,
      target_id: targetId,
      target_reason: "Duplikat med oppmøte på begge sider",
    });
    expect(merge.error?.message).toBe("MERGE_COURSE_CONFLICT");

    // Ingen endringer: kildens oppmøte-enrollment er verken flyttet eller trukket.
    const untouched = await adminClient
      .from("enrollments")
      .select("profile_id,status")
      .eq("id", sourceEnrollmentId)
      .single();
    assertNoError(untouched.error);
    expect(untouched.data).toEqual({ profile_id: sourceId, status: "active" });
  });
});

describe("merge hardening: reversal fingerprint (finding 2)", () => {
  it("demands manual reversal after new attendance on a moved enrollment", async () => {
    const sourceId = await createProfile(
      "Rakel Flytt",
      `rakel.${suffix}@merge.invalid`,
    );
    const targetId = await createProfile(
      "Rakel F Flytt",
      `rakel.f.${suffix}@merge.invalid`,
    );
    const movedEnrollmentId = await enroll(sourceId, runBId);

    const merge = await adminSession.rpc("merge_people", {
      source_id: sourceId,
      target_id: targetId,
      target_reason: "Duplikat",
    });
    assertNoError(merge.error);

    await recordAttendance(movedEnrollmentId, runBId, sessionRunBId, 780);

    const reversal = await adminSession.rpc("reverse_merge", {
      merge_id: merge.data as string,
    });
    assertNoError(reversal.error);
    expect((reversal.data as { status: string }).status).toBe(
      "manual_reversal_required",
    );

    const enrollment = await adminClient
      .from("enrollments")
      .select("profile_id")
      .eq("id", movedEnrollmentId)
      .single();
    assertNoError(enrollment.error);
    expect((enrollment.data as { profile_id: string }).profile_id).toBe(
      targetId,
    );
  });
});

describe("merge hardening: anonymization chain (finding 3)", () => {
  it("scrubs the whole merge chain and unredeemed invitations", async () => {
    const ritaEmail = `rita.rot.${suffix}@merge.invalid`;
    const rId = await createProfile("Rita Rot", ritaEmail);
    const qId = await createProfile(
      "Rita R Rot",
      `rita.r.${suffix}@merge.invalid`,
    );
    const pId = await createProfile(
      "Rita RR Rot",
      `rita.rr.${suffix}@merge.invalid`,
    );

    const invitationId = randomUUID();
    const invitation = await adminClient.from("invitations").insert({
      id: invitationId,
      normalized_email: ritaEmail,
      token_hash: `${randomUUID().replaceAll("-", "")}${randomUUID().replaceAll("-", "")}`,
      course_run_id: runAId,
      role: "student",
      expires_at: new Date(Date.now() + 30 * 86_400_000).toISOString(),
      created_by: seededAdminProfileId,
    });
    assertNoError(invitation.error);

    const first = await adminSession.rpc("merge_people", {
      source_id: rId,
      target_id: qId,
      target_reason: "Duplikat R inn i Q",
    });
    assertNoError(first.error);
    const second = await adminSession.rpc("merge_people", {
      source_id: qId,
      target_id: pId,
      target_reason: "Duplikat Q inn i P",
    });
    assertNoError(second.error);

    const anonymize = await adminSession.rpc("anonymize_person", {
      target_profile_id: pId,
      case_reference: `SAK-HARD-${suffix}-3`,
      approver_profile_id: approverProfileId,
    });
    assertNoError(anonymize.error);

    const rProfile = await adminClient
      .from("profiles")
      .select("display_name,normalized_email,phone,club_name")
      .eq("id", rId)
      .single();
    assertNoError(rProfile.error);
    expect(rProfile.data).toEqual({
      display_name: "Anonymisert deltaker",
      normalized_email: `anonymisert-${rId}@anonymisert.invalid`,
      phone: null,
      club_name: null,
    });

    const snapshot = await adminClient
      .from("person_merges")
      .select("source_snapshot")
      .eq("source_profile_id", rId)
      .single();
    assertNoError(snapshot.error);
    expect(
      (snapshot.data as { source_snapshot: { display_name: string } })
        .source_snapshot.display_name,
    ).toBe("Anonymisert deltaker");

    const scrubbedInvitation = await adminClient
      .from("invitations")
      .select("normalized_email")
      .eq("id", invitationId)
      .single();
    assertNoError(scrubbedInvitation.error);
    expect(
      (scrubbedInvitation.data as { normalized_email: string })
        .normalized_email,
    ).toBe(`anonymisert-${invitationId}@anonymisert.invalid`);
  });
});

describe("merge hardening: approver and target guards (finding 4)", () => {
  it("refuses the target as approver and refuses privileged targets", async () => {
    const adminTargetId = await createProfile(
      "Herding Måladmin",
      `hard.target.${suffix}@merge.invalid`,
    );
    const role = await adminClient.from("role_assignments").insert({
      profile_id: adminTargetId,
      role: "administrator",
      granted_by: seededAdminProfileId,
    });
    assertNoError(role.error);

    const selfApproved = await adminSession.rpc("anonymize_person", {
      target_profile_id: adminTargetId,
      case_reference: `SAK-HARD-${suffix}-4A`,
      approver_profile_id: adminTargetId,
    });
    expect(selfApproved.error?.message).toBe("ANONYMIZE_APPROVER_MUST_DIFFER");

    const privileged = await adminSession.rpc("anonymize_person", {
      target_profile_id: adminTargetId,
      case_reference: `SAK-HARD-${suffix}-4B`,
      approver_profile_id: approverProfileId,
    });
    expect(privileged.error?.message).toBe("ANONYMIZE_TARGET_PRIVILEGED");

    // Målet er uendret: fortsatt aktiv administratorrolle og klartekstnavn.
    const untouched = await adminClient
      .from("profiles")
      .select("display_name")
      .eq("id", adminTargetId)
      .single();
    assertNoError(untouched.error);
    expect((untouched.data as { display_name: string }).display_name).toBe(
      "Herding Måladmin",
    );
  });

  it("revokes every active role of the anonymized participant", async () => {
    const studentId = await createProfile(
      "Stig Student",
      `stig.${suffix}@merge.invalid`,
    );
    const role = await adminClient.from("role_assignments").insert({
      profile_id: studentId,
      role: "student",
      course_run_id: runAId,
      granted_by: seededAdminProfileId,
    });
    assertNoError(role.error);

    const anonymize = await adminSession.rpc("anonymize_person", {
      target_profile_id: studentId,
      case_reference: `SAK-HARD-${suffix}-4C`,
      approver_profile_id: approverProfileId,
    });
    assertNoError(anonymize.error);

    const activeRoles = await adminClient
      .from("role_assignments")
      .select("id")
      .eq("profile_id", studentId)
      .is("revoked_at", null);
    assertNoError(activeRoles.error);
    expect(activeRoles.data).toEqual([]);
  });

  it("refuses self-anonymization by the acting administrator", async () => {
    const result = await adminSession.rpc("anonymize_person", {
      target_profile_id: seededAdminProfileId,
      case_reference: `SAK-HARD-${suffix}-4D`,
      approver_profile_id: approverProfileId,
    });
    expect(result.error?.message).toBe("ANONYMIZE_SELF_FORBIDDEN");
  });
});
