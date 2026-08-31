export type SubmissionStatus =
  "draft" | "submitted" | "revision_required" | "approved" | "graded";

export type SubmissionAction =
  | "submit"
  | "resubmit"
  | "request_revision"
  | "approve"
  | "grade"
  | "reopen"
  | "student_approve";

export type AssessmentResult =
  | {
      scale: "pass_fail";
      value: "approved" | "not_approved";
      comment: string;
    }
  | {
      scale: "letter";
      value: "A" | "B" | "C" | "D" | "E" | "F";
      comment: string;
    };

type TransitionContext = Readonly<{
  actor: "student" | "teacher" | "administrator";
  reason?: string;
}>;

const ordinaryTransitions: Readonly<
  Partial<
    Record<
      SubmissionStatus,
      Partial<Record<SubmissionAction, SubmissionStatus>>
    >
  >
> = {
  draft: { submit: "submitted" },
  submitted: {
    approve: "approved",
    grade: "graded",
    request_revision: "revision_required",
  },
  revision_required: { resubmit: "submitted" },
};

export function transitionSubmission(
  status: SubmissionStatus,
  action: SubmissionAction,
  context?: TransitionContext,
): SubmissionStatus {
  if (action === "reopen" && (status === "approved" || status === "graded")) {
    if (
      !context ||
      !["teacher", "administrator"].includes(context.actor) ||
      !context.reason?.trim()
    ) {
      throw new Error("Begrunnelse er påkrevd for å åpne vurderingen på nytt");
    }

    return "revision_required";
  }

  const nextStatus = ordinaryTransitions[status]?.[action];

  if (!nextStatus) {
    throw new Error(`Ugyldig overgang: ${status} → ${action}`);
  }

  return nextStatus;
}
