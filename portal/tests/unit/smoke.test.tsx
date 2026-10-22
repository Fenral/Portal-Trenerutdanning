import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import Home from "@/app/page";

describe("portal landing page", () => {
  it("presents the demo and exposes the three role entrances", () => {
    render(<Home />);

    expect(
      screen.getByRole("heading", {
        name: "Velg hvordan du vil inn",
      }),
    ).toBeVisible();
    expect(screen.getByText("Norges Golfforbund · Demo")).toBeVisible();
    expect(screen.getByRole("link", { name: /Student/ })).toHaveAttribute(
      "href",
      "/test-login?as=student-selma",
    );
    expect(screen.getByRole("link", { name: /Kurslærer/ })).toHaveAttribute(
      "href",
      "/test-login?as=teacher-t3",
    );
    expect(screen.getByRole("link", { name: /Administrator/ })).toHaveAttribute(
      "href",
      "/test-login?as=admin",
    );
  });
});
