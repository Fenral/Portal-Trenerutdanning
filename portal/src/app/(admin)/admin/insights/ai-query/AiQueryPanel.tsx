"use client";

import { useActionState } from "react";

import type { AdminQueryIntentName } from "@/features/admin-query/intents";
import { formatOsloDateTime } from "@/features/reporting/report-meta";

import { runAdminQueryAction, type AdminQueryState } from "./actions";
import styles from "./page.module.css";

export type CourseOption = Readonly<{ id: string; label: string }>;

const QUESTIONS: ReadonlyArray<
  Readonly<{
    intent: AdminQueryIntentName;
    label: string;
    needsCourse: boolean;
  }>
> = [
  {
    intent: "completed_count",
    label: "Hvor mange har fullført?",
    needsCourse: true,
  },
  { intent: "cohort_average", label: "Hva er kullsnittet?", needsCourse: true },
  {
    intent: "student_progress",
    label: "Hvor langt har hver deltaker kommet?",
    needsCourse: true,
  },
  {
    intent: "missing_assignments",
    label: "Hvem mangler innleveringer?",
    needsCourse: true,
  },
  {
    intent: "attendance_status",
    label: "Hvordan ligger oppmøtet an?",
    needsCourse: true,
  },
  {
    intent: "practice_status",
    label: "Hvordan ligger praksisen an?",
    needsCourse: true,
  },
  {
    intent: "t1_location_distribution",
    label: "Hvordan fordeler Trener 1 seg per kurssted?",
    needsCourse: false,
  },
];

function ReadOnlyBadge() {
  return (
    <span className={styles.readOnlyBadge}>
      <svg aria-hidden="true" viewBox="0 0 24 24">
        <rect height="9" rx="1.5" width="14" x="5" y="10.5" />
        <path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5M12 14v2.5" />
      </svg>
      Skrivebeskyttet
    </span>
  );
}

export function AiQueryPanel({
  courses,
  openAiConfigured,
}: {
  courses: readonly CourseOption[];
  openAiConfigured: boolean;
}) {
  const [state, formAction, isPending] = useActionState<
    AdminQueryState,
    FormData
  >(runAdminQueryAction, { status: "idle" });

  return (
    <section aria-labelledby="ai-query-heading" className={styles.aiPanel}>
      <header className={styles.aiPanelHeader}>
        <div>
          <p className={styles.aiEyebrow}>Datapilot · objektive spørsmål</p>
          <h2 id="ai-query-heading">Spør om kursdata</h2>
          <p className={styles.aiIntro}>
            Hvert spørsmål kjører en fast, godkjent spørring med samme
            definisjoner som rapportene. Ingenting kan endres herfra.
          </p>
        </div>
        <ReadOnlyBadge />
      </header>

      <form action={formAction} className={styles.aiForm}>
        <div className={styles.courseField}>
          <label htmlFor="ai-query-course">Kurs</label>
          <select
            defaultValue={courses[0]?.id}
            id="ai-query-course"
            name="courseRunId"
          >
            {courses.map((course) => (
              <option key={course.id} value={course.id}>
                {course.label}
              </option>
            ))}
          </select>
          <p className={styles.fieldHint}>
            Brukes av alle spørsmål unntatt Trener 1-fordelingen.
          </p>
        </div>

        <fieldset className={styles.questionSet}>
          <legend>Forhåndsdefinerte spørsmål</legend>
          <div className={styles.questionButtons}>
            {QUESTIONS.map((question) => (
              <button
                className={styles.questionButton}
                disabled={isPending}
                key={question.intent}
                name="intent"
                type="submit"
                value={question.intent}
              >
                {question.label}
              </button>
            ))}
          </div>
        </fieldset>

        <div className={styles.freeTextField}>
          <label htmlFor="ai-query-freetext">Eget spørsmål</label>
          <input
            disabled
            id="ai-query-freetext"
            placeholder="Naturlig språk kommer"
            type="text"
          />
          <p className={styles.fieldHint}>
            {openAiConfigured
              ? "Tolkning av naturlig språk aktiveres i en senere versjon."
              : "Kommer: krever at OPENAI_API_KEY er konfigurert. Spørsmål i naturlig språk oversettes da til de samme faste spørringene ovenfor — aldri til fri SQL."}
          </p>
        </div>
      </form>

      <div aria-live="polite" className={styles.answerRegion}>
        {isPending ? <p className={styles.pending}>Henter svar …</p> : null}

        {!isPending && state.status === "error" ? (
          <p className={styles.errorNote} role="alert">
            <span aria-hidden="true">✕</span> {state.message}
          </p>
        ) : null}

        {!isPending && state.status === "answered" ? (
          <article className={styles.answer}>
            <header className={styles.answerHeader}>
              <div>
                <p className={styles.answerEyebrow}>Tolket spørsmål</p>
                <h3>{state.answer.interpretedQuestion}</h3>
              </div>
              <ReadOnlyBadge />
            </header>

            <p className={styles.headline}>{state.answer.result.headline}</p>

            <dl className={styles.answerMeta}>
              <div>
                <dt>Aktive filtre</dt>
                <dd>{state.answer.activeFilters.join(" · ")}</dd>
              </div>
              <div>
                <dt>Definisjon:</dt>
                <dd>
                  {state.answer.formula} (versjon {state.answer.formulaVersion})
                </dd>
              </div>
              <div>
                <dt>Kilde</dt>
                <dd>
                  {state.answer.definitionLabel} · hentet{" "}
                  {formatOsloDateTime(state.answer.sourceTimestamp)}
                </dd>
              </div>
              <div>
                <dt>Antall deltakere</dt>
                <dd>{state.answer.participantCount}</dd>
              </div>
            </dl>

            {state.answer.result.rows.length > 0 ? (
              <div className={styles.tableScroll} tabIndex={0}>
                <table>
                  <thead>
                    <tr>
                      {state.answer.result.columns.map((column) => (
                        <th key={column} scope="col">
                          {column}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {state.answer.result.rows.map((row, rowIndex) => (
                      <tr key={rowIndex}>
                        {row.map((cell, cellIndex) => (
                          <td key={cellIndex}>{cell}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}
          </article>
        ) : null}
      </div>
    </section>
  );
}
