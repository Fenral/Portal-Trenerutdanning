import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ContentRenderer } from "@/features/learning/ContentRenderer";

describe("ContentRenderer", () => {
  it("renders allowlisted external content with safe link and frame metadata", () => {
    render(
      <ContentRenderer
        document={{
          locale: "nb-NO",
          format: "short_page",
          blocks: [
            {
              type: "external_link",
              url: "https://www.golfforbundet.no/fagstoff",
              label: "Les mer",
            },
            {
              type: "video",
              provider: "youtube",
              url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
              required: true,
            },
          ],
        }}
      />,
    );

    expect(screen.getByRole("link", { name: /Les mer/ })).toHaveAttribute(
      "rel",
      expect.stringContaining("noopener"),
    );
    expect(screen.getByTitle("Fagvideo fra YouTube")).toHaveAttribute(
      "src",
      "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ",
    );
  });

  it("serves uploaded video through the protected resource route", () => {
    const { container } = render(
      <ContentRenderer
        document={{
          locale: "nb-NO",
          format: "short_page",
          blocks: [
            {
              type: "video",
              provider: "uploaded",
              assetId: "a2300000-0000-0000-0000-000000000001",
              required: true,
            },
          ],
        }}
      />,
    );

    expect(container.querySelector("source")).toHaveAttribute(
      "src",
      "/resources/a2300000-0000-0000-0000-000000000001",
    );
    expect(
      within(container).getByRole("link", {
        name: "Åpne videoen i ny fane",
      }),
    ).toHaveAttribute(
      "href",
      "/resources/a2300000-0000-0000-0000-000000000001",
    );
  });
});
