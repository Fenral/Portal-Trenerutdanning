import Link from "next/link";
import { notFound } from "next/navigation";

import { loadStudentContent } from "@/features/content/student-data";
import { ContentRenderer } from "@/features/learning/ContentRenderer";
import { loadStudentActivity } from "@/features/learning/student-learning-data";
import { StudentResources } from "@/features/learning/StudentResources";
import { createSupabaseServerClient } from "@/lib/supabase/server";

import { completeActivityAction } from "./actions";
import styles from "./page.module.css";

export const dynamic = "force-dynamic";

type PageProps = Readonly<{
  params: Promise<{ courseRunId: string; activityId: string }>;
  searchParams: Promise<{ completion?: string }>;
}>;

function missingMessage(titles: readonly string[]): string {
  if (titles.length === 1) return `Fullfør ${titles[0]} først`;
  if (titles.length === 2) return `Fullfør ${titles[0]} og ${titles[1]} først`;

  return `Fullfør ${titles.slice(0, -1).join(", ")} og ${titles.at(-1)} først`;
}

const verifiedCompletionCopy = {
  quiz_pass: "Resultatet registreres automatisk når prøven er bestått.",
  submission_approved:
    "Aktiviteten fullføres når kurslæreren har godkjent innleveringen.",
  practice_approved:
    "Aktiviteten fullføres når kurslæreren har godkjent praksisen.",
  attendance_met:
    "Aktiviteten fullføres når oppmøtekravet er registrert som oppfylt.",
} as const;

export default async function StudentActivityPage({
  params,
  searchParams,
}: PageProps) {
  const [{ courseRunId, activityId }, query] = await Promise.all([
    params,
    searchParams,
  ]);
  const client = await createSupabaseServerClient();
  const result = await loadStudentActivity(client, courseRunId, activityId);

  if (!result) notFound();

  const { activity, learningPath } = result;
  const backHref = `/student/courses/${courseRunId}`;

  if (activity.access.state === "locked") {
    const message = missingMessage(
      activity.access.missing.map((missing) => missing.title),
    );

    return (
      <main className={styles.page} id="main-content">
        <Link className={styles.backLink} href={backHref}>
          ← Til læringsløpet
        </Link>
        <section className={styles.locked} aria-labelledby="activity-title">
          <span aria-hidden="true" className={styles.lockIcon}>
            ⌑
          </span>
          <p className={styles.eyebrow}>{activity.moduleTitle}</p>
          <h1 id="activity-title">{activity.title}</h1>
          <p className={styles.lockReason}>{message}</p>
          <p>
            Når kravet er oppfylt, åpnes aktiviteten automatisk i læringsløpet
            ditt.
          </p>
          <Link className="nivaa-button nivaa-button--primary" href={backHref}>
            Se hva som gjenstår
          </Link>
        </section>
      </main>
    );
  }

  const content = activity.contentItemId
    ? await loadStudentContent(client, activity.contentItemId, courseRunId)
    : null;
  const firstHeading = content?.document.blocks.find(
    (block) => block.type === "heading",
  );
  const heading =
    firstHeading?.type === "heading" ? firstHeading.text : activity.title;
  const canSelfComplete =
    activity.completionMode === "manual" ||
    activity.completionMode === "reach_end";
  const verifiedCopy = canSelfComplete
    ? null
    : verifiedCompletionCopy[activity.completionMode];

  return (
    <main className={styles.page} id="main-content">
      <Link className={styles.backLink} href={backHref}>
        ← Til læringsløpet
      </Link>

      <header className={styles.hero}>
        <div>
          <p className={styles.eyebrow}>
            {activity.moduleTitle} · {learningPath.courseTitle}
          </p>
          <h1>{heading}</h1>
          <p>
            {activity.completed
              ? "Aktiviteten er fullført. Du kan fortsatt gå gjennom innholdet."
              : (activity.description ??
                "Gå gjennom innholdet i ditt eget tempo.")}
          </p>
        </div>
        <div
          className={styles.activityStatus}
          data-completed={activity.completed}
        >
          <span aria-hidden="true">{activity.completed ? "✓" : "→"}</span>
          <div>
            <small>Status</small>
            <strong>{activity.completed ? "Fullført" : "Pågår"}</strong>
          </div>
        </div>
      </header>

      {query.completion === "success" ? (
        <p className={styles.successMessage} role="status">
          Aktiviteten er registrert som fullført.
        </p>
      ) : null}
      {query.completion === "error" ? (
        <p className={styles.errorMessage} role="alert">
          Fullføringen kunne ikke registreres. Last siden på nytt og prøv igjen.
        </p>
      ) : null}

      <div className={styles.contentGrid}>
        <div className={styles.mainColumn}>
          {content ? (
            <article className={styles.lesson}>
              <ContentRenderer document={content.document} />
            </article>
          ) : (
            <section className={styles.verifiedActivity}>
              <p className={styles.eyebrow}>Registrert aktivitet</p>
              <h2>{activity.title}</h2>
              <p>{verifiedCopy}</p>
            </section>
          )}

          <section
            className={styles.completion}
            aria-labelledby="completion-title"
          >
            <div>
              <p className={styles.eyebrow}>Fremdrift</p>
              <h2 id="completion-title">
                {activity.completed
                  ? "Aktiviteten er fullført"
                  : "Ferdig med aktiviteten?"}
              </h2>
              <p>
                {activity.completed
                  ? "Progresjonen er oppdatert i hele læringsløpet."
                  : canSelfComplete
                    ? "Registrer aktiviteten når du har gått gjennom hele innholdet."
                    : verifiedCopy}
              </p>
            </div>
            {!activity.completed && canSelfComplete ? (
              <form action={completeActivityAction}>
                <input name="courseRunId" type="hidden" value={courseRunId} />
                <input name="activityId" type="hidden" value={activity.id} />
                <input
                  name="enrollmentId"
                  type="hidden"
                  value={learningPath.enrollmentId}
                />
                <input
                  name="contentRevisionId"
                  type="hidden"
                  value={activity.contentRevisionId ?? ""}
                />
                <button
                  className="nivaa-button nivaa-button--primary"
                  type="submit"
                >
                  Marker som fullført
                </button>
              </form>
            ) : null}
          </section>
        </div>

        {content ? <StudentResources resources={content.resources} /> : null}
      </div>
    </main>
  );
}
