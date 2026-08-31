export type GradedQuestion = Readonly<{
  questionId: string;
  correctOptionId: string;
  points: number;
}>;

export type SubmittedAnswer = Readonly<{
  questionId: string;
  optionId: string;
}>;

export type GradeResult = Readonly<{
  earned: number;
  possible: number;
  percent: number;
  passed: boolean;
}>;

export function gradeAttempt(
  questions: readonly GradedQuestion[],
  answers: readonly SubmittedAnswer[],
  passPercent: number,
): GradeResult {
  const answerByQuestion = new Map(
    answers.map((answer) => [answer.questionId, answer.optionId]),
  );
  const possible = questions.reduce(
    (total, question) => total + question.points,
    0,
  );
  const earned = questions.reduce(
    (total, question) =>
      total +
      (answerByQuestion.get(question.questionId) === question.correctOptionId
        ? question.points
        : 0),
    0,
  );
  const percent = possible === 0 ? 0 : Math.round((earned * 100) / possible);

  return { earned, possible, percent, passed: percent >= passPercent };
}
