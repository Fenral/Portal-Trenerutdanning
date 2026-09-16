import { ContentDocument } from "@/features/content/document-schema";

import { CMS_DESIGN_VERSION, type CodeModule } from "./module-schema";

const fourSteps: CodeModule = {
  type: "code_module",
  id: "fire-steg",
  title: "Fra observasjon til ny utprøving",
  designSystem: "nivaband",
  designVersion: CMS_DESIGN_VERSION,
  fields: [
    {
      name: "title",
      label: "Overskrift",
      type: "text",
      value: "En god treningssamtale i fire steg",
    },
    {
      name: "intro",
      label: "Innledning",
      type: "textarea",
      value:
        "Bruk neste og forrige for å utforske hvordan en trener kan støtte spillerens egen læring.",
    },
    {
      name: "step1Title",
      label: "Steg 1 · tittel",
      type: "text",
      value: "Observer",
    },
    {
      name: "step1Text",
      label: "Steg 1 · forklaring",
      type: "textarea",
      value:
        "Se et helt forsøk før du gir råd. Hva gjorde spilleren, og hva skjedde med ballen?",
    },
    {
      name: "step2Title",
      label: "Steg 2 · tittel",
      type: "text",
      value: "Spør",
    },
    {
      name: "step2Text",
      label: "Steg 2 · forklaring",
      type: "textarea",
      value:
        "Still ett åpent spørsmål: Hva la du merke til? Gi spilleren tid til å svare.",
    },
    {
      name: "step3Title",
      label: "Steg 3 · tittel",
      type: "text",
      value: "Velg",
    },
    {
      name: "step3Text",
      label: "Steg 3 · forklaring",
      type: "textarea",
      value:
        "Avtal én justering sammen. La spilleren beskrive hva hen vil prøve og hvorfor.",
    },
    {
      name: "step4Title",
      label: "Steg 4 · tittel",
      type: "text",
      value: "Prøv igjen",
    },
    {
      name: "step4Text",
      label: "Steg 4 · forklaring",
      type: "textarea",
      value:
        "Gjennomfør et nytt forsøk. Sammenlign opplevelsen og utfallet, og velg neste steg.",
    },
  ],
  html: `<section aria-labelledby="module-title">
    <p class="eyebrow">Trenerens verktøykasse</p>
    <h2 id="module-title" data-cms-field="title"></h2>
    <p data-cms-field="intro"></p>
    <ol class="bands" aria-label="De fire stegene">
      <li><button type="button" data-step="0">1. <span data-cms-field="step1Title"></span></button></li>
      <li><button type="button" data-step="1">2. <span data-cms-field="step2Title"></span></button></li>
      <li><button type="button" data-step="2">3. <span data-cms-field="step3Title"></span></button></li>
      <li><button type="button" data-step="3">4. <span data-cms-field="step4Title"></span></button></li>
    </ol>
    <div class="step-panel" aria-live="polite" aria-atomic="true">
      <p id="step-counter" class="eyebrow">Steg 1 av 4</p>
      <h3 id="step-title" data-cms-field="step1Title"></h3>
      <p id="step-text" data-cms-field="step1Text"></p>
    </div>
    <nav class="step-controls" aria-label="Bytt steg">
      <button id="step-prev" type="button" disabled>Forrige</button>
      <button id="step-next" type="button">Neste</button>
    </nav>
  </section>`,
  css: `.eyebrow { color:var(--nivaa-primary); font-size:.8rem; font-weight:700; letter-spacing:.04em; }
    .bands { display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); list-style:none; padding:0; gap:8px; margin:24px 0; }
    .bands button { width:100%; padding:12px 8px; color:var(--nivaa-on-surface); background:var(--nivaa-level-1); text-align:left; border-color:transparent; }
    .bands button[aria-current="step"] { background:var(--nivaa-level-4); color:white; }
    .step-panel { min-height:180px; padding:24px; background:var(--nivaa-surface-subtle); border-left:4px solid var(--nivaa-primary); border-radius:var(--nivaa-radius-inner); }
    .step-panel h3 { font-size:1.5rem; }
    .step-panel p:last-child { margin-bottom:0; }
    .step-controls { display:flex; justify-content:space-between; margin-top:20px; gap:16px; }
    @media(max-width:520px) { .bands { grid-template-columns:repeat(2,minmax(0,1fr)); } .step-panel { padding:18px; } }`,
  javascript: `(() => {
    const fields = window.cmsFields;
    const steps = [1, 2, 3, 4].map(n => ({title:fields['step' + n + 'Title'],text:fields['step' + n + 'Text']}));
    let current = 0;
    const previous = document.getElementById('step-prev');
    const next = document.getElementById('step-next');
    const buttons = [...document.querySelectorAll('[data-step]')];
    function show(index) {
      current = Math.max(0, Math.min(steps.length - 1, index));
      document.getElementById('step-counter').textContent = 'Steg ' + (current + 1) + ' av 4';
      document.getElementById('step-title').textContent = steps[current].title;
      document.getElementById('step-text').textContent = steps[current].text;
      previous.disabled = current === 0;
      next.disabled = current === steps.length - 1;
      buttons.forEach((button, index) => {
        if (index === current) button.setAttribute('aria-current', 'step');
        else button.removeAttribute('aria-current');
      });
    }
    previous.addEventListener('click', () => show(current - 1));
    next.addEventListener('click', () => show(current + 1));
    buttons.forEach(button => button.addEventListener('click', () => show(Number(button.dataset.step))));
    show(0);
  })();`,
  notes:
    "La deltakerne arbeide i par: én trener og én spiller. Bruk ett minutt per steg og bytt roller.",
};

export const CMS_TEMPLATES: ReadonlyArray<{
  id: string;
  title: string;
  description: string;
  document: ContentDocument;
}> = [
  {
    id: "pensum",
    title: "Pensumside",
    description:
      "En kort fagtekst med læringsmål, refleksjon og en praksisoppgave.",
    document: {
      locale: "nb-NO",
      format: "short_page",
      designSystem: "niva",
      blocks: [
        {
          type: "heading",
          level: 2,
          text: "Tilbakemeldinger som støtter læring",
        },
        {
          type: "paragraph",
          text: "En god tilbakemelding hjelper spilleren å legge merke til hva som skjedde, velge en justering og prøve på nytt. Start med spillerens egen opplevelse.",
        },
        {
          type: "callout",
          tone: "info",
          title: "Dette skal du kunne",
          text: "Etter å ha lest teksten skal du kunne stille ett åpent spørsmål, gi en konkret observasjon og avtale ett nytt forsøk.",
        },
        { type: "heading", level: 3, text: "Beskriv det du ser" },
        {
          type: "paragraph",
          text: "Skill mellom observasjon og tolkning. «Tre baller startet til høyre» gir spilleren noe konkret å undersøke. Be spilleren beskrive hva hen merket før dere velger neste forsøk.",
        },
        {
          type: "callout",
          tone: "practice",
          title: "Prøv i neste økt",
          text: "Observer tre forsøk uten å avbryte. Still deretter ett åpent spørsmål og avtal én justering. Noter hva spilleren lærte.",
        },
        { type: "heading", level: 3, text: "Reflekter" },
        {
          type: "paragraph",
          text: "Når er det nyttig å gi et konkret råd, og når trenger spilleren mer tid til å finne svaret selv? Ta med ett eksempel til samlingen.",
        },
      ],
      sources: [],
      attachmentIds: [],
      speakerNotes: [],
    },
  },
  {
    id: "interactive",
    title: "Interaktiv modul i fire steg",
    description:
      "En ferdig modul med neste/forrige og tekstfelt som kan redigeres.",
    document: {
      locale: "nb-NO",
      format: "scroll_story",
      designSystem: "nivaband",
      blocks: [
        { type: "heading", level: 2, text: "En god treningssamtale" },
        {
          type: "paragraph",
          text: "Utforsk fire steg du kan bruke i en praktisk treningssituasjon. Velg et steg, eller bruk neste og forrige.",
        },
        fourSteps,
        {
          type: "callout",
          tone: "practice",
          title: "Din tur",
          text: "Velg en situasjon fra egen praksis. Hvilket spørsmål vil du stille i steg to?",
        },
      ],
      sources: [],
      attachmentIds: [],
      speakerNotes: [
        "Vis modulen, og la deltakerne foreslå ett spørsmål til hvert steg.",
      ],
    },
  },
  {
    id: "undervisning",
    title: "Undervisningssett",
    description:
      "Fem lysbilder med lærernotater, samtaleoppgave og oppsummering.",
    document: {
      locale: "nb-NO",
      format: "short_page",
      designSystem: "niva",
      blocks: [
        { type: "heading", level: 2, text: "Spilleren som medskaper" },
        {
          type: "paragraph",
          text: "Hvordan kan treneren gjøre spilleren mer aktiv i egen læring?",
        },
        {
          type: "callout",
          tone: "info",
          title: "Mål for samlingen",
          text: "Prøve en treningssamtale der spilleren selv observerer, velger og vurderer neste forsøk.",
        },
        { type: "heading", level: 2, text: "Start med en observasjon" },
        {
          type: "paragraph",
          text: "Beskriv det dere faktisk så. Inviter spilleren til å si hva hen la merke til.",
        },
        {
          type: "callout",
          tone: "practice",
          title: "Snakk sammen i to minutter",
          text: "Tenk på en nylig treningssituasjon. Hva var observasjon, og hva var din tolkning?",
        },
        { type: "heading", level: 2, text: "Fire steg i praksis" },
        { ...fourSteps, id: "undervisning-fire-steg" },
        { type: "heading", level: 2, text: "Prøv i par" },
        {
          type: "paragraph",
          text: "Én er trener, én er spiller. Bruk en konkret situasjon og gjennomfør de fire stegene. Bytt roller etter fire minutter.",
        },
        {
          type: "callout",
          tone: "practice",
          title: "Legg merke til",
          text: "Hvem snakket mest? Hvem valgte justeringen? Hvordan visste dere at forsøket ga ny læring?",
        },
        { type: "heading", level: 2, text: "Ta med til neste økt" },
        {
          type: "paragraph",
          text: "Skriv ned ett spørsmål du vil bruke, og én situasjon der du vil gi spilleren mer tid. Del planen med en kollega.",
        },
      ],
      attachmentIds: [],
      sources: [],
      speakerNotes: [
        "2 minutter. Be deltakerne tenke på én spiller de følger opp. Presenter målet.",
        "4 minutter. Samle to eksempler. Hjelp gruppen å skille beskrivelse fra vurdering.",
        "5 minutter. Gå gjennom ett steg om gangen. La gruppen foreslå formuleringer.",
        "10 minutter. Fire minutter per rolle, deretter to minutter til felles refleksjon.",
        "3 minutter. La hver deltaker formulere en konkret handling før dere avslutter.",
      ],
    },
  },
];

export function createTemplateDocument(
  templateId: string,
  title: string,
): ContentDocument {
  const template = CMS_TEMPLATES.find(
    (candidate) => candidate.id === templateId,
  );
  if (!template) throw new Error("Fant ikke den valgte innholdsmalen");
  const document = structuredClone(template.document);
  const heading = document.blocks.find((block) => block.type === "heading");
  if (heading?.type === "heading" && title.trim()) heading.text = title.trim();
  return ContentDocument.parse(document);
}
