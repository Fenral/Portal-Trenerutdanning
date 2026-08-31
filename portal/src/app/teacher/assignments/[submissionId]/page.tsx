import Link from "next/link";
import { notFound } from "next/navigation";

import { loadTeacherAssignment } from "@/features/assessment/assignments/teacher-data";
import { createSupabaseServerClient } from "@/lib/supabase/server";

import styles from "../../teacher.module.css";
import { reviewAssignmentAction } from "./actions";

export const dynamic = "force-dynamic";

type PageProps = Readonly<{
  params: Promise<{ submissionId: string }>;
  searchParams: Promise<{ notice?: string }>;
}>;

const dateFormatter = new Intl.DateTimeFormat("nb-NO", {
  dateStyle: "long",
  timeStyle: "short",
  timeZone: "Europe/Oslo",
});

function statusLabel(status: string): string {
  if (status === "revision_required") return "Må utbedres";
  if (status === "approved") return "Godkjent";
  if (status === "graded") return "Vurdert";
  return "Venter på vurdering";
}

export default async function TeacherAssignmentPage({
  params,
  searchParams,
}: PageProps) {
  const [{ submissionId }, query] = await Promise.all([params, searchParams]);
  const client = await createSupabaseServerClient();
  const assignment = await loadTeacherAssignment(client, submissionId);
  if (!assignment) notFound();
  const canReview = assignment.status === "submitted";

  return (
    <main className={styles.page} id="main-content">
      <Link className={styles.backLink} href="/teacher">
        ← Til vurderingskøen
      </Link>

      <header className={styles.detailHero}>
        <div>
          <p className={styles.eyebrow}>{assignment.courseTitle}</p>
          <h1>{assignment.studentName}</h1>
          <p>
            {assignment.clubName} · {assignment.activityTitle}
          </p>
        </div>
        <span className={styles.detailStatus} data-status={assignment.status}>
          {statusLabel(assignment.status)}
        </span>
      </header>

      {query.notice === "error" ? (
        <p className={styles.notice} role="alert">
          Vurderingen kunne ikke lagres. Kontroller feltene og prøv igjen.
        </p>
      ) : null}

      <div className={styles.detailLayout}>
        <div className={styles.detailMain}>
          <section className={styles.versions}>
            <div className={styles.sectionHeading}>
              <div>
                <p className={styles.eyebrow}>Dokumentasjon</p>
                <h2>Innleverte versjoner</h2>
              </div>
              <span>{assignment.versions.length} versjoner</span>
            </div>
            <ol>
              {assignment.versions.map((version) => (
                <li key={version.id}>
                  <div>
                    <strong>Versjon {version.versionNumber}</strong>
                    <time dateTime={version.submittedAt}>
                      {dateFormatter.format(new Date(version.submittedAt))}
                    </time>
                  </div>
                  {version.note ? <p>{version.note}</p> : null}
                  {version.attachments.map((attachment) => (
                    <a
                      href={`/resources/${attachment.id}?download=1`}
                      key={attachment.id}
                    >
                      Last ned {attachment.filename}
                    </a>
                  ))}
                </li>
              ))}
            </ol>
          </section>

          {assignment.reviews.length > 0 ? (
            <section className={styles.reviewHistory}>
              <p className={styles.eyebrow}>Tidligere vurderinger</p>
              <ol>
                {assignment.reviews.map((review) => (
                  <li key={review.id}>
                    <strong>{review.comment}</strong>
                    <time dateTime={review.reviewedAt}>
                      {dateFormatter.format(new Date(review.reviewedAt))}
                    </time>
                  </li>
                ))}
              </ol>
            </section>
          ) : null}
        </div>

        <aside className={styles.reviewPanel}>
          <p className={styles.eyebrow}>Vurdering</p>
          <h2>
            {assignment.assessmentScale === "pass_fail"
              ? "Godkjent / ikke godkjent"
              : "Karakter A–F"}
          </h2>
          <p className={styles.deadlineText}>
            Frist:{" "}
            {dateFormatter.format(new Date(assignment.effectiveDeadline))}
          </p>

          {canReview ? (
            <form action={reviewAssignmentAction} className={styles.reviewForm}>
              <input
                name="submissionId"
                type="hidden"
                value={assignment.submissionId}
              />
              <label>
                <span>Tilbakemelding</span>
                <textarea maxLength={4000} name="comment" required rows={6} />
              </label>
              <div className={styles.deadlineFields}>
                <label>
                  <span>Ny frist</span>
                  <input name="newDeadline" type="datetime-local" />
                </label>
                <label>
                  <span>Begrunnelse for ny frist</span>
                  <input maxLength={1000} name="deadlineReason" type="text" />
                </label>
              </div>
              <div className={styles.reviewActions}>
                <button
                  className="nivaa-button nivaa-button--secondary"
                  name="intent"
                  type="submit"
                  value="request_revision"
                >
                  Be om utbedring
                </button>
                <button
                  className="nivaa-button nivaa-button--primary"
                  name="intent"
                  type="submit"
                  value="approve"
                >
                  Godkjenn
                </button>
              </div>
            </form>
          ) : (
            <p className={styles.closedReview}>
              {assignment.status === "revision_required"
                ? "Studenten kan nå sende inn en utbedret versjon."
                : "Denne vurderingen er avsluttet."}
            </p>
          )}
        </aside>
      </div>
    </main>
  );
}
