"use client";

import { useRef, useState, type FormEvent } from "react";
import type { ContentDocument } from "@/features/content/document-schema";
import { cmsRequest } from "./client-api";
import type { CmsAttachment } from "./server/types";
import styles from "./studio.module.css";

export function AttachmentPanel({
  itemId,
  document,
  attachments,
  onChange,
  onUploaded,
}: {
  itemId: string;
  document: ContentDocument;
  attachments: CmsAttachment[];
  onChange: (value: ContentDocument) => void;
  onUploaded: (value: CmsAttachment) => void;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [progress, setProgress] = useState("");
  const formRef = useRef<HTMLFormElement>(null);
  const selected = new Set(document.attachmentIds ?? []);

  async function upload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const file = form.get("file");
    if (!(file instanceof File) || !file.size) {
      setError("Velg en fil først.");
      return;
    }
    if (file.size > 20 * 1024 * 1024) {
      setError("Filen er større enn 20 MB. Velg en mindre fil.");
      return;
    }
    setBusy(true);
    setError("");
    setProgress("Laster opp originalfilen …");
    try {
      const target = `/api/cms/items/${itemId}/attachments`;
      const upload = await cmsRequest<{
        uploadId: string;
        uploadUrl: string;
        mimeType: string;
      }>(target, {
        method: "POST",
        body: JSON.stringify({
          phase: "prepare",
          filename: file.name,
          mimeType: file.type,
          byteSize: file.size,
          title: form.get("title"),
          author: form.get("author"),
          audience: form.get("audience"),
        }),
      });
      const stored = await fetch(upload.uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": upload.mimeType, "x-upsert": "false" },
        body: file,
      });
      if (!stored.ok)
        throw new Error("Originalfilen kunne ikke lastes opp. Prøv igjen.");
      setProgress("Knytter originalfilen til pensumet …");
      const result = await cmsRequest<{ attachment: CmsAttachment }>(target, {
        method: "POST",
        body: JSON.stringify({ phase: "complete", uploadId: upload.uploadId }),
      });
      onUploaded(result.attachment);
      onChange({
        ...document,
        attachmentIds: [
          ...new Set([...(document.attachmentIds ?? []), result.attachment.id]),
        ],
      });
      formRef.current?.reset();
      setOpen(false);
      setProgress(
        "Originalfilen er lastet opp. Lagre kladden for å ta den med.",
      );
    } catch (e) {
      setError((e as Error).message);
      setProgress("");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className={styles.attachmentPanel} aria-label="Eksterne vedlegg">
      <div className={styles.sectionHeading}>
        <div>
          <h2>Eksterne presentasjoner og vedlegg</h2>
          <p className={styles.muted}>
            Behold foreleserens originalfil og knytt den til dette pensumet.
          </p>
        </div>
        <button className={styles.plainButton} onClick={() => setOpen(!open)}>
          {open ? "Lukk opplasting" : "+ Last opp fil"}
        </button>
      </div>
      {attachments.length > 0 ? (
        <ul className={styles.attachmentList}>
          {attachments.map((file) => (
            <li key={file.id}>
              <div>
                <label>
                  <span>
                    <input
                      type="checkbox"
                      checked={selected.has(file.id)}
                      onChange={(e) =>
                        onChange({
                          ...document,
                          attachmentIds: e.target.checked
                            ? [
                                ...new Set([
                                  ...(document.attachmentIds ?? []),
                                  file.id,
                                ]),
                              ]
                            : (document.attachmentIds ?? []).filter(
                                (id) => id !== file.id,
                              ),
                        })
                      }
                    />{" "}
                    Ta med i denne versjonen
                  </span>
                </label>
                <a href={file.downloadUrl}>{file.title || file.filename} ↓</a>
                <small>
                  {file.author && `${file.author} · `}
                  {file.filename} ·{" "}
                  {(file.byteSize / 1024 / 1024).toFixed(1).replace(".", ",")}{" "}
                  MB ·{" "}
                  {file.audience === "teachers"
                    ? "Kun lærere"
                    : "Kursdeltakere"}
                </small>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className={styles.muted}>
          Ingen originalfiler er lastet opp til dette emnet ennå.
        </p>
      )}
      {open && (
        <form ref={formRef} onSubmit={upload} className={styles.uploadForm}>
          <label>
            Originalfil
            <input
              name="file"
              type="file"
              required
              accept=".pdf,.ppt,.pptx,.doc,.docx"
              disabled={busy}
            />
            <span className={styles.muted}>
              PDF, PowerPoint eller Word · opptil 20 MB
            </span>
          </label>
          <label>
            Tittel
            <input
              name="title"
              required
              maxLength={180}
              placeholder="Presentasjon fra ekstern foreleser"
              disabled={busy}
            />
          </label>
          <label>
            Bidragsyter
            <input
              name="author"
              required
              maxLength={180}
              placeholder="Navn på foreleser"
              disabled={busy}
            />
          </label>
          <label>
            Tilgjengelig for
            <select
              name="audience"
              defaultValue="course_members"
              disabled={busy}
            >
              <option value="course_members">Lærere og kursdeltakere</option>
              <option value="teachers">Bare lærere</option>
            </select>
          </label>
          <button
            className="nivaa-button nivaa-button--primary"
            disabled={busy}
          >
            {busy ? "Laster opp …" : "Last opp originalfil"}
          </button>
        </form>
      )}
      {error && (
        <div className={styles.error} role="alert">
          {error}
        </div>
      )}
      {progress && (
        <p className={styles.muted} role="status">
          {progress}
        </p>
      )}
    </section>
  );
}
