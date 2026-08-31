import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import Home from "@/app/page";

describe("portal shell", () => {
  it("names the service and exposes the three demo roles", () => {
    render(<Home />);

    expect(
      screen.getByRole("heading", { name: "Trenerutdanning" }),
    ).toBeVisible();
    expect(screen.getByRole("link", { name: "Student" })).toHaveAttribute(
      "href",
      "/test-login?as=student-selma",
    );
    expect(screen.getByRole("link", { name: "Lærer" })).toHaveAttribute(
      "href",
      "/test-login?as=teacher-t3",
    );
    expect(screen.getByRole("link", { name: "Administrator" })).toHaveAttribute(
      "href",
      "/test-login?as=admin",
    );
  });
});
