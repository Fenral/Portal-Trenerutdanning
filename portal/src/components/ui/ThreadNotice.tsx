"use client";

import { useEffect, useRef } from "react";

import styles from "./MessageThread.module.css";

/**
 * B3 (WCAG 4.1.3): en notis som settes inn ferdig utfylt etter navigasjon
 * annonseres ikke pålitelig av skjermlesere via role="status"/"alert".
 * Vi flytter derfor fokus til notisen ved mount og rydder ?notice fra URL-en
 * slik at refresh/tilbake ikke gjenannonserer en gammel melding.
 */
export function ThreadNotice({
  text,
  tone,
}: Readonly<{ text: string; tone: "ok" | "error" }>) {
  const ref = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    ref.current?.focus();
    const url = new URL(window.location.href);
    if (url.searchParams.has("notice")) {
      url.searchParams.delete("notice");
      window.history.replaceState(null, "", url.toString());
    }
  }, []);

  return (
    <p
      className={styles.notice}
      data-tone={tone === "error" ? "error" : undefined}
      ref={ref}
      tabIndex={-1}
    >
      <span aria-hidden="true">{tone === "error" ? "✕" : "✓"}</span> {text}
    </p>
  );
}
