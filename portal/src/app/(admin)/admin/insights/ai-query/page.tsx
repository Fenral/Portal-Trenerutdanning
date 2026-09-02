import { notFound } from "next/navigation";

import { can } from "@/features/access/permissions";
import { actorRoleFor } from "@/features/admin-query/authorize";
import { loadCoursePortfolio } from "@/features/courses/portfolio";
import {
  REPORT_TYPES,
  reportDefinitions,
} from "@/features/reporting/definitions";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

import { AiQueryPanel } from "./AiQueryPanel";
import styles from "./page.module.css";

export const dynamic = "force-dynamic";

export default async function AdminAiQueryPage() {
  const serverClient = await createSupabaseServerClient();
  const {
    data: { user },
  } = await serverClient.auth.getUser();
  if (!user) notFound();

  const adminClient = createSupabaseAdminClient();
  const role = await actorRoleFor(user.id, adminClient);
  if (!role || !can(role, "admin_query.run")) notFound();

  const courses = await loadCoursePortfolio(adminClient);
  const courseOptions = courses.map((course) => ({
    id: course.id,
    label: `${course.title}${course.locationName ? ` · ${course.locationName}` : ""}`,
  }));

  return (
    <main className={styles.page} id="main-content">
      <header className={styles.hero}>
        <div>
          <p className={styles.eyebrow}>Administrator · innsikt</p>
          <h1>Objektive spørsmål</h1>
          <p>
            Still faste, objektive spørsmål om kursdata. Svarene bygger på de
            samme definisjonene som rapportene, er alltid skrivebeskyttet, og
            AI-tjenesten mottar aldri deltakerdata.
          </p>
        </div>
      </header>

      <div className={styles.grid}>
        <AiQueryPanel
          courses={courseOptions}
          openAiConfigured={Boolean(process.env.OPENAI_API_KEY)}
        />

        <aside aria-labelledby="definitions-heading" className={styles.context}>
          <h2 id="definitions-heading">Definisjoner</h2>
          <p>
            Hvert svar oppgir hvilken definisjon og formelversjon det bygger på.
            Samme spørsmål gir alltid samme tall som rapportene.
          </p>
          <ul className={styles.definitionList}>
            {REPORT_TYPES.map((type) => {
              const definition = reportDefinitions[type];
              return (
                <li key={type}>
                  <strong>{definition.label}</strong>
                  <span>
                    {definition.description} Versjon {definition.formulaVersion}
                    .
                  </span>
                </li>
              );
            })}
          </ul>
        </aside>
      </div>
    </main>
  );
}
