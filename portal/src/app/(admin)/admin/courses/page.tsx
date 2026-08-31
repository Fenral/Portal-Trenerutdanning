import Link from "next/link";
import { notFound } from "next/navigation";

import { isAdministrator } from "@/features/access/require-administrator";
import {
  loadCoursePortfolio,
  type CourseRunView,
  type CourseSessionView,
} from "@/features/courses/portfolio";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

import styles from "./page.module.css";

export const dynamic = "force-dynamic";

const dayFormatter = new Intl.DateTimeFormat("nb-NO", {
  day: "numeric",
  timeZone: "Europe/Oslo",
});
const monthFormatter = new Intl.DateTimeFormat("nb-NO", {
  month: "long",
  timeZone: "Europe/Oslo",
});
const yearFormatter = new Intl.DateTimeFormat("nb-NO", {
  year: "numeric",
  timeZone: "Europe/Oslo",
});

function formatSessionDate(session: CourseSessionView): string {
  const startsAt = new Date(session.startsAt);
  const endsAt = new Date(session.endsAt);
  const startDay = dayFormatter.format(startsAt).replace(/\.$/, "");
  const endDay = dayFormatter.format(endsAt).replace(/\.$/, "");
  const startMonth = monthFormatter.format(startsAt);
  const endMonth = monthFormatter.format(endsAt);
  const startYear = yearFormatter.format(startsAt);
  const endYear = yearFormatter.format(endsAt);

  if (startDay === endDay && startMonth === endMonth && startYear === endYear) {
    return startDay + ". " + startMonth + " " + startYear;
  }

  if (startMonth === endMonth && startYear === endYear) {
    return startDay + ".–" + endDay + ". " + endMonth + " " + endYear;
  }

  return (
    startDay +
    ". " +
    startMonth +
    "–" +
    endDay +
    ". " +
    endMonth +
    " " +
    endYear
  );
}

function SessionList({ sessions }: { sessions: CourseSessionView[] }) {
  return (
    <ol className={styles.sessions}>
      {sessions.map((session) => (
        <li key={session.id}>
          <span>
            {session.sessionType === "youth_drive"
              ? "Ungdomsdriven · valgfri"
              : session.title}
          </span>
          <strong>{formatSessionDate(session)}</strong>
          {session.locationText ? <small>{session.locationText}</small> : null}
        </li>
      ))}
    </ol>
  );
}

function SingleCourseGroup({
  code,
  run,
}: {
  code: "T2" | "T3";
  run: CourseRunView;
}) {
  return (
    <section
      className={styles.courseGroup}
      data-testid={code === "T3" ? "t3-course-group" : "t2-course-group"}
    >
      <div className={styles.groupHeading}>
        <div>
          <p className={styles.kicker}>{code}</p>
          <h2>{run.title}</h2>
        </div>
        <div className={styles.groupMeta}>
          <strong>{run.displayYear}</strong>
          <span>{run.sessions.length} samlinger</span>
          <Link href={`/admin/courses/${run.id}`}>Åpne {run.title}</Link>
        </div>
      </div>
      <SessionList sessions={run.sessions} />
    </section>
  );
}

export default async function AdminCoursesPage() {
  const serverClient = await createSupabaseServerClient();
  const {
    data: { user },
  } = await serverClient.auth.getUser();
  const adminClient = createSupabaseAdminClient();

  if (!user || !(await isAdministrator(user.id, adminClient))) {
    notFound();
  }

  const portfolio = await loadCoursePortfolio(adminClient);
  const t1Runs = portfolio.filter((run) => run.templateCode === "T1");
  const t2Run = portfolio.find((run) => run.templateCode === "T2");
  const t3Run = portfolio.find((run) => run.templateCode === "T3");

  return (
    <main className={styles.shell} id="main-content">
      <header className={styles.hero}>
        <div>
          <p className={styles.eyebrow}>Administrator · kursportefølje</p>
          <h1>Kursgjennomføringer</h1>
          <p>
            Velg trinn, kurssted og samling. Trener 1 kan foldes sammen når du
            vil arbeide med Trener 2 eller Trener 3.
          </p>
        </div>
        <Link
          className="nivaa-button nivaa-button--primary"
          href="/admin/courses/new"
        >
          Ny kursgjennomføring
        </Link>
      </header>

      <div className={styles.summary}>
        <span>
          <strong>{portfolio.length}</strong> kursgjennomføringer
        </span>
        <span>
          <strong>{t1Runs.length}</strong> kurssteder på Trener 1
        </span>
      </div>

      <details className={styles.t1Details} data-testid="t1-course-group">
        <summary>
          <span>
            <span className={styles.kicker}>T1</span>
            <strong>Trener 1 · {t1Runs.length} kurssteder</strong>
          </span>
          <span className={styles.summaryHint}>Vis kurssteder</span>
        </summary>
        <div className={styles.t1Grid}>
          {t1Runs.map((run) => (
            <article className={styles.locationCard} key={run.id}>
              <div>
                <h2>{run.locationName}</h2>
                <span>{run.displayYear}</span>
              </div>
              <SessionList sessions={run.sessions} />
              <Link href={`/admin/courses/${run.id}`}>Åpne {run.title}</Link>
            </article>
          ))}
        </div>
      </details>

      {t2Run ? <SingleCourseGroup code="T2" run={t2Run} /> : null}
      {t3Run ? <SingleCourseGroup code="T3" run={t3Run} /> : null}
    </main>
  );
}
