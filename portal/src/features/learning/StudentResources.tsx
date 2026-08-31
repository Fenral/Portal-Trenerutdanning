import type { StudentResourceView } from "@/features/content/student-data";

import styles from "./StudentResources.module.css";

function formatBytes(byteSize: number): string {
  if (byteSize < 1024 * 1024) {
    return `${Math.max(1, Math.round(byteSize / 1024))} kB`;
  }

  return `${(byteSize / (1024 * 1024)).toFixed(1).replace(".", ",")} MB`;
}

function fileTypeFor(mimeType: string): string {
  if (mimeType === "application/pdf") return "PDF";
  if (mimeType.includes("presentation")) return "PowerPoint";
  if (mimeType.includes("spreadsheet")) return "Excel";
  if (mimeType.includes("word")) return "Word";
  return "Fil";
}

export function StudentResources({
  resources,
}: Readonly<{ resources: readonly StudentResourceView[] }>) {
  return (
    <aside className={styles.resources} aria-labelledby="resources-title">
      <p className={styles.eyebrow}>Delt med kullet</p>
      <h2 id="resources-title">Filer</h2>
      {resources.length ? (
        <ul data-testid="student-resources">
          {resources.map((resource) => (
            <li key={resource.id}>
              <div className={styles.fileIcon} aria-hidden="true">
                {fileTypeFor(resource.mimeType).slice(0, 1)}
              </div>
              <div className={styles.fileCopy}>
                <strong>{resource.title}</strong>
                <span>
                  {fileTypeFor(resource.mimeType)} ·{" "}
                  {formatBytes(resource.byteSize)}
                </span>
                {resource.description ? (
                  <small>{resource.description}</small>
                ) : null}
              </div>
              <div className={styles.fileActions}>
                {resource.mimeType === "application/pdf" ? (
                  <a
                    href={`/resources/${resource.assetId}`}
                    rel="noopener noreferrer"
                    target="_blank"
                  >
                    Vis
                  </a>
                ) : null}
                <a href={`/resources/${resource.assetId}?download=1`}>
                  Last ned
                </a>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className={styles.noResources}>
          Ingen filer er delt med studentene i denne aktiviteten.
        </p>
      )}
      <p className={styles.accessNote}>Lærerfiler vises bare for kurslærere.</p>
    </aside>
  );
}
