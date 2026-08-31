import Link from "next/link";

import { loadStudentContentCatalog } from "@/features/content/student-data";
import { createSupabaseServerClient } from "@/lib/supabase/server";

import styles from "./page.module.css";

export default async function StudentPage() {
  const client = await createSupabaseServerClient();
  const content = await loadStudentContentCatalog(client);

  return (
    <main className={styles.page} id="main-content">
      <div className={styles.hero}>
        <div>
          <span className="nivaa-status nivaa-status--success">
            Klar til å starte
          </span>
          <h1>Tilgangen er aktivert</h1>
          <p>
            Velkommen til læringsløpet. Her finner du publisert pensum og filene
            som er delt med kullet ditt.
          </p>
        </div>
        <div className={styles.progressCard}>
          <strong>0 %</strong>
          <span>Total progresjon</span>
          <div className="nivaa-progress__track" aria-hidden="true">
            <span style={{ width: "0%" }} />
          </div>
        </div>
      </div>

      <section className={styles.section} id="laeringslop">
        <div className={styles.sectionHeading}>
          <div>
            <p className={styles.eyebrow}>Pensum</p>
            <h2>Ditt læringsløp</h2>
          </div>
          <span>{content.length} publiserte moduler</span>
        </div>

        {content.length ? (
          <div className={styles.contentGrid}>
            {content.map((item, index) => (
              <article className={styles.contentCard} key={item.id}>
                <div className={styles.moduleNumber} aria-hidden="true">
                  {String(index + 1).padStart(2, "0")}
                </div>
                <div>
                  <p className={styles.courseLabel}>{item.courseTitle}</p>
                  <h3>{item.heading}</h3>
                  <p>{item.introduction}</p>
                  <div className={styles.cardMeta}>
                    <span>Publisert versjon {item.revisionNumber}</span>
                    <span>Ikke startet</span>
                  </div>
                </div>
                <Link
                  aria-label={`Åpne ${item.heading}`}
                  className="nivaa-button nivaa-button--primary"
                  href={`/student/content/${item.id}`}
                >
                  Start modulen
                </Link>
              </article>
            ))}
          </div>
        ) : (
          <div className={styles.emptyState}>
            <h3>Ingen publiserte moduler ennå</h3>
            <p>
              Tilgangen din virker. Innholdet dukker opp her når redaktøren
              publiserer det til kullet ditt.
            </p>
          </div>
        )}
      </section>
    </main>
  );
}
