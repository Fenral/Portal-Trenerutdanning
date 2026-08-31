import Link from "next/link";

import { loadTeacherParticipants } from "@/features/attendance/teacher-data";
import { participantProgressSignal } from "@/features/demo/participants";
import { createSupabaseServerClient } from "@/lib/supabase/server";

import styles from "./participants.module.css";

export const dynamic = "force-dynamic";

export default async function TeacherParticipantsPage() {
  const client = await createSupabaseServerClient();
  const participants = await loadTeacherParticipants(client);

  return (
    <main className={styles.page} id="main-content">
      <header className={styles.hero}>
        <div>
          <p className={styles.eyebrow}>Deltakerprogresjon</p>
          <h1>Deltakere</h1>
          <p>Åpne en deltaker for å følge progresjon og føre oppmøte.</p>
        </div>
        <strong>{participants.length} deltakere</strong>
      </header>

      <section aria-label="Deltakerliste" className={styles.participantList}>
        {participants.map((participant) => {
          const signal = participantProgressSignal(
            participant.progressPercentage,
          );

          return (
            <article
              className={styles.participantRow}
              key={participant.enrollmentId}
            >
              <div>
                <strong>{participant.studentName}</strong>
                <small>
                  {participant.clubName} · {participant.courseTitle}
                </small>
              </div>
              <span data-tone={signal.tone}>{signal.label}</span>
              <div className={styles.metric}>
                <small>Progresjon</small>
                <strong>{participant.progressPercentage} %</strong>
              </div>
              <div className={styles.metric}>
                <small>Oppmøte</small>
                <strong>{participant.attendancePercentage} %</strong>
              </div>
              <Link
                aria-label={`Åpne ${participant.studentName}`}
                className="nivaa-button nivaa-button--secondary"
                href={`/teacher/participants/${participant.enrollmentId}`}
              >
                Åpne
              </Link>
            </article>
          );
        })}
      </section>
    </main>
  );
}
