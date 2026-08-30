import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import Home from "@/app/page";

describe("portal shell", () => {
  it("names the service and exposes the three demo roles", () => {
    render(<Home />);

    expect(
      screen.getByRole("heading", { name: "Trenerutdanning" }),
    ).toBeVisible();
    expect(screen.getByRole("link", { name: "Student" })).toBeVisible();
    expect(screen.getByRole("link", { name: "Lærer" })).toBeVisible();
    expect(screen.getByRole("link", { name: "Administrator" })).toBeVisible();
  });
});
