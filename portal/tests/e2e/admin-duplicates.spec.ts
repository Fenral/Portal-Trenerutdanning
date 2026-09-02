import { existsSync, readFileSync } from "node:fs";

import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

const veraId = "ee000000-0000-0000-0000-000000000001";
const veraKId = "ee000000-0000-0000-0000-000000000002";

function loadLocalEnvironment(): void {
  if (!existsSync(".env.local")) return;

  for (const line of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
    const separator = line.indexOf("=");
    if (separator > 0 && !line.startsWith("#")) {
      process.env[line.slice(0, separator)] ??= line.slice(separator + 1);
    }
  }
}

function requiredEnvironment(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error("Missing E2E environment variable: " + name);
  return value;
}

test.beforeAll(async () => {
  loadLocalEnvironment();
  const adminClient = createClient(
    requiredEnvironment("NEXT_PUBLIC_SUPABASE_URL"),
    requiredEnvironment("SUPABASE_SECRET_KEY"),
    { auth: { autoRefreshToken: false, persistSession: false } },
  );

  const result = await adminClient.from("profiles").upsert(
    [
      {
        id: veraId,
        display_name: "Vera Duplikat",
        normalized_email: "vera.duplikat@nivaa.invalid",
        club_name: "Fjordglimt GK",
        phone: "90000101",
      },
      {
        id: veraKId,
        display_name: "Vera K Duplikat",
        normalized_email: "vera.k.duplikat@nivaa.invalid",
        club_name: "Fjordglimt GK",
        phone: "90000101",
      },
    ],
    { onConflict: "id" },
  );
  if (result.error) throw new Error(result.error.message);
});

test("administrator sees duplicate suggestions with signals and manual merge", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/test-login?as=admin");
  await page.goto("/admin/people/duplicates");

  await expect(
    page.getByRole("heading", { name: "Duplikater og identitet" }),
  ).toBeVisible();
  await expect(page.getByRole("link", { name: "Deltakere" })).toHaveAttribute(
    "aria-current",
    "page",
  );

  // Forslaget viser score, signaler og begge profilene.
  const suggestion = page
    .locator("li")
    .filter({ hasText: "Vera K Duplikat" })
    .filter({ has: page.getByRole("button", { name: "Slå sammen" }) });
  await expect(suggestion).toHaveCount(1);
  await expect(
    suggestion.getByText("Signaler: navn + klubb + telefon"),
  ).toBeVisible();
  await expect(
    suggestion.getByRole("group", { name: "Hvilken profil skal beholdes?" }),
  ).toBeVisible();

  // Sammenslåing er alltid manuell: knappen finnes, men ingenting skjer uten valg.
  await expect(
    suggestion.getByRole("button", { name: "Slå sammen" }),
  ).toBeVisible();

  // Anonymisering ligger bak tydelig advarsel og bruker aldri ordet «Slett».
  await expect(
    page.getByRole("heading", { name: "Anonymisering (personvern)" }),
  ).toBeVisible();
  await expect(page.getByText("Kan ikke angres.")).toBeVisible();
  await expect(page.getByRole("button", { name: /Slett/ })).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Anonymiser deltaker" }),
  ).toBeVisible();

  const results = await new AxeBuilder({ page }).analyze();
  expect(
    results.violations.filter(
      ({ impact }) => impact === "serious" || impact === "critical",
    ),
  ).toEqual([]);
});

test("course teacher gets 404 on the direct duplicates URL", async ({
  page,
}) => {
  await page.goto("/test-login?as=teacher");
  const response = await page.goto("/admin/people/duplicates");
  expect(response?.status()).toBe(404);
  await expect(
    page.getByRole("heading", { name: "Duplikater og identitet" }),
  ).toHaveCount(0);
});
