"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { submitAssignmentVersion } from "@/features/assessment/assignments/submit";
import { storeCleanAssignmentUpload } from "@/features/assessment/assignments/upload";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const databaseIdPattern = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;

function textValue(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value.trim() : "";
}

export async function submitAssignmentAction(
  formData: FormData,
): Promise<never> {
  const activityId = textValue(formData, "activityId");
  const enrollmentId = textValue(formData, "enrollmentId");

  if (!databaseIdPattern.test(activityId)) redirect("/student");

  const assignmentPath = `/student/assignments/${activityId}`;
  const file = formData.get("document");

  if (!(file instanceof File) || file.size === 0) {
    redirect(`${assignmentPath}?notice=file-required`);
  }

  const client = await createSupabaseServerClient();
  const {
    data: { user },
  } = await client.auth.getUser();

  if (!user) redirect("/student");

  const profileResult = await client
    .from("profiles")
    .select("id")
    .limit(1)
    .maybeSingle();

  if (profileResult.error || !profileResult.data) {
    redirect(`${assignmentPath}?notice=error`);
  }

  try {
    const adminClient = createSupabaseAdminClient();
    const stored = await storeCleanAssignmentUpload(file, {
      adminClient,
      actorProfileId: profileResult.data.id,
      scannerUrl: process.env.CLAMAV_SCANNER_URL,
    });
    await submitAssignmentVersion(client, {
      activityId,
      enrollmentId,
      mediaAssetId: stored.mediaAssetId,
      note: textValue(formData, "note"),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    const notice = message.includes("file_type_mismatch")
      ? "file-type"
      : message.includes("assignment_deadline_passed")
        ? "deadline"
        : "error";
    redirect(`${assignmentPath}?notice=${notice}`);
  }

  revalidatePath(assignmentPath);
  revalidatePath("/student");
  redirect(`${assignmentPath}?notice=submitted`);
}
