import { describe, expect, it } from "vitest";

import { calculateProgress } from "@/features/learning/progress";

describe("calculateProgress", () => {
  it("uses required weights and ignores optional activities", () => {
    const activities = [
      { id: "a", required: true, weight: 1 },
      { id: "b", required: true, weight: 2 },
      { id: "c", required: false, weight: 10 },
    ];

    expect(calculateProgress(activities, new Set(["a", "c"]))).toEqual({
      completedWeight: 1,
      totalWeight: 3,
      percentage: 33,
    });
  });

  it("returns zero for an empty unpublished path", () => {
    expect(calculateProgress([], new Set())).toEqual({
      completedWeight: 0,
      totalWeight: 0,
      percentage: 0,
    });
  });

  it("caps a completed required path at 100 percent", () => {
    expect(
      calculateProgress(
        [
          { id: "a", required: true, weight: 1 },
          { id: "b", required: true, weight: 2 },
        ],
        new Set(["a", "b", "unknown"]),
      ),
    ).toEqual({
      completedWeight: 3,
      totalWeight: 3,
      percentage: 100,
    });
  });
});
