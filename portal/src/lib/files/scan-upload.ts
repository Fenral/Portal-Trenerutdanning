const MAX_UPLOAD_BYTES = 500 * 1024 * 1024;

const MIME_RULES = {
  "application/pdf": { extensions: ["pdf"], container: "pdf" },
  "application/msword": { extensions: ["doc"], container: "ole" },
  "application/vnd.ms-excel": { extensions: ["xls"], container: "ole" },
  "application/vnd.ms-powerpoint": {
    extensions: ["ppt"],
    container: "ole",
  },
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": {
    extensions: ["pptx"],
    container: "zip",
  },
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": {
    extensions: ["xlsx"],
    container: "zip",
  },
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": {
    extensions: ["docx"],
    container: "zip",
  },
  "image/jpeg": { extensions: ["jpg", "jpeg"], container: "jpeg" },
  "image/png": { extensions: ["png"], container: "png" },
  "video/mp4": { extensions: ["mp4"], container: "mp4" },
} as const;

type SupportedMimeType = keyof typeof MIME_RULES;
type Container = (typeof MIME_RULES)[SupportedMimeType]["container"];

export type UploadInput = {
  originalFilename: string;
  declaredMimeType: string;
  bytes: Uint8Array;
  byteSize: number;
  correlationId: string;
};

export type UploadErrorCode =
  | "file_empty"
  | "file_too_large"
  | "file_type_mismatch"
  | "infected"
  | "scanner_timeout"
  | "scanner_malformed_response"
  | "scanner_unavailable";

export type UploadCheckResult =
  { ok: true } | { ok: false; errorCode: UploadErrorCode };

type ScanUploadDependencies = {
  scannerUrl: string;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
};

function startsWith(bytes: Uint8Array, signature: readonly number[]) {
  return signature.every((value, index) => bytes[index] === value);
}

function matchesContainer(bytes: Uint8Array, container: Container) {
  switch (container) {
    case "pdf":
      return startsWith(bytes, [0x25, 0x50, 0x44, 0x46, 0x2d]);
    case "ole":
      return startsWith(
        bytes,
        [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1],
      );
    case "zip":
      return (
        startsWith(bytes, [0x50, 0x4b, 0x03, 0x04]) ||
        startsWith(bytes, [0x50, 0x4b, 0x05, 0x06]) ||
        startsWith(bytes, [0x50, 0x4b, 0x07, 0x08])
      );
    case "jpeg":
      return startsWith(bytes, [0xff, 0xd8, 0xff]);
    case "png":
      return startsWith(
        bytes,
        [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a],
      );
    case "mp4":
      return (
        bytes.length >= 12 &&
        String.fromCharCode(...bytes.slice(4, 8)) === "ftyp"
      );
  }
}

function extensionOf(filename: string) {
  const basename = filename.split(/[\\/]/).at(-1) ?? "";
  const dotIndex = basename.lastIndexOf(".");

  return dotIndex === -1 ? "" : basename.slice(dotIndex + 1).toLowerCase();
}

function isSupportedMimeType(value: string): value is SupportedMimeType {
  return Object.hasOwn(MIME_RULES, value);
}

export function validateUploadMetadata(input: UploadInput): UploadCheckResult {
  if (input.byteSize <= 0 || input.bytes.byteLength === 0) {
    return { ok: false, errorCode: "file_empty" };
  }

  if (
    input.byteSize > MAX_UPLOAD_BYTES ||
    input.byteSize !== input.bytes.byteLength
  ) {
    return { ok: false, errorCode: "file_too_large" };
  }

  if (!isSupportedMimeType(input.declaredMimeType)) {
    return { ok: false, errorCode: "file_type_mismatch" };
  }

  const rule = MIME_RULES[input.declaredMimeType];
  if (
    !(rule.extensions as readonly string[]).includes(
      extensionOf(input.originalFilename),
    ) ||
    !matchesContainer(input.bytes, rule.container)
  ) {
    return { ok: false, errorCode: "file_type_mismatch" };
  }

  return { ok: true };
}

function isTimeout(error: unknown, signal: AbortSignal) {
  const errorName =
    typeof error === "object" && error !== null && "name" in error
      ? error.name
      : undefined;

  return (
    signal.aborted || errorName === "AbortError" || errorName === "TimeoutError"
  );
}

export async function scanUpload(
  input: UploadInput,
  dependencies: ScanUploadDependencies,
): Promise<UploadCheckResult> {
  const validation = validateUploadMetadata(input);
  if (!validation.ok) {
    return validation;
  }

  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    dependencies.timeoutMs ?? 10_000,
  );

  try {
    const response = await (dependencies.fetchImpl ?? fetch)(
      dependencies.scannerUrl,
      {
        method: "POST",
        body: input.bytes as BodyInit,
        cache: "no-store",
        signal: controller.signal,
        headers: {
          "content-type": input.declaredMimeType,
          "x-correlation-id": input.correlationId,
        },
      },
    );

    if (!response.ok) {
      return { ok: false, errorCode: "scanner_unavailable" };
    }

    let payload: unknown;
    try {
      payload = await response.json();
    } catch {
      return { ok: false, errorCode: "scanner_malformed_response" };
    }

    if (
      typeof payload !== "object" ||
      payload === null ||
      !("status" in payload)
    ) {
      return { ok: false, errorCode: "scanner_malformed_response" };
    }

    if (payload.status === "clean") {
      return { ok: true };
    }

    if (payload.status === "infected") {
      return { ok: false, errorCode: "infected" };
    }

    return { ok: false, errorCode: "scanner_malformed_response" };
  } catch (error) {
    return {
      ok: false,
      errorCode: isTimeout(error, controller.signal)
        ? "scanner_timeout"
        : "scanner_unavailable",
    };
  } finally {
    clearTimeout(timeout);
  }
}
