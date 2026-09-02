"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createSupabaseServerClient } from "@/lib/supabase/server";

function textValue(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value.trim() : "";
}

async function runEnrollmentLifecycleAction(
  formData: FormData,
  rpcName: "withdraw_enrollment" | "reopen_enrollment",
  reason: string,
  successNotice: string,
): Promise<never> {
  const courseRunId = textValue(formData, "courseRunId");
  const enrollmentId = textValue(formData, "enrollmentId");
  const detailPath = `/admin/courses/${courseRunId}`;
  const client = await createSupabaseServerClient();
  const result = await client.rpc(rpcName, {
    target_enrollment_id: enrollmentId,
    target_reason: reason,
  });

  if (result.error) {
    redirect(
      `${detailPath}?notice=${
        result.error.message === "ENROLLMENT_REASON_REQUIRED"
          ? "lifecycle-reason-required"
          : "lifecycle-error"
      }`,
    );
  }

  revalidatePath(detailPath);
  revalidatePath("/teacher/participants");
  revalidatePath("/student");
  redirect(`${detailPath}?notice=${successNotice}`);
}

export async function withdrawEnrollmentAction(
  formData: FormData,
): Promise<never> {
  return runEnrollmentLifecycleAction(
    formData,
    "withdraw_enrollment",
    textValue(formData, "reason"),
    "lifecycle-withdrawn",
  );
}

export async function reopenEnrollmentAction(
  formData: FormData,
): Promise<never> {
  return runEnrollmentLifecycleAction(
    formData,
    "reopen_enrollment",
    "Gjenåpnet fra administrasjonsbildet",
    "lifecycle-reopened",
  );
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
