import { z } from "zod";
import { ContentDocument } from "@/features/content/document-schema";
import { CmsError } from "./errors";

export const CmsId = z
  .string()
  .regex(/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i);
const Title = z.string().trim().min(2).max(180);
const ExpectedVersion = z.string().datetime({ offset: true });
const ChangeNote = z.string().trim().min(3).max(500);

export const CreateItemInput = z
  .object({
    title: Title,
    level: z.number().int().min(1).max(4).nullable().default(null),
    document: ContentDocument,
  })
  .strict();
export const SaveItemInput = z
  .object({
    title: Title,
    document: ContentDocument,
    expectedUpdatedAt: ExpectedVersion,
    changeNote: ChangeNote.default("Kladd lagret"),
  })
  .strict();
export const PublishItemInput = z
  .object({
    expectedUpdatedAt: ExpectedVersion,
    changeNote: ChangeNote,
    courseRunIds: z
      .array(CmsId)
      .max(100)
      .default([])
      .transform((ids) => [...new Set(ids)]),
  })
  .strict();
export const RestoreItemInput = z
  .object({
    revisionId: CmsId,
    expectedUpdatedAt: ExpectedVersion,
  })
  .strict();
export const VariantInput = z.object({ courseRunId: CmsId }).strict();
export const AttachmentFields = z.object({
  title: z.string().trim().min(2).max(180),
  author: z.string().trim().min(1).max(180),
  audience: z.enum(["teachers", "course_members"]),
});
export const AttachmentUploadInput = z.discriminatedUnion("phase", [
  AttachmentFields.extend({
    phase: z.literal("prepare"),
    filename: z.string().trim().min(1).max(240),
    mimeType: z.string().max(200),
    byteSize: z
      .number()
      .int()
      .min(1)
      .max(20 * 1024 * 1024),
  }).strict(),
  z.object({ phase: z.literal("complete"), uploadId: CmsId }).strict(),
]);

export async function readCmsJson(request: Request): Promise<unknown> {
  const maxBytes = 2 * 1024 * 1024;
  if (Number(request.headers.get("content-length")) > maxBytes) {
    throw new CmsError(
      413,
      "Innholdet er for stort. Maksimal størrelse er 2 MB.",
    );
  }
  if (!request.body) throw new CmsError(400, "Forespørselen mangler innhold.");
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maxBytes) {
        await reader.cancel();
        throw new CmsError(
          413,
          "Innholdet er for stort. Maksimal størrelse er 2 MB.",
        );
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return JSON.parse(new TextDecoder().decode(bytes));
}

/** Cookie-authenticated mutation endpoints accept only same-origin browser requests. */
export function assertCmsMutationOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) {
    throw new CmsError(403, "Forespørselen må sendes fra portalen.");
  }
  if (request.headers.get("sec-fetch-site") === "cross-site") {
    throw new CmsError(403, "Forespørselen må sendes fra portalen.");
  }
}
