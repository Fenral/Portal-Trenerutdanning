import Link from "next/link";

import { loadTeacherAssignmentQueue } from "@/features/assessment/assignments/teacher-data";
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

export default async function TeacherPage() {
  const client = await createSupabaseServerClient();
  const queue = await loadTeacherAssignmentQueue(client);

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
          <strong>{queue.length}</strong>
          <span>til vurdering</span>
          {queue[0] ? (
            <Link
              aria-label={`Start øverst i køen: ${queue[0].studentName} – ${queue[0].activityTitle}`}
              className="nivaa-button nivaa-button--primary"
              href={`/teacher/assignments/${queue[0].submissionId}`}
            >
              Start øverst i køen
            </Link>
          ) : null}
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
                  aria-label={`Vurder ${item.studentName}, ${item.clubName}, ${item.activityTitle}, versjon ${item.versionNumber} ${item.courseTitle}, ${statusLabel(item.status)}, ${dateFormatter.format(new Date(item.updatedAt))}`}
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
    </main>
  );
}
