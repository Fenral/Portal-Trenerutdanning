import { randomUUID } from "node:crypto";

import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { claimInvitation } from "@/features/access/invitations/claim-invitation";
import { INVITATION_COOKIE_NAME } from "@/features/access/invitations/constants";
import { SupabaseInvitationRepository } from "@/features/access/invitations/supabase-repository";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

function activationRedirect(requestUrl: URL, error: string): NextResponse {
  const destination = new URL("/activate", requestUrl.origin);
  destination.searchParams.set("error", error);
  return NextResponse.redirect(destination);
}

function clearInvitationCookie(
  cookieStore: Awaited<ReturnType<typeof cookies>>,
  secure: boolean,
): void {
  cookieStore.set(INVITATION_COOKIE_NAME, "", {
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

  if (!code) {
    clearInvitationCookie(cookieStore, secure);
    return activationRedirect(requestUrl, "auth_failed");
  }

  const supabase = await createSupabaseServerClient();
  const { error: exchangeError } =
    await supabase.auth.exchangeCodeForSession(code);

  if (exchangeError) {
    clearInvitationCookie(cookieStore, secure);
    return activationRedirect(requestUrl, "auth_failed");
  }

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  const rawToken = cookieStore.get(INVITATION_COOKIE_NAME)?.value;

  if (userError || !user?.id || !user.email || !rawToken) {
    clearInvitationCookie(cookieStore, secure);
    return activationRedirect(requestUrl, "auth_failed");
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

  clearInvitationCookie(cookieStore, secure);

  if (result.status === "rejected") {
    return activationRedirect(requestUrl, result.reason);
  }

  return NextResponse.redirect(new URL(result.destination, requestUrl.origin));
}
