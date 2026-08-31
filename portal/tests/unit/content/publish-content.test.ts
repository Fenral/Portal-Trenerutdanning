import { describe, expect, it } from "vitest";

import { planPublication } from "@/features/content/publish-content";

describe("planPublication", () => {
  it("requires an explicit change note and creates a new immutable revision", () => {
    expect(
      planPublication({
        currentRevision: 2,
        changeNote: " Oppdatert illustrasjon ",
        hasDraft: true,
      }),
    ).toEqual({
      nextRevision: 3,
      supersedeRevision: 2,
      changeNote: "Oppdatert illustrasjon",
    });
  });

  it("rejects publish without a draft", () => {
    expect(() =>
      planPublication({
        currentRevision: 2,
        changeNote: "Ingen endring",
        hasDraft: false,
      }),
    ).toThrow("Ingen kladd å publisere");
  });

  it("rejects a blank or unhelpful change note", () => {
    expect(() =>
      planPublication({
        currentRevision: null,
        changeNote: "  x ",
        hasDraft: true,
      }),
    ).toThrow("Endringsnotat er påkrevd");
  });
});
