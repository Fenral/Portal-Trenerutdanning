import { notFound } from "next/navigation";

import { ThreadList } from "@/components/ui/MessageThread";
import threadStyles from "@/components/ui/MessageThread.module.css";
import { loadStudentIdentity } from "@/features/content/student-data";
import { loadStudentThreads } from "@/features/messaging/data";
import { createSupabaseServerClient } from "@/lib/supabase/server";

import styles from "./messages.module.css";

export const dynamic = "force-dynamic";

export default async function StudentMessagesPage() {
  const client = await createSupabaseServerClient();
  const identity = await loadStudentIdentity(client);
  if (!identity.profileId) notFound();

  const view = await loadStudentThreads(client, identity.profileId);

  return (
    <main className={styles.page} id="main-content">
      <header className={styles.header}>
        <span className={styles.eyebrow}>{identity.courseTitle}</span>
        <h1>Meldinger</h1>
        <p>
          Samtaler mellom deg og kurslærerne dine. Du varsles på e-post når det
          kommer en ny melding.
        </p>
      </header>

      <section aria-label="Meldingstråder">
        {view.threads.length === 0 ? (
          <div className={threadStyles.empty}>
            <h2>Ingen meldinger ennå</h2>
            <p>
              Når kurslæreren din sender deg en melding, finner du samtalen her.
            </p>
          </div>
        ) : (
          <ThreadList
            hrefFor={(item) =>
              `/student/messages/${item.thread.enrollmentId}/${item.thread.counterpartProfileId}`
            }
            items={view.threads}
            viewerProfileId={view.viewerProfileId}
          />
        )}
      </section>
    </main>
  );
}
