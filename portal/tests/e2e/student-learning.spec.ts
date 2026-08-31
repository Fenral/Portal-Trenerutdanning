import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test("student sees one next action and an exact reason for a locked test", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/test-login?as=student");

  await expect(page).toHaveURL(/\/student$/);
  await expect(
    page.getByRole("heading", { name: "Fortsett der du slapp" }),
  ).toBeVisible();
  await expect(page.getByText("40 %", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("link", {
      name: "Fortsett Ballfluktslover og balltreff",
    }),
  ).toBeVisible();
  await expect(
    page
      .getByRole("navigation", { name: "Moduler" })
      .getByText("2 av 2", { exact: true }),
  ).toBeVisible();

  await page.getByRole("link", { name: "Åpne Kunnskapsprøve" }).click();
  await expect(
    page.getByRole("heading", { name: "Kunnskapsprøve" }),
  ).toBeVisible();
  await expect(
    page.getByText("Fullfør Ballfluktslover og balltreff først"),
  ).toBeVisible();

  const results = await new AxeBuilder({ page }).analyze();
  expect(
    results.violations.filter(
      ({ impact }) => impact === "serious" || impact === "critical",
    ),
  ).toEqual([]);
});

test("learning path and lesson stay usable on mobile", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/test-login?as=student");

  await expect(
    page.getByRole("heading", { name: "Fortsett der du slapp" }),
  ).toBeVisible();
  await page
    .getByRole("link", { name: "Fortsett Ballfluktslover og balltreff" })
    .click();
  await expect(
    page.getByRole("heading", { name: "Ballfluktslover og balltreff" }),
  ).toBeVisible();
  await expect(page.getByTitle("Fagvideo fra TrackMan")).toBeVisible();

  const documentWidth = await page.evaluate(
    () => document.documentElement.scrollWidth,
  );
  expect(documentWidth).toBeLessThanOrEqual(390);

  const results = await new AxeBuilder({ page }).analyze();
  expect(
    results.violations.filter(
      ({ impact }) => impact === "serious" || impact === "critical",
    ),
  ).toEqual([]);
});
