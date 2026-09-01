export type PaceMilestone = Readonly<{ at: Date; percent: number }>;

/**
 * Linear interpolation between teacher-defined milestones on UTC epoch time.
 * Before the first milestone the first percent applies; after the last the
 * last percent applies. Round only the final display value, never here.
 */
export function recommendedProgress(
  milestones: readonly PaceMilestone[],
  at: Date,
): number {
  if (milestones.length === 0) return 0;
  const sorted = [...milestones].sort(
    (left, right) => left.at.getTime() - right.at.getTime(),
  );
  for (const [index, milestone] of sorted.entries()) {
    if (milestone.percent < 0 || milestone.percent > 100) {
      throw new Error("PACE_MILESTONE_PERCENT_INVALID");
    }
    const previous = sorted[index - 1];
    if (
      previous &&
      (milestone.at.getTime() <= previous.at.getTime() ||
        milestone.percent <= previous.percent)
    ) {
      throw new Error("PACE_MILESTONES_NOT_STRICTLY_INCREASING");
    }
  }

  const time = at.getTime();
  const first = sorted[0];
  const last = sorted[sorted.length - 1];
  if (time <= first.at.getTime()) return first.percent;
  if (time >= last.at.getTime()) return last.percent;

  const nextIndex = sorted.findIndex(
    (milestone) => milestone.at.getTime() >= time,
  );
  const from = sorted[nextIndex - 1];
  const to = sorted[nextIndex];
  const fraction =
    (time - from.at.getTime()) / (to.at.getTime() - from.at.getTime());
  return from.percent + fraction * (to.percent - from.percent);
}
