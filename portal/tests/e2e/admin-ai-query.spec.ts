import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test("administrator runs an objective question and gets a read-only answer", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/test-login?as=admin");
  await page.goto("/admin/insights/ai-query");

  await expect(
    page.getByRole("heading", { name: "Objektive spørsmål" }),
  ).toBeVisible();
  await expect(page.getByRole("link", { name: "Innsikt" })).toHaveAttribute(
    "aria-current",
    "page",
  );

  // Fritekst er deaktivert uten OPENAI_API_KEY, med forklaring.
  await expect(page.getByLabel("Eget spørsmål")).toBeDisabled();

  await page.getByRole("button", { name: "Hvor mange har fullført?" }).click();

  await expect(
    page.getByRole("heading", { name: /Hvor mange har fullført/ }),
  ).toBeVisible();
  await expect(page.getByText("Definisjon:", { exact: true })).toBeVisible();
  await expect(page.getByText(/Antall fullført/)).toBeVisible();
  // Skrivebeskyttet-merket står både på panelet og på selve svaret.
  await expect(page.getByText("Skrivebeskyttet", { exact: true })).toHaveCount(
    2,
  );
  await expect(
    page.getByText("Antall deltakere", { exact: true }),
  ).toBeVisible();

  const results = await new AxeBuilder({ page }).analyze();
  expect(
    results.violations.filter(
      ({ impact }) => impact === "serious" || impact === "critical",
    ),
  ).toEqual([]);
});

test("course teacher gets 404 on the direct AI query URL", async ({ page }) => {
  await page.goto("/test-login?as=teacher");
  const response = await page.goto("/admin/insights/ai-query");
  expect(response?.status()).toBe(404);
  await expect(
    page.getByRole("heading", { name: "Objektive spørsmål" }),
  ).toHaveCount(0);
});
