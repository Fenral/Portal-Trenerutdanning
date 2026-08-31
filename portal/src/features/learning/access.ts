export type ActivityPrerequisite = Readonly<{
  activityId: string;
  prerequisiteActivityId: string;
  title: string;
}>;

export type ActivityAccess =
  | Readonly<{ state: "open" }>
  | Readonly<{
      state: "locked";
      missing: readonly Readonly<{ activityId: string; title: string }>[];
    }>;

export function getActivityAccess(
  activityId: string,
  completions: ReadonlySet<string>,
  prerequisites: readonly ActivityPrerequisite[],
): ActivityAccess {
  const missing = prerequisites
    .filter(
      (prerequisite) =>
        prerequisite.activityId === activityId &&
        !completions.has(prerequisite.prerequisiteActivityId),
    )
    .map((prerequisite) => ({
      activityId: prerequisite.prerequisiteActivityId,
      title: prerequisite.title,
    }));

  return missing.length === 0
    ? { state: "open" }
    : { state: "locked", missing };
}

export function assertAcyclicPrerequisites(
  prerequisites: readonly ActivityPrerequisite[],
): void {
  const prerequisitesByActivity = new Map<string, string[]>();

  for (const prerequisite of prerequisites) {
    const dependencies =
      prerequisitesByActivity.get(prerequisite.activityId) ?? [];
    dependencies.push(prerequisite.prerequisiteActivityId);
    prerequisitesByActivity.set(prerequisite.activityId, dependencies);
  }

  const state = new Map<string, "visiting" | "visited">();

  function visit(activityId: string): void {
    if (state.get(activityId) === "visiting") {
      throw new Error("Sirkulær avhengighet i læringsløpet");
    }

    if (state.get(activityId) === "visited") {
      return;
    }

    state.set(activityId, "visiting");

    for (const prerequisiteId of prerequisitesByActivity.get(activityId) ??
      []) {
      visit(prerequisiteId);
    }

    state.set(activityId, "visited");
  }

  for (const activityId of prerequisitesByActivity.keys()) {
    visit(activityId);
  }
}
