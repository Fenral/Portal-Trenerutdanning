import { notFound } from "next/navigation";

import { isAdministrator } from "@/features/access/require-administrator";
import { loadCoursePortfolio } from "@/features/courses/portfolio";
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
          <h1>NIF-årsrapport</h1>
          <p>
            Last ned ferdig Excel-rapport med kursdata, kontaktinformasjon og
            registrert oppmøte. Deltakere som har trukket seg tas automatisk ut.
          </p>
        </div>
        <span className={styles.formatBadge}>Excel · .xlsx</span>
      </header>

      <section aria-labelledby="course-reports" className={styles.reports}>
        <div className={styles.sectionHeading}>
          <div>
            <h2 id="course-reports">Velg kursgjennomføring</h2>
            <p>Én rapport per kurssted eller kull.</p>
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
