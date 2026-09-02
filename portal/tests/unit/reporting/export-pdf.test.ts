import { describe, expect, it } from "vitest";

import { reportDefinitions } from "@/features/reporting/definitions";
import { generateReportPdf } from "@/features/reporting/export-pdf";
import type { ReportTable } from "@/features/reporting/report-builders";
import { winAnsiSafe } from "@/lib/win-ansi";

const table: ReportTable = {
  definition: reportDefinitions.course_progress,
  courseTitle: "Trener 3 · 2026–2027",
  generatedAt: "2026-09-02T10:00:00.000Z",
  filters: ["Status: alle"],
  summary: ["Kullsnitt progresjon (ekskl. trukket): 50 %"],
  columns: ["Navn", "Klubb", "Progresjon (%)", "Status"],
  rows: [
    ["Michał Woźniak", "Ávjovári golfklubb", 100, "Aktiv"],
    ["Áile Guttorm Ŋávdi", "Klubb\nmed linjeskift", 50, "Aktiv"],
    ["Дмитрий Иванов", "Æbeltoft Golfklubb Øst-Ås", 0, "Aktiv"],
  ],
};

describe("winAnsiSafe", () => {
  it("keeps Norwegian and CP1252 characters unchanged", () => {
    expect(winAnsiSafe("Åse Sørbø – Ærlig café")).toBe(
      "Åse Sørbø – Ærlig café",
    );
  });

  it("transliterates or strips codepoints WinAnsi cannot encode", () => {
    expect(winAnsiSafe("Michał Woźniak")).toBe("Michal Wozniak");
    expect(winAnsiSafe("Čáhcesuolu đŋŧ")).toBe("Cáhcesuolu dnt");
    expect(winAnsiSafe("Дмитрий")).toBe("???????");
  });

  it("collapses whitespace including line breaks", () => {
    expect(winAnsiSafe("A\nB")).toBe("A B");
    expect(winAnsiSafe("  A \t\r\n B ")).toBe("A B");
  });
});

describe("generateReportPdf", () => {
  it("renders rows with non-WinAnsi characters and line breaks without throwing", async () => {
    const bytes = await generateReportPdf(table);
    expect(new TextDecoder().decode(bytes.slice(0, 8))).toMatch(/^%PDF-/);
  });
});
