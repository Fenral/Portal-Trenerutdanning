import type { DiplomaCardData } from "@/features/completion/DiplomaCard";
import {
  type CertificateRecord,
  ensureDiplomaStored,
} from "@/features/completion/diploma-storage";
import { LearningOverview } from "@/features/learning/LearningOverview";
import { loadCourseSchedule } from "@/features/learning/course-timeline-data";
import { loadStudentLearningPath } from "@/features/learning/student-learning-data";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

import styles from "./page.module.css";

async function loadDiploma(
  client: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  courseRunId: string,
): Promise<DiplomaCardData | null> {
  const certificates = await client
    .from("certificates")
    .select(
      "id,course_run_id,certificate_number,template_version,display_name,course_title,completed_on,storage_path,sha256",
    )
    .eq("course_run_id", courseRunId)
    .order("completed_on", { ascending: false })
    .limit(1);

  if (certificates.error) throw new Error(certificates.error.message);

  const certificate = (certificates.data ?? [])[0] as
    CertificateRecord | undefined;
  if (!certificate) return null;

  const stored = await ensureDiplomaStored(
    createSupabaseAdminClient(),
    certificate,
  );
  const signedUrl = await client.storage
    .from("certificates")
    .createSignedUrl(stored.path, 60 * 15, {
      download: `Diplom-${certificate.certificate_number}.pdf`,
    });
  if (signedUrl.error) throw new Error(signedUrl.error.message);

  return {
    courseTitle: certificate.course_title,
    completedOnLabel: new Intl.DateTimeFormat("nb-NO", {
      day: "numeric",
      month: "long",
      year: "numeric",
      timeZone: "UTC",
    }).format(new Date(`${certificate.completed_on}T12:00:00Z`)),
    certificateNumber: certificate.certificate_number,
    downloadUrl: signedUrl.data.signedUrl,
  };
}

export default async function StudentPage() {
  const client = await createSupabaseServerClient();
  const learningPath = await loadStudentLearningPath(client);

  if (learningPath) {
    const [schedule, diploma] = await Promise.all([
      loadCourseSchedule(client, learningPath),
      loadDiploma(client, learningPath.courseRunId),
    ]);

    return (
      <LearningOverview
        diploma={diploma}
        learningPath={learningPath}
        schedule={schedule}
      />
    );
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
