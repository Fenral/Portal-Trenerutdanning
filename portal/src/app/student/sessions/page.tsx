import {
  loadStudentIdentity,
  loadStudentSessionResources,
} from "@/features/content/student-data";
import { CourseSessions } from "@/features/learning/CourseSessions";
import cardStyles from "@/features/learning/CourseSessions.module.css";
import { ResourceLinkList } from "@/features/learning/StudentResources";
import { loadCourseSessionInfos } from "@/features/learning/course-timeline-data";
import { groupSessionResources } from "@/features/learning/session-resources";
import { createSupabaseServerClient } from "@/lib/supabase/server";

import styles from "./page.module.css";

export default async function StudentSessionsPage() {
  const client = await createSupabaseServerClient();
  const identity = await loadStudentIdentity(client);

  if (!identity.courseRunId) {
    return (
      <main className={styles.page} id="main-content">
        <header className={styles.header}>
          <span className={styles.eyebrow}>Kursplan</span>
          <h1>Samlinger</h1>
          <p>Samlingene dukker opp her når du er meldt inn i et kurs.</p>
        </header>
      </main>
    );
  }

  const [sessions, resources] = await Promise.all([
    loadCourseSessionInfos(client, identity.courseRunId),
    loadStudentSessionResources(client, identity.courseRunId),
  ]);
  const grouped = groupSessionResources(sessions, resources);

  return (
    <main className={styles.page} id="main-content">
      <header className={styles.header}>
        <span className={styles.eyebrow}>{identity.courseTitle}</span>
        <h1>Samlinger</h1>
        <p>
          Her finner du presentasjoner og andre filer som hører til hver samling
          i kurset.
        </p>
      </header>

      {grouped.sessions.length === 0 && grouped.shared.length === 0 ? (
        <section
          aria-labelledby="sessions-empty-title"
          className={styles.emptyState}
        >
          <span aria-hidden="true">◇</span>
          <h2 id="sessions-empty-title">Ingen samlinger er lagt inn ennå</h2>
          <p>
            Når kurslæreren planlegger samlinger og publiserer filer, finner du
            dem her.
          </p>
        </section>
      ) : (
        <div className={styles.cards}>
          <CourseSessions sessions={grouped.sessions} />

          {grouped.shared.length ? (
            <section
              aria-labelledby="shared-resources-title"
              className={cardStyles.card}
            >
              <header className={cardStyles.head}>
                <div className={cardStyles.copy}>
                  <h2 id="shared-resources-title">Felles for kurset</h2>
                </div>
                <div className={cardStyles.meta}>
                  <span>
                    {grouped.shared.length}{" "}
                    {grouped.shared.length === 1 ? "fil" : "filer"}
                  </span>
                </div>
              </header>
              <ResourceLinkList resources={grouped.shared} />
            </section>
          ) : null}
        </div>
      )}
    </main>
  );
}
