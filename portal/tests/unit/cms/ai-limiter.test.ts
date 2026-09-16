// @vitest-environment node
import { describe, expect, it } from "vitest";

import { CmsAiLimiter } from "@/features/cms/ai/limiter";

describe("CMS AI in-process limits", () => {
  it("allows only one active request per user and releases idempotently", () => {
    const limiter = new CmsAiLimiter();
    const release = limiter.acquire("editor", 0);
    expect(() => limiter.acquire("editor", 1)).toThrow("Vent ett minutt");
    release();
    release();
    expect(() => limiter.acquire("editor", 2)).not.toThrow();
  });

  it("bounds total concurrent generation across users", () => {
    const limiter = new CmsAiLimiter();
    const releases = ["a", "b", "c", "d"].map((id) => limiter.acquire(id, 0));
    expect(() => limiter.acquire("e", 1)).toThrow();
    releases[0]();
    expect(() => limiter.acquire("e", 2)).not.toThrow();
  });

  it("limits repeated requests and expires inactive counters", () => {
    const limiter = new CmsAiLimiter();
    for (let i = 0; i < 6; i++) limiter.acquire("editor", i)();
    expect(() => limiter.acquire("editor", 10)).toThrow();
    expect(() => limiter.acquire("editor", 60_000)).not.toThrow();
  });

  it("bounds tracked user memory without evicting active jobs", () => {
    const limiter = new CmsAiLimiter({
      windowMs: 60_000,
      requestsPerWindow: 6,
      concurrentRequests: 4,
      trackedUsers: 2,
    });
    const release = limiter.acquire("active", 0);
    limiter.acquire("inactive", 0)();
    expect(() => limiter.acquire("new-user", 1)).toThrow();
    expect(() => limiter.acquire("new-user", 60_000)).not.toThrow();
    expect(() => limiter.acquire("active", 60_000)).toThrow();
    release();
  });
});
