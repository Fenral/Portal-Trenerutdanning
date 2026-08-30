import { z } from "zod";

const CourseRunBaseInput = z
  .object({
    templateCode: z.enum(["T1", "T2", "T3"]),
    templateId: z.string().uuid(),
    title: z.string().trim().min(2).max(120),
    startYear: z.number().int().min(2020).max(2100),
    startsOn: z.iso.date(),
    endsOn: z.iso.date(),
    locationName: z.string().trim().min(2).max(120).optional(),
    sessions: z.number().int().positive(),
    leadProfileId: z.string().uuid(),
    correlationId: z.string().uuid(),
  })
  .superRefine((value, context) => {
    if (value.templateCode === "T1" && !value.locationName) {
      context.addIssue({
        code: "custom",
        message: "Trener 1 krever kurssted",
        path: ["locationName"],
      });
    }

    if (value.endsOn < value.startsOn) {
      context.addIssue({
        code: "custom",
        message: "Sluttdato må være etter startdato",
        path: ["endsOn"],
      });
    }
  });

export const CourseRunInput = CourseRunBaseInput.transform((value) => ({
  ...value,
  displayYear:
    value.templateCode === "T3"
      ? String(value.startYear) + "–" + String(value.startYear + 1)
      : String(value.startYear),
}));

export const CourseSessionInput = z
  .object({
    title: z.string().trim().min(2).max(120),
    startsAt: z.iso.datetime({ offset: true }),
    endsAt: z.iso.datetime({ offset: true }),
    locationText: z.string().trim().min(2).max(160).optional(),
    sessionType: z.enum(["regular", "youth_drive"]).default("regular"),
    isRequired: z.boolean().default(true),
  })
  .refine((value) => value.endsAt > value.startsAt, {
    message: "Samlingen må slutte etter at den starter",
    path: ["endsAt"],
  });

export const CourseRunCreationInput = z
  .object({
    course: CourseRunBaseInput,
    sessionPlan: z.array(CourseSessionInput).min(1).max(24),
  })
  .superRefine((value, context) => {
    if (value.course.sessions !== value.sessionPlan.length) {
      context.addIssue({
        code: "custom",
        message: "Antall samlinger stemmer ikke med samlingsplanen",
        path: ["sessionPlan"],
      });
    }
  })
  .transform((value) => {
    const parsedCourse = CourseRunInput.parse(value.course);

    return {
      ...parsedCourse,
      sessionPlan: value.sessionPlan.map((session, index) => ({
        ...session,
        sortOrder: index + 1,
      })),
    };
  });

export type CourseRunSummaryInput = z.input<typeof CourseRunInput>;
export type CreateCourseRunInput = CourseRunSummaryInput & {
  sessionPlan: z.input<typeof CourseSessionInput>[];
};
export type ValidatedCourseRunCreation = z.output<
  typeof CourseRunCreationInput
>;
