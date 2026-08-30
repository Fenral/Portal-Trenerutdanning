import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Status } from "@/components/ui/Status";

describe("Status", () => {
  it("never communicates pace with color alone", () => {
    render(<Status tone="warning">Litt bak</Status>);

    const status = screen.getByRole("status", { name: "Litt bak" });
    expect(status).toHaveTextContent("Litt bak");
    expect(status.querySelector("svg")).not.toBeNull();
  });
});
