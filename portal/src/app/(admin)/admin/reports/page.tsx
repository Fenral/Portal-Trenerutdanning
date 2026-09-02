import { notFound } from "next/navigation";

import { isAdministrator } from "@/features/access/require-administrator";
import { loadCoursePortfolio } from "@/features/courses/portfolio";
import {
  REPORT_TYPES,
  reportDefinitions,
} from "@/features/reporting/definitions";
import { nifCourseIdsForTemplate } from "@/features/reporting/nif-report-data";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

import styles from "./page.module.css";

export const dynamic = "force-dynamic";

export default async function AdminReportsPage() {
  const serverClient = await createSupabaseServerClient();
  const {
    data: { user },
  } = await serverClient.auth.getUser();
  const adminClient = createSupabaseAdminClient();
  if (!user || !(await isAdministrator(user.id, adminClient))) notFound();

  const courses = await loadCoursePortfolio(adminClient);

  return (
    <main className={styles.page} id="main-content">
      <header className={styles.hero}>
        <div>
          <p className={styles.eyebrow}>Administrator · rapportering</p>
          <h1>Rapporter</h1>
          <p>
            Last ned kursrapporter og NIF-årsrapporten. Alle rapporter bygger på
            samme definisjoner som portalen viser, og kullsnitt holder deltakere
            som har trukket seg utenfor.
          </p>
        </div>
        <span className={styles.formatBadge}>Excel · PDF</span>
      </header>

      <section aria-labelledby="course-run-reports" className={styles.reports}>
        <div className={styles.sectionHeading}>
          <div>
            <h2 id="course-run-reports">Kursrapporter</h2>
            <p>Sju rapporttyper per kursgjennomføring, som Excel eller PDF.</p>
          </div>
          <strong>{courses.length} kursgjennomføringer</strong>
        </div>

        <div className={styles.reportList}>
          {courses.map((course) => (
            <article className={styles.courseReportCard} key={course.id}>
              <div className={styles.courseReportHeader}>
                <div className={styles.level}>
                  <span>{course.templateCode}</span>
                </div>
                <div className={styles.reportIdentity}>
                  <h3>{course.title}</h3>
                  <p>
                    {course.displayYear}
                    {course.locationName ? ` · ${course.locationName}` : ""}
                  </p>
                </div>
              </div>
              <ul className={styles.reportTypeList}>
                {REPORT_TYPES.map((type) => {
                  const definition = reportDefinitions[type];
                  return (
                    <li className={styles.reportTypeRow} key={type}>
                      <span className={styles.reportTypeLabel}>
                        {definition.label}
                      </span>
                      <span className={styles.formatLinks}>
                        <a
                          aria-label={`${definition.label} for ${course.title} ${course.displayYear}${course.locationName ? ` ${course.locationName}` : ""} som Excel`}
                          className={styles.formatLink}
                          href={`/api/reports/${type}/${course.id}?format=xlsx`}
                        >
                          Excel
                        </a>
                        <a
                          aria-label={`${definition.label} for ${course.title} ${course.displayYear}${course.locationName ? ` ${course.locationName}` : ""} som PDF`}
                          className={styles.formatLink}
                          href={`/api/reports/${type}/${course.id}?format=pdf`}
                        >
                          PDF
                        </a>
                      </span>
                    </li>
                  );
                })}
              </ul>
            </article>
          ))}
        </div>
      </section>

      <section aria-labelledby="nif-reports" className={styles.reports}>
        <div className={styles.sectionHeading}>
          <div>
            <h2 id="nif-reports">NIF-årsrapport</h2>
            <p>
              Ferdig Excel-rapport med kursdata, kontaktinformasjon og
              registrert oppmøte. Deltakere som har trukket seg tas automatisk
              ut.
            </p>
          </div>
          <strong>{courses.length} rapporter klare</strong>
        </div>

        <div className={styles.reportList}>
          {courses.map((course) => {
            const courseIds = nifCourseIdsForTemplate(course.templateCode);

            return (
              <article className={styles.reportCard} key={course.id}>
                <div className={styles.level}>
                  <span>{course.templateCode}</span>
                </div>
                <div className={styles.reportIdentity}>
                  <h3>{course.title}</h3>
                  <p>
                    {course.displayYear}
                    {course.locationName ? ` · ${course.locationName}` : ""}
                  </p>
                  <small>
                    {courseIds.length
                      ? `NIF-ID ${courseIds.join(" / ")}`
                      : "Kurs-ID kan fylles inn i Excel før innsending"}
                  </small>
                </div>
                <div className={styles.reportMeta}>
                  <span>{course.sessions.length} samlinger</span>
                  <a
                    className="nivaa-button nivaa-button--primary"
                    href={`/admin/reports/nif/${course.id}`}
                  >
                    Last ned NIF-rapport
                  </a>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      <aside className={styles.note}>
        <strong>Om delvis fravær</strong>
        <p>
          Fullt oppmøte vises som «x», fullt fravær som «o» og delvis oppmøte
          som en objektiv prosent. Det gjør enkelttimer med fravær synlige i
          rapporten.
        </p>
      </aside>
    </main>
  );
}
