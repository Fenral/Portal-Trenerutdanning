import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ParticipantAttendanceView } from "@/app/teacher/participants/[enrollmentId]/attendance-editor";

function participantWith(presentMinutes: number) {
  return {
    courseTitle: "Trener 1",
    studentName: "Selma Student",
    clubName: "IL Test",
    progressPercentage: 50,
    sessions: [
      {
        id: "session-1",
        title: "Samling 1",
        startsAt: "2026-01-10T17:00:00Z",
        plannedMinutes: 600,
        presentMinutes,
        recorded: true,
      },
    ],
    modules: [],
  } as const;
}

describe("attendance status text", () => {
  it("states in text that the requirement is met, not color alone", () => {
    render(
      <ParticipantAttendanceView
        enrollmentId="enrollment-1"
        participant={participantWith(600)}
      />,
    );

    expect(screen.getByText(/krav oppfylt/i)).toBeVisible();
  });

  it("states in text that attendance is below the requirement", () => {
    render(
      <ParticipantAttendanceView
        enrollmentId="enrollment-1"
        participant={participantWith(0)}
      />,
    );

    expect(screen.getByText(/under kravet/i)).toBeVisible();
  });
});
