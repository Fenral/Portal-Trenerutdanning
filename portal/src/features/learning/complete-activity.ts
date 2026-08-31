import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

const DatabaseId = z
  .string()
  .trim()
  .regex(/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i);

const ActivityCompletionInput = z.object({
  enrollmentId: DatabaseId,
  activityId: DatabaseId,
  contentRevisionId: DatabaseId.nullable(),
});

export type ActivityCompletionInput = z.infer<typeof ActivityCompletionInput>;

export type ActivityCompletionRepository = Readonly<{
  record(
    input: ActivityCompletionInput,
  ): Promise<Readonly<{ completionId: string }>>;
}>;

type CompleteActivityDependencies = Readonly<{
  repository: ActivityCompletionRepository;
}>;

export async function completeActivity(
  input: ActivityCompletionInput,
  dependencies: CompleteActivityDependencies,
): Promise<Readonly<{ completionId: string }>> {
  const parsed = ActivityCompletionInput.safeParse(input);

  if (!parsed.success) {
    throw new Error("Ugyldig fullføringsdata");
  }

  return dependencies.repository.record(parsed.data);
}

export class SupabaseActivityCompletionRepository implements ActivityCompletionRepository {
  readonly #client: SupabaseClient;

  constructor(client: SupabaseClient) {
    this.#client = client;
  }

  async record(
    input: ActivityCompletionInput,
  ): Promise<Readonly<{ completionId: string }>> {
    const { data, error } = await this.#client.rpc(
      "record_activity_completion",
      {
        target_enrollment_id: input.enrollmentId,
        target_activity_id: input.activityId,
        target_content_revision_id: input.contentRevisionId,
      },
    );

    if (error) {
      throw new Error(`ACTIVITY_COMPLETION_FAILED:${error.message}`);
    }

    if (typeof data !== "string") {
      throw new Error("ACTIVITY_COMPLETION_INVALID_RESPONSE");
    }

    return { completionId: data };
  }
}
