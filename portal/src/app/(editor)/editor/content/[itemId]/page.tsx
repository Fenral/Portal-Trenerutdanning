import Link from "next/link";
import { notFound } from "next/navigation";

import {
  loadContentEditor,
  summarizeContentDocument,
} from "@/features/content/editor-data";
import { createSupabaseServerClient } from "@/lib/supabase/server";

import { ResourcePanel } from "./ResourcePanel";
import { publishContentAction, saveContentDraftAction } from "./actions";
import styles from "./page.module.css";

export const dynamic = "force-dynamic";

const dateFormatter = new Intl.DateTimeFormat("nb-NO", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Europe/Oslo",
});

type PageProps = Readonly<{
  params: Promise<{ itemId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}>;

export default async function ContentEditorPage({
  params,
  searchParams,
}: PageProps) {
  const { itemId } = await params;
  const query = await searchParams;
  const content = await loadContentEditor(
    await createSupabaseServerClient(),
    itemId,
  );

  if (!content) {
    notFound();
  }

  const draftSummary = summarizeContentDocument(content.draft.document);
  const saveAction = saveContentDraftAction.bind(null, content.item.id);
  const publishAction = publishContentAction.bind(null, content.item.id);

  return (
    <main className={styles.shell} id="main-content">
      <Link className={styles.backLink} href="/editor/content">
        ← Til innhold
      </Link>

      <header className={styles.hero}>
        <div>
          <p className={styles.eyebrow}>Pensum · {content.item.kind}</p>
          <h1>{draftSummary.heading}</h1>
          <p>{content.item.title}</p>
        </div>
        <div className={styles.statusStack}>
          <span className={styles.statusBadge} data-status="draft">
            Kladd v{content.draft.revisionNumber}
          </span>
          <span className={styles.statusBadge} data-status="published">
            {content.published
              ? `Publisert v${content.published.revisionNumber}`
              : "Ikke publisert"}
          </span>
        </div>
      </header>

      {query.saved === "1" ? (
        <p className={styles.successBanner} role="status">
          Kladden er lagret. Studentene ser fortsatt publisert versjon.
        </p>
      ) : null}
      {query.published === "1" ? (
        <p className={styles.successBanner} role="status">
          Ny versjon er publisert. Bare valgte kull er oppdatert.
        </p>
      ) : null}
      {query.error ? (
        <p className={styles.errorBanner} role="alert">
          Handlingen kunne ikke fullføres. Kontroller feltene og prøv igjen.
        </p>
      ) : null}

      <div className={styles.editorGrid}>
        <section className={styles.panel} aria-labelledby="draft-heading">
          <div className={styles.panelHeading}>
            <div>
              <p className={styles.eyebrow}>Arbeidskopi</p>
              <h2 id="draft-heading">Rediger kladd</h2>
            </div>
            <small>
              Sist endret{" "}
              {dateFormatter.format(new Date(content.draft.updatedAt))}
            </small>
          </div>

          <form action={saveAction} className={styles.editForm}>
            <label>
              <span>Overskrift</span>
              <input
                defaultValue={draftSummary.heading}
                maxLength={180}
                name="heading"
                required
              />
            </label>
            <label>
              <span>Ingress</span>
              <textarea
                defaultValue={draftSummary.introduction}
                maxLength={10000}
                name="introduction"
                required
                rows={6}
              />
            </label>
            <label>
              <span>Visningsform</span>
              <select
                defaultValue={content.draft.document.format}
                name="format"
              >
                <option value="short_page">Kort side</option>
                <option value="scroll_story">Scrollfortelling</option>
              </select>
            </label>
            <div className={styles.formFooter}>
              <button
                className="nivaa-button nivaa-button--primary"
                type="submit"
              >
                Lagre kladd
              </button>
              <span>Endringen må publiseres før studentene ser den.</span>
            </div>
          </form>
        </section>

        <aside className={styles.panel} aria-labelledby="publish-heading">
          <div className={styles.panelHeading}>
            <div>
              <p className={styles.eyebrow}>Kontrollert publisering</p>
              <h2 id="publish-heading">Publiser versjon</h2>
            </div>
          </div>

          <form action={publishAction} className={styles.publishForm}>
            <label>
              <span>Endringsnotat</span>
              <textarea
                maxLength={500}
                minLength={3}
                name="change-note"
                placeholder="Hva er endret, og hvorfor?"
                required
                rows={4}
              />
            </label>

            <fieldset>
              <legend>Oppdater aktive kull nå</legend>
              <p>
                Ingen kull oppdateres automatisk. Kryss av bare kullene som skal
                få den nye versjonen.
              </p>
              {content.courseBindings.map((binding) => (
                <label
                  className={styles.courseChoice}
                  key={binding.courseRunId}
                >
                  <input
                    disabled={binding.courseStatus !== "active"}
                    name="course-run-id"
                    type="checkbox"
                    value={binding.courseRunId}
                  />
                  <span>
                    <strong>{binding.courseTitle}</strong>
                    <small>
                      Beholder nå v
                      {content.history.find(
                        (revision) => revision.id === binding.revisionId,
                      )?.revisionNumber ?? "?"}
                    </small>
                  </span>
                </label>
              ))}
            </fieldset>

            <button
              className="nivaa-button nivaa-button--primary"
              type="submit"
            >
              Publiser kladden
            </button>
          </form>
        </aside>
      </div>

      <ResourcePanel resources={content.resources} />

      <section className={styles.panel} aria-labelledby="history-heading">
        <div className={styles.panelHeading}>
          <div>
            <p className={styles.eyebrow}>Sporbarhet</p>
            <h2 id="history-heading">Versjonshistorikk</h2>
          </div>
        </div>
        <ol className={styles.versionList}>
          {content.history.map((revision) => (
            <li key={revision.id}>
              <strong>v{revision.revisionNumber}</strong>
              <span>{revision.status}</span>
              <p>{revision.changeNote}</p>
              <small>
                {revision.publishedAt
                  ? dateFormatter.format(new Date(revision.publishedAt))
                  : dateFormatter.format(new Date(revision.updatedAt))}
              </small>
            </li>
          ))}
        </ol>
      </section>
    </main>
  );
}
