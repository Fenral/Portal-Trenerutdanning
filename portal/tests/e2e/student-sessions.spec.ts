import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test("student finds session files and shared course files", async ({
  page,
}) => {
  await page.goto("/test-login?as=student");
  await expect(page).toHaveURL(/\/student$/);

  await page.getByRole("link", { name: "Samlinger", exact: true }).click();
  await expect(page).toHaveURL(/\/student\/sessions$/);
  await expect(
    page.getByRole("heading", { level: 1, name: "Samlinger" }),
  ).toBeVisible();

  for (const title of [
    "Samling 1",
    "Samling 2",
    "Samling 3",
    "Samling 4",
    "Samling 5",
    "Samling 6",
  ]) {
    await expect(
      page.getByRole("heading", { exact: true, name: title }),
    ).toBeVisible();
  }

  const sessionOne = page.getByRole("region", {
    exact: true,
    name: "Samling 1",
  });
  await expect(
    sessionOne.getByText("Presentasjon fra Samling 1"),
  ).toBeVisible();
  await expect(
    sessionOne.getByRole("link", { name: "Last ned" }),
  ).toBeVisible();

  const sessionTwo = page.getByRole("region", {
    exact: true,
    name: "Samling 2",
  });
  await expect(
    sessionTwo.getByText("Filer til samlingen publiseres av kurslæreren."),
  ).toBeVisible();

  const shared = page.getByRole("region", { name: "Felles for kurset" });
  await expect(shared.getByText("Pensum som PDF")).toBeVisible();
  await expect(shared.getByText("Observasjonsskjema")).toBeVisible();

  // Lærerfiler lekker ikke til studenten selv om de er koblet til samlingen.
  await expect(page.getByText("Undervisningspresentasjon")).toHaveCount(0);

  const download = await page.request.get(
    "/resources/a2300000-0000-0000-0000-000000000004?download=1",
  );
  expect(download.status()).toBe(200);
  expect(download.headers()["content-disposition"]).toContain("attachment");

  const results = await new AxeBuilder({ page }).analyze();
  expect(
    results.violations.filter(
      ({ impact }) => impact === "serious" || impact === "critical",
    ),
  ).toEqual([]);
});

test("editor moves a shared file to a session and back", async ({
  browser,
}) => {
  const adminPage = await browser.newPage();
  await adminPage.goto("/test-login?as=admin");
  await adminPage.goto("/editor/content");
  await adminPage
    .getByRole("link")
    .filter({ hasText: "Ballfluktslover og balltreff" })
    .click();

  const resourceCard = adminPage
    .locator("article")
    .filter({ hasText: "Observasjonsskjema" });
  await resourceCard
    .getByLabel("Hører til samling")
    .selectOption({ label: "Samling 2" });
  await resourceCard
    .getByRole("button", { name: "Lagre samlingsvalg" })
    .click();
  await expect(adminPage.getByText(/Samlingsvalget er lagret/)).toBeVisible();

  const studentPage = await browser.newPage();
  await studentPage.goto("/test-login?as=student");
  await studentPage.goto("/student/sessions");
  const sessionTwo = studentPage.getByRole("region", {
    exact: true,
    name: "Samling 2",
  });
  await expect(sessionTwo.getByText("Observasjonsskjema")).toBeVisible();
  const shared = studentPage.getByRole("region", {
    name: "Felles for kurset",
  });
  await expect(shared.getByText("Observasjonsskjema")).toHaveCount(0);

  // Tilbakestill til «Felles for kurset» så seed-tilstanden består.
  await resourceCard
    .getByLabel("Hører til samling")
    .selectOption({ label: "Felles for kurset" });
  await resourceCard
    .getByRole("button", { name: "Lagre samlingsvalg" })
    .click();
  await expect(adminPage.getByText(/Samlingsvalget er lagret/)).toBeVisible();

  await studentPage.reload();
  await expect(shared.getByText("Observasjonsskjema")).toBeVisible();

  await adminPage.close();
  await studentPage.close();
});

test("timeline session click lands on the session card", async ({ page }) => {
  await page.goto("/test-login?as=student");
  await page
    .getByRole("link", { name: /Samling 1/ })
    .first()
    .click();
  await expect(page).toHaveURL(/\/student\/sessions#session-/);
  await expect(
    page.getByRole("region", { exact: true, name: "Samling 1" }),
  ).toBeVisible();
});
