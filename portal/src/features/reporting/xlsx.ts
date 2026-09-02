import { strToU8, zipSync, type Zippable } from "fflate";

/**
 * Delt minimal XLSX-writer bygget på fflate. Brukes av både NIF-rapporten
 * og de generelle kursrapportene.
 */

export function escapeXml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

export function columnName(index: number) {
  let value = index;
  let result = "";
  while (value > 0) {
    value -= 1;
    result = String.fromCharCode(65 + (value % 26)) + result;
    value = Math.floor(value / 26);
  }
  return result;
}

export function textCell(
  column: number,
  row: number,
  value: string,
  style = 0,
) {
  return `<c r="${columnName(column)}${row}" s="${style}" t="inlineStr"><is><t xml:space="preserve">${escapeXml(value)}</t></is></c>`;
}

export function numberCell(
  column: number,
  row: number,
  value: number,
  style = 0,
) {
  return `<c r="${columnName(column)}${row}" s="${style}"><v>${Number(value.toFixed(2))}</v></c>`;
}

export function formulaCell(
  column: number,
  row: number,
  formula: string,
  style = 0,
) {
  return `<c r="${columnName(column)}${row}" s="${style}"><f>${escapeXml(formula)}</f></c>`;
}

export function rowXml(row: number, cells: readonly string[], height?: number) {
  const heightAttribute = height ? ` ht="${height}" customHeight="1"` : "";
  return `<row r="${row}"${heightAttribute}>${cells.join("")}</row>`;
}

const CONTENT_TYPES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
  <Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
  <Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>
  <Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>
</Types>`;

const ROOT_RELS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>
  <Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/>
</Relationships>`;

const WORKBOOK_RELS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`;

const APP_PROPERTIES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes"><Application>Trenerløftet</Application></Properties>`;

export type WorkbookInput = Readonly<{
  sheetName: string;
  worksheetXml: string;
  stylesXml: string;
  title: string;
}>;

export function packageWorkbook(input: WorkbookInput): Uint8Array<ArrayBuffer> {
  const workbookXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <bookViews><workbookView/></bookViews>
  <sheets><sheet name="${escapeXml(input.sheetName)}" sheetId="1" r:id="rId1"/></sheets>
  <calcPr calcId="191029" fullCalcOnLoad="1"/>
</workbook>`;
  const coreProperties = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <dc:title>${escapeXml(input.title)}</dc:title><dc:creator>Trenerløftet</dc:creator><cp:lastModifiedBy>Trenerløftet</cp:lastModifiedBy>
  <dcterms:created xsi:type="dcterms:W3CDTF">2026-01-01T00:00:00Z</dcterms:created><dcterms:modified xsi:type="dcterms:W3CDTF">2026-01-01T00:00:00Z</dcterms:modified>
</cp:coreProperties>`;

  const stableMtime = new Date("2026-01-01T00:00:00.000Z");
  const file = (value: string): Zippable[string] => [
    strToU8(value),
    { level: 6, mtime: stableMtime },
  ];
  const files: Zippable = {
    "[Content_Types].xml": file(CONTENT_TYPES),
    "_rels/.rels": file(ROOT_RELS),
    "docProps/app.xml": file(APP_PROPERTIES),
    "docProps/core.xml": file(coreProperties),
    "xl/workbook.xml": file(workbookXml),
    "xl/_rels/workbook.xml.rels": file(WORKBOOK_RELS),
    "xl/styles.xml": file(input.stylesXml),
    "xl/worksheets/sheet1.xml": file(input.worksheetXml),
  };

  return zipSync(files, { level: 6 }) as Uint8Array<ArrayBuffer>;
}
