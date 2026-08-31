import { describe, expect, it, vi } from "vitest";

import { completeActivity } from "@/features/learning/complete-activity";

describe("completeActivity", () => {
  it("records the exact enrollment, activity and bound revision", async () => {
    const record = vi.fn().mockResolvedValue({ completionId: "completion-1" });

    await expect(
      completeActivity(
        {
          enrollmentId: "63000000-0000-0000-0000-000000000001",
          activityId: "a3200000-0000-0000-0000-000000000003",
          contentRevisionId: "a2100000-0000-0000-0000-000000000001",
        },
        { repository: { record } },
      ),
    ).resolves.toEqual({ completionId: "completion-1" });

    expect(record).toHaveBeenCalledWith({
      enrollmentId: "63000000-0000-0000-0000-000000000001",
      activityId: "a3200000-0000-0000-0000-000000000003",
      contentRevisionId: "a2100000-0000-0000-0000-000000000001",
    });
  });

  it("rejects an invalid database identifier before calling the repository", async () => {
    const record = vi.fn();

    await expect(
      completeActivity(
        {
          enrollmentId: "not-an-id",
          activityId: "a3200000-0000-0000-0000-000000000003",
          contentRevisionId: null,
        },
        { repository: { record } },
      ),
    ).rejects.toThrow("Ugyldig fullføringsdata");
    expect(record).not.toHaveBeenCalled();
  });
});
