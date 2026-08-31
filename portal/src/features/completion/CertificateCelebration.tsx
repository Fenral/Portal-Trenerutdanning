"use client";

import { useCallback, useState, useSyncExternalStore } from "react";

import styles from "./CertificateCelebration.module.css";

export function CertificateCelebration({
  certificateId,
  displayName,
}: Readonly<{
  certificateId: string;
  displayName: string;
}>) {
  const storageKey = `certificate-celebrated:${certificateId}`;
  const [celebrated, setCelebrated] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const subscribe = useCallback((notify: () => void) => {
    window.addEventListener("storage", notify);
    return () => window.removeEventListener("storage", notify);
  }, []);
  const getSnapshot = useCallback(
    () => localStorage.getItem(storageKey) === "true",
    [storageKey],
  );
  const alreadyCelebrated = useSyncExternalStore(
    subscribe,
    getSnapshot,
    () => true,
  );

  function celebrate() {
    if (alreadyCelebrated || celebrated) return;
    localStorage.setItem(storageKey, "true");
    setReducedMotion(
      window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    );
    setCelebrated(true);
    navigator.vibrate?.(50);
  }

  return (
    <section
      className={styles.celebration}
      data-celebrated={celebrated}
      data-testid="certificate-celebration"
    >
      <div aria-live="polite" className={styles.message} role="status">
        <span aria-hidden="true" className={styles.medal}>
          ✓
        </span>
        <span>
          <strong>Gratulerer, {displayName}!</strong>
          <small>Utdanningen er fullført og diplomet ditt er klart.</small>
        </span>
      </div>

      {!alreadyCelebrated && !celebrated ? (
        <button className="nivaa-button" onClick={celebrate} type="button">
          Feir fullføringen
        </button>
      ) : null}

      {celebrated ? (
        <div
          aria-hidden="true"
          className={styles.confetti}
          data-reduced-motion={reducedMotion || undefined}
        >
          {Array.from({ length: 18 }, (_, index) => (
            <i
              key={index}
              style={{ "--piece": index } as React.CSSProperties}
            />
          ))}
        </div>
      ) : null}
    </section>
  );
}
