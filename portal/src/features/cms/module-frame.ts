import {
  CMS_DESIGN_VERSION,
  type CodeModule,
  type DesignSystem,
} from "./module-schema";

export const MODULE_SANDBOX = "allow-scripts";

export const MODULE_CSP = [
  "default-src 'none'",
  "script-src 'unsafe-inline'",
  "style-src 'unsafe-inline'",
  "img-src data:",
  "media-src data:",
  "font-src 'none'",
  "connect-src 'none'",
  "frame-src 'none'",
  "child-src 'none'",
  "worker-src 'none'",
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'none'",
  "navigate-to 'none'",
].join("; ");

// Immutable snapshot of the portal's Nivaa tokens. Add a new version when the
// design changes: existing modules and exported lessons keep their appearance.
const NIVAA_2026_09_16 = `:root {
  color-scheme: light;
  --nivaa-canvas: #f7f9f8;
  --nivaa-surface: #ffffff;
  --nivaa-surface-subtle: #f1f4f2;
  --nivaa-on-surface: #10221b;
  --nivaa-text-muted: #5f6b65;
  --nivaa-primary: #39724e;
  --nivaa-on-primary: #ffffff;
  --nivaa-primary-hover: #2f6242;
  --nivaa-primary-active: #285438;
  --nivaa-primary-soft: #e6ece8;
  --nivaa-on-primary-soft: #214c34;
  --nivaa-border: #e1e7e3;
  --nivaa-border-strong: #c6d0ca;
  --nivaa-focus: #315bce;
  --nivaa-disabled: #e8ece9;
  --nivaa-on-disabled: #7a847f;
  --nivaa-success: #2f6b49;
  --nivaa-success-soft: #e5f1e9;
  --nivaa-warning: #8a5a13;
  --nivaa-warning-soft: #f8efd9;
  --nivaa-error: #a43e35;
  --nivaa-error-soft: #f7e8e5;
  --nivaa-info: #2f6973;
  --nivaa-info-soft: #e3eff1;
  --nivaa-ai: #405cf5;
  --nivaa-on-ai: #ffffff;
  --nivaa-ai-soft: #e9ecff;
  --nivaa-on-ai-soft: #2f43bd;
  --nivaa-font-ui: "Avenir Next", "Segoe UI", Helvetica, Arial, sans-serif;
  --nivaa-font-size-display: 3rem;
  --nivaa-font-size-h1: 2.25rem;
  --nivaa-font-size-h2: 1.75rem;
  --nivaa-font-size-h3: 1.125rem;
  --nivaa-font-size-body-lg: 1.125rem;
  --nivaa-font-size-body: 1rem;
  --nivaa-font-size-body-sm: .875rem;
  --nivaa-font-size-label: .8125rem;
  --nivaa-font-size-caption: .75rem;
  --nivaa-space-micro: .25rem;
  --nivaa-space-tight: .5rem;
  --nivaa-space-compact: .75rem;
  --nivaa-space-default: 1rem;
  --nivaa-space-comfortable: 1.5rem;
  --nivaa-space-spacious: 2rem;
  --nivaa-space-section: 3rem;
  --nivaa-space-page: 4rem;
  --nivaa-space-hero: 6rem;
  --nivaa-radius-control: .5rem;
  --nivaa-radius-field: .625rem;
  --nivaa-radius-inner: .75rem;
  --nivaa-radius-surface: 1rem;
  --nivaa-radius-pill: 999px;
  --nivaa-shadow-card: 0 8px 24px rgba(16,34,27,.05);
  --nivaa-shadow-menu: 0 16px 40px rgba(16,34,27,.08);
  --nivaa-content-max: 80rem;
  --nivaa-sidebar-width: 15rem;
  --nivaa-transition-fast: 140ms cubic-bezier(.2,.8,.2,1);
}`;

export const DESIGN_TOKEN_SNAPSHOTS: Readonly<
  Record<DesignSystem, Readonly<Record<string, string>>>
> = {
  niva: { [CMS_DESIGN_VERSION]: NIVAA_2026_09_16 },
  nivaband: {
    [CMS_DESIGN_VERSION]: `${NIVAA_2026_09_16}
      :root { --nivaa-level-1:#e6ece8; --nivaa-level-2:#b9d0bd;
        --nivaa-level-3:#39724e; --nivaa-level-4:#214c34; }`,
  },
};

export function getDesignTokens(
  designSystem: DesignSystem = "niva",
  version = CMS_DESIGN_VERSION,
): string {
  return (
    DESIGN_TOKEN_SNAPSHOTS[designSystem][version] ??
    DESIGN_TOKEN_SNAPSHOTS[designSystem][CMS_DESIGN_VERSION]
  );
}

export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => {
    const entities: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    };
    return entities[character];
  });
}

export function safeWebUrl(value: string): string | null {
  try {
    const url = new URL(value);
    return ["https:", "http:"].includes(url.protocol) ? url.href : null;
  } catch {
    return null;
  }
}

function scriptJson(value: unknown): string {
  // Nothing from a module may terminate the trusted bootstrap script, including
  // fields, HTML, CSS, JavaScript strings, and the title.
  return JSON.stringify(value)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
}

const FRAME_BASE_CSS = `
  * { box-sizing:border-box; }
  html { color:var(--nivaa-on-surface); background:var(--nivaa-surface); }
  body { margin:0; padding:clamp(16px,4vw,32px); font:16px/1.6 var(--nivaa-font-ui); overflow-wrap:anywhere; }
  h1,h2,h3,p { margin-top:0; }
  h1,h2,h3 { line-height:1.2; text-wrap:balance; }
  button,input,select,textarea { font:inherit; max-width:100%; }
  button { min-height:44px; padding:10px 18px; border:1px solid var(--nivaa-border-strong); border-radius:var(--nivaa-radius-control); color:var(--nivaa-on-primary); background:var(--nivaa-primary); cursor:pointer; }
  button:disabled { color:var(--nivaa-on-disabled); background:var(--nivaa-disabled); cursor:default; }
  :focus-visible { outline:3px solid var(--nivaa-focus); outline-offset:3px; }
  img,svg,video { max-width:100%; }
  [data-cms-field] { white-space:pre-wrap; }
  [hidden] { display:none !important; }
  @media(prefers-reduced-motion:reduce) { *,*::before,*::after { animation-duration:.01ms !important; transition-duration:.01ms !important; scroll-behavior:auto !important; } }
`;

/** Produces inert source text. Only the browser executes it inside the sandbox. */
export function buildModuleSrcDoc(module: CodeModule): string {
  const payload = scriptJson({
    id: module.id,
    html: module.html,
    css: `${getDesignTokens(module.designSystem, module.designVersion)}\n${FRAME_BASE_CSS}\n${module.css}`,
    javascript: module.javascript,
    fields: module.fields.map(({ name, value }) => [name, value]),
  });

  return String.raw`<!doctype html><html lang="nb"><head><meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="${escapeHtml(MODULE_CSP)}">
<meta name="referrer" content="no-referrer">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(module.title)}</title></head><body>
<main id="cms-module"></main><script>
(() => {
  "use strict";
  const payload = ${payload};
  const fields = Object.create(null);
  for (const [name, value] of payload.fields) fields[name] = value;
  Object.defineProperty(window, 'cmsFields', { value: Object.freeze(fields), writable: false, configurable: false });
  const style = document.createElement('style');
  style.textContent = payload.css;
  document.head.appendChild(style);
  const template = document.createElement('template');
  template.innerHTML = payload.html;
  // The opaque-origin iframe and CSP are the security boundary. This cleanup
  // also prevents accidental navigation and keeps code in its JavaScript field.
  template.content.querySelectorAll('script,iframe,frame,frameset,object,embed,link,meta,base,form').forEach(node => node.remove());
  for (const node of template.content.querySelectorAll('*')) {
    for (const attribute of [...node.attributes]) {
      const name = attribute.name.toLowerCase();
      if (name.startsWith('on') || ['href','xlink:href','action','formaction','target','srcdoc','srcset','ping','download','autofocus'].includes(name)) node.removeAttribute(attribute.name);
      if (['src','poster','data'].includes(name) && !/^data:(image|audio|video)\//i.test(attribute.value)) node.removeAttribute(attribute.name);
    }
  }
  const walker = document.createTreeWalker(template.content, NodeFilter.SHOW_TEXT);
  while (walker.nextNode()) {
    const node = walker.currentNode;
    if (node.parentElement && ['STYLE','SCRIPT'].includes(node.parentElement.tagName)) continue;
    node.textContent = node.textContent.replace(/\{\{\s*([a-zA-Z][a-zA-Z0-9_-]*)\s*\}\}/g, (match, name) => Object.hasOwn(fields, name) ? fields[name] : match);
  }
  for (const node of template.content.querySelectorAll('[data-cms-field]')) {
    const name = node.getAttribute('data-cms-field');
    if (!Object.hasOwn(fields, name)) continue;
    if (['INPUT','TEXTAREA','SELECT'].includes(node.tagName)) node.value = fields[name];
    else node.textContent = fields[name];
  }
  document.getElementById('cms-module').appendChild(template.content);
  document.addEventListener('click', event => {
    if (event.target instanceof Element && event.target.closest('a,area')) event.preventDefault();
  }, true);
  document.addEventListener('submit', event => event.preventDefault(), true);
  if (window.navigation) window.navigation.addEventListener('navigate', event => event.preventDefault());
  const reportHeight = () => parent.postMessage({ type:'nivaa-module-height', id:payload.id, height:document.body.scrollHeight }, '*');
  window.addEventListener('message', event => {
    if (event.source === parent && event.data?.type === 'nivaa-request-height' && event.data.id === payload.id) reportHeight();
  });
  if (typeof ResizeObserver !== 'undefined') new ResizeObserver(reportHeight).observe(document.body);
  window.addEventListener('load', reportHeight);
  if (payload.javascript.trim()) {
    const script = document.createElement('script');
    script.textContent = payload.javascript;
    document.body.appendChild(script);
  }
  reportHeight();
})();
</script></body></html>`;
}
