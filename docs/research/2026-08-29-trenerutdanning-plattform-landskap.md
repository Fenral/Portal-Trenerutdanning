# Researchnotat: digital plattform for norsk golftrenerutdanning

**Status:** 29. august 2026  
**Formål:** Beslutningsgrunnlag før konsept-, innholds- og teknologivalg  
**Kildestandard:** Offentlige myndigheter, standardeiere og leverandørenes egne produkt-/designdokumenter. Produktpåstander fra leverandører er fakta om dokumentert funksjonalitet, ikke en uavhengig kvalitetsvurdering.

## Kort konklusjon

Dette er ikke primært et «CMS-prosjekt». Det er et **trenerutdanningsprodukt** som minst trenger en LMS-kjerne for kurs, progresjon, vurdering, roller og dokumentasjon, samt gode verktøy for strukturert innholdsproduksjon. En CMS-del kan ligge i LMS-et eller være separat. «Portal» er et godt navn på det brukerne møter; **LMS** er den mest presise betegnelsen på kjernesystemet.

Det viktigste funnet i norsk kontekst er at Norges idrettsforbund allerede har identitet, roller, kursadministrasjon og kompetansedata. [Idrettens ID gir én bruker på tvers av idrettens tjenester og kan brukes av godkjente tredjepartsleverandører](https://www.idrettsforbundet.no/en/digital/idrettens-id/brukerveiledning/hva-er-idrettens-id/), mens [Idrettskurs styrer tilgang etter funksjoner/roller](https://www.idrettsforbundet.no/digital/idrettskurs/sporsmal-og-svar/hvem-har-tilgang-til-idrettskurs/) og [NIFs 2026-prioritering er at kurs- og kompetanseaktiviteter skal integreres med idrettens sentrale database](https://www.idrettsforbundet.no/siteassets/idrettsforbundet/spillemiddelsoknad/spillemiddelsoknad-2026/31_25_nif_spillemiddelsoknad-2026.pdf). Integrasjonsavklaringen med NIF må derfor komme før valg av leverandør eller arkitektur.

**Anbefaling/inferens:** Undersøk først en konfigurert eller forvaltet LMS-løsning og en hybrid med et tynt, merkevaretilpasset portalsjikt. Hold en full spesialutvikling som sammenligningsalternativ, ikke som utgangspunkt. Test alternativene på én komplett «vertikal skive»: en reell Trener 1-modul fra redigering og undervisning til praksisoppfølging, vurdering og kompetanseregistrering.

---

## 1. Begreper: CMS, LMS, LXP og portal

| Begrep | Fakta | Anbefalt bruk i prosjektet |
|---|---|---|
| **CMS – Content Management System** | Et CMS organiserer og publiserer strukturert nettinnhold. Drupal dokumenterer for eksempel innholdstyper, felt, taksonomier, redaksjonell arbeidsflyt, oversettelse og roller som sentrale CMS-begreper i sin [offisielle brukerveiledning](https://www.drupal.org/docs/user_guide/en/index.html). | Bruk om redaksjonsverktøyet for pensum, ressurser, maler og eventuelt presentasjonsgrunnlag. Et generelt CMS mangler normalt den komplette læringsadministrasjonen prosjektet beskriver. |
| **LMS – Learning Management System** | 1EdTech definerer LMS som programvare for administrasjon, dokumentasjon, sporing, rapportering og levering av kurs og opplæring; vanlig bruk er å distribuere og spore digital læring ([1EdTechs offisielle ordliste](https://www.1edtech.org/sites/default/files/media/docs/2024/TrustEd%20Apps%20Readiness.pdf)). | Bruk om kjernen som håndterer deltakere, undervisere, påmelding, læringsløp, oppgaver, vurderinger, praksis, progresjon, fullføring og rapporter. |
| **LXP – Learning Experience Platform** | Begrepet brukes i leverandørmarkedet om et lærersentrert lag med oppdagelse, personalisering, anbefalinger og innhold fra flere kilder; se leverandøren Valamis' [produktnære definisjon](https://www.valamis.com/hub/learning-experience-platform). Det finnes ikke en tilsvarende entydig, normativ standarddefinisjon i kildene gjennomgått her. | Ikke gjør «LXP» til et krav nå. Oversett heller behovet til testbare egenskaper som søk, anbefalinger, selvvalgt etterutdanning og personlige læringsløp. |
| **Portal** | Et brukerrettet produktnavn, ikke en bestemt systemkategori. | Kall helheten **Trenerutdanningsportalen** eller **Trenerportalen**. Under panseret kan den bestå av LMS, CMS, video, identitet og integrasjoner. |

**Viktig språkfelle:** I Open edX betyr «CMS» deres kursforfatterverktøy Studio, mens LMS-et leverer innholdet til deltakeren ([Open edX' arkitekturdokumentasjon](https://docs.openedx.org/projects/edx-platform/en/latest/references/docs/README.html)). Be derfor alltid leverandører beskrive funksjoner og dataflyt, ikke bare krysse av for forkortelser.

**Anbefalt prosjektterminologi:**

- **Portal:** hele tjenesten slik student og lærer opplever den.
- **Læringsplattform/LMS:** systemet for gjennomføring, oppfølging og dokumentasjon.
- **Innholdsplattform/CMS:** redigering, versjonering, gjenbruk og publisering av pensum og lærerressurser.
- **Modul:** en avgrenset del med kompetansemål, læringsaktiviteter, praksis og vurdering.
- **Læringsløp:** kombinasjonen av digital læring, undervisning, praksis, veiledning og godkjenning.

---

## 2. Premisser som må avklares i norsk idrett

### Fakta

NIFs Trener 1 er allerede definert som et læringsløp, ikke bare en samling nettsider. Det omfatter minimum 45 timer undervisning og 45 timer praksis; både undervisning og praksis må bestås for å gå videre, deltakeren må ha minst 80 prosent oppmøte, og e-læring kan inngå ([NIFs offisielle Trener 1-beskrivelse](https://www.idrettsforbundet.no/nif/trenerloypa/trener1/)). Deltakeren må normalt fylle minst 16 år det året kurset starter, så portalen kan behandle personopplysninger om mindreårige ([samme NIF-kilde](https://www.idrettsforbundet.no/nif/trenerloypa/trener1/)).

[Idrettens ID](https://www.idrettsforbundet.no/en/digital/idrettens-id/brukerveiledning/hva-er-idrettens-id/) er felles innlogging til blant annet Min idrett, SportsAdmin, KlubbAdmin og Idrettskurs. [Tilgang i Idrettskurs styres av funksjoner i idretten](https://www.idrettsforbundet.no/digital/idrettskurs/sporsmal-og-svar/hvem-har-tilgang-til-idrettskurs/), og [kompetanser kan rapporteres på person og organisasjonsledd](https://www.idrettsforbundet.no/digital/idrettskurs/brukerveiledninger/rapport/). NIF opplyser også at bruk av deres eksterne API-er forutsetter avtale ([NIFs API-informasjon](https://www.idrettsforbundet.no/digital/samarbeidspartner/api-medlem/)).

### Anbefaling/inferens

Portalen bør ikke uten videre opprette en parallell identitet, rollemodell eller «offisiell sannhet» om trenerkompetanse. Første arkitekturspørsmål er hvilke data NIF skal eie, hvilke NGF skal eie, og hvilken retning data skal flyte. En praktisk målmodell kan være:

| Domene | Mulig systemeier – må verifiseres | Portalens mulige ansvar |
|---|---|---|
| Identitet og grunndata | Idrettens ID / NIF | Innlogging, sesjon og minst mulig lokal kopiering |
| Påmelding, betaling og formell kursforekomst | Min idrett / Idrettskurs | Vise status og sende brukeren til riktig handling |
| Pensum, aktiviteter og studentarbeid | Ny læringsplattform | Levere læring, lagre progresjon og arbeidskrav |
| Praksis, veiledning og vurdering | Ny plattform, eventuelt synkronisert | Arbeidsflyt, dokumentasjon, tilbakemelding og godkjenning |
| Formell kompetanse / idretts-CV | NIF, hvis avtalt | Sende godkjent sluttresultat og beholde revisjonsspor |

Dette er en arbeidshypotese, ikke en bekreftet NIF-arkitektur.

---

## 3. Hvilke egenskaper produktet faktisk trenger

**Anbefaling/inferens:** Bruk dette som et første kapabilitetskart. Hvert punkt må valideres med studenter, lærere, fagansvarlige og administratorer.

| Område | Minimum for første versjon | Senere muligheter |
|---|---|---|
| Læringsløp | Trener 1–3, moduler, kompetansemål, rekkefølge, forkunnskapskrav, datoer og status | Personlig etterutdanning, anbefalinger og alternative løp |
| Innhold | Strukturert nettpensum, video, filer, H5P, søk, versjon og eier | Gjenbruk av samme innholdsblokker på tvers av nivåer og målgrupper |
| Aktiv læring | Refleksjon, quiz, case, planlegging av økt og innlevering | Simuleringer, videoanalyse, fagfellevurdering og adaptiv repetisjon |
| Oppfølging | Læreroversikt, meldinger, frister, feedback og enkel varsling | Risikosignaler, mentoroppfølging og kohortanalyse |
| Praksis og godkjenning | Praksislogg, veileder, observasjon, vurderingskriterier, oppmøte og sluttgodkjenning | Kompetanseportefølje og resertifisering |

### Pensum og undervisningspresentasjoner

**Anbefaling/inferens:** Unngå å vedlikeholde pensum og PowerPoint som to uavhengige sannheter. Definer en felles, strukturert innholdsmodell med for eksempel kompetansemål, fagtekst, illustrasjon, case, treneraktivitet, refleksjonsspørsmål, kilder og lærernotat. Studentvisning og undervisningsopplegg kan deretter settes sammen fra de samme faglige byggeklossene. Presentasjonen kan fortsatt eksporteres eller leveres som lærervisning, men den bør ha egen pedagogisk rytme og ikke bare speile alle avsnitt.

Denne modellen reduserer sannsynligheten for sprik mellom pensum og undervisning, men krever tydelig innholdseierskap, versjonering og en publiseringsflyt med faglig og språklig kvalitetssikring.

---

## 4. Realistiske bygg-, kjøp- og hybridalternativer

### Alternativ A – kjøp et konfigurert SaaS-LMS

Eksempler er Canvas eller en annen moden, driftet LMS-tjeneste. Canvas dokumenterer blant annet oppgaver og kontekstuell feedback, progresjonsvisning, sentralt distribuerte «Blueprint courses», grupper/roller, mobilapper og mer enn 1 000 integrasjoner på sin [offisielle produktside](https://www.instructure.com/canvas). Canvas' «Mastery Paths» kan frigi forskjellig innhold basert på resultatet fra en tidligere oppgave ([offisiell veiledning](https://community.canvaslms.com/t5/Instructor-Guide/How-do-I-use-Mastery-Paths-in-course-modules/ta-p/906)).

**Anbefaling/inferens:** Raskest vei til robust standardfunksjonalitet og lavest lokalt driftsansvar. Risikoen er at arbeidsflyt for praksis, NIF-integrasjon, norsk terminologi og merkevare enten blir kompromisser eller kostbare tilpasninger. Be om en scenario-demo med ekte arbeidsflyt, ikke en generell produktpresentasjon.

### Alternativ B – forvaltet Moodle LMS eller Moodle Workplace

Moodle LMS er åpen kildekode og dokumenterer aktiviteter, varsler, mobil/offlinebruk, rapporter, integrasjoner, personvernverktøy og tilpasning ([Moodle LMS](https://moodle.com/lms/)). Moodle har også kompetanser og personlige læringsplaner ([Moodle-dokumentasjon](https://docs.moodle.org/502/en/Learning_plans)). Moodle oppgir tre driftsveier: egen drift, MoodleCloud og sertifisert partner ([offisiell oversikt](https://support.moodle.com/support/solutions/articles/80001075420)). Workplace-varianten dokumenterer flere separate læringsmiljøer i samme installasjon, med egne brukere, administratorer, profil og delt innhold ([Moodle Workplace om multi-tenancy](https://moodle.com/news/moodle-workplace-4-multi-tenancy/)).

**Anbefaling/inferens:** En sterk kandidat når kravene er formell læring, H5P, kompetanse, fleksible roller og kontroll over data, og når en forvaltningspartner kan ta ansvar for oppgraderinger og sikkerhet. Risikoen er at omfattende konfigurering og plugins skaper kompleksitet; en tydelig «standard først»-policy er nødvendig.

### Alternativ C – forvaltet Open edX

Open edX dokumenterer selvstyrte og instruktørledede kurs, læringsløp, gjenbrukbare innholdssekvenser, vurderinger, diskusjoner, analyse, SSO og kontroll over drift/data ([offisiell funksjonsoversikt](https://openedx.org/platform/features/)). Plattformen kan driftes selv, fullt forvaltet hos en partner eller som standardisert SaaS ([offisielle driftsalternativer](https://openedx.org/faq/what-are-the-open-edx-platform-deployment-options/)). Open edX advarer samtidig om at produksjonsdrift ikke er enkel og anbefaler tjenesteleverandør for organisasjoner uten riktig kapasitet ([plattformdokumentasjonen](https://docs.openedx.org/projects/edx-platform/en/latest/references/docs/README.html)).

**Anbefaling/inferens:** Mest relevant dersom ambisjonen er et stort, innholdstungt og eventuelt offentlig tilgjengelig akademi med stor kontroll og skala. Kan være tyngre enn nødvendig for en avgrenset norsk trenerutdanning.

### Alternativ D – hybrid: LMS-kjerne med eget portalsjikt/CMS

Et modent LMS beholder påmelding, progresjon, vurdering og kursdata, mens et merkevaretilpasset portalsjikt gir samlet inngang, søk, ressurser og redaksjonelt innhold. Standardintegrasjon kan redusere spesialkoblinger: [LTI 1.3 kobler eksterne læringsverktøy sikkert til en læringsplattform](https://www.1edtech.org/standards/lti), og H5P kan brukes gjennom plugin, LTI eller innebygging ([H5Ps integrasjonsoversikt](https://h5p.org/integrations)).

**Anbefaling/inferens:** Gir større kontroll over studentopplevelsen og bedre gjenbruk av åpne fagressurser, samtidig som man unngår å bygge en egen LMS-motor. Risikoen er dobbel redaksjonsflate, sømmer mellom systemene og uklar systemeier. Krev ett innloggingsforløp, tydelig dataeierskap og færrest mulig steder å redigere samme innhold.

### Alternativ E – full spesialutvikling

Portalen, innholdsmodellen, arbeidsflytene og integrasjonene utvikles som ett eget produkt.

**Anbefaling/inferens:** Kan være riktig dersom praksisoppfølging, golffaglig arbeidsflyt og NIF-samspill utgjør en varig, strategisk unik fordel som standardprodukter ikke kan dekke. Dette gir høyest kontroll, men også fullt ansvar for sikkerhet, tilgjengelighet, vurderingslogikk, rapporter, drift og kontinuerlig produktutvikling. Ikke velg dette før en prototype har dokumentert hvilke kritiske behov standardløsningene faktisk ikke kan løse.

---

## 5. Standarder og integrasjoner

| Standard/integrasjon | Fakta | Anbefaling/inferens for prosjektet |
|---|---|---|
| **H5P** | H5P tilbyr blant annet interaktiv video, kurspresentasjon og forgrenede scenarioer, og kan integreres i WordPress, Moodle og Drupal eller via LTI i LMS-er som Canvas ([offisielle eksempler](https://h5p.org/content-types-and-applications?field_category_tid=All)). Tilgjengelighet varierer per innholdstype; H5P publiserer en [oppdatert oversikt mot WCAG 2.2 AA med kjente unntak](https://help.h5p.com/hc/en-us/articles/7505649072797-Content-types-recommendations). | God kandidat for lavterskel interaktivitet og formative aktiviteter. Bruk en godkjent, liten katalog av testede innholdstyper. Moodle anbefaler sin ordinære quiz fremfor H5P til summativ/høyrisikovurdering ([Moodle H5P-dokumentasjon](https://docs.moodle.org/502/en/h5p/overview)). |
| **LTI 1.3 / LTI Advantage** | LTI er en standard, ikke et produkt, for å koble læringsverktøy til LMS uten separat innlogging. LTI 1.3 bruker OAuth 2 og JSON Web Tokens; Advantage-tjenestene omfatter karakteroverføring, navn/roller og valg av eksternt innhold ([1EdTech](https://www.1edtech.org/standards/lti)). | Sett LTI 1.3/Advantage som ønsket krav når eksterne læringsverktøy skal kobles inn. Krev sertifisering eller test interoperabiliteten i anskaffelsen. |
| **xAPI + LRS** | xAPI beskriver hvordan erfaringer på tvers av systemer kan uttrykkes og utveksles; målet er interoperabilitet for læringsdata fra formelle og uformelle, digitale og ikke-digitale sammenhenger ([ADLs spesifikasjon](https://github.com/adlnet/xAPI-Spec/blob/master/xAPI-About.md)). Kjerneobjektet er et strukturert «statement» med blant annet aktør, verb, objekt, resultat og kontekst ([xAPI-datamodellen](https://github.com/adlnet/xAPI-Spec/blob/master/xAPI-Data.md)). Den gjeldende kjernestandarden er publisert som [ISO/IEC/IEEE 39274-1-1:2025 hos IEEE](https://standards.ieee.org/ieee/39274-1-1/12268/). | Relevant senere dersom praksis på golfbanen, videoanalyse, webinarer og flere systemer skal inngå i ett læringsbilde. Ikke innfør LRS før konkrete analysesvar og dataminimering er definert. |
| **SCORM** | SCORM 2004 standardiserer blant annet pakking, kommunikasjon med LMS og sekvensering av e-læringsinnhold ([ADLs offisielle SCORM-veiledning](https://adlnet.gov/assets/uploads/SCORM_Users_Guide_for_ISDs.pdf)). | Krev SCORM-import/-avspilling bare hvis eksisterende kurs eller kjøpte pakker må gjenbrukes. Ikke bruk SCORM som selve innholdsarkitekturen for nytt, levende pensum; det gir ofte lukkede pakker og svak redaksjonell gjenbruk. |
| **Identitet og NIF-data** | Idrettens ID kan brukes av godkjente leverandører, og NIF tilbyr API-er og sikre koblinger til eksterne systemer ([Idrettens ID](https://www.idrettsforbundet.no/en/digital/idrettens-id/brukerveiledning/hva-er-idrettens-id/) og [NIFs integrasjonsoversikt](https://www.idrettsforbundet.no/digital/nyheter/integrasjon-med-idrettens-digitale-tjenester/)). | Gjør Idrettens ID, Idrettskurs, roller, påmelding, betaling og kompetanseskriving til en egen avklaringsstrøm med NIF. Ikke anta at dokumenterte medlems-API-er automatisk dekker kursbehovet. |

---

## 6. Designsystem, universell utforming og personvern

### Designsystem

Digdirs **Designsystemet** er en gratis, åpen verktøykasse med grunnkomponenter, retningslinjer og mønstre. Den har temastøtte for ulike visuelle identiteter og leverer komponenter for Figma, CSS, web components og React ([offisiell introduksjon](https://designsystemet.no/no/)). Digdir beskriver tilgjengelighet som en del av hele komponentprosessen, men understreker at tilgjengelige komponenter bare er én del av en tilgjengelig tjeneste ([tilgjengelighetsdokumentasjonen](https://designsystemet.no/no/fundamentals/introduction/accessibility)).

**Anbefaling/inferens:** Bruk Designsystemet som en vurdert grunnmur, ikke som ferdig NGF-design. Etabler først NGFs design-tokens for farge, typografi, avstand, radius og bevegelse; legg så til noen få læringsspesifikke mønstre: modulkort, progresjon, kompetansemål, læringsaktivitet, praksislogg og vurderingsrubrikk. Avklar NGFs gjeldende merkevare- og profilmateriale før visuell retning låses.

Prioriter en mobil, rolig og tekststerk opplevelse. Treneren vil ofte bruke ressursene nær praksisfeltet, mens læreren trenger tettere informasjonsvisninger for oppfølging. Dette er en designhypotese som bør testes i kontekst.

### Universell utforming

Den norske IKT-forskriften gjelder nettløsninger, inkludert digitale læremidler, som er hovedløsninger rettet mot brukere ([Lovdata, forskriftens § 2](https://lovdata.no/nav/forskrift/2013-06-21-732)). Kravnivået avhenger av virksomhetens rettslige kategori: private virksomheters nettløsninger skal minst oppfylle 35 suksesskriterier i WCAG 2.0, mens offentlige virksomheter følger kravene i EN 301 549/WCAG 2.1 ([Uu-tilsynets regelverksoversikt](https://www.uutilsynet.no/regelverk/kva-seier-forskrifta/153)). Offentlig sektor skal totalt følge 48 av 78 WCAG 2.1-kriterier og ha tilgjengelighetserklæring ([Uu-tilsynet om WAD](https://www.uutilsynet.no/webdirektivet-wad/eus-webdirektiv-wad/265)).

**Anbefaling/inferens:** Avklar med juridisk/anskaffelsesfaglig kompetanse hvilken kategori NGF og den konkrete tjenesten faller i. Uavhengig av minimumskrav bør prosjektets produktmål være **WCAG 2.2 AA for nye grensesnitt og innhold**, med testkrav for tastatur, skjermleser, zoom/reflow, kontrast, teksting/transkripsjon, kognitiv tydelighet og redusert bevegelse. Dette er et fremtidsrettet kvalitetsmål, ikke en påstand om gjeldende norsk minimumskrav.

Presentasjoner, dokumenter og tredjepartsinnhold må inngå i samme kvalitetsarbeid. Uu-tilsynet viser at tilgjengelige PDF-er avhenger av et tilgjengelig strukturert originaldokument, og at dokumentkravene bygger på WCAG/EN 301 549 ([offisiell dokumentveileder](https://www.uutilsynet.no/veiledning/rettleiar-universelt-utforma-word-og-pdf-dokument/1636)).

### Personvern og informasjonssikkerhet

Datatilsynet lister blant virksomhetens plikter: tydelig formål og behandlingsgrunnlag, protokoll, informasjon og åpenhet, retting/sletting, sikkerhet, databehandleravtaler, vurdering av personvernkonsekvenser, innebygd personvern og vurdering av overføring ut av EØS ([Datatilsynets pliktoversikt](https://www.datatilsynet.no/rettigheter-og-plikter/virksomhetenes-plikter/)). Bruk av skytjeneste krever risikovurdering og vurdering av personvernkonsekvenser, og kunden beholder ansvar for blant annet konto- og tilgangsstyring ([Datatilsynet om skytjenester](https://www.datatilsynet.no/personvern-pa-ulike-omrader/internett-og-apper/skytjenester/) og [informasjonssikkerhet i skytjenester](https://www.datatilsynet.no/personvern-pa-ulike-omrader/skole-barn-unge/bruk-av-google-chromebook-og-g-suite-for-education-og-andre-skytjenester-i-grunnskolen/informasjonssikkerhet/)). En databehandlerrelasjon krever skriftlig databehandleravtale ([Datatilsynet](https://www.datatilsynet.no/rettigheter-og-plikter/virksomhetenes-plikter/behandlingsansvarlig-og-databehandler/konsekvensene-av-om-det-foreligger-et-databehandleroppdrag-eller-ikke/)).

Noen Trener 1-deltakere kan være 16–17 år. Datatilsynet fremhever at barn og unge krever særlig beskyttelse, forståelig informasjon og ekstra varsomhet i hvilke data som samles inn og deles ([Datatilsynets veiledning](https://www.datatilsynet.no/personvern-pa-ulike-omrader/kundehandtering-handel-og-medlemskap/digitale-tjenester-og-forbrukeres-personopplysninger/barn-og-unge-forbrukere/)). Datatilsynet fraråder sterkt sporingsverktøy som deler data med tredjeparter når tjenesten retter seg mot barn ([veiledning om sporing](https://www.datatilsynet.no/personvern-pa-ulike-omrader/internett-og-apper/bruk-av-sporingsverktoy-pa-nettsteder-og-i-apper/?print=true)).

**Anbefaling/inferens:** Gjør dataminimering til produktkrav. Skill nødvendig dokumentasjon av utdanning fra produktanalyse. Ikke samle fritekst, video, helsedata eller detaljert aktivitetsdata «for sikkerhets skyld». Definer sletting, eksport, innsyn, tilgang per rolle, revisjonsspor og hendelseshåndtering før pilot.

---

## 7. Referansegalleri: nøyaktig 10 læringsportaler og akademier

Dette er en kuratert referanseliste, ikke en objektiv rangering. «Skiller seg ut» nedenfor er dokumentert i produktets offisielle kilder. «Overførbart» og «felle» er analyse/inferens for norsk golftrenerutdanning.

| # | Portal / offisiell lenke | Dokumentert særpreg | Overførbart mønster – inferens | Felle/begrensning |
|---:|---|---|---|---|
| 1 | [FIFA Training Centre](https://inside.fifa.com/talent-development/fifa-training-centre) | FIFA tilbyr trenere på ulike nivåer og for ulike aldersgrupper treningsøkter, analyser og video. FIFAs egen beskrivelse av tjenesten viser også seksjonene Practice, The Game og Environment og en filtrerbar «Game Library» med kampklipp ([FIFA](https://inside.fifa.com/de/talent-development/fifa-training-centre/news/trainieren-wie-ein-profi-mit-dem-fifa-ausbildungszentrum-assgenauigkeit)). | Lag en golføvelsesbank der hvert kort har mål, nivå/alder, video, oppsett, progresjon/regresjon og sikkerhet. Koble pensum direkte til autentiske situasjoner og ekspertanalyse. | Ressursbibliotek og formell utdanningsadministrasjon er ulike jobber. Ikke anta at FIFAs innholdsmodell alene dekker påmelding, praksis og godkjenning. |
| 2 | [World Rugby Passport](https://passport.world.rugby/) | Gratis flerspråklige moduler er sortert etter roller og faglige «strands»; noen er obligatoriske før fysiske kurs, og fullføring gir sertifikat. World Rugby dokumenterer konkrete obligatoriske nettforkrav per trenernivå i sin [blended course-struktur](https://passport.world.rugby/coaching/face-to-face-courses-and-accreditations/). | Gjør e-læring til tydelige forkunnskapsporter før samling, og vis hva som er obligatorisk versus anbefalt. La rollen – student, trener, lærer, veileder – styre inngangen. | Mange obligatoriske forkurs kan bli en avkrysningsøvelse. Test om nettdelen faktisk forbedrer den praktiske samlingen. |
| 3 | [ITF Academy](https://www.itf-academy.com/?academy=103&language=en) | ITF skiller mellom **Education** med korte kurs og **Library** med videoer, artikler og forskningsartikler, og lar brukeren finne stoff etter rolle og interesse. ITF knytter trenernivåer til beskrevne kjernekompetanser og minimum kontakttid ([ITFs trenerutdanning](https://www.itftennis.com/en/news-and-media/articles/itf-coach-education-programme-educating-and-certifying-coaches/)). | Skill den formelle Trenerløypa fra et varig trenerbibliotek, men bruk samme taksonomi. Vis kompetanser og omfang tydelig på hvert nivå. | Et stort bibliotek blir raskt uoversiktlig uten redaksjonelt eierskap, arkivering og gode metadata. |
| 4 | [Salesforce Trailhead](https://trailhead.salesforce.com/) | Trailhead kombinerer korte moduler, veiledede «Trails», praktiske prosjekter, egendefinerte «Trailmixes» og Superbadges der kunnskap anvendes på realistiske problemer ([offisiell Trailhead-veiledning](https://trailhead.salesforce.com/en/content/learn/modules/salesforce-skills-and-experience-building/complete-trailhead-badges-to-build-skills)). | Bygg rytmen **kort teori → prøv i praksis → dokumenter → få feedback → vis kompetanse**. La NGF kuratere anbefalte løp og senere la trenere lage egne ressurssamlinger. | Poeng og merker kan flytte oppmerksomhet fra refleksjon og kvalitet til mengde. Belønn dokumentert anvendelse, ikke bare klikk/fullføring. |
| 5 | [Duolingo](https://www.duolingo.com/) | Duolingos offisielle designbeskrivelse forklarer en trinnvis læringssti der stoff blandes, deles i mindre enheter og repeteres med innebygd øving basert på «spaced repetition» ([Duolingo Design/Blog](https://blog.duolingo.com/new-duolingo-home-screen-design/)). | Gjør «fortsett der du slapp» og neste anbefalte aktivitet ekstremt tydelig. Planlegg gjensyn med nøkkeltema som sikkerhet, trenerrollen og pedagogikk etter at de først er lært. | En lineær sti kan bli for rigid for erfarne trenere og etterutdanning. Tilby diagnostikk, oversikt og godkjente snarveier. |
| 6 | [Khan Academy](https://www.khanacademy.org/) | Mastery-systemet viser progresjon fra Familiar til Proficient og Mastered per ferdighet og for hele kurs; nivået kan også gå ned ved senere feil ([Khan Academy Help Center](https://support.khanacademy.org/hc/en-us/articles/115002552631-What-are-Course-and-Unit-Mastery)). Personlige Mastery Challenges velger tidligere ferdigheter ut fra tid siden sist og mestringsnivå ([offisiell veiledning](https://support.khanacademy.org/hc/en-us/articles/360037127892-What-are-Mastery-Challenges-in-course-mastery)). | Vis kompetanse, ikke bare prosent fullført. La viktige kompetanser bekreftes flere ganger gjennom case, praksis og observasjon. | Automatisk quizmestring er ikke det samme som trenerkompetanse. Praktiske og relasjonelle ferdigheter krever observasjon og faglig vurdering. |
| 7 | [Brilliant](https://brilliant.org/) | Brilliant organiserer relaterte kurs i stigende vanskelighetsgrad og kombinerer forklaring, interaktive oppgaver og faste praksissjekker ([offisiell beskrivelse av Learning Paths](https://brilliant.org/help/features/what-are-learning-paths/)). Brilliant opplyser samtidig at de ikke utsteder kursbevis, studiepoeng eller grader ([offisiell kursoversikt](https://brilliant.org/help/courses-and-curriculum/)). | La studenten ta et valg, analysere et slag/treningsscenario eller manipulere en enkel modell før forklaringen kommer. Bruk korte forståelsessjekker inne i fagstoffet. | Visuell interaktivitet kan bli dyrt og dekorativt. Bruk den bare når den gjør en faglig beslutning eller årsakssammenheng tydeligere. |
| 8 | [HubSpot Academy](https://academy.hubspot.com/?language=english) | Academy viser en åpen katalog fra korte, praktiske kurs til sertifiseringer, med synlig tema, format og tidsbruk. Læringsstier setter sammen sertifiseringer, kurs og leksjoner for roller eller mål ([HubSpot Learning Paths](https://academy.hubspot.com/learning-paths-2)). | Gi hvert kurskort fast metadata: hvem det er for, hva treneren kan etterpå, nivå, format, varighet, forkunnskaper og godkjenning. La åpent innhold demonstrere verdi før innlogging. | Akademiet støtter også leverandørens produktøkosystem. NGF må skille nøytral fagkunnskap fra verktøy-, sponsor- eller leverandørinnhold. |
| 9 | [OpenLearn](https://www.open.edu/openlearn/) | Open University tilbyr gratis innhold fra korte formater til kurs, tre tydelige nivåer, estimert studietid, progresjon og statements/badges; innhold kan leses uten konto, mens konto gir sporing og dokumentasjon ([OpenLearn FAQ](https://www.open.edu/openlearn/about-openlearn/frequently-asked-questions-on-openlearn) og [kursforklaring](https://www.open.edu/openlearn/about-openlearn/try?page=1)). | La åpne fagressurser kunne forhåndsvises uten innlogging, og be om konto først når brukeren trenger lagring, oppgave, feedback eller formell dokumentasjon. | OpenLearn opplyser at en statement blant annet krever at alle sider er lest og quizene sendt inn. Sidevisning er et svakt kompetansebevis; NGF bør skille deltakelse fra bestått kompetanse. |
| 10 | [Coursera](https://about.coursera.org/About/) | Coursera samler læring fra universiteter og selskaper i et hierarki fra praktiske prosjekter og kurs til profesjonssertifikater og grader. Professional Certificates kombinerer fleksibel progresjon, karriererettet innhold og delbare arbeidsprøver gjennom praktiske prosjekter ([offisiell sertifikatoversikt](https://www.coursera.org/professional-certificates)). | Gjør NGF og fagpersonens avsenderansvar synlig. La små moduler kunne stables til etterutdanning og nivåer, og la sluttproduktet være en anvendbar trenerplan/portefølje. | Markedsplasslogikk, abonnement og et stort kataloghierarki er unødvendig i en liten, styrt trenerløype. Kopier informasjonsmønstrene, ikke bredden. |

### Samlet læringspunkt fra de 10

**Anbefaling/inferens:** Den sterkeste kombinasjonen for norsk golf er ikke å kopiere én portal. Den er å kombinere FIFAs praksisnære ressurskort, World Rugbys tydelige blended-porter, ITFs skille mellom formell utdanning og varig bibliotek, Trailheads anvendelsesoppgaver og Khan Academys kompetanseorienterte progresjon. Duolingo, Brilliant, HubSpot, OpenLearn og Coursera bidrar særlig med enkel neste handling, aktiv bearbeiding, god kursmetadata, lav terskel og stablebare løp.

---

## 8. Anbefalt research- og beslutningsrekkefølge

| Steg | Varighet | Avgrenset handling | Leveranse / beslutningsport |
|---:|---:|---|---|
| 1. Mandat og økosystem | 3–5 arbeidsdager | Avklar mål, suksessmål, budsjettintervall, intern kapasitet, juridisk eier, NIF-kontakter og dagens system-/dataflyt. | Signert problemramme og liste over bekreftede integrasjonsmuligheter. Ingen leverandørkortliste før dette. |
| 2. Bruker- og læringsresearch | 2 uker | Intervju/observer studenter, lærere, veiledere, fagredaktører og administratorer. Kartlegg hele reisen fra interesse og påmelding til praksis og godkjenning. | Prioriterte jobber, flaskehalser, roller og målbare lærings-/driftsutfall. |
| 3. Innholdsmodell og vertikal skive | 2 uker | Modellér kompetansemål, fagstoff, aktivitet, praksis, vurdering og lærernotat. Bygg en klikkbar/studenttestbar Trener 1-modul med reelt innhold. | Testet modulmal, informasjonsarkitektur og akseptansekriterier. |
| 4. Teknisk/kommersiell utprøving | 2–3 uker | La 2–3 realistiske alternativer gjennomføre samme scenario: Idrettens ID, påmelding, modul, H5P/case, innlevering, praksis, feedback, sluttgodkjenning og eksport/synk. Gjennomfør tilgjengelighets- og personverngjennomgang. | Sammenlignbar evidens, 5-års kostnadsbilde, gap og risiko. |
| 5. Beslutning og faseplan | 1 uke | Skår alternativene, avklar ansvarsmodell og planlegg pilot, innholdsmigrering, opplæring, forvaltning og måling. | Beslutningsnotat og pilotplan med stopp-/videreføringskriterier. |

Samlet beslutningsforløp er realistisk på **7–9 uker** dersom NIF-avklaringer og tilgang til brukere skjer parallelt. Innholdsproduksjon for hele Trenerløypa er et eget flerfaseløp og bør ikke vente på at all teknologi er ferdig valgt; den strukturerte modulmalen fra steg 3 kan brukes videre.

---

## 9. Kompakt beslutningsmatrise

Skala: 1 = svakt/ugunstig, 5 = sterkt/gunstig. **Tallene er foreløpige hypoteser**, ikke en leverandørvurdering. De skal erstattes med evidens fra samme scenario i steg 4.

| Alternativ | Fart til pilot | Læringsfunksjon fra start | Fleksibilitet for golf/NIF | Lav lokal driftsbyrde | Kontroll over opplevelse/data | Når det er mest realistisk |
|---|---:|---:|---:|---:|---:|---|
| A. SaaS-LMS | 5 | 5 | 2–3 | 5 | 2–3 | Standard arbeidsflyt dekker det meste; rask levering prioriteres |
| B. Forvaltet Moodle/Workplace | 4 | 5 | 4 | 4 | 4 | Formell/blended læring, H5P, roller og kompetanser står sentralt |
| C. Forvaltet Open edX | 3 | 5 | 4 | 3 | 4 | Stort innholdsakademi, åpne kurs eller skala er hovedambisjonen |
| D. LMS + eget portal/CMS | 3 | 5 | 5 | 3 | 5 | Merkevare, åpent bibliotek og særegen inngang er viktige nok til to lag |
| E. Full spesialutvikling | 1–2 | 1–2 | 5 | 1 | 5 | Unike arbeidsflyter er verifisert som strategiske og ingen standardkjerne dekker dem |

**Foreslått vekting til selve anskaffelsen – inferens:** pedagogisk og arbeidsflytmessig treff 25 %, NIF/identitet/data 20 %, tilgjengelighet/personvern/sikkerhet 20 %, redaksjonell modell og gjenbruk 15 %, femårig totalkostnad og leverandørrisiko 10 %, innføring og intern forvaltning 10 %.

---

## 10. Åpne spørsmål før valg av løsning

1. **Systemgrenser:** Skal NIF fortsatt eie påmelding, betaling, roller og formell kompetanse, og hvilke autentiserings-/kurs-API-er er faktisk tilgjengelige for NGF og leverandører?
2. **Pedagogisk modell:** Hvilke kompetanser må demonstreres i praksis, hvem kan godkjenne dem, hvilke forkunnskaper finnes mellom Trener 1–3, og hvordan skal etterutdanning/reautorisasjon virke?
3. **Målgrupper og volum:** Hvor mange aktive studenter, lærere, veiledere, klubber, kohorter og samtidige brukere forventes de neste fem årene, og hvor mye skal være åpent uten innlogging?
4. **Innhold og forvaltning:** Hvem eier hvert fagområde, hvilken godkjennings- og revisjonsflyt gjelder, hvilke eksisterende PDF-er, presentasjoner, videoer og e-læringer må migreres, og hvor ofte endres de?
5. **Rammer:** Hva er budsjett og lanseringsvindu, hvilken intern produkt-/fag-/teknologikapasitet finnes, hvilken rettslig tilgjengelighetskategori gjelder, og hvilke persondata kan dokumenteres som nødvendige?

**Neste beslutning:** Avtal et 60-minutters avklaringsmøte med NIF Digital om Idrettens ID, Idrettskurs, kompetansedata og tilgjengelige integrasjonsavtaler. Det er den korteste handlingen som kan fjerne mest arkitekturusikkerhet.
