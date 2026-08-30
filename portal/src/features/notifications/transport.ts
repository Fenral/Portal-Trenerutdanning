export type InvitationNotification = Readonly<{
  invitationId: string;
  recipientEmail: string;
  activationUrl: string;
  correlationId: string;
}>;

export interface NotificationTransport {
  sendInvitation(notification: InvitationNotification): Promise<void>;
}
