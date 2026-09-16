import { z } from "zod";

export const CMS_DESIGN_VERSION = "2026-09-16";

export const DesignSystem = z.enum(["niva", "nivaband"]);
export type DesignSystem = z.infer<typeof DesignSystem>;

export const ModuleField = z.object({
  name: z.string().regex(/^[a-zA-Z][a-zA-Z0-9_-]{0,63}$/),
  label: z.string().trim().min(1).max(120),
  type: z.enum(["text", "textarea", "number"]),
  value: z.string().max(20_000),
});
export type ModuleField = z.infer<typeof ModuleField>;

export const CodeModule = z
  .object({
    type: z.literal("code_module"),
    id: z.string().trim().min(1).max(120),
    title: z.string().trim().min(1).max(180),
    html: z.string().max(200_000),
    css: z.string().max(100_000),
    javascript: z.string().max(100_000),
    designSystem: DesignSystem,
    designVersion: z.string().trim().min(1).max(80),
    fields: z.array(ModuleField).max(100),
    notes: z.string().max(20_000).optional(),
  })
  .superRefine((module, context) => {
    const names = new Set<string>();
    module.fields.forEach((field, index) => {
      if (names.has(field.name)) {
        context.addIssue({
          code: "custom",
          message: "Feltnavn må være unike i en modul",
          path: ["fields", index, "name"],
        });
      }
      names.add(field.name);
    });
  });

export type CodeModule = z.infer<typeof CodeModule>;
