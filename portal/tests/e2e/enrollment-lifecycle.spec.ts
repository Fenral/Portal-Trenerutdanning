import { expect, test } from "@playwright/test";

const T2_COURSE_URL = "/admin/courses/b1020000-0000-0000-0000-000000000001";

test("admin withdraws a participant and reopens with one click", async ({
  page,
}) => {
  await page.goto("/test-login?as=admin");
  await expect(page).toHaveURL(/\/admin\/courses$/);

  await page.goto(T2_COURSE_URL);
  await expect(page.getByText("3 deltakere")).toBeVisible();

  const card = page.locator("article", { hasText: "Henrik Aas" });
  await expect(card.getByText("Aktiv", { exact: true })).toBeVisible();

  await card
    .getByLabel("Begrunnelse for å trekke Henrik Aas")
    .fill("Sluttet i klubben");
  await card.getByRole("button", { name: "Trekk deltaker" }).click();

  await expect(
    page.getByText("Deltakeren er trukket fra kurset", { exact: false }),
  ).toBeVisible();
  await expect(page.getByText("2 deltakere · 1 trukket")).toBeVisible();
  await expect(card.getByText("Trukket", { exact: true })).toBeVisible();
  await expect(card.getByText("Begrunnelse: Sluttet i klubben")).toBeVisible();

  await card.getByRole("button", { name: "Gjenåpne" }).click();

  await expect(
    page.getByText("Deltakeren er gjenåpnet", { exact: false }),
  ).toBeVisible();
  await expect(page.getByText("3 deltakere")).toBeVisible();
  await expect(card.getByText("Aktiv", { exact: true })).toBeVisible();
});
