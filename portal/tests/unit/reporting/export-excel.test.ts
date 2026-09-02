import { strFromU8, unzipSync } from "fflate";
import { describe, expect, it } from "vitest";

import { reportDefinitions } from "@/features/reporting/definitions";
import {
  excelSafeText,
  generateReportWorkbook,
} from "@/features/reporting/export-excel";
import type { ReportTable } from "@/features/reporting/report-builders";

const table: ReportTable = {
  definition: reportDefinitions.course_progress,
  courseTitle: "Trener 3 · 2026–2027",
  generatedAt: "2026-09-02T10:00:00.000Z",
  filters: ["Status: alle"],
  summary: ["Kullsnitt progresjon (ekskl. trukket): 50 %"],
  columns: ["Navn", "E-post", "Progresjon (%)", "Status"],
  rows: [
    ["Åse Sørbø", "aase@example.no", 100, "Aktiv"],
    ['=HYPERLINK("https://ond.example")', "x@example.no", 0, "Aktiv"],
    ["+47 Ola", "-minus@example.no", 50, "@krøll"],
  ],
};

function sheetXml(workbook: Uint8Array): string {
  const files = unzipSync(workbook);
  return strFromU8(files["xl/worksheets/sheet1.xml"]);
}

describe("report Excel export", () => {
  it("prefixes cell values starting with = + - @ with an apostrophe", () => {
    expect(excelSafeText("=SUM(A1)")).toBe("'=SUM(A1)");
    expect(excelSafeText("+47 900 00 000")).toBe("'+47 900 00 000");
    expect(excelSafeText("-1")).toBe("'-1");
    expect(excelSafeText("@handle")).toBe("'@handle");
    expect(excelSafeText("Trygg tekst")).toBe("Trygg tekst");
  });

  it("writes fixed headers, a frozen first row and injection-safe cells", () => {
    const xml = sheetXml(generateReportWorkbook(table));

    expect(xml).toContain("Navn");
    expect(xml).toContain("Progresjon (%)");
    expect(xml).toContain('ySplit="1"');
    expect(xml).toContain('state="frozen"');
    expect(xml).toContain("Åse Sørbø");
    expect(xml).toContain("&quot;https://ond.example&quot;");
    expect(xml).toContain("&apos;=HYPERLINK");
    expect(xml).toContain("&apos;+47 Ola");
    expect(xml).toContain("&apos;-minus@example.no");
    expect(xml).toContain("&apos;@krøll");
    expect(xml).not.toMatch(/<is><t[^>]*>=HYPERLINK/);
  });

  it("is deterministic and a valid zip", () => {
    const first = generateReportWorkbook(table);
    const second = generateReportWorkbook(table);

    expect(new TextDecoder().decode(first.slice(0, 2))).toBe("PK");
    expect(Buffer.from(first).equals(Buffer.from(second))).toBe(true);
  });
});
