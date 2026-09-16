import { afterEach, describe, expect, it, vi } from "vitest";

import { getApplicationUrl, isE2ETestMode } from "@/lib/supabase/environment";

describe("E2E environment guard", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("can be enabled outside production", () => {
    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv("E2E_TEST_MODE", "true");

    expect(isE2ETestMode()).toBe(true);
  });

  it("stays disabled in production even if the flag is set", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("E2E_TEST_MODE", "true");

    expect(isE2ETestMode()).toBe(false);
  });

  it("keeps activation callbacks on the preview deployment", () => {
    vi.stubEnv("VERCEL_ENV", "preview");
    vi.stubEnv("VERCEL_URL", "cms-preview.vercel.app");
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://production.example");
    expect(getApplicationUrl()).toBe("https://cms-preview.vercel.app");
    vi.stubEnv("VERCEL_ENV", "production");
    expect(getApplicationUrl()).toBe("https://production.example");
  });
});
