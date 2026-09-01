import { describe, expect, it } from "vitest";

import { classifyPace, recommendedProgress } from "@/features/courses/pace";

describe("recommendedProgress", () => {
  const milestones = [
    { at: new Date("2026-08-01T00:00:00Z"), percent: 40 },
    { at: new Date("2026-09-01T00:00:00Z"), percent: 60 },
  ];

  it("interpolates linearly between teacher-defined milestones", () => {
    expect(
      recommendedProgress(milestones, new Date("2026-08-16T12:00:00Z")),
    ).toBe(50);
  });

  it("returns first percent before the first milestone", () => {
    expect(
      recommendedProgress(milestones, new Date("2026-07-01T00:00:00Z")),
    ).toBe(40);
  });

  it("returns last percent after the last milestone", () => {
    expect(
      recommendedProgress(milestones, new Date("2026-12-24T00:00:00Z")),
    ).toBe(60);
  });

  it("returns exact percent on a milestone", () => {
    expect(
      recommendedProgress(milestones, new Date("2026-09-01T00:00:00Z")),
    ).toBe(60);
  });

  it("sorts unordered milestones before interpolating", () => {
    expect(
      recommendedProgress(
        [...milestones].reverse(),
        new Date("2026-08-16T12:00:00Z"),
      ),
    ).toBe(50);
  });

  it("interpolates on UTC epoch time across the Europe/Oslo DST boundary", () => {
    // DST ends 2026-10-25 in Europe/Oslo; UTC math must be unaffected.
    const dstMilestones = [
      { at: new Date("2026-10-24T00:00:00Z"), percent: 0 },
      { at: new Date("2026-10-26T00:00:00Z"), percent: 100 },
    ];
    expect(
      recommendedProgress(dstMilestones, new Date("2026-10-25T00:00:00Z")),
    ).toBe(50);
  });

  it("returns 0 without milestones", () => {
    expect(recommendedProgress([], new Date("2026-08-16T12:00:00Z"))).toBe(0);
  });

  it("rejects milestones that are not strictly increasing", () => {
    expect(() =>
      recommendedProgress(
        [
          { at: new Date("2026-08-01T00:00:00Z"), percent: 40 },
          { at: new Date("2026-09-01T00:00:00Z"), percent: 40 },
        ],
        new Date("2026-08-16T12:00:00Z"),
      ),
    ).toThrow("PACE_MILESTONES_NOT_STRICTLY_INCREASING");
    expect(() =>
      recommendedProgress(
        [
          { at: new Date("2026-08-01T00:00:00Z"), percent: 40 },
          { at: new Date("2026-08-01T00:00:00Z"), percent: 60 },
        ],
        new Date("2026-08-16T12:00:00Z"),
      ),
    ).toThrow("PACE_MILESTONES_NOT_STRICTLY_INCREASING");
  });

  it("rejects percents outside 0-100", () => {
    expect(() =>
      recommendedProgress(
        [{ at: new Date("2026-08-01T00:00:00Z"), percent: 101 }],
        new Date("2026-08-16T12:00:00Z"),
      ),
    ).toThrow("PACE_MILESTONE_PERCENT_INVALID");
  });
});

describe("classifyPace", () => {
  const thresholds = { greenLag: 5, redLag: 15 };

  it("uses green/yellow/red thresholds on the lag", () => {
    expect(
      classifyPace({
        actual: 55,
        recommended: 60,
        hardDeadlineOverdue: false,
        ...thresholds,
      }),
    ).toBe("green");
    expect(
      classifyPace({
        actual: 50,
        recommended: 60,
        hardDeadlineOverdue: false,
        ...thresholds,
      }),
    ).toBe("yellow");
    expect(
      classifyPace({
        actual: 44,
        recommended: 60,
        hardDeadlineOverdue: false,
        ...thresholds,
      }),
    ).toBe("red");
  });

  it("treats lag exactly at each threshold as the milder color", () => {
    expect(
      classifyPace({
        actual: 55,
        recommended: 60,
        hardDeadlineOverdue: false,
        ...thresholds,
      }),
    ).toBe("green");
    expect(
      classifyPace({
        actual: 45,
        recommended: 60,
        hardDeadlineOverdue: false,
        ...thresholds,
      }),
    ).toBe("yellow");
  });

  it("is green when ahead of the recommendation", () => {
    expect(
      classifyPace({
        actual: 90,
        recommended: 60,
        hardDeadlineOverdue: false,
        ...thresholds,
      }),
    ).toBe("green");
  });

  it("is red when a hard deadline is overdue regardless of lag", () => {
    expect(
      classifyPace({
        actual: 59,
        recommended: 60,
        hardDeadlineOverdue: true,
        ...thresholds,
      }),
    ).toBe("red");
  });
});
