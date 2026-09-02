import { randomUUID } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { beforeAll, describe, expect, it } from "vitest";

import { processOutboxOnce } from "@/features/notifications/process-outbox";
import type {
  EmailMessage,
  NotificationTransport,
} from "@/features/notifications/transport";

const courseRunId = "b1030000-0000-0000-0000-000000000001";
const teacherProfileId = "c0000000-0000-0000-0000-000000000004";
const studentProfileId = "c0000000-0000-0000-0000-000000000006";
const teacherEmail = "lead.t3@nivaa.invalid";
const studentEmail = "emil.berg@nivaa.invalid";

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

  async sendEmail(
    message: EmailMessage,
  ): Promise<Readonly<{ providerMessageId: string }>> {
    this.emails.push(message);
    return { providerMessageId: `fake:${this.emails.length}` };
  }

  async sendInvitation(): Promise<Readonly<{ providerMessageId: string }>> {
    return { providerMessageId: "fake-invite" };
  }
}

let adminClient: SupabaseClient;
let teacherClient: SupabaseClient;
let studentClient: SupabaseClient;
let enrollmentId: string;

async function signedInClient(email: string): Promise<SupabaseClient> {
  const client = createClient(
    requiredEnvironment("NEXT_PUBLIC_SUPABASE_URL"),
    requiredEnvironment("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"),
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
        storageKey: `messages-${email}-${randomUUID()}`,
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

async function threadOutboxEvents(recipientProfile: string) {
  const result = await adminClient
    .from("outbox_events")
    .select("id,status,payload")
    .like(
      "idempotency_key",
      `message_received:${enrollmentId}:${recipientProfile}:%`,
    );
  assertNoError(result.error);
  return result.data ?? [];
}

async function unreadCountFor(profileId: string): Promise<number> {
  const result = await adminClient
    .from("messages")
    .select("id", { count: "exact", head: true })
    .eq("enrollment_id", enrollmentId)
    .eq("recipient_profile_id", profileId)
    .is("read_at", null);
  assertNoError(result.error);
  return result.count ?? 0;
}

beforeAll(async () => {
  loadLocalEnvironment();
  adminClient = createClient(
    requiredEnvironment("NEXT_PUBLIC_SUPABASE_URL"),
    requiredEnvironment("SUPABASE_SECRET_KEY"),
    { auth: { autoRefreshToken: false, persistSession: false } },
  );

  const enrollment = await adminClient
    .from("enrollments")
    .select("id")
    .eq("course_run_id", courseRunId)
    .eq("profile_id", studentProfileId)
    .single();
  assertNoError(enrollment.error);
  enrollmentId = (enrollment.data as { id: string }).id;

  // Deterministiske reruns: fjern trådens meldinger og varsler (alle statuser).
  const oldMessages = await adminClient
    .from("messages")
    .delete()
    .eq("enrollment_id", enrollmentId);
  assertNoError(oldMessages.error);
  const oldEvents = await adminClient
    .from("outbox_events")
    .delete()
    .like("idempotency_key", `message_received:${enrollmentId}:%`);
  assertNoError(oldEvents.error);

  teacherClient = await signedInClient(teacherEmail);
  studentClient = await signedInClient(studentEmail);
}, 60_000);

describe("teacher-student messaging", () => {
  it("stores both sends but enqueues one notification per thread per day", async () => {
    const first = await teacherClient.rpc("send_message", {
      target_enrollment_id: enrollmentId,
      target_recipient_profile_id: studentProfileId,
      target_body: "Hei Emil! Husk refleksjonsnotatet.",
    });
    assertNoError(first.error);
    const second = await teacherClient.rpc("send_message", {
      target_enrollment_id: enrollmentId,
      target_recipient_profile_id: studentProfileId,
      target_body: "PS: fristen er fredag.",
    });
    assertNoError(second.error);
    expect(first.data).not.toBe(second.data);

    const events = await threadOutboxEvents(studentProfileId);
    expect(events).toHaveLength(1);

    const messages = await adminClient
      .from("messages")
      .select("id")
      .eq("enrollment_id", enrollmentId);
    assertNoError(messages.error);
    expect(messages.data).toHaveLength(2);
  });

  it("emails the actual recipient of a student reply, never the message text", async () => {
    const secretBody = `Hemmelig svar fra student ${randomUUID()}`;
    const reply = await studentClient.rpc("send_message", {
      target_enrollment_id: enrollmentId,
      target_recipient_profile_id: teacherProfileId,
      target_body: secretBody,
    });
    assertNoError(reply.error);

    const [event] = await threadOutboxEvents(teacherProfileId);
    expect(event).toBeDefined();

    const transport = new RecordingTransport();
    await processOutboxOnce({
      client: adminClient,
      transport,
      activationBaseUrl: "https://portal.example/activate",
      portalUrl: "https://portal.example",
    });

    const email = transport.emails.find(
      (candidate) => candidate.correlationId === event.id,
    );
    expect(email).toBeDefined();
    expect(email?.to).toBe(teacherEmail);
    expect(email?.subject).toContain("Trener 3");
    expect(email?.text).toContain("Liv");
    expect(email?.text).toContain("https://portal.example");
    expect(email?.text).not.toContain(secretBody);
    expect(email?.text).not.toContain("Hemmelig");
  });

  it("lets only the recipient mark messages as read", async () => {
    expect(await unreadCountFor(studentProfileId)).toBe(2);

    // Læreren kan ikke kvittere ut studentens uleste meldinger; kallet
    // treffer kun meldinger adressert til læreren selv (svaret = 1).
    const teacherMark = await teacherClient.rpc("mark_messages_read", {
      target_enrollment_id: enrollmentId,
      target_counterpart_profile_id: studentProfileId,
    });
    assertNoError(teacherMark.error);
    expect(teacherMark.data).toBe(1);
    expect(await unreadCountFor(studentProfileId)).toBe(2);

    const studentMark = await studentClient.rpc("mark_messages_read", {
      target_enrollment_id: enrollmentId,
      target_counterpart_profile_id: teacherProfileId,
    });
    assertNoError(studentMark.error);
    expect(studentMark.data).toBe(2);
    expect(await unreadCountFor(studentProfileId)).toBe(0);
  });
});
