import Link from "next/link";
import { notFound } from "next/navigation";

import { loadTeacherPractice } from "@/features/practice/teacher-data";
import { createSupabaseServerClient } from "@/lib/supabase/server";

import styles from "../../teacher.module.css";
import { reviewPracticeAction } from "./actions";

export const dynamic = "force-dynamic";

type PageProps = Readonly<{
  params: Promise<{ submissionId: string }>;
  searchParams: Promise<{ notice?: string }>;
}>;

const dateFormatter = new Intl.DateTimeFormat("nb-NO", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Europe/Oslo",
});

const dayFormatter = new Intl.DateTimeFormat("nb-NO", {
  dateStyle: "medium",
  timeZone: "Europe/Oslo",
});

function formatDuration(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return remainder === 0 ? `${hours} t` : `${hours} t ${remainder} min`;
}

function statusLabel(status: string): string {
  if (status === "approved_manual") return "Godkjent manuelt";
  if (status === "approved_auto") return "Automatisk godkjent";
  if (status === "revision_required") return "Må utbedres";
  return "Venter på oppfølging";
}

export default async function TeacherPracticePage({
  params,
  searchParams,
}: PageProps) {
  const [{ submissionId }, query] = await Promise.all([params, searchParams]);
  const client = await createSupabaseServerClient();
  const practice = await loadTeacherPractice(client, submissionId);
  if (!practice) notFound();

  const canApprove =
    practice.status === "submitted" &&
    practice.approvalMode === "manual_review";
  const canRequestRevision = practice.status === "submitted";
  const canSpotCheck =
    practice.status === "approved_auto" ||
    practice.status === "approved_manual";

  return (
    <main className={styles.page} id="main-content">
      <Link className={styles.backLink} href="/teacher">
        ← Til vurderingskøen
      </Link>

      <header className={styles.detailHero}>
        <div>
          <p className={styles.eyebrow}>
            Praksis · versjon {practice.versionNumber}
          </p>
          <h1>{practice.studentName}</h1>
          <p>
            {practice.clubName} · {practice.courseTitle}
          </p>
        </div>
        <span
          className={styles.detailStatus}
          data-status={practice.status}
          role="status"
        >
          {statusLabel(practice.status)}
        </span>
      </header>

      {query.notice === "error" ? (
        <p className={styles.notice} role="alert">
          Vurderingen kunne ikke lagres. Kontroller kommentaren og prøv igjen.
        </p>
      ) : null}

      <div className={styles.detailLayout}>
        <div className={styles.detailMain}>
          <section className={styles.versions}>
            <div className={styles.sectionHeading}>
              <div>
                <p className={styles.eyebrow}>Frosset timeliste</p>
                <h2>{practice.activityTitle}</h2>
              </div>
              <span>{formatDuration(practice.totalMinutes)} totalt</span>
            </div>
            <ol>
              {practice.entries.map((entry) => (
                <li key={entry.id}>
                  <div>
                    <strong>{entry.description}</strong>
                    <span>
                      {entry.category === "planning"
                        ? "Planlegging"
                        : "Gjennomføring"}{" "}
                      · {formatDuration(entry.minutes)}
                    </span>
                    <time dateTime={entry.occurredOn}>
                      {dayFormatter.format(
                        new Date(`${entry.occurredOn}T12:00:00Z`),
                      )}
                    </time>
                  </div>
                </li>
              ))}
            </ol>
          </section>

          <section className={styles.reviewHistory}>
            <div className={styles.sectionHeading}>
              <div>
                <p className={styles.eyebrow}>Sporbarhet</p>
                <h2>Hendelser</h2>
              </div>
            </div>
            <ol>
              {practice.events.map((event) => (
                <li key={event.id}>
                  <strong>{statusLabel(event.type)}</strong>
                  {event.reason ? <p>{event.reason}</p> : null}
                  <time dateTime={event.occurredAt}>
                    {dateFormatter.format(new Date(event.occurredAt))}
                  </time>
                </li>
              ))}
            </ol>
          </section>
        </div>

        <aside className={styles.reviewPanel}>
          <p className={styles.eyebrow}>Vurdering</p>
          <h2>Følg opp praksisen</h2>
          <p className={styles.deadlineText}>
            Planlegging: {formatDuration(practice.planningMinutes)} · Øvrig
            praksis:{" "}
            {formatDuration(practice.totalMinutes - practice.planningMinutes)}
          </p>

          {canApprove || canRequestRevision || canSpotCheck ? (
            <form action={reviewPracticeAction} className={styles.reviewForm}>
              <input
                name="submissionId"
                type="hidden"
                value={practice.submissionId}
              />
              <label>
                <span>Kommentar</span>
                <textarea maxLength={4000} name="comment" required rows={6} />
              </label>
              <div className={styles.reviewActions}>
                {canApprove ? (
                  <button
                    className="nivaa-button nivaa-button--primary"
                    name="intent"
                    type="submit"
                    value="approve"
                  >
                    Godkjenn praksis
                  </button>
                ) : null}
                {canRequestRevision ? (
                  <button
                    className="nivaa-button nivaa-button--secondary"
                    name="intent"
                    type="submit"
                    value="request_revision"
                  >
                    Be om utbedring
                  </button>
                ) : null}
                {canSpotCheck ? (
                  <button
                    className="nivaa-button nivaa-button--secondary"
                    name="intent"
                    type="submit"
                    value="spot_check_revoke"
                  >
                    Underkjenn etter stikkprøve
                  </button>
                ) : null}
              </div>
            </form>
          ) : (
            <p className={styles.closedReview}>
              Studenten må sende inn en utbedret versjon før ny vurdering.
            </p>
          )}
        </aside>
      </div>
    </main>
  );
}
