# V1 Gap-analyse — Trenerutdanningsportalen

**Dato:** 1. september 2026
**Analysert commit:** `47e842c` (main), lokal kjøring mot lokal Supabase
**Kravbase:** [`docs/specs/2026-08-30-trenerutdanningsportalen-v1.md`](../specs/2026-08-30-trenerutdanningsportalen-v1.md)
**Planpakke:** master + foundation + learning-cms + operations + checkin-launch
**Metode:** Hvert kravområde er sammenlignet med faktisk kildekode, migrasjoner, tester og kjørende app på `http://127.0.0.1:3100`. Tomme sider, mocks og planlagte tester er ikke godkjent som bevis.

---

## 1. Samlet estimert V1-kompletteringsgrad

**≈ 55 %** av V1-omfanget, med svært skjev fordeling:

| Delplan | Status | Estimat | Grunnlag |
|---|---|---:|---|
| 1. Foundation | Fullført | ~95 % | Alle 6 tasks levert med tester; commits `7148fc8`…`265b564` |
| 2. Learning/CMS | Fullført med bevisste avgrensninger | ~90 % | Alle 9 tasks levert; PASS-dokumentert gate ([`portal/docs/evidence/learning-cms-gate.md`](../../portal/docs/evidence/learning-cms-gate.md), commit `b66a03b`) |
| 3. Operations | Så vidt påbegynt | ~20 % | Vurderingskø og deltakerliste finnes; pace/trafikklys, varsler, people-ops, rapporter, AI-søk og driftsside mangler |
| 4. Checkin/Launch | Ikke påbegynt | ~5 % | Ingen import-kode, ingen fixtures, ingen sikkerhets-/UU-/drift-artefakter; kun skanner-adapteren finnes |

Git-historikken bekrefter dette: siste plan-commit er `1709d47` (vertical learning slice); alt etterpå er demo-/diplom-/NIF-tillegg utenfor planpakken.

## 2. Verifikasjonskjøringer (denne analysen, 1. sept 2026)

| Kontroll | Resultat |
|---|---|
| `pnpm format:check` / `lint` / `typecheck` | **PASS** |
| `pnpm test:unit --run` (sekvensielt) | **PASS** — 27 filer, 91 tester |
| `pnpm test:rls` | **PASS** — 7 filer, 165 pgTAP-tester |
| `pnpm exec playwright test` (hele suiten, 21 tester) | **FAIL — 17/21** ved sekvensiell kjøring mot fersk database; 4 feilende. Se diagnose under. |
| Manuell browsersjekk (student/lærer/admin via `test-login`) | **PASS** — alle tre roller rendrer reelle data |

Merk: unit-testene krever sekvensiell kjøring (`--no-file-parallelism` eller `VITEST_MAX_FORKS=4`) på denne maskinen (OneDrive-I/O gir worker-timeouts ved 14 parallelle forks); miljøforhold, ikke kodefeil.

### Diagnose av de 4 feilende e2e-testene

Rotårsakene er verifisert ved gjenkjøring per spec mot fersk database (`supabase db reset` før hver):

1. **`assignment-resubmission` og `vertical-learning-slice` krever `E2E_TEST_MODE=true`.** Opplastingskoden bruker `isE2ETestMode()` — ikke `isDemoMode()` — som bryter ([`upload.ts:57`](../../portal/src/features/assessment/assignments/upload.ts)): med `E2E_TEST_MODE=false` går innleveringer mot ekte storage-bucket og ekte skanner på `CLAMAV_SCANNER_URL`, som ikke finnes lokalt. Med `E2E_TEST_MODE=true` og fersk DB **består** `assignment-resubmission`. Konsekvens verdt å merke: i en hostet demo med `DEMO_MODE=true` men `E2E_TEST_MODE` av (E2E-modus er alltid av i produksjons-NODE_ENV) vil innleveringsopplasting kreve en reell skanner — dette bør bekreftes mot Vercel-miljøet.
2. **`vertical-learning-slice` og `demo-cohort` (lærer-testen) er utdaterte mot ny deltakerliste-markup.** Commit `b9f4508` («participant module filtering and profiles», etter siste dokumenterte gate `b66a03b`) skrev om deltakerlisten: radene er nå `<Link aria-label="Vis profil for …">` ([`participant-list.tsx:97-98`](../../portal/src/app/teacher/participants/participant-list.tsx)), mens spec-ene fortsatt leter etter `getByRole("article")` og lenken «Åpne Selma Dahl». Vertikalreisen kom i E2E-modus gjennom editor → leksjon → quiz → innlevering → praksisgodkjenning og strandet først på dette selektorpunktet.
3. **`student-learning` består alene mot fersk database** — den sekvensielle feilen skyldes tilstandsakkumulering fra tidligere spec-er (fullføringer er bevisst uforanderlige), ikke kodefeil.

**Konklusjon:** e2e-suiten er ikke grønn på HEAD (`47e842c`). Siste dokumenterte grønne gate er commit `b66a03b`; de fem demo-/UI-commitene etterpå har ikke fått oppdatert testene. Dette er et vedlikeholdsavvik i testsuiten (og et brudd på masterplanens regel om at endring etter review opphever tidligere PASS), ikke nødvendigvis funksjonsfeil — funksjonaliteten bak de tre feilene er verifisert manuelt i browser.

## 3. Kravmatrise med bevis

Klassifisering: **IMPL** = implementert, **DELVIS** = delvis implementert, **MANGLER** = ikke implementert, **EKSTERN** = blokkert av ekstern avhengighet/port.

| Spec-krav | Status | Bevis / hva som mangler |
|---|---|---|
| §2.1 Invitasjon + passordfri innlogging, stabil portal-ID | **IMPL** (lokalt) | [`create-invitation.ts`](../../portal/src/features/access/invitations/create-invitation.ts), [`claim-invitation.ts`](../../portal/src/features/access/invitations/claim-invitation.ts), OTP i [`activate/actions.ts:49`](../../portal/src/app/(auth)/activate/actions.ts), migrasjon `20260830201600_invitation_flow.sql`, pgTAP `003_invitations`, e2e `invitation.spec.ts`. Stabil ID via `profiles` + `user_accounts` (`20260830190811_core.sql:18,42`). E-postutsending i produksjon: se §13. |
| §3 Roller og rettigheter, server + RLS | **IMPL** | Matrise i [`permissions.ts`](../../portal/src/features/access/permissions.ts) (alle 5 roller), RLS i `20260830200442_rls.sql`, pgTAP `002_rls` bestått i 165-testkjøringen. Unit `permissions.test.ts`. |
| §3/§14.2 Admin delegerer roller/kursansvar i UI | **MANGLER** | `role_assignments`-tabell og `role.grant`-permission finnes, men ingen admin-flate skriver dem utenom seed. |
| §4 Kursmodell T1×9/T2/T3, samlinger, Ungdomsdriven-samling | **IMPL** | `course_templates/runs/sessions` (`core.sql:60–111`), `sessionType: "youth_drive"` ([`schema.ts:48`](../../portal/src/features/courses/schema.ts)), seed med 9 T1-steder + T2 + T3 2026–2027, admin-UI [`admin/courses`](../../portal/src/app/(admin)/admin/courses/page.tsx) med ny-kurs-skjema, e2e `admin-courses.spec.ts`, pgTAP `004_course_runs`. Verifisert i browser: «11 kursgjennomføringer · 9 kurssteder på Trener 1». |
| §4 Nye kursmaler uten kodeendring (etterutdanning) | **DELVIS** | Datamodellen er generisk, men [`schema.ts`](../../portal/src/features/courses/schema.ts) låser `templateCode` til `z.enum(["T1","T2","T3"])` — ny mal krever kodeendring i validatoren. |
| §5 Studentens startside: én neste handling, progresjon, «x av y», samling/frister | **IMPL** | [`student/page.tsx`](../../portal/src/app/student/page.tsx) + [`LearningOverview.tsx`](../../portal/src/features/learning/LearningOverview.tsx) + [`next-activity.ts`](../../portal/src/features/learning/next-activity.ts); e2e `student-learning.spec.ts`. Verifisert i browser: «Fortsett der du slapp» med dominant anbefalt neste steg. |
| §6.1 Innholdstyper: kort side, scrollmodul, video, quiz, aktivitetstyper | **IMPL** | Blokk-union med `interactive_sequence` i [`document-schema.ts`](../../portal/src/features/content/document-schema.ts), rendrer i [`ContentRenderer.tsx`](../../portal/src/features/learning/ContentRenderer.tsx); aktivitetstyper i `20260922090000_learning.sql`; unit `document-schema.test.ts` + `content-renderer.test.tsx`. |
| §6.1 Filressurser: opplasting, publikum, forhåndsvisning, «Filer og ressurser» | **DELVIS** | Modell (`resource_items/revisions`, audience-enum i `20260915090000_content.sql`), studentvisning ([`StudentResources.tsx`](../../portal/src/features/learning/StudentResources.tsx)), signert nedlasting ([`resources/[assetId]/route.ts`](../../portal/src/app/resources/[assetId]/route.ts)) og [`ResourcePanel.tsx`](../../portal/src/app/(editor)/editor/content/[itemId]/ResourcePanel.tsx) finnes — men **redaktørens opplastingsknapp er bevisst deaktivert** («Sikker opplasting er klargjort», `ResourcePanel.tsx:122–126`) i påvente av EU-skanner (G2). Skanner-adapteren [`scan-upload.ts`](../../portal/src/lib/files/scan-upload.ts) er fail-closed og testet (`scan-upload.test.ts`). |
| §6.2 Versjonering: kladd/publiser, immutabilitet, binding, tilbakeføring | **IMPL** | `publish-content.ts`, `update-draft.ts`, én-kladd/én-publisert-indekser + immutabilitetstrigger (`content.sql`), pgTAP `010_content_versions` + `011_content_editor`, e2e `content-publishing.spec.ts` (student ser ikke kladd). |
| §7.1 Progresjonsberegning og modulvisning | **IMPL** | [`progress.ts`](../../portal/src/features/learning/progress.ts) (vekter, avrunding), `enrollment_progress`-materialisering (`learning.sql:213`), unit `progress.test.ts`, pgTAP `012_learning`. |
| §7.2 Anbefalt plan, milepæler, trafikklys | **MANGLER** | Ingen `pace_plans`/`pace_milestones`-migrasjon, ingen `recommendedProgress`/`classifyPace`. Eneste spor er en statisk `Status`-demo («I rute»/«Litt bak») i [`design-system/page.tsx:50-51`](../../portal/src/app/design-system/page.tsx). Operations Task 1 er ikke startet. |
| §7.3 Avhengigheter med låseforklaring | **IMPL** | `activity_prerequisites` (`learning.sql:149`), [`access.ts`](../../portal/src/features/learning/access.ts) returnerer eksakt manglende titler, unit `access.test.ts`, e2e-låsetekst i `student-learning.spec.ts`. |
| §7.4 Quiz/kunnskapsprøve med forsøk og delay | **IMPL** | `20261001090000_quiz.sql` (immutable `question_versions`, forsøk, idempotensnøkkel), [`grade-attempt.ts`](../../portal/src/features/assessment/quiz/grade-attempt.ts) + [`attempt-policy.ts`](../../portal/src/features/assessment/quiz/attempt-policy.ts), unit `quiz.test.ts`, integrasjon `quiz-attempt.test.ts`, e2e `student-quiz.spec.ts`. |
| §8 Innlevering, vurderingsskala, «må utbedres», ny individuell frist | **IMPL** | `20261005090000_assignments.sql` (versjoner, reviews, `assignment_deadline_overrides`), state-machine + tester, lærer-UI [`teacher/assignments/[submissionId]`](../../portal/src/app/teacher/assignments/[submissionId]/page.tsx) med fristoverstyring, e2e `assignment-resubmission.spec.ts`, integrasjon `assignment-flow.test.ts`. |
| §9 Praksis 45/9 t, innsending, auto-godkjenning m/delay, stikkprøve | **IMPL** | `20261009090000_practice.sql`, [`totals.ts`](../../portal/src/features/practice/totals.ts) (2700/540 min), state-machine, student- og lærer-UI, integrasjon `approval.test.ts` (delay/idempotens/stikkprøve), e2e `practice-workflow.spec.ts`. |
| §10 Oppmøte i enkelttimer, 80 %-krav | **IMPL** | `attendance_records` (`completion.sql:24`), [`attendance-editor.tsx`](../../portal/src/app/teacher/participants/[enrollmentId]/attendance-editor.tsx), [`percentage.ts`](../../portal/src/features/attendance/percentage.ts), e2e `attendance-absence-hours.spec.ts`. |
| §10 Universitetskrav (manuelt, T2/T3) | **IMPL** | `university_requirements` + RPC `set_university_completion`, admin-handling i [`admin/courses/[courseRunId]/actions.ts:21`](../../portal/src/app/(admin)/admin/courses/[courseRunId]/actions.ts). |
| §10 Ungdomsdriven: ikke-blokkerende fakturaoppgave | **IMPL** | [`evaluate-completion.ts:35-37`](../../portal/src/features/completion/evaluate-completion.ts) + `completion_admin_tasks` med unik `(enrollment_id, task_code)` (`completion.sql:148–166`), unit `evaluate-completion.test.ts`. Admin-UI som viser/lukker oppgaven mangler (se §14.2). |
| §10 Automatisk fullføring, feiring, diplom | **IMPL** (demo-mal) | Fullføringstransaksjon i `completion.sql`, [`generate-diploma.ts`](../../portal/src/features/completion/generate-diploma.ts) (pdf-lib, deterministisk), [`CertificateCelebration.tsx`](../../portal/src/features/completion/CertificateCelebration.tsx) (reduced motion + vibrate), «Mine diplomer»-side, integrasjon `diploma.test.ts`, e2e `student-completion.spec.ts` + `student-certificates.spec.ts`. **EKSTERN:** endelig NGF-mal/font/signatur (G3) — `digital-v1`-demomal brukes, dokumentert i learning-cms-gate. |
| §11 Statusflyt trukket/gjenåpnet, reverserbar med ett tastetrykk | **DELVIS** | `enrollment_status`-enum har `withdrawn` (`core.sql:14`) og fullføringslogikken ekskluderer trukkede (`completion.sql:398`) — men det finnes **ingen** withdraw/reopen-serverfunksjon, UI-handling eller audit-flyt. Operations Task 4 ikke startet. |
| §11 Duplikatforslag + reversibel kontosammenslåing | **MANGLER** | Ingen `person_merges`-tabell, ingen `duplicate-score.ts`/`merge-people.ts`, ingen `admin/people/duplicates`-side. |
| §11 Anonymiseringsflyt (personvern) | **MANGLER** | Ingen `anonymize-person.ts`; audit-typene har `person.anonymized` som eneste spor ([`audit/types.ts`](../../portal/src/features/audit/types.ts)). |
| §11 Minimumsalder 15 / aldersverifisering | **DELVIS** | `birth_year` med constraint finnes (`core.sql`), men kontrollpunktet er definert i importflyten — som ikke finnes. |
| §12.1 Checkin-import (forhåndsvisning, idempotens, kolonnemapping) | **MANGLER** + **EKSTERN** | Ingen `src/features/imports/`, ingen import-migrasjon, ingen fixtures, ingen kontraktsdok. Gate G1 (redigert originaleksport fra NGF) er også utestående. |
| §12.2 Historikkimport + årsavgrensning for student | **MANGLER** | Ingen `historical_qualifications`, ingen history-import. Studenten ser uansett bare aktivt kurs i dag (ingen historiske data finnes). |
| §13 Varsler: portal + e-post, idempotent utsendelse, påminnelser | **DELVIS** + **EKSTERN** | `outbox_events` finnes (`core.sql:239`) og invitasjoner enqueues idempotent ([`create-invitation.ts`](../../portal/src/features/access/invitations/create-invitation.ts)), men transporten er kun [`console-transport.ts`](../../portal/src/features/notifications/console-transport.ts) (kaster i produksjon). Ingen worker, ingen maler, ingen SMTP, ingen `scheduled_reminders`, ingen cron-rute, ingen manuell påminnelse fra lærer. E-postleverandør er G2-avhengig. |
| §14.1 Lærerflate: arbeidskø, deltakerliste, profil | **DELVIS** | Reell vurderingskø (innleveringer + praksis) i [`teacher/page.tsx`](../../portal/src/app/teacher/page.tsx); deltakerliste med modulfilter/sortering ([`participant-list.tsx`](../../portal/src/app/teacher/participants/participant-list.tsx)); profil med oppmøteføring. **Mangler:** trafikklyskolonne/-filter (avhenger av §7.2), «passert frist»-prioritet i køen, T1-kollaps per kurssted i lærerflaten, meldings-/påminnelseshandling. |
| §14.2 Adminflate: totaloversikt, driftskø, avvik | **DELVIS** | Kursportefølje + kursdetalj + rapportside finnes; **ingen** driftsside med importstatus/Ungdomsdriven-oppgaver/duplikater (Operations Task 7), ingen rolledelegering, ingen import-UI, ingen overstyrings-UI for sluttkrav (`completion_overrides`-tabellen er ubrukt fra appkoden). |
| §15 Rapporter: 7 typer × PDF + Excel | **DELVIS** | Kun én rapport finnes: NIF-oppmøterapport som XLSX ([`nif-report.ts`](../../portal/src/features/reporting/nif-report.ts), rute `admin/reports/nif/[courseRunId]`, e2e `admin-reports.spec.ts`) — den er et tillegg utenfor spec-listen. Ingen av de syv spesifiserte rapporttypene, ingen PDF-eksport, ingen delte `definitions.ts`. `exceljs`/`@react-pdf/renderer` er ikke installert. |
| §15 Objektivt AI-søk (allowlist, read-only, forklart svar) | **MANGLER** | Ingen `src/features/admin-query/`, ingen intents/parser/UI. Kun permission-flagget `admin_query.run` i `permissions.ts`. `openai` er ikke installert. |
| §16 WCAG 2.2 AA | **DELVIS** | Sterk grunnpraksis: tekst+symbol-status, fokus/44px-regler i `ui.css`, axe kjørt i learning-gate med 0 alvorlige funn, skip-links/landemerker i shells. **Mangler:** dedikert `tests/accessibility/critical-pages.spec.ts`-suite, dokumentert manuell UU-runde (zoom/skjermleser) på alle kritiske flater. |
| §16 Sikkerhet: RLS, audit, logging uten PII | **DELVIS** | RLS + append-only audit er implementert og testet (165 pgTAP). **Mangler:** threat model, CodeQL/secret scan, Sentry med PII-scrubbing, rate limits, `retention-policy.ts`, log-redaction-tester (Launch Task 6). |
| §16 EU-hosting, DPA, backup/restore-bevis | **EKSTERN** + **MANGLER** | G2 er NGFs port. Runbooks (`backup-restore.md`, `incident-response.md`), restore-test og lasttest finnes ikke (Launch Task 7). |
| §17 Porter G1–G5 | **EKSTERN** | Ingen av de fem portene har dokumentert bevis i repoet. G3 har fungerende demomal som eksplisitt avgrensning. |
| §19.1 Fiktiv student ende-til-ende t.o.m. diplom | **IMPL** | Bevist i `vertical-learning-slice.spec.ts` + gate-dokument (commit `b66a03b`): invitasjon→modul→quiz→innlevering→praksis→oppmøte→diplom. |
| §19.2 Lærer: kull, røde/gule, vurdere, frist, oppmøte, påminnelse | **DELVIS** | Vurdere/frist/oppmøte: ja. Røde/gule (trafikklys) og påminnelse: mangler. |
| §19.3 Admin: kurs, tilgang, dobbelimport, duplikat, trekk, PDF/Excel | **DELVIS** | Kurs: ja. Import/duplikat/trekk: mangler. Eksport: kun XLSX (NIF). |
| §19.4 AI-søk korrekt og read-only | **MANGLER** | Se §15. |
| §19.5 Sikkerhets-/personvern-/UU-/last-/restore-tester bestått | **MANGLER** | Se §16/§17. |

## 4. Manglende funksjoner sortert etter betydning

1. **Checkin-import (§12)** — selve broen til virkeligheten; uten den kan ingen reelle deltakere komme inn. Blokkeres også av G1.
2. **Trafikklys/anbefalt plan (§7.2)** — kjernen i lærerens oppfølging og i ferdigkriterium 2; låser opp resten av lærerflaten.
3. **Varsler med ekte e-post (§13)** — invitasjonsflyten stopper i praksis uten transport-/worker-leddet; SMTP er G2-avhengig, men worker + maler + påminnelser kan bygges nå.
4. **Trekk/gjenåpne + duplikat/merge + anonymisering (§11)** — tilgangslivsløpet; ferdigkriterium 3.
5. **Rapportpakken 7 × PDF/Excel (§15)** — bare én XLSX-rapport finnes i dag.
6. **AI-søk (§15)** — eget ferdigkriterium (4); avhenger av rapportdefinisjonene, derfor etter punkt 5.
7. **Admin driftsside + rolledelegering + overstyrings-UI (§14.2)** — samler oppgaver som i dag er usynlige (Ungdomsdriven-tasks skrives til DB, men vises ingen steder).
8. **Historikkimport (§12.2)** — mindre kritisk for oppstart 3. februar; kan tas etter pilot.
9. **Sikkerhets-/UU-/drift-gatene (§16, Launch Task 6–8)** — release-blokkere, men riktige å ta sist når flatene er komplette.
10. **Redaktøropplasting av filer (§6.1)** — bevisst avgrenset; åpnes når G2-skanneren finnes (liten kodeendring).

**Akutt vedlikeholdsfunn (før ny featureutvikling):** e2e-suiten må bringes tilbake til grønt på HEAD — oppdater `vertical-learning-slice` og `demo-cohort` til ny deltakerliste-markup, og avklar om opplastingsstubben skal følge `isDemoMode()` i stedet for `isE2ETestMode()` ([`upload.ts:57`](../../portal/src/features/assessment/assignments/upload.ts)). Uten dette er porten i masterplanens §5 reelt sett nede.

## 5. Vercel vs. lokalt

Dette kunne ikke verifiseres direkte fra denne maskinen: repoet inneholder ingen `vercel.json`/`.vercel`-mappe, og Vercel-integrasjonen i verktøykjeden er ikke autentisert i denne økten.

Det som kan sies med bevis:

- Kildekoden har én sannhetskilde (main, `47e842c`); det finnes ingen deploy-spesifikke kodegrener eller workflows i `.github/workflows/`.
- Commit `4e88227` («enable isolated production demo login») gjorde `test-login` tilgjengelig i produksjon når `DEMO_MODE=true` ([`environment.ts:35-37`](../../portal/src/lib/supabase/environment.ts)) — dette indikerer at en hostet demo kjører samme kode med demo-flagg og egen Supabase-instans.
- Forventede forskjeller er dermed **kun miljøstyrte**: `DEMO_MODE`, `E2E_TEST_MODE`, Supabase-URL/nøkler og `CLAMAV_SCANNER_URL`. I demo-modus stubbes virusskanneren ([`upload.ts:113-115`](../../portal/src/features/assessment/assignments/upload.ts)); mot en produksjonsskanner er adferden fail-closed.
- **Lokalt, men ikke nødvendigvis i Vercel:** ferske migrasjoner/seed (lokal DB resettes fritt). **I Vercel, men ikke lokalt:** ingenting kjent — men dette bør bekreftes ved å sammenligne deployet commit-SHA mot main.

## 6. Eksterne produksjonsporter som fortsatt mangler

| Port | Hva som mangler | Konsekvens i kode |
|---|---|---|
| G1 Checkin-format | Redigert originaleksport fra NGF | Import-sporet (hele plan 4, Task 1–4) kan ikke låses; header-fingerprint kan ikke skrives |
| G2 Infrastruktur/personvern | EU-hosting-godkjenning, e-postleverandør, DPA, behandlingsgrunnlag | SMTP-transport, ClamAV-endepunkt (redaktøropplasting), Sentry-region, produksjonsdata |
| G3 Diplom | Endelig mal, lisensiert font, signaturregler | `generate-diploma.ts` bruker demomal `digital-v1`; byttes ved mottak |
| G4 Innholdsinventar | Modulliste med eiere/avhengigheter | `content/inventory.csv` og innholdsmigrering (Launch Task 5) kan ikke starte |
| G5 Produksjonsdrift | Produkteier, support, hendelsesrutine, RPO/RTO | Runbooks og restore-test (Launch Task 7–8) kan ikke ferdigstilles |

I tillegg gjelder: ingen SMS (bevisst), Idrettens ID utenfor V1 (bevisst).

## 7. Anbefalt implementeringsrekkefølge

Følger masterplanens rekkefølge, justert for det som alt finnes:

1. **Operations Task 1** — pace-plan + trafikklys (`pace_plans`-migrasjon, `recommendedProgress`, `classifyPace`). Ingen eksterne avhengigheter; låser opp lærerflaten.
2. **Operations Task 2 (rest)** — trafikklyskolonne/-filter og fristprioritet i eksisterende deltakerliste/kø; T1-kollaps i lærerflaten.
3. **Operations Task 4** — withdraw/reopen (liten, høy verdi, ferdigkriterium 3), deretter duplikat/merge/anonymisering.
4. **Operations Task 3** — outbox-worker, maler og planlagte påminnelser mot lokal Mailpit (kjører allerede i lokal Supabase); SMTP-adapteren pluggbar bak G2.
5. **Operations Task 5 → 6** — rapportdefinisjoner + 7 × PDF/Excel, deretter AI-søk oppå samme definisjoner.
6. **Operations Task 7** — admin driftsside (synliggjør bl.a. Ungdomsdriven-oppgavene som allerede skrives til `completion_admin_tasks`).
7. **Launch Task 1–4** — Checkin-import; krever G1 først. Meld behovet til NGF **nå**, siden fristen (4. sept 2026) er om tre dager.
8. **Launch Task 5–8** — innholdsfabrikk (G4), sikkerhets-/UU-/last-/restore-gater, UAT og RC.

---

*Rapporten er en ren analyse; ingen produktkode er endret. Neste steg besluttes av produkteier.*
