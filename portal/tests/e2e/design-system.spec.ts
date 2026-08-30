import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

const viewports = [
  { name: "mobile", width: 390, height: 844 },
  { name: "desktop", width: 1280, height: 900 },
] as const;

for (const viewport of viewports) {
  test(`design system is usable on ${viewport.name}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.goto("/design-system");

    await expect(
      page.getByRole("heading", { name: "Nivå Klassisk Premium" }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Fortsett modul" }),
    ).toBeVisible();

    const results = await new AxeBuilder({ page }).analyze();
    const seriousFindings = results.violations.filter(
      ({ impact }) => impact === "serious" || impact === "critical",
    );

    expect(seriousFindings).toEqual([]);
  });
}
