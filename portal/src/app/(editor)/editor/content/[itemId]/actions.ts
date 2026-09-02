"use server";

import { revalidatePath } from "next/cache";
import { notFound, redirect } from "next/navigation";
import { z } from "zod";

import { getContentManagerIdentity } from "@/features/access/require-content-manager";
import { planPublication } from "@/features/content/publish-content";
import { updateDraftDocument } from "@/features/content/update-draft";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const IdSchema = z
  .string()
  .regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
const CourseIdsSchema = z.array(IdSchema).max(100);

function textValue(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value.trim() : "";
}

async function requireContentManager() {
  const serverClient = await createSupabaseServerClient();
  const {
    data: { user },
  } = await serverClient.auth.getUser();
  const adminClient = createSupabaseAdminClient();
  const identity = user
    ? await getContentManagerIdentity(user.id, adminClient)
    : null;

  if (!user || !identity) {
    notFound();
  }

  return { serverClient, identity };
}

export async function saveContentDraftAction(
  rawItemId: string,
  formData: FormData,
): Promise<never> {
  const itemId = IdSchema.parse(rawItemId);
  const { serverClient, identity } = await requireContentManager();
  const { data: draft, error: draftError } = await serverClient
    .from("content_revisions")
    .select("document")
    .eq("content_item_id", itemId)
    .eq("status", "draft")
    .maybeSingle();

  if (draftError || !draft) {
    redirect(`/editor/content/${itemId}?error=save`);
  }

  let nextDocument;
  try {
    nextDocument = updateDraftDocument({
      currentDocument: draft.document,
      heading: textValue(formData, "heading"),
      introduction: textValue(formData, "introduction"),
      format:
        textValue(formData, "format") === "scroll_story"
          ? "scroll_story"
          : "short_page",
    });
  } catch {
    redirect(`/editor/content/${itemId}?error=invalid-draft`);
  }

  const { error } = await serverClient.rpc("save_content_draft", {
    target_content_item_id: itemId,
    actor_profile_id: identity.profileId,
    next_document: nextDocument,
    save_note: "Oppdatert fra redaktørflaten",
  });

  if (error) {
    redirect(`/editor/content/${itemId}?error=save`);
  }

  revalidatePath("/editor/content");
  revalidatePath(`/editor/content/${itemId}`);
  redirect(`/editor/content/${itemId}?saved=1`);
}

export async function setResourceSessionAction(
  rawItemId: string,
  rawResourceId: string,
  formData: FormData,
): Promise<never> {
  const itemId = IdSchema.parse(rawItemId);
  const resourceId = IdSchema.parse(rawResourceId);
  const { serverClient, identity } = await requireContentManager();
  const sessionValue = textValue(formData, "course-session-id");
  const courseSessionId = sessionValue ? IdSchema.parse(sessionValue) : null;

  const { error } = await serverClient.rpc("set_resource_session", {
    target_resource_item_id: resourceId,
    actor_profile_id: identity.profileId,
    target_course_session_id: courseSessionId,
  });

  if (error) {
    redirect(`/editor/content/${itemId}?error=session`);
  }

  revalidatePath(`/editor/content/${itemId}`);
  revalidatePath("/student/sessions");
  redirect(`/editor/content/${itemId}?session-saved=1`);
}

export async function publishContentAction(
  rawItemId: string,
  formData: FormData,
): Promise<never> {
  const itemId = IdSchema.parse(rawItemId);
  const { serverClient, identity } = await requireContentManager();
  const { data: revisions, error: revisionError } = await serverClient
    .from("content_revisions")
    .select("revision_number,status")
    .eq("content_item_id", itemId);

  if (revisionError) {
    redirect(`/editor/content/${itemId}?error=publish`);
  }

  const currentRevision = (revisions ?? []).find(
    (revision) => revision.status === "published",
  )?.revision_number;
  const hasDraft = (revisions ?? []).some(
    (revision) => revision.status === "draft",
  );
  const changeNote = textValue(formData, "change-note");

  try {
    planPublication({
      currentRevision: currentRevision ?? null,
      changeNote,
      hasDraft,
    });
  } catch {
    redirect(`/editor/content/${itemId}?error=change-note`);
  }

  const courseRunIds = CourseIdsSchema.parse(
    formData
      .getAll("course-run-id")
      .filter((value) => typeof value === "string"),
  );
  const { error } = await serverClient.rpc("publish_content_and_rebind", {
    target_content_item_id: itemId,
    actor_profile_id: identity.profileId,
    publication_note: changeNote,
    target_course_run_ids: courseRunIds,
  });

  if (error) {
    redirect(`/editor/content/${itemId}?error=publish`);
  }

  revalidatePath("/editor/content");
  revalidatePath(`/editor/content/${itemId}`);
  revalidatePath("/student");
  revalidatePath(`/student/content/${itemId}`);
  redirect(`/editor/content/${itemId}?published=1`);
}
