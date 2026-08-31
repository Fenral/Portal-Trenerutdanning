import { expect, test } from "@playwright/test";

test("teacher filters compact participant rows and opens module profile", async ({
  page,
}) => {
  await page.goto("/test-login?as=teacher-t3");
  await page.goto("/teacher/participants");

  await expect(page.getByRole("button", { name: /^Åpne/ })).toHaveCount(0);

  const moduleFilter = page.getByLabel("Vis modul");
  await expect(moduleFilter).toBeVisible();
  await moduleFilter.selectOption({ label: "Golfteknikk" });
  await expect(
    page
      .locator("[data-sort-percentage]")
      .first()
      .getByText("Golfteknikk", { exact: true }),
  ).toBeVisible();

  await page.getByLabel("Sorter deltakere").selectOption("progress-asc");
  const ascendingProgress = await page
    .locator("[data-sort-percentage]")
    .evaluateAll((rows) =>
      rows.map((row) => Number(row.getAttribute("data-sort-percentage"))),
    );
  expect(ascendingProgress).toEqual(
    [...ascendingProgress].sort((a, b) => a - b),
  );

  const kariRow = page.getByRole("link").filter({ hasText: "Kari Ferdig" });
  await expect(kariRow).toBeVisible();
  await kariRow.click();

  await expect(
    page.getByRole("heading", { name: "Kari Ferdig" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Modulprogresjon" }),
  ).toBeVisible();
  await page.getByText("Golfteknikk", { exact: true }).click();
  await expect(page.getByText("Ballfluktslover og balltreff")).toBeVisible();
});
