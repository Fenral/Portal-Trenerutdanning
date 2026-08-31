import { describe, expect, it } from "vitest";

import { updateDraftDocument } from "@/features/content/update-draft";

const document = {
  locale: "nb-NO" as const,
  format: "short_page" as const,
  blocks: [
    { type: "heading" as const, level: 2 as const, text: "Ballfluktslover" },
    {
      type: "paragraph" as const,
      text: "Ballens startretning påvirkes av køllebladet.",
    },
    {
      type: "video" as const,
      provider: "trackman" as const,
      url: "https://ondemand.trackmangolf.com/example",
      required: true,
    },
  ],
};

describe("updateDraftDocument", () => {
  it("updates editable text while preserving the remaining structured blocks", () => {
    const result = updateDraftDocument({
      currentDocument: document,
      heading: " Ballens startretning ",
      introduction: " Ny og tydelig forklaring. ",
      format: "scroll_story",
    });

    expect(result).toMatchObject({
      locale: "nb-NO",
      format: "scroll_story",
      blocks: [
        { type: "heading", text: "Ballens startretning" },
        { type: "paragraph", text: "Ny og tydelig forklaring." },
        {
          type: "video",
          provider: "trackman",
          url: "https://ondemand.trackmangolf.com/example",
        },
      ],
    });
  });

  it("rejects an invalid current document instead of persisting it", () => {
    expect(() =>
      updateDraftDocument({
        currentDocument: {
          locale: "nb-NO",
          format: "short_page",
          blocks: [{ type: "html", value: "<script>alert(1)</script>" }],
        },
        heading: "Trygg tittel",
        introduction: "Trygg ingress",
        format: "short_page",
      }),
    ).toThrow();
  });

  it("requires an editable heading and paragraph", () => {
    expect(() =>
      updateDraftDocument({
        currentDocument: {
          locale: "nb-NO",
          format: "short_page",
          blocks: [
            {
              type: "video",
              provider: "trackman",
              url: "https://ondemand.trackmangolf.com/example",
              required: true,
            },
          ],
        },
        heading: "Tittel",
        introduction: "Ingress",
        format: "short_page",
      }),
    ).toThrow("Kladden mangler redigerbar tittel eller ingress");
  });
});
