export type AttemptPolicyResult = Readonly<{
  passed: boolean;
  delayHours: number;
}>;

export function nextAttemptAt(
  result: AttemptPolicyResult,
  now: Date,
): Date | null {
  if (result.passed || result.delayHours === 0) return null;

  return new Date(now.getTime() + result.delayHours * 60 * 60 * 1000);
}
