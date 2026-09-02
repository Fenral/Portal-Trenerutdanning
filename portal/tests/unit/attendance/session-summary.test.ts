import { describe, expect, it } from "vitest";

import { summarizeSessionAttendance } from "@/features/attendance/session-summary";

describe("summarizeSessionAttendance", () => {
  it("counts registered records and absence per session", () => {
    const summary = summarizeSessionAttendance([
      { sessionId: "s1", plannedMinutes: 420, presentMinutes: 420 },
      { sessionId: "s1", plannedMinutes: 420, presentMinutes: 0 },
      { sessionId: "s2", plannedMinutes: 420, presentMinutes: 420 },
    ]);

    expect(summary.get("s1")).toEqual({ registered: 2, withAbsence: 1 });
    expect(summary.get("s2")).toEqual({ registered: 1, withAbsence: 0 });
  });

  it("counts partial absence as absence, not full presence", () => {
    const summary = summarizeSessionAttendance([
      { sessionId: "s1", plannedMinutes: 420, presentMinutes: 210 },
    ]);

    expect(summary.get("s1")).toEqual({ registered: 1, withAbsence: 1 });
  });

  it("returns no entry for sessions without records", () => {
    const summary = summarizeSessionAttendance([]);

    expect(summary.size).toBe(0);
  });
});
