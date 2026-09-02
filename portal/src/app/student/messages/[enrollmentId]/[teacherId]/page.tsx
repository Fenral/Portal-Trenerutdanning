import Link from "next/link";
import { notFound } from "next/navigation";

import { MessageThread } from "@/components/ui/MessageThread";
import threadStyles from "@/components/ui/MessageThread.module.css";
import { ThreadNotice } from "@/components/ui/ThreadNotice";
import { loadStudentIdentity } from "@/features/content/student-data";
import { loadStudentThread } from "@/features/messaging/data";
import { createSupabaseServerClient } from "@/lib/supabase/server";

import { sendStudentMessageAction } from "../../actions";
import styles from "../../messages.module.css";

export const dynamic = "force-dynamic";

const NOTICES: Record<string, { text: string; tone: "ok" | "error" }> = {
  "message-sent": { text: "Meldingen er sendt.", tone: "ok" },
  "message-error": {
    text: "Meldingen kunne ikke sendes. Prøv igjen senere.",
    tone: "error",
  },
  "message-invalid": {
    text: "Skriv en melding på 1–4000 tegn.",
    tone: "error",
  },
};

type PageProps = Readonly<{
  params: Promise<{ enrollmentId: string; teacherId: string }>;
  searchParams: Promise<{ notice?: string }>;
}>;

export default async function StudentThreadPage({
  params,
  searchParams,
}: PageProps) {
  const [{ enrollmentId, teacherId }, query] = await Promise.all([
    params,
    searchParams,
  ]);
  const client = await createSupabaseServerClient();
  const identity = await loadStudentIdentity(client);
  if (!identity.profileId) notFound();

  const thread = await loadStudentThread(
    client,
    identity.profileId,
    enrollmentId,
    teacherId,
  );
  if (!thread) notFound();

  const notice = query.notice ? NOTICES[query.notice] : undefined;

  return (
    <main className={styles.page} id="main-content">
      <Link className={styles.backLink} href="/student/messages">
        ← Alle meldinger
      </Link>

      <header className={styles.header}>
        <span className={styles.eyebrow}>{identity.courseTitle}</span>
        <h1>Samtale med {thread.teacherName}</h1>
        <p>Svaret ditt går kun til {thread.teacherName}.</p>
      </header>

      {notice ? <ThreadNotice text={notice.text} tone={notice.tone} /> : null}

      <MessageThread
        counterpartName={thread.teacherName}
        messages={thread.messages}
        viewerProfileId={thread.viewerProfileId}
      />

      <form action={sendStudentMessageAction} className={threadStyles.composer}>
        <input name="enrollmentId" type="hidden" value={thread.enrollmentId} />
        <input
          name="teacherProfileId"
          type="hidden"
          value={thread.teacherProfileId}
        />
        <label>
          <span>Svar til {thread.teacherName}</span>
          <textarea maxLength={4000} name="body" required rows={4} />
        </label>
        <div className={threadStyles.composerFooter}>
          <small>Læreren varsles på e-post uten selve meldingsteksten.</small>
          <button className="nivaa-button nivaa-button--primary" type="submit">
            Send svar
          </button>
        </div>
      </form>
    </main>
  );
}
