"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import type { TeacherParticipantListItem } from "@/features/attendance/teacher-data";
import { participantProgressSignal } from "@/features/demo/participants";

import styles from "./participants.module.css";

type SortMode = "recommended" | "progress-desc" | "progress-asc";

export function ParticipantList({
  participants,
}: Readonly<{ participants: readonly TeacherParticipantListItem[] }>) {
  const [selectedModuleId, setSelectedModuleId] = useState("all");
  const [sortMode, setSortMode] = useState<SortMode>("recommended");
  const moduleOptions = useMemo(() => {
    const options = new Map<string, string>();
    for (const participant of participants) {
      for (const learningModule of participant.modules) {
        options.set(learningModule.id, learningModule.title);
      }
    }
    return [...options].map(([id, title]) => ({ id, title }));
  }, [participants]);

  const rows = useMemo(() => {
    const visible = participants
      .map((participant) => {
        const selectedModule =
          selectedModuleId === "all"
            ? null
            : (participant.modules.find(
                (learningModule) => learningModule.id === selectedModuleId,
              ) ?? null);
        return {
          participant,
          selectedModule,
          percentage:
            selectedModule?.percentage ?? participant.progressPercentage,
        };
      })
      .filter(
        (row) => selectedModuleId === "all" || row.selectedModule !== null,
      );

    if (sortMode === "recommended") return visible;
    return visible.sort((left, right) => {
      const difference = left.percentage - right.percentage;
      if (difference !== 0) {
        return sortMode === "progress-asc" ? difference : -difference;
      }
      return left.participant.studentName.localeCompare(
        right.participant.studentName,
        "nb-NO",
      );
    });
  }, [participants, selectedModuleId, sortMode]);

  return (
    <>
      <section aria-label="Filtrer deltakere" className={styles.listControls}>
        <label>
          <span>Vis modul</span>
          <select
            onChange={(event) => setSelectedModuleId(event.target.value)}
            value={selectedModuleId}
          >
            <option value="all">Total progresjon</option>
            {moduleOptions.map((learningModule) => (
              <option key={learningModule.id} value={learningModule.id}>
                {learningModule.title}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>Sorter deltakere</span>
          <select
            onChange={(event) => setSortMode(event.target.value as SortMode)}
            value={sortMode}
          >
            <option value="recommended">Anbefalt rekkefølge</option>
            <option value="progress-desc">Mest gjennomført først</option>
            <option value="progress-asc">Minst gjennomført først</option>
          </select>
        </label>
        <strong>{rows.length} vist</strong>
      </section>

      <section aria-label="Deltakerliste" className={styles.participantList}>
        {rows.map(({ participant, percentage, selectedModule }) => {
          const signal = participantProgressSignal(percentage);

          return (
            <Link
              aria-label={`Vis profil for ${participant.studentName}`}
              className={styles.participantRow}
              data-sort-percentage={percentage}
              href={`/teacher/participants/${participant.enrollmentId}`}
              key={participant.enrollmentId}
            >
              <div className={styles.participantIdentity}>
                <strong>{participant.studentName}</strong>
                <small>
                  {participant.clubName} · {participant.courseTitle}
                </small>
              </div>
              <span data-tone={signal.tone}>{signal.label}</span>
              <div className={styles.metric}>
                <small>{selectedModule?.title ?? "Progresjon"}</small>
                <strong>{percentage} %</strong>
                {selectedModule ? (
                  <small>
                    {selectedModule.completedCount} av{" "}
                    {selectedModule.totalCount}
                  </small>
                ) : null}
              </div>
              <div className={styles.metric}>
                <small>Oppmøte</small>
                <strong>{participant.attendancePercentage} %</strong>
              </div>
              <span className={styles.rowArrow} aria-hidden="true">
                →
              </span>
            </Link>
          );
        })}
      </section>
    </>
  );
}
