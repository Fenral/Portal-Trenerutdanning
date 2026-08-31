import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { CertificateCelebration } from "@/features/completion/CertificateCelebration";

describe("CertificateCelebration", () => {
  beforeEach(() => {
    localStorage.clear();
    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      value: vi.fn().mockReturnValue({
        matches: false,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      }),
    });
    Object.defineProperty(navigator, "vibrate", {
      configurable: true,
      value: vi.fn(),
    });
  });

  it("announces completion and starts haptics only after the student's action", () => {
    render(
      <CertificateCelebration
        certificateId="certificate-1"
        displayName="Selma Dahl"
      />,
    );

    expect(screen.getByRole("status")).toHaveTextContent(
      "Gratulerer, Selma Dahl!",
    );
    expect(navigator.vibrate).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Feir fullføringen" }));

    expect(navigator.vibrate).toHaveBeenCalledWith(50);
    expect(screen.getByTestId("certificate-celebration")).toHaveAttribute(
      "data-celebrated",
      "true",
    );
    expect(localStorage.getItem("certificate-celebrated:certificate-1")).toBe(
      "true",
    );
  });

  it("does not offer the same confetti celebration twice", () => {
    localStorage.setItem("certificate-celebrated:certificate-1", "true");
    render(
      <CertificateCelebration
        certificateId="certificate-1"
        displayName="Selma Dahl"
      />,
    );

    expect(
      screen.queryByRole("button", { name: "Feir fullføringen" }),
    ).not.toBeInTheDocument();
    expect(navigator.vibrate).not.toHaveBeenCalled();
  });
});
