import Link from "next/link";
import { notFound } from "next/navigation";

import { MessageThread } from "@/components/ui/MessageThread";
import threadStyles from "@/components/ui/MessageThread.module.css";
import { ThreadNotice } from "@/components/ui/ThreadNotice";
import { loadTeacherThread } from "@/features/messaging/data";
import { createSupabaseServerClient } from "@/lib/supabase/server";

import styles from "../../teacher.module.css";
import { sendTeacherMessageAction } from "../actions";

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
  params: Promise<{ enrollmentId: string }>;
  searchParams: Promise<{ notice?: string }>;
}>;

export default async function TeacherThreadPage({
  params,
  searchParams,
}: PageProps) {
  const [{ enrollmentId }, query] = await Promise.all([params, searchParams]);
  const client = await createSupabaseServerClient();
  const thread = await loadTeacherThread(client, enrollmentId);
  if (!thread) notFound();

  const notice = query.notice ? NOTICES[query.notice] : undefined;

  return (
    <main className={styles.page} id="main-content">
      <Link className={styles.backLink} href="/teacher/inbox">
        ← Alle samtaler
      </Link>

      <header className={styles.detailHero}>
        <div>
          <p className={styles.eyebrow}>Samtale med deltaker</p>
          <h1>{thread.participantName}</h1>
          <p>
            {thread.participantClub ?? "Uten klubb"} ·{" "}
            <Link href={`/teacher/participants/${thread.enrollmentId}`}>
              Åpne deltakerprofilen
            </Link>
          </p>
        </div>
      </header>

      {notice ? <ThreadNotice text={notice.text} tone={notice.tone} /> : null}

      <MessageThread
        counterpartName={thread.participantName}
        messages={thread.messages}
        viewerProfileId={thread.viewerProfileId}
      />

      {thread.enrollmentActive ? (
        <form
          action={sendTeacherMessageAction}
          className={threadStyles.composer}
        >
          <input
            name="enrollmentId"
            type="hidden"
            value={thread.enrollmentId}
          />
          <input
            name="recipientProfileId"
            type="hidden"
            value={thread.participantProfileId}
          />
          <label>
            <span>Melding til {thread.participantName}</span>
            <textarea maxLength={4000} name="body" required rows={4} />
          </label>
          <div className={threadStyles.composerFooter}>
            <small>
              Deltakeren varsles på e-post uten selve meldingsteksten.
            </small>
            <button
              className="nivaa-button nivaa-button--primary"
              type="submit"
            >
              Send melding
            </button>
          </div>
        </form>
      ) : (
        <p className={threadStyles.readState}>
          Deltakeren har ikke lenger aktiv kursplass, så nye meldinger kan ikke
          sendes.
        </p>
      )}
    </main>
  );
}
