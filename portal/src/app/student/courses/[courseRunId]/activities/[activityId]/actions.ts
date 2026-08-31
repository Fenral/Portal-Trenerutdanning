"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import {
  completeActivity,
  SupabaseActivityCompletionRepository,
} from "@/features/learning/complete-activity";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function completeActivityAction(
  formData: FormData,
): Promise<never> {
  const courseRunId = String(formData.get("courseRunId") ?? "");
  const activityId = String(formData.get("activityId") ?? "");
  const enrollmentId = String(formData.get("enrollmentId") ?? "");
  const revisionValue = String(formData.get("contentRevisionId") ?? "");
  const activityPath = `/student/courses/${courseRunId}/activities/${activityId}`;
  const client = await createSupabaseServerClient();

  try {
    await completeActivity(
      {
        activityId,
        contentRevisionId: revisionValue || null,
        enrollmentId,
      },
      { repository: new SupabaseActivityCompletionRepository(client) },
    );
  } catch {
    redirect(`${activityPath}?completion=error`);
  }

  revalidatePath(activityPath);
  revalidatePath(`/student/courses/${courseRunId}`);
  revalidatePath("/student");
  redirect(`${activityPath}?completion=success`);
}
