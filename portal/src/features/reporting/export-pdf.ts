import {
  PDFDocument,
  StandardFonts,
  rgb,
  type PDFFont,
  type PDFPage,
} from "pdf-lib";

import type { ReportTable } from "./report-builders";

const A4_LANDSCAPE: [number, number] = [841.89, 595.28];
const MARGIN = 40;
const ROW_HEIGHT = 16;
const CELL_SIZE = 9;
const INK = rgb(16 / 255, 34 / 255, 27 / 255);
const MUTED = rgb(95 / 255, 107 / 255, 101 / 255);

function fitText(
  text: string,
  font: PDFFont,
  size: number,
  maxWidth: number,
): string {
  if (font.widthOfTextAtSize(text, size) <= maxWidth) return text;
  let cut = text;
  while (cut.length > 1 && font.widthOfTextAtSize(`${cut}…`, size) > maxWidth) {
    cut = cut.slice(0, -1);
  }
  return `${cut}…`;
}

function wrapText(
  text: string,
  font: PDFFont,
  size: number,
  maxWidth: number,
): string[] {
  const words = text.split(" ");
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (font.widthOfTextAtSize(candidate, size) <= maxWidth) {
      current = candidate;
    } else {
      if (current) lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  return lines;
}

export async function generateReportPdf(
  table: ReportTable,
): Promise<Uint8Array<ArrayBuffer>> {
  const pdf = await PDFDocument.create();
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const generatedAt = new Date(table.generatedAt);

  pdf.setTitle(`${table.definition.label} - ${table.courseTitle}`);
  pdf.setAuthor("Norges Golfforbund");
  pdf.setCreator("Trenerløftet");
  pdf.setProducer("Trenerløftet rapportgenerator");
  pdf.setCreationDate(generatedAt);
  pdf.setModificationDate(generatedAt);

  const pageWidth = A4_LANDSCAPE[0];
  const usableWidth = pageWidth - MARGIN * 2;
  const columnWidth = usableWidth / Math.max(table.columns.length, 1);

  let page: PDFPage | undefined;
  let cursorY = 0;

  const drawPageHeader = (target: PDFPage) => {
    target.drawText(
      fitText(
        `${table.definition.label} – ${table.courseTitle}`,
        bold,
        13,
        usableWidth,
      ),
      {
        x: MARGIN,
        y: A4_LANDSCAPE[1] - MARGIN,
        size: 13,
        font: bold,
        color: INK,
      },
    );
    return A4_LANDSCAPE[1] - MARGIN - 22;
  };

  const drawColumnHeader = () => {
    if (!page) return;
    table.columns.forEach((column, index) => {
      page?.drawText(fitText(column, bold, CELL_SIZE, columnWidth - 6), {
        x: MARGIN + index * columnWidth,
        y: cursorY,
        size: CELL_SIZE,
        font: bold,
        color: INK,
      });
    });
    cursorY -= ROW_HEIGHT;
  };

  const newPage = () => {
    page = pdf.addPage(A4_LANDSCAPE);
    cursorY = drawPageHeader(page);
  };

  newPage();

  const metaLines = [
    table.definition.description,
    `Filtre: ${table.filters.join(" · ")}`,
    ...table.summary,
    `Definisjon (versjon ${table.definition.formulaVersion}): ${table.definition.formula}`,
    `Generert: ${table.generatedAt}`,
  ].flatMap((line) => wrapText(line, regular, 9.5, usableWidth));
  for (const line of metaLines) {
    page?.drawText(line, {
      x: MARGIN,
      y: cursorY,
      size: 9.5,
      font: regular,
      color: MUTED,
    });
    cursorY -= 13;
  }
  cursorY -= 8;

  drawColumnHeader();
  for (const row of table.rows) {
    if (cursorY < MARGIN + ROW_HEIGHT) {
      newPage();
      cursorY -= 4;
      drawColumnHeader();
    }
    row.forEach((cell, index) => {
      page?.drawText(
        fitText(String(cell), regular, CELL_SIZE, columnWidth - 6),
        {
          x: MARGIN + index * columnWidth,
          y: cursorY,
          size: CELL_SIZE,
          font: regular,
          color: INK,
        },
      );
    });
    cursorY -= ROW_HEIGHT;
  }

  const pages = pdf.getPages();
  pages.forEach((target, index) => {
    const label = `Side ${index + 1} av ${pages.length}`;
    target.drawText(label, {
      x: pageWidth - MARGIN - regular.widthOfTextAtSize(label, 9),
      y: MARGIN / 2,
      size: 9,
      font: regular,
      color: MUTED,
    });
  });

  return (await pdf.save({
    useObjectStreams: false,
  })) as Uint8Array<ArrayBuffer>;
}
