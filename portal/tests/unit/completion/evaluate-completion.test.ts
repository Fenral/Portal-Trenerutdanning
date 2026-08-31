import { describe, expect, it } from "vitest";

import {
  calculateAttendance,
  validateAttendanceOverride,
} from "@/features/attendance/percentage";
import { evaluateCompletion } from "@/features/completion/evaluate-completion";

describe("course completion", () => {
  it("requires 100 percent, 80 percent attendance, practice and university for T3", () => {
    expect(
      evaluateCompletion({
        level: 3,
        progress: 100,
        attendance: 79.9,
        practiceApproved: true,
        universityCompleted: true,
      }),
    ).toEqual({ complete: false, missing: ["attendance"], adminTasks: [] });
    expect(
      evaluateCompletion({
        level: 3,
        progress: 100,
        attendance: 80,
        practiceApproved: true,
        universityCompleted: true,
      }),
    ).toEqual({ complete: true, missing: [], adminTasks: [] });
  });

  it("never infers university completion for T2 or T3", () => {
    expect(
      evaluateCompletion({
        level: 2,
        progress: 100,
        attendance: 100,
        practiceApproved: true,
        universityCompleted: null,
      }),
    ).toEqual({ complete: false, missing: ["university"], adminTasks: [] });
  });

  it("does not block T1 completion on absent Youth Drive", () => {
    expect(
      evaluateCompletion({
        level: 1,
        progress: 100,
        attendance: 80,
        practiceApproved: true,
        universityCompleted: null,
        youthDriveSelected: true,
        youthDriveAttended: false,
      }),
    ).toEqual({
      complete: true,
      missing: [],
      adminTasks: ["invoice_youth_drive_difference"],
    });
  });

  it("compares the raw attendance ratio and rounds only for display", () => {
    const attendance = calculateAttendance([
      { plannedMinutes: 1000, presentMinutes: 799 },
    ]);
    expect(attendance.displayPercentage).toBe(80);
    expect(attendance.meetsRequirement).toBe(false);
  });

  it("requires administrator identity and reason for an override", () => {
    expect(() =>
      validateAttendanceOverride({ administratorId: "", reason: "Godkjent" }),
    ).toThrow("Administrator og begrunnelse er påkrevd");
    expect(
      validateAttendanceOverride({
        administratorId: "c0000000-0000-0000-0000-000000000001",
        reason: "Dokumentert gyldig fravær",
      }),
    ).toMatchObject({ reason: "Dokumentert gyldig fravær" });
  });
});
