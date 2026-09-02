import type { ReportTable } from "./report-builders";

const OSLO_DATE_TIME = new Intl.DateTimeFormat("nb-NO", {
  dateStyle: "short",
  timeStyle: "short",
  timeZone: "Europe/Oslo",
});

export function formatOsloDateTime(value: string): string {
  return OSLO_DATE_TIME.format(new Date(value));
}

/**
 * Felles proveniens-linjer for Excel og PDF: beskrivelse, filtre, kullsnitt,
 * frossen formeltekst med versjon og genereringstidspunkt. De to formatene
 * skal være samme artefakt.
 */
export function reportMetaLines(table: ReportTable): readonly string[] {
  return [
    table.definition.description,
    `Filtre: ${table.filters.join(" · ")}`,
    ...table.summary,
    `Definisjon (versjon ${table.definition.formulaVersion}): ${table.definition.formula}`,
    `Generert: ${formatOsloDateTime(table.generatedAt)}`,
  ];
}
