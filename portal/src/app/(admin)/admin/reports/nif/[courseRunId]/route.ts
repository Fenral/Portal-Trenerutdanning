import { notFound } from "next/navigation";

import { isAdministrator } from "@/features/access/require-administrator";
import {
  generateNifReport,
  nifReportFilename,
} from "@/features/reporting/nif-report";
import { loadNifReportInput } from "@/features/reporting/nif-report-data";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type RouteContext = Readonly<{
  params: Promise<{ courseRunId: string }>;
}>;

export async function GET(_request: Request, context: RouteContext) {
  const [{ courseRunId }, serverClient] = await Promise.all([
    context.params,
    createSupabaseServerClient(),
  ]);
  const {
    data: { user },
  } = await serverClient.auth.getUser();
  const adminClient = createSupabaseAdminClient();
  if (!user || !(await isAdministrator(user.id, adminClient))) notFound();

  const courseResult = await adminClient
    .from("course_runs")
    .select("title,start_year")
    .eq("id", courseRunId)
    .maybeSingle();
  if (courseResult.error || !courseResult.data) notFound();

  const input = await loadNifReportInput(adminClient, courseRunId);
  const workbook = generateNifReport(input);
  const filename = nifReportFilename(
    courseResult.data.title,
    courseResult.data.start_year,
  );

  return new Response(new Blob([workbook]), {
    headers: {
      "Cache-Control": "private, no-store",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Content-Length": String(workbook.byteLength),
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    },
  });
}
