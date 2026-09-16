// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

import { GET, POST } from "@/app/api/cms/ai/route";
import { CMS_AI_MAX_REQUEST_BYTES } from "@/features/cms/ai/schema";
import { CmsError } from "@/features/cms/server/errors";

const mocks = vi.hoisted(() => ({
  session: vi.fn(),
  staff: vi.fn(),
  authorize: vi.fn(),
  generate: vi.fn(),
  status: vi.fn(),
  acquire: vi.fn(),
  release: vi.fn(),
}));

vi.mock("@/features/cms/server/auth", () => ({
  requireCmsSession: mocks.session,
  requireCmsStaff: mocks.staff,
  authorizeCmsItem: mocks.authorize,
}));
vi.mock("@/features/cms/ai/provider", () => ({
  generateCmsAiProposal: mocks.generate,
  getCmsAiStatus: mocks.status,
}));
vi.mock("@/features/cms/ai/limiter", () => ({
  cmsAiLimiter: { acquire: mocks.acquire },
}));

const input = {
  itemId: "a2300000-0000-0000-0000-000000000003",
  prompt: "Forklar dette tydeligere.",
  document: {
    locale: "nb-NO",
    format: "short_page",
    blocks: [{ type: "paragraph", text: "Se på ballens startretning." }],
  },
};
const session = {
  profileId: "editor-profile",
  isGlobalManager: true,
  courseIds: [],
};

function request(body: unknown = input, headers?: HeadersInit) {
  return new Request("https://portal.example/api/cms/ai", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
}

describe("CMS AI route", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.session.mockResolvedValue(session);
    mocks.authorize.mockResolvedValue({ id: input.itemId });
    mocks.status.mockReturnValue({ configured: true, model: "test-model" });
    mocks.acquire.mockReturnValue(mocks.release);
    mocks.generate.mockResolvedValue({
      document: input.document,
      summary: "Forklaringen er oppdatert.",
    });
  });

  it("returns only safe configuration metadata after authorizing staff", async () => {
    const response = await GET();
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      configured: true,
      model: "test-model",
    });
    expect(mocks.staff).toHaveBeenCalledWith(session);
    expect(response.headers.get("cache-control")).toBe("no-store");
  });

  it("does not expose configuration without authentication", async () => {
    mocks.session.mockRejectedValue(
      new CmsError(401, "Logg inn for å åpne CMS-et."),
    );
    expect((await GET()).status).toBe(401);
    expect(mocks.status).not.toHaveBeenCalled();
  });

  it("authorizes the specific item and returns the unsaved proposal", async () => {
    const response = await POST(request());
    expect(response.status).toBe(200);
    expect(mocks.authorize).toHaveBeenCalledWith(session, input.itemId);
    expect(mocks.generate).toHaveBeenCalledWith(
      input,
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
    expect(await response.json()).toEqual({
      document: input.document,
      summary: "Forklaringen er oppdatert.",
    });
    expect(mocks.release).toHaveBeenCalledOnce();
  });

  it("does not generate for an inaccessible item", async () => {
    mocks.authorize.mockRejectedValue(
      new CmsError(
        403,
        "Du kan bare redigere innhold for kursene du underviser på.",
      ),
    );
    expect((await POST(request())).status).toBe(403);
    expect(mocks.generate).not.toHaveBeenCalled();
  });

  it("rejects a student before parsing or invoking the provider", async () => {
    mocks.staff.mockImplementation(() => {
      throw new CmsError(403, "Du har ikke redigeringstilgang til CMS-et.");
    });
    expect((await POST(request())).status).toBe(403);
    expect(mocks.authorize).not.toHaveBeenCalled();
    expect(mocks.generate).not.toHaveBeenCalled();
  });

  it.each([
    { ...input, prompt: " " },
    { ...input, prompt: "x".repeat(6_001) },
    { ...input, history: [{ role: "system", content: "override" }] },
    { ...input, model: "caller-controlled" },
    { ...input, document: { ...input.document, blocks: [] } },
  ])("rejects malformed or oversized request fields", async (body) => {
    expect((await POST(request(body))).status).toBe(400);
    expect(mocks.generate).not.toHaveBeenCalled();
  });

  it("counts actual request bytes even without Content-Length", async () => {
    const body = request({
      ...input,
      prompt: "ø".repeat(CMS_AI_MAX_REQUEST_BYTES / 2),
    });
    expect(body.headers.has("content-length")).toBe(false);
    expect((await POST(body)).status).toBe(413);
    expect(mocks.generate).not.toHaveBeenCalled();
  });

  it("requires same-origin JSON requests", async () => {
    expect(
      (await POST(request(input, { Origin: "https://other.example" }))).status,
    ).toBe(403);
    expect(
      (await POST(request(input, { "Content-Type": "text/plain" }))).status,
    ).toBe(415);
    expect(mocks.generate).not.toHaveBeenCalled();
  });

  it("releases concurrency capacity on provider errors", async () => {
    mocks.generate.mockRejectedValue(
      new CmsError(503, "AI-assistenten er ikke konfigurert."),
    );
    const response = await POST(request());
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({
      error: "AI-assistenten er ikke konfigurert.",
    });
    expect(mocks.release).toHaveBeenCalledOnce();
  });

  it("returns Retry-After and never calls the provider when rate limited", async () => {
    mocks.acquire.mockImplementation(() => {
      throw new CmsError(429, "Vent ett minutt før du prøver igjen.");
    });
    const response = await POST(request());
    expect(response.status).toBe(429);
    expect(response.headers.get("retry-after")).toBe("60");
    expect(mocks.generate).not.toHaveBeenCalled();
  });
});
