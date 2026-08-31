"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createSupabaseServerClient } from "@/lib/supabase/server";

function textValue(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value.trim() : "";
}

export async function setUniversityCompletionAction(
  formData: FormData,
): Promise<never> {
  const courseRunId = textValue(formData, "courseRunId");
  const enrollmentId = textValue(formData, "enrollmentId");
  const completed = formData.get("completed") === "on";
  const detailPath = `/admin/courses/${courseRunId}`;
  const client = await createSupabaseServerClient();
  const result = await client.rpc("set_university_completion", {
    target_enrollment_id: enrollmentId,
    target_completed: completed,
    target_note: completed
      ? "Universitetskravet er kontrollert manuelt"
      : "Universitetsgodkjenningen er trukket tilbake manuelt",
  });

  if (result.error) redirect(`${detailPath}?notice=university-error`);

  revalidatePath(detailPath);
  revalidatePath("/teacher/participants");
  revalidatePath("/student");
  revalidatePath("/student/certificates");
  redirect(`${detailPath}?notice=university-saved`);
}
