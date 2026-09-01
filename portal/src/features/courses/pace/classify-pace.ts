export type Pace = "green" | "yellow" | "red";

export function classifyPace(
  input: Readonly<{
    actual: number;
    recommended: number;
    hardDeadlineOverdue: boolean;
    greenLag: number;
    redLag: number;
  }>,
): Pace {
  if (input.hardDeadlineOverdue) return "red";
  const lag = input.recommended - input.actual;
  if (lag <= input.greenLag) return "green";
  if (lag <= input.redLag) return "yellow";
  return "red";
}
