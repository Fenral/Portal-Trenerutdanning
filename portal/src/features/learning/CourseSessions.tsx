import type { CourseSessionInfo } from "./course-timeline-data";

import styles from "./CourseSessions.module.css";

export function CourseSessions({
  sessions,
}: Readonly<{ sessions: readonly CourseSessionInfo[] }>) {
  if (sessions.length === 0) return null;

  return (
    <section aria-labelledby="course-sessions-title" className={styles.card}>
      <h2 id="course-sessions-title">Samlinger</h2>
      <ul className={styles.list}>
        {sessions.map((session) => (
          <li id={`session-${session.id}`} key={session.id}>
            <div className={styles.copy}>
              <strong>{session.title}</strong>
              {session.isYouthDrive ? (
                <span className={styles.youthDrive}>Ungdomsdriven</span>
              ) : null}
            </div>
            <div className={styles.meta}>
              <span>{session.dateLabel}</span>
              {session.locationText ? (
                <small>{session.locationText}</small>
              ) : null}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
