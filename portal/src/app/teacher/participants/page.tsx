import { loadTeacherParticipants } from "@/features/attendance/teacher-data";
import { createSupabaseServerClient } from "@/lib/supabase/server";

import { ParticipantList } from "./participant-list";
import styles from "./participants.module.css";

export const dynamic = "force-dynamic";

export default async function TeacherParticipantsPage() {
  const client = await createSupabaseServerClient();
  const participants = await loadTeacherParticipants(client);

  return (
    <main className={styles.page} id="main-content">
      <header className={styles.hero}>
        <div>
          <p className={styles.eyebrow}>Deltakerprogresjon</p>
          <h1>Deltakere</h1>
          <p>Åpne en deltaker for å følge progresjon og føre oppmøte.</p>
        </div>
        <strong>{participants.length} deltakere</strong>
      </header>

      <ParticipantList participants={participants} />
    </main>
  );
}
