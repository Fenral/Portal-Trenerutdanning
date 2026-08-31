import { createHash } from "node:crypto";

import type { SupabaseClient } from "@supabase/supabase-js";

import { generateDiploma } from "./generate-diploma";

export type CertificateRecord = Readonly<{
  id: string;
  course_run_id: string;
  certificate_number: string;
  template_version: string;
  display_name: string;
  course_title: string;
  completed_on: string;
  storage_path: string | null;
  sha256: string | null;
}>;

export type StoredDiploma = Readonly<{
  path: string;
  sha256: string;
  created: boolean;
}>;

export const CURRENT_DIPLOMA_TEMPLATE_VERSION = "ngf-official-v1";

export function diplomaStoragePath(certificate: CertificateRecord) {
  return `${certificate.course_run_id}/${certificate.id}/diplom-${CURRENT_DIPLOMA_TEMPLATE_VERSION}.pdf`;
}

export function needsDiplomaRefresh(certificate: CertificateRecord) {
  return (
    !certificate.storage_path ||
    !certificate.sha256 ||
    certificate.template_version !== CURRENT_DIPLOMA_TEMPLATE_VERSION
  );
}

export async function ensureDiplomaStored(
  adminClient: SupabaseClient,
  certificate: CertificateRecord,
): Promise<StoredDiploma> {
  if (!needsDiplomaRefresh(certificate)) {
    return {
      path: certificate.storage_path!,
      sha256: certificate.sha256!,
      created: false,
    };
  }

  const path = diplomaStoragePath(certificate);
  const bytes = await generateDiploma({
    templateVersion: CURRENT_DIPLOMA_TEMPLATE_VERSION,
    displayName: certificate.display_name,
    courseTitle: certificate.course_title,
    completedOn: certificate.completed_on,
    certificateNumber: certificate.certificate_number,
  });
  const sha256 = createHash("sha256").update(bytes).digest("hex");
  const upload = await adminClient.storage
    .from("certificates")
    .upload(path, bytes, {
      contentType: "application/pdf",
      cacheControl: "31536000, immutable",
      upsert: false,
    });

  if (upload.error && !/already exists|duplicate/i.test(upload.error.message)) {
    throw new Error(`DIPLOMA_UPLOAD_FAILED: ${upload.error.message}`);
  }

  const update = await adminClient
    .from("certificates")
    .update({
      template_version: CURRENT_DIPLOMA_TEMPLATE_VERSION,
      storage_path: path,
      sha256,
      generated_at: new Date().toISOString(),
    })
    .eq("id", certificate.id)
    .eq("template_version", certificate.template_version)
    .select("storage_path,sha256")
    .maybeSingle();

  if (update.error) {
    throw new Error(`DIPLOMA_RECORD_FAILED: ${update.error.message}`);
  }

  if (update.data) return { path, sha256, created: true };

  const current = await adminClient
    .from("certificates")
    .select("storage_path,sha256")
    .eq("id", certificate.id)
    .single();
  if (current.error || !current.data.storage_path || !current.data.sha256) {
    throw new Error(
      `DIPLOMA_RECORD_MISSING: ${current.error?.message ?? certificate.id}`,
    );
  }

  return {
    path: current.data.storage_path,
    sha256: current.data.sha256,
    created: false,
  };
}
