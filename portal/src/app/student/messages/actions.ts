"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createSupabaseServerClient } from "@/lib/supabase/server";

function textValue(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value.trim() : "";
}

export async function sendStudentMessageAction(
  formData: FormData,
): Promise<never> {
  const enrollmentId = textValue(formData, "enrollmentId");
  const teacherProfileId = textValue(formData, "teacherProfileId");
  const body = textValue(formData, "body");
  if (!enrollmentId || !teacherProfileId) redirect("/student/messages");
  const threadPath = `/student/messages/${enrollmentId}/${teacherProfileId}`;

  if (body.length < 1 || body.length > 4000) {
    redirect(`${threadPath}?notice=message-invalid`);
  }

  const client = await createSupabaseServerClient();
  const result = await client.rpc("send_message", {
    target_enrollment_id: enrollmentId,
    target_recipient_profile_id: teacherProfileId,
    target_body: body,
  });

  if (result.error) redirect(`${threadPath}?notice=message-error`);

  revalidatePath("/student/messages");
  revalidatePath(threadPath);
  redirect(`${threadPath}?notice=message-sent`);
}
