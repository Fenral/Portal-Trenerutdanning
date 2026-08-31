"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { addPracticeEntry, submitPractice } from "@/features/practice/data";
import { createSupabaseServerClient } from "@/lib/supabase/server";

function textValue(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value.trim() : "";
}

function integerValue(formData: FormData, name: string): number | null {
  const value = Number(textValue(formData, name));
  return Number.isInteger(value) ? value : null;
}

export async function addPracticeEntryAction(
  formData: FormData,
): Promise<never> {
  const hours = integerValue(formData, "hours");
  const minutePart = integerValue(formData, "minutePart");
  const path = "/student/practice";

  if (
    hours === null ||
    minutePart === null ||
    hours < 0 ||
    minutePart < 0 ||
    minutePart > 59 ||
    hours * 60 + minutePart <= 0
  ) {
    redirect(`${path}?notice=duration`);
  }

  const client = await createSupabaseServerClient();

  try {
    await addPracticeEntry(client, {
      enrollmentId: textValue(formData, "enrollmentId"),
      activityId: textValue(formData, "activityId"),
      occurredOn: textValue(formData, "occurredOn"),
      minutes: hours * 60 + minutePart,
      category: textValue(formData, "category") as "delivery" | "planning",
      description: textValue(formData, "description"),
      idempotencyKey: textValue(formData, "idempotencyKey"),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    const notice = message.includes("PRACTICE_PLANNING_LIMIT_EXCEEDED")
      ? "planning-limit"
      : message.includes("PRACTICE_ENTRY_DATE_INVALID")
        ? "date"
        : "entry-error";
    redirect(`${path}?notice=${notice}`);
  }

  revalidatePath(path);
  revalidatePath("/student");
  redirect(`${path}?notice=entry-added`);
}

export async function submitPracticeAction(formData: FormData): Promise<never> {
  const path = "/student/practice";
  const client = await createSupabaseServerClient();

  try {
    await submitPractice(client, {
      enrollmentId: textValue(formData, "enrollmentId"),
      activityId: textValue(formData, "activityId"),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    const notice = message.includes("PRACTICE_MINUTES_MISSING")
      ? "incomplete"
      : "submit-error";
    redirect(`${path}?notice=${notice}`);
  }

  revalidatePath(path);
  revalidatePath("/teacher");
  redirect(`${path}?notice=submitted`);
}
