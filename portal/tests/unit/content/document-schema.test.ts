import { describe, expect, it } from "vitest";

import { ContentDocument } from "@/features/content/document-schema";

describe("ContentDocument", () => {
  it("accepts structured Bokmål content and a permitted Trackman embed", () => {
    const result = ContentDocument.parse({
      locale: "nb-NO",
      format: "short_page",
      blocks: [
        { type: "heading", level: 2, text: "Ballfluktslover" },
        {
          type: "paragraph",
          text: "Ballens startretning påvirkes først og fremst av køllebladet.",
        },
        {
          type: "video",
          provider: "trackman",
          url: "https://ondemand.trackmangolf.com/example",
          required: true,
        },
      ],
    });

    expect(result.blocks).toHaveLength(3);
  });

  it("accepts a reusable scroll sequence with a stable mobile fallback", () => {
    const result = ContentDocument.parse({
      locale: "nb-NO",
      format: "scroll_story",
      blocks: [
        {
          type: "interactive_sequence",
          desktopMode: "scroll",
          mobileMode: "stacked",
          steps: [
            {
              id: "startretning",
              title: "Startretning",
              text: "Køllebladet påvirker startretningen.",
            },
            {
              id: "kurve",
              title: "Kurve",
              text: "Forholdet mellom blad og svingbane påvirker kurven.",
            },
          ],
        },
      ],
    });

    expect(result.format).toBe("scroll_story");
    expect(result.blocks[0]).toMatchObject({ mobileMode: "stacked" });
  });

  it("rejects arbitrary HTML and unsupported locales", () => {
    expect(() =>
      ContentDocument.parse({
        locale: "en-US",
        format: "short_page",
        blocks: [{ type: "html", value: "<script>alert('xss')</script>" }],
      }),
    ).toThrow();
  });

  it("rejects provider labels that do not match the video host", () => {
    expect(() =>
      ContentDocument.parse({
        locale: "nb-NO",
        format: "short_page",
        blocks: [
          {
            type: "video",
            provider: "trackman",
            url: "https://example.com/not-trackman",
            required: false,
          },
        ],
      }),
    ).toThrow();
  });
});
