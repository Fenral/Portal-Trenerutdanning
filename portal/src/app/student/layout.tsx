import { notFound } from "next/navigation";
import type { ReactNode } from "react";

import { StudentShell } from "@/components/shell/StudentShell";
import { loadStudentIdentity } from "@/features/content/student-data";
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

  return (
    <StudentShell
      courseTitle={identity.courseTitle}
      userName={identity.displayName}
    >
      {children}
    </StudentShell>
  );
}
