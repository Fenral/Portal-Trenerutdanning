import { describe, expect, it } from "vitest";

import {
  REPORT_TYPES,
  reportDefinitions,
} from "@/features/reporting/definitions";

describe("report definitions", () => {
  it("defines exactly the seven report types", () => {
    expect(REPORT_TYPES).toEqual([
      "course_progress",
      "practice",
      "attendance",
      "assessments",
      "deadlines",
      "completion",
      "t1_location_distribution",
    ]);
  });

  it("locks the Norwegian labels and descriptions", () => {
    expect(reportDefinitions.course_progress.label).toBe(
      "Kursstatus og progresjon",
    );
    expect(reportDefinitions.course_progress.description).toBe(
      "Deltakerprogresjon per kursgjennomføring med kullsnitt.",
    );
    expect(reportDefinitions.course_progress.formula).toBe(
      "Progresjon = fullførte obligatoriske progresjonspoeng delt på alle obligatoriske progresjonspoeng. Kullsnitt = gjennomsnitt av progresjon for deltakere som ikke har trukket seg.",
    );
    expect(reportDefinitions.practice.description).toBe(
      "Registrerte praksistimer og praksisstatus per deltaker.",
    );
    expect(reportDefinitions.attendance.description).toBe(
      "Oppmøtetimer og oppmøteprosent per deltaker.",
    );
    expect(reportDefinitions.assessments.description).toBe(
      "Innleveringsstatus per deltaker og arbeidskrav.",
    );
    expect(reportDefinitions.deadlines.description).toBe(
      "Innleveringsfrister med antall innlevert og antall som mangler.",
    );
    expect(reportDefinitions.completion.description).toBe(
      "Fullføringsstatus per deltaker med manglende krav.",
    );
    expect(reportDefinitions.t1_location_distribution.description).toBe(
      "Antall aktive deltakere per Trener 1-kurssted.",
    );
  });

  it("excludes withdrawn from every cohort aggregate and versions every formula", () => {
    for (const type of REPORT_TYPES) {
      const definition = reportDefinitions[type];
      expect(definition.id).toBe(type);
      expect(definition.excludeStatuses).toEqual(["withdrawn"]);
      expect(definition.formulaVersion).toBe("2026.1");
      expect(definition.formula.length).toBeGreaterThan(10);
      expect(definition.sourceTables.length).toBeGreaterThan(0);
    }
  });

  it("is immutable", () => {
    expect(Object.isFrozen(reportDefinitions)).toBe(true);
    expect(Object.isFrozen(reportDefinitions.course_progress)).toBe(true);
    expect(
      Object.isFrozen(reportDefinitions.course_progress.excludeStatuses),
    ).toBe(true);
  });
});
