import Link from "next/link";
import { notFound } from "next/navigation";

import { loadTeacherParticipant } from "@/features/attendance/teacher-data";
import { createSupabaseServerClient } from "@/lib/supabase/server";

import { sendReminderAction } from "../actions";
import styles from "../participants.module.css";
import { ParticipantAttendanceView } from "./attendance-editor";

export const dynamic = "force-dynamic";

type PageProps = Readonly<{
  params: Promise<{ enrollmentId: string }>;
  searchParams: Promise<{ notice?: string }>;
}>;

export default async function TeacherParticipantPage({
  params,
  searchParams,
}: PageProps) {
  const [{ enrollmentId }, query] = await Promise.all([params, searchParams]);
  const client = await createSupabaseServerClient();
  const participant = await loadTeacherParticipant(client, enrollmentId);
  if (!participant) notFound();

  const reminderNotice = query.notice?.startsWith("reminder-")
    ? query.notice
    : undefined;

  return (
    <main className={styles.page} id="main-content">
      <Link className={styles.backLink} href="/teacher/participants">
        ← Alle deltakere
      </Link>
      {reminderNotice ? (
        <p
          className={styles.notice}
          role={reminderNotice === "reminder-sent" ? "status" : "alert"}
        >
          {reminderNotice === "reminder-sent"
            ? "✓ Påminnelsen er lagt i utsendingskøen. Deltakeren får maks én påminnelse per dag."
            : "✕ Påminnelsen kunne ikke sendes. Prøv igjen senere."}
        </p>
      ) : null}
      <ParticipantAttendanceView
        actions={
          <>
            <Link
              className="nivaa-button nivaa-button--secondary"
              href={`/teacher/inbox/${enrollmentId}`}
            >
              Send melding
            </Link>
            <form action={sendReminderAction}>
              <input name="enrollmentId" type="hidden" value={enrollmentId} />
              <button
                className="nivaa-button nivaa-button--secondary"
                type="submit"
              >
                Send påminnelse
              </button>
            </form>
          </>
        }
        enrollmentId={enrollmentId}
        notice={reminderNotice ? undefined : query.notice}
        participant={participant}
      />
    </main>
  );
}
