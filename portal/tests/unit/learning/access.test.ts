import { describe, expect, it } from "vitest";

import {
  assertAcyclicPrerequisites,
  getActivityAccess,
  type ActivityPrerequisite,
} from "@/features/learning/access";
import { getNextActivity } from "@/features/learning/next-activity";

const prerequisites: readonly ActivityPrerequisite[] = [
  {
    activityId: "step-2",
    prerequisiteActivityId: "step-1",
    title: "Steg 1",
  },
  {
    activityId: "knowledge-test",
    prerequisiteActivityId: "step-1",
    title: "Steg 1",
  },
  {
    activityId: "knowledge-test",
    prerequisiteActivityId: "step-2",
    title: "Steg 2",
  },
];

describe("getActivityAccess", () => {
  it("locks step 2 until step 1 is complete and names what is missing", () => {
    expect(getActivityAccess("step-2", new Set(), prerequisites)).toEqual({
      state: "locked",
      missing: [{ activityId: "step-1", title: "Steg 1" }],
    });

    expect(
      getActivityAccess("step-2", new Set(["step-1"]), prerequisites),
    ).toEqual({ state: "open" });
  });

  it("requires all selected lessons before the knowledge test", () => {
    expect(
      getActivityAccess("knowledge-test", new Set(["step-1"]), prerequisites),
    ).toEqual({
      state: "locked",
      missing: [{ activityId: "step-2", title: "Steg 2" }],
    });
  });

  it("does not let an optional activity block when it is not a prerequisite", () => {
    expect(
      getActivityAccess(
        "knowledge-test",
        new Set(["step-1", "step-2"]),
        prerequisites,
      ),
    ).toEqual({ state: "open" });
  });
});

describe("learning path publication", () => {
  it("rejects a circular prerequisite graph", () => {
    expect(() =>
      assertAcyclicPrerequisites([
        { activityId: "a", prerequisiteActivityId: "b", title: "B" },
        { activityId: "b", prerequisiteActivityId: "c", title: "C" },
        { activityId: "c", prerequisiteActivityId: "a", title: "A" },
      ]),
    ).toThrow("Sirkulær avhengighet");
  });
});

describe("getNextActivity", () => {
  it("returns the first open incomplete activity", () => {
    expect(
      getNextActivity(
        [
          { id: "step-1", title: "Steg 1" },
          { id: "step-2", title: "Steg 2" },
          { id: "knowledge-test", title: "Kunnskapsprøve" },
        ],
        new Set(["step-1"]),
        prerequisites,
      ),
    ).toEqual({ id: "step-2", title: "Steg 2" });
  });
});
