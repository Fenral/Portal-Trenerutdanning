export const ATTENDANCE_REQUIREMENT_RATIO = 0.8;

export type AttendanceRecord = Readonly<{
  plannedMinutes: number;
  presentMinutes: number;
}>;

export type AttendanceTotals = Readonly<{
  plannedMinutes: number;
  presentMinutes: number;
  rawRatio: number;
  displayPercentage: number;
  meetsRequirement: boolean;
}>;

export function calculateAttendance(
  records: readonly AttendanceRecord[],
): AttendanceTotals {
  const totals = records.reduce(
    (current, record) => {
      if (
        !Number.isInteger(record.plannedMinutes) ||
        !Number.isInteger(record.presentMinutes) ||
        record.plannedMinutes <= 0 ||
        record.presentMinutes < 0 ||
        record.presentMinutes > record.plannedMinutes
      ) {
        throw new Error("Ugyldig oppmøteregistrering");
      }

      return {
        plannedMinutes: current.plannedMinutes + record.plannedMinutes,
        presentMinutes: current.presentMinutes + record.presentMinutes,
      };
    },
    { plannedMinutes: 0, presentMinutes: 0 },
  );
  const rawRatio =
    totals.plannedMinutes === 0
      ? 0
      : totals.presentMinutes / totals.plannedMinutes;

  return {
    ...totals,
    rawRatio,
    displayPercentage: Math.round(rawRatio * 100),
    meetsRequirement: rawRatio >= ATTENDANCE_REQUIREMENT_RATIO,
  };
}

export function validateAttendanceOverride(
  input: Readonly<{
    administratorId: string;
    reason: string;
  }>,
) {
  const administratorId = input.administratorId.trim();
  const reason = input.reason.trim();

  if (
    !/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(administratorId) ||
    reason.length < 2
  ) {
    throw new Error("Administrator og begrunnelse er påkrevd");
  }

  return { administratorId, reason } as const;
}
