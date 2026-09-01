import type { SupabaseClient } from "@supabase/supabase-js";

import { loadEffectiveDeadlines } from "@/features/assessment/assignments/effective-deadlines";

import { classifyPace, type Pace } from "./classify-pace";
import {
  recommendedProgress,
  type PaceMilestone,
} from "./recommended-progress";

type PaceParticipant = Readonly<{
  enrollmentId: string;
  courseRunId: string;
  progressPercentage: number;
  modules: readonly Readonly<{
    activities: readonly Readonly<{
      id: string;
      completed: boolean;
      required: boolean;
    }>[];
  }>[];
}>;

function assertNoQueryError(error: { message: string } | null): void {
  if (error) throw new Error(`PACE_PLAN_QUERY_FAILED:${error.message}`);
}

/**
 * Classifies each enrollment against the newest pace plan version of its
 * course run. Enrollments in courses without a pace plan are omitted, so the
 * caller can fall back to the plain progress signal.
 */
export async function loadPaceByEnrollment(
  client: SupabaseClient,
  participants: readonly PaceParticipant[],
  now: Date = new Date(),
): Promise<Readonly<Record<string, Pace>>> {
  if (participants.length === 0) return {};

  const plansResult = await client
    .from("pace_plans")
    .select("id,course_run_id,green_lag,red_lag,version")
    .in("course_run_id", [
      ...new Set(participants.map((participant) => participant.courseRunId)),
    ])
    .order("version", { ascending: false });
  assertNoQueryError(plansResult.error);

  const planByCourseRun = new Map<
    string,
    Readonly<{ id: string; green_lag: number; red_lag: number }>
  >();
  for (const plan of plansResult.data ?? []) {
    if (!planByCourseRun.has(plan.course_run_id)) {
      planByCourseRun.set(plan.course_run_id, plan);
    }
  }
  if (planByCourseRun.size === 0) return {};

  const [milestonesResult, deadlines] = await Promise.all([
    client
      .from("pace_milestones")
      .select("plan_id,at,percent")
      .in(
        "plan_id",
        [...planByCourseRun.values()].map((plan) => plan.id),
      ),
    loadEffectiveDeadlines(
      client,
      participants.map((participant) => participant.enrollmentId),
    ),
  ]);
  assertNoQueryError(milestonesResult.error);

  const milestonesByPlan = new Map<string, PaceMilestone[]>();
  for (const row of milestonesResult.data ?? []) {
    const current = milestonesByPlan.get(row.plan_id) ?? [];
    current.push({ at: new Date(row.at), percent: row.percent });
    milestonesByPlan.set(row.plan_id, current);
  }

  const pace: Record<string, Pace> = {};
  for (const participant of participants) {
    const plan = planByCourseRun.get(participant.courseRunId);
    if (!plan) continue;

    const hardDeadlineOverdue = participant.modules.some((learningModule) =>
      learningModule.activities.some((activity) => {
        if (!activity.required || activity.completed) return false;
        const deadline = deadlines.effectiveDeadline(
          participant.enrollmentId,
          activity.id,
        );
        return (
          deadline !== null && new Date(deadline).getTime() < now.getTime()
        );
      }),
    );

    pace[participant.enrollmentId] = classifyPace({
      actual: participant.progressPercentage,
      recommended: recommendedProgress(
        milestonesByPlan.get(plan.id) ?? [],
        now,
      ),
      hardDeadlineOverdue,
      greenLag: plan.green_lag,
      redLag: plan.red_lag,
    });
  }
  return pace;
}
