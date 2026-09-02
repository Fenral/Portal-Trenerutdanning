/** B3 a11y-blocker: sendt-bekreftelse må annonseres via fokus og rydde ?notice. */
import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ThreadNotice } from "@/components/ui/ThreadNotice";

describe("ThreadNotice", () => {
  it("flytter fokus til notisen ved mount", () => {
    const { getByText } = render(
      <ThreadNotice text="Meldingen er sendt." tone="ok" />,
    );
    const notice = getByText("Meldingen er sendt.").closest("p");
    expect(notice).not.toBeNull();
    expect(document.activeElement).toBe(notice);
  });

  it("skjuler statusglyfen for skjermlesere", () => {
    const { container } = render(
      <ThreadNotice text="Meldingen kunne ikke sendes." tone="error" />,
    );
    const glyph = container.querySelector("span[aria-hidden='true']");
    expect(glyph?.textContent).toBe("✕");
  });

  it("fjerner ?notice fra URL-en slik at refresh ikke gjenannonserer", () => {
    window.history.replaceState(
      null,
      "",
      "/student/messages/e1/t1?notice=message-sent",
    );
    render(<ThreadNotice text="Meldingen er sendt." tone="ok" />);
    expect(window.location.search).not.toContain("notice");
  });
});
