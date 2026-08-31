import { createSupabaseServerClient } from "@/lib/supabase/server";

type RouteContext = Readonly<{
  params: Promise<{ assetId: string }>;
}>;

type AssetRow = Readonly<{
  id: string;
  storage_path: string;
  original_filename: string;
  mime_type: string;
}>;

function safeFilename(filename: string): string {
  return filename.replace(/[^a-zA-Z0-9._-]/g, "_");
}

function buildDemoPdf(): Uint8Array {
  const stream =
    "BT /F1 22 Tf 72 760 Td (Ballfluktslover og balltreff) Tj 0 -38 Td /F1 12 Tf (Demoressurs fra Trenerloftet) Tj ET";
  const objects = [
    "1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n",
    "2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n",
    "3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>\nendobj\n",
    `4 0 obj\n<< /Length ${stream.length} >>\nstream\n${stream}\nendstream\nendobj\n`,
    "5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n",
  ];
  let pdf = "%PDF-1.4\n";
  const offsets = [0];

  for (const object of objects) {
    offsets.push(new TextEncoder().encode(pdf).byteLength);
    pdf += object;
  }

  const xrefOffset = new TextEncoder().encode(pdf).byteLength;
  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += "0000000000 65535 f \n";
  pdf += offsets
    .slice(1)
    .map((offset) => `${String(offset).padStart(10, "0")} 00000 n \n`)
    .join("");
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;

  return new TextEncoder().encode(pdf);
}

function demoFile(asset: AssetRow): Uint8Array {
  if (asset.mime_type === "application/pdf") return buildDemoPdf();

  return new TextEncoder().encode(
    `Demoressurs: ${asset.original_filename}\nDen endelige filen lastes opp av redaktøren i produksjon.\n`,
  );
}

function notFoundResponse(): Response {
  return new Response("Ikke funnet", {
    status: 404,
    headers: { "Cache-Control": "private, no-store" },
  });
}

export async function GET(
  request: Request,
  context: RouteContext,
): Promise<Response> {
  const { assetId } = await context.params;
  const client = await createSupabaseServerClient();
  const {
    data: { user },
  } = await client.auth.getUser();

  if (!user) return notFoundResponse();

  const { data, error } = await client
    .from("media_assets")
    .select("id,storage_path,original_filename,mime_type")
    .eq("id", assetId)
    .maybeSingle();

  if (error || !data) return notFoundResponse();

  const asset = data as AssetRow;
  const download = new URL(request.url).searchParams.get("download") === "1";
  const disposition = download ? "attachment" : "inline";
  const filename = safeFilename(asset.original_filename);

  if (asset.storage_path.startsWith("demo/")) {
    const body = demoFile(asset);

    return new Response(body.buffer as ArrayBuffer, {
      headers: {
        "Cache-Control": "private, no-store",
        "Content-Disposition": `${disposition}; filename="${filename}"`,
        "Content-Type": asset.mime_type,
        "X-Content-Type-Options": "nosniff",
      },
    });
  }

  const { data: signedData, error: signedError } = await client.storage
    .from("learning-resources")
    .createSignedUrl(asset.storage_path, 60, {
      download: download ? asset.original_filename : false,
    });

  if (signedError || !signedData?.signedUrl) return notFoundResponse();

  return Response.redirect(signedData.signedUrl, 307);
}
