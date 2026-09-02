"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createSupabaseServerClient } from "@/lib/supabase/server";

const pagePath = "/admin/people/duplicates";

function textValue(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value.trim() : "";
}

function finish(notice: string): never {
  revalidatePath(pagePath);
  redirect(`${pagePath}?notice=${notice}`);
}

const mergeErrorNotices: Readonly<Record<string, string>> = {
  MERGE_REASON_REQUIRED: "merge-reason-required",
  MERGE_ALREADY_MERGED: "merge-already-merged",
  MERGE_TARGET_MERGED: "merge-already-merged",
  MERGE_COURSE_CONFLICT: "merge-course-conflict",
  MERGE_PRIVILEGED_PROFILE: "merge-privileged",
  MERGE_ANONYMIZED_PROFILE: "merge-anonymized",
};

export async function mergePeopleAction(formData: FormData): Promise<never> {
  const aId = textValue(formData, "aId");
  const bId = textValue(formData, "bId");
  const targetId = textValue(formData, "targetId");
  const sourceId = targetId === aId ? bId : aId;

  if (!targetId || !sourceId || targetId === sourceId) {
    finish("merge-target-required");
  }

  const client = await createSupabaseServerClient();
  const result = await client.rpc("merge_people", {
    source_id: sourceId,
    target_id: targetId,
    target_reason: textValue(formData, "reason"),
  });

  if (result.error) {
    finish(mergeErrorNotices[result.error.message] ?? "merge-error");
  }
  finish("merge-ok");
}

export async function reverseMergeAction(formData: FormData): Promise<never> {
  const client = await createSupabaseServerClient();
  const result = await client.rpc("reverse_merge", {
    merge_id: textValue(formData, "mergeId"),
  });

  if (result.error) finish("merge-error");

  const status = (result.data as { status?: string } | null)?.status;
  finish(
    status === "manual_reversal_required"
      ? "merge-manual-reversal"
      : "merge-reversed",
  );
}

const anonymizeErrorNotices: Readonly<Record<string, string>> = {
  ANONYMIZE_CASE_REFERENCE_REQUIRED: "anonymize-case-required",
  ANONYMIZE_APPROVER_MUST_DIFFER: "anonymize-approver-invalid",
  ANONYMIZE_APPROVER_NOT_ADMINISTRATOR: "anonymize-approver-invalid",
};

export async function anonymizePersonAction(
  formData: FormData,
): Promise<never> {
  // WCAG 3.3.4: irreversible handling krever eksplisitt bekreftelse,
  // validert server-side (ikke bare `required` i klienten).
  if (textValue(formData, "confirm") !== "yes") {
    finish("anonymize-confirm-required");
  }

  if (!textValue(formData, "approverProfileId")) {
    finish("anonymize-approver-invalid");
  }

  const client = await createSupabaseServerClient();
  const result = await client.rpc("anonymize_person", {
    target_profile_id: textValue(formData, "profileId"),
    case_reference: textValue(formData, "caseReference"),
    approver_profile_id: textValue(formData, "approverProfileId"),
  });

  if (result.error) {
    finish(anonymizeErrorNotices[result.error.message] ?? "anonymize-error");
  }
  finish("anonymize-ok");
}
