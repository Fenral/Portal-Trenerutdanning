import type { StudentResourceView } from "@/features/content/student-data";

import type { CourseSessionInfo } from "./course-timeline-data";
import { ResourceLinkList } from "./StudentResources";

import styles from "./CourseSessions.module.css";

export type SessionWithResources = Readonly<{
  session: CourseSessionInfo;
  resources: readonly StudentResourceView[];
}>;

export function CourseSessions({
  sessions,
}: Readonly<{ sessions: readonly SessionWithResources[] }>) {
  if (sessions.length === 0) return null;

  return (
    <>
      {sessions.map(({ session, resources }) => (
        <section
          aria-labelledby={`session-title-${session.id}`}
          className={styles.card}
          id={`session-${session.id}`}
          key={session.id}
        >
          <header className={styles.head}>
            <div className={styles.copy}>
              <h2 id={`session-title-${session.id}`}>{session.title}</h2>
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
          </header>
          {resources.length ? (
            <ResourceLinkList resources={resources} />
          ) : (
            <p className={styles.noFiles}>
              Filer til samlingen publiseres av kurslæreren.
            </p>
          )}
        </section>
      ))}
    </>
  );
}
