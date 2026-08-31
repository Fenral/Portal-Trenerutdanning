import { readFile } from "node:fs/promises";

import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test("administrator downloads the generated NIF workbook", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/test-login?as=admin");
  await page.goto("/admin/reports");

  await expect(
    page.getByRole("heading", { name: "NIF-årsrapport" }),
  ).toBeVisible();
  await expect(page.getByRole("link", { name: "Rapporter" })).toHaveAttribute(
    "aria-current",
    "page",
  );

  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("link", { name: "Last ned NIF-rapport" }).last().click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/^nif-rapport-.+-\d{4}\.xlsx$/);
  const downloadPath = await download.path();
  if (!downloadPath) throw new Error("NIF report download path missing");
  const bytes = await readFile(downloadPath);
  expect(bytes.subarray(0, 2).toString()).toBe("PK");

  const results = await new AxeBuilder({ page }).analyze();
  expect(
    results.violations.filter(
      ({ impact }) => impact === "serious" || impact === "critical",
    ),
  ).toEqual([]);
});
