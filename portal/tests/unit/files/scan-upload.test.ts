import { describe, expect, it, vi } from "vitest";

import { scanUpload, validateUploadMetadata } from "@/lib/files/scan-upload";

const PDF_BYTES = Uint8Array.from([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31]);
const CORRELATION_ID = "40000000-0000-4000-8000-000000000001";

const upload = {
  originalFilename: "ballfluktslover.pdf",
  declaredMimeType: "application/pdf",
  bytes: PDF_BYTES,
  byteSize: PDF_BYTES.byteLength,
  correlationId: CORRELATION_ID,
};

function scannerResponse(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "content-type": "application/json" },
  });
}

describe("validateUploadMetadata", () => {
  it("accepts matching PDF magic bytes and rejects a disguised executable", () => {
    expect(validateUploadMetadata(upload)).toEqual({ ok: true });
    expect(
      validateUploadMetadata({
        ...upload,
        bytes: Uint8Array.from([0x4d, 0x5a, 0x90, 0x00]),
        byteSize: 4,
      }),
    ).toEqual({ ok: false, errorCode: "file_type_mismatch" });
  });
});

describe("scanUpload", () => {
  it("promotes only an exact clean response", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(scannerResponse({ status: "clean" }));

    await expect(
      scanUpload(upload, {
        scannerUrl: "https://scanner.eu.example/scan",
        fetchImpl,
      }),
    ).resolves.toEqual({ ok: true });

    expect(fetchImpl).toHaveBeenCalledWith(
      "https://scanner.eu.example/scan",
      expect.objectContaining({
        method: "POST",
        body: PDF_BYTES,
        headers: expect.objectContaining({
          "content-type": "application/pdf",
          "x-correlation-id": CORRELATION_ID,
        }),
      }),
    );
    expect(JSON.stringify(fetchImpl.mock.calls)).not.toContain(
      "ballfluktslover.pdf",
    );
  });

  it("rejects an infected response", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(scannerResponse({ status: "infected" }));

    await expect(
      scanUpload(upload, {
        scannerUrl: "https://scanner.eu.example/scan",
        fetchImpl,
      }),
    ).resolves.toEqual({ ok: false, errorCode: "infected" });
  });

  it("fails closed on timeout", async () => {
    const fetchImpl = vi
      .fn()
      .mockRejectedValue(new DOMException("Timed out", "TimeoutError"));

    await expect(
      scanUpload(upload, {
        scannerUrl: "https://scanner.eu.example/scan",
        fetchImpl,
      }),
    ).resolves.toEqual({ ok: false, errorCode: "scanner_timeout" });
  });

  it("fails closed on a malformed response", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(scannerResponse({ status: "maybe" }));

    await expect(
      scanUpload(upload, {
        scannerUrl: "https://scanner.eu.example/scan",
        fetchImpl,
      }),
    ).resolves.toEqual({
      ok: false,
      errorCode: "scanner_malformed_response",
    });
  });

  it("fails closed when the scanner is unavailable", async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new Error("ECONNREFUSED"));

    await expect(
      scanUpload(upload, {
        scannerUrl: "https://scanner.eu.example/scan",
        fetchImpl,
      }),
    ).resolves.toEqual({
      ok: false,
      errorCode: "scanner_unavailable",
    });
  });
});
