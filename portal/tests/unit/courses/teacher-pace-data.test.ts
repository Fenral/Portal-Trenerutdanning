import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";

import { loadPaceByEnrollment } from "@/features/courses/pace/teacher-pace-data";

type Row = Record<string, unknown>;

/** Minimal in-memory Supabase query stub with honest eq/in/order semantics. */
function fakeClient(tables: Record<string, Row[]>): SupabaseClient {
  const builder = (data: Row[]) => ({
    select: () => builder(data),
    eq: (column: string, value: unknown) =>
      builder(data.filter((row) => row[column] === value)),
    in: (column: string, values: readonly unknown[]) =>
      builder(data.filter((row) => values.includes(row[column]))),
    order: (column: string, options?: { ascending?: boolean }) => {
      const direction = options?.ascending === false ? -1 : 1;
      return builder(
        [...data].sort((a, b) => {
          const left = a[column] as number | string;
          const right = b[column] as number | string;
          return (left < right ? -1 : left > right ? 1 : 0) * direction;
        }),
      );
    },
    then: (
      resolve: (result: { data: Row[]; error: null }) => unknown,
      reject: (reason: unknown) => unknown,
    ) => Promise.resolve({ data, error: null }).then(resolve, reject),
  });
  return {
    from: (table: string) => builder(tables[table] ?? []),
  } as unknown as SupabaseClient;
}

const NOW = new Date("2026-09-01T00:00:00Z");

function participant(
  enrollmentId: string,
  progressPercentage: number,
  activityCompleted = false,
) {
  return {
    enrollmentId,
    courseRunId: "run-1",
    progressPercentage,
    modules: [
      {
        activities: [
          { id: "act-1", completed: activityCompleted, required: true },
        ],
      },
    ],
  };
}

const baseTables: Record<string, Row[]> = {
  pace_plans: [
    {
      id: "plan-1",
      course_run_id: "run-1",
      green_lag: 5,
      red_lag: 15,
      version: 1,
    },
  ],
  // Single milestone => recommended progress is 50 at any time.
  pace_milestones: [
    { plan_id: "plan-1", at: "2026-08-01T00:00:00Z", percent: 50 },
  ],
  // Deadline in the past relative to NOW.
  assignment_definitions: [
    { activity_id: "act-1", default_deadline: "2026-06-01T00:00:00Z" },
  ],
  assignment_deadline_overrides: [],
  assignment_submissions: [],
};

describe("loadPaceByEnrollment", () => {
  it("does not flag submitted-but-unreviewed assignments as overdue", async () => {
    const client = fakeClient({
      ...baseTables,
      assignment_submissions: [
        { enrollment_id: "enr-submitted", activity_id: "act-1", status: "submitted" },
        { enrollment_id: "enr-draft", activity_id: "act-1", status: "draft" },
        {
          enrollment_id: "enr-revision",
          activity_id: "act-1",
          status: "revision_required",
        },
      ],
    });

    const pace = await loadPaceByEnrollment(
      client,
      [
        participant("enr-submitted", 50),
        participant("enr-draft", 50),
        participant("enr-revision", 50),
        participant("enr-none", 50),
      ],
      NOW,
    );

    // All are on pace (lag 0); only the hard-deadline rule can make them red.
    expect(pace["enr-submitted"]).toBe("green");
    expect(pace["enr-draft"]).toBe("red");
    expect(pace["enr-revision"]).toBe("red");
    expect(pace["enr-none"]).toBe("red");
  });

  it("ignores past deadlines for completed activities", async () => {
    const client = fakeClient(baseTables);
    const pace = await loadPaceByEnrollment(
      client,
      [participant("enr-done", 50, true)],
      NOW,
    );
    expect(pace["enr-done"]).toBe("green");
  });

  it("omits enrollments whose course run has no pace plan", async () => {
    const client = fakeClient({ ...baseTables, pace_plans: [] });
    const pace = await loadPaceByEnrollment(
      client,
      [participant("enr-a", 50)],
      NOW,
    );
    expect(pace).toEqual({});
  });

  it("classifies against the newest plan version", async () => {
    const client = fakeClient({
      ...baseTables,
      pace_plans: [
        {
          id: "plan-old",
          course_run_id: "run-1",
          green_lag: 50,
          red_lag: 60,
          version: 1,
        },
        {
          id: "plan-new",
          course_run_id: "run-1",
          green_lag: 5,
          red_lag: 15,
          version: 2,
        },
      ],
      pace_milestones: [
        { plan_id: "plan-new", at: "2026-08-01T00:00:00Z", percent: 50 },
      ],
      assignment_definitions: [],
    });

    // Lag 10: green under the old plan (green_lag 50), yellow under the new.
    const pace = await loadPaceByEnrollment(
      client,
      [participant("enr-a", 40)],
      NOW,
    );
    expect(pace["enr-a"]).toBe("yellow");
  });
});
