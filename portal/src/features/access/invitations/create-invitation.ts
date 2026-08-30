import type { NotificationTransport } from "@/features/notifications/transport";

import {
  CreateInvitationInputSchema,
  type CreateInvitationInput,
  type ValidatedCreateInvitationInput,
} from "./schema";
import { buildInvitationToken, type InvitationToken } from "./token";

export { buildInvitationToken, hashInvitationToken } from "./token";

export type InvitationRepository = Readonly<{
  createWithOutbox(
    invitation: Readonly<
      Omit<ValidatedCreateInvitationInput, "email"> & { tokenHash: string }
    >,
  ): Promise<Readonly<{ invitationId: string }>>;
  markDelivered(invitationId: string, correlationId: string): Promise<void>;
}>;

type CreateInvitationDependencies = Readonly<{
  repository: InvitationRepository;
  transport: NotificationTransport;
  activationBaseUrl: string;
  tokenFactory?: () => InvitationToken;
}>;

export async function createInvitation(
  input: CreateInvitationInput,
  dependencies: CreateInvitationDependencies,
): Promise<Readonly<{ status: "sent"; invitationId: string }>> {
  const validated = CreateInvitationInputSchema.parse(input);
  const token = (dependencies.tokenFactory ?? buildInvitationToken)();
  const { invitationId } = await dependencies.repository.createWithOutbox({
    normalizedEmail: validated.normalizedEmail,
    courseRunId: validated.courseRunId,
    role: validated.role,
    createdBy: validated.createdBy,
    expiresAt: validated.expiresAt,
    correlationId: validated.correlationId,
    tokenHash: token.tokenHash,
  });
  const activationUrl = new URL(dependencies.activationBaseUrl);
  activationUrl.searchParams.set("token", token.rawToken);

  await dependencies.transport.sendInvitation({
    invitationId,
    recipientEmail: validated.normalizedEmail,
    activationUrl: activationUrl.toString(),
    correlationId: validated.correlationId,
  });
  await dependencies.repository.markDelivered(
    invitationId,
    validated.correlationId,
  );

  return { status: "sent", invitationId };
}
