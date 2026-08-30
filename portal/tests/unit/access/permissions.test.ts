import { describe, expect, it } from "vitest";

import { AuthorizationError, authorize } from "@/features/access/authorize";
import { can } from "@/features/access/permissions";

describe("permission matrix", () => {
  it("keeps AI and account merge administrator-only", () => {
    expect(can("administrator", "admin_query.run")).toBe(true);
    expect(can("administrator", "account.merge")).toBe(true);
    expect(can("course_lead", "admin_query.run")).toBe(false);
    expect(can("editor", "account.merge")).toBe(false);
  });

  it("allows course lead, but not teacher, to withdraw enrollment", () => {
    expect(can("course_lead", "enrollment.withdraw")).toBe(true);
    expect(can("course_teacher", "enrollment.withdraw")).toBe(false);
  });

  it("authorizes when any assigned role grants the permission", () => {
    expect(() =>
      authorize(["course_teacher", "editor"], "content.publish"),
    ).not.toThrow();

    expect(() => authorize(["course_teacher"], "enrollment.withdraw")).toThrow(
      AuthorizationError,
    );
  });
});
