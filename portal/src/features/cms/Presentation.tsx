"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { Button } from "@/components/ui/Button";
import type { ContentDocument } from "@/features/content/document-schema";
import { ContentRenderer } from "@/features/learning/ContentRenderer";

import { documentToSlides } from "./export-html";
import styles from "./presentation.module.css";

export function Presentation({
  document: contentDocument,
  title,
}: Readonly<{ document: ContentDocument; title: string }>) {
  const slides = useMemo(
    () => documentToSlides(contentDocument),
    [contentDocument],
  );
  const [index, setIndex] = useState(0);
  const [notesVisible, setNotesVisible] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [status, setStatus] = useState("");
  const container = useRef<HTMLElement>(null);
  const current = Math.min(index, Math.max(0, slides.length - 1));
  const slide = slides[current];

  useEffect(() => {
    function keydown(event: KeyboardEvent) {
      if (
        event.altKey ||
        event.ctrlKey ||
        event.metaKey ||
        (event.target instanceof Element &&
          event.target.closest(
            "input,textarea,select,[contenteditable='true']",
          ))
      )
        return;
      if (event.key === "ArrowRight" || event.key === "PageDown") {
        event.preventDefault();
        setIndex((value) => Math.min(value + 1, slides.length - 1));
      }
      if (event.key === "ArrowLeft" || event.key === "PageUp") {
        event.preventDefault();
        setIndex((value) =>
          Math.max(0, Math.min(value, slides.length - 1) - 1),
        );
      }
      if (event.key === "Home") {
        event.preventDefault();
        setIndex(0);
      }
      if (event.key === "End") {
        event.preventDefault();
        setIndex(slides.length - 1);
      }
    }
    function fullscreenChanged() {
      setFullscreen(document.fullscreenElement === container.current);
    }
    window.addEventListener("keydown", keydown);
    document.addEventListener("fullscreenchange", fullscreenChanged);
    return () => {
      window.removeEventListener("keydown", keydown);
      document.removeEventListener("fullscreenchange", fullscreenChanged);
    };
  }, [slides.length]);

  async function toggleFullscreen() {
    setStatus("");
    try {
      if (document.fullscreenElement === container.current) {
        await document.exitFullscreen();
      } else if (container.current?.requestFullscreen) {
        await container.current.requestFullscreen();
      } else {
        setStatus("Nettleseren støtter ikke fullskjerm her.");
      }
    } catch {
      setStatus("Fullskjerm kunne ikke åpnes i denne nettleseren.");
    }
  }

  if (!slide) return <p>Presentasjonen har ikke innhold ennå.</p>;

  return (
    <section
      aria-label={`Presentasjon: ${title}`}
      className={styles.presentation}
      ref={container}
    >
      <header className={styles.toolbar}>
        <p className={styles.title}>{title}</p>
        <div className={styles.tools}>
          <Button
            aria-expanded={notesVisible}
            onClick={() => setNotesVisible((value) => !value)}
            priority="quiet"
          >
            {notesVisible ? "Skjul lærernotater" : "Vis lærernotater"}
          </Button>
          <Button onClick={toggleFullscreen} priority="quiet">
            {fullscreen ? "Avslutt fullskjerm" : "Fullskjerm"}
          </Button>
        </div>
      </header>

      <div className={styles.stage}>
        <div
          aria-label={`Lysbilde ${current + 1} av ${slides.length}`}
          aria-roledescription="lysbilde"
          className={styles.slide}
          role="region"
        >
          <ContentRenderer
            document={slide.document}
            hidePrimaryHeading={false}
          />
        </div>
        {notesVisible ? (
          <aside className={styles.speakerNotes}>
            <h2>Lærernotater</h2>
            <p>{slide.notes || "Ingen lærernotater for dette lysbildet."}</p>
          </aside>
        ) : null}
      </div>

      <footer className={styles.controls}>
        <div>
          <p aria-live="polite" className={styles.counter}>
            Lysbilde {current + 1} av {slides.length}
          </p>
          <progress
            aria-label="Fremdrift i presentasjonen"
            className={styles.progress}
            max={slides.length}
            value={current + 1}
          />
          <p className={styles.hint} role="status">
            {status || "Bruk piltastene for å bytte lysbilde."}
          </p>
        </div>
        <nav aria-label="Bytt lysbilde" className={styles.paging}>
          <Button
            disabled={current === 0}
            onClick={() => setIndex(Math.max(0, current - 1))}
          >
            Forrige
          </Button>
          <Button
            disabled={current === slides.length - 1}
            onClick={() => setIndex(Math.min(slides.length - 1, current + 1))}
            priority="primary"
          >
            Neste
          </Button>
        </nav>
      </footer>
    </section>
  );
}
