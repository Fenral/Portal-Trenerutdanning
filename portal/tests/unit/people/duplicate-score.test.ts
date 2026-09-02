import { describe, expect, it } from "vitest";

import {
  ANONYMIZED_EMAIL_SUFFIX,
  DUPLICATE_THRESHOLD,
  duplicateCandidates,
  duplicateScore,
  duplicateSignals,
  normalizeEmailLocalPart,
  normalizeName,
  normalizePhone,
  suggestDuplicates,
} from "@/features/people/duplicate-score";

describe("normalization", () => {
  it("normalizes Norwegian names with NFKC, case and middle-name variants", () => {
    expect(normalizeName("Nora Vik")).toBe("nora vik");
    expect(normalizeName("  NORA K. VIK ")).toBe("nora vik");
    expect(normalizeName("Åse-Marie Ødegård")).toBe("åse-marie ødegård");
    // NFKC: full-width and composed forms collapse to the same string.
    expect(normalizeName("Ｎｏｒａ Ｖｉｋ")).toBe("nora vik");
  });

  it("keeps different last names apart", () => {
    expect(normalizeName("Nora Vik")).not.toBe(normalizeName("Nora Viken"));
  });

  it("normalizes phone numbers to E.164 with Norwegian default", () => {
    expect(normalizePhone("90000101")).toBe("+4790000101");
    expect(normalizePhone("+47 900 00 101")).toBe("+4790000101");
    expect(normalizePhone("0047 90 00 01 01")).toBe("+4790000101");
    expect(normalizePhone(null)).toBeNull();
    expect(normalizePhone("  ")).toBeNull();
  });

  it("normalizes email local parts", () => {
    expect(normalizeEmailLocalPart("Nora.K@Example.COM")).toBe("nora.k");
    expect(normalizeEmailLocalPart(null)).toBeNull();
  });
});

describe("duplicate score", () => {
  const nora = {
    name: "Nora Vik",
    club: "Fjordglimt GK",
    email: "nora@example.com",
    phone: "90000101",
  };

  it("scores name + club + phone at or above the threshold", () => {
    expect(
      duplicateScore(nora, {
        name: "Nora K Vik",
        club: "Fjordglimt GK",
        email: "nora.k@example.com",
        phone: "90000101",
      }),
    ).toBeGreaterThanOrEqual(DUPLICATE_THRESHOLD);
  });

  it("rejects a similar name alone", () => {
    expect(
      duplicateScore(
        {
          name: "Nora Vik",
          club: "Fjordglimt GK",
          email: "a@example.com",
          phone: null,
        },
        {
          name: "Nora Viken",
          club: "Annen GK",
          email: "b@example.com",
          phone: null,
        },
      ),
    ).toBeLessThan(DUPLICATE_THRESHOLD);
  });

  it("requires at least two signals: identical name alone stays below threshold", () => {
    expect(
      duplicateScore(
        {
          name: "Nora Vik",
          club: "Klubb A",
          email: "a@example.com",
          phone: "90000101",
        },
        {
          name: "Nora Vik",
          club: "Klubb B",
          email: "b@example.com",
          phone: "45000000",
        },
      ),
    ).toBeLessThan(DUPLICATE_THRESHOLD);
  });

  it("treats matching email local parts as a signal", () => {
    expect(
      duplicateScore(
        {
          name: "Nora Vik",
          club: null,
          email: "nora.vik@gmail.com",
          phone: null,
        },
        {
          name: "Nora K Vik",
          club: null,
          email: "nora.vik@klubb.no",
          phone: null,
        },
      ),
    ).toBeGreaterThanOrEqual(DUPLICATE_THRESHOLD);
  });

  it("lists the matched signals", () => {
    expect(
      duplicateSignals(nora, {
        name: "Nora K Vik",
        club: "Fjordglimt GK",
        email: "x@example.com",
        phone: "+47 900 00 101",
      }),
    ).toEqual(["navn", "klubb", "telefon"]);
  });
});

describe("suggestDuplicates", () => {
  it("scores all profile pairs and returns only pairs at or above threshold", () => {
    const suggestions = suggestDuplicates([
      {
        id: "p1",
        name: "Nora Vik",
        club: "Fjordglimt GK",
        email: "nora@example.com",
        phone: "90000101",
      },
      {
        id: "p2",
        name: "Nora K Vik",
        club: "Fjordglimt GK",
        email: "nora.k@example.com",
        phone: "90000101",
      },
      {
        id: "p3",
        name: "Nora Viken",
        club: "Annen GK",
        email: "b@example.com",
        phone: null,
      },
    ]);

    expect(suggestions).toHaveLength(1);
    expect(suggestions[0]).toMatchObject({
      aId: "p1",
      bId: "p2",
      signals: ["navn", "klubb", "telefon"],
    });
    expect(suggestions[0]?.score).toBeGreaterThanOrEqual(DUPLICATE_THRESHOLD);
  });
});

describe("duplicateCandidates", () => {
  it("filters out anonymized profiles and active merge sources", () => {
    const row = (id: string, email: string) => ({
      id,
      display_name: "Nora Vik",
      normalized_email: email,
      club_name: "Fjordglimt GK",
      phone: "90000101",
    });

    const candidates = duplicateCandidates(
      [
        row("p1", "nora@example.com"),
        row("p2", `anonymisert-p2${ANONYMIZED_EMAIL_SUFFIX}`),
        row("p3", "nora.k@example.com"),
      ],
      new Set(["p3"]),
    );

    expect(candidates).toEqual([
      {
        id: "p1",
        name: "Nora Vik",
        club: "Fjordglimt GK",
        email: "nora@example.com",
        phone: "90000101",
      },
    ]);
  });
});
