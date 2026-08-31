import { describe, expect, it, vi } from "vitest";

import { resolveTestLogin } from "@/features/access/test-login";

describe("synthetic test login", () => {
  it("does not read an alias when test mode is disabled", () => {
    const readAlias = vi.fn(() => "admin");

    expect(resolveTestLogin(false, readAlias)).toEqual({ status: "disabled" });
    expect(readAlias).not.toHaveBeenCalled();
  });

  it("accepts only allowlisted synthetic aliases", () => {
    expect(resolveTestLogin(true, () => "admin")).toEqual({
      status: "allowed",
      email: "admin.demo@nivaa.invalid",
      destination: "/admin/courses",
    });
    expect(resolveTestLogin(true, () => "student-emil")).toEqual({
      status: "allowed",
      email: "emil.berg@nivaa.invalid",
      destination: "/student",
    });
    expect(resolveTestLogin(true, () => "unknown")).toEqual({
      status: "invalid",
    });
  });
});
