import Link from "next/link";
import { notFound } from "next/navigation";

import { isAdministrator } from "@/features/access/require-administrator";
import { calculateAttendance } from "@/features/attendance/percentage";
import { sortDemoParticipants } from "@/features/demo/participants";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

import {
  reopenEnrollmentAction,
  setUniversityCompletionAction,
  withdrawEnrollmentAction,
} from "./actions";
import styles from "./page.module.css";

export const dynamic = "force-dynamic";

const statusSignals: Readonly<
  Record<string, Readonly<{ symbol: string; label: string; tone: string }>>
> = {
  invited: { symbol: "…", label: "Invitert", tone: "neutral" },
  active: { symbol: "●", label: "Aktiv", tone: "neutral" },
  completed: { symbol: "✓", label: "Fullført", tone: "success" },
  withdrawn: { symbol: "⊘", label: "Trukket", tone: "attention" },
};

const notices: Readonly<
  Record<string, Readonly<{ text: string; ok: boolean }>>
> = {
  "university-saved": { text: "Universitetsstatusen er lagret.", ok: true },
  "university-error": {
    text: "Universitetsstatusen kunne ikke lagres.",
    ok: false,
  },
  "lifecycle-withdrawn": {
    text: "Deltakeren er trukket fra kurset. Handlingen kan angres med «Gjenåpne».",
    ok: true,
  },
  "lifecycle-reopened": {
    text: "Deltakeren er gjenåpnet og har tilgang igjen. Frister er uendret.",
    ok: true,
  },
  "lifecycle-reason-required": {
    text: "Skriv en begrunnelse før deltakeren trekkes.",
    ok: false,
  },
  "lifecycle-error": { text: "Statusendringen kunne ikke lagres.", ok: false },
};

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
    .select("id,profile_id,status,status_reason")
    .eq("course_run_id", courseRunId);
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
  const participants = sortDemoParticipants(
    enrollmentRows.map((enrollment) => {
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
        statusReason: enrollment.status_reason,
        name: profile?.display_name ?? "Ukjent deltaker",
        club: profile?.club_name ?? "Ukjent klubb",
        email: profile?.normalized_email ?? "",
        progress: progressByEnrollment.get(enrollment.id) ?? 0,
        attendance: attendanceSummary.displayPercentage,
        universityCompleted: universityByEnrollment.get(enrollment.id) ?? false,
      };
    }),
    (participant) => participant.name,
  );
  const notice = query.notice ? notices[query.notice] : undefined;

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
        <strong>
          {participants.filter((p) => p.status !== "withdrawn").length}{" "}
          deltakere
          {participants.some((p) => p.status === "withdrawn")
            ? ` · ${participants.filter((p) => p.status === "withdrawn").length} trukket`
            : ""}
        </strong>
      </header>

      {notice ? (
        <p className={styles.notice} role={notice.ok ? "status" : "alert"}>
          {notice.text}
        </p>
      ) : null}

      <section aria-label="Deltakere i kullet" className={styles.participants}>
        {participants.map((participant) => {
          const signal =
            statusSignals[participant.status] ?? statusSignals.active;
          return (
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
                    <span className={styles.statusPill} data-tone={signal.tone}>
                      <span aria-hidden="true">{signal.symbol}</span>
                      <span>{signal.label}</span>
                    </span>
                  </dd>
                </div>
              </dl>

              <div className={styles.lifecycle}>
                {participant.status === "active" ? (
                  <form action={withdrawEnrollmentAction}>
                    <input
                      name="courseRunId"
                      type="hidden"
                      value={courseRunId}
                    />
                    <input
                      name="enrollmentId"
                      type="hidden"
                      value={participant.id}
                    />
                    <label htmlFor={`withdraw-reason-${participant.id}`}>
                      Begrunnelse for å trekke {participant.name}
                    </label>
                    <input
                      className={styles.reasonInput}
                      id={`withdraw-reason-${participant.id}`}
                      name="reason"
                      required
                      type="text"
                    />
                    <button
                      className="nivaa-button nivaa-button--secondary"
                      type="submit"
                    >
                      Trekk deltaker
                    </button>
                  </form>
                ) : null}
                {participant.status === "withdrawn" ? (
                  <form action={reopenEnrollmentAction}>
                    <input
                      name="courseRunId"
                      type="hidden"
                      value={courseRunId}
                    />
                    <input
                      name="enrollmentId"
                      type="hidden"
                      value={participant.id}
                    />
                    {participant.statusReason ? (
                      <small>Begrunnelse: {participant.statusReason}</small>
                    ) : null}
                    <button
                      className="nivaa-button nivaa-button--secondary"
                      type="submit"
                    >
                      Gjenåpne
                    </button>
                  </form>
                ) : null}
              </div>

              {participant.status !== "withdrawn" &&
              template.data.level >= 2 ? (
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
              ) : participant.status !== "withdrawn" ? (
                <span className={styles.notRequired}>
                  Universitet ikke påkrevd
                </span>
              ) : null}
            </article>
          );
        })}
      </section>
    </main>
  );
}
