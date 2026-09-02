import { expect, test } from "@playwright/test";

test("student logs 45 hours and teacher approves the practice", async ({
  page,
}) => {
  await page.goto("/test-login?as=student");
  await page.getByRole("link", { name: "Praksis", exact: true }).click();

  await expect(page.getByRole("heading", { name: "Praksis" })).toBeVisible();
  await expect(page.getByText("18 av 45 timer", { exact: true })).toBeVisible();
  await page.getByLabel("Dato").fill("2026-08-30");
  await page.getByLabel("Type praksis").selectOption("delivery");
  await page.getByLabel("Timer").fill("27");
  await page.getByLabel("Minutter").fill("0");
  await page
    .getByLabel("Beskrivelse")
    .fill("Gjennomførte treningsøkter med juniorgruppen.");
  await page.getByRole("button", { name: "Legg til timer" }).click();

  await expect(page.getByText("45 av 45 timer", { exact: true })).toBeVisible();
  await page
    .getByRole("button", { name: "Send praksis til godkjenning" })
    .click();
  await expect(
    page.getByRole("heading", { name: "Sendt til godkjenning" }),
  ).toBeVisible();

  await page.goto("/test-login?as=teacher-t3");
  await page.getByRole("link", { name: "Praksis", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Praksis til oppfølging" }),
  ).toBeVisible();
  await page.getByRole("link", { name: /Følg opp Nora Nordmann/ }).click();
  await page
    .getByLabel("Kommentar")
    .fill("Timelisten er kontrollert og godkjent.");
  await page.getByRole("button", { name: "Godkjenn praksis" }).click();
  await expect(page.getByRole("status")).toHaveText("Godkjent manuelt");

  await page.goto("/test-login?as=student");
  await page.getByRole("link", { name: "Praksis", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Praksisen er godkjent" }),
  ).toBeVisible();
});
