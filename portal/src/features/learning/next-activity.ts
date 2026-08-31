import { getActivityAccess, type ActivityPrerequisite } from "./access";

export type SequencedActivity = Readonly<{
  id: string;
  title: string;
}>;

export function getNextActivity<Activity extends SequencedActivity>(
  activities: readonly Activity[],
  completions: ReadonlySet<string>,
  prerequisites: readonly ActivityPrerequisite[],
): Activity | null {
  return (
    activities.find(
      (activity) =>
        !completions.has(activity.id) &&
        getActivityAccess(activity.id, completions, prerequisites).state ===
          "open",
    ) ?? null
  );
}
