import { createHash, randomUUID } from "node:crypto";

import type { SupabaseClient } from "@supabase/supabase-js";

import {
  scanUpload,
  validateUploadMetadata,
  type UploadErrorCode,
} from "@/lib/files/scan-upload";
import { isE2ETestMode } from "@/lib/supabase/environment";

type StoreAssignmentUploadDependencies = Readonly<{
  adminClient: SupabaseClient;
  actorProfileId: string;
  scannerUrl?: string;
}>;

function safeExtension(filename: string): string {
  const extension = filename.split(".").at(-1)?.toLocaleLowerCase("en-US");
  return extension?.replace(/[^a-z0-9]/g, "") || "bin";
}

async function markRejected(
  adminClient: SupabaseClient,
  assetId: string,
  errorCode: UploadErrorCode | "storage_unavailable",
): Promise<void> {
  await adminClient
    .from("media_assets")
    .update({
      scan_status: "rejected",
      scan_error_code: errorCode,
      scanned_at: new Date().toISOString(),
    })
    .eq("id", assetId);
}

export async function storeCleanAssignmentUpload(
  file: File,
  dependencies: StoreAssignmentUploadDependencies,
): Promise<Readonly<{ mediaAssetId: string }>> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const correlationId = randomUUID();
  const input = {
    originalFilename: file.name,
    declaredMimeType: file.type,
    bytes,
    byteSize: bytes.byteLength,
    correlationId,
  };
  const metadataResult = validateUploadMetadata(input);

  if (!metadataResult.ok) {
    throw new Error(`ASSIGNMENT_UPLOAD_REJECTED:${metadataResult.errorCode}`);
  }

  const demoMode = isE2ETestMode();
  const assetId = randomUUID();
  const storagePath = demoMode
    ? `demo/assignment/${assetId}.${safeExtension(file.name)}`
    : `assignments/${dependencies.actorProfileId}/${assetId}.${safeExtension(file.name)}`;
  const sha256 = createHash("sha256").update(bytes).digest("hex");
  const { error: assetError } = await dependencies.adminClient
    .from("media_assets")
    .insert({
      id: assetId,
      storage_path: storagePath,
      original_filename: file.name,
      mime_type: file.type,
      byte_size: bytes.byteLength,
      sha256,
      scan_status: "quarantined",
      uploaded_by: dependencies.actorProfileId,
    });

  if (assetError) {
    throw new Error(`ASSIGNMENT_UPLOAD_STORE_FAILED:${assetError.message}`);
  }

  if (!demoMode) {
    const { error: storageError } = await dependencies.adminClient.storage
      .from("learning-resources")
      .upload(storagePath, bytes, {
        contentType: file.type,
        upsert: false,
      });

    if (storageError) {
      await markRejected(
        dependencies.adminClient,
        assetId,
        "storage_unavailable",
      );
      throw new Error("ASSIGNMENT_UPLOAD_STORAGE_UNAVAILABLE");
    }
  }

  const scannerUrl = demoMode
    ? "https://scanner.invalid/e2e"
    : dependencies.scannerUrl;

  if (!scannerUrl) {
    await markRejected(
      dependencies.adminClient,
      assetId,
      "scanner_unavailable",
    );
    throw new Error("ASSIGNMENT_UPLOAD_SCANNER_UNAVAILABLE");
  }

  const scanResult = await scanUpload(input, {
    scannerUrl,
    fetchImpl: demoMode
      ? async () => Response.json({ status: "clean" })
      : undefined,
  });

  if (!scanResult.ok) {
    await markRejected(dependencies.adminClient, assetId, scanResult.errorCode);
    throw new Error(`ASSIGNMENT_UPLOAD_REJECTED:${scanResult.errorCode}`);
  }

  const { error: cleanError } = await dependencies.adminClient
    .from("media_assets")
    .update({
      scan_status: "clean",
      scan_error_code: null,
      scanned_at: new Date().toISOString(),
    })
    .eq("id", assetId)
    .eq("scan_status", "quarantined");

  if (cleanError) {
    throw new Error(`ASSIGNMENT_UPLOAD_PROMOTION_FAILED:${cleanError.message}`);
  }

  return { mediaAssetId: assetId };
}
