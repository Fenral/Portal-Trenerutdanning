import { describe, expect, it } from "vitest";

import { validateAssessmentResult } from "@/features/assessment/assignments/review";
import { transitionSubmission } from "@/features/assessment/assignments/state-machine";
import { parseStudentAssignment } from "@/features/assessment/assignments/submit";

describe("assignment state", () => {
  it("allows revision and resubmission without overwriting history", () => {
    expect(transitionSubmission("submitted", "request_revision")).toBe(
      "revision_required",
    );
    expect(transitionSubmission("revision_required", "resubmit")).toBe(
      "submitted",
    );
  });

  it("does not let a student approve their own work", () => {
    expect(() => transitionSubmission("submitted", "student_approve")).toThrow(
      "Ugyldig overgang",
    );
  });

  it("requires a teacher reason before reopening a final result", () => {
    expect(() => transitionSubmission("approved", "reopen")).toThrow(
      "Begrunnelse er påkrevd",
    );
    expect(
      transitionSubmission("approved", "reopen", {
        actor: "teacher",
        reason: "Ny dokumentasjon er mottatt",
      }),
    ).toBe("revision_required");
  });

  it("validates both supported assessment scales", () => {
    expect(
      validateAssessmentResult({
        scale: "pass_fail",
        value: "approved",
        comment: "Godkjent",
      }),
    ).toMatchObject({ scale: "pass_fail", value: "approved" });
    expect(() =>
      validateAssessmentResult({
        scale: "letter",
        value: "G",
        comment: "Ugyldig karakter",
      }),
    ).toThrow("Ugyldig vurdering");
  });

  it("parses immutable submission versions for the student view", () => {
    expect(
      parseStudentAssignment({
        activityId: "a3200000-0000-0000-0000-000000000007",
        courseRunId: "b1030000-0000-0000-0000-000000000001",
        enrollmentId: "01000000-0000-0000-0000-000000000001",
        title: "Innlevering",
        instructions: "Last opp oppgaven.",
        assessmentScale: "pass_fail",
        effectiveDeadline: "2026-12-20T22:59:00+00:00",
        status: "revision_required",
        submissionId: "02000000-0000-0000-0000-000000000001",
        versions: [
          {
            id: "03000000-0000-0000-0000-000000000001",
            versionNumber: 1,
            note: "Første versjon",
            submittedAt: "2026-09-01T10:00:00+00:00",
            attachments: [
              {
                id: "04000000-0000-0000-0000-000000000001",
                filename: "oppgave.pdf",
                mimeType: "application/pdf",
                byteSize: 42,
              },
            ],
          },
        ],
        reviews: [],
      }).versions[0].versionNumber,
    ).toBe(1);
  });
});
