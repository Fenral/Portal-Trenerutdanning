"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { isAdministrator } from "@/features/access/require-administrator";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const pagePath = "/admin";

function finish(notice: string): never {
  revalidatePath(pagePath);
  redirect(`${pagePath}?notice=${notice}`);
}

/**
 * Markerer en Ungdomsdriven-faktureringsoppgave som håndtert. Portalen
 * fakturerer aldri selv — oppgaven kvitteres ut her etter at differansen er
 * fakturert i Checkin/økonomisystemet. Kun administrator; skriver
 * `admin_task.updated` til revisjonssporet med aktør.
 */
export async function markAdminTaskHandledAction(
  formData: FormData,
): Promise<never> {
  const taskId = formData.get("taskId");
  if (typeof taskId !== "string" || !taskId) finish("task-error");

  const serverClient = await createSupabaseServerClient();
  const {
    data: { user },
  } = await serverClient.auth.getUser();
  const admin = createSupabaseAdminClient();
  if (!user || !(await isAdministrator(user.id, admin))) finish("task-error");

  const accountResult = await admin
    .from("user_accounts")
    .select("profile_id")
    .eq("user_id", user.id)
    .maybeSingle();
  const actorProfileId = accountResult.data?.profile_id as string | undefined;
  if (accountResult.error || !actorProfileId) finish("task-error");

  const updateResult = await admin
    .from("completion_admin_tasks")
    .update({
      status: "completed",
      completed_at: new Date().toISOString(),
      completed_by: actorProfileId,
    })
    .eq("id", taskId)
    .eq("status", "pending")
    .select("id,enrollment_id,course_run_id,task_code")
    .maybeSingle();
  if (updateResult.error || !updateResult.data) finish("task-error");

  const auditResult = await admin.from("audit_events").insert({
    actor_profile_id: actorProfileId,
    action: "admin_task.updated",
    entity_type: "completion_admin_task",
    entity_id: taskId,
    reason: "Fakturert i Checkin/økonomisystem",
    before_data: { status: "pending" },
    after_data: {
      status: "completed",
      taskCode: updateResult.data.task_code,
      enrollmentId: updateResult.data.enrollment_id,
      courseRunId: updateResult.data.course_run_id,
    },
  });
  if (auditResult.error) finish("task-error");

  finish("task-handled");
}
