export const REPORT_TYPES = [
  "course_progress",
  "practice",
  "attendance",
  "assessments",
  "deadlines",
  "completion",
  "t1_location_distribution",
] as const;

export type ReportType = (typeof REPORT_TYPES)[number];

export type ReportDefinition = Readonly<{
  id: ReportType;
  label: string;
  description: string;
  formula: string;
  formulaVersion: string;
  excludeStatuses: readonly string[];
  sourceTables: readonly string[];
}>;

const FORMULA_VERSION = "2026.1";
const EXCLUDE_STATUSES = Object.freeze(["withdrawn"] as const);

function definition(
  input: Omit<ReportDefinition, "formulaVersion" | "excludeStatuses">,
): ReportDefinition {
  return Object.freeze({
    ...input,
    formulaVersion: FORMULA_VERSION,
    excludeStatuses: EXCLUDE_STATUSES,
    sourceTables: Object.freeze(input.sourceTables),
  });
}

/**
 * Én kilde til sannhet for rapportmetadata. UI, Excel og PDF importerer
 * disse definisjonene; formelteksten dupliseres aldri andre steder.
 */
export const reportDefinitions: Readonly<Record<ReportType, ReportDefinition>> =
  Object.freeze({
    course_progress: definition({
      id: "course_progress",
      label: "Kursstatus og progresjon",
      description: "Deltakerprogresjon per kursgjennomføring med kullsnitt.",
      formula:
        "Progresjon = fullførte obligatoriske progresjonspoeng delt på alle obligatoriske progresjonspoeng. Kullsnitt = gjennomsnitt av progresjon for deltakere som ikke har trukket seg.",
      sourceTables: [
        "enrollments",
        "profiles",
        "enrollment_progress",
        "attendance_records",
        "practice_submissions",
        "assignment_submissions",
      ],
    }),
    practice: definition({
      id: "practice",
      label: "Praksis",
      description: "Registrerte praksistimer og praksisstatus per deltaker.",
      formula:
        "Praksistimer = sum av registrerte minutter delt på 60, fordelt på planlegging og gjennomføring. Krav: 45 timer totalt og maks 9 timer planlegging.",
      sourceTables: [
        "enrollments",
        "profiles",
        "practice_entries",
        "practice_submissions",
      ],
    }),
    attendance: definition({
      id: "attendance",
      label: "Oppmøte",
      description: "Oppmøtetimer og oppmøteprosent per deltaker.",
      formula:
        "Oppmøteprosent = registrerte oppmøtte minutter delt på planlagte minutter. Krav: minst 80 prosent.",
      sourceTables: ["enrollments", "profiles", "attendance_records"],
    }),
    assessments: definition({
      id: "assessments",
      label: "Vurderinger",
      description: "Innleveringsstatus per deltaker og arbeidskrav.",
      formula:
        "Én rad per innlevering med gjeldende status og versjonsnummer for arbeidskravet.",
      sourceTables: [
        "enrollments",
        "profiles",
        "activities",
        "assignment_submissions",
      ],
    }),
    deadlines: definition({
      id: "deadlines",
      label: "Frister",
      description:
        "Innleveringsfrister med antall innlevert og antall som mangler.",
      formula:
        "Mangler = aktive deltakere uten innsendt versjon av arbeidskravet ved genereringstidspunktet.",
      sourceTables: [
        "activities",
        "assignment_definitions",
        "assignment_submissions",
        "enrollments",
      ],
    }),
    completion: definition({
      id: "completion",
      label: "Fullføring",
      description: "Fullføringsstatus per deltaker med manglende krav.",
      formula:
        "Fullført = progresjon 100 prosent, oppmøte minst 80 prosent, godkjent praksis og registrert universitetsemne der nivået krever det.",
      sourceTables: [
        "enrollments",
        "profiles",
        "enrollment_progress",
        "attendance_records",
        "practice_submissions",
        "university_requirements",
      ],
    }),
    t1_location_distribution: definition({
      id: "t1_location_distribution",
      label: "Trener 1 per kurssted",
      description: "Antall aktive deltakere per Trener 1-kurssted.",
      formula:
        "Antall deltakere = påmeldinger på kursstedet som ikke har status trukket.",
      sourceTables: ["course_runs", "course_templates", "enrollments"],
    }),
  });

export function isReportType(value: string): value is ReportType {
  return (REPORT_TYPES as readonly string[]).includes(value);
}
