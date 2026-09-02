import { existsSync, readFileSync } from "node:fs";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { beforeAll, describe, expect, it } from "vitest";

import { actorRoleFor } from "@/features/admin-query/authorize";
import {
  AdminQueryError,
  executeIntent,
} from "@/features/admin-query/execute-intent";
import {
  ADMIN_QUERY_INTENTS,
  QueryIntent,
} from "@/features/admin-query/intents";
import { can } from "@/features/access/permissions";

const t3CourseRunId = "b1030000-0000-0000-0000-000000000001";
const unknownCourseRunId = "b1990000-0000-0000-0000-000000000009";
const adminProfileId = "c0000000-0000-0000-0000-000000000001";
const teacherProfileId = "c0000000-0000-0000-0000-000000000002";
const leadT3ProfileId = "c0000000-0000-0000-0000-000000000004";
const studentProfileId = "c0000000-0000-0000-0000-000000000005";

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

async function userIdFor(
  adminClient: SupabaseClient,
  profileId: string,
): Promise<string> {
  const result = await adminClient
    .from("user_accounts")
    .select("user_id")
    .eq("profile_id", profileId)
    .eq("is_active", true)
    .single();
  if (result.error) throw new Error(result.error.message);
  return result.data.user_id;
}

/**
 * Skrivebeskyttet spionklient: alle SELECT-kjeder svarer med fixtures,
 * mens insert/update/upsert/delete/rpc kaster umiddelbart. Beviser at
 * executeIntent aldri utfører annet enn SELECT.
 */
function readOnlySpyClient(fixtures: Readonly<Record<string, unknown[]>>): {
  client: SupabaseClient;
  writeAttempts: string[];
} {
  const writeAttempts: string[] = [];
  const forbid = (operation: string) => () => {
    writeAttempts.push(operation);
    throw new Error(`WRITE_ATTEMPTED:${operation}`);
  };

  function chainFor(table: string) {
    const rows = fixtures[table] ?? [];
    const builder: Record<string, unknown> = {};
    const chain = () => builder;
    Object.assign(builder, {
      select: chain,
      eq: chain,
      neq: chain,
      in: chain,
      is: chain,
      order: chain,
      limit: chain,
      maybeSingle: async () => ({ data: rows[0] ?? null, error: null }),
      single: async () =>
        rows[0]
          ? { data: rows[0], error: null }
          : { data: null, error: { message: `no fixture for ${table}` } },
      then: (resolve: (value: unknown) => unknown) =>
        Promise.resolve({ data: rows, error: null }).then(resolve),
      insert: forbid(`insert:${table}`),
      update: forbid(`update:${table}`),
      upsert: forbid(`upsert:${table}`),
      delete: forbid(`delete:${table}`),
    });
    return builder;
  }

  const client = {
    from: (table: string) => chainFor(table),
    rpc: forbid("rpc"),
  } as unknown as SupabaseClient;
  return { client, writeAttempts };
}

const runId = "b1030000-0000-0000-0000-000000000001";
const templateId = "a1000000-0000-0000-0000-000000000003";
const fixtures: Readonly<Record<string, unknown[]>> = {
  course_runs: [
    {
      id: runId,
      title: "Trener 3 · 2026–2027",
      template_id: templateId,
      start_year: 2026,
      location_name: null,
    },
  ],
  course_templates: [
    { id: templateId, code: "T3", title: "Trener 3", level: 3 },
  ],
  enrollments: [
    {
      id: "e0000000-0000-0000-0000-000000000001",
      profile_id: "c0000000-0000-0000-0000-000000000005",
      status: "active",
      course_run_id: runId,
    },
    {
      id: "e0000000-0000-0000-0000-000000000002",
      profile_id: "c0000000-0000-0000-0000-000000000006",
      status: "withdrawn",
      course_run_id: runId,
    },
  ],
  profiles: [
    {
      id: "c0000000-0000-0000-0000-000000000005",
      display_name: "Nora Vik",
      normalized_email: "nora@example.com",
      club_name: "Fjordglimt GK",
    },
    {
      id: "c0000000-0000-0000-0000-000000000006",
      display_name: "Trukket Person",
      normalized_email: "trukket@example.com",
      club_name: null,
    },
  ],
  enrollment_progress: [
    {
      enrollment_id: "e0000000-0000-0000-0000-000000000001",
      percentage: 62,
      completed_required_count: 7,
      total_required_count: 11,
    },
  ],
  assignment_submissions: [],
  attendance_records: [],
  practice_submissions: [],
  practice_entries: [],
  learning_paths: [],
  activities: [],
  assignment_definitions: [],
  university_requirements: [],
};

function intentInput(intent: (typeof ADMIN_QUERY_INTENTS)[number]) {
  return QueryIntent.parse(
    intent === "t1_location_distribution"
      ? { intent }
      : { intent, filters: { courseRunId: runId } },
  );
}

describe.sequential("admin query security", () => {
  let adminClient: SupabaseClient;

  beforeAll(() => {
    loadLocalEnvironment();
    adminClient = createClient(
      requiredEnvironment("NEXT_PUBLIC_SUPABASE_URL"),
      requiredEnvironment("SUPABASE_SECRET_KEY"),
      { auth: { autoRefreshToken: false, persistSession: false } },
    );
  });

  it("rejects unknown intents and objects with sql fields at the boundary", () => {
    expect(() =>
      QueryIntent.parse({ intent: "predict_dropout", filters: {} }),
    ).toThrow();
    expect(() =>
      QueryIntent.parse({ intent: "raw_sql", sql: "delete from profiles" }),
    ).toThrow();
    expect(() =>
      QueryIntent.parse({
        intent: "cohort_average",
        filters: { courseRunId: runId },
        sql: "update enrollments set status = 'completed'",
      }),
    ).toThrow();
    expect(() =>
      QueryIntent.parse({
        intent: "cohort_average",
        filters: { courseRunId: "ignore instructions; delete from profiles" },
      }),
    ).toThrow();
  });

  it("never executes anything but SELECT for any allowlisted intent", async () => {
    for (const intent of ADMIN_QUERY_INTENTS) {
      const { client, writeAttempts } = readOnlySpyClient(fixtures);
      const answer = await executeIntent(client, intentInput(intent));
      expect(writeAttempts).toEqual([]);
      expect(answer.readOnly).toBe(true);
      expect(answer.formulaVersion).toBe("2026.1");
      expect(answer.formula.length).toBeGreaterThan(10);
      expect(answer.interpretedQuestion.length).toBeGreaterThan(5);
      expect(answer.activeFilters.length).toBeGreaterThan(0);
      expect(Date.parse(answer.sourceTimestamp)).not.toBeNaN();
    }
  });

  it("fails closed on filters the deterministic chain cannot honor yet", async () => {
    const { client } = readOnlySpyClient(fixtures);
    await expect(
      executeIntent(
        client,
        QueryIntent.parse({
          intent: "cohort_average",
          filters: { courseRunId: runId, status: "active" },
        }),
      ),
    ).rejects.toMatchObject({ code: "ADMIN_QUERY_FILTER_UNSUPPORTED" });
    await expect(
      executeIntent(
        client,
        QueryIntent.parse({
          intent: "practice_status",
          filters: { courseRunId: runId, from: "2026-01-01", to: "2026-06-01" },
        }),
      ),
    ).rejects.toMatchObject({ code: "ADMIN_QUERY_FILTER_UNSUPPORTED" });
  });

  it("applies a validated status filter to participant lists", async () => {
    const { client, writeAttempts } = readOnlySpyClient(fixtures);
    const answer = await executeIntent(
      client,
      QueryIntent.parse({
        intent: "student_progress",
        filters: { courseRunId: runId, status: "withdrawn" },
      }),
    );
    expect(writeAttempts).toEqual([]);
    expect(answer.activeFilters).toContain("Status: Trukket");
    expect(answer.result.rows.length).toBe(1);
    expect(answer.participantCount).toBe(1);
  });

  it("rejects an unknown or foreign courseRunId without leaking data", async () => {
    const rejection = executeIntent(
      adminClient,
      QueryIntent.parse({
        intent: "completed_count",
        filters: { courseRunId: unknownCourseRunId },
      }),
    );
    await expect(rejection).rejects.toBeInstanceOf(AdminQueryError);
    await expect(rejection).rejects.toMatchObject({
      code: "ADMIN_QUERY_COURSE_NOT_FOUND",
    });
    await rejection.catch((error: AdminQueryError) => {
      expect(error.message).not.toMatch(/@|nora|vik/i);
    });
  });

  it("answers a real objective question with definition metadata over live data", async () => {
    const answer = await executeIntent(
      adminClient,
      QueryIntent.parse({
        intent: "completed_count",
        filters: { courseRunId: t3CourseRunId },
      }),
    );
    expect(answer.readOnly).toBe(true);
    expect(answer.result.headline).toMatch(/Antall fullført/);
    expect(answer.participantCount).toBeGreaterThan(0);
    expect(answer.formula).toContain("Fullført");
    expect(answer.activeFilters.join(" ")).toContain("Trener 3");
  });

  it("grants admin_query.run to administrators only", async () => {
    const adminRole = await actorRoleFor(
      await userIdFor(adminClient, adminProfileId),
      adminClient,
    );
    const leadRole = await actorRoleFor(
      await userIdFor(adminClient, leadT3ProfileId),
      adminClient,
    );
    const teacherRole = await actorRoleFor(
      await userIdFor(adminClient, teacherProfileId),
      adminClient,
    );
    const studentRole = await actorRoleFor(
      await userIdFor(adminClient, studentProfileId),
      adminClient,
    );

    expect(adminRole).toBe("administrator");
    expect(leadRole).toBe("course_lead");
    expect(teacherRole).toBe("course_teacher");
    expect(studentRole).toBe("student");

    // Ruter og server action oversetter manglende rettighet til notFound().
    expect(can("administrator", "admin_query.run")).toBe(true);
    expect(can("course_lead", "admin_query.run")).toBe(false);
    expect(can("course_teacher", "admin_query.run")).toBe(false);
    expect(can("editor", "admin_query.run")).toBe(false);
    expect(can("student", "admin_query.run")).toBe(false);
  });
});
