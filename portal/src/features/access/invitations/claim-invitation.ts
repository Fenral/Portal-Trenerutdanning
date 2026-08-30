export type InvitationClaimView = Readonly<{
  normalizedEmail: string;
  expiresAt: Date;
  claimedAt: Date | null;
}>;

export type ClaimValidationResult =
  | Readonly<{ ok: true }>
  | Readonly<{
      ok: false;
      reason: "email_mismatch" | "expired" | "already_claimed";
    }>;

export type ClaimInvitationCommand = Readonly<{
  rawToken: string;
  authenticatedUserId: string;
  authenticatedEmail: string;
  now: Date;
  correlationId: string;
}>;

export type ClaimInvitationResult =
  | Readonly<{ status: "claimed"; destination: string }>
  | Readonly<{
      status: "rejected";
      reason: "invalid" | "expired" | "already_claimed" | "email_mismatch";
    }>;

export type ClaimInvitationRepository = Readonly<{
  claimByHash(input: {
    tokenHash: string;
    correlationId: string;
  }): Promise<Readonly<{ destination: string }>>;
}>;

type ClaimInvitationDependencies = Readonly<{
  repository: ClaimInvitationRepository;
}>;

const ClaimInvitationCommandSchema = z.object({
  rawToken: z.string().min(20).max(256),
  authenticatedUserId: z.string().uuid(),
  authenticatedEmail: z.string().trim().min(3).max(254).email(),
  now: z.date(),
  correlationId: z.string().uuid(),
});

const databaseReasonMap = {
  INVITATION_INVALID: "invalid",
  INVITATION_EXPIRED: "expired",
  INVITATION_ALREADY_CLAIMED: "already_claimed",
  INVITATION_EMAIL_MISMATCH: "email_mismatch",
} as const;

export function normalizeEmail(value: string): string {
  return value.trim().toLocaleLowerCase("en-US");
}

export function maskEmail(value: string): string {
  const normalized = normalizeEmail(value);
  const separatorIndex = normalized.lastIndexOf("@");

  if (separatorIndex < 1) {
    return "***";
  }

  return `${normalized[0]}***${normalized.slice(separatorIndex)}`;
}

export function validateInvitationClaim(
  invitation: InvitationClaimView,
  email: string,
  now: Date,
): ClaimValidationResult {
  if (invitation.claimedAt) {
    return { ok: false, reason: "already_claimed" };
  }

  if (invitation.expiresAt.getTime() <= now.getTime()) {
    return { ok: false, reason: "expired" };
  }

  if (invitation.normalizedEmail !== normalizeEmail(email)) {
    return { ok: false, reason: "email_mismatch" };
  }

  return { ok: true };
}

export async function claimInvitation(
  command: ClaimInvitationCommand,
  dependencies: ClaimInvitationDependencies,
): Promise<ClaimInvitationResult> {
  const validated = ClaimInvitationCommandSchema.safeParse(command);

  if (!validated.success) {
    return { status: "rejected", reason: "invalid" };
  }

  try {
    const { destination } = await dependencies.repository.claimByHash({
      tokenHash: hashInvitationToken(validated.data.rawToken),
      correlationId: validated.data.correlationId,
    });

    return { status: "claimed", destination };
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    const databaseReason = Object.entries(databaseReasonMap).find(([code]) =>
      message.includes(code),
    )?.[1];

    return {
      status: "rejected",
      reason: databaseReason ?? "invalid",
    };
  }
}
import { z } from "zod";

import { hashInvitationToken } from "./token";
