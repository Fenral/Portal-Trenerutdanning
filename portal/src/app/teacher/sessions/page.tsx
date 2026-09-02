import Link from "next/link";

import { summarizeSessionAttendance } from "@/features/attendance/session-summary";
import { loadCourseSessionInfos } from "@/features/learning/course-timeline-data";
import cardStyles from "@/features/learning/CourseSessions.module.css";
import { createSupabaseServerClient } from "@/lib/supabase/server";

import styles from "../teacher.module.css";

export const dynamic = "force-dynamic";

export default async function TeacherSessionsPage() {
  const client = await createSupabaseServerClient();
  const { data: run, error: runError } = await client
    .from("course_runs")
    .select("id,title")
    .order("start_year", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (runError)
    throw new Error(`TEACHER_SESSIONS_QUERY_FAILED:${runError.message}`);

  const sessions = run ? await loadCourseSessionInfos(client, run.id) : [];
  const [enrollmentsResult, attendanceResult] = run
    ? await Promise.all([
        client
          .from("enrollments")
          .select("id")
          .eq("course_run_id", run.id)
          .neq("status", "withdrawn"),
        client
          .from("attendance_records")
          .select("session_id,present_minutes")
          .in(
            "session_id",
            sessions.map((session) => session.id),
          ),
      ])
    : [
        { data: [], error: null },
        { data: [], error: null },
      ];
  if (enrollmentsResult.error || attendanceResult.error) {
    throw new Error("TEACHER_SESSIONS_QUERY_FAILED");
  }

  const participantCount = (enrollmentsResult.data ?? []).length;
  const summaries = summarizeSessionAttendance(
    (attendanceResult.data ?? []).map((record) => ({
      sessionId: record.session_id,
      presentMinutes: record.present_minutes,
    })),
  );

  return (
    <main className={styles.page} id="main-content">
      <header className={styles.hero}>
        <div>
          <p className={styles.eyebrow}>{run?.title ?? "Kursplan"}</p>
          <h1>Samlinger</h1>
          <p>
            Oppmøtesammendrag per samling. Åpne deltakerlisten for å føre
            oppmøte på den enkelte.
          </p>
        </div>
        <div className={styles.queueCount}>
          <strong>{sessions.length}</strong>
          <span>samlinger</span>
        </div>
      </header>

      {sessions.length === 0 ? (
        <section className={styles.queue} aria-label="Samlinger">
          <div className={styles.empty}>
            <h2>Ingen samlinger er lagt inn ennå</h2>
            <p>Samlingene vises her når kursplanen er klar.</p>
          </div>
        </section>
      ) : (
        <div className={styles.cards}>
          {sessions.map((session) => {
            const summary = summaries.get(session.id);

            return (
              <section
                aria-labelledby={`session-title-${session.id}`}
                className={cardStyles.card}
                key={session.id}
              >
                <header className={cardStyles.head}>
                  <div className={cardStyles.copy}>
                    <h2 id={`session-title-${session.id}`}>{session.title}</h2>
                    {session.isYouthDrive ? (
                      <span className={cardStyles.youthDrive}>
                        Ungdomsdriven
                      </span>
                    ) : null}
                  </div>
                  <div className={cardStyles.meta}>
                    <span>{session.dateLabel}</span>
                    {session.locationText ? (
                      <small>{session.locationText}</small>
                    ) : null}
                  </div>
                </header>
                <p className={styles.sessionSummary}>
                  {summary
                    ? `✓ ${summary.present} av ${participantCount} deltakere tilstede · ${summary.registered} registrert`
                    : "◇ Oppmøte er ikke registrert ennå."}
                </p>
                <Link className={styles.cardLink} href="/teacher/participants">
                  Åpne deltakerlisten →
                </Link>
              </section>
            );
          })}
        </div>
      )}
    </main>
  );
}
