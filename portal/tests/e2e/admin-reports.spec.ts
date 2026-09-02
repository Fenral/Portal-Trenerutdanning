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

test("administrator downloads course reports as Excel and PDF", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/test-login?as=admin");
  await page.goto("/admin/reports");

  await expect(
    page.getByRole("heading", { name: "Kursrapporter" }),
  ).toBeVisible();

  const excelDownloadPromise = page.waitForEvent("download");
  await page
    .getByRole("link", { name: /Kursstatus og progresjon for .* som Excel/ })
    .last()
    .click();
  const excelDownload = await excelDownloadPromise;
  expect(excelDownload.suggestedFilename()).toMatch(
    /^course-progress-[a-z0-9-]+\.xlsx$/,
  );
  const excelPath = await excelDownload.path();
  if (!excelPath) throw new Error("Course report download path missing");
  expect((await readFile(excelPath)).subarray(0, 2).toString()).toBe("PK");

  const pdfDownloadPromise = page.waitForEvent("download");
  await page
    .getByRole("link", { name: /Oppmøte for .* som PDF/ })
    .last()
    .click();
  const pdfDownload = await pdfDownloadPromise;
  expect(pdfDownload.suggestedFilename()).toMatch(
    /^attendance-[a-z0-9-]+\.pdf$/,
  );
  const pdfPath = await pdfDownload.path();
  if (!pdfPath) throw new Error("Course report download path missing");
  expect((await readFile(pdfPath)).subarray(0, 5).toString()).toBe("%PDF-");
});
