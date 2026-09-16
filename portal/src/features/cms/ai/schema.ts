import { z } from "zod";

import { ContentDocument } from "@/features/content/document-schema";
import { CmsError } from "@/features/cms/server/errors";

export const CMS_AI_MAX_REQUEST_BYTES = 240_000;

export const CmsAiRequest = z
  .object({
    itemId: z.string().regex(/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i),
    prompt: z.string().trim().min(1).max(6_000),
    document: ContentDocument,
    history: z
      .array(
        z
          .object({
            role: z.enum(["user", "assistant"]),
            content: z.string().trim().min(1).max(6_000),
          })
          .strict(),
      )
      .max(12)
      .optional(),
  })
  .strict();

export type CmsAiRequest = z.infer<typeof CmsAiRequest>;

const ProposalEnvelope = z
  .object({
    document: z.unknown(),
    summary: z.string().trim().min(1).max(2_000),
  })
  .strict();

export type CmsAiProposal = {
  document: ContentDocument;
  summary: string;
};

function attachmentReferences(value: unknown, references = new Set<string>()) {
  if (Array.isArray(value)) {
    for (const child of value) attachmentReferences(child, references);
  } else if (value !== null && typeof value === "object") {
    for (const [key, child] of Object.entries(value)) {
      if (key === "assetId" && typeof child === "string") {
        references.add(child.toLowerCase());
      } else if (key === "attachmentIds" && Array.isArray(child)) {
        for (const id of child) {
          if (typeof id === "string") references.add(id.toLowerCase());
        }
      } else {
        attachmentReferences(child, references);
      }
    }
  }
  return references;
}

function sameSet(left: Set<string>, right: Set<string>) {
  return (
    left.size === right.size && [...left].every((entry) => right.has(entry))
  );
}

export function parseCmsAiProposal(
  output: unknown,
  original: ContentDocument,
): CmsAiProposal {
  let proposal: CmsAiProposal;
  try {
    const envelope = ProposalEnvelope.parse(output);
    proposal = {
      document: ContentDocument.parse(envelope.document),
      summary: envelope.summary,
    };
  } catch {
    throw new CmsError(
      502,
      "AI-forslaget hadde et ugyldig innholdsformat. Prøv å beskrive en mindre endring.",
    );
  }

  if (
    !sameSet(
      attachmentReferences(original),
      attachmentReferences(proposal.document),
    ) ||
    !sameSet(
      new Set((original.attachmentIds ?? []).map((id) => id.toLowerCase())),
      new Set(
        (proposal.document.attachmentIds ?? []).map((id) => id.toLowerCase()),
      ),
    )
  ) {
    throw new CmsError(
      502,
      "AI-forslaget endret vedleggsreferanser og ble avvist. Prøv igjen med en mindre endring.",
    );
  }

  const sourceKey = (source: { title: string; url?: string }) =>
    JSON.stringify([source.title, source.url ?? null]);
  if (
    !sameSet(
      new Set((original.sources ?? []).map(sourceKey)),
      new Set((proposal.document.sources ?? []).map(sourceKey)),
    )
  ) {
    throw new CmsError(
      502,
      "AI-forslaget endret kildelisten og ble avvist. Legg til kilder i redaktøren først.",
    );
  }

  return proposal;
}
