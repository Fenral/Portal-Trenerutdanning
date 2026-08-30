import {
  CourseRunCreationInput,
  type CreateCourseRunInput,
  type ValidatedCourseRunCreation,
} from "./schema";

export type CourseRunRepository = Readonly<{
  create(
    course: ValidatedCourseRunCreation,
  ): Promise<Readonly<{ courseRunId: string }>>;
}>;

type CreateCourseRunDependencies = Readonly<{
  repository: CourseRunRepository;
}>;

export async function createCourseRun(
  input: CreateCourseRunInput,
  dependencies: CreateCourseRunDependencies,
): Promise<Readonly<{ courseRunId: string; displayYear: string }>> {
  const validated = CourseRunCreationInput.parse({
    course: input,
    sessionPlan: input.sessionPlan,
  });
  const result = await dependencies.repository.create(validated);

  return {
    courseRunId: result.courseRunId,
    displayYear: validated.displayYear,
  };
}
