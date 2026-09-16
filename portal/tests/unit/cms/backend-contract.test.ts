// @vitest-environment node
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: vi.fn(),
}));
vi.mock("@/lib/supabase/admin", () => ({ createSupabaseAdminClient: vi.fn() }));

import { canEditCmsItem, requireCmsStaff } from "@/features/cms/server/auth";
import {
  cmsDownloadDisposition,
  validateCmsAttachment,
} from "@/features/cms/server/attachments";
import { assertCmsQuery, cmsErrorResponse } from "@/features/cms/server/errors";
import type { CmsSession } from "@/features/cms/server/types";
import {
  assertCmsMutationOrigin,
  CreateItemInput,
  PublishItemInput,
  RestoreItemInput,
  SaveItemInput,
} from "@/features/cms/server/validation";

const itemId = "00000000-0000-4000-8000-000000000001";
const otherCourseId = "00000000-0000-4000-8000-000000000002";
const document = {
  locale: "nb-NO",
  format: "short_page",
  blocks: [{ type: "paragraph", text: "Trygt innhold" }],
};

describe("CMS API validation and scope", () => {
  it("requires a concurrency token on every revision mutation", () => {
    expect(SaveItemInput.safeParse({ title: "Tittel", document }).success).toBe(
      false,
    );
    expect(
      PublishItemInput.safeParse({ changeNote: "Publiserer" }).success,
    ).toBe(false);
    expect(RestoreItemInput.safeParse({ revisionId: itemId }).success).toBe(
      false,
    );
    expect(
      SaveItemInput.safeParse({
        title: "Tittel",
        document,
        expectedUpdatedAt: "2026-10-14T09:00:00.000Z",
      }).success,
    ).toBe(true);
  });
  it("rejects attempts to set database ownership or revision status", () => {
    expect(
      CreateItemInput.safeParse({
        title: "Tittel",
        document,
        createdBy: itemId,
      }).success,
    ).toBe(false);
    expect(
      PublishItemInput.safeParse({
        expectedUpdatedAt: "2026-10-14T09:00:00Z",
        changeNote: "Publiserer",
        status: "published",
      }).success,
    ).toBe(false);
  });
  it("does not turn a course teacher into a global editor", () => {
    const teacher = { isGlobalManager: false, courseIds: [itemId] };
    expect(canEditCmsItem(teacher, { courseRunId: null })).toBe(false);
    expect(canEditCmsItem(teacher, { courseRunId: otherCourseId })).toBe(false);
    expect(canEditCmsItem(teacher, { courseRunId: itemId })).toBe(true);
    expect(
      canEditCmsItem(
        { isGlobalManager: true, courseIds: [] },
        { courseRunId: null },
      ),
    ).toBe(true);
    expect(() =>
      requireCmsStaff({
        isGlobalManager: false,
        courseIds: [],
      } as unknown as CmsSession),
    ).toThrow("redigeringstilgang");
  });
  it("rejects cross-origin cookie-authenticated mutations", () => {
    expect(() =>
      assertCmsMutationOrigin(
        new Request("https://portal.example/api/cms/items", {
          headers: { origin: "https://attacker.example" },
        }),
      ),
    ).toThrow("portalen");
    expect(() =>
      assertCmsMutationOrigin(
        new Request("https://portal.example/api/cms/items", {
          headers: { origin: "https://portal.example" },
        }),
      ),
    ).not.toThrow();
  });
  it("returns an actionable conflict without leaking database details", async () => {
    let conflict: unknown;
    try {
      assertCmsQuery({ message: "CMS_CONFLICT", code: "P0001" });
    } catch (error) {
      conflict = error;
    }
    const response = cmsErrorResponse(conflict);
    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({
      error: expect.stringContaining("Last inn siste versjon"),
    });
    expect(
      await cmsErrorResponse(new Error("secret connection string")).text(),
    ).not.toContain("secret");
  });
  it("explains the publication gate without exposing database details", async () => {
    let blocked: unknown;
    try {
      assertCmsQuery({
        message: "CONTENT_PUBLISH_BLOCKED: internal video UUID",
        code: "P0001",
      });
    } catch (error) {
      blocked = error;
    }
    const response = cmsErrorResponse(blocked);
    expect(response.status).toBe(422);
    const body = await response.text();
    expect(body).toContain("undertekster");
    expect(body).not.toContain("internal video UUID");
  });
});

describe("CMS original files", () => {
  it("accepts a PDF with matching filename, MIME and real signature", () => {
    const bytes = new TextEncoder().encode("%PDF-1.7\nOriginal file");
    expect(
      validateCmsAttachment(
        "Øvelse.pdf",
        "application/pdf",
        bytes,
        bytes.length,
      ),
    ).toBe("application/pdf");
    expect(validateCmsAttachment("Øvelse.pdf", "", bytes, bytes.length)).toBe(
      "application/pdf",
    );
  });
  it("rejects executable HTML masquerading as a PDF", () => {
    const bytes = new TextEncoder().encode("<script>alert(1)</script>");
    expect(() =>
      validateCmsAttachment("plan.pdf", "application/pdf", bytes, bytes.length),
    ).toThrow("format");
    expect(() =>
      validateCmsAttachment("plan.html", "text/html", bytes, bytes.length),
    ).toThrow("PDF");
  });
  it("enforces the 20 MB cap and rejects a different declared size", () => {
    const bytes = new TextEncoder().encode("%PDF-1.7");
    expect(() =>
      validateCmsAttachment(
        "plan.pdf",
        "application/pdf",
        bytes,
        21 * 1024 * 1024,
      ),
    ).toThrow("20 MB");
    expect(() =>
      validateCmsAttachment(
        "plan.pdf",
        "application/pdf",
        bytes,
        bytes.length + 1,
      ),
    ).toThrow();
  });
  it("forces download and prevents header injection in filenames", () => {
    const disposition = cmsDownloadDisposition('Øvelse\r\n".pdf');
    expect(disposition).toMatch(/^attachment; filename=/);
    expect(disposition).not.toContain("\r");
    expect(disposition).not.toContain("\n");
    expect(disposition).toContain("filename*=UTF-8''");
  });
});
