import { randomUUID } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { beforeAll, describe, expect, it } from "vitest";

import {
  buildInvitationToken,
  hashInvitationToken,
} from "@/features/access/invitations/token";
import { processOutboxOnce } from "@/features/notifications/process-outbox";
import type {
  EmailMessage,
  InvitationNotification,
  NotificationTransport,
} from "@/features/notifications/transport";

const courseRunId = "b1030000-0000-0000-0000-000000000001";
const reminderProfileId = "de100000-0000-0000-0000-000000000001";
const reminderEnrollmentId = "de200000-0000-0000-0000-000000000001";
const reminderEmail = "notif.student@nivaa.invalid";
const adminProfileId = "c0000000-0000-0000-0000-000000000001";
const scopedLeadEmail = "lead.t3@nivaa.invalid";
const foreignLeadEmail = "lead.t2@nivaa.invalid";

function loadLocalEnvironment(): void {
  if (!existsSync(".env.local")) return;

  for (const line of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
    const separator = line.indexOf("=");
    if (separator > 0 && !line.startsWith("#")) {
      process.env[line.slice(0, separator)] ??= line.slice(separator + 1);
    }
  }
}

function requiredEnvironment(name: string): string {
  const value = process.env[name];
  if (!value)
    throw new Error(`Missing integration environment variable: ${name}`);
  return value;
}

function assertNoError(error: { message: string } | null): void {
  if (error) throw new Error(error.message);
}

class RecordingTransport implements NotificationTransport {
  readonly emails: EmailMessage[] = [];
  readonly invitations: InvitationNotification[] = [];
  failuresRemaining = 0;
  failForCorrelationId: string | undefined;

  #maybeFail(correlationId: string): void {
    if (
      this.failuresRemaining > 0 &&
      (!this.failForCorrelationId ||
        this.failForCorrelationId === correlationId)
    ) {
      this.failuresRemaining -= 1;
      throw new Error("SMTP_500");
    }
  }

  async sendEmail(
    message: EmailMessage,
  ): Promise<Readonly<{ providerMessageId: string }>> {
    this.#maybeFail(message.correlationId);
    this.emails.push(message);
    return { providerMessageId: `fake:${this.emails.length}` };
  }

  async sendInvitation(
    notification: InvitationNotification,
  ): Promise<Readonly<{ providerMessageId: string }>> {
    this.#maybeFail(notification.correlationId);
    this.invitations.push(notification);
    return { providerMessageId: `fake-invite:${this.invitations.length}` };
  }
}

let adminClient: SupabaseClient;

async function signedInClient(email: string): Promise<SupabaseClient> {
  const client = createClient(
    requiredEnvironment("NEXT_PUBLIC_SUPABASE_URL"),
    requiredEnvironment("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"),
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
        storageKey: `outbox-${email}-${randomUUID()}`,
      },
    },
  );
  const { error } = await client.auth.signInWithPassword({
    email,
    password: requiredEnvironment("E2E_DEMO_PASSWORD"),
  });
  assertNoError(error);
  return client;
}

async function insertOutboxEvent(input: {
  eventType: string;
  idempotencyKey: string;
  payload: Record<string, unknown>;
}): Promise<string> {
  const result = await adminClient
    .from("outbox_events")
    .insert({
      event_type: input.eventType,
      idempotency_key: input.idempotencyKey,
      payload: input.payload,
    })
    .select("id")
    .single();
  assertNoError(result.error);
  return (result.data as { id: string }).id;
}

async function outboxEvent(eventId: string) {
  const result = await adminClient
    .from("outbox_events")
    .select("status,attempts,available_at,delivered_at,last_error_code")
    .eq("id", eventId)
    .single();
  assertNoError(result.error);
  return result.data as {
    status: string;
    attempts: number;
    available_at: string;
    delivered_at: string | null;
    last_error_code: string | null;
  };
}

async function deliveryFor(eventId: string) {
  const result = await adminClient
    .from("notification_deliveries")
    .select("provider_message_id,attempts,next_retry_at,delivered_at")
    .eq("outbox_event_id", eventId)
    .maybeSingle();
  assertNoError(result.error);
  return result.data as {
    provider_message_id: string | null;
    attempts: number;
    next_retry_at: string | null;
    delivered_at: string | null;
  } | null;
}

function runWorker(transport: NotificationTransport, now?: () => Date) {
  return processOutboxOnce({
    client: adminClient,
    transport,
    activationBaseUrl: "https://portal.example/activate",
    portalUrl: "https://portal.example",
    now,
  });
}

beforeAll(async () => {
  loadLocalEnvironment();
  adminClient = createClient(
    requiredEnvironment("NEXT_PUBLIC_SUPABASE_URL"),
    requiredEnvironment("SUPABASE_SECRET_KEY"),
    { auth: { autoRefreshToken: false, persistSession: false } },
  );

  const profile = await adminClient.from("profiles").upsert(
    {
      id: reminderProfileId,
      display_name: "Nora Notifikasjon",
      normalized_email: reminderEmail,
    },
    { onConflict: "id" },
  );
  assertNoError(profile.error);
  const enrollment = await adminClient.from("enrollments").upsert(
    {
      id: reminderEnrollmentId,
      course_run_id: courseRunId,
      profile_id: reminderProfileId,
      status: "active",
    },
    { onConflict: "id" },
  );
  assertNoError(enrollment.error);

  // Gjør reruns deterministiske: fjern gamle testhendelser for denne deltakeren.
  const cleanup = await adminClient
    .from("outbox_events")
    .delete()
    .like("idempotency_key", `due_reminder:${reminderEnrollmentId}:%`);
  assertNoError(cleanup.error);
  const pending = await adminClient
    .from("outbox_events")
    .delete()
    .in("event_type", ["notification.email", "invitation.email"])
    .eq("status", "pending");
  assertNoError(pending.error);
}, 60_000);

describe("outbox worker", () => {
  it("delivers a claimed event exactly once across two runs", async () => {
    const transport = new RecordingTransport();
    const eventId = await insertOutboxEvent({
      eventType: "notification.email",
      idempotencyKey: `test-once:${randomUUID()}`,
      payload: { template: "due_reminder", enrollmentId: reminderEnrollmentId },
    });

    await runWorker(transport);
    await runWorker(transport);

    const eventEmails = transport.emails.filter(
      (email) => email.correlationId === eventId,
    );
    expect(eventEmails).toHaveLength(1);
    expect(eventEmails[0].to).toBe(reminderEmail);
    expect(eventEmails[0].text).toContain("Nora");
    expect(eventEmails[0].text).toContain("Trener 3");

    const event = await outboxEvent(eventId);
    expect(event.status).toBe("delivered");
    const delivery = await deliveryFor(eventId);
    expect(delivery?.attempts).toBe(1);
    expect(delivery?.provider_message_id).toMatch(/^fake:/);
  }, 30_000);

  it("retries after a provider failure and delivers on the second attempt", async () => {
    const transport = new RecordingTransport();
    const eventId = await insertOutboxEvent({
      eventType: "notification.email",
      idempotencyKey: `test-retry:${randomUUID()}`,
      payload: { template: "due_reminder", enrollmentId: reminderEnrollmentId },
    });
    transport.failuresRemaining = 1;
    transport.failForCorrelationId = eventId;

    await runWorker(transport);
    const afterFailure = await outboxEvent(eventId);
    expect(afterFailure.status).toBe("pending");
    expect(afterFailure.last_error_code).toContain("SMTP_500");
    const retryDelayMs =
      new Date(afterFailure.available_at).getTime() - Date.now();
    expect(retryDelayMs).toBeGreaterThan(30_000);
    expect(retryDelayMs).toBeLessThan(90_000);

    await runWorker(transport, () => new Date(Date.now() + 2 * 60_000));
    expect(
      transport.emails.filter((email) => email.correlationId === eventId),
    ).toHaveLength(1);

    const event = await outboxEvent(eventId);
    expect(event.status).toBe("delivered");
    const delivery = await deliveryFor(eventId);
    expect(delivery?.attempts).toBe(2);
    expect(delivery?.next_retry_at).toBeNull();
  }, 30_000);

  it("mints a fresh token when retrying an invitation email", async () => {
    const transport = new RecordingTransport();
    const invitationId = randomUUID();
    const originalToken = buildInvitationToken();
    const invitation = await adminClient.from("invitations").insert({
      id: invitationId,
      normalized_email: `invite-${invitationId.slice(0, 8)}@nivaa.invalid`,
      token_hash: originalToken.tokenHash,
      course_run_id: courseRunId,
      role: "student",
      expires_at: new Date(Date.now() + 7 * 86_400_000).toISOString(),
      created_by: adminProfileId,
    });
    assertNoError(invitation.error);
    const eventId = await insertOutboxEvent({
      eventType: "invitation.email",
      idempotencyKey: `invitation.email:${invitationId}`,
      payload: { invitationId },
    });

    await runWorker(transport);
    const invitationSends = transport.invitations.filter(
      (sent) => sent.invitationId === invitationId,
    );
    expect(invitationSends).toHaveLength(1);

    const sentUrl = new URL(invitationSends[0].activationUrl);
    const sentToken = sentUrl.searchParams.get("token");
    expect(sentToken).toBeTruthy();
    expect(sentToken).not.toBe(originalToken.rawToken);

    const stored = await adminClient
      .from("invitations")
      .select("token_hash")
      .eq("id", invitationId)
      .single();
    assertNoError(stored.error);
    const storedHash = (stored.data as { token_hash: string }).token_hash;
    expect(storedHash).toBe(hashInvitationToken(sentToken as string));
    expect(storedHash).not.toBe(originalToken.tokenHash);

    const event = await outboxEvent(eventId);
    expect(event.status).toBe("delivered");
  }, 30_000);
});

describe("manual due reminder", () => {
  it("creates one outbox event for duplicate reminders the same day", async () => {
    const lead = await signedInClient(scopedLeadEmail);
    const first = await lead.rpc("enqueue_due_reminder", {
      target_enrollment_id: reminderEnrollmentId,
    });
    assertNoError(first.error);
    const second = await lead.rpc("enqueue_due_reminder", {
      target_enrollment_id: reminderEnrollmentId,
    });
    assertNoError(second.error);
    expect(second.data).toBe(first.data);

    const events = await adminClient
      .from("outbox_events")
      .select("id")
      .like("idempotency_key", `due_reminder:${reminderEnrollmentId}:%`);
    assertNoError(events.error);
    expect(events.data).toHaveLength(1);
    await lead.auth.signOut();
  }, 30_000);

  it("rejects reminders for participants outside the teacher's course", async () => {
    const foreignLead = await signedInClient(foreignLeadEmail);
    const result = await foreignLead.rpc("enqueue_due_reminder", {
      target_enrollment_id: reminderEnrollmentId,
    });
    expect(result.error?.message).toContain("REMINDER_FORBIDDEN");
    await foreignLead.auth.signOut();
  }, 30_000);
});
