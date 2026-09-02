import { describe, expect, it } from "vitest";

import { transitionEnrollment } from "@/features/people/enrollment-lifecycle";

describe("enrollment lifecycle", () => {
  it("withdraws an active enrollment", () => {
    expect(transitionEnrollment("active", "withdraw")).toBe("withdrawn");
  });

  it("reopens a withdrawn enrollment back to active", () => {
    expect(transitionEnrollment("withdrawn", "reopen")).toBe("active");
  });

  it("rejects every invalid transition", () => {
    expect(() => transitionEnrollment("invited", "withdraw")).toThrow(
      "Ugyldig overgang",
    );
    expect(() => transitionEnrollment("completed", "withdraw")).toThrow(
      "Ugyldig overgang",
    );
    expect(() => transitionEnrollment("active", "reopen")).toThrow(
      "Ugyldig overgang",
    );
    expect(() => transitionEnrollment("withdrawn", "withdraw")).toThrow(
      "Ugyldig overgang",
    );
    expect(() => transitionEnrollment("completed", "reopen")).toThrow(
      "Ugyldig overgang",
    );
  });
});
