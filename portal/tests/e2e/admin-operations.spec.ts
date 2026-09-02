import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test("administrator sees the operations queue and marks the invoice task handled", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/test-login?as=admin");
  await page.goto("/admin");

  await expect(
    page.getByRole("heading", { name: "Driftsoversikt" }),
  ).toBeVisible();
  await expect(page.getByRole("link", { name: "Oversikt" })).toHaveAttribute(
    "aria-current",
    "page",
  );

  // Hastende drift først: Ungdomsdriven-oppgaven fra seeden ligger i køen,
  // med forklaringen om at fakturering skjer utenfor portalen.
  const task = page
    .locator("li")
    .filter({ hasText: "Jakob Fjell" })
    .filter({ has: page.getByRole("button", { name: "Marker håndtert" }) });
  await expect(task).toHaveCount(1);
  await expect(page.getByText("portalen fakturerer aldri")).toBeVisible();

  // Én primærknapp på siden.
  await expect(page.locator(".nivaa-button--primary")).toHaveCount(1);

  // Kontekstkolonnen: formeldefinisjoner og systemstatus.
  await expect(
    page.getByRole("heading", { name: "Formeldefinisjoner" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Systemstatus" }),
  ).toBeVisible();

  const results = await new AxeBuilder({ page }).analyze();
  expect(
    results.violations.filter(
      ({ impact }) => impact === "serious" || impact === "critical",
    ),
  ).toEqual([]);

  await task.getByRole("button", { name: "Marker håndtert" }).click();
  await expect(
    page.getByText(
      "Oppgaven er markert som håndtert og logget i revisjonssporet.",
    ),
  ).toBeVisible();
  await expect(task).toHaveCount(0);
});

test("overview item is only active on the exact /admin path", async ({
  page,
}) => {
  await page.goto("/test-login?as=admin");
  await page.goto("/admin/courses");

  await expect(
    page.getByRole("link", { name: "Oversikt" }),
  ).not.toHaveAttribute("aria-current", "page");
  await expect(
    page.getByRole("link", { name: "Kurs", exact: true }),
  ).toHaveAttribute("aria-current", "page");
});

test("student gets 404 on the direct /admin URL", async ({ page }) => {
  await page.goto("/test-login?as=student");
  const response = await page.goto("/admin");
  expect(response?.status()).toBe(404);
  await expect(
    page.getByRole("heading", { name: "Driftsoversikt" }),
  ).toHaveCount(0);
});

test("course teacher gets 404 on the direct /admin URL", async ({ page }) => {
  await page.goto("/test-login?as=teacher");
  const response = await page.goto("/admin");
  expect(response?.status()).toBe(404);
  await expect(
    page.getByRole("heading", { name: "Driftsoversikt" }),
  ).toHaveCount(0);
});
