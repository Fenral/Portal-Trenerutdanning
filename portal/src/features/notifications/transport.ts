export type InvitationNotification = Readonly<{
  invitationId: string;
  recipientEmail: string;
  activationUrl: string;
  correlationId: string;
}>;

export type EmailMessage = Readonly<{
  to: string;
  subject: string;
  text: string;
  correlationId: string;
}>;

export type SendResult = Readonly<{ providerMessageId: string }>;

export interface NotificationTransport {
  sendInvitation(notification: InvitationNotification): Promise<SendResult>;
  sendEmail(message: EmailMessage): Promise<SendResult>;
}
