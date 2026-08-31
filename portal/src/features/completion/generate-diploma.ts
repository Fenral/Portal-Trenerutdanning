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
  const stableDate = completedAtNoonUtc(input.completedOn);
  const pdf = await PDFDocument.create();
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const page = pdf.addPage([841.89, 595.28]);
  const { width, height } = page.getSize();

  const ink = rgb(16 / 255, 34 / 255, 27 / 255);
  const green = rgb(57 / 255, 114 / 255, 78 / 255);
  const softGreen = rgb(230 / 255, 236 / 255, 232 / 255);
  const canvas = rgb(247 / 255, 249 / 255, 248 / 255);
  const muted = rgb(89 / 255, 105 / 255, 98 / 255);

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
    content.course,
    content.certificateNumber,
  ]);
  pdf.setCreationDate(stableDate);
  pdf.setModificationDate(stableDate);

  page.drawRectangle({ x: 0, y: 0, width, height, color: canvas });
  page.drawRectangle({
    x: 28,
    y: 28,
    width: width - 56,
    height: height - 56,
    borderColor: green,
    borderWidth: 2,
  });
  page.drawRectangle({
    x: 44,
    y: 44,
    width: width - 88,
    height: height - 88,
    borderColor: softGreen,
    borderWidth: 1,
  });

  page.drawText("TRENERLØFTET", {
    x: 64,
    y: height - 83,
    size: 11,
    font: bold,
    color: green,
  });
  page.drawText("NORGES GOLFFORBUND", {
    x: width - 194,
    y: height - 83,
    size: 9,
    font: bold,
    color: muted,
  });

  page.drawText("DIPLOM", {
    x: centeredX("DIPLOM", bold, 48, width),
    y: 410,
    size: 48,
    font: bold,
    color: ink,
  });
  page.drawText("tildeles", {
    x: centeredX("tildeles", regular, 14, width),
    y: 370,
    size: 14,
    font: regular,
    color: muted,
  });

  const recipientSize = fitSize(content.recipient, bold, 36, 23, width - 180);
  page.drawText(content.recipient, {
    x: centeredX(content.recipient, bold, recipientSize, width),
    y: 310,
    size: recipientSize,
    font: bold,
    color: green,
  });

  page.drawLine({
    start: { x: 190, y: 287 },
    end: { x: width - 190, y: 287 },
    thickness: 1,
    color: softGreen,
  });

  page.drawText("for fullført trenerutdanning", {
    x: centeredX("for fullført trenerutdanning", regular, 14, width),
    y: 248,
    size: 14,
    font: regular,
    color: muted,
  });
  const courseSize = fitSize(content.course, bold, 25, 18, width - 190);
  page.drawText(content.course, {
    x: centeredX(content.course, bold, courseSize, width),
    y: 205,
    size: courseSize,
    font: bold,
    color: ink,
  });

  page.drawRectangle({
    x: width / 2 - 115,
    y: 115,
    width: 230,
    height: 44,
    color: softGreen,
  });
  page.drawText(`Fullført ${content.completedDate}`, {
    x: centeredX(`Fullført ${content.completedDate}`, bold, 11, width),
    y: 132,
    size: 11,
    font: bold,
    color: green,
  });

  page.drawText(`Diplomnr. ${content.certificateNumber}`, {
    x: 64,
    y: 66,
    size: 8,
    font: regular,
    color: muted,
  });
  page.drawText(`Mal ${content.templateVersion}`, {
    x: width - 132,
    y: 66,
    size: 8,
    font: regular,
    color: muted,
  });

  return pdf.save({ useObjectStreams: false });
}
