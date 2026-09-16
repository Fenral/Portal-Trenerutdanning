import type {
  ContentBlock,
  ContentDocument,
} from "@/features/content/document-schema";

import {
  buildModuleSrcDoc,
  escapeHtml,
  getDesignTokens,
  MODULE_SANDBOX,
  safeWebUrl,
} from "./module-frame";

export type ContentSlide = {
  document: ContentDocument;
  notes: string;
};

/** Level-two headings start a slide; smaller headings stay with their content. */
export function documentToSlides(document: ContentDocument): ContentSlide[] {
  const groups: ContentBlock[][] = [];
  let current: ContentBlock[] = [];
  for (const block of document.blocks) {
    if (block.type === "heading" && block.level === 2 && current.length) {
      groups.push(current);
      current = [];
    }
    current.push(block);
  }
  if (current.length) groups.push(current);

  const slides = groups.map((blocks, index) => ({
    document: {
      locale: document.locale,
      format: document.format,
      designSystem: document.designSystem,
      blocks,
    },
    notes: [
      document.speakerNotes?.[index],
      ...blocks.flatMap((block) =>
        block.type === "code_module" && block.notes ? [block.notes] : [],
      ),
    ]
      .filter(Boolean)
      .join("\n\n"),
  }));

  if (document.sources?.length || document.attachmentIds?.length) {
    slides.push({
      document: {
        locale: document.locale,
        format: "short_page",
        designSystem: document.designSystem,
        blocks: [
          { type: "heading", level: 2, text: "Kilder og vedlegg" },
          ...(document.sources ?? []).map((source): ContentBlock =>
            source.url
              ? { type: "external_link", url: source.url, label: source.title }
              : { type: "paragraph", text: source.title },
          ),
          ...(document.attachmentIds ?? []).map(
            (assetId, index): ContentBlock => ({
              type: "file",
              assetId,
              label: `Vedlegg ${index + 1}`,
            }),
          ),
        ],
      },
      notes: "Kildelenker krever internett. Vedlegg åpnes fra portalen.",
    });
  }
  return slides;
}

function externalLink(url: string, label: string): string {
  const safe = safeWebUrl(url);
  return safe
    ? `<a href="${escapeHtml(safe)}" target="_blank" rel="noopener noreferrer">${escapeHtml(label)}</a>`
    : `<span>${escapeHtml(label)} (ugyldig lenke)</span>`;
}

function blockHtml(block: ContentBlock): string {
  switch (block.type) {
    case "heading":
      return `<h${block.level}>${escapeHtml(block.text)}</h${block.level}>`;
    case "paragraph":
      return `<p>${escapeHtml(block.text)}</p>`;
    case "callout":
      return `<aside class="callout" data-tone="${block.tone}"><strong>${escapeHtml(block.title)}</strong><p>${escapeHtml(block.text)}</p></aside>`;
    case "external_link":
      return `<p class="resource">${externalLink(block.url, block.label)} <small>Krever internett</small></p>`;
    case "file":
      return `<aside class="resource"><strong>${escapeHtml(block.label)}</strong><p>Vedlegget er tilgjengelig i portalen og følger ikke med HTML-filen.</p></aside>`;
    case "image":
      return `<figure class="resource"><p>Bilde: ${escapeHtml(block.alt)}</p>${block.caption ? `<figcaption>${escapeHtml(block.caption)}</figcaption>` : ""}<small>Bildet ligger i portalen og følger ikke med HTML-filen.</small></figure>`;
    case "video":
      return `<aside class="resource"><strong>Fagvideo · krever internett</strong><p>${block.required ? "Obligatorisk video." : "Anbefalt fordypning."} ${block.url ? externalLink(block.url, "Åpne video") : "Åpne den opplastede videoen i portalen."}</p></aside>`;
    case "interactive_sequence":
      return `<section class="sequence"><ol>${block.steps.map((step) => `<li><h3>${escapeHtml(step.title)}</h3><p>${escapeHtml(step.text)}</p>${step.assetId ? "<small>Illustrasjonen er tilgjengelig i portalen.</small>" : ""}</li>`).join("")}</ol></section>`;
    case "code_module":
      return `<iframe class="module" title="${escapeHtml(block.title)}" sandbox="${MODULE_SANDBOX}" referrerpolicy="no-referrer" allow="camera 'none'; microphone 'none'; geolocation 'none'; fullscreen 'none'" data-module-id="${escapeHtml(block.id)}" srcdoc="${escapeHtml(buildModuleSrcDoc(block))}"></iframe>`;
  }
}

const DECK_CSS = `
*{box-sizing:border-box}html{background:var(--nivaa-canvas);color:var(--nivaa-on-surface)}
body{margin:0;font:18px/1.6 var(--nivaa-font-ui)}button{font:inherit;min-height:44px;padding:10px 18px;border:1px solid var(--nivaa-border-strong);border-radius:var(--nivaa-radius-control);background:white;color:var(--nivaa-on-surface);cursor:pointer}
button:disabled{opacity:.45;cursor:default}button.primary{color:var(--nivaa-on-primary);background:var(--nivaa-primary);border-color:var(--nivaa-primary)}
:focus-visible{outline:3px solid var(--nivaa-focus);outline-offset:3px}[hidden]{display:none!important}
.deck{min-height:100svh;display:grid;grid-template-rows:auto 1fr auto}.toolbar,.controls{display:flex;align-items:center;justify-content:space-between;gap:16px;padding:16px clamp(16px,4vw,64px);flex-wrap:wrap}
.toolbar{border-bottom:1px solid var(--nivaa-border)}.toolbar h1{font-size:1rem;margin:0;max-width:60ch}.tools,.paging{display:flex;align-items:center;gap:12px;flex-wrap:wrap}
main{width:min(100%,1100px);margin:auto;padding:clamp(24px,5vw,72px) clamp(16px,5vw,64px)}
.slide{display:grid;gap:24px;overflow-wrap:anywhere}.slide h2{font-size:clamp(2rem,5vw,3.4rem);letter-spacing:-.035em;line-height:1.15;text-wrap:balance;margin:0}.slide h3{font-size:1.4rem;line-height:1.3;margin:0}
.slide p{margin:0;white-space:pre-wrap}.slide>p{font-size:clamp(1.1rem,2.5vw,1.5rem);line-height:1.65}
.callout,.resource{padding:24px;background:var(--nivaa-surface-subtle);border-radius:var(--nivaa-radius-inner);margin:0}.callout{border-left:4px solid var(--nivaa-info);background:var(--nivaa-info-soft)}
.callout[data-tone="practice"]{border-color:var(--nivaa-success);background:var(--nivaa-success-soft)}.callout[data-tone="warning"]{border-color:var(--nivaa-warning);background:var(--nivaa-warning-soft)}
.callout p,.resource p{margin-top:8px}a{color:var(--nivaa-primary);text-underline-offset:4px}.resource small{display:block;color:var(--nivaa-text-muted);margin-top:8px}
.sequence ol{display:grid;gap:24px;padding-left:24px}.module{width:100%;height:540px;border:1px solid var(--nivaa-border);border-radius:var(--nivaa-radius-inner);background:white}
.notes{margin-top:32px;padding:20px;background:var(--nivaa-warning-soft);border-radius:var(--nivaa-radius-inner);font-size:1rem;white-space:pre-wrap}.notes h2{font-size:1rem;margin:0 0 8px}.notes p{margin:0}
.controls{border-top:1px solid var(--nivaa-border);background:var(--nivaa-surface)}.status{font-size:.9rem;color:var(--nivaa-text-muted)}progress{width:120px;height:8px;accent-color:var(--nivaa-primary)}
@media(max-width:520px){body{font-size:16px}.toolbar,.controls{padding:12px 16px}.tools{width:100%}.module{height:620px}.controls{gap:12px}.paging{width:100%;justify-content:space-between}}
@media print{.toolbar,.controls,.notes{display:none!important}.slide[hidden],.slide{display:grid!important;break-after:page}.deck{display:block}main{padding:0}.module{height:650px}}
@media(prefers-reduced-motion:reduce){*{scroll-behavior:auto!important}}
`;

const DECK_SCRIPT = String.raw`
(() => {
  const slides = [...document.querySelectorAll('[data-slide]')];
  const previous = document.getElementById('previous');
  const next = document.getElementById('next');
  const counter = document.getElementById('counter');
  const progress = document.getElementById('progress');
  const noteToggle = document.getElementById('note-toggle');
  const fullscreen = document.getElementById('fullscreen');
  let current = 0;
  let notes = false;
  function show(index) {
    current = Math.max(0, Math.min(slides.length - 1, index));
    slides.forEach((slide, i) => {
      slide.hidden = i !== current;
      slide.querySelector('.notes').hidden = !notes;
    });
    previous.disabled = current === 0;
    next.disabled = current === slides.length - 1;
    counter.textContent = 'Lysbilde ' + (current + 1) + ' av ' + slides.length;
    progress.value = current + 1;
  }
  previous.addEventListener('click', () => show(current - 1));
  next.addEventListener('click', () => show(current + 1));
  noteToggle.addEventListener('click', () => {
    notes = !notes;
    noteToggle.setAttribute('aria-expanded', String(notes));
    noteToggle.textContent = notes ? 'Skjul lærernotater' : 'Vis lærernotater';
    show(current);
  });
  fullscreen.addEventListener('click', async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else if (document.documentElement.requestFullscreen) await document.documentElement.requestFullscreen();
      else document.getElementById('status').textContent = 'Nettleseren støtter ikke fullskjerm her.';
    } catch { document.getElementById('status').textContent = 'Fullskjerm kunne ikke åpnes i denne nettleseren.'; }
  });
  document.addEventListener('fullscreenchange', () => { fullscreen.textContent = document.fullscreenElement ? 'Avslutt fullskjerm' : 'Fullskjerm'; });
  document.addEventListener('keydown', event => {
    if (event.altKey || event.ctrlKey || event.metaKey || event.target.closest('input,textarea,select,[contenteditable="true"]')) return;
    if (event.key === 'ArrowRight' || event.key === 'PageDown') { event.preventDefault(); show(current + 1); }
    if (event.key === 'ArrowLeft' || event.key === 'PageUp') { event.preventDefault(); show(current - 1); }
    if (event.key === 'Home') { event.preventDefault(); show(0); }
    if (event.key === 'End') { event.preventDefault(); show(slides.length - 1); }
  });
  window.addEventListener('message', event => {
    if (event.origin !== 'null' || event.data?.type !== 'nivaa-module-height' || typeof event.data.height !== 'number' || !Number.isFinite(event.data.height)) return;
    const frame = [...document.querySelectorAll('iframe.module')].find(frame => frame.contentWindow === event.source && frame.dataset.moduleId === event.data.id);
    if (frame) frame.style.height = Math.max(300, Math.min(1200, event.data.height + 8)) + 'px';
  });
  show(0);
})();`;

/** Text, code, styles and controls are embedded; protected media stays in the portal. */
export function buildOfflineHtml(
  document: ContentDocument,
  title: string,
): string {
  const slides = documentToSlides(document);
  const csp =
    "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data:; frame-src 'self' about:; connect-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'";
  return `<!doctype html><html lang="nb"><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="${escapeHtml(csp)}"><meta name="referrer" content="no-referrer"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(title)}</title><style>${getDesignTokens(document.designSystem)}\n${DECK_CSS}</style></head><body>
<div class="deck"><header class="toolbar"><h1>${escapeHtml(title)}</h1><div class="tools"><button id="note-toggle" type="button" aria-expanded="false">Vis lærernotater</button><button id="fullscreen" type="button">Fullskjerm</button></div></header>
<main>${slides.map((slide, index) => `<section class="slide" data-slide="${index}" aria-label="Lysbilde ${index + 1}"${index ? " hidden" : ""}>${slide.document.blocks.map(blockHtml).join("\n")}<aside class="notes" hidden><h2>Lærernotater</h2><p>${escapeHtml(slide.notes || "Ingen lærernotater for dette lysbildet.")}</p></aside></section>`).join("\n")}</main>
<footer class="controls"><div><span class="status" id="counter" aria-live="polite">Lysbilde 1 av ${slides.length}</span> <progress id="progress" max="${slides.length}" value="1" aria-label="Fremdrift i presentasjonen"></progress><p class="status" id="status" role="status">Bruk piltastene for å bytte lysbilde.</p></div><nav class="paging" aria-label="Bytt lysbilde"><button id="previous" type="button" disabled>Forrige</button><button class="primary" id="next" type="button">Neste</button></nav></footer></div>
<noscript><style>.slide[hidden]{display:grid!important}</style><p>Alle lysbildene vises. Slå på JavaScript for å bruke presentasjonskontrollene.</p></noscript>
<script>${DECK_SCRIPT}</script></body></html>`;
}
