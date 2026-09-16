import { cmsAiLimiter } from "@/features/cms/ai/limiter";
import {
  generateCmsAiProposal,
  getCmsAiStatus,
} from "@/features/cms/ai/provider";
import { readBoundedText } from "@/features/cms/ai/read-text";
import {
  CMS_AI_MAX_REQUEST_BYTES,
  CmsAiRequest,
} from "@/features/cms/ai/schema";
import {
  authorizeCmsItem,
  requireCmsSession,
  requireCmsStaff,
} from "@/features/cms/server/auth";
import { CmsError, cmsErrorResponse } from "@/features/cms/server/errors";

export const runtime = "nodejs";
export const maxDuration = 90;

function errorResponse(error: unknown) {
  const response = cmsErrorResponse(error);
  response.headers.set("Cache-Control", "no-store");
  if (response.status === 429) response.headers.set("Retry-After", "60");
  return response;
}

export async function GET() {
  try {
    const session = await requireCmsSession();
    requireCmsStaff(session);
    return Response.json(getCmsAiStatus(), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  let release: (() => void) | undefined;
  try {
    const session = await requireCmsSession();
    requireCmsStaff(session);
    const origin = request.headers.get("origin");
    if (origin && origin !== new URL(request.url).origin) {
      throw new CmsError(403, "AI-forespørselen må sendes fra portalen.");
    }
    if (
      request.headers
        .get("content-type")
        ?.split(";", 1)[0]
        .trim()
        .toLowerCase() !== "application/json"
    ) {
      throw new CmsError(415, "Forespørselen må inneholde JSON.");
    }
    const tooLarge = new CmsError(
      413,
      "Innholdet er for stort for én AI-forespørsel. Reduser tekst eller samtalehistorikk.",
    );
    const contentLength = Number(request.headers.get("content-length"));
    if (contentLength > CMS_AI_MAX_REQUEST_BYTES) throw tooLarge;
    const text = await readBoundedText(
      request.body,
      CMS_AI_MAX_REQUEST_BYTES,
      tooLarge,
    );
    const input = CmsAiRequest.parse(JSON.parse(text));
    await authorizeCmsItem(session, input.itemId);
    release = cmsAiLimiter.acquire(session.profileId);
    const proposal = await generateCmsAiProposal(input, {
      signal: request.signal,
    });
    return Response.json(proposal, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    return errorResponse(error);
  } finally {
    release?.();
  }
}
