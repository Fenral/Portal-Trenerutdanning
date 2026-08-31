import { expect, test } from "@playwright/test";

test("a draft stays private until the editor publishes it to the course", async ({
  browser,
}) => {
  const adminPage = await browser.newPage();
  await adminPage.goto("/test-login?as=admin");
  await adminPage.getByRole("link", { name: "Innhold", exact: true }).click();
  await expect(adminPage).toHaveURL(/\/editor\/content$/);
  await expect(
    adminPage.getByRole("heading", { name: "Innhold" }),
  ).toBeVisible();

  const contentCard = adminPage
    .getByRole("link")
    .filter({ hasText: "Ballfluktslover og balltreff" });
  await contentCard.click();
  await expect(
    adminPage.getByRole("heading", { name: "Rediger kladd" }),
  ).toBeVisible();
  await expect(adminPage.getByText("3 filer", { exact: true })).toBeVisible();
  await expect(
    adminPage.getByText("Kun lærere", { exact: true }),
  ).toBeVisible();

  const privateHeading = `Balltreff – kontrollert kladd ${Date.now()}`;
  await adminPage.getByLabel("Overskrift").fill(privateHeading);
  await adminPage
    .getByLabel("Ingress")
    .fill(
      "Dette er en ny ingress som først skal bli synlig etter publisering.",
    );
  await adminPage.getByRole("button", { name: "Lagre kladd" }).click();
  await expect(
    adminPage.getByText(/Kladden er lagret\. Studentene ser fortsatt/),
  ).toBeVisible();

  const studentPage = await browser.newPage();
  await studentPage.goto("/test-login?as=student");
  await expect(studentPage).toHaveURL(/\/student$/);
  await expect(
    studentPage.getByRole("heading", { name: "Tilgangen er aktivert" }),
  ).toBeVisible();
  await expect(studentPage.getByText(privateHeading)).toHaveCount(0);
  await studentPage
    .getByRole("link", { name: "Åpne Ballfluktslover og balltreff" })
    .click();
  await expect(
    studentPage.getByRole("heading", {
      name: "Ballfluktslover og balltreff",
    }),
  ).toBeVisible();

  const studentResources = studentPage.getByTestId("student-resources");
  await expect(studentResources.getByText("Pensum som PDF")).toBeVisible();
  await expect(studentResources.getByText("Observasjonsskjema")).toBeVisible();
  await expect(studentPage.getByText("Undervisningspresentasjon")).toHaveCount(
    0,
  );

  const pdfResponse = await studentPage.request.get(
    "/resources/a2300000-0000-0000-0000-000000000001",
  );
  expect(pdfResponse.status()).toBe(200);
  expect(pdfResponse.headers()["content-type"]).toContain("application/pdf");
  const excelResponse = await studentPage.request.get(
    "/resources/a2300000-0000-0000-0000-000000000003?download=1",
  );
  expect(excelResponse.status()).toBe(200);
  expect(excelResponse.headers()["content-disposition"]).toContain(
    "attachment",
  );
  const teacherFileResponse = await studentPage.request.get(
    "/resources/a2300000-0000-0000-0000-000000000002",
  );
  expect(teacherFileResponse.status()).toBe(404);

  await adminPage.getByLabel("Endringsnotat").fill("Oppdatert demooverskrift");
  await adminPage
    .getByRole("checkbox", { name: /Trener 3 · 2026–2027/ })
    .check();
  await adminPage.getByRole("button", { name: "Publiser kladden" }).click();
  await expect(adminPage.getByText(/Ny versjon er publisert/)).toBeVisible();

  await studentPage.reload();
  await expect(
    studentPage.getByRole("heading", { name: privateHeading }),
  ).toBeVisible();

  await adminPage.close();
  await studentPage.close();
});
