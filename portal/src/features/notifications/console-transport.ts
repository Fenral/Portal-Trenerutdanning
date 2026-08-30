import { maskEmail } from "@/features/access/invitations/claim-invitation";

import type {
  InvitationNotification,
  NotificationTransport,
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

  async sendInvitation(notification: InvitationNotification): Promise<void> {
    if (this.#runtimeEnvironment === "production") {
      throw new Error(
        "Console notification transport is disabled in production",
      );
    }

    this.#write({
      event: "invitation.email.preview",
      invitationId: notification.invitationId,
      recipient: maskEmail(notification.recipientEmail),
      correlationId: notification.correlationId,
    });
  }
}
