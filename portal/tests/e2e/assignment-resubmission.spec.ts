import { expect, test } from "@playwright/test";

const assignmentTitle = "Planlegg en inkluderende golføkt";
const activityId = "a3200000-0000-0000-0000-000000000007";
const pdfBytes = Buffer.from("%PDF-1.4\n% demo assignment\n");

test("student improves an assignment after teacher feedback", async ({
  page,
}) => {
  await page.goto("/test-login?as=student-selma");
  await page.getByRole("link", { name: `Åpne ${assignmentTitle}` }).click();

  await page.getByLabel("Velg dokument").setInputFiles({
    name: "forste-versjon.pdf",
    mimeType: "application/pdf",
    buffer: pdfBytes,
  });
  await page.getByLabel("Merknad til lærer").fill("Første versjon");
  await page.getByRole("button", { name: "Send inn" }).click();
  await expect(
    page.getByRole("heading", { name: "Sendt til vurdering" }),
  ).toBeVisible();

  await page.goto("/test-login?as=teacher-t3");
  await expect(
    page.getByRole("heading", { name: "Innleveringer til vurdering" }),
  ).toBeVisible();
  await page.getByRole("link", { name: /Vurder Selma Dahl/ }).click();
  await page
    .getByLabel("Tilbakemelding")
    .fill("Beskriv tydeligere hvordan økten tilpasses utøverne.");
  await page.getByLabel("Ny frist", { exact: true }).fill("2027-03-01T23:59");
  await page
    .getByLabel("Begrunnelse for ny frist")
    .fill("Tid til å utbedre tilbakemeldingen");
  await page.getByRole("button", { name: "Be om utbedring" }).click();
  await expect(page.getByText("Må utbedres", { exact: true })).toBeVisible();

  await page.goto("/test-login?as=student-selma");
  await page.goto(`/student/assignments/${activityId}`);
  await expect(
    page.getByText("Beskriv tydeligere hvordan økten tilpasses utøverne."),
  ).toBeVisible();
  await expect(page.getByText("Versjon 1", { exact: true })).toBeVisible();
  await page.getByLabel("Velg dokument").setInputFiles({
    name: "utbedret-versjon.pdf",
    mimeType: "application/pdf",
    buffer: pdfBytes,
  });
  await page
    .getByLabel("Merknad til lærer")
    .fill("Utbedret etter tilbakemelding");
  await page.getByRole("button", { name: "Send inn på nytt" }).click();
  await expect(page.getByText("Versjon 2", { exact: true })).toBeVisible();

  await page.goto("/test-login?as=teacher-t3");
  await page.getByRole("link", { name: /Vurder Selma Dahl/ }).click();
  await page.getByLabel("Tilbakemelding").fill("Godkjent etter utbedring.");
  await page.getByRole("button", { name: "Godkjenn" }).click();
  await expect(page.getByText("Godkjent", { exact: true })).toBeVisible();
});
