import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test("a student passes the knowledge test and updates the learning path", async ({
  page,
}) => {
  await page.goto("/test-login?as=student-selma");

  await expect(
    page.getByRole("link", { name: "Fortsett Kunnskapsprøve" }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Fortsett Kunnskapsprøve" }).click();

  await expect(
    page.getByRole("heading", { name: "Kunnskapsprøve" }),
  ).toBeVisible();
  await page.getByLabel("Køllebladets retning i treffet").check();
  await page
    .getByLabel("Svingbanen går mer mot høyre enn køllebladet peker")
    .check();
  await page.getByLabel("20 prosent").check();
  await page.getByLabel("80 prosent").check();
  await page.getByLabel("45 timer").check();
  await page.getByRole("button", { name: "Lever svar" }).click();

  await expect(
    page.getByRole("heading", { name: "Prøven er bestått" }),
  ).toBeVisible();
  await expect(page.getByText("5 av 5 poeng")).toBeVisible();

  const results = await new AxeBuilder({ page }).analyze();
  expect(
    results.violations.filter(
      ({ impact }) => impact === "serious" || impact === "critical",
    ),
  ).toEqual([]);

  await page.getByRole("link", { name: "Til læringsløpet" }).click();
  await expect(
    page.getByRole("progressbar", { name: "80 prosent fullført" }),
  ).toBeVisible();
});
