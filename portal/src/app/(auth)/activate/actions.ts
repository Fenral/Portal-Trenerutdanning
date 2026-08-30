"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { SupabaseInvitationRepository } from "@/features/access/invitations/supabase-repository";
import { hashInvitationToken } from "@/features/access/invitations/token";
import { INVITATION_COOKIE_NAME } from "@/features/access/invitations/constants";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getApplicationUrl } from "@/lib/supabase/environment";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const INVITATION_COOKIE_MAX_AGE_SECONDS = 20 * 60;

function activationError(reason: string): never {
  redirect("/activate?error=" + encodeURIComponent(reason));
}

export async function requestInvitationSignIn(
  formData: FormData,
): Promise<void> {
  const rawToken = formData.get("token");

  if (typeof rawToken !== "string" || rawToken.length < 20) {
    activationError("invalid");
  }

  const adminClient = createSupabaseAdminClient();
  const repository = new SupabaseInvitationRepository(adminClient, adminClient);
  const invitation = await repository.inspectByHash({
    tokenHash: hashInvitationToken(rawToken),
    now: new Date(),
  });

  if (!invitation || invitation.claimState !== "valid") {
    activationError(invitation?.claimState ?? "invalid");
  }

  const applicationUrl = new URL(getApplicationUrl());

  if (
    process.env.NODE_ENV === "production" &&
    applicationUrl.protocol !== "https:"
  ) {
    throw new Error("Production application URL must use HTTPS");
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithOtp({
    email: invitation.normalizedEmail,
    options: {
      shouldCreateUser: true,
      emailRedirectTo: new URL("/auth/callback", applicationUrl).toString(),
    },
  });

  if (error) {
    activationError("email_failed");
  }

  const cookieStore = await cookies();
  cookieStore.set(INVITATION_COOKIE_NAME, rawToken, {
    httpOnly: true,
    maxAge: INVITATION_COOKIE_MAX_AGE_SECONDS,
    path: "/auth/callback",
    sameSite: "lax",
    secure: applicationUrl.protocol === "https:",
  });

  redirect("/activate?status=check-email");
}
