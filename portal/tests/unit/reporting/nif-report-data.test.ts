import { describe, expect, it } from "vitest";

import {
  buildNifReportInput,
  nifCourseIdsForTemplate,
} from "@/features/reporting/nif-report-data";

describe("NIF report data", () => {
  it("uses the registered NIF course and practice identifiers for Trener 3", () => {
    expect(nifCourseIdsForTemplate("T3")).toEqual([
      "19021785",
      "19021847 (praksis)",
    ]);
  });

  it("excludes withdrawn participants and maps attendance without names leaking from templates", () => {
    const result = buildNifReportInput({
      course: {
        title: "Trener 3 · 2027–2028",
        templateCode: "T3",
        templateTitle: "Trener 3",
      },
      sessions: [
        {
          id: "session-1",
          title: "Samling 1",
          starts_at: "2027-02-03T09:00:00+01:00",
          ends_at: "2027-02-03T16:00:00+01:00",
          session_type: "regular",
          is_required: true,
        },
      ],
      enrollments: [
        {
          id: "enrollment-active",
          profile_id: "profile-active",
          status: "active",
        },
        {
          id: "enrollment-withdrawn",
          profile_id: "profile-withdrawn",
          status: "withdrawn",
        },
      ],
      profiles: [
        {
          id: "profile-active",
          display_name: "Ada Nordmann",
          normalized_email: "ada@example.no",
          phone: "+47 900 00 001",
        },
        {
          id: "profile-withdrawn",
          display_name: "Skal Ikke Med",
          normalized_email: "withdrawn@example.no",
          phone: null,
        },
      ],
      attendance: [
        {
          enrollment_id: "enrollment-active",
          session_id: "session-1",
          planned_minutes: 420,
          present_minutes: 420,
        },
      ],
    });

    expect(result.participants).toHaveLength(1);
    expect(result.participants[0]).toMatchObject({
      displayName: "Ada Nordmann",
      attendanceBySession: {
        "session-1": { plannedMinutes: 420, presentMinutes: 420 },
      },
    });
    expect(result.sessions[0].plannedMinutes).toBe(420);
  });
});
