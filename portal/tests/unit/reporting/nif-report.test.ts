import { describe, expect, it } from "vitest";

import {
  buildNifWorksheetXml,
  expandNifCourseDays,
  generateNifReport,
  type NifReportInput,
} from "@/features/reporting/nif-report";

const reportInput: NifReportInput = {
  courseName: "Trener 3",
  courseIds: ["19021785", "19021847 (praksis)"],
  organizerName: "Norges Golfforbund",
  sessions: [
    {
      id: "session-1",
      title: "Samling 1",
      startsAt: "2027-02-03T09:00:00+01:00",
      endsAt: "2027-02-03T16:00:00+01:00",
      plannedMinutes: 420,
    },
    {
      id: "session-2",
      title: "Samling 2",
      startsAt: "2027-03-12T09:00:00+01:00",
      endsAt: "2027-03-14T16:00:00+01:00",
      plannedMinutes: 1_260,
    },
  ],
  participants: [
    {
      displayName: "Ada Nordmann",
      email: "ada@example.no",
      phone: "+47 900 00 001",
      attendanceBySession: {
        "session-1": { plannedMinutes: 420, presentMinutes: 420 },
        "session-2": { plannedMinutes: 1_260, presentMinutes: 1_008 },
      },
    },
    {
      displayName: "Bo Eksempel",
      email: "bo@example.no",
      phone: null,
      attendanceBySession: {
        "session-1": { plannedMinutes: 420, presentMinutes: 0 },
      },
    },
  ],
};

describe("NIF annual report", () => {
  it("expands multi-day gatherings into one NIF course-day column per date", () => {
    const days = expandNifCourseDays(reportInput.sessions);

    expect(days.map((day) => day.date)).toEqual([
      "2027-02-03",
      "2027-03-12",
      "2027-03-13",
      "2027-03-14",
    ]);
    expect(days.map((day) => day.courseDayNumber)).toEqual([1, 2, 3, 4]);
  });

  it("writes participant identity and objective attendance marks into the sheet", () => {
    const xml = buildNifWorksheetXml(reportInput);

    expect(xml).toContain("Oppmøteliste for gjennomført kurs");
    expect(xml).toContain("Ada Nordmann");
    expect(xml).toContain("ada@example.no");
    expect(xml).toContain(">x<");
    expect(xml).toContain(">o<");
    expect(xml).toContain(">80 %<");
    expect(xml).toContain("SUM(");
  });

  it("creates a deterministic Excel workbook", () => {
    const first = generateNifReport(reportInput);
    const second = generateNifReport(reportInput);

    expect(new TextDecoder().decode(first.slice(0, 2))).toBe("PK");
    expect(second).toEqual(first);
  });
});
