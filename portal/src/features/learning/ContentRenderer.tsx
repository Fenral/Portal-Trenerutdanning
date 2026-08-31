import Image from "next/image";

import type { ContentDocument } from "@/features/content/document-schema";

import styles from "./ContentRenderer.module.css";

function youtubeEmbedUrl(url: string): string {
  const parsed = new URL(url);
  const videoId =
    parsed.hostname === "youtu.be"
      ? parsed.pathname.split("/").filter(Boolean)[0]
      : (parsed.searchParams.get("v") ??
        parsed.pathname.split("/").filter(Boolean).at(-1));

  return `https://www.youtube-nocookie.com/embed/${encodeURIComponent(videoId ?? "")}`;
}

function assertNever(value: never): never {
  throw new Error(`Ukjent innholdsblokk: ${JSON.stringify(value)}`);
}

export function ContentRenderer({
  document,
  hidePrimaryHeading = true,
}: Readonly<{
  document: ContentDocument;
  hidePrimaryHeading?: boolean;
}>) {
  const primaryHeadingIndex = document.blocks.findIndex(
    (block) => block.type === "heading",
  );

  return (
    <div className={styles.blocks} data-document-format={document.format}>
      {document.blocks.map((block, index) => {
        const key = `${block.type}-${index}`;

        switch (block.type) {
          case "heading":
            if (hidePrimaryHeading && index === primaryHeadingIndex)
              return null;

            return block.level === 2 ? (
              <h2 key={key}>{block.text}</h2>
            ) : (
              <h3 key={key}>{block.text}</h3>
            );

          case "paragraph":
            return <p key={key}>{block.text}</p>;

          case "callout":
            return (
              <aside
                className={styles.callout}
                data-tone={block.tone}
                key={key}
              >
                <strong>{block.title}</strong>
                <p>{block.text}</p>
              </aside>
            );

          case "video": {
            const providerName =
              block.provider === "trackman"
                ? "TrackMan"
                : block.provider === "youtube"
                  ? "YouTube"
                  : "opplastet video";
            const videoUrl =
              block.provider === "uploaded"
                ? `/resources/${block.assetId ?? ""}`
                : (block.url ?? "");

            return (
              <section className={styles.mediaBlock} key={key}>
                <div className={styles.mediaHeading}>
                  <div aria-hidden="true" className={styles.playIcon}>
                    ▷
                  </div>
                  <div>
                    <span className={styles.blockLabel}>Fagvideo</span>
                    <h3>Fagvideo fra {providerName}</h3>
                    <p>
                      {block.required
                        ? "Videoen er en obligatorisk del av pensumet."
                        : "Videoen er anbefalt fordypning."}
                    </p>
                  </div>
                </div>

                {block.provider === "uploaded" ? (
                  <video
                    aria-label="Opplastet fagvideo"
                    className={styles.video}
                    controls
                    preload="metadata"
                  >
                    <source src={videoUrl} />
                    Nettleseren din støtter ikke videoavspilling.
                  </video>
                ) : (
                  <iframe
                    allow="fullscreen; picture-in-picture"
                    allowFullScreen
                    className={styles.videoFrame}
                    loading="lazy"
                    referrerPolicy="strict-origin-when-cross-origin"
                    sandbox="allow-scripts allow-same-origin allow-presentation"
                    src={
                      block.provider === "youtube"
                        ? youtubeEmbedUrl(videoUrl)
                        : videoUrl
                    }
                    title={`Fagvideo fra ${providerName}`}
                  />
                )}

                <a
                  className={styles.videoAlternative}
                  href={videoUrl}
                  rel="noopener noreferrer"
                  target="_blank"
                >
                  Åpne videoen i ny fane
                </a>
              </section>
            );
          }

          case "external_link":
            return (
              <a
                className={styles.externalLink}
                href={block.url}
                key={key}
                rel="noopener noreferrer"
                target="_blank"
              >
                {block.label} <span aria-hidden="true">↗</span>
              </a>
            );

          case "file":
            return (
              <a
                className={styles.externalLink}
                href={`/resources/${block.assetId}?download=1`}
                key={key}
              >
                {block.label} <span aria-hidden="true">↓</span>
              </a>
            );

          case "image":
            return (
              <figure className={styles.imageBlock} key={key}>
                <Image
                  alt={block.alt}
                  height={675}
                  sizes="(max-width: 768px) 100vw, 760px"
                  src={`/resources/${block.assetId}`}
                  unoptimized
                  width={1200}
                />
                {block.caption ? (
                  <figcaption>{block.caption}</figcaption>
                ) : null}
              </figure>
            );

          case "interactive_sequence":
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

          default:
            return assertNever(block);
        }
      })}
    </div>
  );
}
