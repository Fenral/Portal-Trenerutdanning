const featuredDemoParticipants = [
  "Kari Ferdig",
  "Trond «50%»",
  "Jonas «henger etter»",
] as const;

const featuredRank = new Map<string, number>(
  featuredDemoParticipants.map((name, index) => [name, index]),
);

export type ParticipantProgressSignal = Readonly<{
  label: "Fullført" | "Midtveis" | "Henger etter";
  tone: "success" | "attention" | "danger";
}>;

export function participantProgressSignal(
  percentage: number,
): ParticipantProgressSignal {
  if (percentage >= 100) return { label: "Fullført", tone: "success" };
  if (percentage >= 50) return { label: "Midtveis", tone: "attention" };
  return { label: "Henger etter", tone: "danger" };
}

export function sortDemoParticipants<T>(
  participants: readonly T[],
  nameFor: (participant: T) => string,
): T[] {
  return [...participants].sort((left, right) => {
    const leftName = nameFor(left);
    const rightName = nameFor(right);
    const leftRank = featuredRank.get(leftName);
    const rightRank = featuredRank.get(rightName);

    if (leftRank !== undefined || rightRank !== undefined) {
      return (
        (leftRank ?? Number.MAX_SAFE_INTEGER) -
        (rightRank ?? Number.MAX_SAFE_INTEGER)
      );
    }

    return leftName.localeCompare(rightName, "nb-NO");
  });
}
