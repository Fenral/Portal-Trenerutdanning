import type { SupabaseClient } from "@supabase/supabase-js";

import { buildInvitationToken } from "@/features/access/invitations/token";

import {
  firstNameOf,
  renderEmail,
  type NotificationTemplate,
} from "./templates";
import type { NotificationTransport } from "./transport";

// Retry-plan etter feil nr. 1..5; RPC-en stopper og oppretter incident ved 5 feil,
// så 12h-steget brukes bare hvis maksgrensen heves i databasen.
export const RETRY_DELAYS_MS = [
  60_000, 300_000, 1_800_000, 7_200_000, 43_200_000,
] as const;

const HANDLED_EVENT_TYPES = ["notification.email", "invitation.email"];

type OutboxEventRow = Readonly<{
  id: string;
  event_type: string;
  payload: Record<string, unknown>;
  attempts: number;
}>;

export type ProcessOutboxResult = Readonly<{
  claimed: number;
  delivered: number;
  retried: number;
  incidents: number;
}>;

type WorkerOptions = Readonly<{
  client: SupabaseClient;
  transport: NotificationTransport;
  activationBaseUrl: string;
  portalUrl: string;
  now?: () => Date;
  batchSize?: number;
}>;

function throwSupabaseError(error: { message: string; code?: string }): never {
  const suffix = error.code ? ` (${error.code})` : "";
  throw new Error(`${error.message}${suffix}`);
}

async function sendNotificationEmail(
  event: OutboxEventRow,
  options: WorkerOptions,
): Promise<string> {
  const enrollmentId = String(event.payload.enrollmentId ?? "");
  const enrollment = await options.client
    .from("enrollments")
    .select("id,profile_id,course_run_id")
    .eq("id", enrollmentId)
    .single();
  if (enrollment.error) throwSupabaseError(enrollment.error);
  const { profile_id, course_run_id } = enrollment.data as {
    profile_id: string;
    course_run_id: string;
  };

  // Meldingsvarsler kan gå til motparten (f.eks. lærer) i stedet for
  // deltakeren på enrollmenten; payload bærer da recipientProfileId.
  const recipientProfileId =
    typeof event.payload.recipientProfileId === "string" &&
    event.payload.recipientProfileId
      ? event.payload.recipientProfileId
      : profile_id;

  const [profile, courseRun] = await Promise.all([
    options.client
      .from("profiles")
      .select("display_name,normalized_email")
      .eq("id", recipientProfileId)
      .single(),
    options.client
      .from("course_runs")
      .select("title")
      .eq("id", course_run_id)
      .single(),
  ]);
  if (profile.error) throwSupabaseError(profile.error);
  if (courseRun.error) throwSupabaseError(courseRun.error);

  const template = String(event.payload.template ?? "") as NotificationTemplate;
  const email = renderEmail(template, {
    firstName: firstNameOf(
      (profile.data as { display_name: string }).display_name,
    ),
    courseTitle: (courseRun.data as { title: string }).title,
    dueOn:
      typeof event.payload.dueOn === "string" ? event.payload.dueOn : undefined,
    actionUrl: options.portalUrl,
  });

  const result = await options.transport.sendEmail({
    to: (profile.data as { normalized_email: string }).normalized_email,
    subject: email.subject,
    text: email.text,
    correlationId: event.id,
  });
  return result.providerMessageId;
}

async function sendInvitationEmail(
  event: OutboxEventRow,
  options: WorkerOptions,
): Promise<string> {
  const invitationId = String(event.payload.invitationId ?? "");
  const invitation = await options.client
    .from("invitations")
    .select("id,normalized_email,claimed_at")
    .eq("id", invitationId)
    .single();
  if (invitation.error) throwSupabaseError(invitation.error);
  const row = invitation.data as {
    normalized_email: string;
    claimed_at: string | null;
  };

  if (row.claimed_at) {
    return "not-sent:already-claimed";
  }

  // Rå-token finnes kun i minnet her; databasen får bare den nye hashen.
  const token = buildInvitationToken();
  const activationUrl = new URL(options.activationBaseUrl);
  activationUrl.searchParams.set("token", token.rawToken);

  const result = await options.transport.sendInvitation({
    invitationId,
    recipientEmail: row.normalized_email,
    activationUrl: activationUrl.toString(),
    correlationId: event.id,
  });

  // Roter hashen først ETTER vellykket sending: feiler sendingen beholder
  // invitasjonen forrige gyldige token i stedet for en hash uten token —
  // ellers kan 5 feilede forsøk brikke lenken permanent. Feiler selve
  // rotasjonen etter sending, retryes hele hendelsen med et nytt token.
  const rotation = await options.client.rpc("rotate_invitation_token", {
    target_invitation_id: invitationId,
    new_token_hash: token.tokenHash,
  });
  if (rotation.error) throwSupabaseError(rotation.error);

  return result.providerMessageId;
}

export async function processOutboxOnce(
  options: WorkerOptions,
): Promise<ProcessOutboxResult> {
  const now = options.now ?? (() => new Date());
  // Uten now-override styrer databaseklokken claimingen (claim_now default now());
  // det unngår drift mellom node- og Postgres-klokke.
  const claimResult = await options.client.rpc("claim_notification_events", {
    target_event_types: HANDLED_EVENT_TYPES,
    batch_size: options.batchSize ?? 20,
    ...(options.now ? { claim_now: now().toISOString() } : {}),
  });
  if (claimResult.error) throwSupabaseError(claimResult.error);
  const events = (claimResult.data ?? []) as OutboxEventRow[];

  let delivered = 0;
  let retried = 0;
  let incidents = 0;

  for (const event of events) {
    try {
      const providerMessageId =
        event.event_type === "invitation.email"
          ? await sendInvitationEmail(event, options)
          : await sendNotificationEmail(event, options);

      const completion = await options.client.rpc(
        "complete_notification_event",
        {
          target_event_id: event.id,
          target_provider_message_id: providerMessageId,
        },
      );
      if (completion.error) throwSupabaseError(completion.error);
      delivered += 1;
    } catch (error) {
      const errorCode = (
        error instanceof Error ? error.message : "UNKNOWN_ERROR"
      ).slice(0, 120);
      const delayMs =
        RETRY_DELAYS_MS[
          Math.min(event.attempts - 1, RETRY_DELAYS_MS.length - 1)
        ];
      const failure = await options.client.rpc("fail_notification_event", {
        target_event_id: event.id,
        target_error_code: errorCode,
        retry_at: new Date(now().getTime() + delayMs).toISOString(),
      });
      if (failure.error) throwSupabaseError(failure.error);
      if (failure.data === "incident_created") {
        incidents += 1;
      } else {
        retried += 1;
      }
    }
  }

  return { claimed: events.length, delivered, retried, incidents };
}
