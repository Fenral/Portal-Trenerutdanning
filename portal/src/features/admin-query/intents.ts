import { z } from "zod";

/**
 * Allowlist for objektive administrator-spørsmål (V1). Skjemaet er den
 * eneste inngangen til executeIntent: kun kjente intensjoner, kun validerte
 * UUID-er, kjente statuser og ISO-datointervall. Ingen sql-, sort- eller
 * kolonnefelt finnes i grammatikken, og strictObject avviser alt ukjent.
 */
export const ADMIN_QUERY_INTENTS = [
  "student_progress",
  "cohort_average",
  "completed_count",
  "t1_location_distribution",
  "missing_assignments",
  "attendance_status",
  "practice_status",
] as const;

export type AdminQueryIntentName = (typeof ADMIN_QUERY_INTENTS)[number];

export const EnrollmentStatusFilter = z.enum([
  "invited",
  "active",
  "withdrawn",
  "completed",
]);

const CourseFilters = z
  .strictObject({
    // z.guid: streng 8-4-4-4-12-heksform. Ikke z.uuid, som krever
    // RFC-versjonsbit og ville avvist portalens deterministiske seed-IDer.
    courseRunId: z.guid(),
    status: EnrollmentStatusFilter.optional(),
    from: z.iso.date().optional(),
    to: z.iso.date().optional(),
  })
  .refine((value) => !value.from || !value.to || value.from <= value.to, {
    message: "Datointervallet må starte før det slutter",
    path: ["to"],
  });

function courseIntent<Name extends AdminQueryIntentName>(intent: Name) {
  return z.strictObject({ intent: z.literal(intent), filters: CourseFilters });
}

export const QueryIntent = z.discriminatedUnion("intent", [
  courseIntent("student_progress"),
  courseIntent("cohort_average"),
  courseIntent("completed_count"),
  courseIntent("missing_assignments"),
  courseIntent("attendance_status"),
  courseIntent("practice_status"),
  z.strictObject({
    intent: z.literal("t1_location_distribution"),
    filters: z.strictObject({}).optional(),
  }),
]);

export type QueryIntent = z.infer<typeof QueryIntent>;
