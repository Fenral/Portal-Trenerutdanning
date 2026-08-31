import { expect, test } from "@playwright/test";

test("a student can complete a reach-end lesson and sees updated progress", async ({
  page,
}) => {
  await page.goto("/test-login?as=student-emil");

  await expect(page.getByText("20 %", { exact: true })).toBeVisible();
  await page
    .getByRole("link", { name: "Fortsett Planlegging av treningsøkt" })
    .click();
  await expect(
    page.getByRole("heading", { name: "Planlegging av treningsøkt" }),
  ).toBeVisible();

  await page.getByRole("button", { name: "Marker som fullført" }).click();
  await expect(
    page.getByText("Aktiviteten er registrert som fullført."),
  ).toBeVisible();
  await expect(page.getByText("Fullført", { exact: true })).toBeVisible();

  await page.getByRole("link", { name: "Til læringsløpet" }).click();
  await expect(page.getByText("40 %", { exact: true })).toBeVisible();
});
