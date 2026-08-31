# Learning/CMS-gate

**Resultat:** PASS

**Testet commit:** `b66a03b8d45c9f4598639a34656172cd00d00b42`

**Gren:** `codex/portal-v1`

**Kjørt:** 31. august 2026, Europe/Oslo
**Kontrollør:** Codex, separat sluttkontroll etter implementeringspasset

## Bevist vertikal reise

Den syntetiske Trener 3-demobrukeren Selma Dahl gjennomførte følgende i én Playwright-test mot en nyopprettet lokal database:

1. Administrator/redaktør lagret kladd og publiserte innholdsrevisjon 2 med endringsnotatet `Vertikal kvalitetsport`.
2. Student åpnet publisert «Ballfluktslover og balltreff», så tillatt TrackMan-video og bestod fem spørsmål.
3. Student leverte dokument, fikk krav om utbedring, leverte versjon 2 og fikk godkjenning.
4. Student registrerte og sendte inn 45 praksistimer; kursleder godkjente praksisen.
5. Kursleder registrerte alle seks samlinger; administrator kontrollerte universitetskravet; systemet fullførte innmeldingen og opprettet nøyaktig ett diplom.

Databevis etter reisen:

- `enrollments.status = completed`
- 6 oppmøterader
- 1 sertifikat med nummer `NGF-2026-3A58D7561F`
- 1 privat PDF på sertifikatets stabile lagringssti
- studentens «Mine diplomer» viste feiring og signert nedlastingslenke

## Kvalitetsport

| Kontroll | Resultat |
| --- | --- |
| `pnpm format:check` | PASS |
| `pnpm lint` | PASS, 0 feil |
| `pnpm typecheck` | PASS |
| `pnpm test:unit --run` | PASS, 23 filer / 77 tester |
| `pnpm test:integration --run` | PASS, 5 filer / 9 tester |
| `pnpm test:rls` | PASS, 7 filer / 165 tester |
| `pnpm supabase db lint --level warning` | PASS, 0 skjemaavvik |
| `pnpm build` | PASS, produksjonsbygg og alle dynamiske ruter generert |
| `pnpm playwright test tests/e2e/vertical-learning-slice.spec.ts` | PASS, 1 reise på 21,0 sekunder |
| Axe på sluttvisningen | PASS, 0 alvorlige/kritiske avvik |
| Visuell kontroll 1280 px | PASS |
| Visuell kontroll 390 px | PASS, ingen horisontal overflow |

Den vertikale testen krever en fersk lokal seed fordi quizforsøk, innleveringsversjoner, praksis og aktivitetsfullføringer med vilje er uforanderlige. Porten kjørte `pnpm supabase db reset` før integrasjonstestene og igjen før Playwright-reisen.

## Seed og avgrensning

- Kontrollert innholdsrevisjon: `a2100000-0000-0000-0000-000000000002`, revisjon 2.
- Kurset er den syntetiske Trener 3-demoen `b1030000-0000-0000-0000-000000000001`, fordi Trener 3 er første planlagte oppstart 3. februar 2027.
- Fagteksten i demoen er eksplisitt syntetisk/avgrenset og erstatter ikke ferdig NGF-pensum.

## Kjente lave avvik og eksterne porter

| Punkt | Alvorlighet | Eier | Frist/handling |
| --- | --- | --- | --- |
| Endelig NGF-diplommal, lisensiert font og signaturplassering er ikke levert; `digital-v1` brukes som funksjonell demomal. | Lav for demo, release-port for produksjon | NGF | Leveres i Gate G3 før produksjonssetting |
| Mobilmenyen er horisontalt rullbar og viser de viktigste handlingene først; desktop er anbefalt for lærer/admin. | Lav | Produkt | Vurderes etter pilotbruk |
| En uavhengig menneskelig design-/kodegjennomgang er ikke del av den lokale automatiske porten. | Lav | Prosjekteier | Gjennomføres før produksjonsrelease |

Ingen høye eller kritiske kode-, sikkerhets-, tilgjengelighets- eller dataavvik ble funnet i sluttkontrollen.
