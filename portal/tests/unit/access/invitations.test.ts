import { describe, expect, it, vi } from "vitest";

import {
  buildInvitationToken,
  createInvitation,
} from "@/features/access/invitations/create-invitation";
import {
  claimInvitation,
  maskEmail,
  normalizeEmail,
  validateInvitationClaim,
} from "@/features/access/invitations/claim-invitation";
import { ConsoleNotificationTransport } from "@/features/notifications/console-transport";
import type {
  InvitationNotification,
  NotificationTransport,
} from "@/features/notifications/transport";

const INVITATION_ID = "10000000-0000-4000-8000-000000000001";
const COURSE_RUN_ID = "20000000-0000-4000-8000-000000000001";
const CREATOR_ID = "30000000-0000-4000-8000-000000000001";
const CORRELATION_ID = "40000000-0000-4000-8000-000000000001";

describe("invitation claim", () => {
  const invitation = {
    normalizedEmail: "nora@example.com",
    expiresAt: new Date("2026-09-02T12:00:00Z"),
    claimedAt: null,
  };

  it("accepts private and internal email addresses case-insensitively", () => {
    expect(normalizeEmail(" Nora@Example.com ")).toBe("nora@example.com");
    expect(normalizeEmail(" Kari@Golfforbundet.no ")).toBe(
      "kari@golfforbundet.no",
    );
    expect(
      validateInvitationClaim(
        invitation,
        " Nora@Example.com ",
        new Date("2026-09-01T12:00:00Z"),
      ),
    ).toEqual({ ok: true });
  });

  it("rejects another email, a claimed invitation and the exact expiry instant", () => {
    expect(
      validateInvitationClaim(
        invitation,
        "other@example.com",
        new Date("2026-09-01T12:00:00Z"),
      ),
    ).toEqual({ ok: false, reason: "email_mismatch" });
    expect(
      validateInvitationClaim(
        { ...invitation, claimedAt: new Date("2026-09-01T09:00:00Z") },
        "nora@example.com",
        new Date("2026-09-01T12:00:00Z"),
      ),
    ).toEqual({ ok: false, reason: "already_claimed" });
    expect(
      validateInvitationClaim(
        invitation,
        "nora@example.com",
        new Date("2026-09-02T12:00:00Z"),
      ),
    ).toEqual({ ok: false, reason: "expired" });
  });

  it("masks the local part without exposing the exact address", () => {
    expect(maskEmail("nora@example.com")).toBe("n***@example.com");
    expect(maskEmail("ab@golfforbundet.no")).toBe("a***@golfforbundet.no");
  });

  it("sends only a hash and correlation id to the transactional claim", async () => {
    const repository = {
      claimByHash: vi.fn().mockResolvedValue({ destination: "/student" }),
    };

    await expect(
      claimInvitation(
        {
          rawToken: "one-time-browser-token",
          authenticatedUserId: "21000000-0000-4000-8000-000000000003",
          authenticatedEmail: " Nora@Example.com ",
          now: new Date("2026-09-01T12:00:00Z"),
          correlationId: CORRELATION_ID,
        },
        { repository },
      ),
    ).resolves.toEqual({ status: "claimed", destination: "/student" });

    expect(repository.claimByHash).toHaveBeenCalledWith({
      tokenHash: expect.stringMatching(/^[a-f0-9]{64}$/),
      correlationId: CORRELATION_ID,
    });
    expect(JSON.stringify(repository.claimByHash.mock.calls)).not.toContain(
      "one-time-browser-token",
    );
    expect(JSON.stringify(repository.claimByHash.mock.calls)).not.toContain(
      "nora@example.com",
    );
  });

  it("maps database rejection to a typed public reason", async () => {
    const repository = {
      claimByHash: vi
        .fn()
        .mockRejectedValue(new Error("INVITATION_EMAIL_MISMATCH")),
    };

    await expect(
      claimInvitation(
        {
          rawToken: "one-time-browser-token",
          authenticatedUserId: "21000000-0000-4000-8000-000000000003",
          authenticatedEmail: "other@example.com",
          now: new Date("2026-09-01T12:00:00Z"),
          correlationId: CORRELATION_ID,
        },
        { repository },
      ),
    ).resolves.toEqual({ status: "rejected", reason: "email_mismatch" });
  });
});

describe("invitation creation", () => {
  it("creates a 256-bit token and stores only its SHA-256 hash", () => {
    const token = buildInvitationToken();

    expect(Buffer.from(token.rawToken, "base64url")).toHaveLength(32);
    expect(token.tokenHash).toMatch(/^[a-f0-9]{64}$/);
    expect(token.tokenHash).not.toContain(token.rawToken);
  });

  it("persists no raw token and marks the outbox delivered after transport succeeds", async () => {
    const rawToken = "test-raw-token-that-must-never-be-persisted";
    const repository = {
      createWithOutbox: vi
        .fn()
        .mockResolvedValue({ invitationId: INVITATION_ID }),
      markDelivered: vi.fn().mockResolvedValue(undefined),
    };
    const transport: NotificationTransport = {
      sendInvitation: vi.fn().mockResolvedValue(undefined),
    };

    await expect(
      createInvitation(
        {
          email: " Nora@Example.com ",
          courseRunId: COURSE_RUN_ID,
          role: "student",
          createdBy: CREATOR_ID,
          expiresAt: new Date("2026-09-02T12:00:00Z"),
          correlationId: CORRELATION_ID,
        },
        {
          repository,
          transport,
          activationBaseUrl: "https://portal.example.no/activate",
          tokenFactory: () => ({ rawToken, tokenHash: "a".repeat(64) }),
        },
      ),
    ).resolves.toEqual({ status: "sent", invitationId: INVITATION_ID });

    const persisted = JSON.stringify(repository.createWithOutbox.mock.calls);
    expect(persisted).not.toContain(rawToken);
    expect(repository.createWithOutbox).toHaveBeenCalledWith(
      expect.objectContaining({
        normalizedEmail: "nora@example.com",
        tokenHash: "a".repeat(64),
      }),
    );
    expect(transport.sendInvitation).toHaveBeenCalledWith(
      expect.objectContaining({
        recipientEmail: "nora@example.com",
        activationUrl: `https://portal.example.no/activate?token=${rawToken}`,
      }),
    );
    expect(repository.markDelivered).toHaveBeenCalledWith(
      INVITATION_ID,
      CORRELATION_ID,
    );
  });
});

describe("console notification transport", () => {
  const notification: InvitationNotification = {
    invitationId: INVITATION_ID,
    recipientEmail: "nora@example.com",
    activationUrl: "https://portal.example.no/activate?token=secret-token",
    correlationId: CORRELATION_ID,
  };

  it("rejects production use", async () => {
    const transport = new ConsoleNotificationTransport({
      runtimeEnvironment: "production",
      write: vi.fn(),
    });

    await expect(transport.sendInvitation(notification)).rejects.toThrow(
      "disabled in production",
    );
  });

  it("logs masked metadata without email, URL or token", async () => {
    const write = vi.fn();
    const transport = new ConsoleNotificationTransport({
      runtimeEnvironment: "test",
      write,
    });

    await transport.sendInvitation(notification);

    const logged = JSON.stringify(write.mock.calls);
    expect(logged).toContain("n***@example.com");
    expect(logged).not.toContain("nora@example.com");
    expect(logged).not.toContain("secret-token");
    expect(logged).not.toContain("https://");
  });
});
