import Link from "next/link";
import type { CSSProperties } from "react";

import type { CourseTimelineView, TimelineEvent } from "./course-timeline";

import styles from "./CourseTimeline.module.css";

const stateLabels: Readonly<Record<TimelineEvent["state"], string>> = {
  done: "Gjennomført",
  upcoming: "Kommer",
  overdue: "Forfalt",
};

function DotIcon({ event }: { event: TimelineEvent }) {
  if (event.state === "done") {
    return (
      <svg aria-hidden="true" viewBox="0 0 16 16">
        <path d="M3 8.5 6.5 12 13 4.5" />
      </svg>
    );
  }

  if (event.state === "overdue") {
    return (
      <svg aria-hidden="true" viewBox="0 0 16 16">
        <path d="M8 4.5v4M8 11.5v.1" />
      </svg>
    );
  }

  if (event.kind === "deadline") {
    return (
      <svg aria-hidden="true" viewBox="0 0 16 16">
        <circle cx="8" cy="8" r="5.5" />
        <path d="M8 5v3l2 2" />
      </svg>
    );
  }

  return (
    <svg aria-hidden="true" viewBox="0 0 16 16">
      <circle cx="8" cy="8" r="3" />
    </svg>
  );
}

export function CourseTimeline({
  courseTitle,
  timeline,
}: Readonly<{ courseTitle: string; timeline: CourseTimelineView }>) {
  if (timeline.events.length === 0) return null;

  const nowFraction = timeline.nowIndex / timeline.events.length;
  const firstUpcomingIndex = timeline.events.findIndex(
    (event) => event.state === "upcoming",
  );
  const sessionCount = timeline.events.filter(
    (event) => event.kind === "session",
  ).length;
  const deadlineCount = timeline.events.length - sessionCount;

  return (
    <section aria-labelledby="course-timeline-title" className={styles.card}>
      <header className={styles.head}>
        <h2 id="course-timeline-title">Kursplan · {courseTitle}</h2>
        <small>
          {sessionCount} {sessionCount === 1 ? "samling" : "samlinger"}
          {deadlineCount > 0
            ? ` · ${deadlineCount} ${deadlineCount === 1 ? "frist" : "frister"}`
            : ""}
        </small>
      </header>
      <p className="nivaa-sr-only">I dag er det {timeline.todayLabel}.</p>

      <div className={styles.scroller}>
        <ol
          className={styles.rail}
          style={{ "--now-fraction": nowFraction } as CSSProperties}
        >
          <span aria-hidden="true" className={styles.nowMarker}>
            <span>Du er her</span>
          </span>
          {timeline.events.map((event, index) => (
            <li key={event.id}>
              <Link
                aria-current={index === firstUpcomingIndex ? "step" : undefined}
                className={styles.event}
                data-kind={event.kind}
                data-state={event.state}
                href={event.href}
              >
                <span className={styles.dot}>
                  <DotIcon event={event} />
                </span>
                <strong>{event.title}</strong>
                <small>
                  <span className="nivaa-sr-only">
                    {stateLabels[event.state]}:{" "}
                  </span>
                  {event.state === "overdue" ? "Forfalt " : ""}
                  {event.dateLabel}
                </small>
              </Link>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
