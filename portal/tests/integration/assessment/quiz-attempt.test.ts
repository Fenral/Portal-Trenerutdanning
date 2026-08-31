import { randomUUID } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { beforeAll, describe, expect, it } from "vitest";

const courseRunId = "b1030000-0000-0000-0000-000000000001";
const learningPathId = "a3000000-0000-0000-0000-000000000001";
const knowledgeTestId = "a3200000-0000-0000-0000-000000000006";
const henrikProfileId = "c0000000-0000-0000-0000-000000000008";

const prerequisiteCompletions = [
  {
    activity_id: "a3200000-0000-0000-0000-000000000001",
    content_item_id: "a2000000-0000-0000-0000-000000000002",
    content_revision_id: "a2100000-0000-0000-0000-000000000003",
  },
  {
    activity_id: "a3200000-0000-0000-0000-000000000002",
    content_item_id: "a2000000-0000-0000-0000-000000000003",
    content_revision_id: "a2100000-0000-0000-0000-000000000005",
  },
  {
    activity_id: "a3200000-0000-0000-0000-000000000003",
    content_item_id: "a2000000-0000-0000-0000-000000000001",
    content_revision_id: "a2100000-0000-0000-0000-000000000001",
  },
] as const;

const correctAnswers = [
  { questionId: "a4100000-0000-0000-0000-000000000001", optionId: "b" },
  { questionId: "a4100000-0000-0000-0000-000000000002", optionId: "a" },
  { questionId: "a4100000-0000-0000-0000-000000000003", optionId: "c" },
  { questionId: "a4100000-0000-0000-0000-000000000004", optionId: "b" },
  { questionId: "a4100000-0000-0000-0000-000000000005", optionId: "a" },
] as const;

const wrongAnswers = correctAnswers.map((answer) => ({
  questionId: answer.questionId,
  optionId: answer.optionId === "a" ? "b" : "a",
}));

type QuizResult = Readonly<{
  attemptId: string;
  earned: number;
  nextAttemptAt: string | null;
  passed: boolean;
  percent: number;
  possible: number;
}>;

function loadLocalEnvironment(): void {
  const path = ".env.local";

  if (!existsSync(path)) {
    return;
  }

  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const separator = line.indexOf("=");

    if (separator < 1 || line.startsWith("#")) {
      continue;
    }

    process.env[line.slice(0, separator)] ??= line.slice(separator + 1);
  }
}

function requiredEnvironment(name: string): string {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Missing integration environment variable: ${name}`);
  }

  return value;
}

function assertNoSupabaseError(error: { message: string } | null): void {
  if (error) {
    throw new Error(error.message);
  }
}

async function signedInStudent(email: string): Promise<SupabaseClient> {
  const client = createClient(
    requiredEnvironment("NEXT_PUBLIC_SUPABASE_URL"),
    requiredEnvironment("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"),
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
  const { error } = await client.auth.signInWithPassword({
    email,
    password: requiredEnvironment("E2E_DEMO_PASSWORD"),
  });
  assertNoSupabaseError(error);
  return client;
}

describe.sequential("quiz attempts against local Supabase", () => {
  let adminClient: SupabaseClient;
  let selmaClientA: SupabaseClient;
  let selmaClientB: SupabaseClient;
  let henrikClient: SupabaseClient;
  let henrikEnrollmentId: string;
  let passedAttemptId: string;

  beforeAll(async () => {
    loadLocalEnvironment();
    adminClient = createClient(
      requiredEnvironment("NEXT_PUBLIC_SUPABASE_URL"),
      requiredEnvironment("SUPABASE_SECRET_KEY"),
      { auth: { autoRefreshToken: false, persistSession: false } },
    );
    [selmaClientA, selmaClientB, henrikClient] = await Promise.all([
      signedInStudent("selma.dahl@nivaa.invalid"),
      signedInStudent("selma.dahl@nivaa.invalid"),
      signedInStudent("henrik.aas@nivaa.invalid"),
    ]);

    const existingEnrollment = await adminClient
      .from("enrollments")
      .select("id")
      .eq("course_run_id", courseRunId)
      .eq("profile_id", henrikProfileId)
      .maybeSingle();
    assertNoSupabaseError(existingEnrollment.error);

    henrikEnrollmentId = existingEnrollment.data?.id ?? randomUUID();

    if (!existingEnrollment.data) {
      assertNoSupabaseError(
        (
          await adminClient.from("enrollments").insert({
            id: henrikEnrollmentId,
            course_run_id: courseRunId,
            profile_id: henrikProfileId,
            status: "active",
          })
        ).error,
      );
    }

    const existingCompletions = await adminClient
      .from("activity_completions")
      .select("activity_id")
      .eq("enrollment_id", henrikEnrollmentId);
    assertNoSupabaseError(existingCompletions.error);
    const completedIds = new Set(
      (existingCompletions.data ?? []).map((row) => row.activity_id),
    );
    const missingCompletions = prerequisiteCompletions
      .filter((completion) => !completedIds.has(completion.activity_id))
      .map((completion) => ({
        ...completion,
        enrollment_id: henrikEnrollmentId,
        course_run_id: courseRunId,
        learning_path_id: learningPathId,
        source: "system",
        completed_by: henrikProfileId,
      }));

    if (missingCompletions.length > 0) {
      assertNoSupabaseError(
        (
          await adminClient
            .from("activity_completions")
            .insert(missingCompletions)
        ).error,
      );
    }
  });

  it("returns questions without leaking correct answers", async () => {
    const { data, error } = await selmaClientA.rpc("get_quiz_for_student", {
      target_activity_id: knowledgeTestId,
    });

    assertNoSupabaseError(error);
    expect(data).toMatchObject({
      passPercent: 80,
      retryDelayHours: 24,
      title: "Kunnskapsprøve",
    });
    expect(data.questions).toHaveLength(5);
    expect(JSON.stringify(data)).not.toMatch(/correct[_A-Z]?option/i);

    const directQuestionRead = await selmaClientA
      .from("question_versions")
      .select("correct_option_id");
    assertNoSupabaseError(directQuestionRead.error);
    expect(directQuestionRead.data).toEqual([]);
  });

  it("turns concurrent duplicate submissions into one passed attempt", async () => {
    const enrollment = await adminClient
      .from("enrollments")
      .select("id")
      .eq("course_run_id", courseRunId)
      .eq("profile_id", "c0000000-0000-0000-0000-000000000007")
      .single();
    assertNoSupabaseError(enrollment.error);

    if (!enrollment.data) {
      throw new Error("Selma enrollment was not found");
    }

    const selmaEnrollmentId = enrollment.data.id;
    const idempotencyKey = randomUUID();
    const submit = (client: SupabaseClient) =>
      client.rpc("submit_quiz_attempt", {
        target_enrollment_id: selmaEnrollmentId,
        target_activity_id: knowledgeTestId,
        target_idempotency_key: idempotencyKey,
        target_answers: correctAnswers,
      });

    const [first, second] = await Promise.all([
      submit(selmaClientA),
      submit(selmaClientB),
    ]);
    assertNoSupabaseError(first.error);
    assertNoSupabaseError(second.error);
    const firstResult = first.data as QuizResult;
    const secondResult = second.data as QuizResult;

    expect(firstResult).toMatchObject({
      earned: 5,
      passed: true,
      percent: 100,
      possible: 5,
    });
    expect(secondResult.attemptId).toBe(firstResult.attemptId);
    passedAttemptId = firstResult.attemptId;

    const attemptCount = await adminClient
      .from("quiz_attempts")
      .select("id", { count: "exact", head: true })
      .eq("idempotency_key", idempotencyKey);
    assertNoSupabaseError(attemptCount.error);
    expect(attemptCount.count).toBe(1);

    const completionCount = await adminClient
      .from("activity_completions")
      .select("id", { count: "exact", head: true })
      .eq("enrollment_id", selmaEnrollmentId)
      .eq("activity_id", knowledgeTestId);
    assertNoSupabaseError(completionCount.error);
    expect(completionCount.count).toBe(1);
  });

  it("keeps a passed result unchanged when a new question version is drafted", async () => {
    const before = await adminClient
      .from("quiz_attempts")
      .select("percent, question_version_ids")
      .eq("id", passedAttemptId)
      .single();
    assertNoSupabaseError(before.error);

    assertNoSupabaseError(
      (
        await adminClient.from("question_versions").insert({
          id: randomUUID(),
          question_key: "ballstart",
          version_number: 2,
          prompt: "Utkast til revidert spørsmål",
          options: [
            { id: "a", label: "Alternativ A" },
            { id: "b", label: "Alternativ B" },
          ],
          correct_option_id: "a",
          points: 1,
          created_by: "c0000000-0000-0000-0000-000000000001",
        })
      ).error,
    );

    const after = await adminClient
      .from("quiz_attempts")
      .select("percent, question_version_ids")
      .eq("id", passedAttemptId)
      .single();
    assertNoSupabaseError(after.error);
    expect(after.data).toEqual(before.data);
  });

  it("blocks a new attempt until a configured retry delay has passed", async () => {
    const first = await henrikClient.rpc("submit_quiz_attempt", {
      target_enrollment_id: henrikEnrollmentId,
      target_activity_id: knowledgeTestId,
      target_idempotency_key: randomUUID(),
      target_answers: wrongAnswers,
    });
    assertNoSupabaseError(first.error);
    expect(first.data).toMatchObject({ passed: false, percent: 0 });
    expect((first.data as QuizResult).nextAttemptAt).not.toBeNull();

    const retry = await henrikClient.rpc("submit_quiz_attempt", {
      target_enrollment_id: henrikEnrollmentId,
      target_activity_id: knowledgeTestId,
      target_idempotency_key: randomUUID(),
      target_answers: wrongAnswers,
    });
    expect(retry.data).toBeNull();
    expect(retry.error?.message).toBe("retry_delayed");
  });
});
