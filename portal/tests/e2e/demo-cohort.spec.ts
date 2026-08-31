import { expect, test } from "@playwright/test";

const courseRunId = "b1030000-0000-0000-0000-000000000001";

test("teacher sees a clearly marked 20-person demo cohort", async ({
  page,
}) => {
  await page.goto("/test-login?as=teacher-t3");
  await page.getByRole("link", { name: "Deltakere" }).click();

  await expect(
    page.getByText("DEMO · fiktive data", { exact: true }),
  ).toBeVisible();
  await expect(page.getByText("20 deltakere", { exact: true })).toBeVisible();

  const rows = page.getByRole("article");
  await expect(rows).toHaveCount(20);
  await expect(rows.nth(0)).toContainText("Kari Ferdig");
  await expect(rows.nth(0)).toContainText("100 %");
  await expect(rows.nth(1)).toContainText("Trond «50%»");
  await expect(rows.nth(1)).toContainText("50 %");
  await expect(rows.nth(2)).toContainText("Jonas «henger etter»");
  await expect(rows.nth(2)).toContainText("20 %");

  await page.goto("/teacher");
  await expect(
    page.getByRole("heading", { name: "Innleveringer til vurdering" }),
  ).toBeVisible();
  await expect(
    page.getByText("Jonas «henger etter»", { exact: true }),
  ).toBeVisible();
  await expect(page.getByText("Trond «50%»", { exact: true })).toBeVisible();
});

test("administrator sees the same demo stories first", async ({ page }) => {
  await page.goto("/test-login?as=admin");
  await page.goto(`/admin/courses/${courseRunId}`);

  const rows = page.getByRole("article");
  await expect(rows).toHaveCount(20);
  await expect(rows.nth(0)).toContainText("Kari Ferdig");
  await expect(rows.nth(0)).toContainText("100 %");
  await expect(rows.nth(1)).toContainText("Trond «50%»");
  await expect(rows.nth(1)).toContainText("50 %");
  await expect(rows.nth(2)).toContainText("Jonas «henger etter»");
  await expect(rows.nth(2)).toContainText("20 %");
});
