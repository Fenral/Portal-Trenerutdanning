import Link from "next/link";

import { loadTeacherPracticeQueue } from "@/features/practice/teacher-data";
import { createSupabaseServerClient } from "@/lib/supabase/server";

import styles from "../teacher.module.css";

export const dynamic = "force-dynamic";

const dateFormatter = new Intl.DateTimeFormat("nb-NO", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Europe/Oslo",
});

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

export default async function TeacherPracticeQueuePage() {
  const client = await createSupabaseServerClient();
  const practiceQueue = await loadTeacherPracticeQueue(client);

  return (
    <main className={styles.page} id="main-content">
      <header className={styles.hero}>
        <div>
          <p className={styles.eyebrow}>Elektronisk timeliste</p>
          <h1>Praksis til oppfølging</h1>
          <p>
            Innsendte timelister fra deltakerne. Hver rad viser siste versjon og
            konkret status.
          </p>
        </div>
        <div className={styles.queueCount}>
          <strong>{practiceQueue.length}</strong>
          <span>deltakere</span>
        </div>
      </header>

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
                  aria-label={`Følg opp ${item.studentName} – ${item.activityTitle}, ${practiceStatusLabel(item.status)}, ${dateFormatter.format(new Date(item.submittedAt))}`}
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
