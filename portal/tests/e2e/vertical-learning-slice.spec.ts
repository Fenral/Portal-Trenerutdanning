import { existsSync, readFileSync } from "node:fs";

import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

const assignmentActivityId = "a3200000-0000-0000-0000-000000000007";
const courseRunId = "b1030000-0000-0000-0000-000000000001";
const contentItemId = "a2000000-0000-0000-0000-000000000001";
const pdfBytes = Buffer.from("%PDF-1.4\n% vertical learning slice\n");

function loadLocalEnvironment() {
  if (!existsSync(".env.local")) return;
  for (const line of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
    const separator = line.indexOf("=");
    if (separator > 0 && !line.startsWith("#")) {
      process.env[line.slice(0, separator)] ??= line.slice(separator + 1);
    }
  }
}

function requiredEnvironment(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing E2E environment variable: ${name}`);
  return value;
}

test("editor, student and staff complete one learning journey through diploma", async ({
  page,
}, testInfo) => {
  test.setTimeout(240_000);
  await page.setViewportSize({ width: 1280, height: 900 });

  await test.step("editor publishes a reviewed lesson revision", async () => {
    await page.goto("/test-login?as=admin");
    await page.getByRole("link", { name: "Innhold", exact: true }).click();
    await page
      .getByRole("link")
      .filter({ hasText: "Ballfluktslover og balltreff" })
      .click();
    await page
      .getByLabel("Overskrift")
      .fill("Ballfluktslover og balltreff – vertikal kontroll");
    await page
      .getByLabel("Ingress")
      .fill("Syntetisk demotekst kontrollert for den vertikale E2E-reisen.");
    await page.getByRole("button", { name: "Lagre kladd" }).click();
    await page.getByLabel("Endringsnotat").fill("Vertikal kvalitetsport");
    await page.getByRole("checkbox", { name: /Trener 3 · 2026–2027/ }).check();
    await page.getByRole("button", { name: "Publiser kladden" }).click();
    await expect(page.getByText(/Ny versjon er publisert/)).toBeVisible();
  });

  await test.step("student reads the lesson and passes the five-question quiz", async () => {
    await page.goto("/test-login?as=student-selma");
    await page.goto(`/student/content/${contentItemId}`);
    await expect(
      page.getByRole("heading", {
        name: "Ballfluktslover og balltreff – vertikal kontroll",
      }),
    ).toBeVisible();
    await expect(page.getByTitle("Fagvideo fra TrackMan")).toBeVisible();

    await page.goto("/student/quiz/a3200000-0000-0000-0000-000000000006");
    await page.getByLabel("Køllebladets retning i treffet").check();
    await page
      .getByLabel("Svingbanen går mer mot høyre enn køllebladet peker")
      .check();
    await page.getByLabel("20 prosent").check();
    await page.getByLabel("80 prosent").check();
    await page.getByLabel("45 timer").check();
    await page.getByRole("button", { name: "Lever svar" }).click();
    await expect(
      page.getByRole("heading", { name: "Prøven er bestått" }),
    ).toBeVisible();
  });

  await test.step("teacher requests one assignment revision and approves it", async () => {
    await page.goto(`/student/assignments/${assignmentActivityId}`);
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
    await page.getByRole("link", { name: /Vurder Selma Dahl/ }).click();
    await page
      .getByLabel("Tilbakemelding")
      .fill("Beskriv tilpasningen til utøverne tydeligere.");
    await page.getByLabel("Ny frist", { exact: true }).fill("2027-03-01T23:59");
    await page
      .getByLabel("Begrunnelse for ny frist")
      .fill("Tid til kontrollert utbedring");
    await page.getByRole("button", { name: "Be om utbedring" }).click();

    await page.goto("/test-login?as=student-selma");
    await page.goto(`/student/assignments/${assignmentActivityId}`);
    await expect(page.getByText("Beskriv tilpasningen")).toBeVisible();
    await page.getByLabel("Velg dokument").setInputFiles({
      name: "utbedret-versjon.pdf",
      mimeType: "application/pdf",
      buffer: pdfBytes,
    });
    await page.getByLabel("Merknad til lærer").fill("Utbedret versjon");
    await page.getByRole("button", { name: "Send inn på nytt" }).click();

    await page.goto("/test-login?as=teacher-t3");
    await page.getByRole("link", { name: /Vurder Selma Dahl/ }).click();
    await page.getByLabel("Tilbakemelding").fill("Godkjent etter utbedring.");
    await page.getByRole("button", { name: "Godkjenn" }).click();
    await expect(page.getByText("Godkjent", { exact: true })).toBeVisible();
  });

  await test.step("student logs 45 hours and teacher approves practice", async () => {
    await page.goto("/test-login?as=student-selma");
    await page.goto("/student/practice");
    await page.getByLabel("Dato").fill("2026-08-30");
    await page.getByLabel("Type praksis").selectOption("delivery");
    await page.getByLabel("Timer").fill("45");
    await page.getByLabel("Minutter").fill("0");
    await page
      .getByLabel("Beskrivelse")
      .fill("Gjennomførte treningsøkter i egen klubb.");
    await page.getByRole("button", { name: "Legg til timer" }).click();
    await page
      .getByRole("button", { name: "Send praksis til godkjenning" })
      .click();
    await expect(
      page.getByRole("heading", { name: "Sendt til godkjenning" }),
    ).toBeVisible();

    await page.goto("/test-login?as=teacher-t3");
    await page.getByRole("link", { name: /Følg opp Selma Dahl/ }).click();
    await page.getByLabel("Kommentar").fill("45 timer er kontrollert.");
    await page.getByRole("button", { name: "Godkjenn praksis" }).click();
    await expect(page.getByRole("status")).toHaveText("Godkjent manuelt");
  });

  await test.step("teacher records every physical session", async () => {
    await page.getByRole("link", { name: "Deltakere" }).click();
    await page.getByRole("link", { name: "Åpne Selma Dahl" }).click();
    for (const session of [
      "Samling 1",
      "Samling 2",
      "Samling 3",
      "Samling 4",
      "Samling 5",
      "Samling 6",
    ]) {
      await page
        .getByRole("button", { name: `Lagre oppmøte for ${session}` })
        .click();
    }
    await expect(
      page.getByText("100 % oppmøte", { exact: true }),
    ).toBeVisible();
  });

  await test.step("administrator verifies university and triggers one diploma", async () => {
    await page.goto("/test-login?as=admin");
    await page.goto(`/admin/courses/${courseRunId}`);
    await page.getByLabel("Universitet fullført for Selma Dahl").check();
    await page
      .getByRole("button", {
        name: "Lagre universitetsstatus for Selma Dahl",
      })
      .click();
    await expect(
      page.getByText("Universitet fullført", { exact: true }),
    ).toBeVisible();

    loadLocalEnvironment();
    const admin = createClient(
      requiredEnvironment("NEXT_PUBLIC_SUPABASE_URL"),
      requiredEnvironment("SUPABASE_SECRET_KEY"),
      { auth: { persistSession: false } },
    );
    const certificate = await admin
      .from("certificates")
      .select("id", { count: "exact" })
      .eq("course_run_id", courseRunId)
      .eq("display_name", "Selma Dahl");
    if (certificate.error) throw certificate.error;
    expect(certificate.count).toBe(1);
  });

  await test.step("student sees the wall and downloadable diploma", async () => {
    await page.goto("/test-login?as=student-selma");
    await page.goto("/student/certificates");
    await expect(page.getByText("Gratulerer, Selma Dahl!")).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Last ned PDF" }),
    ).toHaveAttribute("href", /\/storage\/v1\/object\/sign\/certificates\//);

    const accessibility = await new AxeBuilder({ page }).analyze();
    expect(
      accessibility.violations.filter(
        ({ impact }) => impact === "serious" || impact === "critical",
      ),
    ).toEqual([]);
    await page.screenshot({
      path: testInfo.outputPath("diplom-1280.png"),
      fullPage: true,
    });

    await page.setViewportSize({ width: 390, height: 844 });
    await page.reload();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(390);
    await page.screenshot({
      path: testInfo.outputPath("diplom-390.png"),
      fullPage: true,
    });
  });
});
