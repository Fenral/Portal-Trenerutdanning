import { createHash, timingSafeEqual } from "node:crypto";

import { processOutboxOnce } from "@/features/notifications/process-outbox";
import { createNotificationTransportFromEnvironment } from "@/features/notifications/smtp-transport";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getApplicationUrl } from "@/lib/supabase/environment";

export const dynamic = "force-dynamic";

function sha256(value: string): Buffer {
  return createHash("sha256").update(value, "utf8").digest();
}

function isAuthorizedCronRequest(
  authorizationHeader: string | null,
  secret: string,
): boolean {
  // Hash begge sider til lik lengde slik at timingSafeEqual kan brukes trygt.
  return timingSafeEqual(
    sha256(authorizationHeader ?? ""),
    sha256(`Bearer ${secret}`),
  );
}

export async function GET(request: Request): Promise<Response> {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return new Response(null, { status: 404 });
  }

  if (!isAuthorizedCronRequest(request.headers.get("authorization"), secret)) {
    return new Response(null, { status: 401 });
  }

  const portalUrl = getApplicationUrl();
  const result = await processOutboxOnce({
    client: createSupabaseAdminClient(),
    transport: createNotificationTransportFromEnvironment(),
    activationBaseUrl: `${portalUrl}/activate`,
    portalUrl,
  });

  return Response.json(result);
}
