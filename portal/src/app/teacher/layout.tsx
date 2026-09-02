import { notFound } from "next/navigation";
import type { ReactNode } from "react";

import { TeacherShell } from "@/components/shell/TeacherShell";
import { resolveTeacherCourseAccess } from "@/features/access/teacher-course";
import { isDemoMode } from "@/lib/supabase/environment";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function TeacherLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  const client = await createSupabaseServerClient();
  const {
    data: { user },
  } = await client.auth.getUser();

  if (!user) notFound();

  const [profileResult, access] = await Promise.all([
    client.from("profiles").select("display_name").limit(1).maybeSingle(),
    resolveTeacherCourseAccess(client),
  ]);

  if (profileResult.error) notFound();
  if (!access.isTeacher) notFound();

  return (
    <TeacherShell
      courseTitle={access.run?.title ?? "Aktivt kurs"}
      demoMode={isDemoMode()}
      userName={profileResult.data?.display_name ?? "Kurslærer"}
    >
      {children}
    </TeacherShell>
  );
}
