import { ZodError } from "zod";

export class CmsError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "CmsError";
  }
}

export function assertCmsQuery(
  error: { message: string; code?: string } | null,
) {
  if (!error) return;
  if (error.message.includes("CMS_CONFLICT")) {
    throw new CmsError(
      409,
      "Kladden er endret siden du åpnet den. Last inn siste versjon før du fortsetter.",
    );
  }
  if (error.code === "42501" || error.message.includes("FORBIDDEN")) {
    throw new CmsError(403, "Du har ikke tilgang til dette innholdet.");
  }
  if (error.code === "P0002" || error.message.includes("NOT_FOUND")) {
    throw new CmsError(404, "Innholdet finnes ikke.");
  }
  if (error.message.includes("CMS_SOURCE_UNPUBLISHED")) {
    throw new CmsError(422, "Publiser originalen før du lager en kursvariant.");
  }
  if (error.message.includes("CMS_VARIANT_EXISTS") || error.code === "23505") {
    throw new CmsError(409, "En kursvariant finnes allerede for dette kurset.");
  }
  if (error.message.includes("CMS_COURSE_CLOSED")) {
    throw new CmsError(422, "Et avsluttet kurs kan ikke få nytt innhold.");
  }
  if (error.message.includes("CONTENT_PUBLISH_BLOCKED")) {
    throw new CmsError(
      422,
      "Publisering ble stoppet fordi en obligatorisk video mangler bekreftede undertekster eller transkripsjon. Kontroller videoen og lagre kladden på nytt.",
    );
  }
  if (error.code === "22023" || error.code === "23514") {
    throw new CmsError(
      422,
      "Kontroller innhold, vedlegg og valgte kurs før du prøver igjen.",
    );
  }
  throw new CmsError(
    503,
    "CMS-lagringen er ikke tilgjengelig. Prøv igjen om et øyeblikk.",
  );
}

export function cmsErrorResponse(error: unknown): Response {
  if (error instanceof CmsError) {
    return Response.json({ error: error.message }, { status: error.status });
  }
  if (error instanceof ZodError || error instanceof SyntaxError) {
    return Response.json(
      { error: "Kontroller feltene. Innholdet kunne ikke valideres." },
      { status: 400 },
    );
  }
  return Response.json(
    { error: "CMS-et kunne ikke fullføre handlingen. Prøv igjen." },
    { status: 500 },
  );
}
