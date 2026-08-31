import Link from "next/link";

import type {
  StudentLearningActivity,
  StudentLearningPathView,
} from "./student-learning-data";

import styles from "./LearningOverview.module.css";

const activityTypeLabels: Readonly<
  Record<StudentLearningActivity["activityType"], string>
> = {
  lesson: "Pensum",
  quiz: "Quiz",
  knowledge_test: "Kunnskapsprøve",
  assignment: "Innlevering",
  practice: "Praksis",
  attendance: "Oppmøte",
};

function activityStatus(activity: StudentLearningActivity): Readonly<{
  label: string;
  state: "completed" | "locked" | "open";
}> {
  if (activity.completed) return { label: "Fullført", state: "completed" };
  if (activity.access.state === "locked") {
    return { label: "Låst", state: "locked" };
  }
  return { label: "Klar", state: "open" };
}

function activityHref(
  learningPath: StudentLearningPathView,
  activity: StudentLearningActivity,
): string {
  return `/student/courses/${learningPath.courseRunId}/activities/${activity.id}`;
}

export function LearningOverview({
  learningPath,
}: Readonly<{ learningPath: StudentLearningPathView }>) {
  const nextActivity = learningPath.nextActivity;

  return (
    <main className={styles.page} id="main-content">
      <header className={styles.hero}>
        <div>
          <p className={styles.eyebrow}>{learningPath.courseTitle}</p>
          <h1>Fortsett der du slapp</h1>
          <p>
            Se hva som er ferdig, hva som er anbefalt nå, og hvorfor enkelte
            aktiviteter fortsatt er låst.
          </p>
        </div>
        <div className={styles.accessConfirmed}>
          <span aria-hidden="true">✓</span>
          <div>
            <h2>Tilgangen er aktivert</h2>
            <p>Publisert pensum og delte filer er klare.</p>
          </div>
        </div>
      </header>

      {nextActivity ? (
        <section className={styles.nextAction} aria-labelledby="next-title">
          <div>
            <p className={styles.eyebrow}>Anbefalt neste steg</p>
            <h2 id="next-title">{nextActivity.title}</h2>
            <p>
              {nextActivity.description ??
                `Fortsett med ${nextActivity.moduleTitle.toLocaleLowerCase("nb-NO")}.`}
            </p>
            <div className={styles.nextMeta}>
              <span>{nextActivity.moduleTitle}</span>
              <span>{activityTypeLabels[nextActivity.activityType]}</span>
            </div>
          </div>
          <Link
            aria-label={`Fortsett ${nextActivity.title}`}
            className="nivaa-button nivaa-button--primary"
            href={activityHref(learningPath, nextActivity)}
          >
            Fortsett aktiviteten <span aria-hidden="true">→</span>
          </Link>
        </section>
      ) : (
        <section className={styles.completedPath} aria-labelledby="done-title">
          <span aria-hidden="true">✓</span>
          <div>
            <p className={styles.eyebrow}>Læringsløpet</p>
            <h2 id="done-title">Alle obligatoriske aktiviteter er fullført</h2>
          </div>
        </section>
      )}

      <section
        className={styles.progressSection}
        aria-labelledby="progress-title"
      >
        <div className={styles.sectionHeading}>
          <div>
            <p className={styles.eyebrow}>Din progresjon</p>
            <h2 id="progress-title">Hele læringsløpet</h2>
          </div>
          <span>Prosent på totalen · brøktall per modul</span>
        </div>

        <div className={styles.progressRail}>
          <div className={styles.totalProgress}>
            <strong>{learningPath.percentage} %</strong>
            <span>Total progresjon</span>
            <div
              aria-label={`${learningPath.percentage} prosent fullført`}
              aria-valuemax={100}
              aria-valuemin={0}
              aria-valuenow={learningPath.percentage}
              className={styles.progressTrack}
              role="progressbar"
            >
              <span style={{ width: `${learningPath.percentage}%` }} />
            </div>
          </div>

          <nav aria-label="Moduler" className={styles.moduleRail}>
            {learningPath.modules.map((module, index) => (
              <a href={`#module-${module.id}`} key={module.id}>
                <span className={styles.moduleIndex} aria-hidden="true">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <strong>{module.title}</strong>
                <span>
                  {module.completedCount} av {module.totalCount}
                </span>
              </a>
            ))}
          </nav>
        </div>
      </section>

      <section
        className={styles.modules}
        aria-label="Aktiviteter i læringsløpet"
      >
        {learningPath.modules.map((module, moduleIndex) => (
          <article
            className={styles.module}
            id={`module-${module.id}`}
            key={module.id}
          >
            <header className={styles.moduleHeader}>
              <div className={styles.moduleNumber} aria-hidden="true">
                {String(moduleIndex + 1).padStart(2, "0")}
              </div>
              <div>
                <h2>{module.title}</h2>
                {module.description ? <p>{module.description}</p> : null}
              </div>
              <strong>
                {module.completedCount} av {module.totalCount}
              </strong>
            </header>

            <ul className={styles.activityList}>
              {module.activities.map((activity) => {
                const status = activityStatus(activity);

                return (
                  <li key={activity.id}>
                    <Link
                      aria-label={`Åpne ${activity.title}`}
                      href={activityHref(learningPath, activity)}
                    >
                      <span
                        aria-hidden="true"
                        className={styles.statusIcon}
                        data-state={status.state}
                      >
                        {status.state === "completed"
                          ? "✓"
                          : status.state === "locked"
                            ? "⌑"
                            : "→"}
                      </span>
                      <span className={styles.activityCopy}>
                        <strong>{activity.title}</strong>
                        <small>
                          {activityTypeLabels[activity.activityType]}
                          {!activity.required ? " · Valgfri" : ""}
                        </small>
                      </span>
                      <span
                        className={styles.statusLabel}
                        data-state={status.state}
                      >
                        {status.label}
                      </span>
                      <span aria-hidden="true" className={styles.arrow}>
                        →
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </article>
        ))}
      </section>
    </main>
  );
}
