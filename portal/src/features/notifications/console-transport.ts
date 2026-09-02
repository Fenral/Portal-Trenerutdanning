import { randomUUID } from "node:crypto";

import { maskEmail } from "@/features/access/invitations/claim-invitation";

import type {
  EmailMessage,
  InvitationNotification,
  NotificationTransport,
  SendResult,
} from "./transport";

type ConsoleTransportOptions = Readonly<{
  runtimeEnvironment: string | undefined;
  write: (event: Readonly<Record<string, string>>) => void;
}>;

export class ConsoleNotificationTransport implements NotificationTransport {
  readonly #runtimeEnvironment: string | undefined;
  readonly #write: ConsoleTransportOptions["write"];

  constructor(options: ConsoleTransportOptions) {
    this.#runtimeEnvironment = options.runtimeEnvironment;
    this.#write = options.write;
  }

  #assertNotProduction(): void {
    if (this.#runtimeEnvironment === "production") {
      throw new Error(
        "Console notification transport is disabled in production",
      );
    }
  }

  async sendInvitation(
    notification: InvitationNotification,
  ): Promise<SendResult> {
    this.#assertNotProduction();

    this.#write({
      event: "invitation.email.preview",
      invitationId: notification.invitationId,
      recipient: maskEmail(notification.recipientEmail),
      correlationId: notification.correlationId,
    });

    return { providerMessageId: `console:${randomUUID()}` };
  }

  async sendEmail(message: EmailMessage): Promise<SendResult> {
    this.#assertNotProduction();

    this.#write({
      event: "notification.email.preview",
      recipient: maskEmail(message.to),
      subject: message.subject,
      correlationId: message.correlationId,
    });

    return { providerMessageId: `console:${randomUUID()}` };
  }
}
