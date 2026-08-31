export type PublicationPlanInput = Readonly<{
  currentRevision: number | null;
  changeNote: string;
  hasDraft: boolean;
}>;

export type PublicationPlan = Readonly<{
  nextRevision: number;
  supersedeRevision: number | null;
  changeNote: string;
}>;

export function planPublication(input: PublicationPlanInput): PublicationPlan {
  if (!input.hasDraft) {
    throw new Error("Ingen kladd å publisere");
  }

  const changeNote = input.changeNote.trim();
  if (changeNote.length < 3) {
    throw new Error("Endringsnotat er påkrevd");
  }

  return {
    nextRevision: (input.currentRevision ?? 0) + 1,
    supersedeRevision: input.currentRevision,
    changeNote,
  };
}
