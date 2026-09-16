import type { ContentDocument } from "@/features/content/document-schema";

import { DESIGN_TOKEN_SNAPSHOTS, safeWebUrl } from "./module-frame";

export type SelfCheckIssue = {
  id: string;
  severity: "error" | "warning" | "info";
  message: string;
};

/** A short editorial check; it never executes a module or calls external URLs. */
export function runSelfCheck(document: ContentDocument): SelfCheckIssue[] {
  const issues: SelfCheckIssue[] = [];
  const add = (
    id: string,
    severity: SelfCheckIssue["severity"],
    message: string,
  ) => issues.push({ id, severity, message });
  const heading = document.blocks.find((block) => block.type === "heading");
  if (!heading || !heading.text.trim()) {
    add("title-missing", "error", "Innholdet mangler en overskrift.");
  }
  if (!document.sources?.length) {
    add(
      "sources-missing",
      "warning",
      "Legg til kilder for faglige påstander, eller vurder om teksten trenger kildehenvisning.",
    );
  }

  function checkUrl(url: string, id: string, label: string) {
    const safe = safeWebUrl(url);
    if (!safe)
      add(
        id,
        "error",
        `${label} må bruke en gyldig http- eller https-adresse.`,
      );
    else if (safe.startsWith("http:"))
      add(
        id,
        "warning",
        `${label} bruker http. Bruk https hvis det er tilgjengelig.`,
      );
  }

  for (const [index, source] of (document.sources ?? []).entries()) {
    if (!source.title.trim())
      add(
        `source-${index}-title`,
        "error",
        "En kilde mangler navn eller tittel.",
      );
    if (source.url)
      checkUrl(source.url, `source-${index}-url`, `Kilden «${source.title}»`);
  }

  const moduleIds = new Set<string>();
  document.blocks.forEach((block, index) => {
    const prefix = `block-${index}`;
    if (block.type === "heading" && !block.text.trim())
      add(`${prefix}-title`, "error", "En overskrift er tom.");
    if (block.type === "external_link") {
      checkUrl(block.url, `${prefix}-url`, `Lenken «${block.label}»`);
      if (!block.label.trim())
        add(`${prefix}-label`, "warning", "Gi lenken en beskrivende tekst.");
    }
    if (block.type === "video" && block.url)
      checkUrl(block.url, `${prefix}-video`, "Videolenken");
    if (block.type !== "code_module") return;

    if (moduleIds.has(block.id))
      add(
        `${prefix}-id`,
        "error",
        `Modul-ID-en «${block.id}» brukes flere ganger.`,
      );
    moduleIds.add(block.id);
    if (!block.title.trim())
      add(`${prefix}-title`, "error", "En modul mangler tittel.");
    if (!block.html.trim())
      add(
        `${prefix}-html`,
        "warning",
        `Modulen «${block.title}» har ikke HTML-innhold.`,
      );
    if (
      !Object.hasOwn(
        DESIGN_TOKEN_SNAPSHOTS[block.designSystem],
        block.designVersion,
      )
    ) {
      add(
        `${prefix}-design`,
        "warning",
        `Designversjonen «${block.designVersion}» er ukjent. Modulen bruker gjeldende Nivaa-farger.`,
      );
    }

    const references = new Set([
      ...Array.from(
        block.html.matchAll(/data-cms-field\s*=\s*["']([^"']+)["']/g),
        (match) => match[1],
      ),
      ...Array.from(
        block.html.matchAll(/\{\{\s*([a-zA-Z][a-zA-Z0-9_-]*)\s*\}\}/g),
        (match) => match[1],
      ),
    ]);
    const fields = new Set<string>();
    for (const field of block.fields) {
      if (fields.has(field.name))
        add(
          `${prefix}-duplicate-${field.name}`,
          "error",
          `Feltnavnet «${field.name}» brukes flere ganger i «${block.title}».`,
        );
      fields.add(field.name);
      if (!field.value.trim())
        add(
          `${prefix}-empty-${field.name}`,
          "warning",
          `Fyll inn «${field.label}» i «${block.title}».`,
        );
      else if (field.type === "number" && !Number.isFinite(Number(field.value)))
        add(
          `${prefix}-number-${field.name}`,
          "error",
          `«${field.label}» må inneholde et tall.`,
        );
      if (!references.has(field.name) && !block.javascript.trim())
        add(
          `${prefix}-unused-${field.name}`,
          "info",
          `Feltet «${field.label}» er ikke koblet til modulens HTML.`,
        );
    }
    for (const reference of references) {
      if (!fields.has(reference))
        add(
          `${prefix}-missing-${reference}`,
          "error",
          `Modulen «${block.title}» viser til feltet «${reference}», men feltet finnes ikke.`,
        );
    }
  });

  return issues;
}
