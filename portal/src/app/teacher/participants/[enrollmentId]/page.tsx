import Link from "next/link";
import { notFound } from "next/navigation";

import { loadTeacherParticipant } from "@/features/attendance/teacher-data";
import { createSupabaseServerClient } from "@/lib/supabase/server";

import { recordAttendanceAction } from "../actions";
import styles from "../participants.module.css";

export const dynamic = "force-dynamic";

type PageProps = Readonly<{
  params: Promise<{ enrollmentId: string }>;
  searchParams: Promise<{ notice?: string }>;
}>;

const dateFormatter = new Intl.DateTimeFormat("nb-NO", {
  dateStyle: "medium",
  timeZone: "Europe/Oslo",
});

export default async function TeacherParticipantPage({
  params,
  searchParams,
}: PageProps) {
  const [{ enrollmentId }, query] = await Promise.all([params, searchParams]);
  const client = await createSupabaseServerClient();
  const participant = await loadTeacherParticipant(client, enrollmentId);
  if (!participant) notFound();

  return (
    <main className={styles.page} id="main-content">
      <Link className={styles.backLink} href="/teacher/participants">
        ← Alle deltakere
      </Link>
      <header className={styles.profileHero}>
        <div>
          <p className={styles.eyebrow}>{participant.courseTitle}</p>
          <h1>{participant.studentName}</h1>
          <p>{participant.clubName}</p>
        </div>
        <div className={styles.profileMetrics}>
          <span>
            <small>Progresjon</small>
            <strong>{participant.progressPercentage} %</strong>
          </span>
          <span>
            <small>Oppmøte</small>
            <strong>{participant.attendancePercentage} % oppmøte</strong>
          </span>
        </div>
      </header>

      {query.notice ? (
        <p
          className={styles.notice}
          role={query.notice === "attendance-saved" ? "status" : "alert"}
        >
          {query.notice === "attendance-saved"
            ? "Oppmøtet er lagret."
            : "Oppmøtet kunne ikke lagres. Kontroller minuttene."}
        </p>
      ) : null}

      <section className={styles.sessionSection}>
        <div>
          <p className={styles.eyebrow}>80 prosent kreves</p>
          <h2>Oppmøte per samling</h2>
        </div>
        <ol>
          {participant.sessions.map((session) => (
            <li key={session.id}>
              <div className={styles.sessionHeading}>
                <span>
                  <strong>{session.title}</strong>
                  <time dateTime={session.startsAt}>
                    {dateFormatter.format(new Date(session.startsAt))}
                  </time>
                </span>
                <span data-recorded={session.recorded || undefined}>
                  {session.recorded ? "Registrert" : "Ikke registrert"}
                </span>
              </div>
              <form
                action={recordAttendanceAction}
                className={styles.attendanceForm}
              >
                <input name="enrollmentId" type="hidden" value={enrollmentId} />
                <input name="sessionId" type="hidden" value={session.id} />
                <label>
                  <span>Planlagte minutter</span>
                  <input
                    defaultValue={session.plannedMinutes}
                    min="1"
                    name="plannedMinutes"
                    required
                    type="number"
                  />
                </label>
                <label>
                  <span>Tilstede minutter</span>
                  <input
                    defaultValue={session.presentMinutes}
                    min="0"
                    name="presentMinutes"
                    required
                    type="number"
                  />
                </label>
                <input
                  name="reason"
                  type="hidden"
                  value="Registrert etter samling"
                />
                <button
                  className="nivaa-button nivaa-button--secondary"
                  type="submit"
                >
                  Lagre oppmøte for {session.title}
                </button>
              </form>
            </li>
          ))}
        </ol>
      </section>
    </main>
  );
}
