import { z } from "zod";

import { normalizeEmail } from "./claim-invitation";

export const CourseInvitationRoleSchema = z.enum([
  "student",
  "course_teacher",
  "course_lead",
]);

export const CreateInvitationInputSchema = z
  .object({
    email: z.string().trim().min(3).max(254).email(),
    courseRunId: z.string().uuid(),
    role: CourseInvitationRoleSchema,
    createdBy: z.string().uuid(),
    expiresAt: z.date(),
    correlationId: z.string().uuid(),
  })
  .transform((value) => ({
    ...value,
    normalizedEmail: normalizeEmail(value.email),
  }));

export type CreateInvitationInput = z.input<typeof CreateInvitationInputSchema>;

export type ValidatedCreateInvitationInput = z.output<
  typeof CreateInvitationInputSchema
>;
