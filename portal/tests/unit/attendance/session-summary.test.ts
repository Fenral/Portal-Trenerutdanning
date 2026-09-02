import { describe, expect, it } from "vitest";

import { summarizeSessionAttendance } from "@/features/attendance/session-summary";

describe("summarizeSessionAttendance", () => {
  it("counts registered records and present participants per session", () => {
    const summary = summarizeSessionAttendance([
      { sessionId: "s1", presentMinutes: 420 },
      { sessionId: "s1", presentMinutes: 0 },
      { sessionId: "s2", presentMinutes: 60 },
    ]);

    expect(summary.get("s1")).toEqual({ registered: 2, present: 1 });
    expect(summary.get("s2")).toEqual({ registered: 1, present: 1 });
  });

  it("returns no entry for sessions without records", () => {
    const summary = summarizeSessionAttendance([]);

    expect(summary.size).toBe(0);
  });
});
