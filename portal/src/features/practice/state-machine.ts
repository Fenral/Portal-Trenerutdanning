export type PracticeSubmissionStatus =
  "submitted" | "approved_manual" | "approved_auto" | "revision_required";

export type PracticeSubmissionAction =
  | "teacher_approve"
  | "auto_approve_due"
  | "request_revision"
  | "spot_check_revoke"
  | "student_resubmit";

type TransitionContext = Readonly<{
  actor?: "student" | "teacher" | "administrator" | "system";
  reason?: string;
}>;

export function transitionPracticeSubmission(
  current: PracticeSubmissionStatus,
  action: PracticeSubmissionAction,
  context: TransitionContext = {},
): PracticeSubmissionStatus {
  if (current === "submitted" && action === "teacher_approve") {
    return "approved_manual";
  }

  if (current === "submitted" && action === "auto_approve_due") {
    return "approved_auto";
  }

  if (current === "submitted" && action === "request_revision") {
    if (!context.reason?.trim()) throw new Error("Begrunnelse er påkrevd");
    return "revision_required";
  }

  if (
    (current === "approved_auto" || current === "approved_manual") &&
    action === "spot_check_revoke"
  ) {
    if (
      (context.actor !== "teacher" && context.actor !== "administrator") ||
      !context.reason?.trim()
    ) {
      throw new Error("Begrunnelse er påkrevd");
    }

    return "revision_required";
  }

  if (current === "revision_required" && action === "student_resubmit") {
    return "submitted";
  }

  throw new Error(`Ugyldig overgang: ${current} → ${action}`);
}
