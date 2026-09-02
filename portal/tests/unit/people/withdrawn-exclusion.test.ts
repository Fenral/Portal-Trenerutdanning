import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";

import { loadTeacherParticipants } from "@/features/attendance/teacher-data";
import { loadParticipantCounts } from "@/features/courses/portfolio";

type Row = Record<string, unknown>;

/** Minimal in-memory Supabase query stub with honest eq/neq/in semantics. */
function fakeClient(tables: Record<string, Row[]>): SupabaseClient {
  const builder = (data: Row[]) => ({
    select: () => builder(data),
    eq: (column: string, value: unknown) =>
      builder(data.filter((row) => row[column] === value)),
    neq: (column: string, value: unknown) =>
      builder(data.filter((row) => row[column] !== value)),
    in: (column: string, values: readonly unknown[]) =>
      builder(data.filter((row) => values.includes(row[column]))),
    order: () => builder(data),
    then: (
      resolve: (result: { data: Row[]; error: null }) => unknown,
      reject: (reason: unknown) => unknown,
    ) => Promise.resolve({ data, error: null }).then(resolve, reject),
  });
  return {
    from: (table: string) => builder(tables[table] ?? []),
  } as unknown as SupabaseClient;
}

const tables: Record<string, Row[]> = {
  enrollments: [
    {
      id: "enrollment-active",
      course_run_id: "run-1",
      profile_id: "profile-active",
      status: "active",
    },
    {
      id: "enrollment-withdrawn",
      course_run_id: "run-1",
      profile_id: "profile-withdrawn",
      status: "withdrawn",
    },
  ],
  profiles: [
    { id: "profile-active", display_name: "Aktiv Deltaker", club_name: "GK" },
    {
      id: "profile-withdrawn",
      display_name: "Trukket Deltaker",
      club_name: "GK",
    },
  ],
  course_runs: [{ id: "run-1", title: "Trener 2 · 2026" }],
  enrollment_progress: [
    { enrollment_id: "enrollment-active", percentage: 40 },
    { enrollment_id: "enrollment-withdrawn", percentage: 90 },
  ],
  attendance_records: [],
  learning_paths: [],
};

describe("withdrawn participants stay out of teacher projections", () => {
  it("excludes withdrawn enrollments from the teacher participant list", async () => {
    const participants = await loadTeacherParticipants(fakeClient(tables));

    expect(participants.map((participant) => participant.enrollmentId)).toEqual(
      ["enrollment-active"],
    );
  });

  it("excludes withdrawn enrollments from cohort participant counts", async () => {
    const counts = await loadParticipantCounts(fakeClient(tables));

    expect(counts.get("run-1")).toBe(1);
  });
});
