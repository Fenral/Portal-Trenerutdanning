import { describe, expect, it } from "vitest";

import {
  calculatePracticeTotals,
  canSubmitPractice,
  validatePracticeEntry,
} from "@/features/practice/totals";

describe("practice totals", () => {
  it("allows submission at 45 total hours with at most 9 planning hours", () => {
    const totals = calculatePracticeTotals([
      { minutes: 2160, category: "delivery" },
      { minutes: 540, category: "planning" },
    ]);

    expect(totals).toEqual({
      totalMinutes: 2700,
      planningMinutes: 540,
      deliveryMinutes: 2160,
    });
    expect(canSubmitPractice(totals)).toEqual({ ok: true });
  });

  it("rejects 45 hours when planning exceeds 9 hours", () => {
    expect(
      canSubmitPractice({
        totalMinutes: 2700,
        planningMinutes: 600,
        deliveryMinutes: 2100,
      }),
    ).toEqual({
      ok: false,
      reason: "planning_limit",
      excessMinutes: 60,
    });
  });

  it("reports exactly how many minutes are missing", () => {
    expect(
      canSubmitPractice({
        totalMinutes: 2699,
        planningMinutes: 539,
        deliveryMinutes: 2160,
      }),
    ).toEqual({
      ok: false,
      reason: "missing_minutes",
      missingMinutes: 1,
    });
  });

  it("rejects non-positive and non-integer entry durations", () => {
    expect(() =>
      validatePracticeEntry({ minutes: 0, category: "delivery" }),
    ).toThrow("Varigheten må være et positivt antall hele minutter");
    expect(() =>
      validatePracticeEntry({ minutes: 30.5, category: "planning" }),
    ).toThrow("Varigheten må være et positivt antall hele minutter");
  });
});
