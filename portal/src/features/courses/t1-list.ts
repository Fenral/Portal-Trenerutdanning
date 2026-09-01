import { sessionDateLabel } from "@/features/learning/course-timeline";

import type { CourseRunView, CourseSessionView } from "./portfolio";

export type T1CourseRow = Readonly<{
  kind: "course";
  runId: string;
  title: string;
  locationName: string;
  participantCount: number;
  session1Label: string | null;
  session2Label: string | null;
}>;

export type T1YouthDriveRow = Readonly<{
  kind: "youth_drive";
  dateLabel: string;
}>;

export type T1Row = T1CourseRow | T1YouthDriveRow;

function regularSessions(run: CourseRunView): CourseSessionView[] {
  return run.sessions
    .filter((session) => session.sessionType === "regular")
    .sort(
      (left, right) =>
        new Date(left.startsAt).getTime() - new Date(right.startsAt).getTime(),
    );
}

function labelFor(session: CourseSessionView | undefined): string | null {
  if (!session) return null;
  return sessionDateLabel(new Date(session.startsAt), new Date(session.endsAt));
}

/**
 * Frem til 15. juli i kursåret sorteres kursstedene kronologisk etter
 * samling 1; etter 15. juli etter samling 2 (høstsamlingen).
 */
export function sortsBySecondSession(startYear: number, now: Date): boolean {
  return now.getTime() > Date.UTC(startYear, 6, 15, 21, 59, 59);
}

export function buildT1List(
  runs: readonly CourseRunView[],
  participantCounts: ReadonlyMap<string, number>,
  now: Date,
): T1Row[] {
  const entries: { sortAt: number; row: T1Row }[] = [];
  let youthDrive: CourseSessionView | null = null;

  for (const run of runs) {
    const sessions = regularSessions(run);
    const bySecond = sortsBySecondSession(run.startYear, now);
    const sortSession = (bySecond ? sessions[1] : sessions[0]) ?? sessions[0];

    youthDrive ??=
      run.sessions.find((session) => session.sessionType === "youth_drive") ??
      null;

    entries.push({
      sortAt: sortSession ? new Date(sortSession.startsAt).getTime() : 0,
      row: {
        kind: "course",
        runId: run.id,
        title: run.title,
        locationName: run.locationName ?? run.title,
        participantCount: participantCounts.get(run.id) ?? 0,
        session1Label: labelFor(sessions[0]),
        session2Label: labelFor(sessions[1]),
      },
    });
  }

  if (youthDrive) {
    entries.push({
      sortAt: new Date(youthDrive.startsAt).getTime(),
      row: { kind: "youth_drive", dateLabel: labelFor(youthDrive) ?? "" },
    });
  }

  return entries
    .sort(
      (left, right) =>
        left.sortAt - right.sortAt ||
        (left.row.kind === "course" && right.row.kind === "course"
          ? left.row.locationName.localeCompare(right.row.locationName, "nb-NO")
          : 0),
    )
    .map((entry) => entry.row);
}
