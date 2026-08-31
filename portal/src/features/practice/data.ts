import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

const DatabaseId = z
  .string()
  .trim()
  .regex(/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i);

const PracticeStatus = z.enum([
  "submitted",
  "approved_manual",
  "approved_auto",
  "revision_required",
]);

const StudentPracticeSchema = z.object({
  activityId: DatabaseId,
  enrollmentId: DatabaseId,
  courseRunId: DatabaseId,
  title: z.string().trim().min(2).max(180),
  requiredMinutes: z.number().int().positive(),
  maxPlanningMinutes: z.number().int().nonnegative(),
  totalMinutes: z.number().int().nonnegative(),
  planningMinutes: z.number().int().nonnegative(),
  deliveryMinutes: z.number().int().nonnegative(),
  status: PracticeStatus.nullable(),
  latestVersionNumber: z.number().int().positive().nullable(),
  canSubmit: z.boolean(),
  entries: z.array(
    z.object({
      id: DatabaseId,
      occurredOn: z.string(),
      minutes: z.number().int().positive(),
      category: z.enum(["delivery", "planning"]),
      description: z.string().trim().min(2),
      createdAt: z.string(),
    }),
  ),
  submissions: z.array(
    z.object({
      id: DatabaseId,
      versionNumber: z.number().int().positive(),
      status: PracticeStatus,
      totalMinutes: z.number().int().positive(),
      planningMinutes: z.number().int().nonnegative(),
      deliveryMinutes: z.number().int().nonnegative(),
      submittedAt: z.string(),
      events: z.array(
        z.object({
          id: z.number().int().positive(),
          type: z.enum([
            "submitted",
            "approved_manual",
            "approved_auto",
            "revision_required",
            "spot_check_revoked",
          ]),
          reason: z.string().nullable(),
          occurredAt: z.string(),
        }),
      ),
    }),
  ),
});

const PracticeEntryInputSchema = z.object({
  enrollmentId: DatabaseId,
  activityId: DatabaseId,
  occurredOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  minutes: z.number().int().positive(),
  category: z.enum(["delivery", "planning"]),
  description: z.string().trim().min(2).max(2000),
  idempotencyKey: DatabaseId,
});

const PracticeEntryResultSchema = z.object({
  entryId: DatabaseId,
  totalMinutes: z.number().int().positive(),
  planningMinutes: z.number().int().nonnegative(),
  deliveryMinutes: z.number().int().nonnegative(),
});

const PracticeSubmissionResultSchema = z.object({
  submissionId: DatabaseId,
  versionNumber: z.number().int().positive(),
  status: z.literal("submitted"),
  autoApproveAt: z.string().nullable(),
});

const ReviewPracticeInputSchema = z.object({
  submissionId: DatabaseId,
  action: z.enum(["approve", "request_revision", "spot_check_revoke"]),
  comment: z.string().trim().min(2).max(4000),
});

const ReviewPracticeResultSchema = z.object({
  submissionId: DatabaseId,
  status: PracticeStatus,
});

export type StudentPractice = z.infer<typeof StudentPracticeSchema>;
export type PracticeEntryInput = z.infer<typeof PracticeEntryInputSchema>;
export type ReviewPracticeInput = z.infer<typeof ReviewPracticeInputSchema>;

export async function loadStudentPractice(
  client: SupabaseClient,
  activityId: string,
): Promise<StudentPractice> {
  const parsedActivityId = DatabaseId.safeParse(activityId);
  if (!parsedActivityId.success) throw new Error("PRACTICE_ACTIVITY_INVALID");

  const { data, error } = await client.rpc("get_practice_for_student", {
    target_activity_id: parsedActivityId.data,
  });

  if (error) throw new Error(`PRACTICE_LOAD_FAILED:${error.message}`);

  const parsed = StudentPracticeSchema.safeParse(data);
  if (!parsed.success) throw new Error("PRACTICE_PAYLOAD_INVALID");
  return parsed.data;
}

export async function addPracticeEntry(
  client: SupabaseClient,
  input: PracticeEntryInput,
) {
  const parsed = PracticeEntryInputSchema.safeParse(input);
  if (!parsed.success) throw new Error("PRACTICE_ENTRY_INVALID");

  const { data, error } = await client.rpc("add_practice_entry", {
    target_enrollment_id: parsed.data.enrollmentId,
    target_activity_id: parsed.data.activityId,
    target_occurred_on: parsed.data.occurredOn,
    target_minutes: parsed.data.minutes,
    target_category: parsed.data.category,
    target_description: parsed.data.description,
    target_idempotency_key: parsed.data.idempotencyKey,
  });

  if (error) throw new Error(`PRACTICE_ENTRY_FAILED:${error.message}`);

  const result = PracticeEntryResultSchema.safeParse(data);
  if (!result.success) throw new Error("PRACTICE_ENTRY_RESPONSE_INVALID");
  return result.data;
}

export async function submitPractice(
  client: SupabaseClient,
  input: Readonly<{ enrollmentId: string; activityId: string }>,
) {
  const parsed = z
    .object({ enrollmentId: DatabaseId, activityId: DatabaseId })
    .safeParse(input);
  if (!parsed.success) throw new Error("PRACTICE_SUBMISSION_INVALID");

  const { data, error } = await client.rpc("submit_practice", {
    target_enrollment_id: parsed.data.enrollmentId,
    target_activity_id: parsed.data.activityId,
  });

  if (error) throw new Error(`PRACTICE_SUBMISSION_FAILED:${error.message}`);

  const result = PracticeSubmissionResultSchema.safeParse(data);
  if (!result.success) throw new Error("PRACTICE_SUBMISSION_RESPONSE_INVALID");
  return result.data;
}

export async function reviewPractice(
  client: SupabaseClient,
  input: ReviewPracticeInput,
) {
  const parsed = ReviewPracticeInputSchema.safeParse(input);
  if (!parsed.success) throw new Error("PRACTICE_REVIEW_INVALID");

  const { data, error } = await client.rpc("review_practice_submission", {
    target_submission_id: parsed.data.submissionId,
    target_action: parsed.data.action,
    target_comment: parsed.data.comment,
  });

  if (error) throw new Error(`PRACTICE_REVIEW_FAILED:${error.message}`);

  const result = ReviewPracticeResultSchema.safeParse(data);
  if (!result.success) throw new Error("PRACTICE_REVIEW_RESPONSE_INVALID");
  return result.data;
}
