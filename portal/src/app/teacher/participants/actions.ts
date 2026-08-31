"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createSupabaseServerClient } from "@/lib/supabase/server";

function textValue(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value.trim() : "";
}

export async function recordAttendanceAction(
  formData: FormData,
): Promise<never> {
  const enrollmentId = textValue(formData, "enrollmentId");
  const sessionId = textValue(formData, "sessionId");
  const plannedMinutes = Number(textValue(formData, "plannedMinutes"));
  const presentMinutes = Number(textValue(formData, "presentMinutes"));
  const detailPath = `/teacher/participants/${enrollmentId}`;

  if (
    !enrollmentId ||
    !sessionId ||
    !Number.isInteger(plannedMinutes) ||
    plannedMinutes <= 0 ||
    !Number.isInteger(presentMinutes) ||
    presentMinutes < 0 ||
    presentMinutes > plannedMinutes
  ) {
    redirect(`${detailPath}?notice=invalid-attendance`);
  }

  const client = await createSupabaseServerClient();
  const result = await client.rpc("record_attendance", {
    target_enrollment_id: enrollmentId,
    target_session_id: sessionId,
    target_planned_minutes: plannedMinutes,
    target_present_minutes: presentMinutes,
    target_reason: textValue(formData, "reason") || "Registrert av kurslærer",
  });

  if (result.error) redirect(`${detailPath}?notice=attendance-error`);

  revalidatePath(detailPath);
  revalidatePath("/teacher/participants");
  revalidatePath("/student");
  redirect(`${detailPath}?notice=attendance-saved`);
}
