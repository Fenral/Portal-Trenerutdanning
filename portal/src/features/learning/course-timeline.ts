export type TimelineSessionInput = Readonly<{
  id: string;
  title: string;
  startsAt: Date;
  endsAt: Date;
}>;

export type TimelineDeadlineInput = Readonly<{
  activityId: string;
  title: string;
  deadline: Date;
  completed: boolean;
}>;

export type TimelineEvent = Readonly<{
  id: string;
  kind: "session" | "deadline";
  title: string;
  dateLabel: string;
  href: string;
  state: "done" | "upcoming" | "overdue";
}>;

export type CourseTimelineView = Readonly<{
  events: readonly TimelineEvent[];
  /** Antall hendelser som ligger før «nå»; 0..events.length. */
  nowIndex: number;
  todayLabel: string;
}>;

const DAY_MONTH = new Intl.DateTimeFormat("nb-NO", {
  day: "numeric",
  month: "short",
  timeZone: "Europe/Oslo",
});

const DAY_ONLY = new Intl.DateTimeFormat("nb-NO", {
  day: "numeric",
  timeZone: "Europe/Oslo",
});

const FULL_DATE = new Intl.DateTimeFormat("nb-NO", {
  day: "numeric",
  month: "long",
  timeZone: "Europe/Oslo",
});

const OSLO_YEAR = new Intl.DateTimeFormat("nb-NO", {
  year: "numeric",
  timeZone: "Europe/Oslo",
});

function stripTrailingDot(value: string): string {
  return value.replace(/\.$/, "");
}

function withYear(label: string, date: Date, referenceYear: string): string {
  const year = OSLO_YEAR.format(date);
  return year === referenceYear ? label : `${label} ${year}`;
}

export function sessionDateLabel(
  startsAt: Date,
  endsAt: Date,
  reference: Date = startsAt,
): string {
  const referenceYear = OSLO_YEAR.format(reference);
  const startLabel = DAY_MONTH.format(startsAt);
  const sameDay = DAY_MONTH.format(startsAt) === DAY_MONTH.format(endsAt);

  if (sameDay) return withYear(startLabel, startsAt, referenceYear);

  return withYear(
    `${stripTrailingDot(DAY_ONLY.format(startsAt))}.–${DAY_MONTH.format(endsAt)}`,
    startsAt,
    referenceYear,
  );
}

export function buildCourseTimeline(
  sessions: readonly TimelineSessionInput[],
  deadlines: readonly TimelineDeadlineInput[],
  now: Date,
): CourseTimelineView {
  const entries: { sortAt: Date; event: TimelineEvent }[] = [];

  for (const session of sessions) {
    entries.push({
      sortAt: session.startsAt,
      event: {
        id: `session-${session.id}`,
        kind: "session",
        title: session.title,
        dateLabel: sessionDateLabel(session.startsAt, session.endsAt, now),
        href: `/student/sessions#session-${session.id}`,
        state: session.endsAt.getTime() < now.getTime() ? "done" : "upcoming",
      },
    });
  }

  for (const deadline of deadlines) {
    entries.push({
      sortAt: deadline.deadline,
      event: {
        id: `deadline-${deadline.activityId}`,
        kind: "deadline",
        title: deadline.title,
        dateLabel: withYear(
          DAY_MONTH.format(deadline.deadline),
          deadline.deadline,
          OSLO_YEAR.format(now),
        ),
        href: `/student/assignments/${deadline.activityId}`,
        state: deadline.completed
          ? "done"
          : deadline.deadline.getTime() < now.getTime()
            ? "overdue"
            : "upcoming",
      },
    });
  }

  entries.sort((left, right) => left.sortAt.getTime() - right.sortAt.getTime());

  return {
    events: entries.map((entry) => entry.event),
    nowIndex: entries.filter((entry) => entry.sortAt.getTime() <= now.getTime())
      .length,
    todayLabel: FULL_DATE.format(now),
  };
}
