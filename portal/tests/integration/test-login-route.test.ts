import { beforeEach, describe, expect, it, vi } from "vitest";

const navigation = vi.hoisted(() => ({
  notFound: vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  }),
  redirect: vi.fn(),
}));

const serverClient = vi.hoisted(() => ({
  create: vi.fn(),
}));

vi.mock("next/navigation", () => navigation);
vi.mock("@/lib/supabase/environment", () => ({
  getE2EDemoPassword: vi.fn(() => {
    throw new Error("PASSWORD_MUST_NOT_BE_READ");
  }),
  isE2ETestMode: vi.fn(() => false),
}));
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: serverClient.create,
}));

describe("test-login route in production mode", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns the not-found path before reading the alias or session", async () => {
    const { GET } = await import("@/app/test-login/route");

    await expect(
      GET(new Request("https://portal.example/test-login?as=admin")),
    ).rejects.toThrow("NEXT_NOT_FOUND");
    expect(navigation.notFound).toHaveBeenCalledOnce();
    expect(serverClient.create).not.toHaveBeenCalled();
  });
});
