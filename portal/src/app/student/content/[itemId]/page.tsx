import Link from "next/link";
import { notFound } from "next/navigation";

import { loadStudentContent } from "@/features/content/student-data";
import { createSupabaseServerClient } from "@/lib/supabase/server";

import { ContentBlocks } from "./ContentBlocks";
import styles from "./page.module.css";

export const dynamic = "force-dynamic";

type PageProps = Readonly<{
  params: Promise<{ itemId: string }>;
}>;

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

export default async function StudentContentPage({ params }: PageProps) {
  const { itemId } = await params;
  const client = await createSupabaseServerClient();
  const content = await loadStudentContent(client, itemId);

  if (!content) notFound();

  const firstHeading = content.document.blocks.find(
    (block) => block.type === "heading",
  );
  const heading =
    firstHeading?.type === "heading" ? firstHeading.text : content.item.title;

  return (
    <main className={styles.page} id="main-content">
      <Link className={styles.backLink} href="/student">
        ← Til læringsløpet
      </Link>

      <header className={styles.hero}>
        <div>
          <p className={styles.eyebrow}>{content.courseTitle}</p>
          <h1>{heading}</h1>
          <p className={styles.versionLabel}>
            Publisert versjon {content.revisionNumber}
          </p>
        </div>
        <div className={styles.completionCard}>
          <span>Din progresjon</span>
          <strong>0 av 1</strong>
          <div className="nivaa-progress__track" aria-hidden="true">
            <span style={{ width: "0%" }} />
          </div>
        </div>
      </header>

      <div className={styles.contentGrid}>
        <article className={styles.lesson}>
          <ContentBlocks document={content.document} />
        </article>

        <aside className={styles.resources} aria-labelledby="resources-title">
          <p className={styles.eyebrow}>Delt med kullet</p>
          <h2 id="resources-title">Filer</h2>
          {content.resources.length ? (
            <ul data-testid="student-resources">
              {content.resources.map((resource) => (
                <li key={resource.id}>
                  <div className={styles.fileIcon} aria-hidden="true">
                    {fileTypeFor(resource.mimeType).slice(0, 1)}
                  </div>
                  <div>
                    <strong>{resource.title}</strong>
                    <span>
                      {fileTypeFor(resource.mimeType)} ·{" "}
                      {formatBytes(resource.byteSize)}
                    </span>
                    <small>{resource.description}</small>
                  </div>
                  <div className={styles.fileActions}>
                    {resource.mimeType === "application/pdf" ? (
                      <a
                        href={`/resources/${resource.assetId}`}
                        rel="noreferrer"
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
              Ingen filer er delt med studentene i denne modulen.
            </p>
          )}
          <p className={styles.accessNote}>
            Lærerfiler vises bare for kurslærere.
          </p>
        </aside>
      </div>
    </main>
  );
}
