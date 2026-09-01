import { notFound } from "next/navigation";

import { isAdministrator } from "@/features/access/require-administrator";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

import styles from "./page.module.css";

export const dynamic = "force-dynamic";

type AssignmentRow = Readonly<{
  role: "course_teacher" | "course_lead" | "editor" | "administrator";
  course_run_id: string | null;
  profile_id: string;
}>;

type ProfileRow = Readonly<{
  id: string;
  display_name: string;
  club_name: string | null;
}>;

type RunRow = Readonly<{ id: string; title: string; start_year: number }>;

const roleLabels: Readonly<Record<AssignmentRow["role"], string>> = {
  course_lead: "Kursleder",
  course_teacher: "Kurslærer",
  editor: "Redaktør",
  administrator: "Administrator",
};

export default async function AdminAccessPage() {
  const serverClient = await createSupabaseServerClient();
  const {
    data: { user },
  } = await serverClient.auth.getUser();
  const adminClient = createSupabaseAdminClient();

  if (!user || !(await isAdministrator(user.id, adminClient))) {
    notFound();
  }

  const [assignmentsResult, profilesResult, runsResult] = await Promise.all([
    adminClient
      .from("role_assignments")
      .select("role,course_run_id,profile_id")
      .neq("role", "student")
      .is("revoked_at", null),
    adminClient.from("profiles").select("id,display_name,club_name"),
    adminClient
      .from("course_runs")
      .select("id,title,start_year")
      .order("start_year")
      .order("title"),
  ]);

  for (const result of [assignmentsResult, profilesResult, runsResult]) {
    if (result.error) throw new Error("ACCESS_OVERVIEW_QUERY_FAILED");
  }

  const assignments = (assignmentsResult.data ?? []) as AssignmentRow[];
  const profiles = new Map(
    ((profilesResult.data ?? []) as ProfileRow[]).map((profile) => [
      profile.id,
      profile,
    ]),
  );
  const runs = (runsResult.data ?? []) as RunRow[];

  const courseRoles = ["course_lead", "course_teacher"] as const;
  const systemRoles = ["administrator", "editor"] as const;

  const byRun = new Map<string, AssignmentRow[]>();
  for (const assignment of assignments) {
    if (!assignment.course_run_id) continue;
    const list = byRun.get(assignment.course_run_id) ?? [];
    list.push(assignment);
    byRun.set(assignment.course_run_id, list);
  }

  const staffedRuns = runs.filter((run) => byRun.has(run.id));

  return (
    <main className={styles.page} id="main-content">
      <header className={styles.hero}>
        <div>
          <p className={styles.eyebrow}>Administrator · tilganger</p>
          <h1>Kurslærere og tilganger</h1>
          <p>
            Hvem som har kursansvar per kursgjennomføring, og hvem som har
            roller i hele portalen.
          </p>
        </div>
      </header>

      <aside className={styles.note}>
        <strong>Skrivebeskyttet oversikt</strong>
        <p>
          Tildeling og fjerning av roller gjøres foreløpig av
          systemadministrator. Endringsflate kommer i en senere leveranse.
        </p>
      </aside>

      <section aria-labelledby="course-access-title" className={styles.card}>
        <h2 id="course-access-title">Kursansvar per kursgjennomføring</h2>
        {staffedRuns.length === 0 ? (
          <p className={styles.empty}>Ingen kursroller er tildelt ennå.</p>
        ) : (
          <ul className={styles.runList}>
            {staffedRuns.map((run) => {
              const runAssignments = byRun.get(run.id) ?? [];

              return (
                <li key={run.id}>
                  <h3>{run.title}</h3>
                  <ul className={styles.personList}>
                    {courseRoles.flatMap((role) =>
                      runAssignments
                        .filter((assignment) => assignment.role === role)
                        .map((assignment) => {
                          const profile = profiles.get(assignment.profile_id);
                          if (!profile) return null;

                          return (
                            <li key={`${role}-${assignment.profile_id}`}>
                              <span className={styles.person}>
                                <strong>{profile.display_name}</strong>
                                {profile.club_name ? (
                                  <small>{profile.club_name}</small>
                                ) : null}
                              </span>
                              <span
                                className={styles.rolePill}
                                data-role={role}
                              >
                                {roleLabels[role]}
                              </span>
                            </li>
                          );
                        }),
                    )}
                  </ul>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section aria-labelledby="system-access-title" className={styles.card}>
        <h2 id="system-access-title">Roller i hele portalen</h2>
        <ul className={styles.personList}>
          {systemRoles.flatMap((role) =>
            assignments
              .filter((assignment) => assignment.role === role)
              .map((assignment) => {
                const profile = profiles.get(assignment.profile_id);
                if (!profile) return null;

                return (
                  <li key={`${role}-${assignment.profile_id}`}>
                    <span className={styles.person}>
                      <strong>{profile.display_name}</strong>
                      {profile.club_name ? (
                        <small>{profile.club_name}</small>
                      ) : null}
                    </span>
                    <span className={styles.rolePill} data-role={role}>
                      {roleLabels[role]}
                    </span>
                  </li>
                );
              }),
          )}
        </ul>
      </section>
    </main>
  );
}
