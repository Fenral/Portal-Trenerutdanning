"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { cmsRequest, formatCmsDate } from "./client-api";
import type { CmsCatalog } from "./server/types";
import { CMS_TEMPLATES, createTemplateDocument } from "./templates";
import styles from "./studio.module.css";

export function Library({ isGlobalManager }: { isGlobalManager: boolean }) {
  const router = useRouter();
  const [catalog, setCatalog] = useState<CmsCatalog | null>(null);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [level, setLevel] = useState("");
  const [scope, setScope] = useState("all");
  const [creating, setCreating] = useState(false);
  const [busy, setBusy] = useState(false);
  const [variantBusy, setVariantBusy] = useState<string | null>(null);
  const [variantCourses, setVariantCourses] = useState<Record<string, string>>(
    {},
  );
  const [title, setTitle] = useState("");
  const [newLevel, setNewLevel] = useState("2");
  const [template, setTemplate] = useState(CMS_TEMPLATES[0].id);

  useEffect(() => {
    let active = true;
    cmsRequest<CmsCatalog>("/api/cms/catalog")
      .then((data) => {
        if (active) setCatalog(data);
      })
      .catch((e: Error) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, []);

  async function create(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const result = await cmsRequest<{ itemId: string }>("/api/cms/items", {
        method: "POST",
        body: JSON.stringify({
          title,
          level: Number(newLevel),
          document: createTemplateDocument(template, title),
        }),
      });
      router.push(`/editor/studio/${result.itemId}`);
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }

  async function createVariant(event: FormEvent, itemId: string) {
    event.preventDefault();
    const courseRunId = variantCourses[itemId];
    if (!courseRunId) return;
    setVariantBusy(itemId);
    setError("");
    try {
      const result = await cmsRequest<{ itemId: string }>(
        `/api/cms/items/${itemId}/variant`,
        {
          method: "POST",
          body: JSON.stringify({ courseRunId }),
        },
      );
      router.push(`/editor/studio/${result.itemId}`);
    } catch (e) {
      setError((e as Error).message);
      setVariantBusy(null);
    }
  }

  const items =
    catalog?.items.filter(
      (item) =>
        item.title
          .toLocaleLowerCase("nb-NO")
          .includes(query.toLocaleLowerCase("nb-NO")) &&
        (!level || String(item.level) === level) &&
        (isGlobalManager || item.courseRunId || item.publishedRevision) &&
        (scope === "all" ||
          (scope === "global" ? !item.courseRunId : !!item.courseRunId)),
    ) ?? [];

  return (
    <main id="main-content" className={styles.root}>
      <div className={styles.pageHeading}>
        <div>
          <p className={styles.eyebrow}>Felles innhold · Trenerutdanning</p>
          <h1>Pensumverkstedet</h1>
          <p className={styles.lead}>
            Lag, bearbeid og del innhold som fungerer både til lesing og
            undervisning.
          </p>
        </div>
        {isGlobalManager && (
          <button
            className="nivaa-button nivaa-button--primary"
            onClick={() => setCreating(!creating)}
          >
            {creating ? "Lukk nytt pensum" : "+ Nytt pensum"}
          </button>
        )}
      </div>
      {error && (
        <div role="alert" className={styles.error}>
          {error}
        </div>
      )}
      {isGlobalManager && creating && (
        <form onSubmit={create} className={styles.createPanel}>
          <div className={styles.sectionHeading}>
            <h2>Start med en mal</h2>
            <span>Du kan endre alt innholdet etterpå.</span>
          </div>
          <div className={styles.templateGrid}>
            {CMS_TEMPLATES.map((choice, index) => (
              <button
                type="button"
                key={choice.id}
                aria-pressed={template === choice.id}
                className={styles.template}
                onClick={() => setTemplate(choice.id)}
              >
                <span className={styles.templateNumber}>0{index + 1}</span>
                <strong>{choice.title}</strong>
                <span>{choice.description}</span>
              </button>
            ))}
          </div>
          <div className={styles.createFields}>
            <label>
              Tittel
              <input
                autoFocus
                required
                minLength={2}
                maxLength={180}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="For eksempel: Planlegg for utvikling"
              />
            </label>
            <label>
              Nivå
              <select
                value={newLevel}
                onChange={(e) => setNewLevel(e.target.value)}
              >
                {[1, 2, 3, 4].map((n) => (
                  <option key={n} value={n}>
                    Trener {n}
                  </option>
                ))}
              </select>
            </label>
            <button
              className="nivaa-button nivaa-button--primary"
              disabled={busy}
            >
              {busy ? "Oppretter …" : "Opprett kladd"}
            </button>
          </div>
        </form>
      )}
      <section className={styles.library} aria-label="Innholdsbibliotek">
        <div className={styles.libraryToolbar}>
          <label className={styles.search}>
            <span>Søk i pensum</span>
            <input
              type="search"
              placeholder="Søk etter emne eller tittel …"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </label>
          <label>
            Nivå
            <select value={level} onChange={(e) => setLevel(e.target.value)}>
              <option value="">Alle nivåer</option>
              {[1, 2, 3, 4].map((n) => (
                <option key={n} value={n}>
                  Trener {n}
                </option>
              ))}
            </select>
          </label>
          <label>
            Omfang
            <select value={scope} onChange={(e) => setScope(e.target.value)}>
              <option value="all">Alt innhold</option>
              <option value="global">Globalt pensum</option>
              <option value="course">Kursutgaver</option>
            </select>
          </label>
        </div>
        <div className={styles.listHeading}>
          <span>INNHOLD</span>
          <span>VERSJON OG SIST ENDRET</span>
        </div>
        {!catalog && !error && (
          <p className={styles.empty} role="status">
            Henter pensumbiblioteket …
          </p>
        )}
        {catalog && !items.length && (
          <div className={styles.empty}>
            <h2>
              {catalog.items.length
                ? "Ingen treff"
                : isGlobalManager
                  ? "Ditt første pensum starter her"
                  : "Ingen publiserte pensum er tilgjengelige"}
            </h2>
            <p>
              {catalog.items.length
                ? "Prøv et annet søkeord eller fjern et filter."
                : isGlobalManager
                  ? "Velg «Nytt pensum», gi emnet et navn og start med en mal."
                  : "Når et pensum er knyttet til et av kursene dine, vises det her."}
            </p>
          </div>
        )}
        {items.map((item) => {
          const canEdit = isGlobalManager || item.courseRunId !== null;
          const availableCourses = catalog!.courses.filter((course) =>
            item.availableVariantCourseIds.includes(course.id),
          );
          const content = (
            <>
              <div className={styles.rowTitle}>
                <span className={styles.documentMark} aria-hidden="true">
                  ≡
                </span>
                <div>
                  <h2>
                    {canEdit ? (
                      item.title
                    ) : (
                      <Link href={`/pensum/${item.id}`}>{item.title}</Link>
                    )}
                  </h2>
                  <p>
                    {item.level ? `Trener ${item.level} · ` : ""}
                    {item.courseRunId ? "Kursutgave" : "Globalt pensum"}
                  </p>
                </div>
              </div>
              <div className={styles.rowMeta}>
                <span className={styles.status}>
                  {item.publishedRevision
                    ? `Publisert v${item.publishedRevision}`
                    : "Kladd"}
                </span>
                <span>{formatCmsDate(item.updatedAt)}</span>
                {canEdit && <b>Rediger →</b>}
              </div>
            </>
          );

          if (canEdit) {
            return (
              <Link
                className={styles.libraryRow}
                key={item.id}
                href={`/editor/studio/${item.id}`}
              >
                {content}
              </Link>
            );
          }

          return (
            <div className={styles.libraryRow} key={item.id}>
              {content}
              {availableCourses.length ? (
                <form
                  onSubmit={(event) => createVariant(event, item.id)}
                  style={{ display: "flex", alignItems: "end", gap: 8 }}
                >
                  <label>
                    Lag kursutgave
                    <select
                      aria-label={`Velg kurs for ${item.title}`}
                      required
                      value={variantCourses[item.id] ?? ""}
                      onChange={(event) =>
                        setVariantCourses((current) => ({
                          ...current,
                          [item.id]: event.target.value,
                        }))
                      }
                    >
                      <option value="">Velg kurs</option>
                      {availableCourses.map((course) => (
                        <option key={course.id} value={course.id}>
                          {course.title}
                        </option>
                      ))}
                    </select>
                  </label>
                  <button
                    className="nivaa-button nivaa-button--primary"
                    disabled={variantBusy === item.id}
                  >
                    {variantBusy === item.id ? "Lager …" : "Lag kursutgave"}
                  </button>
                </form>
              ) : (
                <span className={styles.muted}>Ingen tilgjengelige kurs</span>
              )}
            </div>
          );
        })}
        {catalog && (
          <div className={styles.libraryFooter}>
            {items.length} av {catalog.items.length} emner · Én innholdskilde
            for pensum og læringsportal
          </div>
        )}
      </section>
      <div className={styles.libraryNote}>
        <strong>Fra idé til undervisning</strong>
        <p>
          Bygg med AI eller kode, gjør vanlige endringer i Rediger, og publiser
          en bestemt versjon til valgte kurs. Eksterne presentasjoner legges ved
          som originalfiler.
        </p>
      </div>
    </main>
  );
}
