import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

const DatabaseId = z
  .string()
  .trim()
  .regex(/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i);

const QuizAnswerSchema = z.object({
  questionId: DatabaseId,
  optionId: z.string().trim().min(1).max(80),
});

const StudentQuizSchema = z.object({
  activityId: DatabaseId,
  courseRunId: DatabaseId,
  enrollmentId: DatabaseId,
  quizDefinitionId: DatabaseId,
  title: z.string().trim().min(2).max(180),
  passPercent: z.number().int().min(1).max(100),
  maxAttempts: z.number().int().positive().nullable(),
  retryDelayHours: z.number().int().nonnegative(),
  attemptsUsed: z.number().int().nonnegative(),
  nextAttemptAt: z.string().nullable(),
  questions: z
    .array(
      z.object({
        id: DatabaseId,
        prompt: z.string().trim().min(2).max(2000),
        points: z.number().int().positive(),
        options: z
          .array(
            z.object({
              id: z.string().trim().min(1).max(80),
              label: z.string().trim().min(1).max(500),
            }),
          )
          .min(2)
          .max(8),
      }),
    )
    .min(1),
});

const QuizAttemptResultSchema = z.object({
  attemptId: DatabaseId,
  earned: z.number().int().nonnegative(),
  possible: z.number().int().positive(),
  percent: z.number().int().min(0).max(100),
  passed: z.boolean(),
  nextAttemptAt: z.string().nullable(),
});

const QuizAttemptInputSchema = z.object({
  activityId: DatabaseId,
  enrollmentId: DatabaseId,
  idempotencyKey: DatabaseId,
  answers: z.array(QuizAnswerSchema).min(1),
});

export type QuizAnswer = z.infer<typeof QuizAnswerSchema>;
export type StudentQuiz = z.infer<typeof StudentQuizSchema>;
export type QuizAttemptResult = z.infer<typeof QuizAttemptResultSchema>;
export type QuizAttemptInput = z.infer<typeof QuizAttemptInputSchema>;

export type LatestQuizAttempt = Readonly<{
  earned: number;
  possible: number;
  percent: number;
  passed: boolean;
  submittedAt: string;
}>;

export function parseStudentQuiz(payload: unknown): StudentQuiz {
  const parsed = StudentQuizSchema.safeParse(payload);

  if (!parsed.success) {
    throw new Error("QUIZ_PAYLOAD_INVALID");
  }

  return parsed.data;
}

export function quizAnswersFromFormData(formData: FormData): QuizAnswer[] {
  const answers = [...formData.entries()]
    .filter(
      (entry): entry is [string, string] =>
        entry[0].startsWith("answer:") && typeof entry[1] === "string",
    )
    .map(([name, optionId]) => ({
      questionId: name.slice("answer:".length),
      optionId,
    }));
  const parsed = z.array(QuizAnswerSchema).min(1).safeParse(answers);

  if (!parsed.success) {
    throw new Error("QUIZ_ANSWERS_INVALID");
  }

  return parsed.data;
}

export async function loadStudentQuiz(
  client: SupabaseClient,
  activityId: string,
): Promise<StudentQuiz> {
  const validatedActivityId = DatabaseId.safeParse(activityId);

  if (!validatedActivityId.success) {
    throw new Error("QUIZ_ACTIVITY_ID_INVALID");
  }

  const { data, error } = await client.rpc("get_quiz_for_student", {
    target_activity_id: validatedActivityId.data,
  });

  if (error) {
    throw new Error(`QUIZ_LOAD_FAILED:${error.message}`);
  }

  return parseStudentQuiz(data);
}

export async function loadLatestStudentQuizAttempt(
  client: SupabaseClient,
  enrollmentId: string,
  quizDefinitionId: string,
): Promise<LatestQuizAttempt | null> {
  const identifiers = z
    .object({ enrollmentId: DatabaseId, quizDefinitionId: DatabaseId })
    .safeParse({ enrollmentId, quizDefinitionId });

  if (!identifiers.success) {
    throw new Error("QUIZ_ATTEMPT_SCOPE_INVALID");
  }

  const { data, error } = await client
    .from("quiz_attempts")
    .select("earned_points,possible_points,percent,passed,submitted_at")
    .eq("enrollment_id", identifiers.data.enrollmentId)
    .eq("quiz_definition_id", identifiers.data.quizDefinitionId)
    .order("submitted_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(`QUIZ_ATTEMPT_LOAD_FAILED:${error.message}`);
  }

  if (!data) return null;

  return {
    earned: data.earned_points,
    possible: data.possible_points,
    percent: data.percent,
    passed: data.passed,
    submittedAt: data.submitted_at,
  };
}

export async function submitStudentQuiz(
  client: SupabaseClient,
  input: QuizAttemptInput,
): Promise<QuizAttemptResult> {
  const parsed = QuizAttemptInputSchema.safeParse(input);

  if (!parsed.success) {
    throw new Error("QUIZ_ATTEMPT_INVALID");
  }

  const { data, error } = await client.rpc("submit_quiz_attempt", {
    target_enrollment_id: parsed.data.enrollmentId,
    target_activity_id: parsed.data.activityId,
    target_idempotency_key: parsed.data.idempotencyKey,
    target_answers: parsed.data.answers,
  });

  if (error) {
    throw new Error(`QUIZ_ATTEMPT_FAILED:${error.message}`);
  }

  const result = QuizAttemptResultSchema.safeParse(data);

  if (!result.success) {
    throw new Error("QUIZ_ATTEMPT_RESPONSE_INVALID");
  }

  return result.data;
}
