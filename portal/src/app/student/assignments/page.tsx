import Link from "next/link";
import { notFound } from "next/navigation";

import { loadStudentLearningPath } from "@/features/learning/student-learning-data";
import { createSupabaseServerClient } from "@/lib/supabase/server";

import styles from "./[activityId]/page.module.css";

export const dynamic = "force-dynamic";

export default async function StudentAssignmentsPage() {
  const client = await createSupabaseServerClient();
  const learningPath = await loadStudentLearningPath(client);
  if (!learningPath) notFound();
  const assignments = learningPath.activities.filter(
    (activity) => activity.activityType === "assignment",
  );

  return (
    <main className={styles.page} id="main-content">
      <header className={styles.hero}>
        <div>
          <p className={styles.eyebrow}>{learningPath.courseTitle}</p>
          <h1>Innleveringer</h1>
          <p>Arbeidskrav, tilbakemeldinger og tidligere versjoner.</p>
        </div>
      </header>
      <section className={styles.history}>
        <ol>
          {assignments.map((assignment) => (
            <li key={assignment.id}>
              <strong>{assignment.title}</strong>
              <p>{assignment.completed ? "Godkjent" : "Åpen"}</p>
              <Link href={`/student/assignments/${assignment.id}`}>
                Åpne innleveringen
              </Link>
            </li>
          ))}
        </ol>
      </section>
    </main>
  );
}
