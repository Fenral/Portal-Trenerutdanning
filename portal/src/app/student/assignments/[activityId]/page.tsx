import Link from "next/link";
import { notFound } from "next/navigation";

import { loadStudentAssignment } from "@/features/assessment/assignments/submit";
import { createSupabaseServerClient } from "@/lib/supabase/server";

import { submitAssignmentAction } from "./actions";
import styles from "./page.module.css";

export const dynamic = "force-dynamic";

type PageProps = Readonly<{
  params: Promise<{ activityId: string }>;
  searchParams: Promise<{ notice?: string }>;
}>;

const dateFormatter = new Intl.DateTimeFormat("nb-NO", {
  dateStyle: "long",
  timeStyle: "short",
  timeZone: "Europe/Oslo",
});

const statusCopy = {
  draft: { title: "Kladd", tone: "neutral" },
  submitted: { title: "Sendt til vurdering", tone: "info" },
  revision_required: { title: "Må utbedres", tone: "warning" },
  approved: { title: "Godkjent", tone: "success" },
  graded: { title: "Vurdert", tone: "success" },
} as const;

function noticeCopy(notice: string | undefined): string | null {
  if (notice === "file-required") return "Velg et dokument før du sender inn.";
  if (notice === "file-type")
    return "Filtypen samsvarer ikke med innholdet i filen.";
  if (notice === "deadline")
    return "Fristen er utløpt. Be kurslæreren om en ny frist.";
  if (notice === "error")
    return "Innleveringen kunne ikke registreres. Prøv igjen.";
  if (notice === "submitted") return "Ny versjon er sendt til kurslæreren.";
  return null;
}

export default async function StudentAssignmentPage({
  params,
  searchParams,
}: PageProps) {
  const [{ activityId }, query] = await Promise.all([params, searchParams]);
  const client = await createSupabaseServerClient();

  let assignment;

  try {
    assignment = await loadStudentAssignment(client, activityId);
  } catch {
    notFound();
  }

  const status = assignment.status ? statusCopy[assignment.status] : null;
  const canSubmit =
    assignment.status === null ||
    assignment.status === "draft" ||
    assignment.status === "revision_required";
  const notice = noticeCopy(query.notice);
  const latestReview = assignment.reviews[0];

  return (
    <main className={styles.page} id="main-content">
      <Link
        className={styles.backLink}
        href={`/student/courses/${assignment.courseRunId}`}
      >
        ← Til læringsløpet
      </Link>

      <header className={styles.hero}>
        <div>
          <p className={styles.eyebrow}>Innlevering</p>
          <h1>{assignment.title}</h1>
          <p>{assignment.instructions}</p>
        </div>
        <div className={styles.deadline}>
          <span>Gjeldende frist</span>
          <strong>
            {dateFormatter.format(new Date(assignment.effectiveDeadline))}
          </strong>
        </div>
      </header>

      {status ? (
        <section className={styles.statusCard} data-tone={status.tone}>
          <span aria-hidden="true">
            {assignment.status === "approved" ? "✓" : "→"}
          </span>
          <div>
            <p className={styles.eyebrow}>Status</p>
            <h2>{status.title}</h2>
            <p>
              {assignment.status === "submitted"
                ? "Kurslæreren har mottatt dokumentet og vurderer det."
                : assignment.status === "revision_required"
                  ? "Les tilbakemeldingen, utbedre dokumentet og send inn en ny versjon."
                  : assignment.status === "approved"
                    ? "Arbeidskravet er godkjent og progresjonen er oppdatert."
                    : "Siste status for innleveringen din."}
            </p>
          </div>
        </section>
      ) : null}

      {notice ? (
        <p
          className={styles.notice}
          data-success={query.notice === "submitted" || undefined}
          role={query.notice === "submitted" ? "status" : "alert"}
        >
          {notice}
        </p>
      ) : null}

      <div className={styles.layout}>
        <div className={styles.mainColumn}>
          {latestReview ? (
            <section className={styles.feedback}>
              <p className={styles.eyebrow}>Tilbakemelding fra kurslærer</p>
              <blockquote>{latestReview.comment}</blockquote>
              <time dateTime={latestReview.reviewedAt}>
                {dateFormatter.format(new Date(latestReview.reviewedAt))}
              </time>
            </section>
          ) : null}

          {canSubmit ? (
            <form
              action={submitAssignmentAction}
              className={styles.uploadForm}
              encType="multipart/form-data"
            >
              <input
                name="activityId"
                type="hidden"
                value={assignment.activityId}
              />
              <input
                name="enrollmentId"
                type="hidden"
                value={assignment.enrollmentId}
              />
              <div>
                <p className={styles.eyebrow}>
                  {assignment.versions.length === 0
                    ? "Lever oppgaven"
                    : "Ny versjon"}
                </p>
                <h2>
                  {assignment.versions.length === 0
                    ? "Last opp dokumentet"
                    : "Last opp utbedret dokument"}
                </h2>
              </div>
              <label className={styles.fileField}>
                <span>Velg dokument</span>
                <input
                  accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx"
                  name="document"
                  required
                  type="file"
                />
                <small>PDF, Word, Excel eller PowerPoint</small>
              </label>
              <label className={styles.textField}>
                <span>Merknad til lærer</span>
                <textarea
                  maxLength={2000}
                  name="note"
                  placeholder="Kort beskjed om det du leverer"
                  rows={4}
                />
              </label>
              <button
                className="nivaa-button nivaa-button--primary"
                type="submit"
              >
                {assignment.versions.length === 0
                  ? "Send inn"
                  : "Send inn på nytt"}
              </button>
            </form>
          ) : null}

          <section className={styles.history}>
            <div>
              <p className={styles.eyebrow}>Historikk</p>
              <h2>Innleverte versjoner</h2>
            </div>
            {assignment.versions.length === 0 ? (
              <p>Ingen versjoner er sendt inn ennå.</p>
            ) : (
              <ol>
                {[...assignment.versions].reverse().map((version) => (
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
            )}
          </section>
        </div>

        <aside className={styles.aside}>
          <p className={styles.eyebrow}>Vurdering</p>
          <h2>
            {assignment.assessmentScale === "pass_fail"
              ? "Godkjent / ikke godkjent"
              : "Karakter A–F"}
          </h2>
          <p>
            Tidligere versjoner blir liggende som skrivebeskyttet historikk når
            du sender inn på nytt.
          </p>
        </aside>
      </div>
    </main>
  );
}
