"use client";

import { useMemo, useState } from "react";

import { recordAttendanceAction } from "../actions";
import styles from "../participants.module.css";

const ATTENDANCE_REQUIREMENT = 0.8;

type AttendanceSession = Readonly<{
  id: string;
  title: string;
  startsAt: string;
  plannedMinutes: number;
  presentMinutes: number;
  recorded: boolean;
}>;

type AttendanceDraft = Readonly<{
  absenceSelected: boolean;
  absenceHours: string;
  included: boolean;
  touched: boolean;
}>;

type ParticipantAttendanceViewProps = Readonly<{
  enrollmentId: string;
  participant: Readonly<{
    courseTitle: string;
    studentName: string;
    clubName: string;
    progressPercentage: number;
    sessions: readonly AttendanceSession[];
    modules: readonly Readonly<{
      id: string;
      title: string;
      completedCount: number;
      totalCount: number;
      percentage: number;
      activities: readonly Readonly<{
        id: string;
        title: string;
        completed: boolean;
        required: boolean;
      }>[];
    }>[];
  }>;
  notice?: string;
}>;

const dateFormatter = new Intl.DateTimeFormat("nb-NO", {
  dateStyle: "medium",
  timeZone: "Europe/Oslo",
});

function wholeHours(minutes: number): number {
  return Math.max(1, Math.round(minutes / 60));
}

function absenceHours(session: AttendanceSession): number {
  return Math.max(
    0,
    Math.round((session.plannedMinutes - session.presentMinutes) / 60),
  );
}

function numericHours(value: string, maximum: number): number {
  const hours = Number(value);
  return Number.isInteger(hours) ? Math.min(maximum, Math.max(0, hours)) : 0;
}

function remainingAbsenceText(hours: number): string {
  return `${hours} ${hours === 1 ? "time" : "timer"} fravær igjen`;
}

export function ParticipantAttendanceView({
  enrollmentId,
  participant,
  notice,
}: ParticipantAttendanceViewProps) {
  const [drafts, setDrafts] = useState<Record<string, AttendanceDraft>>(() =>
    Object.fromEntries(
      participant.sessions.map((session) => {
        const initialAbsence = absenceHours(session);
        return [
          session.id,
          {
            absenceSelected: session.recorded && initialAbsence > 0,
            absenceHours: String(initialAbsence),
            included: session.recorded,
            touched: false,
          },
        ];
      }),
    ),
  );

  const attendance = useMemo(() => {
    let recordedMinutes = 0;
    let presentMinutes = 0;
    let totalCourseMinutes = 0;
    let absenceMinutes = 0;

    for (const session of participant.sessions) {
      const draft = drafts[session.id];
      totalCourseMinutes += session.plannedMinutes;

      const sessionAbsenceMinutes = draft?.touched
        ? numericHours(
            draft.absenceSelected ? draft.absenceHours : "0",
            wholeHours(session.plannedMinutes),
          ) * 60
        : session.plannedMinutes - session.presentMinutes;

      if (draft?.included) {
        recordedMinutes += session.plannedMinutes;
        presentMinutes += session.plannedMinutes - sessionAbsenceMinutes;
      }
      if (session.recorded || draft?.touched) {
        absenceMinutes += sessionAbsenceMinutes;
      }
    }

    const percentage =
      recordedMinutes === 0
        ? 0
        : Math.round((presentMinutes / recordedMinutes) * 100);
    const allowedAbsenceMinutes =
      totalCourseMinutes * (1 - ATTENDANCE_REQUIREMENT);
    const remainingHours = Math.max(
      0,
      Math.floor((allowedAbsenceMinutes - absenceMinutes + 0.001) / 60),
    );

    return {
      percentage,
      remainingHours,
      meetsRequirement: percentage >= ATTENDANCE_REQUIREMENT * 100,
    };
  }, [drafts, participant.sessions]);

  function selectAbsence(sessionId: string, selected: boolean) {
    setDrafts((current) => ({
      ...current,
      [sessionId]: {
        ...current[sessionId],
        absenceSelected: selected,
        absenceHours: selected ? current[sessionId].absenceHours : "0",
        included: true,
        touched: true,
      },
    }));
  }

  function changeAbsenceHours(sessionId: string, value: string) {
    setDrafts((current) => ({
      ...current,
      [sessionId]: {
        ...current[sessionId],
        absenceHours: value,
        included: true,
        touched: true,
      },
    }));
  }

  return (
    <>
      <header className={styles.profileHero}>
        <div>
          <p className={styles.eyebrow}>{participant.courseTitle}</p>
          <h1>{participant.studentName}</h1>
          <p>{participant.clubName}</p>
        </div>
        <div className={styles.profileMetrics}>
          <span>
            <small>Progresjon</small>
            <strong>{participant.progressPercentage} %</strong>
          </span>
          <span data-tone={attendance.meetsRequirement ? "success" : "danger"}>
            <small>Oppmøte</small>
            <strong aria-live="polite">
              {attendance.percentage} % oppmøte
            </strong>
          </span>
          <span>
            <small>Krav</small>
            <strong>Oppmøtekrav 80 %</strong>
          </span>
          <span>
            <small>Fraværsramme</small>
            <strong aria-live="polite">
              {remainingAbsenceText(attendance.remainingHours)}
            </strong>
          </span>
        </div>
      </header>

      {notice ? (
        <p
          className={styles.notice}
          role={notice === "attendance-saved" ? "status" : "alert"}
        >
          {notice === "attendance-saved"
            ? "Oppmøtet er lagret."
            : "Oppmøtet kunne ikke lagres. Kontroller fraværstimene."}
        </p>
      ) : null}

      <section className={styles.moduleSection}>
        <div className={styles.sectionIntro}>
          <div>
            <p className={styles.eyebrow}>Detaljert læringsstatus</p>
            <h2>Modulprogresjon</h2>
          </div>
          <p>
            Klikk på en modul for å se hva som er gjort og hva som gjenstår.
          </p>
        </div>
        <div className={styles.moduleGrid}>
          {participant.modules.map((module) => (
            <details className={styles.moduleCard} key={module.id}>
              <summary>
                <span>
                  <strong>{module.title}</strong>
                  <small>
                    {module.completedCount} av {module.totalCount} gjennomført
                  </small>
                </span>
                <span className={styles.modulePercentage}>
                  {module.percentage} %
                </span>
                <progress
                  aria-label={`${module.title}: ${module.percentage} prosent`}
                  max="100"
                  value={module.percentage}
                />
              </summary>
              <ul className={styles.activityList}>
                {module.activities.map((activity) => (
                  <li key={activity.id}>
                    <span>{activity.title}</span>
                    <strong data-completed={activity.completed || undefined}>
                      {activity.completed
                        ? "Fullført"
                        : activity.required
                          ? "Gjenstår"
                          : "Valgfri"}
                    </strong>
                  </li>
                ))}
              </ul>
            </details>
          ))}
        </div>
      </section>

      <section className={styles.sessionSection}>
        <div>
          <p className={styles.eyebrow}>Føres etter hver samling</p>
          <h2>Oppmøte per samling</h2>
        </div>
        <ol>
          {participant.sessions.map((session) => {
            const draft = drafts[session.id];
            const plannedHours = wholeHours(session.plannedMinutes);

            return (
              <li key={session.id}>
                <article>
                  <div className={styles.sessionHeading}>
                    <span>
                      <strong>{session.title}</strong>
                      <time dateTime={session.startsAt}>
                        {dateFormatter.format(new Date(session.startsAt))}
                      </time>
                    </span>
                    <span data-recorded={session.recorded || undefined}>
                      {session.recorded ? "Registrert" : "Ikke registrert"}
                    </span>
                  </div>
                  <form
                    action={recordAttendanceAction}
                    className={styles.attendanceForm}
                  >
                    <input
                      name="enrollmentId"
                      type="hidden"
                      value={enrollmentId}
                    />
                    <input name="sessionId" type="hidden" value={session.id} />
                    <input
                      name="plannedMinutes"
                      type="hidden"
                      value={session.plannedMinutes}
                    />
                    <p className={styles.sessionDuration}>
                      Varighet: {plannedHours} hele timer
                    </p>
                    <label className={styles.absenceChoice}>
                      <input
                        checked={draft.absenceSelected}
                        onChange={(event) =>
                          selectAbsence(session.id, event.target.checked)
                        }
                        type="checkbox"
                      />
                      <span>Registrer fravær</span>
                    </label>
                    {draft.absenceSelected ? (
                      <label className={styles.absenceHours}>
                        <span>Timer fravær</span>
                        <input
                          inputMode="numeric"
                          max={plannedHours}
                          min="0"
                          name="absenceHours"
                          onChange={(event) =>
                            changeAbsenceHours(session.id, event.target.value)
                          }
                          required
                          step="1"
                          type="number"
                          value={draft.absenceHours}
                        />
                      </label>
                    ) : (
                      <input name="absenceHours" type="hidden" value="0" />
                    )}
                    <input
                      name="reason"
                      type="hidden"
                      value="Registrert etter samling"
                    />
                    <button
                      className="nivaa-button nivaa-button--secondary"
                      type="submit"
                    >
                      Lagre oppmøte for {session.title}
                    </button>
                  </form>
                </article>
              </li>
            );
          })}
        </ol>
      </section>
    </>
  );
}
