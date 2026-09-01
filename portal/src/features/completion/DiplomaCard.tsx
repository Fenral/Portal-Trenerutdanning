import styles from "./DiplomaCard.module.css";

export type DiplomaCardData = Readonly<{
  courseTitle: string;
  completedOnLabel: string;
  certificateNumber: string;
  downloadUrl: string;
}>;

export function DiplomaCard({
  diploma,
}: Readonly<{ diploma: DiplomaCardData }>) {
  return (
    <section aria-labelledby="diploma-card-title" className={styles.card}>
      <div className={styles.badge} aria-hidden="true">
        <svg viewBox="0 0 24 24">
          <path d="M7 4h10v8a5 5 0 0 1-10 0V4Z" />
          <path d="M7 6H4v2a4 4 0 0 0 4 4M17 6h3v2a4 4 0 0 1-4 4M12 17v3M8.5 20h7" />
        </svg>
      </div>
      <div className={styles.copy}>
        <h2 id="diploma-card-title">Diplomet ditt er klart</h2>
        <p>
          {diploma.courseTitle} · Fullført {diploma.completedOnLabel}
        </p>
        <small>Diplomnr. {diploma.certificateNumber}</small>
      </div>
      <a
        className="nivaa-button nivaa-button--primary"
        href={diploma.downloadUrl}
      >
        Last ned diplom
      </a>
    </section>
  );
}
