import Link from "next/link";
import { notFound } from "next/navigation";

import { isAdministrator } from "@/features/access/require-administrator";
import { calculateAttendance } from "@/features/attendance/percentage";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

import { setUniversityCompletionAction } from "./actions";
import styles from "./page.module.css";

export const dynamic = "force-dynamic";

type PageProps = Readonly<{
  params: Promise<{ courseRunId: string }>;
  searchParams: Promise<{ notice?: string }>;
}>;

export default async function AdminCourseDetailPage({
  params,
  searchParams,
}: PageProps) {
  const [{ courseRunId }, query, serverClient] = await Promise.all([
    params,
    searchParams,
    createSupabaseServerClient(),
  ]);
  const {
    data: { user },
  } = await serverClient.auth.getUser();
  const admin = createSupabaseAdminClient();
  if (!user || !(await isAdministrator(user.id, admin))) notFound();

  const course = await admin
    .from("course_runs")
    .select("id,title,template_id,start_year")
    .eq("id", courseRunId)
    .maybeSingle();
  if (course.error || !course.data) notFound();
  const template = await admin
    .from("course_templates")
    .select("level")
    .eq("id", course.data.template_id)
    .single();
  if (template.error || !template.data) notFound();

  const enrollments = await admin
    .from("enrollments")
    .select("id,profile_id,status")
    .eq("course_run_id", courseRunId)
    .neq("status", "withdrawn");
  if (enrollments.error) throw new Error(enrollments.error.message);
  const enrollmentRows = enrollments.data ?? [];
  const enrollmentIds = enrollmentRows.map((enrollment) => enrollment.id);
  const profileIds = enrollmentRows.map((enrollment) => enrollment.profile_id);
  const [profiles, progress, attendance, university] = await Promise.all([
    profileIds.length
      ? admin
          .from("profiles")
          .select("id,display_name,club_name,normalized_email")
          .in("id", profileIds)
      : Promise.resolve({ data: [], error: null }),
    enrollmentIds.length
      ? admin
          .from("enrollment_progress")
          .select("enrollment_id,percentage")
          .in("enrollment_id", enrollmentIds)
      : Promise.resolve({ data: [], error: null }),
    enrollmentIds.length
      ? admin
          .from("attendance_records")
          .select("enrollment_id,planned_minutes,present_minutes")
          .in("enrollment_id", enrollmentIds)
      : Promise.resolve({ data: [], error: null }),
    enrollmentIds.length
      ? admin
          .from("university_requirements")
          .select("enrollment_id,completed")
          .in("enrollment_id", enrollmentIds)
      : Promise.resolve({ data: [], error: null }),
  ]);
  for (const result of [profiles, progress, attendance, university]) {
    if (result.error) throw new Error(result.error.message);
  }

  const profileById = new Map(
    (profiles.data ?? []).map((profile) => [profile.id, profile]),
  );
  const progressByEnrollment = new Map(
    (progress.data ?? []).map((row) => [row.enrollment_id, row.percentage]),
  );
  const universityByEnrollment = new Map(
    (university.data ?? []).map((row) => [row.enrollment_id, row.completed]),
  );
  const participants = enrollmentRows
    .map((enrollment) => {
      const profile = profileById.get(enrollment.profile_id);
      const attendanceSummary = calculateAttendance(
        (attendance.data ?? [])
          .filter((row) => row.enrollment_id === enrollment.id)
          .map((row) => ({
            plannedMinutes: row.planned_minutes,
            presentMinutes: row.present_minutes,
          })),
      );
      return {
        ...enrollment,
        name: profile?.display_name ?? "Ukjent deltaker",
        club: profile?.club_name ?? "Ukjent klubb",
        email: profile?.normalized_email ?? "",
        progress: progressByEnrollment.get(enrollment.id) ?? 0,
        attendance: attendanceSummary.displayPercentage,
        universityCompleted: universityByEnrollment.get(enrollment.id) ?? false,
      };
    })
    .sort((left, right) => left.name.localeCompare(right.name, "nb-NO"));

  return (
    <main className={styles.page} id="main-content">
      <Link className={styles.backLink} href="/admin/courses">
        ← Kursgjennomføringer
      </Link>
      <header className={styles.hero}>
        <div>
          <p className={styles.eyebrow}>Kull {course.data.start_year}</p>
          <h1>{course.data.title}</h1>
          <p>Progresjon, oppmøte og manuelt kontrollert universitetskrav.</p>
        </div>
        <strong>{participants.length} deltakere</strong>
      </header>

      {query.notice ? (
        <p
          className={styles.notice}
          role={query.notice === "university-saved" ? "status" : "alert"}
        >
          {query.notice === "university-saved"
            ? "Universitetsstatusen er lagret."
            : "Universitetsstatusen kunne ikke lagres."}
        </p>
      ) : null}

      <section aria-label="Deltakere i kullet" className={styles.participants}>
        {participants.map((participant) => (
          <article className={styles.participant} key={participant.id}>
            <div className={styles.identity}>
              <strong>{participant.name}</strong>
              <small>
                {participant.club} · {participant.email}
              </small>
            </div>
            <dl>
              <div>
                <dt>Progresjon</dt>
                <dd>{participant.progress} %</dd>
              </div>
              <div>
                <dt>Oppmøte</dt>
                <dd>{participant.attendance} %</dd>
              </div>
              <div>
                <dt>Status</dt>
                <dd>
                  {participant.status === "completed" ? "Fullført" : "Aktiv"}
                </dd>
              </div>
            </dl>

            {template.data.level >= 2 ? (
              <form action={setUniversityCompletionAction}>
                <input name="courseRunId" type="hidden" value={courseRunId} />
                <input
                  name="enrollmentId"
                  type="hidden"
                  value={participant.id}
                />
                <label>
                  <input
                    defaultChecked={participant.universityCompleted}
                    name="completed"
                    type="checkbox"
                  />
                  <span>Universitet fullført for {participant.name}</span>
                </label>
                <small>
                  {participant.universityCompleted
                    ? "Universitet fullført"
                    : "Ikke kontrollert"}
                </small>
                <button
                  className="nivaa-button nivaa-button--secondary"
                  type="submit"
                >
                  Lagre universitetsstatus for {participant.name}
                </button>
              </form>
            ) : (
              <span className={styles.notRequired}>
                Universitet ikke påkrevd
              </span>
            )}
          </article>
        ))}
      </section>
    </main>
  );
}
