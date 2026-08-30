import Link from "next/link";

import { Button } from "@/components/ui/Button";
import { Progress } from "@/components/ui/Progress";
import { Status } from "@/components/ui/Status";

import styles from "./page.module.css";

export default function DesignSystemPage() {
  return (
    <main className={styles.page} id="main-content">
      <div className={styles.shell}>
        <Link className={styles.backLink} href="/">
          Tilbake til portalen
        </Link>

        <header className={styles.intro}>
          <h1>Nivå Klassisk Premium</h1>
          <p>
            Et rolig og presist grensesnitt for læring, oppfølging og
            administrasjon. Én tydelig neste handling får alltid mest vekt.
          </p>
        </header>

        <div className={styles.board}>
          <section className={styles.specimen} aria-labelledby="actions-title">
            <div className={styles.copy}>
              <h2 id="actions-title">Handlinger</h2>
              <p>
                Primær brukes én gang per arbeidsflate. Sekundær og stille
                støtter uten å konkurrere.
              </p>
            </div>
            <div className={`${styles.example} ${styles.wrap}`}>
              <Button priority="primary">Fortsett modul</Button>
              <Button priority="secondary">Se læringsplan</Button>
              <Button priority="quiet">Avbryt</Button>
              <Button disabled>Utilgjengelig</Button>
            </div>
          </section>

          <section className={styles.specimen} aria-labelledby="status-title">
            <div className={styles.copy}>
              <h2 id="status-title">Status</h2>
              <p>
                Ord, symbol og farge gir samme beskjed. Farge står aldri alene.
              </p>
            </div>
            <div className={`${styles.example} ${styles.wrap}`}>
              <Status tone="success">I rute</Status>
              <Status tone="warning">Litt bak</Status>
              <Status tone="error">Krever handling</Status>
              <Status tone="info">Til vurdering</Status>
            </div>
          </section>

          <section className={styles.specimen} aria-labelledby="progress-title">
            <div className={styles.copy}>
              <h2 id="progress-title">Progresjon</h2>
              <p>
                Total progresjon bruker prosent. Enkeltmoduler får senere
                konkrete mål som «7 av 11».
              </p>
            </div>
            <div className={styles.progressStack}>
              <Progress label="Ikke startet" value={0} />
              <Progress label="Midt i læringsløpet" value={62} />
              <Progress label="Fullført" value={100} />
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
