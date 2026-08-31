import Link from "next/link";
import { notFound } from "next/navigation";

import { loadTeacherParticipant } from "@/features/attendance/teacher-data";
import { createSupabaseServerClient } from "@/lib/supabase/server";

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

  return (
    <main className={styles.page} id="main-content">
      <Link className={styles.backLink} href="/teacher/participants">
        ← Alle deltakere
      </Link>
      <ParticipantAttendanceView
        enrollmentId={enrollmentId}
        notice={query.notice}
        participant={participant}
      />
    </main>
  );
}
