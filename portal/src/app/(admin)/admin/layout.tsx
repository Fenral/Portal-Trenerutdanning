import { notFound } from "next/navigation";
import type { ReactNode } from "react";

import { AdminShell } from "@/components/shell/AdminShell";
import { isAdministrator } from "@/features/access/require-administrator";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { isDemoMode } from "@/lib/supabase/environment";
import { createSupabaseServerClient } from "@/lib/supabase/server";

function displayNameFor(user: {
  email?: string;
  user_metadata: Record<string, unknown>;
}): string {
  const metadataName = user.user_metadata.full_name;

  if (typeof metadataName === "string" && metadataName.trim()) {
    return metadataName.trim();
  }

  return user.email?.split("@")[0] || "Administrator";
}

export default async function AdminLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  const serverClient = await createSupabaseServerClient();
  const {
    data: { user },
  } = await serverClient.auth.getUser();
  const adminClient = createSupabaseAdminClient();

  if (!user || !(await isAdministrator(user.id, adminClient))) {
    notFound();
  }

  return (
    <AdminShell demoMode={isDemoMode()} userName={displayNameFor(user)}>
      {children}
    </AdminShell>
  );
}
