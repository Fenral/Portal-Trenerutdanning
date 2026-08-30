# Modell- og innsatsstyring Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to apply this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bruke riktig Codex-modell og resonneringsinnsats for hver oppgave, slik at Trenerutdanningsportalen får høy kvalitet uten at kontrollarbeid stopper fremdriften.

**Architecture:** `gpt-5.6-sol` er hovedmodellen gjennom prosjektet for å bevare kvalitet og kontinuitet. Innsatsen velges med fire risikonivåer fra High til Ultra; modellbytte til Terra eller Luna skjer bare for isolerte oppgaver der hastighet er viktigere enn dyp kontekst. Deterministiske tester er alltid beviset på at arbeidet virker.

**Tech Stack:** Codex, `gpt-5.6-sol`, `gpt-5.6-terra`, `gpt-5.6-luna`, Supabase, Next.js, Vitest, pgTAP, Playwright

---

## Beslutning

| Nivå | Modell og innsats | Brukes til | Kontroll |
|---|---|---|---|
| N1 – lav risiko | Sol High | Tekst, dokumentasjon, små stilendringer, enkel seed-data | Format/lint eller én målrettet test |
| N2 – normal | Sol XHigh | Vanlige UI-sider, skjemaer, enkel CMS-funksjon og rapportvisning | Enhets-/komponenttest og typekontroll |
| N3 – kompleks | Sol Max | Arbeidsflyter, progresjonslogikk, vurdering, fravær, publisering og import | Failing test først, målrettet integrasjonstest og diff-review |
| N4 – kritisk | Sol Ultra | Innlogging, RLS, roller, persondata, sammenslåing, audit, AI-tilgang og irreversible migrasjoner | Trussel-/negativ test, sikkerhetskontroll og avgrenset Ultra-review |

**Standard:** Nye portaloppgaver starter på N2. De flyttes opp eller ned før implementering etter reglene under.

## Når andre modeller brukes

| Modell | Tillatt bruk | Begrensning |
|---|---|---|
| `gpt-5.6-terra` High | Isolerte prototyper, visuelle varianter og raske utkast | Produksjonskode gjennomgås av Sol før merge |
| `gpt-5.6-luna` Medium | Mekanisk transformasjon av ikke-sensitive data eller enkel dokumentopprydding | Ikke alene på arkitektur, sikkerhet eller forretningsregler |
| `gpt-5.6-sol` | All integrert produksjonskode og alle beslutninger med varig effekt | Innsats styres med N1–N4 |

Med stor tokenramme prioriteres Sol. Terra og Luna velges for responstid, ikke for å spare tokens.

## Klassifiseringsregler

Oppgaven settes direkte til N4 når den berører minst ett av disse områdene:

1. Autentisering, RLS, roller eller tilgang til persondata.
2. Sletting, sammenslåing, anonymisering eller annen vanskelig reverserbar dataendring.
3. Betaling, Checkin-import, duplikatbrukere eller eksterne integrasjoner med sideeffekter.
4. Administratorens AI-spørringer eller eksport av data med navn.
5. Databaseendringer som påvirker flere eksisterende arbeidsflyter.

Oppgaven settes til N3 når den har minst ett av disse kjennetegnene:

1. Den kobler tre eller flere moduler eller brukerroller.
2. Den har frister, tilstandsoverganger, automatikk eller gjenåpning.
3. Feil gir uriktig progresjon, godkjenning, fravær eller diplom.
4. Den krever både database-, server- og grensesnittendringer.

Nivået økes ett trinn dersom kravene motsier hverandre, to løsningsforsøk har feilet, eller en antakelse kan endre datamodellen. Nivået kan senkes etter at grensesnittet er låst og failing tester beskriver ønsket oppførsel.

## Kontroll uten å miste fremdrift

| Endring | Obligatorisk kontroll | Egen AI-review |
|---|---|---|
| N1 | Én relevant kommando | Nei |
| N2 | Målrettede tester, lint og typer | Nei, med mindre testen avdekker uklarhet |
| N3 | Red–green-test, integrasjonstest og `git diff --check` | Kun endrede filer |
| N4 | N3-kontroll + negative tilgangstester + sikkerhetsverktøy | Sol Ultra på fase-diffen |

En full repository-review kjøres bare ved milepæl. Mellom milepæler gjennomgås maksimalt den aktuelle oppgaven eller fase-diffen.

## Fast arbeidsprotokoll

Hver oppgave starter med én synlig linje:

```text
Styring: N3 · gpt-5.6-sol · Max · Årsak: progresjonslogikk på tvers av tre moduler.
```

Hver oppgave avsluttes med:

```text
Bevis: 6 enhetstester, 2 integrasjonstester og typekontroll bestått. Commit: <hash>.
```

Ved oppskalering varsles nivå, årsak og forventet ekstra kontroll før arbeidet fortsetter. Brukeren trenger bare å ta stilling når modellbyttet krever en ny Codex-oppgave eller når en forretningsbeslutning endrer omfanget.

## Anvendelse på gjeldende portalplan

| Område | Nivå | Begrunnelse |
|---|---|---|
| Task 4 – roller og RLS | N4 / Sol Ultra | Feil kan eksponere studentdata på tvers av kurs |
| Task 5 – invitasjon og passordfri aktivering | N4 / Sol Ultra | Identitet, e-postbinding og tokenhåndtering |
| Task 6 – kurs, samlinger og demo-data | N3 / Sol Max | Flere tabeller og datostyrte kursløp |
| CMS, progresjon, vurdering og fravær | N3 / Sol Max | Tilstand, frister og beregninger må være konsistente |
| UI-polering og innholdsvisning | N2 / Sol XHigh | Høy visuell kvalitet, men lavere datarisiko |
| Checkin, duplikatsammenslåing og admin-AI | N4 / Sol Ultra | Ekstern data, personidentitet og administratorinnsyn |

## Milepæl-gater

1. **Foundation ferdig:** Ultra-review av autentisering, RLS, migrasjoner og negativ kursisolasjon.
2. **Learning/CMS ferdig:** Max-review av progresjonsregler, bridging, frister og publisering; Ultra bare for tilgangsdelen.
3. **Admin/integrasjoner ferdig:** Ultra-review av Checkin-import, reversering, audit og datagrunnlaget for AI.
4. **Før demo:** XHigh på kritiske brukerreiser og visuell QA; ingen full kodegjennomgang.
5. **Før produksjon:** Én samlet Ultra-releasegate med sikkerhet, datagjenoppretting og ende-til-ende-bevis.

## Task 1: Gjør styringslinjen obligatorisk

**Files:**
- Modify: `docs/superpowers/plans/2026-08-30-trenerutdanningsportalen-foundation.md`

- [ ] **Step 1: Legg inn referanse til denne planen**

Legg følgende under planens arkitekturavsnitt:

```markdown
**Model policy:** Følg `docs/superpowers/plans/2026-08-30-modell-og-innsatsstyring.md`; klassifiser hver task N1–N4 før implementering.
```

- [ ] **Step 2: Kontroller referansen**

Run: `rg -n "Model policy|klassifiser hver task" docs/superpowers/plans/2026-08-30-trenerutdanningsportalen-foundation.md`

Expected: Begge uttrykk finnes i samme linje.

- [ ] **Step 3: Commit**

```bash
git add docs/superpowers/plans/2026-08-30-modell-og-innsatsstyring.md docs/superpowers/plans/2026-08-30-trenerutdanningsportalen-foundation.md
git commit -m "docs: define model and effort policy"
```

## Task 2: Bruk første kritiske gate på RLS

**Files:**
- Modify: `docs/superpowers/plans/2026-08-30-trenerutdanningsportalen-foundation.md`
- Test: `portal/supabase/tests/002_rls.test.sql`

- [ ] **Step 1: Klassifiser Task 4 før arbeid**

Bruk denne styringslinjen i arbeidsoppdateringen:

```text
Styring: N4 · gpt-5.6-sol · Ultra · Årsak: radnivåsikkerhet må isolere kurs og persondata.
```

- [ ] **Step 2: Avgrens Ultra-kontrollen**

Review skal bare dekke Task 4-diffen, RLS-policyene og `002_rls.test.sql`. Den skal bevise student-egenrad, lærer-eget-kurs, redaktør uten deltakerinnsyn og administrator på tvers.

- [ ] **Step 3: Kjør gatekommandoene**

```bash
pnpm test:rls
pnpm supabase db lint --local --schema public,private --level warning --fail-on error
pnpm supabase db advisors --local --type all --level warn --fail-on error
```

Expected: Alle kommandoer avslutter med kode `0`, og krysskurs-testen er negativ.

## Task 3: Evaluer styringen etter Foundation

**Files:**
- Modify: `docs/superpowers/plans/2026-08-30-modell-og-innsatsstyring.md`

- [ ] **Step 1: Mål faktisk nytte**

Registrer antall oppgaver per nivå, antall eskaleringer, antall feil funnet av Ultra-review og om en gate tok mer enn 30 minutter uten å finne en feil.

- [ ] **Step 2: Juster én variabel om gangen**

Hvis to påfølgende Ultra-gater ikke finner alvorlige eller høye funn, behold Ultra kun for N4 og produksjonsgate. Hvis en N2/N3-endring gir tilgangs- eller datatapfeil, flytt den aktuelle oppgavetypen ett nivå opp.

- [ ] **Step 3: Behold beslutningen sporbar**

Skriv én datert linje under dette avsnittet med endret regel, beviset som utløste endringen og hvilken milepæl den gjelder. Ikke endre tidligere linjer.
