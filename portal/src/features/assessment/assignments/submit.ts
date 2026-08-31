import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

const DatabaseId = z
  .string()
  .trim()
  .regex(/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i);

const SubmissionStatus = z.enum([
  "draft",
  "submitted",
  "revision_required",
  "approved",
  "graded",
]);

const StudentAssignmentSchema = z.object({
  activityId: DatabaseId,
  courseRunId: DatabaseId,
  enrollmentId: DatabaseId,
  title: z.string().trim().min(2).max(180),
  instructions: z.string().trim().min(2).max(4000),
  assessmentScale: z.enum(["pass_fail", "letter"]),
  effectiveDeadline: z.string(),
  status: SubmissionStatus.nullable(),
  submissionId: DatabaseId.nullable(),
  versions: z.array(
    z.object({
      id: DatabaseId,
      versionNumber: z.number().int().positive(),
      note: z.string().max(2000),
      submittedAt: z.string(),
      attachments: z.array(
        z.object({
          id: DatabaseId,
          filename: z.string().min(1).max(255),
          mimeType: z.string().min(1).max(200),
          byteSize: z.number().positive(),
        }),
      ),
    }),
  ),
  reviews: z.array(
    z.object({
      id: DatabaseId,
      action: z.enum(["request_revision", "approve", "grade", "reopen"]),
      scale: z.enum(["pass_fail", "letter"]).nullable(),
      resultValue: z.string().nullable(),
      comment: z.string().min(2).max(4000),
      reviewedAt: z.string(),
    }),
  ),
});

const SubmitAssignmentInputSchema = z.object({
  activityId: DatabaseId,
  enrollmentId: DatabaseId,
  mediaAssetId: DatabaseId,
  note: z.string().trim().max(2000),
});

const SubmitAssignmentResultSchema = z.object({
  submissionId: DatabaseId,
  versionId: DatabaseId,
  versionNumber: z.number().int().positive(),
  status: z.literal("submitted"),
});

export type StudentAssignment = z.infer<typeof StudentAssignmentSchema>;
export type SubmitAssignmentInput = z.infer<typeof SubmitAssignmentInputSchema>;
export type SubmitAssignmentResult = z.infer<
  typeof SubmitAssignmentResultSchema
>;

export function parseStudentAssignment(payload: unknown): StudentAssignment {
  const parsed = StudentAssignmentSchema.safeParse(payload);

  if (!parsed.success) {
    throw new Error("ASSIGNMENT_PAYLOAD_INVALID");
  }

  return parsed.data;
}

export async function loadStudentAssignment(
  client: SupabaseClient,
  activityId: string,
): Promise<StudentAssignment> {
  const parsedActivityId = DatabaseId.safeParse(activityId);

  if (!parsedActivityId.success) {
    throw new Error("ASSIGNMENT_ACTIVITY_ID_INVALID");
  }

  const { data, error } = await client.rpc("get_assignment_for_student", {
    target_activity_id: parsedActivityId.data,
  });

  if (error) {
    throw new Error(`ASSIGNMENT_LOAD_FAILED:${error.message}`);
  }

  return parseStudentAssignment(data);
}

export async function submitAssignmentVersion(
  client: SupabaseClient,
  input: SubmitAssignmentInput,
): Promise<SubmitAssignmentResult> {
  const parsed = SubmitAssignmentInputSchema.safeParse(input);

  if (!parsed.success) {
    throw new Error("ASSIGNMENT_SUBMISSION_INVALID");
  }

  const { data, error } = await client.rpc("submit_assignment_version", {
    target_enrollment_id: parsed.data.enrollmentId,
    target_activity_id: parsed.data.activityId,
    target_media_asset_id: parsed.data.mediaAssetId,
    target_note: parsed.data.note,
  });

  if (error) {
    throw new Error(`ASSIGNMENT_SUBMISSION_FAILED:${error.message}`);
  }

  const result = SubmitAssignmentResultSchema.safeParse(data);

  if (!result.success) {
    throw new Error("ASSIGNMENT_SUBMISSION_RESPONSE_INVALID");
  }

  return result.data;
}
