import { describe, expect, it } from "vitest";

import { buildCourseTimeline } from "@/features/learning/course-timeline";

const now = new Date("2026-09-01T10:00:00Z");

const sessions = [
  {
    id: "s1",
    title: "Samling 1",
    startsAt: new Date("2026-02-15T08:00:00Z"),
    endsAt: new Date("2026-02-15T16:00:00Z"),
  },
  {
    id: "s2",
    title: "Samling 2",
    startsAt: new Date("2026-03-13T08:00:00Z"),
    endsAt: new Date("2026-03-15T16:00:00Z"),
  },
  {
    id: "s4",
    title: "Samling 4",
    startsAt: new Date("2026-09-20T08:00:00Z"),
    endsAt: new Date("2026-09-20T16:00:00Z"),
  },
];

describe("buildCourseTimeline", () => {
  it("sorts sessions and deadlines by date and places the now marker", () => {
    const view = buildCourseTimeline(
      sessions,
      [
        {
          activityId: "a1",
          title: "Innlevering 1",
          deadline: new Date("2026-08-20T22:00:00Z"),
          completed: true,
        },
      ],
      now,
    );

    expect(view.events.map((event) => event.id)).toEqual([
      "session-s1",
      "session-s2",
      "deadline-a1",
      "session-s4",
    ]);
    expect(view.nowIndex).toBe(3);
  });

  it("marks past sessions done, future upcoming and missed deadlines overdue", () => {
    const view = buildCourseTimeline(
      sessions,
      [
        {
          activityId: "a1",
          title: "Innlevering 1",
          deadline: new Date("2026-08-20T22:00:00Z"),
          completed: false,
        },
      ],
      now,
    );

    const states = Object.fromEntries(
      view.events.map((event) => [event.id, event.state]),
    );
    expect(states["session-s1"]).toBe("done");
    expect(states["session-s4"]).toBe("upcoming");
    expect(states["deadline-a1"]).toBe("overdue");
  });

  it("formats single-day and multi-day dates in Norwegian", () => {
    const view = buildCourseTimeline(sessions, [], now);
    const labels = Object.fromEntries(
      view.events.map((event) => [event.id, event.dateLabel]),
    );
    expect(labels["session-s1"]).toBe("15. feb.");
    expect(labels["session-s2"]).toBe("13.–15. mars");
  });

  it("links deadlines to the assignment and sessions to anchors", () => {
    const view = buildCourseTimeline(
      sessions,
      [
        {
          activityId: "a1",
          title: "Innlevering 1",
          deadline: new Date("2026-11-01T22:00:00Z"),
          completed: false,
        },
      ],
      now,
    );

    const hrefs = Object.fromEntries(
      view.events.map((event) => [event.id, event.href]),
    );
    expect(hrefs["deadline-a1"]).toBe("/student/assignments/a1");
    expect(hrefs["session-s1"]).toBe("#session-s1");
  });
});
