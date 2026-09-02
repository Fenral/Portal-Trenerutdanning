import { notFound } from "next/navigation";

import threadStyles from "@/components/ui/MessageThread.module.css";
import { ThreadList } from "@/components/ui/MessageThread";
import { loadTeacherInbox } from "@/features/messaging/data";
import { createSupabaseServerClient } from "@/lib/supabase/server";

import styles from "../teacher.module.css";

export const dynamic = "force-dynamic";

export default async function TeacherInboxPage() {
  const client = await createSupabaseServerClient();
  const inbox = await loadTeacherInbox(client);
  if (!inbox) notFound();

  const unreadTotal = inbox.threads.reduce(
    (sum, item) => sum + item.thread.unreadCount,
    0,
  );

  return (
    <main className={styles.page} id="main-content">
      <header className={styles.detailHero}>
        <div>
          <p className={styles.eyebrow}>{inbox.courseTitle}</p>
          <h1>Inbox</h1>
          <p>
            Meldinger mellom deg og deltakerne dine. Start en ny samtale fra
            deltakerens profil.
          </p>
        </div>
        <div className={styles.queueCount}>
          <strong>{unreadTotal}</strong>
          <span>uleste meldinger</span>
        </div>
      </header>

      <section aria-label="Meldingstråder">
        {inbox.threads.length === 0 ? (
          <div className={threadStyles.empty}>
            <h2>Ingen samtaler ennå</h2>
            <p>
              Åpne en deltakerprofil og velg «Send melding» for å starte den
              første samtalen.
            </p>
          </div>
        ) : (
          <ThreadList
            hrefFor={(item) => `/teacher/inbox/${item.thread.enrollmentId}`}
            items={inbox.threads}
            viewerProfileId={inbox.viewerProfileId}
          />
        )}
      </section>
    </main>
  );
}
