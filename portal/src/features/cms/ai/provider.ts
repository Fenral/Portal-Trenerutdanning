import "server-only";

import { CmsError } from "@/features/cms/server/errors";

import { buildCmsAiInput, buildCmsAiInstructions } from "./prompt";
import { readBoundedText } from "./read-text";
import {
  parseCmsAiProposal,
  type CmsAiProposal,
  type CmsAiRequest,
} from "./schema";

// Official model and Responses JSON-mode docs checked 2026-09-16:
// https://developers.openai.com/api/docs/models/gpt-5.6-terra
// https://developers.openai.com/api/docs/guides/structured-outputs#json-mode
export const CMS_AI_DEFAULT_MODEL = "gpt-5.6-terra";
export const CMS_AI_TIMEOUT_MS = 75_000;
const MAX_PROVIDER_BYTES = 1_000_000;

export function getCmsAiStatus(): { configured: boolean; model: string } {
  return {
    configured: Boolean(process.env.OPENAI_API_KEY?.trim()),
    model: process.env.CMS_AI_MODEL?.trim() || CMS_AI_DEFAULT_MODEL,
  };
}

function record(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function providerOutputText(body: unknown): string {
  const response = record(body);
  if (!response || !Array.isArray(response.output)) {
    throw new CmsError(
      502,
      "AI-tjenesten returnerte et ugyldig svar. Prøv igjen.",
    );
  }
  const output: string[] = [];
  for (const rawItem of response.output) {
    const item = record(rawItem);
    if (item?.type !== "message" || !Array.isArray(item.content)) continue;
    for (const rawPart of item.content) {
      const part = record(rawPart);
      if (part?.type === "refusal") {
        throw new CmsError(
          422,
          "AI-assistenten kunne ikke lage dette forslaget. Prøv å formulere ønsket annerledes.",
        );
      }
      if (part?.type === "output_text" && typeof part.text === "string") {
        output.push(part.text);
      }
    }
  }
  if (
    response.status !== "completed" ||
    response.error ||
    output.length === 0
  ) {
    throw new CmsError(
      502,
      "AI-forslaget ble ikke fullført. Prøv en kortere forespørsel eller en mindre endring.",
    );
  }
  return output.join("");
}

export async function generateCmsAiProposal(
  request: CmsAiRequest,
  options: { signal?: AbortSignal; fetch?: typeof fetch } = {},
): Promise<CmsAiProposal> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    throw new CmsError(
      503,
      "AI-assistenten er ikke konfigurert. Administrator må legge til en API-nøkkel på serveren.",
    );
  }

  const signal = AbortSignal.any([
    AbortSignal.timeout(CMS_AI_TIMEOUT_MS),
    ...(options.signal ? [options.signal] : []),
  ]);
  try {
    const response = await (options.fetch ?? fetch)(
      "https://api.openai.com/v1/responses",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        signal,
        cache: "no-store",
        redirect: "error",
        body: JSON.stringify({
          model: getCmsAiStatus().model,
          instructions: buildCmsAiInstructions(),
          input: [{ role: "user", content: buildCmsAiInput(request) }],
          text: { format: { type: "json_object" } },
          max_output_tokens: 24_000,
          store: false,
          tools: [],
        }),
      },
    );

    if (!response.ok) {
      void response.body?.cancel().catch(() => undefined);
      if (response.status === 429) {
        throw new CmsError(
          429,
          "AI-tjenesten har nådd en kapasitetsgrense. Vent ett minutt før du prøver igjen.",
        );
      }
      if ([400, 401, 403, 404].includes(response.status)) {
        throw new CmsError(
          503,
          "AI-tjenesten er ikke riktig konfigurert. Kontakt administrator.",
        );
      }
      throw new CmsError(
        502,
        "AI-tjenesten er midlertidig utilgjengelig. Prøv igjen senere.",
      );
    }

    const text = await readBoundedText(
      response.body,
      MAX_PROVIDER_BYTES,
      new CmsError(502, "AI-forslaget ble for stort. Be om en mindre endring."),
    );
    let output: unknown;
    try {
      output = JSON.parse(providerOutputText(JSON.parse(text)));
    } catch (error) {
      if (error instanceof CmsError) throw error;
      throw new CmsError(
        502,
        "AI-tjenesten returnerte et ugyldig svar. Prøv igjen.",
      );
    }
    return parseCmsAiProposal(output, request.document);
  } catch (error) {
    if (error instanceof CmsError) throw error;
    if (signal.aborted) {
      throw new CmsError(
        options.signal?.aborted ? 408 : 504,
        options.signal?.aborted
          ? "AI-forespørselen ble avbrutt."
          : "AI-forslaget tok for lang tid. Prøv en mindre endring.",
      );
    }
    throw new CmsError(502, "Kunne ikke nå AI-tjenesten. Prøv igjen senere.");
  }
}
