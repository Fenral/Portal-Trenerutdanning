"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import {
  quizAnswersFromFormData,
  submitStudentQuiz,
} from "@/features/assessment/quiz";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const databaseIdPattern = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;

function textValue(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value.trim() : "";
}

export async function submitQuizAction(formData: FormData): Promise<never> {
  const activityId = textValue(formData, "activityId");
  const enrollmentId = textValue(formData, "enrollmentId");
  const idempotencyKey = textValue(formData, "idempotencyKey");

  if (!databaseIdPattern.test(activityId)) {
    redirect("/student");
  }

  const quizPath = `/student/quiz/${activityId}`;
  const client = await createSupabaseServerClient();

  try {
    await submitStudentQuiz(client, {
      activityId,
      enrollmentId,
      idempotencyKey,
      answers: quizAnswersFromFormData(formData),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    const notice = message.includes("retry_delayed")
      ? "retry-delayed"
      : message.includes("QUIZ_ANSWERS")
        ? "incomplete"
        : "error";
    redirect(`${quizPath}?notice=${notice}`);
  }

  revalidatePath(quizPath);
  revalidatePath("/student");
  redirect(quizPath);
}
