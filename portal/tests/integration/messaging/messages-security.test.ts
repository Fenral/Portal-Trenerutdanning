/**
 * N4 uavhengig sikkerhetsreview av Inbox-fasen. Angrep mot ekte lokal
 * database over PostgREST med ekte innloggede sesjoner (JWT per bruker).
 * Regresjonsvern for meldingsgrensen: alle asserts er avvisninger.
 */
import { randomUUID } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { beforeAll, describe, expect, it } from "vitest";

import { processOutboxOnce } from "@/features/notifications/process-outbox";
import type {
  EmailMessage,
  NotificationTransport,
} from "@/features/notifications/transport";

const RUN_T3 = "b1030000-0000-0000-0000-000000000001";
const LIV_T3_LEAD = "c0000000-0000-0000-0000-000000000004";
const LISE_T2_LEAD = "c0000000-0000-0000-0000-000000000003";
const NORA = "c0000000-0000-0000-0000-000000000005";
const EMIL = "c0000000-0000-0000-0000-000000000006";
const SELMA = "c0000000-0000-0000-0000-000000000007";

function loadLocalEnvironment(): void {
  if (!existsSync(".env.local")) return;
  for (const line of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
    const separator = line.indexOf("=");
    if (separator > 0 && !line.startsWith("#")) {
      process.env[line.slice(0, separator)] ??= line.slice(separator + 1);
    }
  }
}

function env(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing env: ${name}`);
  return value;
}

function assertNoError(error: { message: string } | null): void {
  if (error) throw new Error(error.message);
}

class RecordingTransport implements NotificationTransport {
  readonly emails: EmailMessage[] = [];
  async sendEmail(m: EmailMessage) {
    this.emails.push(m);
    return { providerMessageId: `fake:${this.emails.length}` };
  }
  async sendInvitation() {
    return { providerMessageId: "fake-invite" };
  }
}

async function signedIn(email: string): Promise<SupabaseClient> {
  const client = createClient(
    env("NEXT_PUBLIC_SUPABASE_URL"),
    env("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"),
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
        storageKey: `attack-${email}-${randomUUID()}`,
      },
    },
  );
  const { error } = await client.auth.signInWithPassword({
    email,
    password: env("E2E_DEMO_PASSWORD"),
  });
  assertNoError(error);
  return client;
}

let admin: SupabaseClient;
let anon: SupabaseClient;
let liv: SupabaseClient;
let lise: SupabaseClient;
let terje: SupabaseClient;
let ada: SupabaseClient;
let emil: SupabaseClient;
let nora: SupabaseClient;
let emilEnrollment: string;
let noraEnrollment: string;
let selmaEnrollment: string;

async function enrollmentOf(profileId: string): Promise<string> {
  const r = await admin
    .from("enrollments")
    .select("id")
    .eq("course_run_id", RUN_T3)
    .eq("profile_id", profileId)
    .single();
  assertNoError(r.error);
  return (r.data as { id: string }).id;
}

async function unreadFor(profileId: string): Promise<number> {
  const r = await admin
    .from("messages")
    .select("id", { count: "exact", head: true })
    .eq("recipient_profile_id", profileId)
    .is("read_at", null);
  assertNoError(r.error);
  return r.count ?? 0;
}

beforeAll(async () => {
  loadLocalEnvironment();
  admin = createClient(
    env("NEXT_PUBLIC_SUPABASE_URL"),
    env("SUPABASE_SECRET_KEY"),
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
  anon = createClient(
    env("NEXT_PUBLIC_SUPABASE_URL"),
    env("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"),
    { auth: { autoRefreshToken: false, persistSession: false } },
  );

  emilEnrollment = await enrollmentOf(EMIL);
  noraEnrollment = await enrollmentOf(NORA);
  selmaEnrollment = await enrollmentOf(SELMA);

  assertNoError(
    (await admin.from("messages").delete().neq("id", randomUUID())).error,
  );
  assertNoError(
    (
      await admin
        .from("outbox_events")
        .delete()
        .like("idempotency_key", "message_received:%")
    ).error,
  );

  [liv, lise, terje, ada, emil, nora] = await Promise.all([
    signedIn("lead.t3@nivaa.invalid"),
    signedIn("lead.t2@nivaa.invalid"),
    signedIn("teacher.demo@nivaa.invalid"),
    signedIn("admin.demo@nivaa.invalid"),
    signedIn("emil.berg@nivaa.invalid"),
    signedIn("student.demo@nivaa.invalid"),
  ]);
}, 120_000);

describe("N4 angrep: send_message-autorisasjon", () => {
  it("1a: student kan ikke sende til medstudent i samme kurs (egen enrollment)", async () => {
    const r = await emil.rpc("send_message", {
      target_enrollment_id: emilEnrollment,
      target_recipient_profile_id: NORA,
      target_body: "ANGREP 1a",
    });
    expect(r.error?.message).toContain("MESSAGE_FORBIDDEN");
  });

  it("1b: student kan ikke sende via medstudentens enrollment", async () => {
    const r = await emil.rpc("send_message", {
      target_enrollment_id: noraEnrollment,
      target_recipient_profile_id: NORA,
      target_body: "ANGREP 1b",
    });
    expect(r.error?.message).toContain("MESSAGE_FORBIDDEN");
  });

  it("1c: student kan ikke sende til laerer i et annet kurs", async () => {
    const r = await emil.rpc("send_message", {
      target_enrollment_id: emilEnrollment,
      target_recipient_profile_id: LISE_T2_LEAD,
      target_body: "ANGREP 1c",
    });
    expect(r.error?.message).toContain("MESSAGE_FORBIDDEN");
  });

  it("3a: laerer uten rolle i kurset kan ikke sende til deltakeren", async () => {
    const r = await lise.rpc("send_message", {
      target_enrollment_id: emilEnrollment,
      target_recipient_profile_id: EMIL,
      target_body: "ANGREP 3a",
    });
    expect(r.error?.message).toContain("MESSAGE_FORBIDDEN");
  });

  it("3b: template-laerer for annen mal kan ikke sende", async () => {
    const r = await terje.rpc("send_message", {
      target_enrollment_id: emilEnrollment,
      target_recipient_profile_id: EMIL,
      target_body: "ANGREP 3b",
    });
    expect(r.error?.message).toContain("MESSAGE_FORBIDDEN");
  });

  it("3c: administrator kan ikke sende meldinger", async () => {
    const r = await ada.rpc("send_message", {
      target_enrollment_id: emilEnrollment,
      target_recipient_profile_id: EMIL,
      target_body: "ANGREP 3c",
    });
    expect(r.error?.message).toContain("MESSAGE_FORBIDDEN");
  });

  it("5a: laerer kan ikke sette annen mottaker enn enrollmentens deltaker", async () => {
    const r = await liv.rpc("send_message", {
      target_enrollment_id: emilEnrollment,
      target_recipient_profile_id: NORA,
      target_body: "ANGREP 5a",
    });
    expect(r.error?.message).toContain("MESSAGE_FORBIDDEN");
  });

  it("4: laerer kan ikke sende til TRUKKET deltaker", async () => {
    assertNoError(
      (
        await admin
          .from("enrollments")
          .update({ status: "withdrawn" })
          .eq("id", selmaEnrollment)
      ).error,
    );
    const r = await liv.rpc("send_message", {
      target_enrollment_id: selmaEnrollment,
      target_recipient_profile_id: SELMA,
      target_body: "ANGREP 4",
    });
    expect(r.error?.message).toContain("MESSAGE_ENROLLMENT_INACTIVE");

    const stored = await admin
      .from("messages")
      .select("id")
      .eq("enrollment_id", selmaEnrollment);
    assertNoError(stored.error);
    expect(stored.data).toHaveLength(0);

    assertNoError(
      (
        await admin
          .from("enrollments")
          .update({ status: "active" })
          .eq("id", selmaEnrollment)
      ).error,
    );
  });

  it("ingen angrepsmelding ble lagret", async () => {
    const r = await admin.from("messages").select("id,body");
    assertNoError(r.error);
    expect(r.data ?? []).toHaveLength(0);
  });
});

describe("N4 angrep: lesing, read_at og append-only", () => {
  const xssBody = '<script>alert("xss")</script><img src=x onerror=alert(1)>';
  let livToNoraId = "";

  it("setter opp lovlige meldinger", async () => {
    const a = await liv.rpc("send_message", {
      target_enrollment_id: noraEnrollment,
      target_recipient_profile_id: NORA,
      target_body: "HEMMELIG til Nora",
    });
    assertNoError(a.error);
    livToNoraId = a.data as string;

    const b = await liv.rpc("send_message", {
      target_enrollment_id: emilEnrollment,
      target_recipient_profile_id: EMIL,
      target_body: xssBody,
    });
    assertNoError(b.error);
  });

  it("2a: student ser ikke annen students traad (filtrert paa enrollment)", async () => {
    const r = await emil
      .from("messages")
      .select("id,body")
      .eq("enrollment_id", noraEnrollment);
    assertNoError(r.error);
    expect(r.data ?? []).toHaveLength(0);
  });

  it("2b: student ser kun egne meldinger uten filter", async () => {
    const r = await emil
      .from("messages")
      .select("id,body,recipient_profile_id");
    assertNoError(r.error);
    const rows = (r.data ?? []) as { recipient_profile_id: string }[];
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every((row) => row.recipient_profile_id === EMIL)).toBe(true);
    expect(JSON.stringify(rows)).not.toContain("HEMMELIG");
  });

  it("2c: uvedkommende laerer og admin ser ikke traaden", async () => {
    for (const client of [lise, terje, ada]) {
      const r = await client.from("messages").select("id,body");
      assertNoError(r.error);
      expect(r.data ?? []).toHaveLength(0);
    }
  });

  it("2d: anon ser ingenting", async () => {
    const r = await anon.from("messages").select("id");
    expect((r.data ?? []).length === 0 || r.error !== null).toBe(true);
  });

  it("5b: avsender kan ikke sette read_at direkte", async () => {
    const before = await unreadFor(NORA);
    const r = await liv
      .from("messages")
      .update({ read_at: new Date().toISOString() })
      .eq("id", livToNoraId)
      .select();
    expect(r.error !== null || (r.data ?? []).length === 0).toBe(true);
    expect(await unreadFor(NORA)).toBe(before);
  });

  it("5c: avsender kan ikke kvittere ut mottakers meldinger via RPC", async () => {
    const before = await unreadFor(NORA);
    const r = await liv.rpc("mark_messages_read", {
      target_enrollment_id: noraEnrollment,
      target_counterpart_profile_id: NORA,
    });
    assertNoError(r.error);
    expect(r.data).toBe(0);
    expect(await unreadFor(NORA)).toBe(before);
  });

  it("5d: fremmed student kan ikke kvittere ut annens traad", async () => {
    const before = await unreadFor(NORA);
    const r = await emil.rpc("mark_messages_read", {
      target_enrollment_id: noraEnrollment,
      target_counterpart_profile_id: LIV_T3_LEAD,
    });
    assertNoError(r.error);
    expect(r.data).toBe(0);
    expect(await unreadFor(NORA)).toBe(before);
  });

  it("5e: avsender kan ikke endre sender_profile_id eller body", async () => {
    for (const patch of [
      { sender_profile_id: NORA },
      { body: "omskrevet" },
      { recipient_profile_id: EMIL },
    ]) {
      const r = await liv
        .from("messages")
        .update(patch)
        .eq("id", livToNoraId)
        .select();
      expect(r.error !== null || (r.data ?? []).length === 0).toBe(true);
    }
    const row = await admin
      .from("messages")
      .select("sender_profile_id,recipient_profile_id,body")
      .eq("id", livToNoraId)
      .single();
    assertNoError(row.error);
    expect(row.data).toMatchObject({
      sender_profile_id: LIV_T3_LEAD,
      recipient_profile_id: NORA,
      body: "HEMMELIG til Nora",
    });
  });

  it("8: append-only - INSERT og DELETE avvist for alle roller", async () => {
    for (const client of [liv, emil, nora, ada]) {
      const ins = await client.from("messages").insert({
        course_run_id: RUN_T3,
        enrollment_id: emilEnrollment,
        sender_profile_id: LIV_T3_LEAD,
        recipient_profile_id: EMIL,
        body: "direkte insert",
      });
      expect(ins.error).not.toBeNull();

      const del = await client
        .from("messages")
        .delete()
        .eq("id", livToNoraId)
        .select();
      expect(del.error !== null || (del.data ?? []).length === 0).toBe(true);
    }
    const still = await admin
      .from("messages")
      .select("id")
      .eq("id", livToNoraId);
    assertNoError(still.error);
    expect(still.data).toHaveLength(1);
  });

  it("7: XSS-body lagres verbatim og maa escapes i UI", async () => {
    const r = await emil
      .from("messages")
      .select("body")
      .eq("enrollment_id", emilEnrollment)
      .single();
    assertNoError(r.error);
    expect((r.data as { body: string }).body).toBe(xssBody);
  });

  it("6: e-postvarsel inneholder ikke meldingsteksten", async () => {
    const events = await admin
      .from("outbox_events")
      .select("id,payload")
      .like("idempotency_key", "message_received:%");
    assertNoError(events.error);
    expect((events.data ?? []).length).toBeGreaterThan(0);
    for (const event of events.data ?? []) {
      const payload = event.payload as Record<string, unknown>;
      expect(Object.keys(payload).sort()).toEqual([
        "enrollmentId",
        "recipientProfileId",
        "template",
      ]);
      expect(JSON.stringify(payload)).not.toContain("HEMMELIG");
      expect(JSON.stringify(payload)).not.toContain("script");
    }

    const transport = new RecordingTransport();
    await processOutboxOnce({
      client: admin,
      transport,
      activationBaseUrl: "https://portal.example/activate",
      portalUrl: "https://portal.example",
    });
    expect(transport.emails.length).toBeGreaterThan(0);
    const combined = transport.emails
      .map((e) => `${e.subject}\n${e.text}\n${e.to}`)
      .join("\n");
    expect(combined).not.toContain("HEMMELIG");
    expect(combined).not.toContain("<script");
    expect(combined).not.toContain("onerror");

    const noraEmails = transport.emails.filter(
      (e) => e.to === "student.demo@nivaa.invalid",
    );
    expect(noraEmails.length).toBe(1);
  });
});

describe("N4 angrep: uleste-telling lekker ikke", () => {
  it("countUnreadMessages via klient kan ikke telle andres uleste", async () => {
    const r = await emil
      .from("messages")
      .select("id", { count: "exact", head: true })
      .eq("recipient_profile_id", NORA)
      .is("read_at", null);
    assertNoError(r.error);
    expect(r.count ?? 0).toBe(0);
  });
});

describe("N4 angrep: tilbaketrukket laererrolle", () => {
  it("blokkerer sending begge veier etter revoked_at", async () => {
    assertNoError(
      (
        await admin
          .from("role_assignments")
          .update({ revoked_at: new Date().toISOString() })
          .eq("profile_id", LIV_T3_LEAD)
          .eq("course_run_id", RUN_T3)
      ).error,
    );
    try {
      const send = await liv.rpc("send_message", {
        target_enrollment_id: emilEnrollment,
        target_recipient_profile_id: EMIL,
        target_body: "ETTER tilbaketrekking",
      });
      expect(send.error?.message).toContain("MESSAGE_FORBIDDEN");

      const reply = await emil.rpc("send_message", {
        target_enrollment_id: emilEnrollment,
        target_recipient_profile_id: LIV_T3_LEAD,
        target_body: "svar til eks-laerer",
      });
      expect(reply.error?.message).toContain("MESSAGE_FORBIDDEN");
    } finally {
      assertNoError(
        (
          await admin
            .from("role_assignments")
            .update({ revoked_at: null })
            .eq("profile_id", LIV_T3_LEAD)
            .eq("course_run_id", RUN_T3)
        ).error,
      );
    }
  });
});
