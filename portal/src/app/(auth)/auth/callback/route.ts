import { randomUUID } from "node:crypto";

import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { claimInvitation } from "@/features/access/invitations/claim-invitation";
import { INVITATION_COOKIE_NAME } from "@/features/access/invitations/constants";
import { SupabaseInvitationRepository } from "@/features/access/invitations/supabase-repository";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  createSupabaseServerClient,
  type SupabaseCookieWrite,
} from "@/lib/supabase/server";

type PendingSession = {
  cookies: SupabaseCookieWrite[];
  headers: Record<string, string>;
};

function applyPendingSession(
  response: NextResponse,
  pendingSession: PendingSession,
): void {
  for (const cookie of pendingSession.cookies) {
    response.cookies.set(cookie.name, cookie.value, cookie.options);
  }
  for (const [name, value] of Object.entries(pendingSession.headers)) {
    response.headers.set(name, value);
  }
}

function redirectWithSession(
  destination: URL,
  pendingSession: PendingSession,
): NextResponse {
  const response = NextResponse.redirect(destination);
  applyPendingSession(response, pendingSession);

  return response;
}

function escapeHtmlAttribute(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function completeAuthentication(
  destination: URL,
  pendingSession: PendingSession,
): NextResponse {
  const safeDestination = escapeHtmlAttribute(
    `${destination.pathname}${destination.search}`,
  );
  const response = new NextResponse(
    `<!doctype html><html lang="nb"><head><meta charset="utf-8"><meta http-equiv="refresh" content="0;url=${safeDestination}"><meta name="robots" content="noindex"><title>Logger inn</title></head><body><p>Logger inn …</p><a href="${safeDestination}">Fortsett</a></body></html>`,
    {
      status: 200,
      headers: { "Content-Type": "text/html; charset=utf-8" },
    },
  );
  applyPendingSession(response, pendingSession);

  return response;
}

function activationRedirect(
  requestUrl: URL,
  error: string,
  pendingSession: PendingSession,
): NextResponse {
  const destination = new URL("/activate", requestUrl.origin);
  destination.searchParams.set("error", error);
  return redirectWithSession(destination, pendingSession);
}

function clearInvitationCookie(response: NextResponse, secure: boolean): void {
  response.cookies.set(INVITATION_COOKIE_NAME, "", {
    expires: new Date(0),
    httpOnly: true,
    maxAge: 0,
    path: "/auth/callback",
    sameSite: "lax",
    secure,
  });
}

export async function GET(request: Request): Promise<NextResponse> {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const cookieStore = await cookies();
  const secure = requestUrl.protocol === "https:";
  const pendingSession: PendingSession = { cookies: [], headers: {} };

  if (!code) {
    const response = activationRedirect(
      requestUrl,
      "auth_failed",
      pendingSession,
    );
    clearInvitationCookie(response, secure);
    return response;
  }

  const supabase = await createSupabaseServerClient((cookiesToSet, headers) => {
    pendingSession.cookies.push(...cookiesToSet);
    Object.assign(pendingSession.headers, headers);
  });
  const { error: exchangeError } =
    await supabase.auth.exchangeCodeForSession(code);

  if (exchangeError) {
    const response = activationRedirect(
      requestUrl,
      "auth_failed",
      pendingSession,
    );
    clearInvitationCookie(response, secure);
    return response;
  }

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  const rawToken = cookieStore.get(INVITATION_COOKIE_NAME)?.value;

  if (userError || !user?.id || !user.email || !rawToken) {
    const response = activationRedirect(
      requestUrl,
      "auth_failed",
      pendingSession,
    );
    clearInvitationCookie(response, secure);
    return response;
  }

  const repository = new SupabaseInvitationRepository(
    supabase,
    createSupabaseAdminClient(),
  );
  const result = await claimInvitation(
    {
      rawToken,
      authenticatedUserId: user.id,
      authenticatedEmail: user.email,
      now: new Date(),
      correlationId: randomUUID(),
    },
    { repository },
  );

  if (result.status === "rejected") {
    const response = activationRedirect(
      requestUrl,
      result.reason,
      pendingSession,
    );
    clearInvitationCookie(response, secure);
    return response;
  }

  const response = completeAuthentication(
    new URL(result.destination, requestUrl.origin),
    pendingSession,
  );
  clearInvitationCookie(response, secure);
  return response;
}
