export const REQUIRED_PRACTICE_MINUTES = 45 * 60;
export const MAX_PLANNING_MINUTES = 9 * 60;

export type PracticeCategory = "delivery" | "planning";

export type PracticeEntryDuration = Readonly<{
  minutes: number;
  category: PracticeCategory;
}>;

export type PracticeTotals = Readonly<{
  totalMinutes: number;
  planningMinutes: number;
  deliveryMinutes: number;
}>;

export type PracticeSubmissionEligibility =
  | Readonly<{ ok: true }>
  | Readonly<{
      ok: false;
      reason: "missing_minutes";
      missingMinutes: number;
    }>
  | Readonly<{
      ok: false;
      reason: "planning_limit";
      excessMinutes: number;
    }>;

export function validatePracticeEntry(
  entry: PracticeEntryDuration,
): PracticeEntryDuration {
  if (!Number.isInteger(entry.minutes) || entry.minutes <= 0) {
    throw new Error("Varigheten må være et positivt antall hele minutter");
  }

  if (entry.category !== "delivery" && entry.category !== "planning") {
    throw new Error("Ugyldig praksiskategori");
  }

  return entry;
}

export function calculatePracticeTotals(
  entries: readonly PracticeEntryDuration[],
): PracticeTotals {
  return entries.reduce<PracticeTotals>(
    (totals, rawEntry) => {
      const entry = validatePracticeEntry(rawEntry);
      const planningMinutes =
        totals.planningMinutes +
        (entry.category === "planning" ? entry.minutes : 0);
      const deliveryMinutes =
        totals.deliveryMinutes +
        (entry.category === "delivery" ? entry.minutes : 0);

      return {
        totalMinutes: planningMinutes + deliveryMinutes,
        planningMinutes,
        deliveryMinutes,
      };
    },
    { totalMinutes: 0, planningMinutes: 0, deliveryMinutes: 0 },
  );
}

export function canSubmitPractice(
  totals: PracticeTotals,
): PracticeSubmissionEligibility {
  if (totals.planningMinutes > MAX_PLANNING_MINUTES) {
    return {
      ok: false,
      reason: "planning_limit",
      excessMinutes: totals.planningMinutes - MAX_PLANNING_MINUTES,
    };
  }

  if (totals.totalMinutes < REQUIRED_PRACTICE_MINUTES) {
    return {
      ok: false,
      reason: "missing_minutes",
      missingMinutes: REQUIRED_PRACTICE_MINUTES - totals.totalMinutes,
    };
  }

  return { ok: true };
}
