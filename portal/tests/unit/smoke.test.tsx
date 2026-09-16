import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import Home from "@/app/page";

const mocks = vi.hoisted(() => ({
  isDemoMode: vi.fn(),
  requireCmsSession: vi.fn(),
}));

vi.mock("@/features/cms/server/auth", () => ({
  requireCmsSession: mocks.requireCmsSession,
}));

vi.mock("@/lib/supabase/environment", () => ({
  isDemoMode: mocks.isDemoMode,
}));

describe("portal shell", () => {
  beforeEach(() => {
    mocks.isDemoMode.mockReturnValue(false);
    mocks.requireCmsSession.mockResolvedValue(null);
  });

  it("shows the login entry and hides demo roles outside demo mode", async () => {
    render(await Home());

    expect(
      screen.getByRole("heading", {
        name: "Pensum som er klart for trenerhverdagen.",
      }),
    ).toBeVisible();
    expect(screen.getByRole("link", { name: "Logg inn" })).toHaveAttribute(
      "href",
      "/login",
    );
    expect(
      screen.queryByRole("navigation", { name: "Demo-roller" }),
    ).toBeNull();
  });

  it("opens the studio for CMS staff and exposes demo roles in demo mode", async () => {
    mocks.isDemoMode.mockReturnValue(true);
    mocks.requireCmsSession.mockResolvedValue({
      isGlobalManager: true,
      courseIds: [],
    });

    render(await Home());

    expect(
      screen.getByRole("link", { name: "Åpne Pensumverkstedet" }),
    ).toHaveAttribute("href", "/editor/studio");
    expect(screen.getByRole("link", { name: "Student" })).toHaveAttribute(
      "href",
      "/test-login?as=student-selma",
    );
    expect(screen.getByRole("link", { name: "Kurslærer" })).toHaveAttribute(
      "href",
      "/test-login?as=teacher-t3",
    );
    expect(screen.getByRole("link", { name: "Administrator" })).toHaveAttribute(
      "href",
      "/test-login?as=admin",
    );
  });
});
