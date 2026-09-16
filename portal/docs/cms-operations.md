# CMS-drift

## 1. Tilgang og arbeidsflyt

Åpne `/editor/studio` for pensumbiblioteket. Velg et emne for `/editor/studio/:id`, der arbeidsflyten er **Bygg**, **Rediger** og **Publiser**. Globale administratorer og editorer kan arbeide på tvers av kurs. Kurslærere og kursansvarlige kan bare redigere innhold som er knyttet til kursene de har tilgang til. Supabase-auth og RLS håndhever samme avgrensning på serveren.

Lagring bruker atomisk compare-and-swap på kladdens `updatedAt`. Ved konflikt må brukeren laste inn på nytt eller ta vare på dokumentet før ny lagring. Publisering oppretter en ny versjon, rebinder valgte kurs atomisk og gjør publiserte versjoner uforanderlige. Historikk kan kopieres tilbake til en ny kladd.

## 2. Innhold, filer og eksport

Redigeringsfeltene dekker vanlige tekstblokker, lenker/kilder, presentasjon og kode-moduler (HTML, CSS og JavaScript). Presentasjonsvisningen har piltaster, fullskjerm og notater. Kode kjøres i en sandbox-iframe med `allow-scripts`; den har ikke nettverk eller tilgang til samme origin.

Originalvedlegg lastes opp direkte med signert URL, er private og kan være opptil 20 MB. Nedlasting kontrollerer brukerens tilgang og videresender til Storage med en signert lenke som varer i 60 sekunder, slik at store filer ikke sendes gjennom Vercels svargrense. Systemet utfører format-/metadata-kontroll, men filene blir ikke automatisk skannet for skadevare. Standalone HTML-eksport inkluderer tekst og kode-moduler. Eksterne medier og vedlegg krever fortsatt tilgang og nettverk, og er derfor ikke en komplett offline-kopi.

## 3. AI-tjenesten

Brukeren har valgt å starte uten API-nøkkel. Uten nøkkel åpner Studio i **Rediger**, **Bygg** viser kodeverktøy, og AI-panelet er skjult. Maler, vanlige felt, kode, vedlegg, publisering og undervisning fungerer uten AI. Ingen nøkkeloppretting eller aktivering avventer brukeren.

Ved eventuell senere aktivering kaller CMS OpenAI Responses API gjennom serverruten `/api/cms/ai`. `OPENAI_API_KEY` settes på serveren; `CMS_AI_MODEL` er valgfri og standard er `gpt-5.6-terra`. API-nøkkelen skal settes i sikker deploy-/miljøkonfigurasjon, aldri limes inn i chat eller commit.

AI-endepunktet krever innlogget CMS-tilgang, validerer emnet og begrenser forespørsler prosess-lokalt. Rate limit deles derfor ikke mellom flere instanser eller prosesser.

## 4. Lokal kjøring og migrering

Kjør fra `portal`:

```powershell
pnpm install --frozen-lockfile
pnpm dev --port 3300
pnpm typecheck
pnpm build
```

Ved databaseoppsett kjøres migreringene i filnavnrekkefølge. CMS Studio-migreringen `supabase/migrations/20261126090000_cms_studio.sql` er additiv og skal kjøres etter eksisterende innholds- og editor-migreringer. Bruk prosjektets etablerte Supabase-migreringskommando; ikke rediger allerede kjørte migreringer. Denne migreringen er kjørt på det tilkoblede Supabase-prosjektet `oodtupnybrareimlzwgd` 16. september 2026. Nummeret er lagt etter prosjektets eksisterende migreringshistorikk.

## 5. Kjente grenser og driftsstatus

Det finnes ingen sanntidssamarbeid mellom redaktører. Samtidige endringer stoppes av CAS-kontrollen. AI-avhengighet, prosess-lokal rate limit, manglende automatisk skadevareskanning og begrenset offline-eksport er forventede grenser i dagens løsning.

Arbeidet ligger på grenen `codex/trener-cms` i `.worktrees/cms-system`. Den eksisterende produksjonsportalen er nyere enn utgangspunktet til denne grenen. CMS leveres derfor som en egen Vercel-forhåndsvisning; produksjonsaliaset er ikke flyttet. Integrering i nyeste produksjonsgren er et eget arbeid før bred utrulling.

Typekontroll, ESLint og produksjonsbygg er bestått. Enhetstester: 32 filer / 153 tester bestått etter oppdatering av hjemsidens test; ytterligere test for forhåndsvisningens aktiveringsadresse bestått separat. Backendens isolerte SQL-sjekk dekker 15 forhold rundt tilgang og versjoner. Nettlesertest bekrefter oppretting → feltredigering → lagring → publisering → pensum/undervisning, inkludert fungerende trinnknapper og mobilbredde 390 px uten horisontal overflyt. En API-test bekrefter signert filopplasting, identiske originalbytes ved nedlasting, avvist anonym tilgang, 409 ved gammel kladd og eksplisitt kursoppgradering.

Et tydelig merket eksempel er opprettet: «Planlegg for utvikling · eksempel», publisert som v2 til demokurset Trener 2 · 2026, med et fiktivt PDF-vedlegg fra «Demoforeleser». Det ligger en ny kladd v3 klar.

AI-koden er ferdig og har automatiserte tester, men ingen ekte modellforespørsel er verifisert. AI er utsatt etter brukerens valg. Ingen nøkkel er opprettet, eksponert eller lagt inn på deres vegne.

Publisert forhåndsvisning (READY): https://trenerloftet-demo-kb3a9725j-sivert-s-projects.vercel.app. Deployment-ID: `dpl_2ykR8oaJW2Per6TP1jaqD7VmG8KM`, kildecommit `11bec3b`. Vercel-innlogging gir varig tilgang; en midlertidig testlenke er gitt direkte til brukeren og lagres ikke i repoet. Produksjonsbygg på Vercel er bestått. Endringen for oppstart uten AI-nøkkel har bestått typekontroll og målrettet ESLint. Signert nedlasting har 11 beståtte backendtester samt en virkelig autorisert PDF-nedlasting.

Vercel-forhåndsvisningen bruker eksisterende demokontoer og database. Behold Vercel-tilgangsbeskyttelsen mens `DEMO_MODE=true`; demoens rollebytte gir skrivetilgang. Før bruk med faktiske kursdata skal demomodus slås av og administratorer bruke personlige, tildelte kontoer via `/login`.
