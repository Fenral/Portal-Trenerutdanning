"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { reviewAssignment } from "@/features/assessment/assignments/review";
import { createSupabaseServerClient } from "@/lib/supabase/server";

function textValue(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value.trim() : "";
}

const osloOffsetFormatter = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Europe/Oslo",
  timeZoneName: "longOffset",
});

function osloTimestamp(localDateTime: string): string | null {
  const match = localDateTime.match(/^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})$/);
  if (!match) return null;
  const offsetName = osloOffsetFormatter
    .formatToParts(new Date(`${match[1]}T${match[2]}:00Z`))
    .find((part) => part.type === "timeZoneName")?.value;
  const offset = offsetName?.match(/^GMT([+-]\d{2}:\d{2})$/)?.[1];
  return offset ? `${match[1]}T${match[2]}:00${offset}` : null;
}

export async function reviewAssignmentAction(
  formData: FormData,
): Promise<never> {
  const submissionId = textValue(formData, "submissionId");
  const intent = textValue(formData, "intent");
  const detailPath = `/teacher/assignments/${submissionId}`;
  const client = await createSupabaseServerClient();
  const deadlineInput = textValue(formData, "newDeadline");

  try {
    await reviewAssignment(client, {
      submissionId,
      action: intent === "approve" ? "approve" : "request_revision",
      resultValue: intent === "approve" ? "approved" : null,
      comment: textValue(formData, "comment"),
      newDeadline: deadlineInput ? osloTimestamp(deadlineInput) : null,
      deadlineReason: textValue(formData, "deadlineReason") || null,
    });
  } catch {
    redirect(`${detailPath}?notice=error`);
  }

  revalidatePath(detailPath);
  revalidatePath("/teacher");
  revalidatePath("/student");
  redirect(`${detailPath}?notice=updated`);
}
