import { afterEach, describe, expect, it, vi } from "vitest";

import { isE2ETestMode } from "@/lib/supabase/environment";

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
});
