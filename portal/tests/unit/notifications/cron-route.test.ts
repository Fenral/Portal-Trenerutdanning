import { afterEach, describe, expect, it, vi } from "vitest";

import { GET } from "@/app/api/cron/notifications/route";

function request(authorization?: string): Request {
  return new Request("https://portal.example/api/cron/notifications", {
    headers: authorization ? { authorization } : undefined,
  });
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("cron notifications route", () => {
  it("fails loudly with 503 when no cron secret is configured", async () => {
    vi.stubEnv("CRON_SECRET", "");
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const response = await GET(request("Bearer anything"));
    expect(response.status).toBe(503);
    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining("CRON_SECRET"),
    );
    errorSpy.mockRestore();
  });

  it("returns 401 for a wrong bearer token", async () => {
    vi.stubEnv("CRON_SECRET", "correct-secret");
    const response = await GET(request("Bearer wrong-secret"));
    expect(response.status).toBe(401);

    const missingHeader = await GET(request());
    expect(missingHeader.status).toBe(401);
  });

  it("accepts the correct bearer token and proceeds past the auth gate", async () => {
    vi.stubEnv("CRON_SECRET", "correct-secret");
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "");
    await expect(GET(request("Bearer correct-secret"))).rejects.toThrow(
      "NEXT_PUBLIC_APP_URL",
    );
  });
});
