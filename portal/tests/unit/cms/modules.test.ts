import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { createElement } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { buildOfflineHtml, documentToSlides } from "@/features/cms/export-html";
import { ModuleFrame } from "@/features/cms/ModuleFrame";
import {
  buildModuleSrcDoc,
  MODULE_CSP,
  MODULE_SANDBOX,
} from "@/features/cms/module-frame";
import { CMS_DESIGN_VERSION, CodeModule } from "@/features/cms/module-schema";
import { Presentation } from "@/features/cms/Presentation";
import { runSelfCheck } from "@/features/cms/self-check";
import {
  CMS_TEMPLATES,
  createTemplateDocument,
} from "@/features/cms/templates";
import { ContentDocument } from "@/features/content/document-schema";
import { ContentRenderer } from "@/features/learning/ContentRenderer";

afterEach(cleanup);

function moduleFixture(overrides: Partial<CodeModule> = {}): CodeModule {
  return {
    type: "code_module",
    id: "test-module",
    title: "Trenersamtalen",
    html: '<h2 data-cms-field="title"></h2><p>{{intro}}</p>',
    css: "h2 { color:var(--nivaa-primary); }",
    javascript: "",
    designSystem: "niva",
    designVersion: CMS_DESIGN_VERSION,
    fields: [
      { name: "title", label: "Tittel", type: "text", value: "Observer først" },
      {
        name: "intro",
        label: "Innledning",
        type: "textarea",
        value: "Gi spilleren tid.",
      },
    ],
    ...overrides,
  };
}

function documentFixture(module = moduleFixture()): ContentDocument {
  return {
    locale: "nb-NO",
    format: "short_page",
    blocks: [{ type: "heading", level: 2, text: "Trenersamtalen" }, module],
  };
}

// Runs only test fixtures in a detached DOM to exercise the emitted bootstrap.
// Isolation is separately asserted on the real frame and CSP attributes.
function bootstrapFixture(module: CodeModule) {
  const parsed = new DOMParser().parseFromString(
    buildModuleSrcDoc(module),
    "text/html",
  );
  const frameWindow: {
    cmsFields?: Record<string, string>;
    addEventListener: ReturnType<typeof vi.fn>;
  } = { addEventListener: vi.fn() };
  const script = parsed.querySelector("script")?.textContent ?? "";
  const bootstrap = new Function(
    "document",
    "window",
    "parent",
    "NodeFilter",
    "Element",
    "ResizeObserver",
    script,
  );
  bootstrap(
    parsed,
    frameWindow,
    { postMessage: vi.fn() },
    NodeFilter,
    Element,
    undefined,
  );
  return { parsed, frameWindow };
}

describe("CMS documents and templates", () => {
  it("preserves the legacy document shape and validates module metadata", () => {
    const legacy = {
      locale: "nb-NO",
      format: "short_page",
      blocks: [{ type: "paragraph", text: "Fagstoff" }],
    };
    expect(ContentDocument.parse(legacy)).toEqual(legacy);
    const document = ContentDocument.parse({
      ...documentFixture(),
      attachmentIds: ["a2300000-0000-0000-0000-000000000001"],
      sources: [{ title: "Trenerens fagbok" }],
      speakerNotes: ["Ta imot to innspill."],
      designSystem: "niva",
    });
    expect(document.blocks[1]).toMatchObject({
      type: "code_module",
      designVersion: CMS_DESIGN_VERSION,
    });
    expect(document.speakerNotes).toEqual(["Ta imot to innspill."]);
    expect(
      ContentDocument.safeParse({ ...document, attachmentIds: ["invalid"] })
        .success,
    ).toBe(false);
    expect(
      CodeModule.safeParse({
        ...moduleFixture(),
        fields: [moduleFixture().fields[0], moduleFixture().fields[0]],
      }).success,
    ).toBe(false);
    expect(
      CodeModule.safeParse({ ...moduleFixture(), designSystem: "untrusted" })
        .success,
    ).toBe(false);
  });

  it("provides three usable templates and makes independent copies", () => {
    expect(CMS_TEMPLATES).toHaveLength(3);
    for (const template of CMS_TEMPLATES) {
      expect(ContentDocument.safeParse(template.document).success).toBe(true);
      expect(
        runSelfCheck(template.document).filter(
          (issue) => issue.severity === "error",
        ),
      ).toEqual([]);
    }
    const first = createTemplateDocument("interactive", "Min modul");
    const second = createTemplateDocument("interactive", "Neste modul");
    const codeModule = first.blocks.find(
      (block) => block.type === "code_module",
    )!;
    codeModule.fields[0].value = "Endret";
    expect(
      second.blocks.find((block) => block.type === "code_module")?.fields[0]
        .value,
    ).not.toBe("Endret");
    expect(first.blocks[0]).toMatchObject({ text: "Min modul" });
    expect(() => createTemplateDocument("missing", "Tittel")).toThrow(
      "innholdsmalen",
    );
  });
});

describe("module isolation and editable fields", () => {
  it("renders student modules in an opaque frame with no network or parent permissions", () => {
    render(createElement(ContentRenderer, { document: documentFixture() }));
    const frame = screen.getByTitle("Trenersamtalen");
    expect(frame).toHaveAttribute("sandbox", "allow-scripts");
    expect(frame).toHaveAttribute("referrerpolicy", "no-referrer");
    expect(MODULE_SANDBOX).not.toMatch(
      /same-origin|forms|popups|top-navigation/,
    );
    expect(MODULE_CSP).toContain("default-src 'none'");
    expect(MODULE_CSP).toContain("connect-src 'none'");
    expect(MODULE_CSP).toContain("form-action 'none'");
    expect(MODULE_CSP).toContain("frame-src 'none'");
    expect(frame.getAttribute("srcdoc")).toContain("Content-Security-Policy");
  });

  it("cannot break out of a script, title, or srcdoc attribute", () => {
    const attack = '</script><script data-escape="true">alert(1)</script>';
    const codeModule = moduleFixture({
      title: '</title><img src="x">',
      html: attack,
      css: "</style><script>oops</script>",
      javascript: `const text = ${JSON.stringify(attack)};`,
      fields: [{ name: "title", label: "Tittel", type: "text", value: attack }],
    });
    const parsed = new DOMParser().parseFromString(
      buildModuleSrcDoc(codeModule),
      "text/html",
    );
    expect(parsed.querySelectorAll("script")).toHaveLength(1);
    expect(parsed.querySelector("[data-escape]")).toBeNull();
    expect(parsed.querySelector("img")).toBeNull();
    expect(parsed.title).toBe(codeModule.title);
    expect(
      () => new Function(parsed.querySelector("script")!.textContent!),
    ).not.toThrow();
    render(createElement(ModuleFrame, { module: codeModule }));
    expect(document.querySelectorAll("iframe")).toHaveLength(1);
    expect(document.querySelector("[data-escape]")).toBeNull();
  });

  it("inserts field values as text and removes active HTML and navigation", () => {
    const unsafeValue = '<img src="https://example.com" onerror="alert(1)">';
    const { parsed, frameWindow } = bootstrapFixture(
      moduleFixture({
        html: '<h2 data-cms-field="title"></h2><p>{{ intro }}</p><a href="https://example.com">Lenke</a><form><input></form><meta http-equiv="refresh" content="0;url=https://example.com"><iframe src="https://example.com"></iframe><script>alert(1)</script>',
        fields: [
          { name: "title", label: "Tittel", type: "text", value: unsafeValue },
          {
            name: "intro",
            label: "Tekst",
            type: "textarea",
            value: "Trygg tekst",
          },
        ],
      }),
    );
    expect(parsed.querySelector("h2")?.textContent).toBe(unsafeValue);
    expect(parsed.querySelector("p")?.textContent).toBe("Trygg tekst");
    expect(
      parsed.querySelector("img,form,iframe,[http-equiv='refresh']"),
    ).toBeNull();
    expect(parsed.querySelector("a")?.hasAttribute("href")).toBe(false);
    expect(frameWindow.cmsFields?.title).toBe(unsafeValue);
    expect(Object.isFrozen(frameWindow.cmsFields)).toBe(true);
    expect(Object.getPrototypeOf(frameWindow.cmsFields)).toBeNull();
  });

  it("the four-step template responds to next and previous with editable text", () => {
    const codeModule = createTemplateDocument(
      "interactive",
      "Test",
    ).blocks.find((block) => block.type === "code_module")!;
    const { parsed, frameWindow } = bootstrapFixture(codeModule);
    new Function("document", "window", codeModule.javascript)(
      parsed,
      frameWindow,
    );
    const next = parsed.getElementById("step-next") as HTMLButtonElement;
    const previous = parsed.getElementById("step-prev") as HTMLButtonElement;
    expect(previous.disabled).toBe(true);
    next.click();
    expect(parsed.getElementById("step-title")?.textContent).toBe("Spør");
    next.click();
    next.click();
    expect(parsed.getElementById("step-counter")?.textContent).toBe(
      "Steg 4 av 4",
    );
    expect(next.disabled).toBe(true);
    previous.click();
    expect(parsed.getElementById("step-title")?.textContent).toBe("Velg");
  });
});

describe("editorial self-check and teaching exports", () => {
  it("flags actionable title, link, source and module field issues", () => {
    const codeModule = moduleFixture({
      html: '<p data-cms-field="missing"></p>',
      fields: [
        { name: "count", label: "Antall", type: "number", value: "mange" },
      ],
    });
    const issues = runSelfCheck({
      locale: "nb-NO",
      format: "short_page",
      blocks: [
        codeModule,
        { type: "external_link", label: "Lenke", url: "javascript:alert(1)" },
      ],
    });
    expect(issues.map((issue) => issue.id)).toEqual(
      expect.arrayContaining([
        "title-missing",
        "sources-missing",
        "block-0-missing-missing",
        "block-0-number-count",
        "block-1-url",
      ]),
    );
    expect(issues.find((issue) => issue.id === "block-1-url")?.severity).toBe(
      "error",
    );
  });

  it("keeps heading-based slides and speaker notes in both presentation and export", () => {
    const document = createTemplateDocument("undervisning", "Min undervisning");
    const slides = documentToSlides(document);
    expect(slides).toHaveLength(5);
    expect(slides[1].notes).toContain("4 minutter");
    render(
      createElement(Presentation, { document, title: "Min undervisning" }),
    );
    expect(screen.getByRole("button", { name: "Forrige" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Neste" }));
    expect(
      screen.getByRole("heading", { name: "Start med en observasjon" }),
    ).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Vis lærernotater" }));
    expect(screen.getByText(/4 minutter\. Samle to eksempler/)).toBeVisible();
    fireEvent.keyDown(window, { key: "End" });
    expect(screen.getByRole("button", { name: "Neste" })).toBeDisabled();
    fireEvent.keyDown(window, { key: "ArrowLeft" });
    expect(screen.getByRole("heading", { name: "Prøv i par" })).toBeVisible();
  });

  it("exports an escaped standalone deck with isolated modules and network labels", () => {
    const document = documentFixture(
      moduleFixture({
        javascript: 'const escaped = "</script><script>breakout</script>";',
      }),
    );
    document.blocks.push({
      type: "video",
      provider: "youtube",
      url: "https://www.youtube.com/watch?v=123",
      required: false,
    });
    document.sources = [
      { title: "Faglig kilde", url: "https://example.com/source" },
    ];
    const html = buildOfflineHtml(document, '<img src="x" onerror="alert(1)">');
    const parsed = new DOMParser().parseFromString(html, "text/html");
    expect(parsed.querySelectorAll("[data-slide]")).toHaveLength(2);
    expect(parsed.querySelectorAll("script")).toHaveLength(1);
    expect(parsed.querySelector("script[src],link[href],img")).toBeNull();
    expect(parsed.querySelector("iframe")?.getAttribute("sandbox")).toBe(
      "allow-scripts",
    );
    expect(parsed.querySelector("iframe")?.getAttribute("srcdoc")).toContain(
      "connect-src &#39;none&#39;",
    );
    expect(parsed.body.textContent).toContain("krever internett");
    expect(parsed.querySelector("a")?.href).toBe(
      "https://www.youtube.com/watch?v=123",
    );
    expect(
      () => new Function(parsed.querySelector("script")!.textContent!),
    ).not.toThrow();
  });
});
