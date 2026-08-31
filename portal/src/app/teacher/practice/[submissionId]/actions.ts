"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { reviewPractice } from "@/features/practice/data";
import { createSupabaseServerClient } from "@/lib/supabase/server";

function textValue(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value.trim() : "";
}

export async function reviewPracticeAction(formData: FormData): Promise<never> {
  const submissionId = textValue(formData, "submissionId");
  const intent = textValue(formData, "intent") as
    "approve" | "request_revision" | "spot_check_revoke";
  const detailPath = `/teacher/practice/${submissionId}`;
  const client = await createSupabaseServerClient();

  try {
    await reviewPractice(client, {
      submissionId,
      action: intent,
      comment: textValue(formData, "comment"),
    });
  } catch {
    redirect(`${detailPath}?notice=error`);
  }

  revalidatePath(detailPath);
  revalidatePath("/teacher");
  revalidatePath("/student/practice");
  revalidatePath("/student");
  redirect(`${detailPath}?notice=updated`);
}
