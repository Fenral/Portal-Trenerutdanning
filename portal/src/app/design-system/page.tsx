import Link from "next/link";

import { Button } from "@/components/ui/Button";
import { Progress } from "@/components/ui/Progress";
import { Status } from "@/components/ui/Status";
import { buildCourseTimeline } from "@/features/learning/course-timeline";
import { CourseTimeline } from "@/features/learning/CourseTimeline";

import styles from "./page.module.css";

const demoTimeline = buildCourseTimeline(
  [
    {
      id: "d1",
      title: "Samling 1",
      startsAt: new Date("2026-02-15T08:00:00Z"),
      endsAt: new Date("2026-02-15T16:00:00Z"),
    },
    {
      id: "d2",
      title: "Samling 2",
      startsAt: new Date("2026-05-08T08:00:00Z"),
      endsAt: new Date("2026-05-10T16:00:00Z"),
    },
    {
      id: "d3",
      title: "Samling 3",
      startsAt: new Date("2026-09-20T08:00:00Z"),
      endsAt: new Date("2026-09-20T16:00:00Z"),
    },
    {
      id: "d4",
      title: "Samling 4",
      startsAt: new Date("2027-03-19T08:00:00Z"),
      endsAt: new Date("2027-03-21T16:00:00Z"),
    },
  ],
  [
    {
      activityId: "demo-a1",
      title: "Innlevering 1",
      deadline: new Date("2026-08-20T22:00:00Z"),
      completed: false,
    },
    {
      activityId: "demo-a2",
      title: "Innlevering 2",
      deadline: new Date("2026-11-01T22:00:00Z"),
      completed: false,
    },
  ],
  new Date("2026-09-01T10:00:00Z"),
);

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

          <section className={styles.specimen} aria-labelledby="timeline-title">
            <div className={styles.copy}>
              <h2 id="timeline-title">Kurstidslinje</h2>
              <p>
                Samlinger og frister på ett spor, med «du er her»-markør.
                Gjennomført, kommende og forfalt vises med form, tekst og farge.
              </p>
            </div>
            <CourseTimeline
              courseTitle="Trener 3 · demo"
              timeline={demoTimeline}
            />
          </section>
        </div>
      </div>
    </main>
  );
}
