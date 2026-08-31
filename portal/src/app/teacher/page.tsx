import Link from "next/link";

import { loadTeacherAssignmentQueue } from "@/features/assessment/assignments/teacher-data";
import { loadTeacherPracticeQueue } from "@/features/practice/teacher-data";
import { createSupabaseServerClient } from "@/lib/supabase/server";

import styles from "./teacher.module.css";

export const dynamic = "force-dynamic";

const dateFormatter = new Intl.DateTimeFormat("nb-NO", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Europe/Oslo",
});

function statusLabel(status: string): string {
  if (status === "revision_required") return "Må utbedres";
  return "Venter på vurdering";
}

function practiceStatusLabel(status: string): string {
  if (status === "revision_required") return "Må utbedres";
  if (status === "approved_auto") return "Kan stikkprøves";
  if (status === "approved_manual") return "Godkjent";
  return "Venter på oppfølging";
}

function formatDuration(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return remainder === 0 ? `${hours} t` : `${hours} t ${remainder} min`;
}

export default async function TeacherPage() {
  const client = await createSupabaseServerClient();
  const [queue, practiceQueue] = await Promise.all([
    loadTeacherAssignmentQueue(client),
    loadTeacherPracticeQueue(client),
  ]);

  return (
    <main className={styles.page} id="main-content">
      <header className={styles.hero}>
        <div>
          <p className={styles.eyebrow}>Vurderinger</p>
          <h1>Innleveringer til vurdering</h1>
          <p>
            Start med nye og utbedrede innleveringer. Hver rad viser siste
            versjon og konkret status.
          </p>
        </div>
        <div className={styles.queueCount}>
          <strong>{queue.length + practiceQueue.length}</strong>
          <span>til oppfølging</span>
        </div>
      </header>

      <section className={styles.queue} aria-label="Vurderingskø">
        {queue.length === 0 ? (
          <div className={styles.empty}>
            <h2>Ingen innleveringer venter</h2>
            <p>Nye innleveringer vises her automatisk.</p>
          </div>
        ) : (
          <ol>
            {queue.map((item, index) => (
              <li key={item.submissionId}>
                <Link
                  aria-label={`Vurder ${item.studentName} – ${item.activityTitle}`}
                  href={`/teacher/assignments/${item.submissionId}`}
                >
                  <span className={styles.index} aria-hidden="true">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <span className={styles.student}>
                    <strong>{item.studentName}</strong>
                    <small>{item.clubName}</small>
                  </span>
                  <span className={styles.assignment}>
                    <strong>{item.activityTitle}</strong>
                    <small>
                      Versjon {item.versionNumber} · {item.courseTitle}
                    </small>
                  </span>
                  <span className={styles.status} data-status={item.status}>
                    {statusLabel(item.status)}
                  </span>
                  <time dateTime={item.updatedAt}>
                    {dateFormatter.format(new Date(item.updatedAt))}
                  </time>
                  <span aria-hidden="true" className={styles.arrow}>
                    →
                  </span>
                </Link>
              </li>
            ))}
          </ol>
        )}
      </section>

      <div className={styles.queueHeading}>
        <div>
          <p className={styles.eyebrow}>Elektronisk timeliste</p>
          <h2>Praksis til oppfølging</h2>
        </div>
        <span>{practiceQueue.length} deltakere</span>
      </div>

      <section className={styles.queue} aria-label="Praksis til oppfølging">
        {practiceQueue.length === 0 ? (
          <div className={styles.empty}>
            <h2>Ingen praksisinnsendinger ennå</h2>
            <p>Innsendte timelister vises her automatisk.</p>
          </div>
        ) : (
          <ol>
            {practiceQueue.map((item, index) => (
              <li key={item.submissionId}>
                <Link
                  aria-label={`Følg opp ${item.studentName} – ${item.activityTitle}`}
                  href={`/teacher/practice/${item.submissionId}`}
                >
                  <span className={styles.index} aria-hidden="true">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <span className={styles.student}>
                    <strong>{item.studentName}</strong>
                    <small>{item.clubName}</small>
                  </span>
                  <span className={styles.assignment}>
                    <strong>{formatDuration(item.totalMinutes)}</strong>
                    <small>
                      Versjon {item.versionNumber} · {item.courseTitle}
                    </small>
                  </span>
                  <span className={styles.status} data-status={item.status}>
                    {practiceStatusLabel(item.status)}
                  </span>
                  <time dateTime={item.submittedAt}>
                    {dateFormatter.format(new Date(item.submittedAt))}
                  </time>
                  <span aria-hidden="true" className={styles.arrow}>
                    →
                  </span>
                </Link>
              </li>
            ))}
          </ol>
        )}
      </section>
    </main>
  );
}
