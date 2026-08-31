import { describe, expect, it } from "vitest";

import {
  gradeAttempt,
  nextAttemptAt,
  parseStudentQuiz,
  quizAnswersFromFormData,
} from "@/features/assessment/quiz";

describe("quiz", () => {
  it("grades against immutable question versions", () => {
    expect(
      gradeAttempt(
        [{ questionId: "q1", correctOptionId: "b", points: 1 }],
        [{ questionId: "q1", optionId: "b" }],
        100,
      ),
    ).toEqual({ earned: 1, possible: 1, percent: 100, passed: true });
  });

  it("applies delay only after a failed attempt when configured", () => {
    const now = new Date("2026-10-01T10:00:00Z");

    expect(
      nextAttemptAt({ passed: false, delayHours: 24 }, now)?.toISOString(),
    ).toBe("2026-10-02T10:00:00.000Z");
    expect(nextAttemptAt({ passed: false, delayHours: 0 }, now)).toBeNull();
    expect(nextAttemptAt({ passed: true, delayHours: 24 }, now)).toBeNull();
  });

  it("parses only the public quiz contract", () => {
    expect(
      parseStudentQuiz({
        activityId: "a3200000-0000-0000-0000-000000000006",
        courseRunId: "b1030000-0000-0000-0000-000000000001",
        enrollmentId: "01000000-0000-0000-0000-000000000001",
        quizDefinitionId: "a4000000-0000-0000-0000-000000000001",
        title: "Kunnskapsprøve",
        passPercent: 80,
        maxAttempts: null,
        retryDelayHours: 24,
        attemptsUsed: 0,
        nextAttemptAt: null,
        questions: [
          {
            id: "a4100000-0000-0000-0000-000000000001",
            prompt: "Hva er riktig?",
            points: 1,
            options: [
              { id: "a", label: "A" },
              { id: "b", label: "B" },
            ],
          },
        ],
      }).questions[0],
    ).toEqual({
      id: "a4100000-0000-0000-0000-000000000001",
      prompt: "Hva er riktig?",
      points: 1,
      options: [
        { id: "a", label: "A" },
        { id: "b", label: "B" },
      ],
    });
  });

  it("extracts one selected option per question from a form", () => {
    const formData = new FormData();
    formData.set("answer:a4100000-0000-0000-0000-000000000001", "b");

    expect(quizAnswersFromFormData(formData)).toEqual([
      {
        questionId: "a4100000-0000-0000-0000-000000000001",
        optionId: "b",
      },
    ]);
  });
});
