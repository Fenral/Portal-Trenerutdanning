# Trenerutdanningsportalen V1 — kravbaseline

**Status:** Låst arbeidsgrunnlag for implementeringsplan, 30. august 2026  
**Produkteier:** Norges Golfforbund (NGF)  
**Mål for produksjon:** 90 prosent ferdig før juleferien 2026, pilotklar senest 11. desember 2026, Trener 3-oppstart 3. februar 2027  
**Språk:** Norsk bokmål i V1  
**Designkontrakt:** [`DESIGN.md`](../../DESIGN.md) — Nivå Klassisk Premium

## 1. Produktmål

Portalen skal gi studenten én tydelig neste handling, gi kurslæreren en operativ arbeidskø og gi sentral administrator kontroll på kurs, tilganger, import, rapportering og objektive data. Den skal samle læringsinnhold, samlinger, praksis, innleveringer, vurderinger, oppmøte og fullføring for Trener 1, Trener 2 og Trener 3.

V1 skal erstatte fragmentert oppfølging og dokumentinnlevering. Den skal ikke erstatte Checkin som påmeldings- eller betalingssystem, og den skal ikke integreres med Idrettens ID i V1.

## 2. Ikke-forhandlingsbare V1-beslutninger

1. **Innlogging:** Invitasjon til privat eller intern e-post, deretter passordfri engangskode eller magic link. En person har én stabil portal-ID uavhengig av e-postendringer.
2. **Påmelding:** Checkin er autoritativt system for påmelding og betaling. V1 støtter ett-klikk-opplasting av Checkins originale Excel-eksport. Alle påmeldte kan inviteres; betalingsstatus blokkerer ikke automatisk tilgang.
3. **Læringsdata:** Portalen er autoritativ for progresjon, vurdering, oppmøte, praksis, fullføring og diplom.
4. **Publisering:** Redaktør arbeider i kladd og må velge «Publiser». Publisert innhold endres ikke før ny versjon publiseres. All publisering versjoneres og kan tilbakeføres.
5. **Rapportering:** Alle operative rapporter kan eksporteres til PDF og Excel. AI-søk er skrivebeskyttet, administrator-only og begrenset til objektive, forhåndsdefinerte dataspørsmål.

## 3. Aktører og rettigheter

| Rolle | Omfang | Tillatelser i V1 |
|---|---|---|
| Student | Egne aktive kurs | Se pensum og presentasjoner, gjennomføre aktiviteter, quiz og prøve, føre praksis, levere/utbedre oppgaver, se egne frister, progresjon, oppmøte og diplom. Ser ikke progresjon fra tidligere år. |
| Kurslærer | Eksplisitt tildelte kursgjennomføringer | Se kontaktdata og progresjon for deltakerne i kurset, vurdere oppgaver og praksis, føre oppmøte/fravær, gi ny individuell frist, sende påminnelse og se rapporter for kurset. |
| Kursleder | Eksplisitt tildelte kursgjennomføringer | Alt kurslærer kan, samt tildele flere lærere, invitere deltakere, markere deltaker som trukket og gjenåpne tilgang. |
| Redaktør | Tildelte innholdsområder | Opprette kladd, redigere, versjonere og publisere pensum og presentasjoner direkte. Kan ikke administrere deltakere uten separat rolle. |
| Administrator | Hele portalen | Opprette kurs, gi roller, importere, se alle data, håndtere duplikater, overstyre fullføring, rapportere og bruke AI-søk. Flere personer kan være administrator. |

Rettigheter lagres som eksplisitte rolleoppdrag med omfang (`system`, `course_template` eller `course_run`). Rolle og omfang skal kontrolleres på server og i databasens radnivåsikkerhet; skjulte knapper er aldri sikkerhetsgrensen.

## 4. Kursmodell

- **Kurstrinn:** Trener 1, Trener 2, Trener 3 og senere etterutdanninger.
- **Kursmal:** Gjenbrukbar struktur for et trinn, med moduler, aktiviteter, progresjonsregler og fullføringskrav.
- **Kursgjennomføring:** Ett faktisk kull med startår, datoer, kurssted, lærere og deltakere.
- **Trener 1:** 5–10 parallelle kurssteder per år, normalt én vårsamling og én høstsamling. Kursstedene skal kunne ekspanderes/kollapses under Trener 1.
- **Trener 2:** Ett felles kull over tre helger.
- **Trener 3:** Ett felles kull over seks samlinger og to kalenderår. Kullet navngis med året det startet.
- **Etterutdanning:** Datamodellen skal tillate nye kursmaler uten kodeendring, men redaksjonell arbeidsflyt for egne sertifiseringsregler er ikke lanseringskrav.

Demodata skal bruke tabellene under og minst 15 tydelig fiktive studenter. Dette er demonstrasjonsdata; produksjonsdatoer opprettes og endres av administrator.

| Trener 1-kurssted 2026 | Samling 1 | Samling 2 |
|---|---|---|
| Kristiansund og Omegn GK | 22.–24. mai | 26.–27. september |
| Oslo GK | 29.–31. mai | 19.–20. september |
| Onsøy GK | 10.–12. april | 5.–6. september |
| Stavanger GK | 17.–19. april | 5.–6. september |
| Fana GK | 24.–26. april | 12.–13. september |
| Grenland og Omegn GK | 10.–12. april | 12.–13. september |
| Romerike GK | 24.–26. april | 19.–20. september |
| Byneset GK | 22.–24. mai | 26.–27. september |
| Sandane GK | 10.–12. april | 19.–20. september |

Ungdomsdriven er en ekstra samling 1.–3. juli for påmeldte 15–19-åringer og tilhører ikke ett ordinært kurssted.

| Trener 2-demodato 2026 | Detalj |
|---|---|
| 20. mars kl. 13–18 | Elverum/Terningen Arena |
| 1.–3. mai | Elverum Golfklubb |
| 18. september | Elverum Golfklubb |

| Trener 3-demodato | Detalj |
|---|---|
| 15. februar 2026 | Forlengelse av fellessamling 1 |
| 13.–15. mars 2026 | Golf, idrettsspesifikk |
| 8.–10. mai 2026 | Golf, idrettsspesifikk |
| 20. september 2026 | Forlengelse av fellessamling 2 |
| 7. februar 2027 | I forbindelse med fellessamling 3 |
| 19.–21. mars 2027 | Golf, idrettsspesifikk |

## 5. Studentopplevelse

Studentens startside prioriterer i denne rekkefølgen:

1. Én dominant «neste aktivitet» med frist og kobling til relevant samling.
2. Total progresjon i prosent og status mot lærerens anbefalte plan.
3. Moduler med konkret telling som «7 av 11 aktiviteter».
4. Nærmeste samling, praksisstatus, innleveringer og låste avhengigheter.
5. Varsler og historikk for det aktive kurset.

Studenten skal alltid kunne svare på hva som skal gjøres, hvor det gjøres og når det bør eller må være ferdig.

## 6. Innhold og CMS

### 6.1 Innholdstyper

- Kort nettside med strukturert riktekst, bilde, fil og eksterne lenker.
- Video fra godkjent URL eller opplastet fil. Engelskspråklige Trackman-videoer kan være obligatoriske når de forklarer fagbegreper.
- Undervisningspresentasjon som egen, versjonert ressurs. Presentasjonen kan publiseres til lærere og valgfritt deles med studenter.
- Quiz eller kontrollspørsmål i eller etter en modul.
- Innleveringsoppgave, kunnskapsprøve, praksiskrav, oppmøtekrav og manuell kontroll som egne aktivitetstyper.

Pensum og undervisningspresentasjon er separate publiseringsenheter. En pensumside trenger ikke ha en presentasjon. V1 støtter PowerPoint som kildefil/ressurs; interaktiv scrollytelling, 3D-modell og avansert animasjon planlegges som V1.1 etter at pilotmodulen «Ballfluktslover og balltreff» er validert.

### 6.2 Versjonering

- Hver ressurs har én redigerbar kladd og null eller én aktiv publisert versjon.
- Publisering lager et uforanderlig øyeblikksbilde med forfatter, tidspunkt og endringsnotat.
- Pågående studenter fortsetter på versjonen som er bundet til kursgjennomføringen, med mindre administrator eksplisitt oppgraderer kullet.
- Tilbakeføring lager en ny publisert versjon basert på en eldre; historikk slettes ikke.

## 7. Læringsregler

### 7.1 Progresjon

- Hver obligatorisk aktivitet har progresjonspoeng, standard `1`.
- Individuell progresjon = fullførte progresjonspoeng / alle obligatoriske progresjonspoeng × 100, avrundet til heltall.
- Modulvisning bruker antall fullførte aktiviteter av totalen, ikke prosent.
- Kullsnitt = gjennomsnitt av individuell progresjon for aktive deltakere. Deltakere med status `trukket` er ekskludert.
- «Fullført» betyr både 100 prosent progresjon og formell sluttstatus `fullført`.

### 7.2 Anbefalt plan og trafikklys

Kurslærer eller kursleder setter milepæler med dato og anbefalt totalprosent. Systemet interpolerer mellom milepælene. Standardterskler er konfigurerbare per kurs:

- **Grønn / i rute:** faktisk progresjon er inntil 5 prosentpoeng bak anbefalt eller foran.
- **Gul / litt bak:** 6–15 prosentpoeng bak anbefalt.
- **Rød / må følges opp:** mer enn 15 prosentpoeng bak anbefalt, eller minst én hard frist er utløpt uten godkjent forlengelse.

Trafikklys skal alltid vises med tekst og symbol, aldri bare farge. Læreren kan justere milepæler underveis; endringen logges.

### 7.3 Avhengigheter («bridges»)

Administrator kan kreve at én aktivitet, modul eller gruppe er fullført før neste åpnes. Kunnskapsprøven kan for eksempel kreve alt obligatorisk pensum. Låsen skal forklare nøyaktig hva som mangler.

### 7.4 Quiz og kunnskapsprøve

- Ubegrenset antall forsøk er standard.
- Valgfri forsinkelse etter ikke bestått forsøk, inkludert 24 timer, konfigureres per prøve.
- Spørsmålsbank og tilfeldig uttrekk er mulig, men ikke påkrevd når prøven har få spørsmål.
- Automatisk retting lagrer forsøk, poeng, beståttstatus og anvendt spørsmålversjon.
- Vurderingsskala kan være `godkjent/ikke godkjent` eller `A–F` med kommentar.

## 8. Innleveringer og vurdering

- Studenten leverer tekst, dokument, video eller ekstern lenke etter oppgavens konfigurasjon.
- Lærer kan gi A–F eller godkjent/ikke godkjent, kommentar og ny individuell frist.
- «Må utbedres» åpner samme levering for ny versjon. Studenten forbedrer og trykker «Send inn» på nytt.
- Alle innsendings- og vurderingsversjoner beholdes i revisjonssporet.
- En utløpt frist er ikke overholdt. Bare lærer, kursleder eller administrator kan gi forlenget frist på det konkrete arbeidskravet.

## 9. Praksis

- Studenten fører økter direkte i portalen med dato, varighet, aktivitetstype, notat og eventuell dokumentasjon.
- Innsending er sperret før summen er minst 45 timer.
- Av de 45 timene kan høyst 9 timer registreres som planlegging.
- Kurslærer er ansvarlig vurderer.
- Kursoppsett kan kreve individuell godkjenning eller automatisk godkjenning for alle.
- Automatisk godkjenning kan ha konfigurerbar forsinkelse; standard demonstrasjon er 24 timer.
- En automatisk godkjenning kan senere trekkes tilbake ved stikkprøve. Studenten utbedrer og sender inn på nytt.
- Alle statusendringer har aktør, tidspunkt, begrunnelse og forrige status.

## 10. Oppmøte og øvrige sluttkrav

- Oppmøte registreres etter hver samling og kan føres i enkelttimer som fravær.
- Standardkravet i Trenerløypa er minst 80 prosent oppmøte.
- Administrator kan gjøre en begrunnet manuell overstyring.
- For Trener 2 og Trener 3 registrerer administrator manuelt at universitetsdelen er fullført.
- Trener 1-deltakere som har valgt Ungdomsdriven i Checkin skal normalt være registrert møtt. Fravær blokkerer ikke automatisk kursfullføring, men oppretter en administratoroppgave om å fakturere klubb for mellomlegget. Beløp lagres ikke i portalen.

Når alle krav er oppfylt, godkjennes kurset automatisk. Studenten får en gratulasjonsvisning med redusert-bevegelse-alternativ, haptikk der enheten støtter det og diplom med navn basert på NGFs mal. Diplomet ligger på studentens «vegg» og kan lastes ned på nytt.

## 11. Deltakerstatus, tilgang og identitet

- Statusflyt: `invitert → aktiv → fullført` eller `aktiv → trukket → gjenåpnet`.
- Kursleder eller administrator kan markere `trukket`. Tilgangen stenges umiddelbart, men handlingen er reverserbar med ett tastetrykk.
- Gjenåpning gir tilgang tilbake. Opprinnelige frister beholdes; utløpte frister må forlenges manuelt per arbeidskrav.
- Deltakere hard-slettes ikke fra operativ UI. Personvernforespørsler håndteres gjennom en separat administratorstyrt anonymiseringsflyt.
- Sentral administrator kan slå sammen duplikatkontoer reversibelt. Systemet foreslår mulige treff basert på normalisert navn kombinert med klubb, telefon eller e-post, men slår aldri sammen automatisk.
- Minimumsalder er kalenderåret deltakeren fyller 15. Portalen lagrer bare fødselsår eller en kontrollert `alder_verifisert`-status dersom Checkin kan utføre kontrollen. Det finnes ikke krav om foresattes samtykke i dagens prosess; personvernansvarlig må bekrefte dette før produksjon.

## 12. Checkin-import

### 12.1 Nåværende kull

- Administrator velger kursgjennomføring og laster opp original Excel-eksport fra Checkin.
- Importen viser forhåndsvisning med `ny`, `oppdater`, `mulig duplikat`, `uendret` og `avvist rad` før bekreftelse.
- Ukjent kolonneoppsett stopper importen med lesbar feilmelding og lenke til kolonnemapping.
- En rad som mangler fra en nyere fil mister aldri tilgang automatisk.
- Portalen lagrer Checkin-arrangements-ID, deltaker-ID/ordrebruker-ID når tilgjengelig, importjobb, filhash og radresultat. Opplastet råfil slettes etter fullført import og revisjonsdata beholdes.
- Alle påmeldte er kvalifisert for invitasjon uavhengig av kort/Vipps/faktura. Kommersielle statuser vises kun som informasjon.

### 12.2 Historikk

- Administrator kan importere tidligere år fra Excel med minst navn, klubb, e-post og `bestått`.
- T3 tilskrives startåret.
- Historiske data er tilgjengelige for administratorrapportering. Studenten ser bare progresjon for nåværende aktive kurs.

## 13. Varsler og påminnelser

- Portalinvitasjon, frist, ny vurdering, ny individuell frist, anbefalt pensum før samling og tilgang stengt/gjenåpnet sendes som portalvarsel og e-post.
- Lærer kan sende manuell påminnelse fra deltakerprofil og til valgt gruppe.
- Faste påminnelsesdatoer konfigureres per kurs eller aktivitet.
- En utsendelsesnøkkel gjør planlagte utsendelser idempotente.
- Checkin beholder ordre-, betalings- og fakturapåminnelser. Portalen sender ikke SMS i V1.

Et valgfritt kursrom med studentens eksplisitte opt-in holdes bak funksjonsflagg og er ikke lanseringskrav. Produkteier skal ta en eksplisitt beslutning før utvikling av dette starter.

## 14. Lærer- og administratorflater

### 14.1 Kurslærer

- Skille tydelig mellom trinn og kursgjennomføring; Trener 1 kan kollapses.
- Deltakerliste viser navn, klubb, totalprogresjon, aktiviteter, praksis, innlevering, oppmøte og trafikklys.
- Filtrering på grønn, gul, rød og konkrete handlinger.
- Klikk på deltaker åpner profil med anbefalt mot faktisk progresjon, frister, moduldetaljer, praksis, oppmøte, vurderinger og meldingshandling.
- Arbeidskø prioriterer passert frist, venter på vurdering og må utbedres før generell statistikk.

### 14.2 Administrator

- Totaloversikt over kurs, deltakere, lærere, tilganger, importjobber og avvik.
- Kan delegere roller og kursansvar.
- Kan importere Checkin og historikk, håndtere duplikater, overstyre sluttkrav og administrere publisert innhold når separat redaktørrolle er gitt.
- Kan generere rapporter og bruke AI-søk.

## 15. Rapporter og objektivt AI-søk

Følgende kan eksporteres til både PDF og Excel: kursstatus, deltakerprogresjon, praksis, oppmøte, vurderinger, frister, fullføring og Trener 1-fordeling per kurssted.

AI-søket kan bare velge blant tillatte spørringsintensjoner og filtre. Det får aldri vilkårlig SQL, skriver aldri data og klassifiserer ikke studenten. Navn kan vises til autorisert administrator. Hvert svar viser:

- tolket spørsmål og aktive filtre;
- definisjon av beregningen;
- datakilde og tidspunkt;
- resultat og antall deltakere;
- eksplisitt merking som skrivebeskyttet.

Minst disse intensjonene skal støttes: individuell progresjon, kullsnitt, antall fullført, fordeling per Trener 1-kurssted, manglende innleveringer, fravær og praksisstatus.

## 16. Universell utforming, sikkerhet og personvern

- WCAG 2.2 AA testes med tastatur, skjermlesersemantikk, kontrast, zoom og redusert bevegelse.
- Mobil støttes fullt ut; komplekse redaktør- og rapportarbeidsflater kan anbefale PC uten å blokkere mobil.
- EU/EØS-region brukes for database og filstorage. Databehandleravtaler og behandlingsprotokoll må være godkjent før produksjonsdata.
- Radnivåsikkerhet, server-side autorisasjon, append-only audit-logg, kryptering i transitt/hvile, hemmelighetsrotasjon og minst mulig data er obligatorisk.
- Sikkerhetskopi og dokumentert gjenoppretting testes før pilot.
- Produksjonslogging skal ikke inneholde innleveringstekst, e-post, telefon eller tilgangstoken.

## 17. Harde beslutningsporter

Planen stopper ved porten dersom beviset mangler; utvikleren skal ikke gjette.

| Port | Seneste dato | Bevis | Eier |
|---|---|---|---|
| G1 Checkin-format | 4. september 2026 | Redigert originaleksport med alle faktiske kolonneoverskrifter og eksempel på privat betaling, klubbfaktura og Ungdomsdriven. | NGF |
| G2 Infrastruktur/personvern | 11. september 2026 | Godkjent EU-hosting, e-postleverandør, databehandleravtaler og behandlingsgrunnlag for mindreårige. | NGF + personvernansvarlig |
| G3 Diplom | 18. september 2026 | Diplommal, tillatt font, signaturregler og plassering av navn/kurs/dato. | NGF |
| G4 Innholdsinventar | 18. september 2026 | Liste over V1-moduler, eiere, eksisterende filer, obligatorisk/valgfritt og avhengigheter. | Fagansvarlig |
| G5 Produksjonsdrift | 30. oktober 2026 | Navngitt produkteier, supportansvarlig, hendelsesrutine og godkjent backup-/gjenopprettingsmål. | NGF |

## 18. Utenfor V1

- Idrettens ID/NIF-integrasjon og formell tilbakeskriving av kompetanse.
- Egen betaling, faktura, refusjon eller påmeldingsmotor.
- Checkin API/webhooks; Excel-import er V1-baseline.
- Engelsk grensesnitt og full innholdsoversettelse.
- 3D-visning av golfkølle, avansert scrollytelling og adaptiv læring.
- Fri AI-analyse, prediksjon av frafall eller vurdering av studentprestasjon.
- Kursrom før eksplisitt go/no-go.

## 19. V1-ferdigkriterier

V1 er pilotklar når:

1. En fiktiv student kan inviteres, logge inn, gjennomføre modul, quiz, praksis og innlevering, få registrert oppmøte, fullføre alle porter og motta diplom.
2. En kurslærer kan se et helt kull, finne røde/gule deltakere, åpne én profil, vurdere, gi ny frist, registrere oppmøte og sende påminnelse.
3. En administrator kan opprette kurs, gi tilgang, importere samme Checkin-fil to ganger uten duplikater, håndtere mulig duplikat, trekke/gjenåpne student og eksportere PDF/Excel.
4. AI-søket svarer korrekt på alle tillatte intensjoner, viser beregningsgrunnlaget og kan ikke skrive eller utføre fri SQL.
5. Sikkerhets-, personvern-, tilgjengelighets-, last-, backup-/restore- og akseptansetestene i implementeringsplanen er bestått uten kritiske eller høye åpne funn.
