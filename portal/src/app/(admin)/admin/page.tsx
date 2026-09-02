import Link from "next/link";
import { notFound } from "next/navigation";

import { isAdministrator } from "@/features/access/require-administrator";
import { loadAdminDashboard } from "@/features/reporting/admin-dashboard-query";
import { reportDefinitions } from "@/features/reporting/definitions";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

import { markAdminTaskHandledAction } from "./actions";
import styles from "./page.module.css";

export const dynamic = "force-dynamic";

const notices: Readonly<
  Record<string, Readonly<{ text: string; ok: boolean }>>
> = {
  "task-handled": {
    text: "Oppgaven er markert som håndtert og logget i revisjonssporet.",
    ok: true,
  },
  "task-error": {
    text: "Oppgaven kunne ikke markeres som håndtert.",
    ok: false,
  },
};

const dateFormatter = new Intl.DateTimeFormat("nb-NO", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Europe/Oslo",
});

export default async function AdminOverviewPage({
  searchParams,
}: Readonly<{ searchParams: Promise<{ notice?: string }> }>) {
  const [query, serverClient] = await Promise.all([
    searchParams,
    createSupabaseServerClient(),
  ]);
  const {
    data: { user },
  } = await serverClient.auth.getUser();
  const admin = createSupabaseAdminClient();
  if (!user || !(await isAdministrator(user.id, admin))) notFound();

  const dashboard = await loadAdminDashboard(admin);
  const notice = query.notice ? notices[query.notice] : undefined;
  const actionCount =
    dashboard.invoiceTasks.length +
    dashboard.incidents.length +
    (dashboard.duplicateSuggestionCount > 0 ? 1 : 0);

  return (
    <main className={styles.page} id="main-content">
      <header className={styles.hero}>
        <p className={styles.eyebrow}>Administrator · drift</p>
        <h1>Driftsoversikt</h1>
        <p>
          Avvik og nødvendige handlinger kommer først, deretter porteføljen.
          {actionCount === 0
            ? " Ingenting krever handling nå."
            : ` ${actionCount} ${actionCount === 1 ? "punkt" : "punkter"} krever handling.`}
        </p>
      </header>

      {notice ? (
        <p
          className={styles.notice}
          data-ok={notice.ok || undefined}
          role={notice.ok ? "status" : "alert"}
        >
          {notice.text}
        </p>
      ) : null}

      <div className={styles.grid}>
        <div className={styles.mainColumn}>
          <section aria-labelledby="tasks-title" className={styles.card}>
            <h2 id="tasks-title">
              <span aria-hidden="true">⚠</span> Krever handling ·
              Ungdomsdriven-fakturering
            </h2>
            <p className={styles.sectionHint}>
              Deltakerne under valgte Ungdomsdriven uten å møte. Differansen
              faktureres i Checkin/økonomisystemet — portalen fakturerer aldri.
              Marker oppgaven som håndtert når fakturaen er sendt der.
            </p>
            {dashboard.invoiceTasks.length === 0 ? (
              <p className={styles.empty}>Ingen åpne Ungdomsdriven-oppgaver.</p>
            ) : (
              <ul className={styles.taskList}>
                {dashboard.invoiceTasks.map((task, index) => (
                  <li className={styles.task} key={task.id}>
                    <div>
                      <strong>{task.participantName}</strong>
                      <small>
                        {task.courseTitle} · opprettet{" "}
                        {dateFormatter.format(new Date(task.createdAt))}
                      </small>
                    </div>
                    <form action={markAdminTaskHandledAction}>
                      <input name="taskId" type="hidden" value={task.id} />
                      {/* Sidens ene primærknapp: eldste (mest hastende) oppgave. */}
                      <button
                        className={`nivaa-button ${index === 0 ? "nivaa-button--primary" : "nivaa-button--secondary"}`}
                        type="submit"
                      >
                        Marker håndtert
                      </button>
                    </form>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section aria-labelledby="incidents-title" className={styles.card}>
            <h2 id="incidents-title">
              <span aria-hidden="true">⚠</span> Varslingshendelser
            </h2>
            {dashboard.incidents.length === 0 ? (
              <p className={styles.empty}>
                Ingen åpne varslingshendelser. Utsendinger som feiler etter
                siste forsøk havner her.
              </p>
            ) : (
              <ul className={styles.incidentList}>
                {dashboard.incidents.map((incident) => (
                  <li key={incident.id}>
                    <strong>
                      {incident.lastErrorCode ?? "Ukjent feilkode"}
                    </strong>
                    <small>
                      Feilet{" "}
                      {dateFormatter.format(new Date(incident.createdAt))} ·
                      følges opp manuelt mot e-postleverandøren
                    </small>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section aria-labelledby="duplicates-title" className={styles.card}>
            <h2 id="duplicates-title">Duplikatforslag</h2>
            <p className={styles.sectionHint}>
              {dashboard.duplicateSuggestionCount === 0
                ? "Ingen duplikatforslag over terskelen nå."
                : `${dashboard.duplicateSuggestionCount} profilpar har duplikatscore på 80 eller mer og venter på manuell vurdering.`}
            </p>
            <Link className={styles.inlineLink} href="/admin/people/duplicates">
              Gå til duplikatvurdering
            </Link>
          </section>

          <section aria-labelledby="portfolio-title" className={styles.card}>
            <h2 id="portfolio-title">Kursportefølje</h2>
            <table className={styles.portfolioTable}>
              <thead>
                <tr>
                  <th scope="col">Trinn</th>
                  <th scope="col">Aktive kurs</th>
                  <th scope="col">Deltakere</th>
                  <th scope="col">Kullsnitt progresjon</th>
                </tr>
              </thead>
              <tbody>
                {dashboard.portfolio.map((level) => (
                  <tr key={level.level}>
                    <th scope="row">{level.templateTitle}</th>
                    <td>{level.activeRunCount}</td>
                    <td>{level.activeParticipantCount}</td>
                    <td>
                      {level.cohortAverageProgress === null
                        ? "Ingen deltakere"
                        : `${level.cohortAverageProgress} %`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className={styles.tableFootnote}>
              Kullsnitt følger definisjonen «
              {reportDefinitions.course_progress.label}» (formelversjon{" "}
              {reportDefinitions.course_progress.formulaVersion}), ekskl.
              deltakere som har trukket seg.
            </p>
          </section>
        </div>

        <aside className={styles.contextColumn}>
          <section aria-labelledby="definitions-title" className={styles.card}>
            <h2 id="definitions-title">Formeldefinisjoner</h2>
            <dl className={styles.definitions}>
              {Object.values(reportDefinitions).map((definition) => (
                <div key={definition.id}>
                  <dt>{definition.label}</dt>
                  <dd>{definition.formula}</dd>
                </div>
              ))}
            </dl>
          </section>

          <section aria-labelledby="system-title" className={styles.card}>
            <h2 id="system-title">Systemstatus</h2>
            <dl className={styles.statusList}>
              <div>
                <dt>Siste vellykkede varselutsending</dt>
                <dd>
                  {dashboard.lastNotificationDeliveredAt
                    ? dateFormatter.format(
                        new Date(dashboard.lastNotificationDeliveredAt),
                      )
                    : "Ingen registrert ennå"}
                </dd>
              </div>
              <div>
                <dt>Åpne driftsoppgaver</dt>
                <dd>{dashboard.invoiceTasks.length}</dd>
              </div>
              <div>
                <dt>Åpne varslingshendelser</dt>
                <dd>{dashboard.incidents.length}</dd>
              </div>
              <div>
                <dt>Åpne duplikatforslag</dt>
                <dd>{dashboard.duplicateSuggestionCount}</dd>
              </div>
            </dl>
          </section>
        </aside>
      </div>
    </main>
  );
}
