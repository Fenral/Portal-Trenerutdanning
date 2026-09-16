"use client";

import { useState } from "react";
import {
  ContentDocument,
  type ContentDocument as DocumentValue,
} from "@/features/content/document-schema";
import type { CodeModule } from "./module-schema";
import styles from "./studio.module.css";

export function CodePanel({
  document,
  onChange,
}: {
  document: DocumentValue;
  onChange: (value: DocumentValue) => void;
}) {
  const [index, setIndex] = useState(0);
  const [tab, setTab] = useState<
    "html" | "css" | "javascript" | "fields" | "document"
  >("html");
  const [json, setJson] = useState("");
  const [error, setError] = useState("");
  const modules = document.blocks.flatMap((block, blockIndex) =>
    block.type === "code_module" ? [{ block, blockIndex }] : [],
  );
  const current = modules[Math.min(index, Math.max(0, modules.length - 1))];

  function changeModule(next: CodeModule) {
    if (!current) return;
    onChange({
      ...document,
      blocks: document.blocks.map((block, i) =>
        i === current.blockIndex ? next : block,
      ),
    });
  }

  return (
    <section className={styles.codeArea} aria-label="Kodeverktøy">
      <div className={styles.codeToolbar}>
        <label>
          Kodet modul
          <select
            value={Math.min(index, Math.max(0, modules.length - 1))}
            disabled={!modules.length}
            onChange={(e) => setIndex(Number(e.target.value))}
          >
            {!modules.length && <option value={0}>Ingen kodede moduler</option>}
            {modules.map(({ block }, i) => (
              <option key={block.id} value={i}>
                {block.title}
              </option>
            ))}
          </select>
        </label>
        <button
          className={styles.plainButton}
          onClick={() => {
            setJson(JSON.stringify(document, null, 2));
            setTab("document");
          }}
        >
          Hele dokumentet
        </button>
      </div>
      <div className={styles.switcher}>
        {(["html", "css", "javascript", "fields"] as const).map((value) => (
          <button
            key={value}
            disabled={!current}
            aria-pressed={tab === value}
            onClick={() => setTab(value)}
          >
            {
              {
                html: "HTML",
                css: "CSS",
                javascript: "JavaScript",
                fields: "Redigeringsfelt",
              }[value]
            }
          </button>
        ))}
      </div>
      <p className={styles.codeHint}>
        Moduler kjører isolert i nettleseren. Bruk{" "}
        <code>{'data-cms-field="navn"'}</code> i HTML og{" "}
        <code>window.cmsFields</code> i JavaScript. Kode og stil lagres sammen
        med innholdets versjon.
      </p>
      {tab === "document" ? (
        <>
          <label>
            Dokumentkode
            <textarea
              spellCheck={false}
              rows={24}
              value={json}
              onChange={(e) => setJson(e.target.value)}
            />
          </label>
          <button
            className={styles.plainButton}
            onClick={() => {
              try {
                const parsed = ContentDocument.parse(JSON.parse(json));
                onChange(parsed);
                setError("");
              } catch {
                setError(
                  "Dokumentet er ikke gyldig. Kontroller JSON og påkrevde innholdsfelt.",
                );
              }
            }}
          >
            Bruk dokumentkoden
          </button>
        </>
      ) : current ? (
        tab === "fields" ? (
          <div className={styles.fieldStack}>
            <label>
              Modulnavn
              <input
                value={current.block.title}
                onChange={(e) =>
                  changeModule({ ...current.block, title: e.target.value })
                }
              />
            </label>
            <label>
              Designsystem
              <select
                value={current.block.designSystem}
                onChange={(e) =>
                  changeModule({
                    ...current.block,
                    designSystem: e.target.value as CodeModule["designSystem"],
                  })
                }
              >
                <option value="niva">Nivå Klassisk Premium</option>
                <option value="nivaband">Nivåbånd</option>
              </select>
            </label>
            {current.block.fields.map((field, fieldIndex) => (
              <div className={styles.block} key={fieldIndex}>
                <div className={styles.fieldStack}>
                  <label>
                    Feltnavn i koden
                    <input
                      value={field.name}
                      onChange={(e) =>
                        changeModule({
                          ...current.block,
                          fields: current.block.fields.map((f, i) =>
                            i === fieldIndex
                              ? { ...f, name: e.target.value }
                              : f,
                          ),
                        })
                      }
                    />
                  </label>
                  <label>
                    Etikett i Rediger
                    <input
                      value={field.label}
                      onChange={(e) =>
                        changeModule({
                          ...current.block,
                          fields: current.block.fields.map((f, i) =>
                            i === fieldIndex
                              ? { ...f, label: e.target.value }
                              : f,
                          ),
                        })
                      }
                    />
                  </label>
                  <label>
                    Felttype
                    <select
                      value={field.type}
                      onChange={(e) =>
                        changeModule({
                          ...current.block,
                          fields: current.block.fields.map((f, i) =>
                            i === fieldIndex
                              ? {
                                  ...f,
                                  type: e.target.value as typeof field.type,
                                }
                              : f,
                          ),
                        })
                      }
                    >
                      <option value="text">Kort tekst</option>
                      <option value="textarea">Lang tekst</option>
                      <option value="number">Tall</option>
                    </select>
                  </label>
                  <label>
                    Verdi
                    <input
                      value={field.value}
                      onChange={(e) =>
                        changeModule({
                          ...current.block,
                          fields: current.block.fields.map((f, i) =>
                            i === fieldIndex
                              ? { ...f, value: e.target.value }
                              : f,
                          ),
                        })
                      }
                    />
                  </label>
                  <button
                    className={styles.textButton}
                    onClick={() =>
                      changeModule({
                        ...current.block,
                        fields: current.block.fields.filter(
                          (_, i) => i !== fieldIndex,
                        ),
                      })
                    }
                  >
                    Fjern felt
                  </button>
                </div>
              </div>
            ))}
            <button
              className={styles.plainButton}
              onClick={() =>
                changeModule({
                  ...current.block,
                  fields: [
                    ...current.block.fields,
                    {
                      name: `felt_${current.block.fields.length + 1}`,
                      label: "Nytt felt",
                      type: "text",
                      value: "",
                    },
                  ],
                })
              }
            >
              + Redigerbart felt
            </button>
          </div>
        ) : (
          <label>
            {tab === "javascript" ? "JavaScript" : tab.toUpperCase()}
            <textarea
              spellCheck={false}
              rows={24}
              value={current.block[tab]}
              onChange={(e) =>
                changeModule({ ...current.block, [tab]: e.target.value })
              }
            />
          </label>
        )
      ) : (
        <p className={styles.muted}>
          Legg til en «Kodet modul» i Rediger, eller bruk hele dokumentet for å
          bearbeide eksisterende blokker.
        </p>
      )}
      {error && (
        <div className={styles.error} role="alert">
          {error}
        </div>
      )}
    </section>
  );
}
