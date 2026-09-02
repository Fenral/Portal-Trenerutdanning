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

const environment = vi.hoisted(() => {
  const isE2ETestMode = vi.fn(() => false);
  return {
    getE2EDemoPassword: vi.fn((): string => {
      throw new Error("PASSWORD_MUST_NOT_BE_READ");
    }),
    isE2ETestMode,
    // Speiler den ekte implementasjonen i @/lib/supabase/environment.
    isDemoMode: vi.fn(
      () => isE2ETestMode() || process.env.DEMO_MODE === "true",
    ),
  };
});

vi.mock("next/navigation", () => navigation);
vi.mock("@/lib/supabase/environment", () => environment);
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: serverClient.create,
}));

describe("test-login route in production mode", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
    environment.isE2ETestMode.mockReturnValue(false);
    environment.getE2EDemoPassword.mockImplementation((): string => {
      throw new Error("PASSWORD_MUST_NOT_BE_READ");
    });
  });

  it("returns the not-found path before reading the alias or session", async () => {
    const { GET } = await import("@/app/test-login/route");

    await expect(
      GET(new Request("https://portal.example/test-login?as=admin")),
    ).rejects.toThrow("NEXT_NOT_FOUND");
    expect(navigation.notFound).toHaveBeenCalledOnce();
    expect(serverClient.create).not.toHaveBeenCalled();
  });

  it("allows allowlisted synthetic users in an explicit demo deployment", async () => {
    vi.stubEnv("DEMO_MODE", "true");
    environment.getE2EDemoPassword.mockReturnValue("synthetic-password");
    const signInWithPassword = vi.fn().mockResolvedValue({ error: null });
    serverClient.create.mockResolvedValue({
      auth: { signInWithPassword },
    });
    const { GET } = await import("@/app/test-login/route");

    await GET(new Request("https://portal.example/test-login?as=admin"));

    expect(signInWithPassword).toHaveBeenCalledWith({
      email: "admin.demo@nivaa.invalid",
      password: "synthetic-password",
    });
    expect(navigation.redirect).toHaveBeenCalledWith("/admin/courses");
  });
});
