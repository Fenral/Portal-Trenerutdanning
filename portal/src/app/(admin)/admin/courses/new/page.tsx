import Link from "next/link";
import { notFound } from "next/navigation";

import { isAdministrator } from "@/features/access/require-administrator";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

import { createCourseRunAction } from "./actions";
import styles from "./page.module.css";

export const dynamic = "force-dynamic";

type LeadOption = Readonly<{
  id: string;
  display_name: string;
  club_name: string | null;
}>;

export default async function NewCourseRunPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const serverClient = await createSupabaseServerClient();
  const {
    data: { user },
  } = await serverClient.auth.getUser();
  const adminClient = createSupabaseAdminClient();

  if (!user || !(await isAdministrator(user.id, adminClient))) {
    notFound();
  }

  const { data, error } = await adminClient
    .from("profiles")
    .select("id,display_name,club_name")
    .order("display_name");

  if (error) {
    throw new Error("COURSE_LEAD_OPTIONS_QUERY_FAILED");
  }

  const leads = (data ?? []) as LeadOption[];
  const parameters = await searchParams;

  return (
    <main className={styles.shell} id="main-content">
      <header className={styles.header}>
        <div>
          <p className={styles.eyebrow}>Administrator · nytt kurs</p>
          <h1>Ny kursgjennomføring</h1>
          <p>
            Kurset, samlingene, kurslederen og revisjonssporet opprettes samlet.
            Ingenting lagres hvis én samling er ugyldig.
          </p>
        </div>
        <Link
          className="nivaa-button nivaa-button--secondary"
          href="/admin/courses"
        >
          Tilbake til kurs
        </Link>
      </header>

      {parameters.error ? (
        <p className={styles.error} role="alert">
          Kurset ble ikke opprettet. Kontroller obligatoriske felt og datoene.
        </p>
      ) : null}

      <form action={createCourseRunAction} className={styles.form}>
        <section className={styles.section}>
          <div className={styles.sectionHeading}>
            <span>01</span>
            <div>
              <h2>Grunnopplysninger</h2>
              <p>Trinn, kullår og hvem som leder kurset.</p>
            </div>
          </div>

          <div className={styles.fieldGrid}>
            <label>
              Trinn
              <select name="template-code" required>
                <option value="T1">Trener 1</option>
                <option value="T2">Trener 2</option>
                <option value="T3">Trener 3</option>
              </select>
            </label>
            <label>
              Navn på gjennomføring
              <input name="title" placeholder="Trener 1 · Oslo GK" required />
            </label>
            <label>
              Startår
              <input
                defaultValue="2027"
                max="2100"
                min="2020"
                name="start-year"
                required
                type="number"
              />
            </label>
            <label>
              Kurssted
              <input name="location-name" placeholder="Påkrevd for Trener 1" />
            </label>
            <label>
              Kurset starter
              <input name="starts-on" required type="date" />
            </label>
            <label>
              Kurset avsluttes
              <input name="ends-on" required type="date" />
            </label>
            <label className={styles.wideField}>
              Kursleder
              <select name="lead-profile-id" required>
                <option value="">Velg kursleder</option>
                {leads.map((lead) => (
                  <option key={lead.id} value={lead.id}>
                    {lead.display_name}
                    {lead.club_name ? ` · ${lead.club_name}` : ""}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </section>

        <section className={styles.section}>
          <div className={styles.sectionHeading}>
            <span>02</span>
            <div>
              <h2>Samlingsplan</h2>
              <p>Fyll minst én rad. Tomme rader blir ikke lagret.</p>
            </div>
          </div>

          <div className={styles.sessionList}>
            {Array.from({ length: 6 }, (_, index) => {
              const position = index + 1;

              return (
                <details key={position} open={position <= 2}>
                  <summary>Samling {position}</summary>
                  <div className={styles.sessionGrid}>
                    <label className={styles.wideField}>
                      Tittel
                      <input
                        name={`session-${position}-title`}
                        placeholder={`Samling ${position}`}
                      />
                    </label>
                    <label>
                      Fra dato
                      <input
                        name={`session-${position}-starts-on`}
                        type="date"
                      />
                    </label>
                    <label>
                      Fra kl.
                      <input
                        defaultValue="09:00"
                        name={`session-${position}-starts-at`}
                        type="time"
                      />
                    </label>
                    <label>
                      Til dato
                      <input name={`session-${position}-ends-on`} type="date" />
                    </label>
                    <label>
                      Til kl.
                      <input
                        defaultValue="16:00"
                        name={`session-${position}-ends-at`}
                        type="time"
                      />
                    </label>
                    <label>
                      Sted
                      <input
                        name={`session-${position}-location`}
                        placeholder="Klubb eller arena"
                      />
                    </label>
                    <label>
                      Type
                      <select name={`session-${position}-type`}>
                        <option value="regular">Ordinær samling</option>
                        <option value="youth_drive">Ungdomsdriven</option>
                      </select>
                    </label>
                    <label className={styles.checkbox}>
                      <input
                        defaultChecked
                        name={`session-${position}-required`}
                        type="checkbox"
                        value="required"
                      />
                      Obligatorisk
                    </label>
                  </div>
                </details>
              );
            })}
          </div>
        </section>

        <div className={styles.actions}>
          <button className="nivaa-button nivaa-button--primary" type="submit">
            Opprett kursgjennomføring
          </button>
          <span>Kurset opprettes som utkast.</span>
        </div>
      </form>
    </main>
  );
}
