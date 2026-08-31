export type ProgressActivity = Readonly<{
  id: string;
  required: boolean;
  weight: number;
}>;

export type ProgressSummary = Readonly<{
  completedWeight: number;
  totalWeight: number;
  percentage: number;
}>;

export function calculateProgress(
  activities: readonly ProgressActivity[],
  completed: ReadonlySet<string>,
): ProgressSummary {
  const requiredActivities = activities.filter((activity) => activity.required);
  const totalWeight = requiredActivities.reduce(
    (sum, activity) => sum + activity.weight,
    0,
  );
  const completedWeight = requiredActivities
    .filter((activity) => completed.has(activity.id))
    .reduce((sum, activity) => sum + activity.weight, 0);
  const percentage =
    totalWeight === 0
      ? 0
      : Math.min(100, Math.round((completedWeight / totalWeight) * 100));

  return { completedWeight, totalWeight, percentage };
}
