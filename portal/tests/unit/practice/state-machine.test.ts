import { describe, expect, it } from "vitest";

import { transitionPracticeSubmission } from "@/features/practice/state-machine";

describe("practice submission state", () => {
  it("supports both manual and delayed automatic approval", () => {
    expect(transitionPracticeSubmission("submitted", "teacher_approve")).toBe(
      "approved_manual",
    );
    expect(transitionPracticeSubmission("submitted", "auto_approve_due")).toBe(
      "approved_auto",
    );
  });

  it("allows a spot-check to revoke an automatic approval with a reason", () => {
    expect(() =>
      transitionPracticeSubmission("approved_auto", "spot_check_revoke"),
    ).toThrow("Begrunnelse er påkrevd");
    expect(
      transitionPracticeSubmission("approved_auto", "spot_check_revoke", {
        actor: "teacher",
        reason: "Tre timer mangler dokumentasjon",
      }),
    ).toBe("revision_required");
  });

  it("lets the student resubmit only after revision is required", () => {
    expect(
      transitionPracticeSubmission("revision_required", "student_resubmit"),
    ).toBe("submitted");
    expect(() =>
      transitionPracticeSubmission("approved_auto", "student_resubmit"),
    ).toThrow("Ugyldig overgang");
  });
});
