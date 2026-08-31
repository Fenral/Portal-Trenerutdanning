import { notFound } from "next/navigation";
import type { ReactNode } from "react";

import { AdminShell } from "@/components/shell/AdminShell";
import { getContentManagerIdentity } from "@/features/access/require-content-manager";
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

  return user.email?.split("@")[0] || "Redaktør";
}

export default async function EditorLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  const serverClient = await createSupabaseServerClient();
  const {
    data: { user },
  } = await serverClient.auth.getUser();
  const adminClient = createSupabaseAdminClient();
  const identity = user
    ? await getContentManagerIdentity(user.id, adminClient)
    : null;

  if (!user || !identity) {
    notFound();
  }

  return (
    <AdminShell
      contextLabel="Innhold"
      demoMode={isDemoMode()}
      roleLabel={identity.role === "editor" ? "Redaktør" : "Administrator"}
      topbarLabel="Pensum · Bokmål"
      userName={displayNameFor(user)}
    >
      {children}
    </AdminShell>
  );
}
