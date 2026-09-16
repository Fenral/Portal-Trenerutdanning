"use client";

import { useState } from "react";
import type {
  ContentBlock,
  ContentDocument,
} from "@/features/content/document-schema";
import { createTemplateDocument } from "./templates";
import { documentToSlides } from "./export-html";
import styles from "./studio.module.css";

const blockLabels: Record<ContentBlock["type"], string> = {
  heading: "Overskrift",
  paragraph: "Tekst",
  callout: "Fremheving",
  interactive_sequence: "Trinnvis forklaring",
  code_module: "Kodet modul",
  external_link: "Lenke",
  video: "Video",
  image: "Bilde",
  file: "Fil",
};

export function BlockEditor({
  document,
  onChange,
}: {
  document: ContentDocument;
  onChange: (document: ContentDocument) => void;
}) {
  const [newType, setNewType] = useState("paragraph");
  const slides = documentToSlides(document);
  const hasReferenceSlide = Boolean(
    document.sources?.length || document.attachmentIds?.length,
  );
  const editableSlides = hasReferenceSlide ? slides.slice(0, -1) : slides;
  function update(index: number, block: ContentBlock) {
    onChange({
      ...document,
      blocks: document.blocks.map((existing, i) =>
        i === index ? block : existing,
      ),
    });
  }
  function move(index: number, delta: number) {
    const blocks = [...document.blocks];
    [blocks[index], blocks[index + delta]] = [
      blocks[index + delta],
      blocks[index],
    ];
    onChange({ ...document, blocks });
  }
  function add() {
    let block: ContentBlock;
    switch (newType) {
      case "heading":
        block = { type: "heading", level: 2, text: "Ny overskrift" };
        break;
      case "callout":
        block = {
          type: "callout",
          tone: "practice",
          title: "Refleksjon",
          text: "Hvordan vil du bruke dette i trenerhverdagen?",
        };
        break;
      case "external_link":
        block = { type: "external_link", url: "https://", label: "Fordypning" };
        break;
      case "video":
        block = {
          type: "video",
          provider: "youtube",
          url: "https://www.youtube.com/",
          required: false,
        };
        break;
      case "interactive_sequence":
        block = {
          type: "interactive_sequence",
          desktopMode: "next_previous",
          mobileMode: "stacked",
          steps: [
            {
              id: "kartlegg",
              title: "Kartlegg",
              text: "Ta utgangspunkt i utøverens behov.",
            },
            {
              id: "planlegg",
              title: "Planlegg",
              text: "Velg tiltak som støtter utviklingen.",
            },
          ],
        };
        break;
      case "code_module": {
        const candidates = createTemplateDocument(
          "interactive",
          "Interaktiv forklaring",
        ).blocks;
        const codeBlock = candidates.find(
          (entry) => entry.type === "code_module",
        );
        block = codeBlock
          ? { ...codeBlock, id: crypto.randomUUID() }
          : {
              type: "code_module",
              id: crypto.randomUUID(),
              title: "Ny modul",
              html: '<section><h2 data-cms-field="title"></h2><p>Bygg videre med HTML, CSS og JavaScript.</p></section>',
              css: "section { padding: 24px; }",
              javascript: "",
              designSystem: "niva",
              designVersion: "2026-09-16",
              fields: [
                {
                  name: "title",
                  label: "Tittel",
                  type: "text",
                  value: "Min modul",
                },
              ],
            };
        break;
      }
      default:
        block = { type: "paragraph", text: "Skriv faginnholdet her." };
    }
    onChange({ ...document, blocks: [...document.blocks, block] });
  }

  return (
    <>
      <div className={styles.sectionHeading}>
        <div>
          <h2>Rediger innhold</h2>
          <p className={styles.muted}>
            Endringene vises med en gang. Lagre kladden når du er klar.
          </p>
        </div>
      </div>
      {document.blocks.map((block, index) => (
        <section key={index} className={styles.block}>
          <div className={styles.blockHeading}>
            <strong>
              {index + 1}. {blockLabels[block.type]}
            </strong>
            <div className={styles.blockButtons}>
              <button
                type="button"
                disabled={index === 0}
                aria-label={`Flytt blokk ${index + 1} opp`}
                onClick={() => move(index, -1)}
              >
                ↑
              </button>
              <button
                type="button"
                disabled={index === document.blocks.length - 1}
                aria-label={`Flytt blokk ${index + 1} ned`}
                onClick={() => move(index, 1)}
              >
                ↓
              </button>
              <button
                type="button"
                disabled={document.blocks.length === 1}
                aria-label={`Fjern blokk ${index + 1}`}
                onClick={() =>
                  onChange({
                    ...document,
                    blocks: document.blocks.filter((_, i) => i !== index),
                  })
                }
              >
                ×
              </button>
            </div>
          </div>
          <div className={styles.fieldStack}>
            {block.type === "heading" && (
              <>
                <label>
                  Overskrift
                  <input
                    maxLength={180}
                    value={block.text}
                    onChange={(e) =>
                      update(index, { ...block, text: e.target.value })
                    }
                  />
                </label>
                <label>
                  Overskriftsnivå
                  <select
                    value={block.level}
                    onChange={(e) =>
                      update(index, {
                        ...block,
                        level: Number(e.target.value) as 2 | 3,
                      })
                    }
                  >
                    <option value={2}>Hovedseksjon</option>
                    <option value={3}>Underseksjon</option>
                  </select>
                </label>
              </>
            )}
            {block.type === "paragraph" && (
              <label>
                Tekst
                <textarea
                  rows={5}
                  maxLength={10000}
                  value={block.text}
                  onChange={(e) =>
                    update(index, { ...block, text: e.target.value })
                  }
                />
              </label>
            )}
            {block.type === "callout" && (
              <>
                <label>
                  Tittel
                  <input
                    value={block.title}
                    maxLength={120}
                    onChange={(e) =>
                      update(index, { ...block, title: e.target.value })
                    }
                  />
                </label>
                <label>
                  Innhold
                  <textarea
                    rows={3}
                    maxLength={2000}
                    value={block.text}
                    onChange={(e) =>
                      update(index, { ...block, text: e.target.value })
                    }
                  />
                </label>
                <label>
                  Type
                  <select
                    value={block.tone}
                    onChange={(e) =>
                      update(index, {
                        ...block,
                        tone: e.target.value as typeof block.tone,
                      })
                    }
                  >
                    <option value="practice">Refleksjon / praksis</option>
                    <option value="info">Informasjon</option>
                    <option value="warning">Vær oppmerksom</option>
                  </select>
                </label>
              </>
            )}
            {block.type === "code_module" && (
              <>
                <p className={styles.muted}>
                  Disse feltene er gjort redigerbare i modulen. Utforming og
                  interaksjon endres under Bygg → Kode.
                </p>
                {block.fields.map((field, fieldIndex) => (
                  <label key={field.name}>
                    {field.label}
                    {field.type === "textarea" ? (
                      <textarea
                        rows={3}
                        value={field.value}
                        onChange={(e) =>
                          update(index, {
                            ...block,
                            fields: block.fields.map((f, i) =>
                              i === fieldIndex
                                ? { ...f, value: e.target.value }
                                : f,
                            ),
                          })
                        }
                      />
                    ) : (
                      <input
                        type={field.type === "number" ? "number" : "text"}
                        value={field.value}
                        onChange={(e) =>
                          update(index, {
                            ...block,
                            fields: block.fields.map((f, i) =>
                              i === fieldIndex
                                ? { ...f, value: e.target.value }
                                : f,
                            ),
                          })
                        }
                      />
                    )}
                  </label>
                ))}
              </>
            )}
            {block.type === "interactive_sequence" && (
              <>
                {block.steps.map((step, stepIndex) => (
                  <div key={step.id} className={styles.fieldStack}>
                    <label>
                      Trinn {stepIndex + 1}
                      <input
                        value={step.title}
                        maxLength={120}
                        onChange={(e) =>
                          update(index, {
                            ...block,
                            steps: block.steps.map((s, i) =>
                              i === stepIndex
                                ? { ...s, title: e.target.value }
                                : s,
                            ),
                          })
                        }
                      />
                    </label>
                    <label>
                      Forklaring
                      <textarea
                        rows={3}
                        maxLength={2000}
                        value={step.text}
                        onChange={(e) =>
                          update(index, {
                            ...block,
                            steps: block.steps.map((s, i) =>
                              i === stepIndex
                                ? { ...s, text: e.target.value }
                                : s,
                            ),
                          })
                        }
                      />
                    </label>
                    <button
                      className={styles.textButton}
                      disabled={block.steps.length <= 2}
                      onClick={() =>
                        update(index, {
                          ...block,
                          steps: block.steps.filter((_, i) => i !== stepIndex),
                        })
                      }
                    >
                      Fjern trinn
                    </button>
                  </div>
                ))}
                <button
                  className={styles.plainButton}
                  disabled={block.steps.length >= 30}
                  onClick={() =>
                    update(index, {
                      ...block,
                      steps: [
                        ...block.steps,
                        {
                          id: `steg-${crypto.randomUUID()}`,
                          title: "Nytt trinn",
                          text: "Beskriv trinnet.",
                        },
                      ],
                    })
                  }
                >
                  + Legg til trinn
                </button>
              </>
            )}
            {block.type === "external_link" && (
              <>
                <label>
                  Lenketekst
                  <input
                    value={block.label}
                    maxLength={120}
                    onChange={(e) =>
                      update(index, { ...block, label: e.target.value })
                    }
                  />
                </label>
                <label>
                  Nettadresse
                  <input
                    type="url"
                    value={block.url}
                    onChange={(e) =>
                      update(index, { ...block, url: e.target.value })
                    }
                  />
                </label>
              </>
            )}
            {block.type === "video" && (
              <>
                <label>
                  Leverandør
                  <select
                    value={block.provider}
                    disabled={block.provider === "uploaded"}
                    onChange={(e) =>
                      update(index, {
                        ...block,
                        provider: e.target.value as "youtube" | "trackman",
                      })
                    }
                  >
                    <option value="youtube">YouTube</option>
                    <option value="trackman">TrackMan</option>
                    {block.provider === "uploaded" && (
                      <option value="uploaded">Opplastet video</option>
                    )}
                  </select>
                </label>
                {block.provider !== "uploaded" && (
                  <label>
                    Videoadresse
                    <input
                      type="url"
                      value={block.url ?? ""}
                      onChange={(e) =>
                        update(index, { ...block, url: e.target.value })
                      }
                    />
                  </label>
                )}
                <label>
                  <span>
                    <input
                      type="checkbox"
                      checked={block.required}
                      onChange={(e) =>
                        update(index, { ...block, required: e.target.checked })
                      }
                    />{" "}
                    Obligatorisk fagvideo
                  </span>
                </label>
                <label>
                  <span>
                    <input
                      type="checkbox"
                      checked={block.hasAudio !== false}
                      onChange={(e) =>
                        update(index, { ...block, hasAudio: e.target.checked })
                      }
                    />{" "}
                    Videoen har lyd
                  </span>
                </label>
                {block.provider !== "uploaded" && (
                  <label>
                    <span>
                      <input
                        type="checkbox"
                        checked={block.captionsConfirmedAtProvider === true}
                        onChange={(e) =>
                          update(index, {
                            ...block,
                            captionsConfirmedAtProvider: e.target.checked,
                          })
                        }
                      />{" "}
                      Teksting er bekreftet hos leverandøren
                    </span>
                  </label>
                )}
                {block.provider === "uploaded" && (
                  <p className={styles.muted}>
                    Teksting:{" "}
                    {block.captionsAssetId ? "tilgjengelig" : "mangler"}.
                    Teksting håndteres av mediebiblioteket.
                  </p>
                )}
                <label>
                  Tekstalternativ / transkripsjon
                  <textarea
                    rows={5}
                    maxLength={50000}
                    value={block.transcript ?? ""}
                    onChange={(e) =>
                      update(index, { ...block, transcript: e.target.value })
                    }
                  />
                </label>
              </>
            )}
            {block.type === "image" && (
              <>
                <label>
                  Beskrivelse for skjermleser
                  <input
                    value={block.alt}
                    onChange={(e) =>
                      update(index, { ...block, alt: e.target.value })
                    }
                  />
                </label>
                <label>
                  Bildetekst
                  <input
                    value={block.caption ?? ""}
                    onChange={(e) =>
                      update(index, { ...block, caption: e.target.value })
                    }
                  />
                </label>
              </>
            )}
            {block.type === "file" && (
              <label>
                Filens visningsnavn
                <input
                  value={block.label}
                  onChange={(e) =>
                    update(index, { ...block, label: e.target.value })
                  }
                />
              </label>
            )}
          </div>
        </section>
      ))}
      <div className={styles.addBlock}>
        <select
          aria-label="Ny innholdsblokk"
          value={newType}
          onChange={(e) => setNewType(e.target.value)}
        >
          {[
            "paragraph",
            "heading",
            "callout",
            "interactive_sequence",
            "code_module",
            "external_link",
            "video",
          ].map((type) => (
            <option key={type} value={type}>
              {blockLabels[type as ContentBlock["type"]]}
            </option>
          ))}
        </select>
        <button className={styles.plainButton} onClick={add}>
          + Legg til
        </button>
      </div>
      <details className={styles.sources}>
        <summary>
          Kilder og faglig grunnlag ({document.sources?.length ?? 0})
        </summary>
        {(document.sources ?? []).map((source, index) => (
          <div className={styles.sourceRow} key={index}>
            <label>
              Kildetittel
              <input
                value={source.title}
                onChange={(e) =>
                  onChange({
                    ...document,
                    sources: document.sources?.map((s, i) =>
                      i === index ? { ...s, title: e.target.value } : s,
                    ),
                  })
                }
              />
            </label>
            <label>
              Nettadresse (valgfritt)
              <input
                type="url"
                value={source.url ?? ""}
                onChange={(e) =>
                  onChange({
                    ...document,
                    sources: document.sources?.map((s, i) =>
                      i === index
                        ? {
                            title: s.title,
                            ...(e.target.value ? { url: e.target.value } : {}),
                          }
                        : s,
                    ),
                  })
                }
              />
            </label>
            <button
              className={styles.textButton}
              onClick={() =>
                onChange({
                  ...document,
                  sources: document.sources?.filter((_, i) => i !== index),
                })
              }
            >
              Fjern kilde
            </button>
          </div>
        ))}
        <button
          className={styles.textButton}
          onClick={() =>
            onChange({
              ...document,
              sources: [...(document.sources ?? []), { title: "Ny fagkilde" }],
            })
          }
        >
          + Legg til kilde
        </button>
      </details>
      <details className={styles.sources}>
        <summary>Forelesernotater ({editableSlides.length})</summary>
        {editableSlides.map((slide, index) => {
          const heading = slide.document.blocks.find(
            (block) => block.type === "heading" && block.level === 2,
          );
          const title =
            heading?.type === "heading"
              ? heading.text
              : `Lysbilde ${index + 1}`;
          return (
            <div className={styles.sourceRow} key={index}>
              <label>
                {`Lysbilde ${index + 1}: ${title}`}
                <textarea
                  rows={4}
                  maxLength={20000}
                  value={document.speakerNotes?.[index] ?? ""}
                  onChange={(e) => {
                    const speakerNotes = Array.from(
                      {
                        length: Math.max(
                          index + 1,
                          document.speakerNotes?.length ?? 0,
                        ),
                      },
                      (_, i) => document.speakerNotes?.[i] ?? "",
                    );
                    speakerNotes[index] = e.target.value;
                    onChange({ ...document, speakerNotes });
                  }}
                />
              </label>
            </div>
          );
        })}
      </details>
    </>
  );
}
