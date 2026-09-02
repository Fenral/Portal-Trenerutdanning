import { randomUUID } from "node:crypto";

import { createTransport, type Transporter } from "nodemailer";

import { ConsoleNotificationTransport } from "./console-transport";
import type {
  EmailMessage,
  InvitationNotification,
  NotificationTransport,
  SendResult,
} from "./transport";

type SmtpTransportOptions = Readonly<{
  from: string;
  transporter: Transporter;
}>;

export class JsonSmtpTransport implements NotificationTransport {
  readonly #from: string;
  readonly #transporter: Transporter;

  constructor(options: SmtpTransportOptions) {
    this.#from = options.from;
    this.#transporter = options.transporter;
  }

  async sendEmail(message: EmailMessage): Promise<SendResult> {
    const info = await this.#transporter.sendMail({
      from: this.#from,
      to: message.to,
      subject: message.subject,
      text: message.text,
    });
    return { providerMessageId: info.messageId ?? `smtp:${randomUUID()}` };
  }

  async sendInvitation(
    notification: InvitationNotification,
  ): Promise<SendResult> {
    return this.sendEmail({
      to: notification.recipientEmail,
      subject: "Invitasjon til Trenerutdanningsportalen",
      text: [
        "Hei,",
        "",
        "du er invitert til Trenerutdanningsportalen.",
        `Aktiver tilgangen din her: ${notification.activationUrl}`,
        "",
        "Vennlig hilsen",
        "Trenerutdanningsportalen",
      ].join("\n"),
      correlationId: notification.correlationId,
    });
  }
}

export function createNotificationTransportFromEnvironment(
  environment: NodeJS.ProcessEnv = process.env,
): NotificationTransport {
  const { SMTP_HOST, SMTP_PORT, SMTP_FROM, SMTP_USER, SMTP_PASSWORD } =
    environment;

  if (SMTP_HOST && SMTP_PORT && SMTP_FROM) {
    return new JsonSmtpTransport({
      from: SMTP_FROM,
      transporter: createTransport({
        host: SMTP_HOST,
        port: Number(SMTP_PORT),
        secure: Number(SMTP_PORT) === 465,
        auth:
          SMTP_USER && SMTP_PASSWORD
            ? { user: SMTP_USER, pass: SMTP_PASSWORD }
            : undefined,
      }),
    });
  }

  if (environment.NODE_ENV === "production") {
    // Behold dagens vern: produksjon uten godkjent SMTP-konfig skal feile høyt.
    throw new Error(
      "SMTP configuration (SMTP_HOST, SMTP_PORT, SMTP_FROM) is required in production",
    );
  }

  if (environment.NOTIFICATIONS_TRANSPORT === "json") {
    return new JsonSmtpTransport({
      from: SMTP_FROM ?? "portal@nivaa.invalid",
      transporter: createTransport({ jsonTransport: true }),
    });
  }

  return new ConsoleNotificationTransport({
    runtimeEnvironment: environment.NODE_ENV,
    write: (event) => console.info(JSON.stringify(event)),
  });
}
