import { describe, expect, it } from "vitest";

import {
  ADMIN_QUERY_INTENTS,
  QueryIntent,
} from "@/features/admin-query/intents";

const courseRunId = "00000000-0000-0000-0000-000000000001";

describe("admin query intents", () => {
  it("accepts only objective V1 intents", () => {
    expect(
      QueryIntent.parse({ intent: "cohort_average", filters: { courseRunId } })
        .intent,
    ).toBe("cohort_average");
    expect(() =>
      QueryIntent.parse({ intent: "predict_dropout", filters: {} }),
    ).toThrow();
    expect(() =>
      QueryIntent.parse({ intent: "raw_sql", sql: "delete from profiles" }),
    ).toThrow();
  });

  it("accepts every allowlisted intent with validated filters", () => {
    for (const intent of ADMIN_QUERY_INTENTS) {
      const parsed = QueryIntent.parse(
        intent === "t1_location_distribution"
          ? { intent }
          : { intent, filters: { courseRunId } },
      );
      expect(parsed.intent).toBe(intent);
    }
  });

  it("rejects extra top-level fields via strict parsing", () => {
    expect(() =>
      QueryIntent.parse({
        intent: "cohort_average",
        filters: { courseRunId },
        sql: "select * from profiles",
      }),
    ).toThrow();
    expect(() =>
      QueryIntent.parse({
        intent: "cohort_average",
        filters: { courseRunId },
        sortExpression: "email desc",
      }),
    ).toThrow();
  });

  it("rejects unknown filter fields and free-form columns", () => {
    expect(() =>
      QueryIntent.parse({
        intent: "student_progress",
        filters: { courseRunId, column: "national_id" },
      }),
    ).toThrow();
    expect(() =>
      QueryIntent.parse({
        intent: "t1_location_distribution",
        filters: { sort: "1; drop table profiles" },
      }),
    ).toThrow();
  });

  it("rejects invalid UUIDs, statuses and date ranges", () => {
    expect(() =>
      QueryIntent.parse({
        intent: "completed_count",
        filters: { courseRunId: "1 or 1=1" },
      }),
    ).toThrow();
    expect(() =>
      QueryIntent.parse({
        intent: "attendance_status",
        filters: { courseRunId, status: "deleted; --" },
      }),
    ).toThrow();
    expect(() =>
      QueryIntent.parse({
        intent: "practice_status",
        filters: { courseRunId, from: "not-a-date", to: "2026-09-01" },
      }),
    ).toThrow();
    expect(
      QueryIntent.parse({
        intent: "practice_status",
        filters: {
          courseRunId,
          status: "withdrawn",
          from: "2026-01-01",
          to: "2026-09-01",
        },
      }).filters,
    ).toMatchObject({ status: "withdrawn" });
  });

  it("requires a course for course-scoped intents", () => {
    expect(() =>
      QueryIntent.parse({ intent: "cohort_average", filters: {} }),
    ).toThrow();
  });
});
