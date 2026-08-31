import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

import type { AssessmentResult } from "./state-machine";

const DatabaseId = z
  .string()
  .trim()
  .regex(/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i);

const AssessmentResultSchema = z.discriminatedUnion("scale", [
  z.object({
    scale: z.literal("pass_fail"),
    value: z.enum(["approved", "not_approved"]),
    comment: z.string().trim().min(2).max(4000),
  }),
  z.object({
    scale: z.literal("letter"),
    value: z.enum(["A", "B", "C", "D", "E", "F"]),
    comment: z.string().trim().min(2).max(4000),
  }),
]);

const ReviewAssignmentInputSchema = z.object({
  submissionId: DatabaseId,
  action: z.enum(["request_revision", "approve", "grade", "reopen"]),
  resultValue: z.string().trim().nullable(),
  comment: z.string().trim().min(2).max(4000),
  newDeadline: z.string().trim().nullable(),
  deadlineReason: z.string().trim().nullable(),
});

const ReviewAssignmentResultSchema = z.object({
  submissionId: DatabaseId,
  status: z.enum(["revision_required", "approved", "graded"]),
  resultValue: z.string().nullable(),
  deadlineOverrideId: DatabaseId.nullable(),
});

export type ReviewAssignmentInput = z.infer<typeof ReviewAssignmentInputSchema>;
export type ReviewAssignmentResult = z.infer<
  typeof ReviewAssignmentResultSchema
>;

export function validateAssessmentResult(input: unknown): AssessmentResult {
  const parsed = AssessmentResultSchema.safeParse(input);

  if (!parsed.success) {
    throw new Error("Ugyldig vurdering");
  }

  return parsed.data;
}

export async function reviewAssignment(
  client: SupabaseClient,
  input: ReviewAssignmentInput,
): Promise<ReviewAssignmentResult> {
  const parsed = ReviewAssignmentInputSchema.safeParse(input);

  if (!parsed.success) {
    throw new Error("ASSIGNMENT_REVIEW_INVALID");
  }

  const { data, error } = await client.rpc("review_assignment_submission", {
    target_submission_id: parsed.data.submissionId,
    target_action: parsed.data.action,
    target_result_value: parsed.data.resultValue,
    target_comment: parsed.data.comment,
    target_new_deadline: parsed.data.newDeadline,
    target_deadline_reason: parsed.data.deadlineReason,
  });

  if (error) {
    throw new Error(`ASSIGNMENT_REVIEW_FAILED:${error.message}`);
  }

  const result = ReviewAssignmentResultSchema.safeParse(data);

  if (!result.success) {
    throw new Error("ASSIGNMENT_REVIEW_RESPONSE_INVALID");
  }

  return result.data;
}
