import type { SupabaseClient } from "@supabase/supabase-js";

import type { CourseRunRepository } from "./create-course-run";

function throwSupabaseError(error: { message: string; code?: string }): never {
  const suffix = error.code ? ` (${error.code})` : "";
  throw new Error(`${error.message}${suffix}`);
}

export class SupabaseCourseRunRepository implements CourseRunRepository {
  readonly #client: SupabaseClient;

  constructor(client: SupabaseClient) {
    this.#client = client;
  }

  async create(
    course: Parameters<CourseRunRepository["create"]>[0],
  ): Promise<Readonly<{ courseRunId: string }>> {
    const { data, error } = await this.#client.rpc(
      "create_course_run_with_sessions",
      {
        target_template_id: course.templateId,
        target_title: course.title,
        target_start_year: course.startYear,
        target_location_name: course.locationName ?? "",
        target_starts_on: course.startsOn,
        target_ends_on: course.endsOn,
        target_sessions: course.sessionPlan,
        target_lead_profile_id: course.leadProfileId,
        target_correlation_id: course.correlationId,
      },
    );

    if (error) {
      throwSupabaseError(error);
    }

    if (typeof data !== "string") {
      throw new Error("COURSE_CREATE_INVALID_RESPONSE");
    }

    return { courseRunId: data };
  }
}
