import { notFound } from "next/navigation";
import type { ReactNode } from "react";

import { TeacherShell } from "@/components/shell/TeacherShell";
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

  const [profileResult, courseResult] = await Promise.all([
    client.from("profiles").select("display_name").limit(1).maybeSingle(),
    client
      .from("course_runs")
      .select("title")
      .order("start_year", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  if (profileResult.error || courseResult.error) notFound();

  return (
    <TeacherShell
      courseTitle={courseResult.data?.title ?? "Aktivt kurs"}
      demoMode={isDemoMode()}
      userName={profileResult.data?.display_name ?? "Kurslærer"}
    >
      {children}
    </TeacherShell>
  );
}
