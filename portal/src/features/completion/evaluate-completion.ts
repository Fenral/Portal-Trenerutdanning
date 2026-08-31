export type CompletionGate =
  "progress" | "attendance" | "practice" | "university";

export type CompletionAdminTask = "invoice_youth_drive_difference";

export type CompletionInput = Readonly<{
  level: 1 | 2 | 3;
  progress: number;
  attendance: number;
  practiceApproved: boolean;
  universityCompleted: boolean | null;
  youthDriveSelected?: boolean;
  youthDriveAttended?: boolean;
}>;

export type CompletionEvaluation = Readonly<{
  complete: boolean;
  missing: CompletionGate[];
  adminTasks: CompletionAdminTask[];
}>;

export function evaluateCompletion(
  input: CompletionInput,
): CompletionEvaluation {
  const missing: CompletionGate[] = [];
  const adminTasks: CompletionAdminTask[] = [];

  if (input.progress < 100) missing.push("progress");
  if (input.attendance < 80) missing.push("attendance");
  if (!input.practiceApproved) missing.push("practice");
  if (input.level >= 2 && input.universityCompleted !== true) {
    missing.push("university");
  }

  if (input.youthDriveSelected && input.youthDriveAttended === false) {
    adminTasks.push("invoice_youth_drive_difference");
  }

  return { complete: missing.length === 0, missing, adminTasks };
}
