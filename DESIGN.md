---
version: alpha
name: Nivå Klassisk Premium
description: Et rolig og presist designsystem for trenerutdanning, forankret i én tydelig neste handling og premium materialitet.
source: http://127.0.0.1:47831/design.md
adopted_for: Trenerutdanningsportalen i norsk golf
---

# Nivå Klassisk Premium Design System

## Status og kilde

Dette er det vedtatte grunnsystemet for Trenerutdanningsportalen. Det erstatter den feilaktige «Nordisk feltmanual»-retningen som kort ble hentet fra en eldre pilot.

- Menneskelig referanse: `http://127.0.0.1:47831/design.html`
- Maskinlesbar kilde: `http://127.0.0.1:47831/design.md`
- Kontrollert visuelt og lest 30. august 2026.

## Overview

Nivå er et arbeidsverktøy for studenter, kurslærere og særforbund som samler læring, samlinger, klubbpraksis og vurdering. Klassisk Premium skal føles rolig, presist, tillitsvekkende og umiddelbart forståelig i daglig bruk. Den styrende komposisjonen er én dominant neste handling, støttet av praksisstatus og mentorfeedback — ikke en samling likeverdige instrumentkort. Grønnsvart typografi, en kontrollert 8/4-komposisjon og taktile, hvite flater gir identitet uten sports-klisjeer. Treningspuls er kun et guidet onboarding-mønster og skal ikke endre det permanente grensesnittets formspråk.

## Colors

| Token | Verdi |
|---|---:|
| `canvas` | `#F7F9F8` |
| `surface` | `#FFFFFF` |
| `surface-subtle` | `#F1F4F2` |
| `on-surface` | `#10221B` |
| `text-muted` | `#5F6B65` |
| `primary` | `#39724E` |
| `on-primary` | `#FFFFFF` |
| `primary-hover` | `#2F6242` |
| `primary-active` | `#285438` |
| `primary-soft` | `#E6ECE8` |
| `on-primary-soft` | `#214C34` |
| `border` | `#E1E7E3` |
| `border-strong` | `#C6D0CA` |
| `focus` | `#315BCE` |
| `disabled` | `#E8ECE9` |
| `on-disabled` | `#7A847F` |
| `success` | `#2F6B49` |
| `success-soft` | `#E5F1E9` |
| `warning` | `#8A5A13` |
| `warning-soft` | `#F8EFD9` |
| `error` | `#A43E35` |
| `error-soft` | `#F7E8E5` |
| `info` | `#2F6973` |
| `info-soft` | `#E3EFF1` |
| `ai` | `#405CF5` |
| `on-ai` | `#FFFFFF` |
| `ai-soft` | `#E9ECFF` |
| `on-ai-soft` | `#2F43BD` |

`canvas` er en kjølig kritthvit arbeidsbakgrunn, mens `surface` løfter konkrete oppgaver og data uten hard kontrast. `on-surface` er grønnsvart fremfor rent svart og bærer all primærtekst; `text-muted` brukes bare for støttetekst som fortsatt må møte WCAG 2.2 AA. `primary` er den eneste generelle merkevareaksenten og brukes på hovedhandling, aktiv navigasjon og meningsfull progresjon. Statusfarger brukes med ikon og tekst, aldri alene. `ai` er en avgrenset funksjonsfarge for Datapilot og AI-generert innhold; den er aldri generell dekor eller fokusfarge.

## Typography

Manrope er eneste standardfamilie fordi den kombinerer tydelige tegnformer med den nøkterne, moderne karakteren i Klassisk Premium. Store overskrifter er tette og bestemte, mens brødtekst har romslig linjehøyde for lengre læringsinnhold. `eyebrow` brukes til korte versale kontekstetiketter som «NESTE AKTIVITET», aldri til forklarende brødtekst. `data` bruker Manropes tabulære tall slik at praksistimer og progresjon justeres uten at grensesnittet får en teknisk monospace-karakter. Minimum lesbar brødtekst er 16 px på mobil; 12–13 px er forbeholdt kort metadata.

| Stil | Størrelse | Vekt | Linjehøyde | Bokstavavstand |
|---|---:|---:|---:|---:|
| `display` | 48 px | 720 | 0.98 | −0.055 em |
| `h1` | 36 px | 720 | 1.08 | −0.04 em |
| `h2` | 28 px | 700 | 1.16 | −0.03 em |
| `h3` | 18 px | 700 | 1.35 | −0.015 em |
| `body-lg` | 18 px | 450 | 1.6 | normal |
| `body` | 16 px | 450 | 1.6 | normal |
| `body-sm` | 14 px | 450 | 1.55 | normal |
| `label` | 13 px | 650 | 1.35 | normal |
| `eyebrow` | 12 px | 700 | 1.3 | +0.065 em |
| `data` | 16 px | 650 | 1.3 | tabular |
| `button` | 15 px | 700 | 1.2 | normal |
| `caption` | 12 px | 500 | 1.45 | normal |

```css
--font-ui: "Manrope", "Avenir Next", "Segoe UI", Helvetica, Arial, sans-serif;
font-feature-settings: "tnum" 1, "ss01" 1;
```

## Layout

Desktop bruker et fast sidefelt på 228–240 px, et verktøyfelt på 68–72 px og et 12-kolonners arbeidsområde. Hovedoppgaven bruker normalt åtte kolonner og kontekstflaten fire, med 28–32 px mellomrom; underseksjoner følger samme akser. Ytre innholdsbredde er maksimalt 1280 px, med 32–64 px sidepadding og 32 px kortpadding. På mobil blir neste handling det første operative elementet, mens sekundær status følger under i én kolonne. Alle interaktive mål er minst 44 × 44 px, og faste flater må reservere plass for safe areas.

### Spacing

| Token | Verdi |
|---|---:|
| `micro` | 4 px |
| `tight` | 8 px |
| `compact` | 12 px |
| `default` | 16 px |
| `comfortable` | 24 px |
| `spacious` | 32 px |
| `section` | 48 px |
| `page` | 64 px |
| `hero` | 96 px |

## Elevation & Depth

Systemet er nesten flatt og skaper dybde med hvit flate, `border` og svært myke grønn-tonede skygger. Standardkort bruker et lagdelt par — `0 1px 2px rgba(16, 34, 27, 0.04), 0 8px 24px rgba(16, 34, 27, 0.05)` — der den korte skyggen forankrer kanten og den lange gir luft. Interaktive kort kan løftes til `0 2px 4px rgba(16, 34, 27, 0.05), 0 12px 32px rgba(16, 34, 27, 0.08)` med maks 1 px translateY på hover (180 ms, ease-out; deaktiveres ved redusert bevegelse). Flytende menyer kan bruke `0 16px 40px rgba(16, 34, 27, 0.08)`. Alle kombineres med en 1 px kant, slik at informasjonen fortsatt har struktur når skygger ikke oppfattes. Innvendige seksjoner bruker kun tonet bakgrunn eller skillelinje. Harde skygger, glass, glow og flere stablede elevasjonsnivåer er ikke tillatt.

## Shapes

| Token | Verdi | Bruk |
|---|---:|---|
| `none` | 0 px | tabell og strukturell kant |
| `control` | 8 px | knapp og navigasjon |
| `field` | 10 px | inndata |
| `inner` | 12 px | innvendig flate og ikonflis |
| `surface` | 16 px | hovedflate og kort |
| `pill` | 999 px | korte statuser og progresjonslinje |

Outline-ikoner bruker konsekvent strek og uten dekorative sportsmotiver. Pillradius er reservert for korte statuser og må aldri bli standardformen for knapper, kort eller navigasjon.

## Components

### `button-primary`

- 48 px høy, 8 px radius, `primary` på `on-primary`.
- Padding: 12 px × 24 px.
- Sidens ene dominante handling.
- Hover `primary-hover`, active `primary-active`, disabled `disabled` / `on-disabled`.
- Fokus: 3 px `focus` med 3 px offset.

### `button-secondary`

- 48 px høy, 8 px radius, hvit flate og 1 px `primary`-kant.
- Brukes til støttende og reversible handlinger.
- To fylte knapper skal ikke konkurrere i samme region.

### `input`

- 48 px høy, 10 px radius, 12 × 16 px padding.
- Tydelig etikett, hjelpetekst og kant.
- Feil kombinerer feiltekst, ikon, `error`-kant og `error-soft` flate.

### `nav-item`

- 44 px høy og 8 px radius; tekstfarge `#3D4C45` (`text-subtle`), vekt 650.
- Aktiv tilstand: `primary-soft` / `on-primary-soft`, vekt 700.
- Hoveddestinasjoner holdes stabile og synlige.

### `course-context`

- Kompakt boks øverst i sidefeltet: versal etikett «Aktivt kurs» over kursnavnet.
- `surface-subtle` bakgrunn, 1 px `border`, 10 px radius.
- Gir stabil kurskontekst uten å konkurrere med navigasjonen.

### `timeline`

- Horisontalt spor øverst i kursvisningen: samlinger (runde punkter) og
  innleveringsfrister (avrundet kvadrat) sortert på dato.
- Gjennomført: fylt `primary` med hake. Kommer: hvit flate med kantlinje.
  Forfalt: `warning-soft` flate, `warning` kant og teksten «Forfalt» — aldri
  farge alene.
- «Du er her»-markør: 2 px stiplet `primary`-linje med versal etikett på
  dagens posisjon; skjermlesere får dagens dato som tekst og
  `aria-current="step"` på neste kommende hendelse.
- Hvert punkt er en lenke: frist går til aktiviteten, samling til
  samlingsraden lenger ned på siden. Overflyt ruller horisontalt med
  bevart fokusring.

### `diploma-card`

- Vises på studentens hjem når kurset er fullført: suksess-tonet ikonflis,
  kurs, fullføringsdato, diplomnummer og én primærknapp «Last ned diplom».

### `card`

- Representerer én selvstendig oppgave eller kontekst, ikke hvert avsnitt.
- Hvit flate, 16 px radius og 32 px padding.
- Standard border og myk kortskygge.

### `next-step` (neste-steg-/kø-hero)

- Sidens ene dominante handlingskort: `primary-soft` flate, 1 px `border`,
  16 px radius og kortskygge — aldri mørk/invertert flate.
- Grønnsvart tittel, `text-subtle` brødtekst, `primary` eyebrow.
- Én fylt `primary`-CTA; dominansen kommer fra størrelse og at dette er
  flatens eneste fylte knapp.
- Brukes for studentens «Anbefalt neste steg» og lærerens «N til oppfølging».

### `status`

- Kort pill med 4 × 12 px padding.
- Pågår: `primary-soft` / `on-primary-soft`.
- Frist nærmer seg: `warning-soft` / `warning`.
- Krever handling: `error-soft` / `error`.
- Alltid ikon eller form, tekst og farge.

### `progress`

- 6 px høy, full avrunding.
- Track: `primary-soft`; fill: `primary`.
- Totalprogresjon vises i prosent. Enkeltmoduler vises som `7 av 11`, timer eller vurderingsstatus.

### AI

- Bruk `ai` bare i Datapilot og AI-generert innhold.
- Vis aktive filtre, definisjon, datakilde og at resultatet er skrivebeskyttet.
- AI skal ikke tolke prestasjon eller risiko i Trenerutdanningsportalen.

## Do's and Don'ts

### Do

- Prioriter én konkret neste handling over analyse og pynt.
- Bruk de samme gridaksene på tvers av student, kurslærer og admin.
- La hvite flater, tynne kanter og grønnsvart typografi bære premiumfølelsen.
- Vis status med ikon, tekst og farge; forklar hva brukeren kan gjøre videre.
- Bruk Treningspuls kun som en kort, guidet onboardinglinje.

### Don't

- Ikke bygg bento-mosaikker eller «kortsuppe» av alle måltall.
- Ikke bruk gradients, glassmorphism, glow eller harde skygger.
- Ikke bruk tykke sidekanter (border-left/right > 1 px) som aksent på kort
  eller varsler; callouts bruker full 1 px statuskant, `field`-radius og
  `*-soft` flate.
- Ikke bruk sirkulære prosentdiagrammer, streaks eller konkurrerende gamification.
- Ikke bruk golfbilder, flaggdekor eller andre idrettsklisjeer som systemgrafikk.
- Ikke overbruk piller, grønt eller flere like sterke hovedknapper.

## Anvendelse i Trenerutdanningsportalen

- Studentens neste aktivitet er sidens dominante handling.
- Lærerens arbeidskø er viktigere enn generelle statistikkort.
- Administratorens avvik og nødvendige handlinger kommer før rapporttall.
- Rød, gul og grønn fremdrift følger lærerens plan og vises med ord og symbol.
- Trener 1-kurssteder kan ekspanderes og kollapses i den faste sidemenyen.
- Profil og deltakeroversikt følger 8/4-gridet: operativ progresjon til venstre, oppfølging og kontekst til høyre.
