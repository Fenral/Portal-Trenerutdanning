import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Button } from "@/components/ui/Button";

describe("Button", () => {
  it("uses one explicit visual priority", () => {
    render(<Button priority="primary">Fortsett modul</Button>);

    expect(
      screen.getByRole("button", { name: "Fortsett modul" }),
    ).toHaveAttribute("data-priority", "primary");
  });
});
