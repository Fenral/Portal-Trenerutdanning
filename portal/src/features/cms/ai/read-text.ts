import { CmsError } from "@/features/cms/server/errors";

/** Counts bytes while reading; Content-Length alone is not a trustworthy limit. */
export async function readBoundedText(
  body: ReadableStream<Uint8Array> | null,
  maxBytes: number,
  tooLarge: CmsError,
): Promise<string> {
  if (!body) return "";
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let byteCount = 0;
  let text = "";
  try {
    while (true) {
      const part = await reader.read();
      if (part.done) break;
      byteCount += part.value.byteLength;
      if (byteCount > maxBytes) {
        void reader.cancel().catch(() => undefined);
        throw tooLarge;
      }
      text += decoder.decode(part.value, { stream: true });
    }
    return text + decoder.decode();
  } finally {
    reader.releaseLock();
  }
}
