import type { ReportTable } from "./report-builders";
import { reportMetaLines } from "./report-meta";
import {
  columnName,
  numberCell,
  packageWorkbook,
  rowXml,
  textCell,
} from "./xlsx";

/**
 * Formelinjeksjonsvern: celleverdier som stammer fra bruker- eller
 * importdata og starter med = + - @ skrives med quotePrefix-cellestil
 * slik at regnearket aldri tolker dem som formler, uten å endre verdien.
 */
export function needsQuotePrefix(value: string): boolean {
  return /^[=+\-@]/.test(value);
}

const STYLES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <fonts count="2">
    <font><sz val="11"/><name val="Calibri"/><family val="2"/></font>
    <font><b/><sz val="11"/><name val="Calibri"/><family val="2"/></font>
  </fonts>
  <fills count="3">
    <fill><patternFill patternType="none"/></fill>
    <fill><patternFill patternType="gray125"/></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFE6ECE8"/><bgColor indexed="64"/></patternFill></fill>
  </fills>
  <borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>
  <cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
  <cellXfs count="3">
    <xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
    <xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyAlignment="1"><alignment vertical="center"/></xf>
    <xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0" quotePrefix="1"/>
  </cellXfs>
  <cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
</styleSheet>`;

function sheetName(label: string): string {
  const cleaned = label.replace(/[\\/*?:[\]]/g, " ").trim();
  return cleaned.slice(0, 31) || "Rapport";
}

export function generateReportWorkbook(
  table: ReportTable,
): Uint8Array<ArrayBuffer> {
  const columnCount = table.columns.length;
  const metaLines = reportMetaLines(table);
  const headerRow = metaLines.length + 1;
  const rows: string[] = metaLines.map((line, index) =>
    rowXml(index + 1, [textCell(1, index + 1, line)]),
  );
  rows.push(
    rowXml(
      headerRow,
      table.columns.map((column, index) =>
        textCell(index + 1, headerRow, column, 1),
      ),
      22,
    ),
  );

  table.rows.forEach((row, rowIndex) => {
    const rowNumber = headerRow + rowIndex + 1;
    rows.push(
      rowXml(
        rowNumber,
        row.map((cell, cellIndex) =>
          typeof cell === "number"
            ? numberCell(cellIndex + 1, rowNumber, cell)
            : textCell(
                cellIndex + 1,
                rowNumber,
                cell,
                needsQuotePrefix(cell) ? 2 : 0,
              ),
        ),
      ),
    );
  });

  const lastColumn = columnName(Math.max(columnCount, 1));
  const lastRow = headerRow + table.rows.length;
  const worksheetXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <dimension ref="A1:${lastColumn}${lastRow}"/>
  <sheetViews><sheetView workbookViewId="0"><pane ySplit="${headerRow}" topLeftCell="A${headerRow + 1}" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>
  <sheetFormatPr defaultRowHeight="16"/>
  <cols><col min="1" max="${Math.max(columnCount, 1)}" width="22" customWidth="1"/></cols>
  <sheetData>${rows.join("")}</sheetData>
  <autoFilter ref="A${headerRow}:${lastColumn}${lastRow}"/>
  <pageMargins left="0.25" right="0.25" top="0.5" bottom="0.5" header="0.2" footer="0.2"/>
</worksheet>`;

  return packageWorkbook({
    sheetName: sheetName(table.definition.label),
    worksheetXml,
    stylesXml: STYLES,
    title: table.definition.label,
  });
}
