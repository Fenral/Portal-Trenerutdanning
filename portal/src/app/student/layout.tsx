import { notFound } from "next/navigation";
import type { ReactNode } from "react";

import { StudentShell } from "@/components/shell/StudentShell";
import { loadStudentIdentity } from "@/features/content/student-data";
import { countUnreadMessages } from "@/features/messaging/data";
import { isDemoMode } from "@/lib/supabase/environment";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function StudentLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  const client = await createSupabaseServerClient();
  const {
    data: { user },
  } = await client.auth.getUser();

  if (!user) notFound();

  const identity = await loadStudentIdentity(client);
  const unreadMessages = await countUnreadMessages(client, identity.profileId);

  return (
    <StudentShell
      courseRunId={identity.courseRunId}
      courseTitle={identity.courseTitle}
      demoMode={isDemoMode()}
      unreadMessages={unreadMessages}
      userName={identity.displayName}
    >
      {children}
    </StudentShell>
  );
}
