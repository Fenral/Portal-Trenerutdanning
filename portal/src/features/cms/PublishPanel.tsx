"use client";

import { useState } from "react";
import type { ContentDocument } from "@/features/content/document-schema";
import { formatCmsDate } from "./client-api";
import { runSelfCheck } from "./self-check";
import type { CmsEditor } from "./server/types";
import styles from "./studio.module.css";

export function PublishPanel({
  editor,
  document,
  dirty,
  busy,
  onPublish,
  onRestore,
}: {
  editor: CmsEditor;
  document: ContentDocument;
  dirty: boolean;
  busy: boolean;
  onPublish: (note: string, courseIds: string[]) => void;
  onRestore: (revisionId: string) => void;
}) {
  const [note, setNote] = useState("");
  const [courses, setCourses] = useState<string[]>([]);
  const checks = runSelfCheck(document);
  const blocking = checks.some((check) => check.severity === "error");
  return (
    <>
      <div className={styles.publishGrid}>
        <section>
          <p className={styles.eyebrow}>Kort selvsjekk</p>
          <h2>Klar for neste steg?</h2>
          <p className={styles.muted}>
            Se over innholdet og prøv interaksjonene. Varslene under hjelper deg
            videre.
          </p>
          <ul className={styles.checkList}>
            {checks.map((check) => (
              <li key={check.id} data-severity={check.severity}>
                <span aria-hidden="true">
                  {check.severity === "error"
                    ? "!"
                    : check.severity === "warning"
                      ? "△"
                      : "✓"}
                </span>
                <span>{check.message}</span>
              </li>
            ))}
            {checks.length === 0 && (
              <li>
                <span aria-hidden="true">✓</span>Innholdet har en gyldig
                struktur og er klart for din faglige gjennomgang.
              </li>
            )}
          </ul>
          <p className={styles.muted}>
            Selvsjekken vurderer struktur og visning. Du avgjør om faginnholdet
            er riktig.
          </p>
          {editor.published && (
            <div className={styles.sourceContext}>
              <strong>Publisert v{editor.published.revisionNumber}</strong>
              {formatCmsDate(
                editor.published.publishedAt ?? editor.published.updatedAt,
              )}
              <br />
              {editor.courseBindings.length} kurs bruker en publisert versjon.
            </div>
          )}
        </section>
        <form
          className={styles.publishCard}
          onSubmit={(e) => {
            e.preventDefault();
            onPublish(note, courses);
          }}
        >
          <h3>Publiser v{editor.draft.revisionNumber}</h3>
          <p className={styles.muted}>
            {editor.item.courseRunId
              ? "Denne versjonen blir tilgjengelig på kurset som eier kursutgaven."
              : "Velg kursene som skal få den nye versjonen. Øvrige kurs beholder sin versjon."}
          </p>
          <label>
            Hva er endret?
            <textarea
              required
              minLength={3}
              maxLength={500}
              rows={3}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="For eksempel: Ny interaktiv forklaring og oppdatert refleksjon."
            />
          </label>
          {!editor.item.courseRunId && (
            <div
              className={styles.courseList}
              aria-label="Kurs som skal oppdateres"
            >
              {editor.courses
                .filter((course) => course.status !== "closed")
                .map((course) => {
                  const current = editor.courseBindings.find(
                    (binding) => binding.courseRunId === course.id,
                  );
                  return (
                    <label key={course.id}>
                      <input
                        type="checkbox"
                        checked={courses.includes(course.id)}
                        onChange={(e) =>
                          setCourses((ids) =>
                            e.target.checked
                              ? [...ids, course.id]
                              : ids.filter((id) => id !== course.id),
                          )
                        }
                      />
                      <span>
                        {course.title}
                        <small>
                          {current
                            ? "Bruker pensumet allerede"
                            : "Knytt pensum til kurset"}
                        </small>
                      </span>
                    </label>
                  );
                })}
            </div>
          )}
          <button
            className="nivaa-button nivaa-button--primary"
            disabled={busy || blocking || note.trim().length < 3}
          >
            {busy
              ? "Arbeider …"
              : dirty
                ? "Lagre og publiser"
                : "Publiser versjonen"}
          </button>
          <p className={styles.muted}>
            Innhold, kode og design lagres i versjonen. Du kan hente en
            tidligere versjon tilbake som kladd.
          </p>
        </form>
      </div>
      <details className={styles.history}>
        <summary>Versjonshistorikk ({editor.history.length})</summary>
        <ol>
          {editor.history.map((revision) => (
            <li key={revision.id}>
              <div>
                <strong>Versjon {revision.revisionNumber}</strong>
                <p>{revision.changeNote}</p>
                <small>
                  {formatCmsDate(revision.publishedAt ?? revision.updatedAt)}
                </small>
              </div>
              <button
                className={styles.plainButton}
                disabled={busy}
                onClick={() => onRestore(revision.id)}
              >
                Bruk som kladd
              </button>
            </li>
          ))}
        </ol>
        {!editor.history.length && (
          <p className={styles.muted}>
            Første publisering oppretter den første historiske versjonen.
          </p>
        )}
      </details>
    </>
  );
}
