import { randomUUID } from "node:crypto";

import { notFound } from "next/navigation";

import { loadStudentLearningPath } from "@/features/learning/student-learning-data";
import { loadStudentPractice } from "@/features/practice/data";
import styles from "@/features/practice/practice.module.css";
import { createSupabaseServerClient } from "@/lib/supabase/server";

import { addPracticeEntryAction, submitPracticeAction } from "./actions";

export const dynamic = "force-dynamic";

type PageProps = Readonly<{
  searchParams: Promise<{ notice?: string }>;
}>;

const dateFormatter = new Intl.DateTimeFormat("nb-NO", {
  dateStyle: "medium",
  timeZone: "Europe/Oslo",
});

function formatDuration(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return remainder === 0 ? `${hours} t` : `${hours} t ${remainder} min`;
}

function noticeCopy(notice: string | undefined): string | null {
  if (notice === "entry-added") return "Praksistimene er lagt til.";
  if (notice === "submitted") return "Praksisen er sendt til godkjenning.";
  if (notice === "planning-limit")
    return "Planlegging kan utgjøre maksimalt 9 av 45 timer.";
  if (notice === "duration") return "Skriv inn en gyldig varighet.";
  if (notice === "date") return "Datoen kan ikke være frem i tid.";
  if (notice === "incomplete")
    return "Du må registrere minst 45 timer før du kan sende inn.";
  if (notice === "entry-error")
    return "Timene kunne ikke legges til. Kontroller feltene og prøv igjen.";
  if (notice === "submit-error")
    return "Praksisen kunne ikke sendes inn. Prøv igjen.";
  return null;
}

export default async function StudentPracticePage({ searchParams }: PageProps) {
  const [client, query] = await Promise.all([
    createSupabaseServerClient(),
    searchParams,
  ]);
  const learningPath = await loadStudentLearningPath(client);
  const activity = learningPath?.activities.find(
    (candidate) => candidate.activityType === "practice",
  );
  if (!learningPath || !activity) notFound();

  let practice;
  try {
    practice = await loadStudentPractice(client, activity.id);
  } catch {
    notFound();
  }

  const requiredHours = practice.requiredMinutes / 60;
  const totalHours = practice.totalMinutes / 60;
  const progress = Math.min(
    100,
    Math.round((practice.totalMinutes / practice.requiredMinutes) * 100),
  );
  const canLog =
    practice.status === null || practice.status === "revision_required";
  const latestSubmission = practice.submissions[0];
  const latestFeedback = latestSubmission?.events.find((event) => event.reason);
  const notice = noticeCopy(query.notice);

  return (
    <main className={styles.page} id="main-content">
      <header className={styles.hero}>
        <div>
          <p className={styles.eyebrow}>{learningPath.courseTitle}</p>
          <h1>Praksis</h1>
          <p>
            Registrer planlegging og gjennomføring fortløpende. Du kan sende inn
            når minst 45 timer er registrert.
          </p>
        </div>
        <div className={styles.heroProgress}>
          <strong>
            {Number.isInteger(totalHours) ? totalHours : totalHours.toFixed(1)}{" "}
            av {requiredHours} timer
          </strong>
          <span>{progress} % registrert</span>
        </div>
      </header>

      {practice.status ? (
        <section className={styles.statusCard} data-status={practice.status}>
          <span aria-hidden="true">
            {practice.status.startsWith("approved") ? "✓" : "→"}
          </span>
          <div>
            <p className={styles.eyebrow}>Status</p>
            <h2>
              {practice.status === "submitted"
                ? "Sendt til godkjenning"
                : practice.status === "revision_required"
                  ? "Praksisen må utbedres"
                  : "Praksisen er godkjent"}
            </h2>
            <p>
              {practice.status === "submitted"
                ? "Timelisten er mottatt. Du får beskjed når vurderingen er klar."
                : practice.status === "revision_required"
                  ? (latestFeedback?.reason ??
                    "Les tilbakemeldingen, registrer det som mangler og send inn på nytt.")
                  : "Kravet er fullført og progresjonen din er oppdatert."}
            </p>
          </div>
        </section>
      ) : null}

      {notice ? (
        <p
          className={styles.notice}
          data-success={
            query.notice === "entry-added" || query.notice === "submitted"
              ? true
              : undefined
          }
          role={
            query.notice === "entry-added" || query.notice === "submitted"
              ? "status"
              : "alert"
          }
        >
          {notice}
        </p>
      ) : null}

      <section className={styles.progressCard} aria-labelledby="progress-title">
        <div className={styles.progressHeading}>
          <div>
            <p className={styles.eyebrow}>45-timerskravet</p>
            <h2 id="progress-title">Din registrerte praksis</h2>
          </div>
          <strong>{progress} %</strong>
        </div>
        <div
          aria-label={`${progress} prosent av praksiskravet registrert`}
          aria-valuemax={100}
          aria-valuemin={0}
          aria-valuenow={progress}
          className={styles.progressTrack}
          role="progressbar"
        >
          <span style={{ width: `${progress}%` }} />
        </div>
        <dl className={styles.totals}>
          <div>
            <dt>Gjennomføring</dt>
            <dd>{formatDuration(practice.deliveryMinutes)}</dd>
          </div>
          <div>
            <dt>Planlegging</dt>
            <dd>
              {formatDuration(practice.planningMinutes)} av maks{" "}
              {formatDuration(practice.maxPlanningMinutes)}
            </dd>
          </div>
          <div>
            <dt>Gjenstår</dt>
            <dd>
              {formatDuration(
                Math.max(0, practice.requiredMinutes - practice.totalMinutes),
              )}
            </dd>
          </div>
        </dl>
      </section>

      <div className={styles.layout}>
        <div className={styles.mainColumn}>
          {canLog ? (
            <section className={styles.formCard}>
              <p className={styles.eyebrow}>Ny registrering</p>
              <h2>Legg til praksistimer</h2>
              <form
                action={addPracticeEntryAction}
                className={styles.entryForm}
              >
                <input
                  name="activityId"
                  type="hidden"
                  value={practice.activityId}
                />
                <input
                  name="enrollmentId"
                  type="hidden"
                  value={practice.enrollmentId}
                />
                <input
                  name="idempotencyKey"
                  type="hidden"
                  value={randomUUID()}
                />
                <label>
                  <span>Dato</span>
                  <input name="occurredOn" required type="date" />
                </label>
                <label>
                  <span>Type praksis</span>
                  <select name="category" required>
                    <option value="delivery">Gjennomføring</option>
                    <option value="planning">Planlegging</option>
                  </select>
                </label>
                <div className={styles.durationFields}>
                  <label>
                    <span>Timer</span>
                    <input min="0" name="hours" required type="number" />
                  </label>
                  <label>
                    <span>Minutter</span>
                    <input
                      defaultValue="0"
                      max="59"
                      min="0"
                      name="minutePart"
                      required
                      type="number"
                    />
                  </label>
                </div>
                <label className={styles.descriptionField}>
                  <span>Beskrivelse</span>
                  <textarea
                    maxLength={2000}
                    name="description"
                    placeholder="Hva planla eller gjennomførte du?"
                    required
                    rows={4}
                  />
                </label>
                <button
                  className="nivaa-button nivaa-button--secondary"
                  type="submit"
                >
                  Legg til timer
                </button>
              </form>
            </section>
          ) : null}

          <section className={styles.entriesCard}>
            <div className={styles.sectionHeading}>
              <div>
                <p className={styles.eyebrow}>Timeliste</p>
                <h2>Registrerte aktiviteter</h2>
              </div>
              <span>{practice.entries.length} registreringer</span>
            </div>
            {practice.entries.length === 0 ? (
              <p>Ingen timer er registrert ennå.</p>
            ) : (
              <ol>
                {practice.entries.map((entry) => (
                  <li key={entry.id}>
                    <span className={styles.entryDate}>
                      {dateFormatter.format(
                        new Date(`${entry.occurredOn}T12:00:00Z`),
                      )}
                    </span>
                    <span>
                      <strong>{entry.description}</strong>
                      <small>
                        {entry.category === "planning"
                          ? "Planlegging"
                          : "Gjennomføring"}
                      </small>
                    </span>
                    <strong>{formatDuration(entry.minutes)}</strong>
                  </li>
                ))}
              </ol>
            )}
          </section>
        </div>

        <aside className={styles.submitCard}>
          <p className={styles.eyebrow}>Når du er klar</p>
          <h2>Send inn samlet timeliste</h2>
          <p>
            Timelisten fryses som en versjon når du sender inn. Du kan sende en
            ny versjon dersom kurslæreren ber om utbedring.
          </p>
          {canLog ? (
            <form action={submitPracticeAction}>
              <input
                name="activityId"
                type="hidden"
                value={practice.activityId}
              />
              <input
                name="enrollmentId"
                type="hidden"
                value={practice.enrollmentId}
              />
              <button
                className="nivaa-button nivaa-button--primary"
                disabled={!practice.canSubmit}
                type="submit"
              >
                {practice.status === "revision_required"
                  ? "Send praksis på nytt"
                  : "Send praksis til godkjenning"}
              </button>
              {!practice.canSubmit ? (
                <small>
                  Registrer{" "}
                  {formatDuration(
                    Math.max(
                      0,
                      practice.requiredMinutes - practice.totalMinutes,
                    ),
                  )}{" "}
                  til før innsending.
                </small>
              ) : null}
            </form>
          ) : (
            <p className={styles.lockedMessage}>
              Timelisten er låst mens den er til vurdering.
            </p>
          )}
        </aside>
      </div>
    </main>
  );
}
