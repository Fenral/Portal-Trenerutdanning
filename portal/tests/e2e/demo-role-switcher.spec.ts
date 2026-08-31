import { expect, test } from "@playwright/test";

test("demo tester switches between student, teacher and admin views", async ({
  page,
}) => {
  await page.goto("/test-login?as=teacher-t3");

  const roleSwitcher = page.getByRole("navigation", {
    name: "Bytt demovisning",
  });
  await expect(roleSwitcher).toBeVisible();
  await expect(
    roleSwitcher.getByRole("link", { name: "Kurslærer" }),
  ).toHaveAttribute("aria-current", "page");

  await roleSwitcher.getByRole("link", { name: "Student" }).click();
  await expect(page).toHaveURL(/\/student$/);
  await expect(
    page
      .getByRole("navigation", { name: "Bytt demovisning" })
      .getByRole("link", { name: "Student" }),
  ).toHaveAttribute("aria-current", "page");

  await page
    .getByRole("navigation", { name: "Bytt demovisning" })
    .getByRole("link", { name: "Admin" })
    .click();
  await expect(page).toHaveURL(/\/admin\/courses$/);
  await expect(
    page
      .getByRole("navigation", { name: "Bytt demovisning" })
      .getByRole("link", { name: "Admin" }),
  ).toHaveAttribute("aria-current", "page");
});
