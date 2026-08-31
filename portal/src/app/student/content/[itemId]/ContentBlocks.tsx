import type { ContentDocument } from "@/features/content/document-schema";

import styles from "./page.module.css";

export function ContentBlocks({
  document,
}: Readonly<{ document: ContentDocument }>) {
  const primaryHeadingIndex = document.blocks.findIndex(
    (block) => block.type === "heading",
  );

  return (
    <div className={styles.blocks}>
      {document.blocks.map((block, index) => {
        const key = `${block.type}-${index}`;

        if (block.type === "heading") {
          if (index === primaryHeadingIndex) return null;

          return block.level === 2 ? (
            <h2 key={key}>{block.text}</h2>
          ) : (
            <h3 key={key}>{block.text}</h3>
          );
        }

        if (block.type === "paragraph") {
          return <p key={key}>{block.text}</p>;
        }

        if (block.type === "callout") {
          return (
            <aside className={styles.callout} data-tone={block.tone} key={key}>
              <strong>{block.title}</strong>
              <p>{block.text}</p>
            </aside>
          );
        }

        if (block.type === "video") {
          return (
            <article className={styles.mediaBlock} key={key}>
              <div aria-hidden="true" className={styles.playIcon}>
                ▷
              </div>
              <div>
                <span className={styles.blockLabel}>Fagvideo</span>
                <h3>
                  {block.provider === "trackman"
                    ? "Forklaring fra TrackMan"
                    : "Se fagvideo"}
                </h3>
                <p>
                  {block.required
                    ? "Videoen er en obligatorisk del av pensumet."
                    : "Videoen er anbefalt fordypning."}
                </p>
              </div>
              <a
                className="nivaa-button nivaa-button--secondary"
                href={block.url}
                rel="noreferrer"
                target="_blank"
              >
                Åpne video
              </a>
            </article>
          );
        }

        if (block.type === "external_link") {
          return (
            <a
              className={styles.externalLink}
              href={block.url}
              key={key}
              rel="noreferrer"
              target="_blank"
            >
              {block.label} <span aria-hidden="true">↗</span>
            </a>
          );
        }

        if (block.type === "file") {
          return (
            <a
              className={styles.externalLink}
              href={`/resources/${block.assetId}?download=1`}
              key={key}
            >
              {block.label} <span aria-hidden="true">↓</span>
            </a>
          );
        }

        if (block.type === "image") {
          return (
            <figure className={styles.imageBlock} key={key}>
              <a href={`/resources/${block.assetId}`} target="_blank">
                Åpne illustrasjon: {block.alt}
              </a>
              {block.caption ? <figcaption>{block.caption}</figcaption> : null}
            </figure>
          );
        }

        return (
          <section className={styles.sequence} key={key}>
            <span className={styles.blockLabel}>Interaktiv forklaring</span>
            <ol>
              {block.steps.map((step) => (
                <li key={step.id}>
                  <strong>{step.title}</strong>
                  <p>{step.text}</p>
                </li>
              ))}
            </ol>
          </section>
        );
      })}
    </div>
  );
}
