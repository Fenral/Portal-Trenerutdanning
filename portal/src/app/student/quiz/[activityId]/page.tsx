import { randomUUID } from "node:crypto";

import Link from "next/link";
import { notFound } from "next/navigation";

import {
  loadLatestStudentQuizAttempt,
  loadStudentQuiz,
} from "@/features/assessment/quiz";
import { createSupabaseServerClient } from "@/lib/supabase/server";

import { submitQuizAction } from "./actions";
import styles from "./page.module.css";

export const dynamic = "force-dynamic";

type PageProps = Readonly<{
  params: Promise<{ activityId: string }>;
  searchParams: Promise<{ notice?: string }>;
}>;

const dateTimeFormatter = new Intl.DateTimeFormat("nb-NO", {
  dateStyle: "long",
  timeStyle: "short",
  timeZone: "Europe/Oslo",
});

function attemptCopy(attemptsUsed: number, maxAttempts: number | null): string {
  if (maxAttempts === null) {
    return `${attemptsUsed} gjennomført · ubegrenset antall forsøk`;
  }

  return `${attemptsUsed} av ${maxAttempts} forsøk brukt`;
}

export default async function StudentQuizPage({
  params,
  searchParams,
}: PageProps) {
  const [{ activityId }, query] = await Promise.all([params, searchParams]);
  const client = await createSupabaseServerClient();

  let quiz;

  try {
    quiz = await loadStudentQuiz(client, activityId);
  } catch {
    notFound();
  }

  const latestAttempt = await loadLatestStudentQuizAttempt(
    client,
    quiz.enrollmentId,
    quiz.quizDefinitionId,
  );
  const retryAt = quiz.nextAttemptAt ? new Date(quiz.nextAttemptAt) : null;
  const retryDelayed = Boolean(
    retryAt && Number.isFinite(retryAt.getTime()) && retryAt > new Date(),
  );
  const backHref = `/student/courses/${quiz.courseRunId}`;

  return (
    <main className={styles.page} id="main-content">
      <Link className={styles.backLink} href={backHref}>
        ← Til læringsløpet
      </Link>

      <header className={styles.hero}>
        <div>
          <p className={styles.eyebrow}>Avslutning · kunnskapsprøve</p>
          <h1>{quiz.title}</h1>
          <p>
            Svar på alle spørsmålene og lever samlet. Resultatet registreres
            automatisk i læringsløpet.
          </p>
        </div>
        <div className={styles.passMark}>
          <strong>{quiz.passPercent} %</strong>
          <span>kreves for bestått</span>
        </div>
      </header>

      {latestAttempt ? (
        <section
          className={styles.result}
          data-passed={latestAttempt.passed}
          aria-labelledby="result-title"
        >
          <span aria-hidden="true" className={styles.resultIcon}>
            {latestAttempt.passed ? "✓" : "↻"}
          </span>
          <div>
            <p className={styles.eyebrow}>Siste resultat</p>
            <h2 id="result-title">
              {latestAttempt.passed
                ? "Prøven er bestått"
                : "Prøven er ikke bestått ennå"}
            </h2>
            <p>
              {latestAttempt.earned} av {latestAttempt.possible} poeng ·{" "}
              {latestAttempt.percent} prosent riktig
            </p>
          </div>
        </section>
      ) : null}

      {query.notice === "incomplete" ? (
        <p className={styles.notice} role="alert">
          Svar på alle spørsmålene før du leverer.
        </p>
      ) : null}
      {query.notice === "error" ? (
        <p className={styles.notice} role="alert">
          Forsøket kunne ikke registreres. Last siden på nytt og prøv igjen.
        </p>
      ) : null}

      <div className={styles.layout}>
        <form action={submitQuizAction} className={styles.quizForm}>
          <input name="activityId" type="hidden" value={quiz.activityId} />
          <input name="enrollmentId" type="hidden" value={quiz.enrollmentId} />
          <input name="idempotencyKey" type="hidden" value={randomUUID()} />

          <ol className={styles.questionList}>
            {quiz.questions.map((question, index) => (
              <li key={question.id}>
                <fieldset className={styles.question}>
                  <legend>
                    <span aria-hidden="true" className={styles.questionNumber}>
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <span>{question.prompt}</span>
                  </legend>
                  <div className={styles.options}>
                    {question.options.map((option) => (
                      <label className={styles.option} key={option.id}>
                        <input
                          disabled={retryDelayed}
                          name={`answer:${question.id}`}
                          required
                          type="radio"
                          value={option.id}
                        />
                        <span aria-hidden="true" className={styles.radioMark} />
                        <span>{option.label}</span>
                      </label>
                    ))}
                  </div>
                </fieldset>
              </li>
            ))}
          </ol>

          <footer className={styles.submitBar}>
            <div>
              <strong>Kontroller svarene før du leverer</strong>
              <span>Alle {quiz.questions.length} spørsmål må besvares.</span>
            </div>
            <button
              className="nivaa-button nivaa-button--primary"
              disabled={retryDelayed}
              type="submit"
            >
              Lever svar <span aria-hidden="true">→</span>
            </button>
          </footer>
        </form>

        <aside className={styles.aside} aria-label="Rammer for prøven">
          <section>
            <p className={styles.eyebrow}>Rammer for prøven</p>
            <h2>Dette bør du vite</h2>
            <dl>
              <div>
                <dt>Spørsmål</dt>
                <dd>{quiz.questions.length}</dd>
              </div>
              <div>
                <dt>Bestått</dt>
                <dd>{quiz.passPercent} %</dd>
              </div>
              <div>
                <dt>Forsøk</dt>
                <dd>{quiz.maxAttempts ?? "Ubegrenset"}</dd>
              </div>
            </dl>
          </section>

          <section className={styles.attemptStatus}>
            <strong>{attemptCopy(quiz.attemptsUsed, quiz.maxAttempts)}</strong>
            {retryDelayed && retryAt ? (
              <p role="status">
                Nytt forsøk åpnes {dateTimeFormatter.format(retryAt)}.
              </p>
            ) : quiz.retryDelayHours > 0 ? (
              <p>
                Etter et ikke bestått forsøk må du vente {quiz.retryDelayHours}{" "}
                timer før du prøver igjen.
              </p>
            ) : (
              <p>Du kan prøve på nytt med en gang dersom du ikke består.</p>
            )}
          </section>
        </aside>
      </div>
    </main>
  );
}
