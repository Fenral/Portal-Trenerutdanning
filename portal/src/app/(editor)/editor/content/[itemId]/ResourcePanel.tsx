import type { ResourceView } from "@/features/content/editor-data";

import styles from "./page.module.css";

const dateFormatter = new Intl.DateTimeFormat("nb-NO", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Europe/Oslo",
});

function formatBytes(byteSize: number): string {
  if (byteSize < 1024 * 1024) {
    return `${Math.max(1, Math.round(byteSize / 1024))} kB`;
  }

  return `${(byteSize / (1024 * 1024)).toFixed(1).replace(".", ",")} MB`;
}

function fileTypeFor(mimeType: string): string {
  if (mimeType === "application/pdf") return "PDF";
  if (mimeType.includes("presentation")) return "PowerPoint";
  if (mimeType.includes("spreadsheet") || mimeType.includes("excel")) {
    return "Excel";
  }
  if (mimeType.includes("word")) return "Word";
  return "Fil";
}

export function ResourcePanel({
  resources,
}: {
  resources: readonly ResourceView[];
}) {
  return (
    <section className={styles.panel} aria-labelledby="resources-heading">
      <div className={styles.panelHeading}>
        <div>
          <p className={styles.eyebrow}>Separate ressurser</p>
          <h2 id="resources-heading">Filer til undervisning og studenter</h2>
        </div>
        <span className={styles.countPill}>{resources.length} filer</span>
      </div>

      <div className={styles.resourceList}>
        {resources.map((resource) => (
          <article className={styles.resourceCard} key={resource.id}>
            <div className={styles.resourceIcon} aria-hidden="true">
              {resource.published
                ? fileTypeFor(resource.published.mimeType).slice(0, 1)
                : "–"}
            </div>
            <div className={styles.resourceBody}>
              <div className={styles.resourceTitleLine}>
                <div>
                  <h3>{resource.title}</h3>
                  <p>{resource.description}</p>
                </div>
                <span
                  className={styles.audienceBadge}
                  data-audience={resource.audience}
                >
                  {resource.audience === "teachers"
                    ? "Kun lærere"
                    : "Lærere og studenter"}
                </span>
              </div>

              {resource.published ? (
                <div className={styles.fileMeta}>
                  <strong>{resource.published.filename}</strong>
                  <span>{fileTypeFor(resource.published.mimeType)}</span>
                  <span>{formatBytes(resource.published.byteSize)}</span>
                  <span>Publisert v{resource.published.revisionNumber}</span>
                  {resource.draftRevisionNumber ? (
                    <span>Kladd v{resource.draftRevisionNumber}</span>
                  ) : null}
                </div>
              ) : (
                <p>Ingen publisert fil.</p>
              )}

              <div className={styles.resourceActions}>
                {resource.published?.mimeType === "application/pdf" ? (
                  <a
                    className="nivaa-button nivaa-button--secondary"
                    href={`/resources/${resource.published.assetId}`}
                    rel="noreferrer"
                    target="_blank"
                  >
                    Forhåndsvis PDF
                  </a>
                ) : null}
                {resource.published ? (
                  <a
                    className="nivaa-button nivaa-button--secondary"
                    href={`/resources/${resource.published.assetId}?download=1`}
                  >
                    Last ned
                  </a>
                ) : null}
                <details className={styles.historyDetails}>
                  <summary>Versjonshistorikk</summary>
                  <ol>
                    {resource.history.map((revision) => (
                      <li key={`${resource.id}-${revision.revisionNumber}`}>
                        <strong>v{revision.revisionNumber}</strong>
                        <span>{revision.status}</span>
                        <small>
                          {dateFormatter.format(new Date(revision.updatedAt))} ·{" "}
                          {revision.changeNote}
                        </small>
                      </li>
                    ))}
                  </ol>
                </details>
              </div>
            </div>
          </article>
        ))}
      </div>

      <aside className={styles.uploadNotice}>
        <strong>Sikker opplasting er klargjort</strong>
        <p>
          Nye filer går via privat karantene og virusskann før de kan
          publiseres. Selve opplastingsknappen aktiveres når EU-skanneren og
          lagringsbøtten er konfigurert.
        </p>
      </aside>
    </section>
  );
}
