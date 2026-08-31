import { readFile } from "node:fs/promises";
import path from "node:path";

import { PDFDocument, StandardFonts, type PDFFont, rgb } from "pdf-lib";

export type DiplomaInput = Readonly<{
  templateVersion: string;
  displayName: string;
  courseTitle: string;
  completedOn: string;
  certificateNumber: string;
}>;

export type DiplomaContent = Readonly<{
  recipient: string;
  course: string;
  completedDate: string;
  certificateNumber: string;
  templateVersion: string;
}>;

export type DiplomaTemplate = Readonly<{
  level: 1 | 2 | 3;
  filename: `trener-${1 | 2 | 3}.jpg`;
  recipientY: number;
  completedDateY: number;
}>;

const MONTHS = [
  "januar",
  "februar",
  "mars",
  "april",
  "mai",
  "juni",
  "juli",
  "august",
  "september",
  "oktober",
  "november",
  "desember",
] as const;

const A4_PORTRAIT: [number, number] = [595.28, 841.89];

const TEMPLATES: Readonly<Record<1 | 2 | 3, DiplomaTemplate>> = {
  1: {
    level: 1,
    filename: "trener-1.jpg",
    recipientY: 458,
    completedDateY: 344,
  },
  2: {
    level: 2,
    filename: "trener-2.jpg",
    recipientY: 458,
    completedDateY: 344,
  },
  3: {
    level: 3,
    filename: "trener-3.jpg",
    recipientY: 426,
    completedDateY: 317,
  },
};

function completedAtNoonUtc(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) throw new Error("completedOn må være en gyldig ISO-dato");

  const [, yearText, monthText, dayText] = match;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const date = new Date(Date.UTC(year, month - 1, day, 12));

  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    throw new Error("completedOn må være en gyldig ISO-dato");
  }

  return date;
}

function centeredX(text: string, font: PDFFont, size: number, width: number) {
  return (width - font.widthOfTextAtSize(text, size)) / 2;
}

function fitSize(
  text: string,
  font: PDFFont,
  preferredSize: number,
  minimumSize: number,
  maximumWidth: number,
) {
  let size = preferredSize;
  while (
    size > minimumSize &&
    font.widthOfTextAtSize(text, size) > maximumWidth
  ) {
    size -= 1;
  }
  return size;
}

export function diplomaTemplateForCourse(courseTitle: string): DiplomaTemplate {
  const match = /(?:trener\s*|t)([123])(?:\b|\s|·|–|-)/i.exec(courseTitle);
  const level = match ? Number(match[1]) : 0;

  if (level !== 1 && level !== 2 && level !== 3) {
    throw new Error("DIPLOMA_LEVEL_NOT_SUPPORTED");
  }

  return TEMPLATES[level];
}

export function buildDiplomaContent(input: DiplomaInput): DiplomaContent {
  const completedAt = completedAtNoonUtc(input.completedOn);

  return {
    recipient: input.displayName.trim(),
    course: input.courseTitle.trim(),
    completedDate: `${completedAt.getUTCDate()}. ${MONTHS[completedAt.getUTCMonth()]} ${completedAt.getUTCFullYear()}`,
    certificateNumber: input.certificateNumber.trim(),
    templateVersion: input.templateVersion.trim(),
  };
}

export async function generateDiploma(input: DiplomaInput) {
  const content = buildDiplomaContent(input);
  const template = diplomaTemplateForCourse(content.course);
  const stableDate = completedAtNoonUtc(input.completedOn);
  const templateBytes = await readFile(
    path.join(process.cwd(), "public", "diplomas", template.filename),
  );
  const pdf = await PDFDocument.create();
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const background = await pdf.embedJpg(Uint8Array.from(templateBytes));
  const page = pdf.addPage(A4_PORTRAIT);
  const { width, height } = page.getSize();
  const ink = rgb(20 / 255, 28 / 255, 25 / 255);

  pdf.setTitle(`Diplom - ${content.recipient}`);
  pdf.setAuthor("Norges Golfforbund");
  pdf.setSubject(
    `${content.recipient} har fullført ${content.course}. Diplomnummer ${content.certificateNumber}.`,
  );
  pdf.setCreator("Trenerløftet");
  pdf.setProducer("Trenerløftet diploma generator");
  pdf.setKeywords([
    "Norges Golfforbund",
    "Trenerløftet",
    `Trener ${template.level}`,
    content.certificateNumber,
  ]);
  pdf.setCreationDate(stableDate);
  pdf.setModificationDate(stableDate);

  page.drawImage(background, { x: 0, y: 0, width, height });

  const recipientSize = fitSize(content.recipient, bold, 21, 14, width - 145);
  page.drawText(content.recipient, {
    x: centeredX(content.recipient, bold, recipientSize, width),
    y: template.recipientY,
    size: recipientSize,
    font: bold,
    color: ink,
  });

  page.drawText(content.completedDate, {
    x: centeredX(content.completedDate, regular, 13, width),
    y: template.completedDateY,
    size: 13,
    font: regular,
    color: ink,
  });

  return pdf.save({ useObjectStreams: false });
}
