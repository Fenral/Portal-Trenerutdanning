import { expect, test } from "@playwright/test";

test("teacher records absence in whole hours and sees live attendance", async ({
  page,
}) => {
  await page.goto("/test-login?as=teacher-t3");
  await page.getByRole("link", { name: "Deltakere" }).click();
  await page.getByRole("link", { name: "Vis profil for Kari Ferdig" }).click();

  await expect(page.getByText("100 % oppmøte", { exact: true })).toBeVisible();
  await expect(
    page.getByText("Oppmøtekrav 80 %", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("8 timer fravær igjen", { exact: true }),
  ).toBeVisible();
  await expect(page.getByLabel("Planlagte minutter")).toHaveCount(0);
  await expect(page.getByLabel("Tilstede minutter")).toHaveCount(0);

  const firstSession = page.getByRole("article").filter({
    hasText: "Samling 1",
  });
  await firstSession.getByLabel("Registrer fravær").check();
  await firstSession.getByLabel("Timer fravær").fill("7");

  await expect(page.getByText("83 % oppmøte", { exact: true })).toBeVisible();
  await expect(
    page.getByText("1 time fravær igjen", { exact: true }),
  ).toBeVisible();
});
