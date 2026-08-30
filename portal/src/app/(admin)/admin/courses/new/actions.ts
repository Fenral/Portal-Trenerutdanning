"use server";

import { revalidatePath } from "next/cache";
import { notFound, redirect } from "next/navigation";

import { isAdministrator } from "@/features/access/require-administrator";
import { createCourseRun } from "@/features/courses/create-course-run";
import { SupabaseCourseRunRepository } from "@/features/courses/supabase-repository";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

function textValue(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value.trim() : "";
}

const osloOffsetFormatter = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Europe/Oslo",
  timeZoneName: "longOffset",
});

function isoTimestamp(date: string, time: string): string {
  const localTime = time || "09:00";
  const offsetName = osloOffsetFormatter
    .formatToParts(new Date(`${date}T${localTime}:00Z`))
    .find((part) => part.type === "timeZoneName")?.value;
  const offset = offsetName?.match(/^GMT([+-]\d{2}:\d{2})$/)?.[1];

  if (!offset) {
    throw new Error("COURSE_SESSION_TIME_ZONE_INVALID");
  }

  return `${date}T${localTime}:00${offset}`;
}

export async function createCourseRunAction(formData: FormData): Promise<void> {
  const serverClient = await createSupabaseServerClient();
  const {
    data: { user },
  } = await serverClient.auth.getUser();
  const adminClient = createSupabaseAdminClient();

  if (!user || !(await isAdministrator(user.id, adminClient))) {
    notFound();
  }

  try {
    const templateCode = textValue(formData, "template-code");
    const { data: template, error: templateError } = await adminClient
      .from("course_templates")
      .select("id,code")
      .eq("code", templateCode)
      .maybeSingle();

    if (
      templateError ||
      !template ||
      !["T1", "T2", "T3"].includes(template.code)
    ) {
      throw new Error("COURSE_TEMPLATE_INVALID");
    }

    const sessionPlan = Array.from({ length: 6 }, (_, index) => {
      const position = index + 1;
      const title = textValue(formData, `session-${position}-title`);
      const startsOn = textValue(formData, `session-${position}-starts-on`);
      const endsOn = textValue(formData, `session-${position}-ends-on`);

      if (!title && !startsOn && !endsOn) {
        return null;
      }

      return {
        title,
        startsAt: isoTimestamp(
          startsOn,
          textValue(formData, `session-${position}-starts-at`),
        ),
        endsAt: isoTimestamp(
          endsOn,
          textValue(formData, `session-${position}-ends-at`) || "16:00",
        ),
        locationText:
          textValue(formData, `session-${position}-location`) || undefined,
        sessionType:
          textValue(formData, `session-${position}-type`) === "youth_drive"
            ? ("youth_drive" as const)
            : ("regular" as const),
        isRequired:
          textValue(formData, `session-${position}-required`) === "required",
      };
    }).filter((session) => session !== null);

    await createCourseRun(
      {
        templateCode: template.code as "T1" | "T2" | "T3",
        templateId: template.id,
        title: textValue(formData, "title"),
        startYear: Number(textValue(formData, "start-year")),
        startsOn: textValue(formData, "starts-on"),
        endsOn: textValue(formData, "ends-on"),
        locationName: textValue(formData, "location-name") || undefined,
        sessions: sessionPlan.length,
        leadProfileId: textValue(formData, "lead-profile-id"),
        correlationId: crypto.randomUUID(),
        sessionPlan,
      },
      { repository: new SupabaseCourseRunRepository(serverClient) },
    );
  } catch {
    redirect("/admin/courses/new?error=invalid");
  }

  revalidatePath("/admin/courses");
  redirect("/admin/courses?created=1");
}
