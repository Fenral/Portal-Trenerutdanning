export type SessionAttendanceSummary = Readonly<{
  /** Antall deltakere med registrert oppmøterad for samlingen. */
  registered: number;
  /** Antall av dem som var tilstede (mer enn 0 minutter). */
  present: number;
}>;

export function summarizeSessionAttendance(
  records: ReadonlyArray<
    Readonly<{ sessionId: string; presentMinutes: number }>
  >,
): ReadonlyMap<string, SessionAttendanceSummary> {
  const summaries = new Map<string, SessionAttendanceSummary>();

  for (const record of records) {
    const current = summaries.get(record.sessionId) ?? {
      registered: 0,
      present: 0,
    };
    summaries.set(record.sessionId, {
      registered: current.registered + 1,
      present: current.present + (record.presentMinutes > 0 ? 1 : 0),
    });
  }

  return summaries;
}
