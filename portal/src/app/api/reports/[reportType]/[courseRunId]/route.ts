import { notFound } from "next/navigation";

import { isReportType } from "@/features/reporting/definitions";
import { generateReportWorkbook } from "@/features/reporting/export-excel";
import { generateReportPdf } from "@/features/reporting/export-pdf";
import {
  buildReport,
  canExportCourseReport,
} from "@/features/reporting/report-builders";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type RouteContext = Readonly<{
  params: Promise<{ reportType: string; courseRunId: string }>;
}>;

const UUID_PATTERN = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;

function slug(value: string): string {
  return (
    value
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .toLowerCase() || "kurs"
  );
}

export async function GET(request: Request, context: RouteContext) {
  const [{ reportType, courseRunId }, serverClient] = await Promise.all([
    context.params,
    createSupabaseServerClient(),
  ]);
  const format =
    new URL(request.url).searchParams.get("format")?.toLowerCase() ?? "xlsx";

  if (
    !isReportType(reportType) ||
    !UUID_PATTERN.test(courseRunId) ||
    (format !== "xlsx" && format !== "pdf")
  ) {
    notFound();
  }

  const {
    data: { user },
  } = await serverClient.auth.getUser();
  const adminClient = createSupabaseAdminClient();
  if (
    !user ||
    !(await canExportCourseReport(
      adminClient,
      user.id,
      courseRunId,
      reportType,
    ))
  ) {
    notFound();
  }

  const table = await buildReport(adminClient, reportType, courseRunId);
  const filename = `${reportType.replaceAll("_", "-")}-${slug(table.courseTitle)}.${format}`;

  const [body, contentType] =
    format === "xlsx"
      ? [
          generateReportWorkbook(table),
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        ]
      : [await generateReportPdf(table), "application/pdf"];

  return new Response(new Blob([body]), {
    headers: {
      "Cache-Control": "private, no-store",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Content-Length": String(body.byteLength),
      "Content-Type": contentType,
    },
  });
}
