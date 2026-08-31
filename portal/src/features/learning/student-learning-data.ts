import type { SupabaseClient } from "@supabase/supabase-js";

import {
  getActivityAccess,
  type ActivityAccess,
  type ActivityPrerequisite,
} from "./access";
import { getNextActivity } from "./next-activity";
import { calculateProgress } from "./progress";

type EnrollmentRow = Readonly<{
  id: string;
  course_run_id: string;
  status: "active" | "completed";
}>;

type CourseRunRow = Readonly<{
  id: string;
  title: string;
  start_year: number;
}>;

type LearningPathRow = Readonly<{
  id: string;
  course_run_id: string;
  title: string;
}>;

type ModuleRow = Readonly<{
  id: string;
  learning_path_id: string;
  title: string;
  description: string | null;
  sort_order: number;
}>;

type ActivityRow = Readonly<{
  id: string;
  module_id: string;
  title: string;
  description: string | null;
  activity_type:
    | "lesson"
    | "quiz"
    | "knowledge_test"
    | "assignment"
    | "practice"
    | "attendance";
  completion_mode:
    | "manual"
    | "reach_end"
    | "quiz_pass"
    | "submission_approved"
    | "practice_approved"
    | "attendance_met";
  content_item_id: string | null;
  required: boolean;
  weight: number;
  sort_order: number;
}>;

type PrerequisiteRow = Readonly<{
  activity_id: string;
  prerequisite_activity_id: string;
}>;

type CompletionRow = Readonly<{
  activity_id: string;
}>;

type ProgressRow = Readonly<{
  percentage: number;
  completed_required_count: number;
  total_required_count: number;
}>;

type ContentBindingRow = Readonly<{
  content_item_id: string;
  content_revision_id: string;
}>;

export type StudentLearningActivity = Readonly<{
  id: string;
  moduleId: string;
  moduleTitle: string;
  title: string;
  description: string | null;
  activityType: ActivityRow["activity_type"];
  completionMode: ActivityRow["completion_mode"];
  contentItemId: string | null;
  contentRevisionId: string | null;
  required: boolean;
  completed: boolean;
  access: ActivityAccess;
  sortOrder: number;
}>;

export type StudentLearningModule = Readonly<{
  id: string;
  title: string;
  description: string | null;
  sortOrder: number;
  completedCount: number;
  totalCount: number;
  activities: readonly StudentLearningActivity[];
}>;

export type StudentLearningPathView = Readonly<{
  id: string;
  courseRunId: string;
  courseTitle: string;
  startYear: number;
  title: string;
  enrollmentId: string;
  percentage: number;
  completedRequiredCount: number;
  totalRequiredCount: number;
  modules: readonly StudentLearningModule[];
  activities: readonly StudentLearningActivity[];
  nextActivity: StudentLearningActivity | null;
}>;

function assertNoQueryError(
  error: { code?: string; message: string } | null,
): void {
  if (error) {
    throw new Error(
      `STUDENT_LEARNING_QUERY_FAILED:${error.code ?? "UNKNOWN"}:${error.message}`,
    );
  }
}

async function loadEnrollment(
  client: SupabaseClient,
  courseRunId?: string,
): Promise<EnrollmentRow | null> {
  let query = client
    .from("enrollments")
    .select("id,course_run_id,status")
    .in("status", ["active", "completed"])
    .limit(1);

  if (courseRunId) {
    query = query.eq("course_run_id", courseRunId);
  }

  const { data, error } = await query.maybeSingle();
  assertNoQueryError(error);

  return data as EnrollmentRow | null;
}

export async function loadStudentLearningPath(
  client: SupabaseClient,
  courseRunId?: string,
): Promise<StudentLearningPathView | null> {
  const enrollment = await loadEnrollment(client, courseRunId);
  if (!enrollment) return null;

  const [courseResult, pathResult] = await Promise.all([
    client
      .from("course_runs")
      .select("id,title,start_year")
      .eq("id", enrollment.course_run_id)
      .maybeSingle(),
    client
      .from("learning_paths")
      .select("id,course_run_id,title")
      .eq("course_run_id", enrollment.course_run_id)
      .eq("status", "published")
      .maybeSingle(),
  ]);

  assertNoQueryError(courseResult.error);
  assertNoQueryError(pathResult.error);
  if (!courseResult.data || !pathResult.data) return null;

  const course = courseResult.data as CourseRunRow;
  const path = pathResult.data as LearningPathRow;

  const [
    modulesResult,
    activitiesResult,
    prerequisitesResult,
    completionsResult,
    progressResult,
    bindingsResult,
  ] = await Promise.all([
    client
      .from("modules")
      .select("id,learning_path_id,title,description,sort_order")
      .eq("learning_path_id", path.id)
      .order("sort_order"),
    client
      .from("activities")
      .select(
        "id,module_id,title,description,activity_type,completion_mode,content_item_id,required,weight,sort_order",
      )
      .eq("learning_path_id", path.id),
    client
      .from("activity_prerequisites")
      .select("activity_id,prerequisite_activity_id")
      .eq("learning_path_id", path.id),
    client
      .from("activity_completions")
      .select("activity_id")
      .eq("enrollment_id", enrollment.id)
      .eq("learning_path_id", path.id),
    client
      .from("enrollment_progress")
      .select("percentage,completed_required_count,total_required_count")
      .eq("enrollment_id", enrollment.id)
      .eq("learning_path_id", path.id)
      .maybeSingle(),
    client
      .from("course_content_bindings")
      .select("content_item_id,content_revision_id")
      .eq("course_run_id", enrollment.course_run_id),
  ]);

  for (const result of [
    modulesResult,
    activitiesResult,
    prerequisitesResult,
    completionsResult,
    progressResult,
    bindingsResult,
  ]) {
    assertNoQueryError(result.error);
  }

  const modules = (modulesResult.data ?? []) as ModuleRow[];
  const activities = (activitiesResult.data ?? []) as ActivityRow[];
  const prerequisiteRows = (prerequisitesResult.data ??
    []) as PrerequisiteRow[];
  const completedIds = new Set(
    ((completionsResult.data ?? []) as CompletionRow[]).map(
      (completion) => completion.activity_id,
    ),
  );
  const revisionByContentItem = new Map(
    ((bindingsResult.data ?? []) as ContentBindingRow[]).map((binding) => [
      binding.content_item_id,
      binding.content_revision_id,
    ]),
  );
  const titleByActivityId = new Map(
    activities.map((activity) => [activity.id, activity.title]),
  );
  const prerequisites: ActivityPrerequisite[] = prerequisiteRows.map(
    (prerequisite) => ({
      activityId: prerequisite.activity_id,
      prerequisiteActivityId: prerequisite.prerequisite_activity_id,
      title:
        titleByActivityId.get(prerequisite.prerequisite_activity_id) ??
        "tidligere aktivitet",
    }),
  );

  const moduleViews: StudentLearningModule[] = modules.map((module) => {
    const moduleActivities = activities
      .filter((activity) => activity.module_id === module.id)
      .sort((left, right) => left.sort_order - right.sort_order)
      .map<StudentLearningActivity>((activity) => ({
        id: activity.id,
        moduleId: module.id,
        moduleTitle: module.title,
        title: activity.title,
        description: activity.description,
        activityType: activity.activity_type,
        completionMode: activity.completion_mode,
        contentItemId: activity.content_item_id,
        contentRevisionId: activity.content_item_id
          ? (revisionByContentItem.get(activity.content_item_id) ?? null)
          : null,
        required: activity.required,
        completed: completedIds.has(activity.id),
        access: getActivityAccess(activity.id, completedIds, prerequisites),
        sortOrder: activity.sort_order,
      }));
    const requiredActivities = moduleActivities.filter(
      (activity) => activity.required,
    );

    return {
      id: module.id,
      title: module.title,
      description: module.description,
      sortOrder: module.sort_order,
      completedCount: requiredActivities.filter(
        (activity) => activity.completed,
      ).length,
      totalCount: requiredActivities.length,
      activities: moduleActivities,
    };
  });
  const activityViews = moduleViews.flatMap((module) => module.activities);
  const nextActivity = getNextActivity(
    activityViews.filter((activity) => activity.required),
    completedIds,
    prerequisites,
  );
  const storedProgress = progressResult.data as ProgressRow | null;
  const calculatedProgress = calculateProgress(activities, completedIds);

  return {
    id: path.id,
    courseRunId: course.id,
    courseTitle: course.title,
    startYear: course.start_year,
    title: path.title,
    enrollmentId: enrollment.id,
    percentage: storedProgress?.percentage ?? calculatedProgress.percentage,
    completedRequiredCount:
      storedProgress?.completed_required_count ??
      activities.filter(
        (activity) => activity.required && completedIds.has(activity.id),
      ).length,
    totalRequiredCount:
      storedProgress?.total_required_count ??
      activities.filter((activity) => activity.required).length,
    modules: moduleViews,
    activities: activityViews,
    nextActivity,
  };
}

export async function loadStudentActivity(
  client: SupabaseClient,
  courseRunId: string,
  activityId: string,
): Promise<Readonly<{
  learningPath: StudentLearningPathView;
  activity: StudentLearningActivity;
}> | null> {
  const learningPath = await loadStudentLearningPath(client, courseRunId);
  const activity = learningPath?.activities.find(
    (candidate) => candidate.id === activityId,
  );

  return learningPath && activity ? { learningPath, activity } : null;
}
