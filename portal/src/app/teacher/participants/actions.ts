"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createSupabaseServerClient } from "@/lib/supabase/server";

function textValue(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value.trim() : "";
}

export async function sendReminderAction(formData: FormData): Promise<never> {
  const enrollmentId = textValue(formData, "enrollmentId");
  if (!enrollmentId) redirect("/teacher/participants");
  const detailPath = `/teacher/participants/${enrollmentId}`;

  const client = await createSupabaseServerClient();
  const result = await client.rpc("enqueue_due_reminder", {
    target_enrollment_id: enrollmentId,
  });

  if (result.error) redirect(`${detailPath}?notice=reminder-error`);

  revalidatePath(detailPath);
  redirect(`${detailPath}?notice=reminder-sent`);
}

export async function recordAttendanceAction(
  formData: FormData,
): Promise<never> {
  const enrollmentId = textValue(formData, "enrollmentId");
  const sessionId = textValue(formData, "sessionId");
  const plannedMinutes = Number(textValue(formData, "plannedMinutes"));
  const absenceHours = Number(textValue(formData, "absenceHours"));
  const absenceMinutes = absenceHours * 60;
  const presentMinutes = plannedMinutes - absenceMinutes;
  const detailPath = `/teacher/participants/${enrollmentId}`;

  if (
    !enrollmentId ||
    !sessionId ||
    !Number.isInteger(plannedMinutes) ||
    plannedMinutes <= 0 ||
    !Number.isInteger(absenceHours) ||
    absenceHours < 0 ||
    absenceMinutes > plannedMinutes
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
