import { existsSync, readFileSync } from "node:fs";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { strFromU8, unzipSync, unzlibSync } from "fflate";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { generateReportWorkbook } from "@/features/reporting/export-excel";
import { generateReportPdf } from "@/features/reporting/export-pdf";
import {
  buildReport,
  canExportCourseReport,
  type ReportTable,
} from "@/features/reporting/report-builders";

const t3CourseRunId = "b1030000-0000-0000-0000-000000000001";
const t1CourseRunId = "b1010000-0000-0000-0000-000000000001";
const unknownCourseRunId = "b1990000-0000-0000-0000-000000000009";
const leadT3ProfileId = "c0000000-0000-0000-0000-000000000004";
const studentProfileId = "c0000000-0000-0000-0000-000000000005";
const withdrawnProfileId = "c0000000-0000-0000-0000-000000000017";
const injectionProfileId = "c0000000-0000-0000-0000-000000000018";

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
  if (!value)
    throw new Error(`Missing integration environment variable: ${name}`);
  return value;
}

function assertNoError(error: { message: string } | null): void {
  if (error) throw new Error(error.message);
}

function worksheetXml(workbook: Uint8Array): string {
  return strFromU8(unzipSync(workbook)["xl/worksheets/sheet1.xml"]);
}

/** Trekker all tegnet tekst ut av en pdf-lib-generert PDF. */
function pdfTextContent(bytes: Uint8Array): string {
  const raw = Buffer.from(bytes).toString("latin1");
  const texts: string[] = [];
  const streamPattern = /stream\r?\n/g;
  let match: RegExpExecArray | null;
  while ((match = streamPattern.exec(raw))) {
    const start = match.index + match[0].length;
    let end = raw.indexOf("endstream", start);
    if (end < 0) continue;
    while (
      end > start &&
      (bytes[end - 1] === 0x0a || bytes[end - 1] === 0x0d)
    ) {
      end -= 1;
    }
    let content: string;
    try {
      content = Buffer.from(unzlibSync(bytes.subarray(start, end))).toString(
        "latin1",
      );
    } catch {
      content = raw.slice(start, end);
    }
    for (const hex of content.matchAll(/<([0-9A-Fa-f]+)>\s*Tj/g)) {
      const encoded = hex[1];
      let decoded = "";
      for (let index = 0; index + 1 < encoded.length; index += 2) {
        decoded += String.fromCharCode(
          Number.parseInt(encoded.slice(index, index + 2), 16),
        );
      }
      texts.push(decoded);
    }
    for (const literal of content.matchAll(/\(((?:\\.|[^\\)])*)\)\s*Tj/g)) {
      texts.push(literal[1].replace(/\\([()\\])/g, "$1"));
    }
  }
  return texts.join("\n");
}

async function enrollmentIdFor(
  adminClient: SupabaseClient,
  profileId: string,
): Promise<string> {
  const result = await adminClient
    .from("enrollments")
    .select("id")
    .eq("course_run_id", t3CourseRunId)
    .eq("profile_id", profileId)
    .single();
  assertNoError(result.error);
  if (!result.data) throw new Error("Enrollment not found");
  return result.data.id;
}

async function userIdFor(
  adminClient: SupabaseClient,
  profileId: string,
): Promise<string> {
  const result = await adminClient
    .from("user_accounts")
    .select("user_id")
    .eq("profile_id", profileId)
    .eq("is_active", true)
    .single();
  assertNoError(result.error);
  if (!result.data) throw new Error("User account not found");
  return result.data.user_id;
}

function progressColumn(table: ReportTable): number {
  return table.columns.indexOf("Progresjon (%)");
}

describe.sequential("course report exports", () => {
  let adminClient: SupabaseClient;
  let withdrawnEnrollmentId: string;
  let originalClubName: string | null = null;

  beforeAll(async () => {
    loadLocalEnvironment();
    adminClient = createClient(
      requiredEnvironment("NEXT_PUBLIC_SUPABASE_URL"),
      requiredEnvironment("SUPABASE_SECRET_KEY"),
      { auth: { autoRefreshToken: false, persistSession: false } },
    );
    withdrawnEnrollmentId = await enrollmentIdFor(
      adminClient,
      withdrawnProfileId,
    );
    const club = await adminClient
      .from("profiles")
      .select("club_name")
      .eq("id", injectionProfileId)
      .single();
    assertNoError(club.error);
    originalClubName = club.data?.club_name ?? null;
  });

  afterAll(async () => {
    if (!adminClient) return;
    await adminClient
      .from("enrollments")
      .update({ status: "active", status_reason: null })
      .eq("id", withdrawnEnrollmentId);
    await adminClient
      .from("profiles")
      .update({ club_name: originalClubName })
      .eq("id", injectionProfileId);
  });

  it("exports the same course_progress rows to Excel and PDF as the builder", async () => {
    const table = await buildReport(
      adminClient,
      "course_progress",
      t3CourseRunId,
    );
    expect(table.definition.id).toBe("course_progress");
    expect(table.rows.length).toBeGreaterThanOrEqual(20);
    expect(table.columns).toContain("Progresjon (%)");

    const xml = worksheetXml(generateReportWorkbook(table));
    expect(xml.match(/<row /g)?.length).toBe(table.rows.length + 1);
    for (const row of table.rows) {
      expect(xml).toContain(String(row[0]));
    }
    expect(xml).toContain("Håkon Lie");

    const pdfText = pdfTextContent(await generateReportPdf(table));
    expect(pdfText).toContain("Kursstatus og progresjon");
    expect(pdfText).toContain("Trener 3");
    expect(pdfText).toContain("versjon 2026.1");
    expect(pdfText).toContain("Side 1 av");
    for (const row of table.rows) {
      expect(pdfText).toContain(String(row[0]).slice(0, 10));
    }
  });

  it("keeps Norwegian characters intact in both formats", async () => {
    const table = await buildReport(
      adminClient,
      "course_progress",
      t3CourseRunId,
    );
    const names = table.rows.map((row) => String(row[0])).join(" ");
    expect(names).toMatch(/[æøåÆØÅ]/);

    const xml = worksheetXml(generateReportWorkbook(table));
    const pdfText = pdfTextContent(await generateReportPdf(table));
    const norwegianName = table.rows
      .map((row) => String(row[0]))
      .find((name) => /[æøå]/i.test(name.slice(0, 10)));
    if (!norwegianName) throw new Error("Expected a Norwegian name in seed");
    expect(xml).toContain(norwegianName);
    expect(pdfText).toContain(norwegianName.slice(0, 10));
  });

  it("excludes withdrawn from the cohort average but keeps the row with explicit status", async () => {
    const update = await adminClient
      .from("enrollments")
      .update({ status: "withdrawn", status_reason: "Integrasjonstest" })
      .eq("id", withdrawnEnrollmentId);
    assertNoError(update.error);

    const table = await buildReport(
      adminClient,
      "course_progress",
      t3CourseRunId,
    );
    const statusIndex = table.columns.indexOf("Status");
    const progressIndex = progressColumn(table);
    const withdrawnRows = table.rows.filter(
      (row) => row[statusIndex] === "Trukket",
    );
    expect(withdrawnRows.length).toBe(1);

    const activeRows = table.rows.filter(
      (row) => row[statusIndex] !== "Trukket",
    );
    const expectedAverage = Math.round(
      activeRows.reduce((sum, row) => sum + Number(row[progressIndex]), 0) /
        activeRows.length,
    );
    expect(table.summary[0]).toBe(
      `Kullsnitt progresjon (ekskl. trukket): ${expectedAverage} %`,
    );

    const xml = worksheetXml(generateReportWorkbook(table));
    expect(xml).toContain("Trukket");
    expect(xml.match(/<row /g)?.length).toBe(table.rows.length + 1);
  });

  it("prefixes imported cell values that start with a formula character", async () => {
    const update = await adminClient
      .from("profiles")
      .update({ club_name: '=HYPERLINK("https://ond.example")' })
      .eq("id", injectionProfileId);
    assertNoError(update.error);

    const table = await buildReport(
      adminClient,
      "course_progress",
      t3CourseRunId,
    );
    const xml = worksheetXml(generateReportWorkbook(table));
    expect(xml).toContain("&apos;=HYPERLINK");
    expect(xml).not.toMatch(/<is><t[^>]*>=HYPERLINK/);
  });

  it("builds and exports every report type without errors", async () => {
    const { REPORT_TYPES } = await import("@/features/reporting/definitions");
    for (const type of REPORT_TYPES) {
      const table = await buildReport(adminClient, type, t3CourseRunId);
      expect(table.definition.id).toBe(type);
      expect(table.columns.length).toBeGreaterThan(0);
      const xml = worksheetXml(generateReportWorkbook(table));
      expect(xml.match(/<row /g)?.length).toBe(table.rows.length + 1);
      const pdfText = pdfTextContent(await generateReportPdf(table));
      expect(pdfText).toContain(table.definition.label);
    }
  });

  it("denies export of a foreign or unknown course in the builder layer (404 behavior)", async () => {
    const leadUserId = await userIdFor(adminClient, leadT3ProfileId);
    const studentUserId = await userIdFor(adminClient, studentProfileId);

    await expect(
      canExportCourseReport(adminClient, leadUserId, t3CourseRunId),
    ).resolves.toBe(true);
    await expect(
      canExportCourseReport(adminClient, leadUserId, t1CourseRunId),
    ).resolves.toBe(false);
    await expect(
      canExportCourseReport(adminClient, leadUserId, unknownCourseRunId),
    ).resolves.toBe(false);
    await expect(
      canExportCourseReport(adminClient, studentUserId, t3CourseRunId),
    ).resolves.toBe(false);

    await expect(
      buildReport(adminClient, "course_progress", unknownCourseRunId),
    ).rejects.toThrow("REPORT_COURSE_NOT_FOUND");
  });
});
