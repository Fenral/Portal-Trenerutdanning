import { existsSync, readFileSync } from "node:fs";

import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { PDFDocument } from "pdf-lib";

const courseRunId = "b1030000-0000-0000-0000-000000000001";
const selmaProfileId = "c0000000-0000-0000-0000-000000000007";

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

test.beforeAll(async () => {
  loadLocalEnvironment();
  const admin = createClient(
    requiredEnvironment("NEXT_PUBLIC_SUPABASE_URL"),
    requiredEnvironment("SUPABASE_SECRET_KEY"),
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
  const enrollment = await admin
    .from("enrollments")
    .select("id")
    .eq("course_run_id", courseRunId)
    .eq("profile_id", selmaProfileId)
    .single();
  if (enrollment.error) throw enrollment.error;

  const existing = await admin
    .from("certificates")
    .select("id")
    .eq("enrollment_id", enrollment.data.id)
    .maybeSingle();
  if (existing.error) throw existing.error;
  if (existing.data) return;

  const certificate = await admin.from("certificates").insert({
    id: "cf000000-0000-0000-0000-000000000001",
    enrollment_id: enrollment.data.id,
    course_run_id: courseRunId,
    certificate_number: "NGF-2027-E2E0000001",
    template_version: "digital-v1",
    display_name: "Selma Dahl",
    course_title: "Trener 3 · 2026–2027",
    completed_on: "2027-12-18",
  });
  if (certificate.error) throw certificate.error;
});

test("student sees, celebrates and downloads only her own diploma", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/test-login?as=student-selma");
  await page.goto("/student/certificates");

  await expect(
    page.getByRole("heading", { name: "Mine diplomer" }),
  ).toBeVisible();
  await expect(page.getByText("Trener 3 · 2026–2027").first()).toBeVisible();
  const download = page.getByRole("link", { name: "Last ned PDF" });
  await expect(download).toHaveAttribute(
    "href",
    /\/storage\/v1\/object\/sign\/certificates\//,
  );
  const diplomaUrl = await download.getAttribute("href");
  if (!diplomaUrl) throw new Error("Diploma URL missing");
  const diplomaResponse = await page.request.get(diplomaUrl);
  expect(diplomaResponse.ok()).toBe(true);
  const diploma = await PDFDocument.load(await diplomaResponse.body());
  expect(diploma.getPage(0).getWidth()).toBeCloseTo(595.28, 1);
  expect(diploma.getPage(0).getHeight()).toBeCloseTo(841.89, 1);

  const celebrate = page.getByRole("button", { name: "Feir fullføringen" });
  await celebrate.click();
  await expect(page.getByTestId("certificate-celebration")).toHaveAttribute(
    "data-celebrated",
    "true",
  );

  const results = await new AxeBuilder({ page }).analyze();
  expect(
    results.violations.filter(
      ({ impact }) => impact === "serious" || impact === "critical",
    ),
  ).toEqual([]);
});
