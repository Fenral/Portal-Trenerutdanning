import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

const menuItems = [
  { label: "Læringsløp", heading: "Læringsløp" },
  { label: "Samlinger", heading: "Samlinger" },
  { label: "Praksis", heading: "Praksis til oppfølging" },
  { label: "Deltakere", heading: "Deltakere" },
  { label: "Innleveringer", heading: "Innleveringer til vurdering" },
] as const;

test("teacher menu navigates to every workspace", async ({ page }) => {
  await page.goto("/test-login?as=teacher-t3");

  const navigation = page.getByRole("navigation", { name: "Hovedmeny" });

  for (const item of menuItems) {
    await navigation
      .getByRole("link", { name: item.label, exact: true })
      .click();
    await expect(
      page.getByRole("heading", { level: 1, name: item.heading }),
    ).toBeVisible();
  }

  await expect(navigation.getByText("Inbox")).toBeVisible();
  await expect(navigation.getByRole("link", { name: "Inbox" })).toHaveCount(0);
});

for (const path of ["/teacher/sessions", "/teacher/course"]) {
  test(`${path} has no serious accessibility findings`, async ({ page }) => {
    await page.goto("/test-login?as=teacher-t3");
    await page.goto(path);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();

    const results = await new AxeBuilder({ page }).analyze();
    const seriousFindings = results.violations.filter(
      ({ impact }) => impact === "serious" || impact === "critical",
    );

    expect(seriousFindings).toEqual([]);
  });
}

test("students are not authorized for the teacher course view", async ({
  page,
}) => {
  await page.goto("/test-login?as=student");
  const response = await page.goto("/teacher/course");

  expect(response?.status()).toBe(404);
});
