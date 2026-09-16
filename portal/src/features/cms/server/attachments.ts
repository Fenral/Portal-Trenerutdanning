import { randomUUID } from "node:crypto";
import type { z } from "zod";
import { validateUploadMetadata } from "@/lib/files/scan-upload";
import { authorizeCmsItem } from "./auth";
import { toCmsAttachment, type AttachmentRow } from "./data";
import { assertCmsQuery, CmsError } from "./errors";
import type { CmsAttachment, CmsSession } from "./types";
import { AttachmentFields, AttachmentUploadInput } from "./validation";

export const CMS_ATTACHMENT_MAX_BYTES = 20 * 1024 * 1024;
const mimeByExtension: Record<string, string> = {
  pdf: "application/pdf",
  doc: "application/msword",
  ppt: "application/vnd.ms-powerpoint",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
};

function cmsAttachmentMime(filename: string, declaredType: string): string {
  const extension = filename.split(".").at(-1)?.toLowerCase() ?? "";
  const expectedMime = mimeByExtension[extension];
  if (!expectedMime)
    throw new CmsError(415, "Last opp en PDF-, PowerPoint- eller Word-fil.");
  const mimeType =
    !declaredType || declaredType === "application/octet-stream"
      ? expectedMime
      : declaredType;
  if (mimeType !== expectedMime)
    throw new CmsError(415, "Filtype og filnavn samsvarer ikke.");
  return mimeType;
}

export function validateCmsAttachment(
  filename: string,
  declaredType: string,
  bytes: Uint8Array,
  byteSize: number,
): string {
  if (
    byteSize > CMS_ATTACHMENT_MAX_BYTES ||
    bytes.byteLength > CMS_ATTACHMENT_MAX_BYTES
  ) {
    throw new CmsError(413, "Originalfilen kan være maksimalt 20 MB.");
  }
  const mimeType = cmsAttachmentMime(filename, declaredType);
  const result = validateUploadMetadata({
    originalFilename: filename,
    declaredMimeType: mimeType,
    bytes,
    byteSize,
    correlationId: "cms-format-validation",
  });
  if (!result.ok)
    throw new CmsError(
      415,
      "Filen er tom eller har et format som ikke samsvarer med filtypen.",
    );
  return mimeType;
}

export function cmsDownloadDisposition(filename: string): string {
  const asciiName = filename.replace(/[^\x20-\x7e]|["\\/]/g, "_");
  const encodedName = encodeURIComponent(filename).replace(
    /[!'()*]/g,
    (value) => `%${value.charCodeAt(0).toString(16).toUpperCase()}`,
  );
  return `attachment; filename="${asciiName}"; filename*=UTF-8''${encodedName}`;
}

export async function readCmsMultipart(request: Request): Promise<FormData> {
  const maxBytes = CMS_ATTACHMENT_MAX_BYTES + 128 * 1024;
  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.startsWith("multipart/form-data;"))
    throw new CmsError(400, "Last opp filen som et vedlegg.");
  if (Number(request.headers.get("content-length")) > maxBytes)
    throw new CmsError(413, "Originalfilen kan være maksimalt 20 MB.");
  if (!request.body) throw new CmsError(400, "Velg en originalfil.");
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maxBytes) {
        await reader.cancel();
        throw new CmsError(413, "Originalfilen kan være maksimalt 20 MB.");
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
  try {
    return await new Response(bytes, {
      headers: { "content-type": contentType },
    }).formData();
  } catch {
    throw new CmsError(
      400,
      "Filopplastingen kunne ikke leses. Velg filen på nytt.",
    );
  }
}

export async function uploadCmsAttachment(
  session: CmsSession,
  itemId: string,
  form: FormData,
): Promise<CmsAttachment> {
  await authorizeCmsItem(session, itemId);
  const file = form.get("file");
  if (!(file instanceof File)) throw new CmsError(400, "Velg en originalfil.");
  if (file.size > CMS_ATTACHMENT_MAX_BYTES)
    throw new CmsError(413, "Originalfilen kan være maksimalt 20 MB.");
  const fields = AttachmentFields.parse({
    title: form.get("title"),
    author: form.get("author"),
    audience: form.get("audience"),
  });
  const filename =
    file.name
      .split(/[\\/]/)
      .at(-1)
      ?.replace(/[\u0000-\u001f\u007f]/g, "_")
      .trim() ?? "";
  if (!filename || filename.length > 240)
    throw new CmsError(400, "Filnavnet må være mellom 1 og 240 tegn.");
  const bytes = new Uint8Array(await file.arrayBuffer());
  const mimeType = validateCmsAttachment(filename, file.type, bytes, file.size);
  const id = randomUUID();
  const path = `${itemId}/${id}`;
  const upload = await session.admin.storage
    .from("cms-attachments")
    .upload(path, bytes, {
      contentType: mimeType,
      upsert: false,
      cacheControl: "0",
    });
  assertCmsQuery(upload.error);
  try {
    const result = await session.admin
      .from("cms_attachments")
      .insert({
        id,
        content_item_id: itemId,
        title: fields.title,
        author: fields.author,
        audience: fields.audience,
        original_filename: filename,
        mime_type: mimeType,
        byte_size: file.size,
        storage_path: path,
        created_by: session.profileId,
      })
      .select("*")
      .single();
    assertCmsQuery(result.error);
    return toCmsAttachment(result.data as AttachmentRow);
  } catch (error) {
    // An RPC may have committed before a transport error. Preserve registered
    // files; clean up only confirmed orphans so published references cannot break.
    const record = await session.admin
      .from("cms_attachments")
      .select("id")
      .eq("id", id)
      .maybeSingle();
    if (!record.error && !record.data)
      await session.admin.storage.from("cms-attachments").remove([path]);
    throw error;
  }
}

type PrepareUpload = Extract<
  z.infer<typeof AttachmentUploadInput>,
  { phase: "prepare" }
>;

export async function prepareCmsAttachment(
  session: CmsSession,
  itemId: string,
  input: PrepareUpload,
) {
  await authorizeCmsItem(session, itemId);
  const filename =
    input.filename
      .split(/[\\/]/)
      .at(-1)
      ?.replace(/[\u0000-\u001f\u007f]/g, "_")
      .trim() ?? "";
  if (!filename) throw new CmsError(400, "Velg en fil med gyldig navn.");
  const mimeType = cmsAttachmentMime(filename, input.mimeType);
  // Opportunistic cleanup is scoped to this uploader. Failed/abandoned files
  // remain private even when storage is temporarily unavailable for cleanup.
  const expired = await session.admin
    .from("cms_attachment_uploads")
    .select("id,storage_path")
    .eq("created_by", session.profileId)
    .lt("expires_at", new Date().toISOString())
    .limit(20);
  assertCmsQuery(expired.error);
  for (const upload of expired.data ?? []) {
    const registered = await session.admin
      .from("cms_attachments")
      .select("id")
      .eq("id", upload.id)
      .maybeSingle();
    if (registered.error) continue;
    const removed = registered.data
      ? { error: null }
      : await session.admin.storage
          .from("cms-attachments")
          .remove([upload.storage_path]);
    if (!removed.error)
      await session.admin
        .from("cms_attachment_uploads")
        .delete()
        .eq("id", upload.id);
  }
  const uploadId = randomUUID();
  const path = `${itemId}/${uploadId}`;
  const pending = await session.admin.from("cms_attachment_uploads").insert({
    id: uploadId,
    content_item_id: itemId,
    title: input.title,
    author: input.author,
    audience: input.audience,
    original_filename: filename,
    mime_type: mimeType,
    byte_size: input.byteSize,
    storage_path: path,
    created_by: session.profileId,
  });
  assertCmsQuery(pending.error);
  const signed = await session.admin.storage
    .from("cms-attachments")
    .createSignedUploadUrl(path, { upsert: false });
  if (signed.error || !signed.data) {
    await session.admin
      .from("cms_attachment_uploads")
      .delete()
      .eq("id", uploadId);
    assertCmsQuery(signed.error);
    throw new CmsError(503, "Kunne ikke starte filopplastingen.");
  }
  return { uploadId, uploadUrl: signed.data.signedUrl, mimeType };
}

export async function completeCmsAttachment(
  session: CmsSession,
  itemId: string,
  uploadId: string,
): Promise<CmsAttachment> {
  await authorizeCmsItem(session, itemId);
  const existing = await session.admin
    .from("cms_attachments")
    .select("*")
    .eq("id", uploadId)
    .eq("content_item_id", itemId)
    .eq("created_by", session.profileId)
    .maybeSingle();
  assertCmsQuery(existing.error);
  if (existing.data) return toCmsAttachment(existing.data as AttachmentRow);
  const pending = await session.admin
    .from("cms_attachment_uploads")
    .select("*")
    .eq("id", uploadId)
    .eq("content_item_id", itemId)
    .eq("created_by", session.profileId)
    .maybeSingle();
  assertCmsQuery(pending.error);
  if (
    !pending.data ||
    pending.data.rejected_at ||
    Date.parse(pending.data.expires_at) <= Date.now()
  )
    throw new CmsError(
      410,
      "Opplastingen er utløpt eller avvist. Velg filen på nytt.",
    );
  const row = pending.data;
  const download = await session.admin.storage
    .from("cms-attachments")
    .download(row.storage_path);
  assertCmsQuery(download.error);
  if (!download.data)
    throw new CmsError(400, "Last opp hele originalfilen før du fullfører.");
  try {
    if (download.data.size !== row.byte_size)
      throw new CmsError(
        415,
        "Filstørrelsen samsvarer ikke med originalfilen.",
      );
    const bytes = new Uint8Array(await download.data.arrayBuffer());
    validateCmsAttachment(
      row.original_filename,
      row.mime_type,
      bytes,
      row.byte_size,
    );
  } catch (error) {
    await session.admin.storage
      .from("cms-attachments")
      .remove([row.storage_path]);
    // Retain the pending record until signed-URL expiry so a replayed upload is
    // removed by cleanup. It can never be completed after this rejection.
    await session.admin
      .from("cms_attachment_uploads")
      .update({ rejected_at: new Date().toISOString() })
      .eq("id", uploadId);
    throw error;
  }
  const insert = await session.admin
    .from("cms_attachments")
    .insert({
      id: row.id,
      content_item_id: itemId,
      title: row.title,
      author: row.author,
      audience: row.audience,
      original_filename: row.original_filename,
      mime_type: row.mime_type,
      byte_size: row.byte_size,
      storage_path: row.storage_path,
      created_by: session.profileId,
    })
    .select("*")
    .single();
  if (insert.error) {
    // Another completion request may have committed the same validated upload.
    const completed = await session.admin
      .from("cms_attachments")
      .select("*")
      .eq("id", uploadId)
      .eq("content_item_id", itemId)
      .eq("created_by", session.profileId)
      .maybeSingle();
    if (!completed.error && completed.data)
      return toCmsAttachment(completed.data as AttachmentRow);
    assertCmsQuery(insert.error);
  }
  await session.admin
    .from("cms_attachment_uploads")
    .delete()
    .eq("id", uploadId);
  return toCmsAttachment(insert.data as AttachmentRow);
}

export async function downloadCmsAttachment(
  session: CmsSession,
  attachmentId: string,
): Promise<Response> {
  const attachment = await session.client
    .from("cms_attachments")
    .select("*")
    .eq("id", attachmentId)
    .maybeSingle();
  assertCmsQuery(attachment.error);
  if (!attachment.data)
    throw new CmsError(
      404,
      "Vedlegget finnes ikke eller er ikke tilgjengelig for deg.",
    );
  const row = attachment.data as AttachmentRow;
  const download = await session.admin.storage
    .from("cms-attachments")
    .download(row.storage_path);
  assertCmsQuery(download.error);
  if (!download.data) throw new CmsError(404, "Originalfilen finnes ikke.");
  return new Response(download.data, {
    headers: {
      "Content-Type": row.mime_type,
      "Content-Disposition": cmsDownloadDisposition(row.original_filename),
      "Content-Length": String(download.data.size),
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "sandbox; default-src 'none'",
    },
  });
}
