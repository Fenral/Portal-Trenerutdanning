import type { SupabaseClient } from "@supabase/supabase-js";

import type { InvitationRepository } from "./create-invitation";
import type { ClaimInvitationRepository } from "./claim-invitation";

export type InvitationInspection = Readonly<{
  invitationId: string;
  normalizedEmail: string;
  expiresAt: Date;
  claimState: "valid" | "expired" | "already_claimed";
}>;

type InspectionRow = Readonly<{
  invitation_id: string;
  normalized_email: string;
  expires_at: string;
  claim_state: InvitationInspection["claimState"];
}>;

function throwSupabaseError(error: { message: string; code?: string }): never {
  const suffix = error.code ? ` (${error.code})` : "";
  throw new Error(`${error.message}${suffix}`);
}

export class SupabaseInvitationRepository
  implements InvitationRepository, ClaimInvitationRepository
{
  readonly #callerClient: SupabaseClient;
  readonly #workerClient: SupabaseClient;

  constructor(callerClient: SupabaseClient, workerClient: SupabaseClient) {
    this.#callerClient = callerClient;
    this.#workerClient = workerClient;
  }

  async createWithOutbox(
    invitation: Parameters<InvitationRepository["createWithOutbox"]>[0],
  ): Promise<Readonly<{ invitationId: string }>> {
    const { data, error } = await this.#callerClient.rpc(
      "create_course_invitation",
      {
        target_course_run_id: invitation.courseRunId,
        target_email: invitation.normalizedEmail,
        target_role: invitation.role,
        target_token_hash: invitation.tokenHash,
        target_expires_at: invitation.expiresAt.toISOString(),
        target_correlation_id: invitation.correlationId,
      },
    );

    if (error) {
      throwSupabaseError(error);
    }

    if (typeof data !== "string") {
      throw new Error("INVITATION_CREATE_INVALID_RESPONSE");
    }

    return { invitationId: data };
  }

  async markDelivered(
    invitationId: string,
    correlationId: string,
  ): Promise<void> {
    const { error } = await this.#workerClient.rpc("mark_invitation_delivery", {
      delivery_invitation_id: invitationId,
      delivery_correlation_id: correlationId,
    });

    if (error) {
      throwSupabaseError(error);
    }
  }

  async inspectByHash(input: {
    tokenHash: string;
    now: Date;
  }): Promise<InvitationInspection | null> {
    const { data, error } = await this.#workerClient.rpc(
      "inspect_course_invitation",
      {
        target_token_hash: input.tokenHash,
        inspected_at: input.now.toISOString(),
      },
    );

    if (error) {
      throwSupabaseError(error);
    }

    const row = (data as InspectionRow[] | null)?.[0];

    if (!row) {
      return null;
    }

    return {
      invitationId: row.invitation_id,
      normalizedEmail: row.normalized_email,
      expiresAt: new Date(row.expires_at),
      claimState: row.claim_state,
    };
  }

  async claimByHash(input: {
    tokenHash: string;
    correlationId: string;
  }): Promise<Readonly<{ destination: string }>> {
    const { data, error } = await this.#callerClient.rpc(
      "claim_course_invitation",
      {
        target_token_hash: input.tokenHash,
        target_correlation_id: input.correlationId,
      },
    );

    if (error) {
      throwSupabaseError(error);
    }

    if (typeof data !== "string") {
      throw new Error("INVITATION_CLAIM_INVALID_RESPONSE");
    }

    return { destination: data };
  }
}
