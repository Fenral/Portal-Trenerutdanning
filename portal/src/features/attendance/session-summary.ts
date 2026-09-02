export type SessionAttendanceSummary = Readonly<{
  /** Antall deltakere med registrert oppmøterad for samlingen. */
  registered: number;
  /** Antall av dem med registrert fravær (færre minutter enn planlagt). */
  withAbsence: number;
}>;

export function summarizeSessionAttendance(
  records: ReadonlyArray<
    Readonly<{
      sessionId: string;
      plannedMinutes: number;
      presentMinutes: number;
    }>
  >,
): ReadonlyMap<string, SessionAttendanceSummary> {
  const summaries = new Map<string, SessionAttendanceSummary>();

  for (const record of records) {
    const current = summaries.get(record.sessionId) ?? {
      registered: 0,
      withAbsence: 0,
    };
    summaries.set(record.sessionId, {
      registered: current.registered + 1,
      withAbsence:
        current.withAbsence +
        (record.presentMinutes < record.plannedMinutes ? 1 : 0),
    });
  }

  return summaries;
}
