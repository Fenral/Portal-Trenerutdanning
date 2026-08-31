import { LearningOverview } from "@/features/learning/LearningOverview";
import { loadStudentLearningPath } from "@/features/learning/student-learning-data";
import { createSupabaseServerClient } from "@/lib/supabase/server";

import styles from "./page.module.css";

export default async function StudentPage() {
  const client = await createSupabaseServerClient();
  const learningPath = await loadStudentLearningPath(client);

  if (learningPath) {
    return <LearningOverview learningPath={learningPath} />;
  }

  return (
    <main className={styles.page} id="main-content">
      <div className={styles.emptyState}>
        <span className="nivaa-status nivaa-status--success">
          Tilgang aktiv
        </span>
        <h1>Tilgangen er aktivert</h1>
        <p>
          Læringsløpet dukker opp her når redaktøren har publisert det til
          kullet ditt.
        </p>
      </div>
    </main>
  );
}
