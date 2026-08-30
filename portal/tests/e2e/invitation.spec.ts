import { createHash, randomBytes, randomUUID } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";

import { expect, test } from "@playwright/test";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { createInvitation } from "../../src/features/access/invitations/create-invitation";
import type {
  InvitationNotification,
  NotificationTransport,
} from "../../src/features/notifications/transport";

test.describe.configure({ mode: "serial" });

type CourseFixture = Readonly<{
  adminClient: SupabaseClient;
  callerClient: SupabaseClient;
  courseRunId: string;
  creatorProfileId: string;
}>;

function loadLocalEnvironment(): void {
  const path = ".env.local";

  if (!existsSync(path)) {
    return;
  }

  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const separator = line.indexOf("=");

    if (separator < 1 || line.startsWith("#")) {
      continue;
    }

    const name = line.slice(0, separator);
    const value = line.slice(separator + 1);
    process.env[name] ??= value;
  }
}

function requiredEnvironment(name: string): string {
  const value = process.env[name];

  if (!value) {
    throw new Error("Missing E2E environment variable: " + name);
  }

  return value;
}

function assertNoSupabaseError(error: { message: string } | null): void {
  if (error) {
    throw new Error(error.message);
  }
}

class CaptureNotificationTransport implements NotificationTransport {
  notification: InvitationNotification | null = null;

  async sendInvitation(notification: InvitationNotification): Promise<void> {
    this.notification = notification;
  }
}

async function createCourseFixture(): Promise<CourseFixture> {
  loadLocalEnvironment();
  const url = requiredEnvironment("NEXT_PUBLIC_SUPABASE_URL");
  const publishableKey = requiredEnvironment(
    "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
  );
  const secretKey = requiredEnvironment("SUPABASE_SECRET_KEY");
  const adminClient = createClient(url, secretKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const suffix = randomUUID().slice(0, 8);
  const adminEmail = "invite-admin-" + suffix + "@example.invalid";
  const password = "Portal-test-" + randomUUID();
  const creatorProfileId = randomUUID();
  const templateId = randomUUID();
  const courseRunId = randomUUID();
  const { data: authData, error: authError } =
    await adminClient.auth.admin.createUser({
      email: adminEmail,
      password,
      email_confirm: true,
      user_metadata: { full_name: "Invitasjon Admin" },
    });
  assertNoSupabaseError(authError);

  if (!authData.user) {
    throw new Error("Admin fixture user was not created");
  }

  assertNoSupabaseError(
    (
      await adminClient.from("profiles").insert({
        id: creatorProfileId,
        display_name: "Invitasjon Admin",
        normalized_email: adminEmail,
      })
    ).error,
  );
  assertNoSupabaseError(
    (
      await adminClient.from("user_accounts").insert({
        user_id: authData.user.id,
        profile_id: creatorProfileId,
        normalized_email: adminEmail,
      })
    ).error,
  );
  assertNoSupabaseError(
    (
      await adminClient.from("course_templates").insert({
        id: templateId,
        code: "E2E_" + suffix.toUpperCase(),
        title: "E2E invitasjon",
        level: 1,
      })
    ).error,
  );
  assertNoSupabaseError(
    (
      await adminClient.from("course_runs").insert({
        id: courseRunId,
        template_id: templateId,
        title: "E2E invitasjonskull",
        start_year: 2027,
        starts_on: "2027-02-03",
        ends_on: "2027-12-20",
        status: "active",
      })
    ).error,
  );
  assertNoSupabaseError(
    (
      await adminClient.from("role_assignments").insert({
        profile_id: creatorProfileId,
        role: "administrator",
        granted_by: creatorProfileId,
      })
    ).error,
  );

  const callerClient = createClient(url, publishableKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { error: signInError } = await callerClient.auth.signInWithPassword({
    email: adminEmail,
    password,
  });
  assertNoSupabaseError(signInError);

  return {
    adminClient,
    callerClient,
    courseRunId,
    creatorProfileId,
  };
}

async function createCourseInvitation(
  fixture: CourseFixture,
  email: string,
): Promise<Readonly<{ activationUrl: string; invitationId: string }>> {
  const transport = new CaptureNotificationTransport();
  const repository = {
    async createWithOutbox(
      invitation: Parameters<
        Parameters<typeof createInvitation>[1]["repository"]["createWithOutbox"]
      >[0],
    ) {
      const { data, error } = await fixture.callerClient.rpc(
        "create_course_invitation",
        {
          target_course_run_id: invitation.courseRunId,
          target_email: invitation.normalizedEmail,
          target_role: invitation.role,
          target_token_hash: invitation.tokenHash,
          target_expires_at: invitation.expiresAt.toISOString(),
          target_correlation_id: invitation.correlationId,
        },
      );
      assertNoSupabaseError(error);
      return { invitationId: data as string };
    },
    async markDelivered(invitationId: string, correlationId: string) {
      const { error } = await fixture.adminClient.rpc(
        "mark_invitation_delivery",
        {
          delivery_invitation_id: invitationId,
          delivery_correlation_id: correlationId,
        },
      );
      assertNoSupabaseError(error);
    },
  };
  const result = await createInvitation(
    {
      email,
      courseRunId: fixture.courseRunId,
      role: "student",
      createdBy: fixture.creatorProfileId,
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      correlationId: randomUUID(),
    },
    {
      repository,
      transport,
      activationBaseUrl: "http://127.0.0.1:3100/activate",
    },
  );

  if (!transport.notification) {
    throw new Error("Invitation notification was not captured");
  }

  return {
    activationUrl: transport.notification.activationUrl,
    invitationId: result.invitationId,
  };
}

type MailpitMessage = Readonly<{
  ID: string;
  To: ReadonlyArray<Readonly<{ Address: string }>>;
}>;

async function waitForMagicLink(email: string): Promise<string> {
  const deadline = Date.now() + 15_000;

  while (Date.now() < deadline) {
    const listResponse = await fetch("http://127.0.0.1:54324/api/v1/messages");
    const list = (await listResponse.json()) as {
      messages?: MailpitMessage[];
    };
    const message = list.messages?.find((candidate) =>
      candidate.To.some(
        (recipient) => recipient.Address.toLowerCase() === email.toLowerCase(),
      ),
    );

    if (message) {
      const messageResponse = await fetch(
        "http://127.0.0.1:54324/api/v1/message/" + message.ID,
      );
      const detail = (await messageResponse.json()) as {
        HTML?: string;
        Text?: string;
      };
      const content = detail.HTML ?? detail.Text ?? "";
      const match = content.match(/https?:\/\/[^"' <]+/);

      if (match) {
        return match[0].replaceAll("&amp;", "&");
      }
    }

    await new Promise((resolve) => setTimeout(resolve, 250));
  }

  throw new Error("Magic link email was not received");
}

async function expectSingleEnrollment(
  fixture: CourseFixture,
  email: string,
): Promise<void> {
  const { data: profiles, error: profileError } = await fixture.adminClient
    .from("profiles")
    .select("id")
    .eq("normalized_email", email.toLowerCase());
  assertNoSupabaseError(profileError);
  expect(profiles).toHaveLength(1);

  const { data: enrollments, error: enrollmentError } =
    await fixture.adminClient
      .from("enrollments")
      .select("id,status")
      .eq("course_run_id", fixture.courseRunId)
      .eq("profile_id", profiles?.[0]?.id);
  assertNoSupabaseError(enrollmentError);
  expect(enrollments).toEqual([expect.objectContaining({ status: "active" })]);
}

test("private email completes passwordless activation exactly once", async ({
  page,
}) => {
  const fixture = await createCourseFixture();
  const email = "nora-" + randomUUID().slice(0, 8) + "@gmail.com";
  const invitation = await createCourseInvitation(fixture, email);

  await page.goto(invitation.activationUrl);
  await expect(
    page.getByRole("heading", { name: "Aktiver tilgangen din" }),
  ).toBeVisible();
  await expect(page.getByText(/^n\*\*\*@gmail\.com$/)).toBeVisible();
  await expect(page.getByRole("textbox")).toHaveCount(0);
  await page.getByRole("button", { name: "Send innloggingslenke" }).click();
  await expect(
    page.getByRole("heading", { name: "Sjekk e-posten din" }),
  ).toBeVisible();
  const invitationCookie = (await page.context().cookies()).find(
    (cookie) => cookie.name === "nivaa_invitation_token",
  );
  expect(invitationCookie).toMatchObject({
    httpOnly: true,
    sameSite: "Lax",
  });

  const magicLink = await waitForMagicLink(email);
  await page.goto(magicLink);
  await expect(page).toHaveURL(/\/student$/);
  await expect(
    page.getByRole("heading", { name: "Tilgangen er aktivert" }),
  ).toBeVisible();
  expect(
    (await page.context().cookies()).some(
      (cookie) => cookie.name === "nivaa_invitation_token",
    ),
  ).toBe(false);
  await expectSingleEnrollment(fixture, email);

  await page.goto(invitation.activationUrl);
  await expect(page.getByText(/Invitasjonen er allerede brukt/)).toBeVisible();
});

test("internal email is accepted and an expired link stays blocked", async ({
  page,
}) => {
  const fixture = await createCourseFixture();
  const email = "kari-" + randomUUID().slice(0, 8) + "@golfforbundet.no";
  const invitation = await createCourseInvitation(fixture, email);

  await page.goto(invitation.activationUrl);
  await expect(
    page.getByRole("heading", { name: "Aktiver tilgangen din" }),
  ).toBeVisible();
  await expect(page.getByText(/^k\*\*\*@golfforbundet\.no$/)).toBeVisible();

  const rawExpiredToken = randomBytes(32).toString("base64url");
  const tokenHash = createHash("sha256")
    .update(rawExpiredToken, "utf8")
    .digest("hex");
  const { error } = await fixture.adminClient.from("invitations").insert({
    normalized_email: email,
    token_hash: tokenHash,
    course_run_id: fixture.courseRunId,
    role: "student",
    expires_at: new Date(Date.now() - 60 * 1000).toISOString(),
    created_at: new Date(Date.now() - 2 * 60 * 1000).toISOString(),
    created_by: fixture.creatorProfileId,
  });
  assertNoSupabaseError(error);

  await page.goto("http://127.0.0.1:3100/activate?token=" + rawExpiredToken);
  await expect(page.getByText(/har utløpt/)).toBeVisible();
  await page.reload();
  await expect(page.getByText(/har utløpt/)).toBeVisible();
});
