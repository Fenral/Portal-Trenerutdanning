import { describe, expect, it } from "vitest";

import type { CourseRunView } from "@/features/courses/portfolio";
import { buildT1List, sortsBySecondSession } from "@/features/courses/t1-list";

function run(
  id: string,
  locationName: string,
  s1: string,
  s2: string,
  youthDrive = false,
): CourseRunView {
  const sessions = [
    {
      id: `${id}-s1`,
      title: "Samling 1",
      startsAt: `${s1}T08:00:00Z`,
      endsAt: `${s1}T16:00:00Z`,
      locationText: null,
      sortOrder: 1,
      sessionType: "regular" as const,
      isRequired: true,
    },
    {
      id: `${id}-s2`,
      title: "Samling 2",
      startsAt: `${s2}T08:00:00Z`,
      endsAt: `${s2}T16:00:00Z`,
      locationText: null,
      sortOrder: 2,
      sessionType: "regular" as const,
      isRequired: true,
    },
  ];

  if (youthDrive) {
    sessions.push({
      id: `${id}-yd`,
      title: "Ungdomsdriven",
      startsAt: "2026-07-01T08:00:00Z",
      endsAt: "2026-07-03T16:00:00Z",
      locationText: null,
      sortOrder: 3,
      sessionType: "youth_drive" as unknown as "regular",
      isRequired: false,
    });
  }

  return {
    id,
    templateCode: "T1",
    title: `Trener 1 ${locationName}`,
    startYear: 2026,
    displayYear: "2026",
    locationName,
    sessions,
  };
}

const runs = [
  run("oslo", "Oslo GK", "2026-05-29", "2026-09-19", true),
  run("onsoy", "Onsøy GK", "2026-04-10", "2026-09-05", true),
  run("fana", "Fana GK", "2026-04-24", "2026-09-12"),
];

const counts = new Map([
  ["oslo", 14],
  ["onsoy", 12],
]);

describe("buildT1List", () => {
  it("sorts by session 1 before 15 July and includes counts and dates", () => {
    const rows = buildT1List(runs, counts, new Date("2026-06-01T12:00:00Z"));
    const courses = rows.filter((row) => row.kind === "course");

    expect(courses.map((row) => row.locationName)).toEqual([
      "Onsøy GK",
      "Fana GK",
      "Oslo GK",
    ]);
    expect(courses[0]).toMatchObject({
      participantCount: 12,
      session1Label: "10. apr.",
      session2Label: "5. sep.",
    });
    expect(courses[2].participantCount).toBe(14);
  });

  it("sorts by session 2 after 15 July", () => {
    const rows = buildT1List(runs, counts, new Date("2026-08-01T12:00:00Z"));
    const courses = rows.filter((row) => row.kind === "course");

    expect(courses.map((row) => row.locationName)).toEqual([
      "Onsøy GK",
      "Fana GK",
      "Oslo GK",
    ]);
  });

  it("extracts one youth drive row placed chronologically", () => {
    const rows = buildT1List(runs, counts, new Date("2026-06-01T12:00:00Z"));
    const youthIndex = rows.findIndex((row) => row.kind === "youth_drive");

    expect(rows.filter((row) => row.kind === "youth_drive")).toHaveLength(1);
    expect(rows[youthIndex]).toMatchObject({ dateLabel: "1.–3. juli" });
    // 1. juli ligger etter alle vårsamlingene og før høstsamlingene
    expect(youthIndex).toBe(3);
  });

  it("flips the sort cutoff at 15 July in the course year", () => {
    expect(sortsBySecondSession(2026, new Date("2026-07-15T12:00:00Z"))).toBe(
      false,
    );
    expect(sortsBySecondSession(2026, new Date("2026-07-16T12:00:00Z"))).toBe(
      true,
    );
    expect(sortsBySecondSession(2027, new Date("2026-08-01T12:00:00Z"))).toBe(
      false,
    );
  });
});
