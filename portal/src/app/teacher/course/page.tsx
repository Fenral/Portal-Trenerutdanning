import { notFound } from "next/navigation";

import { resolveTeacherCourseAccess } from "@/features/access/teacher-course";
import { ContentDocument } from "@/features/content/document-schema";
import { ContentRenderer } from "@/features/learning/ContentRenderer";
import cardStyles from "@/features/learning/CourseSessions.module.css";
import { createSupabaseServerClient } from "@/lib/supabase/server";

import styles from "../teacher.module.css";

export const dynamic = "force-dynamic";

const activityTypeLabels: Readonly<Record<string, string>> = {
  lesson: "Leksjon",
  quiz: "Quiz",
  knowledge_test: "Kunnskapsprøve",
  assignment: "Innlevering",
  practice: "Praksis",
  attendance: "Oppmøte",
};

function assertNoQueryError(error: { message: string } | null): void {
  if (error) throw new Error(`TEACHER_COURSE_QUERY_FAILED:${error.message}`);
}

export default async function TeacherCoursePage() {
  const client = await createSupabaseServerClient();
  // Server-autorisasjon: kun kurslærer/kursleder ser lesevisningen, og kun
  // for en kjøring de har rolle på (via run eller mal).
  const access = await resolveTeacherCourseAccess(client);
  if (!access.isTeacher || !access.run) notFound();
  const run = access.run;

  const pathResult = await client
    .from("learning_paths")
    .select("id")
    .eq("course_run_id", run.id)
    .eq("status", "published")
    .limit(1)
    .maybeSingle();
  assertNoQueryError(pathResult.error);

  const [modulesResult, activitiesResult, bindingsResult] = pathResult.data
    ? await Promise.all([
        client
          .from("modules")
          .select("id,title,sort_order")
          .eq("learning_path_id", pathResult.data.id)
          .order("sort_order"),
        client
          .from("activities")
          .select(
            "id,module_id,title,activity_type,required,sort_order,content_item_id",
          )
          .eq("learning_path_id", pathResult.data.id)
          .order("sort_order"),
        client
          .from("course_content_bindings")
          .select("content_item_id,content_revision_id")
          .eq("course_run_id", run.id),
      ])
    : [
        { data: [], error: null },
        { data: [], error: null },
        { data: [], error: null },
      ];
  assertNoQueryError(modulesResult.error);
  assertNoQueryError(activitiesResult.error);
  assertNoQueryError(bindingsResult.error);

  const revisionIdByItem = new Map(
    (bindingsResult.data ?? []).map((binding) => [
      binding.content_item_id,
      binding.content_revision_id,
    ]),
  );
  const revisionIds = [...new Set(revisionIdByItem.values())];
  const revisionsResult = revisionIds.length
    ? await client
        .from("content_revisions")
        .select("id,document")
        .in("id", revisionIds)
    : { data: [], error: null };
  assertNoQueryError(revisionsResult.error);
  const documentByRevision = new Map(
    (revisionsResult.data ?? []).map((revision) => [
      revision.id,
      ContentDocument.parse(revision.document),
    ]),
  );

  const modules = modulesResult.data ?? [];
  const activities = activitiesResult.data ?? [];

  return (
    <main className={styles.page} id="main-content">
      <header className={styles.hero}>
        <div>
          <p className={styles.eyebrow}>{run.title}</p>
          <h1>Læringsløp</h1>
          <p>
            Lesevisning av det publiserte læringsløpet slik deltakerne møter det
            – moduler, aktiviteter og publisert innhold.
          </p>
        </div>
        <div className={styles.queueCount}>
          <strong>{modules.length}</strong>
          <span>moduler</span>
        </div>
      </header>

      {modules.length === 0 ? (
        <section className={styles.queue} aria-label="Læringsløp">
          <div className={styles.empty}>
            <h2>Ingen publisert læringsløp ennå</h2>
            <p>Læringsløpet vises her når det er publisert for kurset.</p>
          </div>
        </section>
      ) : (
        <div className={styles.cards}>
          {modules.map((learningModule) => {
            const moduleActivities = activities.filter(
              (activity) => activity.module_id === learningModule.id,
            );

            return (
              <section
                aria-labelledby={`module-title-${learningModule.id}`}
                className={cardStyles.card}
                key={learningModule.id}
              >
                <header className={cardStyles.head}>
                  <div className={cardStyles.copy}>
                    <h2 id={`module-title-${learningModule.id}`}>
                      {learningModule.title}
                    </h2>
                  </div>
                  <div className={cardStyles.meta}>
                    <span>
                      {moduleActivities.length}{" "}
                      {moduleActivities.length === 1
                        ? "aktivitet"
                        : "aktiviteter"}
                    </span>
                  </div>
                </header>
                <ol className={styles.moduleList}>
                  {moduleActivities.map((activity) => {
                    const revisionId = activity.content_item_id
                      ? revisionIdByItem.get(activity.content_item_id)
                      : undefined;
                    const document = revisionId
                      ? documentByRevision.get(revisionId)
                      : undefined;

                    return (
                      <li key={activity.id}>
                        <div className={styles.activityHead}>
                          <strong>{activity.title}</strong>
                          <span className={styles.activityType}>
                            {activityTypeLabels[activity.activity_type] ??
                              activity.activity_type}
                            {activity.required ? "" : " · valgfri"}
                          </span>
                        </div>
                        {document ? (
                          <details className={styles.activityContent}>
                            <summary>Vis publisert innhold</summary>
                            <ContentRenderer
                              document={document}
                              hidePrimaryHeading={false}
                            />
                          </details>
                        ) : null}
                      </li>
                    );
                  })}
                </ol>
              </section>
            );
          })}
        </div>
      )}
    </main>
  );
}
