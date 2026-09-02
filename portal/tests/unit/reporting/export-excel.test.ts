import { strFromU8, unzipSync } from "fflate";
import { describe, expect, it } from "vitest";

import { reportDefinitions } from "@/features/reporting/definitions";
import {
  generateReportWorkbook,
  needsQuotePrefix,
} from "@/features/reporting/export-excel";
import {
  formatOsloDateTime,
  reportMetaLines,
} from "@/features/reporting/report-meta";
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

// Metadata + overskrift over dataradene: header-raden ligger rett under metaen.
const metaCount = reportMetaLines(table).length;
const headerRow = metaCount + 1;
const lastRow = headerRow + table.rows.length;

function fileXml(workbook: Uint8Array, path: string): string {
  const files = unzipSync(workbook);
  return strFromU8(files[path]);
}

function sheetXml(workbook: Uint8Array): string {
  return fileXml(workbook, "xl/worksheets/sheet1.xml");
}

describe("report Excel export", () => {
  it("flags cell values starting with = + - @ for quote-prefixing", () => {
    expect(needsQuotePrefix("=SUM(A1)")).toBe(true);
    expect(needsQuotePrefix("+47 900 00 000")).toBe(true);
    expect(needsQuotePrefix("-1")).toBe(true);
    expect(needsQuotePrefix("@handle")).toBe(true);
    expect(needsQuotePrefix("Trygg tekst")).toBe(false);
  });

  it("writes injection-risky cells with a quotePrefix style, not a literal apostrophe", () => {
    const workbook = generateReportWorkbook(table);
    const xml = sheetXml(workbook);
    const styles = fileXml(workbook, "xl/styles.xml");

    expect(styles).toContain('quotePrefix="1"');
    expect(xml).toMatch(
      /<c r="A\d+" s="2" t="inlineStr"><is><t xml:space="preserve">=HYPERLINK/,
    );
    expect(xml).not.toContain("&apos;=HYPERLINK");
    expect(xml).not.toContain("&apos;+47 Ola");
    expect(xml).toContain("&quot;https://ond.example&quot;");
  });

  it("writes provenance metadata (description, filters, summary, formula, generated) above the table", () => {
    const xml = sheetXml(generateReportWorkbook(table));

    expect(xml).toContain(table.definition.description);
    expect(xml).toContain("Filtre: Status: alle");
    expect(xml).toContain("Kullsnitt progresjon (ekskl. trukket): 50 %");
    expect(xml).toContain("Definisjon (versjon 2026.1):");
    expect(xml).toContain(`Generert: ${formatOsloDateTime(table.generatedAt)}`);
    expect(xml).not.toContain("2026-09-02T10:00:00.000Z");
  });

  it("freezes through the header row and filters the full data range", () => {
    const xml = sheetXml(generateReportWorkbook(table));

    expect(xml).toContain("Navn");
    expect(xml).toContain("Progresjon (%)");
    expect(xml).toContain(`ySplit="${headerRow}"`);
    expect(xml).toContain(`topLeftCell="A${headerRow + 1}"`);
    expect(xml).toContain('state="frozen"');
    expect(xml).toContain(`<autoFilter ref="A${headerRow}:D${lastRow}"/>`);
    expect(xml).toContain(`<dimension ref="A1:D${lastRow}"/>`);
    expect(xml.match(/<row /g)?.length).toBe(lastRow);
  });

  it("is deterministic and a valid zip", () => {
    const first = generateReportWorkbook(table);
    const second = generateReportWorkbook(table);

    expect(new TextDecoder().decode(first.slice(0, 2))).toBe("PK");
    expect(Buffer.from(first).equals(Buffer.from(second))).toBe(true);
  });

  it("strips XML-illegal control characters so Excel accepts the file", () => {
    const dirty = `Klubb${String.fromCharCode(1)}med${String.fromCharCode(11)}GK`;
    const workbook = generateReportWorkbook({
      ...table,
      rows: [[dirty, "x@example.no", 10, "Aktiv"]],
    });
    const xml = sheetXml(workbook);

    expect(xml).toContain("KlubbmedGK");
    for (const code of [1, 8, 11, 12, 14, 31, 127]) {
      expect(xml).not.toContain(String.fromCharCode(code));
    }
  });
});
