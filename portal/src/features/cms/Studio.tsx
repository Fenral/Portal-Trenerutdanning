"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import {
  ContentDocument,
  type ContentDocument as DocumentValue,
} from "@/features/content/document-schema";
import { ContentRenderer } from "@/features/learning/ContentRenderer";
import { AiPanel } from "./AiPanel";
import { AttachmentPanel } from "./AttachmentPanel";
import { BlockEditor } from "./BlockEditor";
import { CodePanel } from "./CodePanel";
import { Presentation } from "./Presentation";
import { PublishPanel } from "./PublishPanel";
import { cmsRequest, downloadText, formatCmsDate } from "./client-api";
import { buildOfflineHtml } from "./export-html";
import type { CmsEditor } from "./server/types";
import styles from "./studio.module.css";

type Mode = "build" | "edit" | "publish";

export function Studio({ itemId }: { itemId: string }) {
  const router = useRouter();
  const [editor, setEditor] = useState<CmsEditor | null>(null);
  const [document, setDocument] = useState<DocumentValue | null>(null);
  const [title, setTitle] = useState("");
  const [mode, setMode] = useState<Mode>("build");
  const [pane, setPane] = useState("controls");
  const [view, setView] = useState("read");
  const [showCode, setShowCode] = useState(false);
  const [proposal, setProposal] = useState<DocumentValue | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [undo, setUndo] = useState<DocumentValue[]>([]);
  const [variantCourse, setVariantCourse] = useState("");
  const [showVariant, setShowVariant] = useState(false);
  const dirty =
    !!editor &&
    !!document &&
    (JSON.stringify(document) !== JSON.stringify(editor.draft.document) ||
      title !== editor.item.title);

  useEffect(() => {
    let active = true;
    cmsRequest<CmsEditor>(`/api/cms/items/${itemId}`)
      .then((value) => {
        if (active) {
          setEditor(value);
          setDocument(value.draft.document);
          setTitle(value.item.title);
        }
      })
      .catch((e: Error) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, [itemId]);

  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  function change(next: DocumentValue) {
    if (document) setUndo((values) => [...values.slice(-9), document]);
    setDocument(next);
    setNotice("");
  }

  function accept(next: CmsEditor) {
    setEditor(next);
    setDocument(next.draft.document);
    setTitle(next.item.title);
    setProposal(null);
  }

  async function persist(): Promise<CmsEditor> {
    if (!document || !editor) throw new Error("Vent til innholdet er lastet.");
    const parsed = ContentDocument.safeParse(document);
    if (!parsed.success)
      throw new Error(
        `Kontroller innholdet: ${parsed.error.issues[0]?.message ?? "et felt er ugyldig"}`,
      );
    if (title.trim().length < 2)
      throw new Error("Gi emnet en tittel med minst to tegn.");
    const next = await cmsRequest<CmsEditor>(`/api/cms/items/${itemId}`, {
      method: "PUT",
      body: JSON.stringify({
        title: title.trim(),
        document: parsed.data,
        expectedUpdatedAt: editor.draft.updatedAt,
        changeNote: "Oppdatert fra pensumverkstedet",
      }),
    });
    accept(next);
    return next;
  }

  async function save() {
    setBusy(true);
    setError("");
    try {
      await persist();
      setNotice("Kladden er lagret. Publiser når den er klar til bruk.");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function publish(changeNote: string, courseRunIds: string[]) {
    if (!editor) return;
    setBusy(true);
    setError("");
    try {
      const saved = dirty ? await persist() : editor;
      const next = await cmsRequest<CmsEditor>(
        `/api/cms/items/${itemId}/publish`,
        {
          method: "POST",
          body: JSON.stringify({
            expectedUpdatedAt: saved.draft.updatedAt,
            changeNote,
            courseRunIds,
          }),
        },
      );
      accept(next);
      setUndo([]);
      setNotice(
        `Versjon ${next.published?.revisionNumber ?? saved.draft.revisionNumber} er publisert. Du kan fortsette i en ny kladd.`,
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function restore(revisionId: string) {
    if (!editor) return;
    setBusy(true);
    setError("");
    try {
      const next = await cmsRequest<CmsEditor>(
        `/api/cms/items/${itemId}/restore`,
        {
          method: "POST",
          body: JSON.stringify({
            revisionId,
            expectedUpdatedAt: editor.draft.updatedAt,
          }),
        },
      );
      if (document) setUndo([document]);
      accept(next);
      setMode("edit");
      setNotice(
        "Den valgte versjonen er kopiert til kladden. Publisert innhold er bevart.",
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function createVariant(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const result = await cmsRequest<{ itemId: string }>(
        `/api/cms/items/${itemId}/variant`,
        {
          method: "POST",
          body: JSON.stringify({ courseRunId: variantCourse }),
        },
      );
      router.push(`/editor/studio/${result.itemId}`);
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }

  if (!editor || !document)
    return (
      <main id="main-content" className={styles.root}>
        <Link href="/editor/studio">← Til pensumbiblioteket</Link>
        {error ? (
          <div role="alert" className={styles.error}>
            {error}
          </div>
        ) : (
          <p role="status">Åpner pensumverkstedet …</p>
        )}
      </main>
    );
  const previewDocument = proposal ?? document;

  const preview = (
    <section className={styles.preview} aria-label="Forhåndsvisning av pensum">
      <div className={styles.previewBar}>
        <strong>
          {proposal ? "AI-forslag · ikke brukt" : "Forhåndsvisning av kladden"}
        </strong>
        <div className={styles.switcher}>
          <button
            aria-pressed={view === "read"}
            onClick={() => setView("read")}
          >
            Pensum
          </button>
          <button
            aria-pressed={view === "teach"}
            onClick={() => setView("teach")}
          >
            Undervisning
          </button>
        </div>
      </div>
      {view === "teach" ? (
        <Presentation document={previewDocument} title={title} />
      ) : (
        <div className={styles.previewBody}>
          <p className={styles.eyebrow}>
            {editor.item.level ? `Trener ${editor.item.level} · ` : ""}Pensum
          </p>
          <ContentRenderer
            document={previewDocument}
            hidePrimaryHeading={false}
          />
          {previewDocument.sources?.length ? (
            <div className={styles.sources}>
              <h3>Kilder</h3>
              <ol>
                {previewDocument.sources.map((source, index) => (
                  <li key={index}>
                    {source.url ? (
                      <a
                        href={source.url}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        {source.title}
                      </a>
                    ) : (
                      source.title
                    )}
                  </li>
                ))}
              </ol>
            </div>
          ) : null}
        </div>
      )}
    </section>
  );

  return (
    <main id="main-content" className={styles.root}>
      <nav className={styles.breadcrumb} aria-label="Brødsmulesti">
        <Link
          href="/editor/studio"
          onClick={(e) => {
            if (
              dirty &&
              !window.confirm(
                "Du har ulagrede endringer. Vil du forlate kladden?",
              )
            )
              e.preventDefault();
          }}
        >
          Pensumverksted
        </Link>
        <span>/</span>
        <span>
          {editor.item.level ? `Trener ${editor.item.level}` : "Felles pensum"}
        </span>
      </nav>
      <div className={styles.studioHeader}>
        <div>
          <p className={styles.eyebrow}>
            {editor.item.courseRunId ? "Kursutgave" : "Globalt pensum"}
          </p>
          <h1>{title}</h1>
          <p className={styles.savedState}>
            <span className={styles.status}>
              Kladd v{editor.draft.revisionNumber}
            </span>
            <span>
              {dirty
                ? "● Ulagrede endringer"
                : `Lagret ${formatCmsDate(editor.draft.updatedAt)}`}
            </span>
          </p>
        </div>
        <div className={styles.headerActions}>
          <button
            className={styles.textButton}
            disabled={busy || !undo.length}
            onClick={() => {
              setDocument(undo.at(-1)!);
              setUndo((values) => values.slice(0, -1));
            }}
          >
            Angre
          </button>
          <button
            className="nivaa-button nivaa-button--primary"
            disabled={busy || !dirty}
            onClick={save}
          >
            {busy ? "Arbeider …" : "Lagre kladd"}
          </button>
        </div>
      </div>
      {error && (
        <div className={styles.error} role="alert">
          {error}
          {error.includes("endret siden") && (
            <p>
              Du kan ta vare på arbeidet med «Last ned dokument» før du laster
              siden på nytt.
            </p>
          )}
        </div>
      )}
      {notice && (
        <div className={styles.notice} role="status">
          {notice}
        </div>
      )}
      <fieldset disabled={busy} className={styles.workbenchFieldset}>
        <div className={styles.workbench}>
          <div
            className={styles.modeTabs}
            role="tablist"
            aria-label="Arbeidsmodus"
          >
            {(["build", "edit", "publish"] as const).map((value, index) => (
              <button
                key={value}
                role="tab"
                aria-selected={mode === value}
                onClick={() => setMode(value)}
              >
                <span>{index + 1}</span>
                {{ build: "Bygg", edit: "Rediger", publish: "Publiser" }[value]}
              </button>
            ))}
          </div>
          <div className={styles.scopeBar}>
            <span>
              {editor.item.courseRunId ? (
                <>
                  <strong>Kursutgave.</strong> Endringer gjelder{" "}
                  {editor.courses.find(
                    (course) => course.id === editor.item.courseRunId,
                  )?.title ?? "dette kurset"}
                  .
                </>
              ) : (
                <>
                  <strong>Felles grunnlag.</strong> Publiserte versjoner kan
                  brukes av flere kurs.
                </>
              )}
            </span>
            {editor.item.sourceItemId ? (
              <Link
                href={`/pensum/${editor.item.sourceItemId}?courseRunId=${editor.item.courseRunId}`}
                target="_blank"
              >
                Globalt utgangspunkt ↗
              </Link>
            ) : (
              <button
                className={styles.textButton}
                disabled={!editor.published}
                onClick={() => setShowVariant(!showVariant)}
              >
                Lag kursutgave
              </button>
            )}
          </div>
          <div hidden={mode !== "build"}>
            <div className={styles.mobileSwitch}>
              <div className={styles.switcher}>
                <button
                  aria-pressed={pane === "controls"}
                  onClick={() => setPane("controls")}
                >
                  AI-samtale
                </button>
                <button
                  aria-pressed={pane === "preview"}
                  onClick={() => setPane("preview")}
                >
                  Forhåndsvisning
                </button>
              </div>
            </div>
            <div className={styles.buildGrid} data-pane={pane}>
              <div className={styles.buildControls}>
                <AiPanel
                  itemId={itemId}
                  document={document}
                  onPreview={(value) => {
                    setProposal(value);
                    if (value) setPane("preview");
                  }}
                  onApply={change}
                />
                <div className={styles.sources}>
                  <button
                    className={styles.plainButton}
                    aria-expanded={showCode}
                    onClick={() => setShowCode(!showCode)}
                  >
                    {showCode ? "Skjul kode" : "Åpne kodeverktøy"}
                  </button>
                </div>
              </div>
              {mode === "build" ? preview : null}
            </div>
            {showCode && <CodePanel document={document} onChange={change} />}
          </div>
          {mode === "edit" && (
            <>
              <div className={styles.editGrid}>
                <div className={styles.editControls}>
                  <label>
                    Navn i biblioteket
                    <input
                      value={title}
                      maxLength={180}
                      onChange={(e) => setTitle(e.target.value)}
                    />
                  </label>
                  <div className={styles.sources}>
                    <BlockEditor document={document} onChange={change} />
                  </div>
                </div>
                {preview}
              </div>
              <AttachmentPanel
                itemId={itemId}
                document={document}
                attachments={editor.attachments}
                onChange={change}
                onUploaded={(attachment) =>
                  setEditor((state) =>
                    state
                      ? {
                          ...state,
                          attachments: [...state.attachments, attachment],
                        }
                      : state,
                  )
                }
              />
            </>
          )}
          {mode === "publish" && (
            <PublishPanel
              editor={editor}
              document={document}
              dirty={dirty}
              busy={busy}
              onPublish={publish}
              onRestore={restore}
            />
          )}
          <div className={styles.workbenchFooter}>
            <span>Samme innhold i pensum og læringsportal</span>
            <span>
              {editor.published
                ? `Siste publisering: v${editor.published.revisionNumber}`
                : "Ikke publisert ennå"}
            </span>
          </div>
        </div>
        {showVariant && !editor.item.courseRunId && (
          <section className={styles.variantPanel}>
            <h2>Lag en utgave for ett kurs</h2>
            <p className={styles.muted}>
              Kopier den publiserte versjonen. Læreren kan tilpasse eksempler og
              vedlegg, mens koblingen til det globale utgangspunktet beholdes.
            </p>
            <form onSubmit={createVariant}>
              <label>
                Velg kurs
                <select
                  required
                  value={variantCourse}
                  onChange={(e) => setVariantCourse(e.target.value)}
                >
                  <option value="">Velg et kurs …</option>
                  {editor.courses
                    .filter((course) => course.status !== "closed")
                    .map((course) => (
                      <option key={course.id} value={course.id}>
                        {course.title}
                      </option>
                    ))}
                </select>
              </label>
              <button
                className="nivaa-button nivaa-button--primary"
                disabled={busy || !variantCourse}
              >
                Opprett kursutgave
              </button>
            </form>
          </section>
        )}
        <div className={styles.pageHeading} style={{ marginTop: 24 }}>
          <p className={styles.muted}>
            Ta med undervisningen uten nett, eller lagre dokumentet som en
            sikkerhetskopi.
          </p>
          <div className={styles.proposalActions}>
            {editor.published && (
              <>
                <Link
                  className={styles.plainButton}
                  href={`/pensum/${itemId}${editor.item.courseRunId ? `?courseRunId=${editor.item.courseRunId}` : ""}`}
                  target="_blank"
                >
                  Åpne publisert pensum ↗
                </Link>
                <Link
                  className={styles.plainButton}
                  href={`/undervisning/${itemId}${editor.item.courseRunId ? `?courseRunId=${editor.item.courseRunId}` : ""}`}
                  target="_blank"
                >
                  Start undervisning ↗
                </Link>
              </>
            )}
            <button
              className={styles.plainButton}
              onClick={() => {
                try {
                  downloadText(
                    buildOfflineHtml(ContentDocument.parse(document), title),
                    `${editor.item.slug}.html`,
                  );
                } catch {
                  setError(
                    "Kontroller innholdet før du laster ned undervisningen.",
                  );
                }
              }}
            >
              Last ned undervisning
            </button>
            <button
              className={styles.textButton}
              onClick={() =>
                downloadText(
                  JSON.stringify(document, null, 2),
                  `${editor.item.slug}.json`,
                  "application/json",
                )
              }
            >
              Last ned dokument
            </button>
          </div>
        </div>
      </fieldset>
    </main>
  );
}
