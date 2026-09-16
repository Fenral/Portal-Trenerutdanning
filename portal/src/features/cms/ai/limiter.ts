import { CmsError } from "@/features/cms/server/errors";

type Usage = { startedAt: number; requests: number; active: number };

/**
 * Bounded, per-process abuse/cost guard. Separate server instances have separate
 * counters; a shared rate limiter is required for a deployment-wide quota.
 */
export class CmsAiLimiter {
  private readonly users = new Map<string, Usage>();
  private active = 0;

  constructor(
    private readonly limits = {
      windowMs: 60_000,
      requestsPerWindow: 6,
      concurrentRequests: 4,
      trackedUsers: 1_000,
    },
  ) {}

  acquire(profileId: string, now = Date.now()): () => void {
    for (const [id, usage] of this.users) {
      if (usage.active === 0 && now - usage.startedAt >= this.limits.windowMs) {
        this.users.delete(id);
      }
    }

    const usage = this.users.get(profileId) ?? {
      startedAt: now,
      requests: 0,
      active: 0,
    };
    if (
      this.active >= this.limits.concurrentRequests ||
      usage.active > 0 ||
      usage.requests >= this.limits.requestsPerWindow ||
      (!this.users.has(profileId) &&
        this.users.size >= this.limits.trackedUsers)
    ) {
      throw new CmsError(
        429,
        "AI-assistenten har mange forespørsler. Vent ett minutt før du prøver igjen.",
      );
    }

    usage.requests += 1;
    usage.active += 1;
    this.active += 1;
    this.users.set(profileId, usage);
    let released = false;
    return () => {
      if (released) return;
      released = true;
      usage.active -= 1;
      this.active -= 1;
    };
  }
}

export const cmsAiLimiter = new CmsAiLimiter();
