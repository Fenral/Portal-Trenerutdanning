import { expect, test } from "@playwright/test";

test("administrator sees collapsible T1 and the two-year T3 plan", async ({
  page,
}) => {
  await page.goto("/test-login?as=admin");
  await expect(page).toHaveURL(/\/admin\/courses$/);
  await expect(
    page.getByRole("heading", { name: "Kursgjennomføringer" }),
  ).toBeVisible();

  const t1Group = page.getByTestId("t1-course-group");
  const osloCourse = t1Group.getByRole("heading", {
    name: "Oslo GK",
    exact: true,
  });
  await expect(t1Group.getByText("Trener 1 · 9 kurssteder")).toBeVisible();
  await expect(osloCourse).not.toBeVisible();
  await t1Group.locator("summary").click();
  await expect(osloCourse).toBeVisible();
  await expect(
    t1Group.getByText("Ungdomsdriven · valgfri", { exact: true }).first(),
  ).toBeVisible();

  const t3Group = page.getByTestId("t3-course-group");
  await expect(t3Group.getByText("2026–2027", { exact: true })).toBeVisible();
  await expect(t3Group.getByText("6 samlinger", { exact: true })).toBeVisible();
  await expect(t3Group.getByText("19.–21. mars 2027")).toBeVisible();

  await page.getByRole("link", { name: "Ny kursgjennomføring" }).click();
  await expect(page).toHaveURL(/\/admin\/courses\/new$/);
  await expect(
    page.getByRole("heading", { name: "Ny kursgjennomføring" }),
  ).toBeVisible();
  await expect(page.getByLabel("Kursleder")).toBeVisible();
});
