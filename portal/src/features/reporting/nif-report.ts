import { strToU8, zipSync, type Zippable } from "fflate";

export type NifAttendance = Readonly<{
  plannedMinutes: number;
  presentMinutes: number;
}>;

export type NifReportSession = Readonly<{
  id: string;
  title: string;
  startsAt: string;
  endsAt: string;
  plannedMinutes: number;
}>;

export type NifReportParticipant = Readonly<{
  displayName: string;
  email: string;
  phone: string | null;
  attendanceBySession: Readonly<Record<string, NifAttendance | undefined>>;
}>;

export type NifReportInput = Readonly<{
  courseName: string;
  courseIds: readonly string[];
  organizerName: string;
  sessions: readonly NifReportSession[];
  participants: readonly NifReportParticipant[];
}>;

export type NifCourseDay = Readonly<{
  sessionId: string;
  sessionTitle: string;
  courseDayNumber: number;
  date: string;
  timeLabel: string;
  plannedMinutes: number;
}>;

const OSLO_DATE_PARTS = new Intl.DateTimeFormat("en-CA", {
  day: "2-digit",
  month: "2-digit",
  timeZone: "Europe/Oslo",
  year: "numeric",
});

const OSLO_TIME = new Intl.DateTimeFormat("nb-NO", {
  hour: "2-digit",
  hour12: false,
  minute: "2-digit",
  timeZone: "Europe/Oslo",
});

function partsFor(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) throw new Error("NIF_INVALID_SESSION_DATE");

  const parts = Object.fromEntries(
    OSLO_DATE_PARTS.formatToParts(date).map((part) => [part.type, part.value]),
  );
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
  };
}

function isoDate(year: number, month: number, day: number) {
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function dateRange(startsAt: string, endsAt: string): string[] {
  const start = partsFor(startsAt);
  const end = partsFor(endsAt);
  const cursor = new Date(Date.UTC(start.year, start.month - 1, start.day, 12));
  const endValue = Date.UTC(end.year, end.month - 1, end.day, 12);
  const dates: string[] = [];

  while (cursor.valueOf() <= endValue) {
    dates.push(
      isoDate(
        cursor.getUTCFullYear(),
        cursor.getUTCMonth() + 1,
        cursor.getUTCDate(),
      ),
    );
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  if (dates.length === 0 || dates.length > 60) {
    throw new Error("NIF_SESSION_DATE_RANGE_INVALID");
  }
  return dates;
}

function formatClock(value: string) {
  return OSLO_TIME.format(new Date(value)).replace(":", ".");
}

export function expandNifCourseDays(
  sessions: readonly NifReportSession[],
): NifCourseDay[] {
  let courseDayNumber = 0;

  return sessions.flatMap((session) => {
    const dates = dateRange(session.startsAt, session.endsAt);
    const minutesPerDay = session.plannedMinutes / dates.length;
    const timeLabel = `${formatClock(session.startsAt)}–${formatClock(session.endsAt)}`;

    return dates.map((date) => ({
      sessionId: session.id,
      sessionTitle: session.title,
      courseDayNumber: (courseDayNumber += 1),
      date,
      timeLabel,
      plannedMinutes: minutesPerDay,
    }));
  });
}

function escapeXml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function columnName(index: number) {
  let value = index;
  let result = "";
  while (value > 0) {
    value -= 1;
    result = String.fromCharCode(65 + (value % 26)) + result;
    value = Math.floor(value / 26);
  }
  return result;
}

function textCell(column: number, row: number, value: string, style = 5) {
  return `<c r="${columnName(column)}${row}" s="${style}" t="inlineStr"><is><t xml:space="preserve">${escapeXml(value)}</t></is></c>`;
}

function numberCell(column: number, row: number, value: number, style = 8) {
  return `<c r="${columnName(column)}${row}" s="${style}"><v>${Number(value.toFixed(2))}</v></c>`;
}

function formulaCell(column: number, row: number, formula: string, style = 8) {
  return `<c r="${columnName(column)}${row}" s="${style}"><f>${escapeXml(formula)}</f></c>`;
}

function rowXml(row: number, cells: readonly string[], height?: number) {
  const heightAttribute = height ? ` ht="${height}" customHeight="1"` : "";
  return `<row r="${row}"${heightAttribute}>${cells.join("")}</row>`;
}

function formatDate(value: string) {
  const [year, month, day] = value.split("-");
  return `${day}.${month}.${year}`;
}

function formatHours(minutes: number) {
  const hours = minutes / 60;
  return Number.isInteger(hours)
    ? String(hours)
    : hours.toLocaleString("nb-NO", {
        maximumFractionDigits: 2,
        minimumFractionDigits: 1,
      });
}

function attendanceMark(attendance: NifAttendance | undefined) {
  if (!attendance) return "";
  if (attendance.presentMinutes === attendance.plannedMinutes) return "x";
  if (attendance.presentMinutes === 0) return "o";
  return `${Math.round(
    (attendance.presentMinutes / attendance.plannedMinutes) * 100,
  )} %`;
}

export function buildNifWorksheetXml(input: NifReportInput) {
  const days = expandNifCourseDays(input.sessions);
  if (days.length === 0) throw new Error("NIF_REPORT_REQUIRES_SESSIONS");

  const firstDayColumn = 5;
  const totalColumn = firstDayColumn + days.length;
  const lastColumnName = columnName(totalColumn);
  const participantStartRow = 13;
  const participantEndRow = participantStartRow + input.participants.length - 1;
  const footerStartRow = Math.max(participantEndRow + 2, 15);
  const footerHoursRow = footerStartRow + 1;
  const rows: string[] = [];

  rows.push(
    rowXml(1, [textCell(1, 1, "Oppmøteliste for gjennomført kurs", 9)], 30),
  );
  rows.push(
    rowXml(3, [
      textCell(1, 3, "Kursnavn", 1),
      textCell(2, 3, input.courseName, 2),
    ]),
  );
  rows.push(
    rowXml(4, [
      textCell(1, 4, "KursId i Idrettskurs", 1),
      textCell(2, 4, input.courseIds.join(" / "), 2),
    ]),
  );
  rows.push(
    rowXml(5, [
      textCell(1, 5, "Totalt antall kurstimer", 1),
      textCell(
        2,
        5,
        formatHours(days.reduce((sum, day) => sum + day.plannedMinutes, 0)),
        2,
      ),
    ]),
  );
  rows.push(
    rowXml(6, [
      textCell(1, 6, "Kursarrangør (org.ledd)", 1),
      textCell(2, 6, input.organizerName, 2),
    ]),
  );

  const groupCells: string[] = [];
  let groupStart = 0;
  while (groupStart < days.length) {
    const currentSessionId = days[groupStart].sessionId;
    groupCells.push(
      textCell(
        firstDayColumn + groupStart,
        8,
        days[groupStart].sessionTitle,
        3,
      ),
    );
    let nextGroupStart = groupStart + 1;
    while (
      nextGroupStart < days.length &&
      days[nextGroupStart].sessionId === currentSessionId
    ) {
      nextGroupStart += 1;
    }
    groupStart = nextGroupStart;
  }
  rows.push(rowXml(8, groupCells, 24));

  rows.push(
    rowXml(9, [
      textCell(1, 9, "Kurs (modul)", 4),
      ...days.map((day, index) =>
        textCell(
          firstDayColumn + index,
          9,
          `Kursdag ${day.courseDayNumber}`,
          4,
        ),
      ),
      textCell(totalColumn, 9, "Totalt", 4),
    ]),
  );
  rows.push(
    rowXml(10, [
      textCell(1, 10, "Dato", 4),
      ...days.map((day, index) =>
        textCell(firstDayColumn + index, 10, formatDate(day.date), 4),
      ),
      textCell(totalColumn, 10, "Timer", 4),
    ]),
  );
  rows.push(
    rowXml(
      12,
      [
        textCell(1, 12, "Deltakere", 4),
        textCell(2, 12, "Navn", 4),
        textCell(3, 12, "E-post", 4),
        textCell(4, 12, "Telefon", 4),
        ...days.map((_, index) =>
          textCell(firstDayColumn + index, 12, "Oppmøtt", 4),
        ),
        textCell(totalColumn, 12, "Registrert", 4),
      ],
      30,
    ),
  );

  input.participants.forEach((participant, participantIndex) => {
    const row = participantStartRow + participantIndex;
    const attendanceCells = days.map((day, dayIndex) =>
      textCell(
        firstDayColumn + dayIndex,
        row,
        attendanceMark(participant.attendanceBySession[day.sessionId]),
        6,
      ),
    );
    const registeredMinutes = input.sessions.reduce((sum, session) => {
      const attendance = participant.attendanceBySession[session.id];
      return sum + (attendance?.presentMinutes ?? 0);
    }, 0);

    rows.push(
      rowXml(
        row,
        [
          textCell(1, row, "", 5),
          textCell(2, row, participant.displayName, 5),
          textCell(3, row, participant.email, 5),
          textCell(4, row, participant.phone ?? "", 5),
          ...attendanceCells,
          numberCell(totalColumn, row, registeredMinutes / 60, 8),
        ],
        22,
      ),
    );
  });

  rows.push(
    rowXml(
      footerStartRow,
      [
        textCell(1, footerStartRow, "Start- og sluttidspunkt", 7),
        ...days.map((day, index) =>
          textCell(firstDayColumn + index, footerStartRow, day.timeLabel, 6),
        ),
        textCell(totalColumn, footerStartRow, "", 7),
      ],
      26,
    ),
  );
  rows.push(
    rowXml(
      footerHoursRow,
      [
        textCell(1, footerHoursRow, "Antall timer", 7),
        ...days.map((day, index) =>
          numberCell(
            firstDayColumn + index,
            footerHoursRow,
            day.plannedMinutes / 60,
          ),
        ),
        formulaCell(
          totalColumn,
          footerHoursRow,
          `SUM(${columnName(firstDayColumn)}${footerHoursRow}:${columnName(totalColumn - 1)}${footerHoursRow})`,
        ),
      ],
      24,
    ),
  );

  const mergedCells = [
    `A1:${lastColumnName}1`,
    `B3:${lastColumnName}3`,
    `B4:${lastColumnName}4`,
    `B5:${lastColumnName}5`,
    `B6:${lastColumnName}6`,
    "A9:D9",
    "A10:D10",
    `A${footerStartRow}:D${footerStartRow}`,
    `A${footerHoursRow}:D${footerHoursRow}`,
  ];
  let sessionStart = 0;
  while (sessionStart < days.length) {
    const sessionId = days[sessionStart].sessionId;
    let sessionEnd = sessionStart;
    while (
      sessionEnd + 1 < days.length &&
      days[sessionEnd + 1].sessionId === sessionId
    ) {
      sessionEnd += 1;
    }
    if (sessionEnd > sessionStart) {
      mergedCells.push(
        `${columnName(firstDayColumn + sessionStart)}8:${columnName(firstDayColumn + sessionEnd)}8`,
      );
    }
    sessionStart = sessionEnd + 1;
  }

  const dayColumns = days
    .map((_, index) => {
      const column = firstDayColumn + index;
      return `<col min="${column}" max="${column}" width="13" customWidth="1"/>`;
    })
    .join("");

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <sheetPr><pageSetUpPr fitToPage="1"/></sheetPr>
  <dimension ref="A1:${lastColumnName}${footerHoursRow}"/>
  <sheetViews><sheetView showGridLines="0" workbookViewId="0"><pane xSplit="4" ySplit="12" topLeftCell="E13" activePane="bottomRight" state="frozen"/></sheetView></sheetViews>
  <sheetFormatPr defaultRowHeight="18"/>
  <cols>
    <col min="1" max="1" width="24" customWidth="1"/>
    <col min="2" max="2" width="30" customWidth="1"/>
    <col min="3" max="3" width="32" customWidth="1"/>
    <col min="4" max="4" width="18" customWidth="1"/>
    ${dayColumns}
    <col min="${totalColumn}" max="${totalColumn}" width="12" customWidth="1"/>
  </cols>
  <sheetData>${rows.join("")}</sheetData>
  <mergeCells count="${mergedCells.length}">${mergedCells
    .map((reference) => `<mergeCell ref="${reference}"/>`)
    .join("")}</mergeCells>
  <pageMargins left="0.25" right="0.25" top="0.5" bottom="0.5" header="0.2" footer="0.2"/>
  <pageSetup orientation="landscape" fitToWidth="1" fitToHeight="0" paperSize="9"/>
</worksheet>`;
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

const WORKBOOK = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <bookViews><workbookView/></bookViews>
  <sheets><sheet name="Oppmøte og arbeidskrav" sheetId="1" r:id="rId1"/></sheets>
  <calcPr calcId="191029" fullCalcOnLoad="1"/>
</workbook>`;

const WORKBOOK_RELS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`;

const STYLES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <fonts count="3">
    <font><sz val="11"/><name val="Calibri"/><family val="2"/></font>
    <font><b/><sz val="11"/><name val="Calibri"/><family val="2"/></font>
    <font><b/><sz val="18"/><name val="Calibri"/><family val="2"/><color rgb="FF163B2D"/></font>
  </fonts>
  <fills count="4">
    <fill><patternFill patternType="none"/></fill>
    <fill><patternFill patternType="gray125"/></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFE2F0D9"/><bgColor indexed="64"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFA9D08E"/><bgColor indexed="64"/></patternFill></fill>
  </fills>
  <borders count="2">
    <border><left/><right/><top/><bottom/><diagonal/></border>
    <border><left style="thin"><color rgb="FFB7C9BE"/></left><right style="thin"><color rgb="FFB7C9BE"/></right><top style="thin"><color rgb="FFB7C9BE"/></top><bottom style="thin"><color rgb="FFB7C9BE"/></bottom><diagonal/></border>
  </borders>
  <cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
  <cellXfs count="10">
    <xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
    <xf numFmtId="0" fontId="1" fillId="2" borderId="1" xfId="0" applyAlignment="1"><alignment vertical="center" wrapText="1"/></xf>
    <xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyAlignment="1"><alignment horizontal="left" vertical="center" wrapText="1"/></xf>
    <xf numFmtId="0" fontId="1" fillId="3" borderId="1" xfId="0" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>
    <xf numFmtId="0" fontId="1" fillId="2" borderId="1" xfId="0" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>
    <xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyAlignment="1"><alignment vertical="center"/></xf>
    <xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>
    <xf numFmtId="0" fontId="1" fillId="2" borderId="1" xfId="0" applyAlignment="1"><alignment vertical="center" wrapText="1"/></xf>
    <xf numFmtId="2" fontId="0" fillId="0" borderId="1" xfId="0" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>
    <xf numFmtId="0" fontId="2" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment horizontal="left" vertical="center"/></xf>
  </cellXfs>
  <cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
</styleSheet>`;

const CORE_PROPERTIES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <dc:title>NIF-rapport</dc:title><dc:creator>Trenerløftet</dc:creator><cp:lastModifiedBy>Trenerløftet</cp:lastModifiedBy>
  <dcterms:created xsi:type="dcterms:W3CDTF">2026-01-01T00:00:00Z</dcterms:created><dcterms:modified xsi:type="dcterms:W3CDTF">2026-01-01T00:00:00Z</dcterms:modified>
</cp:coreProperties>`;

const APP_PROPERTIES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes"><Application>Trenerløftet</Application></Properties>`;

export function generateNifReport(input: NifReportInput) {
  const stableMtime = new Date("2026-01-01T00:00:00.000Z");
  const file = (value: string): Zippable[string] => [
    strToU8(value),
    { level: 6, mtime: stableMtime },
  ];
  const files: Zippable = {
    "[Content_Types].xml": file(CONTENT_TYPES),
    "_rels/.rels": file(ROOT_RELS),
    "docProps/app.xml": file(APP_PROPERTIES),
    "docProps/core.xml": file(CORE_PROPERTIES),
    "xl/workbook.xml": file(WORKBOOK),
    "xl/_rels/workbook.xml.rels": file(WORKBOOK_RELS),
    "xl/styles.xml": file(STYLES),
    "xl/worksheets/sheet1.xml": file(buildNifWorksheetXml(input)),
  };

  return zipSync(files, { level: 6 });
}

export function nifReportFilename(courseName: string, year: number) {
  const slug = courseName
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
  return `nif-rapport-${slug || "kurs"}-${year}.xlsx`;
}

export function formatNifHours(minutes: number) {
  return formatHours(minutes);
}
