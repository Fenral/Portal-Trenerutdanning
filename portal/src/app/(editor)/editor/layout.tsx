import { notFound, redirect } from "next/navigation";
import type { ReactNode } from "react";

import { AdminShell } from "@/components/shell/AdminShell";
import { requireCmsSession } from "@/features/cms/server/auth";
import { isDemoMode } from "@/lib/supabase/environment";

function displayNameFor(user: {
  email?: string;
  user_metadata: Record<string, unknown>;
}): string {
  const metadataName = user.user_metadata.full_name;

  if (typeof metadataName === "string" && metadataName.trim()) {
    return metadataName.trim();
  }

  return user.email?.split("@")[0] || "Redaktør";
}

export default async function EditorLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  const session = await requireCmsSession().catch(() => null);
  if (!session) redirect("/login");
  if (!session.isGlobalManager && !session.courseIds.length) {
    notFound();
  }

  const {
    data: { user },
  } = await session.client.auth.getUser();

  if (!user) {
    notFound();
  }

  const globalRoles = session.isGlobalManager
    ? await session.admin
        .from("role_assignments")
        .select("role")
        .eq("profile_id", session.profileId)
        .is("course_run_id", null)
        .is("course_template_id", null)
        .is("revoked_at", null)
    : null;
  const roleLabel = !session.isGlobalManager
    ? "Kurslærer"
    : globalRoles?.data?.some(
          (assignment) => assignment.role === "administrator",
        )
      ? "Administrator"
      : "Redaktør";

  return (
    <AdminShell
      contextLabel="Innhold"
      demoMode={isDemoMode()}
      roleLabel={roleLabel}
      topbarLabel="Pensum · Bokmål"
      userName={displayNameFor(user)}
    >
      {children}
    </AdminShell>
  );
}
