import type { SupabaseClient } from "@supabase/supabase-js";

import {
  reportDefinitions,
  type ReportType,
} from "@/features/reporting/definitions";
import {
  buildReport,
  type ReportCell,
  type ReportTable,
} from "@/features/reporting/report-builders";

import type { AdminQueryIntentName, QueryIntent } from "./intents";

export class AdminQueryError extends Error {
  constructor(
    readonly code:
      "ADMIN_QUERY_COURSE_NOT_FOUND" | "ADMIN_QUERY_FILTER_UNSUPPORTED",
    message: string,
  ) {
    super(message);
    this.name = "AdminQueryError";
  }
}

export type AdminQueryAnswer = Readonly<{
  intent: AdminQueryIntentName;
  interpretedQuestion: string;
  activeFilters: readonly string[];
  definitionLabel: string;
  formula: string;
  formulaVersion: string;
  sourceTimestamp: string;
  result: Readonly<{
    headline: string;
    columns: readonly string[];
    rows: ReadonlyArray<ReadonlyArray<ReportCell>>;
  }>;
  participantCount: number;
  readOnly: true;
}>;

const STATUS_FILTER_LABELS: Readonly<Record<string, string>> = {
  invited: "Invitert",
  active: "Aktiv",
  withdrawn: "Trukket",
  completed: "Fullført",
};

type IntentConfig = Readonly<{
  report: ReportType;
  /** Liste-intensjoner viser radene; aggregater viser kun oppsummeringen. */
  listRows: boolean;
  /** Kun lister med Status-kolonne kan filtreres ærlig på status. */
  statusFilterable: boolean;
  question: (courseTitle: string) => string;
}>;

const INTENT_CONFIG: Readonly<Record<AdminQueryIntentName, IntentConfig>> = {
  student_progress: {
    report: "course_progress",
    listRows: true,
    statusFilterable: true,
    question: (course) => `Hvor langt har hver deltaker kommet i ${course}?`,
  },
  cohort_average: {
    report: "course_progress",
    listRows: false,
    statusFilterable: false,
    question: (course) => `Hva er kullsnittet i ${course}?`,
  },
  completed_count: {
    report: "completion",
    listRows: false,
    statusFilterable: false,
    question: (course) => `Hvor mange har fullført ${course}?`,
  },
  t1_location_distribution: {
    report: "t1_location_distribution",
    listRows: true,
    statusFilterable: false,
    question: () => "Hvordan fordeler Trener 1-deltakerne seg per kurssted?",
  },
  missing_assignments: {
    report: "deadlines",
    listRows: true,
    statusFilterable: false,
    question: (course) => `Hvem mangler innleveringer i ${course}?`,
  },
  attendance_status: {
    report: "attendance",
    listRows: true,
    statusFilterable: true,
    question: (course) => `Hvordan ligger oppmøtet an i ${course}?`,
  },
  practice_status: {
    report: "practice",
    listRows: true,
    statusFilterable: true,
    question: (course) => `Hvordan ligger praksisen an i ${course}?`,
  },
};

async function anyCourseRunId(client: SupabaseClient): Promise<string> {
  const result = await client.from("course_runs").select("id").limit(1);
  if (result.error) throw new Error(result.error.message);
  const id = result.data?.[0]?.id;
  if (!id) {
    throw new AdminQueryError(
      "ADMIN_QUERY_COURSE_NOT_FOUND",
      "Fant ingen kursgjennomføringer.",
    );
  }
  return id;
}

function statusColumnIndex(table: ReportTable): number {
  return table.columns.indexOf("Status");
}

function participantCountFor(
  intent: AdminQueryIntentName,
  table: ReportTable,
  rows: ReadonlyArray<ReadonlyArray<ReportCell>>,
): number {
  if (intent === "t1_location_distribution") {
    const countIndex = table.columns.indexOf("Antall deltakere");
    return rows.reduce((sum, row) => sum + Number(row[countIndex] ?? 0), 0);
  }
  if (intent === "missing_assignments") {
    // Radene er arbeidskrav; deltakertallet står deterministisk i
    // builderens oppsummering «Aktive deltakere (ekskl. trukket): N».
    const match = /:\s*(\d+)/.exec(table.summary[0] ?? "");
    return match ? Number(match[1]) : 0;
  }
  const statusIndex = statusColumnIndex(table);
  if (intent === "cohort_average" || intent === "completed_count") {
    // Aggregatene er definert ekskl. trukket; tell samme grunnlag.
    return rows.filter((row) => row[statusIndex] !== "Trukket").length;
  }
  return rows.length;
}

/**
 * Utfører én validert intensjon mot de faste rapportbyggerne, med den
 * påloggede administratorens RLS-klient. Dispatchen er uttømmende:
 * INTENT_CONFIG er en total Record over intensjonsunionen, så en ny
 * intensjon uten fast rapportkobling stopper kompileringen. Svaret bærer
 * alltid tolket spørsmål, aktive filtre, formel, kildetidspunkt og
 * readOnly: true. Ingen SQL, sortering eller kolonnevalg kan nå hit.
 */
export async function executeIntent(
  client: SupabaseClient,
  intent: QueryIntent,
): Promise<AdminQueryAnswer> {
  const config = INTENT_CONFIG[intent.intent];
  const filters: {
    courseRunId?: string;
    status?: "invited" | "active" | "withdrawn" | "completed";
    from?: string;
    to?: string;
  } = intent.intent === "t1_location_distribution" ? {} : intent.filters;

  if (filters.from || filters.to) {
    // ponytail: fail closed — datointervall får semantikk sammen med
    // naturlig språk-tolkningen; å ignorere filteret ville gitt feil svar.
    throw new AdminQueryError(
      "ADMIN_QUERY_FILTER_UNSUPPORTED",
      "Datofilter støttes ikke for objektive spørsmål ennå.",
    );
  }
  if (filters.status && !config.statusFilterable) {
    throw new AdminQueryError(
      "ADMIN_QUERY_FILTER_UNSUPPORTED",
      "Statusfilter støttes ikke for dette spørsmålet; definisjonen avgjør hvilke deltakere som telles.",
    );
  }

  const courseRunId =
    intent.intent === "t1_location_distribution"
      ? await anyCourseRunId(client)
      : (filters.courseRunId as string);

  let table: ReportTable;
  try {
    table = await buildReport(client, config.report, courseRunId);
  } catch (error) {
    if (
      error instanceof Error &&
      (error.message === "REPORT_COURSE_NOT_FOUND" ||
        error.message === "REPORT_TEMPLATE_NOT_FOUND")
    ) {
      throw new AdminQueryError(
        "ADMIN_QUERY_COURSE_NOT_FOUND",
        "Fant ikke kursgjennomføringen. Kontroller kursvalget.",
      );
    }
    throw error;
  }

  let rows = table.rows;
  let activeFilters = table.filters;
  if (filters.status) {
    const statusLabel = STATUS_FILTER_LABELS[filters.status];
    const statusIndex = statusColumnIndex(table);
    rows = rows.filter((row) => row[statusIndex] === statusLabel);
    activeFilters = activeFilters
      .filter((line) => !line.startsWith("Status:"))
      .concat(`Status: ${statusLabel}`);
  }

  const definition = reportDefinitions[config.report];
  return {
    intent: intent.intent,
    interpretedQuestion: config.question(table.courseTitle),
    activeFilters,
    definitionLabel: definition.label,
    formula: definition.formula,
    formulaVersion: definition.formulaVersion,
    sourceTimestamp: table.generatedAt,
    result: {
      headline: table.summary[0] ?? `${rows.length} rader`,
      columns: config.listRows ? table.columns : [],
      rows: config.listRows ? rows : [],
    },
    participantCount: participantCountFor(intent.intent, table, rows),
    readOnly: true,
  };
}
