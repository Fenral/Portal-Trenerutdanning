# Researchnotat: Checkin-integrasjon eller egen påmelding og betaling

**Status:** 30. august 2026  
**Formål:** Beslutningsgrunnlag for påmelding, betaling og påminnelser i V1 av Trenerutdanningsportalen  
**Kildestandard:** Checkins egne produkt-, pris-, hjelpe- og API-sider, offentlige leverandørdokumenter og norske myndighetskilder. Produktpåstander beskriver dokumentert funksjonalitet, ikke en uavhengig kvalitetsvurdering.

## Kort konklusjon

**Anbefaling/inferens:** Velg alternativ A i V1: **Behold Checkin som autoritativt system for påmelding, ordre, betaling, faktura, avmelding og refusjon. Integrer Checkin med portalen, mens portalen eier kursplass, tilgang, læringsprogresjon og læringspåminnelser.** Ikke bygg betaling eller en parallell påmeldingsmotor nå.

Dette er teknisk realistisk, men anbefalingen er betinget av en kort leverandøravklaring. Checkin dokumenterer et GraphQL-API, API-nøkler, webhooks, lesing av deltakere og ordredata, betalingsstatus og innebygging av påmeldingsskjema. Den offentlige dokumentasjonen viser også webhooks for opprettelse og endring av ordre, men publiserer ikke tilstrekkelige detaljer om signering, leveringsgaranti, rekkefølge, retry-policy, rate limits eller komplette hendelser for betaling, avmelding og refusjon. Disse punktene må bekreftes skriftlig og testes i sandbox før integrasjonen godkjennes. [Checkins API-oversikt](https://www.checkinevent.com/helpcenter/api-dokumentasjon) og [Checkins utviklerdokumentasjon](https://checkinno.atlassian.net/wiki/external/NTlmNmFhYjk5OWUwNGU4OTk5ZTk4ZjExOTYxMWYzNjU).

Den anbefalte grensen er enkel:

| Checkin eier | Trenerutdanningsportalen eier |
|---|---|
| Påmeldingsskjema, ordre, pris, betalingsmåte, faktura/EHF, betalingsoppfølging, økonomisk avmelding og refusjon | Brukerkonto, kurs-/kulltilgang, læringsstatus, pensum, innleveringer, vurdering, oppmøte, praksis, diplom og læringsrelaterte varsler |

Checkin er registrert som betalingsforetak hos Finanstilsynet og har tillatelse til å gjennomføre betalingstransaksjoner og pengeoverføringer. Det er en reell drifts- og regulatorisk oppgave som portalen ikke bør overta uten et dokumentert behov. [Finanstilsynets virksomhetsregister](https://www.finanstilsynet.no/virksomhetsregisteret/detalj/?id=242609).

---

## 1. Hva som er offentlig bekreftet

| Område | Offentlig dokumentert | Status for NGF |
|---|---|---|
| **API** | Checkin dokumenterer et GraphQL-endepunkt, API-oppsett som krever administratortilgang, spørringer for deltakere på ett eller flere arrangementer og tilgang til egendefinerte påmeldingsfelt. [Utviklerdokumentasjonen](https://checkinno.atlassian.net/wiki/external/NTlmNmFhYjk5OWUwNGU4OTk5ZTk4ZjExOTYxMWYzNjU). | Bekreftet som teknisk mulighet. Tilgang, pris, omfang, versjonering og produksjonsvilkår må bekreftes i NGFs avtale. |
| **Webhooks** | Dokumentasjonen viser konfigurasjon av webhook-endepunkt, et eksempel med unik `payloadId`, ordre-/arrangements-/deltaker-ID og betalingsstatus, samt varsler for opprettelse/endring av arrangement, billett og ordre. [Utviklerdokumentasjonen](https://checkinno.atlassian.net/wiki/external/NTlmNmFhYjk5OWUwNGU4OTk5ZTk4ZjExOTYxMWYzNjU). | Nok til å prototype. Signatur, retry, rekkefølge, timeout og full hendelsesliste er ikke offentlig spesifisert og er en lanseringsblokkering til det er avklart. |
| **Innebygging** | Checkin publiserer kode for å legge registreringsskjema og arrangementskalender inn i vanlig HTML eller React. Checkin oppgir også at skjemaet kan merkevaretilpasses og ligge på kundens nettsted. [API-/embed-dokumentasjonen](https://checkinno.atlassian.net/wiki/external/NTlmNmFhYjk5OWUwNGU4OTk5ZTk4ZjExOTYxMWYzNjU) og [påmeldingsproduktet](https://www.checkinevent.com/no/p%C3%A5meldingsskjema). | God kandidat for en sammenhengende V1-opplevelse. Må testes for mobil, tastatur, skjermleser, informasjonskapsler og feiltilstand. Ha alltid en vanlig lenke som reserve. |
| **Eksport og kommunikasjon** | Deltakerlisten kan filtreres og eksporteres til Excel. Checkin kan sende e-post og SMS til valgte deltakere; publisert SMS-pris er 0,80 kr eks. mva. per melding. [Deltakerlisten](https://www.checkinevent.com/helpcenter/ordrerapport) og [kommunikasjonsveiledningen](https://www.checkinevent.com/helpcenter/sende-sms-og-e-post-fra-checkin). | Excel er en reserve-/avstemmingsvei, ikke ønsket primærintegrasjon. Læringspåminnelser bør sendes fra portalen for å unngå dobbel kommunikasjon. |
| **Betaling og personvern** | Checkin tilbyr kort, Vipps og faktura/EHF, automatiske betalingspåminnelser og periodiske oppgjør. Standard databehandleravtale sier at Checkin behandler data på kundens vegne, bruker AWS i Irland og kan tilbakelevere data ved opphør. [Betalingsveiledningen](https://www.checkinevent.com/helpcenter/betaling), [faktureringsveiledningen](https://www.checkinevent.com/helpcenter/how-does-invoicing-work-in-checkin) og [databehandleravtalen](https://www.checkinevent.com/no/databehandleravtale). | Checkin bør forbli økonomisk systemeier i V1. NGF må fortsatt gjøre dataminimering, tilgangsstyring, behandlingsprotokoll og leverandøroppfølging. |

Checkin dokumenterer dessuten en direkte Moodle-integrasjon som kan opprette brukere og melde dem inn eller ut av ett eller flere Moodle-kurs. Hvis den senere teknologibeslutningen blir Moodle, skal denne standardkoblingen testes før NGF bestiller en egen adapter. [Checkins Moodle-veiledning](https://www.checkinevent.com/helpcenter/moodle).

### Viktig identitetsfunn

Checkins dokumentasjon sier at kontaktspørringen `allCrmsV2` kan slå sammen deltakelser når samme **navn, telefon eller e-post** er brukt. Det er nyttig for CRM, men for svakt som sikker identitetsnøkkel i en utdanningsportal. [Checkins utviklerdokumentasjon](https://checkinno.atlassian.net/wiki/external/NTlmNmFhYjk5OWUwNGU4OTk5ZTk4ZjExOTYxMWYzNjU).

**Anbefaling/inferens:** Portalen må beholde sin egen stabile bruker-ID og lagre Checkins arrangements-ID, ordre-ID, deltaker-/order-user-ID og CRM-ID som eksterne referanser. E-post brukes til invitasjon og som et kontrollert koblingsforslag, aldri som eneste varige nøkkel.

---

## 2. Sammenligning av fire alternativer

| Alternativ | Brukeropplevelse | Utvikling og drift | Data-/økonomirisiko | V1-vurdering |
|---|---|---|---|---|
| **A. Checkin er system of record; portal integreres** | Påmeldingen kan bygges inn i NGFs side. Etter påmelding får studenten portalinvitasjon og ser kursstatus i portalen. | Moderat: adapter, webhook-mottak, avstemming og administrativ feilkø. Checkin beholder økonomifunksjonene. | To systemer og leverandøravhengighet, men tydelig ansvar. Risikoen reduseres med idempotens og periodisk avstemming. | **Anbefales for V1.** Raskest og lavest risiko, forutsatt bestått integrasjonstest. |
| **B. Portal eier påmelding/påminnelser; Checkin brukes bare til betaling** | Potensielt én portalflate, men brukeren kan møte et separat betalingssteg og to statusmodeller. | Høyere: portalen må bygge skjema, kapasitet, venteliste, priser, samtykker og ordreorkestrering. | Checkins offentlige sider dokumenterer et komplett registreringsskjema med betaling, men ikke en generell, støttet «payment-only»-API for vilkårlig portalordre. Dette må bekreftes av Checkin. | **Ikke velg uten leverandørbevis.** Gir uklare systemgrenser og liten V1-gevinst. |
| **C. Portal eier påmelding; ekstern betalingsleverandør** | Kan gi én kontrollert opplevelse med hostet eller innebygd checkout. Stripe dokumenterer begge deler, og Vipps har et eget ePayment-API. [Stripe Checkout](https://docs.stripe.com/payments/checkout/how-checkout-works) og [Vipps MobilePay ePayment](https://developer.vippsmobilepay.com/docs/APIs/payment-integration/). | Høy: NGF må bygge påmelding, ordre, faktura/EHF-løsning, kapasitet, venteliste, økonomiavstemming, betalingsoppfølging, refusjonsflyt og support. | PSP reduserer kortsikkerhetsbyrden, men portalen blir ansvarlig for langt mer forretningslogikk og flere feilscenarier. | **Mulig senere**, dersom Checkin dokumentert begrenser produktet eller kostnaden blir urimelig. |
| **D. Påmelding og betaling fullt i portalen** | Maksimal kontroll over flyten. | Høyest og kontinuerlig: betaling er ikke en engangsfunksjon, men en varig drifts-, sikkerhets-, regnskaps- og supportforpliktelse. | Dersom «egen betaling» innebærer rådighet over andres midler eller utførelse av betalingstjenester, kan konsesjonsregler bli relevante; Finanstilsynet beskriver dette som et sentralt vurderingspunkt. [Finanstilsynet](https://www.finanstilsynet.no/tillatelser/betalingsforetak/). | **Avvis for V1.** Selv en egen portal bør bruke en autorisert betalingsleverandør og hostede betalingskomponenter. |

### Beslutning

**Anbefaling/inferens:** Alternativ A bør være V1-baseline. Alternativ C beholdes som et fremtidig sammenligningsalternativ når NGF har reelle tall for volum, gebyrer, administrasjonstid, feil og brukerfriksjon. B gir den dårligste systemgrensen; D er et eget betalingsprodukt og ligger utenfor portalens kjerneformål.

---

## 3. Målarkitektur for alternativ A

| Data/handling | Autoritativ kilde | Speiles til | Regel |
|---|---|---|---|
| Kursgjennomføring/kull og læringsløp | Portal | Checkin-arrangement kobles med `checkin_event_id` | Én eksplisitt kobling per kursgjennomføring; aldri koble via kursnavn. |
| Deltakeridentitet | Portalens stabile bruker-ID | Checkin-referanser lagres på koblingen | Checkin-data kan foreslå en konto, men portalens invitasjon bekrefter eierskapet til e-posten. |
| Påmelding, ordre og betalingsstatus | Checkin | Portalens lesbare kommersielle status | Portalen skriver ikke økonomisk status i V1. |
| Kursplass og læringstilgang | Portal | Ingen økonomisk tilbakeskriving i V1 | Opprettes fra gyldig, ikke avmeldt Checkin-påmelding etter definert tilgangsregel. |
| Progresjon, vurdering, oppmøte og diplom | Portal | Ikke Checkin i V1 | Checkin skal ikke bli LMS eller kompetanseregister. |
| Refusjon og økonomisk avmelding | Checkin | Portal suspenderer/oppdaterer tilgang etter synk | Refusjon startes aldri automatisk av en lærerhandling i V1. |

### To statuser må holdes fra hverandre

**Kommersiell status fra Checkin:** registrert, betaling venter, betalt, avmeldt, refundert.  
**Læringsstatus i portalen:** invitert, aktiv, trukket, gjenåpnet, fullført.

En kursleder kan markere studenten som **trukket** og stenge læringstilgangen reverserbart, slik produktintervjuet allerede har definert. Det er ikke det samme som å avmelde ordren eller refundere betalingen i Checkin. Ved behov får sentral administrator en tydelig handling: **«Åpne påmeldingen i Checkin»**.

**Anbefalt tilgangsregel/inferens:** En bekreftet, ikke avmeldt påmelding oppretter portalinvitasjon selv om en faktura fortsatt venter på betaling. Ubetalt faktura vises til administrator, men blokkerer ikke automatisk læring. Ellers kan fakturakunder bli låst ute i lang tid. Gjør «betaling kreves før tilgang» konfigurerbart per kurs dersom NGF faktisk trenger det.

---

## 4. Teknisk dataflyt

1. **Kurskobling:** Administrator oppretter eller velger Checkin-arrangementet og lagrer den stabile koblingen mellom portalens kursgjennomføring og Checkins arrangements-ID.
2. **Påmelding:** Studenten åpner et Checkin-skjema innebygd i NGFs kurs-/påmeldingsside. Hvis embed ikke laster, vises en vanlig lenke til Checkin. Checkin dokumenterer både HTML- og React-embed. [Utviklerdokumentasjonen](https://checkinno.atlassian.net/wiki/external/NTlmNmFhYjk5OWUwNGU4OTk5ZTk4ZjExOTYxMWYzNjU).
3. **Hendelse:** Webhook lagres først i en egen innboks med `payloadId`, mottakstidspunkt og minimum nødvendige data. Mottaket svarer raskt; behandling skjer asynkront.
4. **Bekreftelse:** Integrasjonen henter gjeldende ordre/deltaker fra Checkins API før den endrer portalen. Dette beskytter mot forsinkede eller ute-av-rekkefølge webhooks.
5. **Avstemming:** En planlagt jobb henter hele deltakerlisten for aktive kurs og sammenligner med portalens speil. Checkin dokumenterer både deltakerspørring og filtrering på opprettelses-/avmeldingstid. [Utviklerdokumentasjonen](https://checkinno.atlassian.net/wiki/external/NTlmNmFhYjk5OWUwNGU4OTk5ZTk4ZjExOTYxMWYzNjU).

### Idempotens og feilkontroll

- Unik nøkkel på `(provider, payload_id)` gjør samme webhook ufarlig å motta flere ganger.
- Unik nøkkel på `(checkin_event_id, checkin_order_user_id)` hindrer dobbel kursplass.
- Ordre-ID og deltaker-ID lagres separat fordi én bestiller kan kjøpe for en annen deltaker.
- Manglende eller tvetydig deltaker-e-post sendes til en administrativ feilkø; systemet gjetter ikke.
- En ny eller endret e-post flytter ikke historikk automatisk til en annen konto. Det bruker den avklarte, reversible duplikat-/sammenslåingsflyten for sentral administrator.

### Webhook-antakelse

**Anbefaling/inferens:** Design som om Checkin leverer webhooks minst én gang, i vilkårlig rekkefølge og med mulige forsinkelser. Dette er en sikker integrasjonsstrategi, ikke en påstand om Checkins faktiske leveringsgaranti. Den faktiske garantien må inn i avtalen eller teknisk dokumentasjon.

---

## 5. Påminnelser: én tydelig eier per formål

Checkin dokumenterer ordrebekreftelser, manuell e-post/SMS, tidsstyrt billettutsending og automatiske betalingspåminnelser. For faktura sendes e-postpåminnelse åtte dager etter forfall, og valgfri SMS senere i flyten. [Betalingsveiledningen](https://www.checkinevent.com/helpcenter/betaling), [billettutsending](https://www.checkinevent.com/helpcenter/billettutsending) og [kommunikasjon](https://www.checkinevent.com/helpcenter/sende-sms-og-e-post-fra-checkin).

**Anbefaling/inferens:** Ikke forsøk å flytte Checkins påminnelser «inn i» portalens innboks i V1. Vis heller relevant status i portalen og la hver meldingstype ha én avsender:

| Meldingstype | Eier i V1 | Kanal |
|---|---|---|
| Påmeldings-/ordrebekreftelse, faktura, betalingspåminnelse, refusjon | Checkin | E-post/SMS etter Checkin-oppsett |
| Portalinvitasjon og tilgang åpnet/stengt | Portal | E-post + portalvarsel |
| Anbefalt pensum før samling, frister og progresjonspåminnelser | Portal | E-post + portalvarsel; SMS bare ved senere dokumentert behov |
| Innlevering, vurdering, ny frist, lærer-/studentmelding og kursrom | Portal | Portalvarsel + e-post |
| Praktisk arrangementsinformasjon | Velg én eier per kurs | Standard bør være portalen etter at studenten er aktiv; Checkin kan fortsatt sende billett/innsjekksinformasjon |

Portalen bør lagre en utsendelsesnøkkel som `course + student + reminder_type + scheduled_at`. Da sendes samme planlagte påminnelse bare én gang selv om en jobb eller integrasjon prøves på nytt.

---

## 6. Avmelding, refusjon og reversering

Checkins hjelpeartikkel sier at avlysning av et arrangement ikke automatisk gjennomfører alle tilbakebetalinger; refusjoner håndteres per bestilling, og publisert pris er 10 kr per refusjon. Avmeldte deltakere flyttes til en egen oversikt. [Checkins veiledning for avlysning og refusjon](https://www.checkinevent.com/helpcenter/avlyse-et-arrangement).

**Anbefalt V1-regel/inferens:**

- Økonomisk avmelding/refusjon gjøres i Checkin av autorisert administrator.
- Checkin-hendelse eller avstemming oppdaterer portalens kommersielle status og suspenderer tilgang etter den avtalte regelen.
- «Trukket fra læringsløpet» i portalen utløser ikke refusjon; portalen viser at økonomisk oppfølging eventuelt gjenstår.
- Gjenåpning av læringstilgang gjenoppretter ikke en avmeldt Checkin-ordre.
- Alle manuelle overstyringer logges med bruker, tidspunkt og begrunnelse.

---

## 7. Kostnad og operasjonell risiko

Checkins offentlige prisliste, oppdatert 13. april 2026, oppgir 10 kr per billett, 2 prosent systemavgift og 2,5 prosent transaksjonsgebyr for ordinære betalte arrangementer; den oppgir også minimumspris, SMS-, kursbevis- og refusjonspriser. Den samme siden viser reduserte satser for ideelle organisasjoner: 3 kr per billett, 1 prosent systemavgift og 2,5 prosent transaksjonsgebyr, samt de første 500 gratisbillettene per år uten billettavgift. NGF må få skriftlig bekreftet om organisasjonen og den eksisterende avtalen kvalifiserer. [Checkins prisliste](https://www.checkinevent.com/no/priser).

Til sammenligning oppgir Vipps MobilePay 2,99 prosent + 1 kr per transaksjon for API-basert integrert betaling, mens Stripe oppgir 2,4 prosent + 2 kr for norske og EØS-kort. Disse prisene gjelder betalingstjenesten og er derfor **ikke direkte sammenlignbare** med Checkins pakke, som også omfatter registrering, fakturering, kommunikasjon og regnskapsfunksjoner. [Vipps MobilePay-priser](https://vippsmobilepay.com/no/priser) og [Stripe Norge-priser](https://stripe.com/en-no/pricing).

| Alternativ | Direkte leverandørkostnad | Skjult/operasjonell kostnad | Hovedrisiko |
|---|---|---|---|
| A | Checkin-gebyr + liten integrasjonsdrift | To administrasjonsflater, overvåking og avstemming | Vendor lock-in og utilstrekkelig dokumenterte webhook-garantier |
| B | Checkin-betaling + portaldrift; pris ukjent før tilbud | Dobbelt ordre-/kundestøtteansvar | Betalingsstatus og påmelding kan komme ut av takt |
| C | PSP-gebyr + e-post/SMS + eventuelle faktura-/regnskapstjenester | Permanent produktutvikling og økonomisupport | NGF må eie alle edge cases rundt ordre, kapasitet, avmelding og avstemming |
| D | PSP/kortkostnader forsvinner ikke selv om UI er eget | Størst sikkerhets-, revisjons-, regnskaps- og beredskapsbyrde | Prosjektet blir også et betalingsprodukt |

**Beslutningsregel/inferens:** Sammenlign fem års totalkostnad, ikke bare prosent per betaling. Ta med interne timer til kursoppsett, endringer, purring, refusjon, avstemming, support, feilretting og leverandøroppfølging.

---

## 8. Fem spørsmål NGF må få skriftlig svar på fra Checkin

1. **API-avtalen:** Er GraphQL-API, webhooks og embed inkludert for NGF; finnes sandbox/testdata, rate limits, versjons-/utfasingspolicy, endringsvarsling, support-SLA og egne kostnader?
2. **Autentisering og sikkerhet:** Hvilken autentiseringsmetode brukes; kan API-nøkler avgrenses per miljø/organisasjon/operasjon og roteres uten nedetid; hvordan signeres webhooks, roteres webhook-hemmeligheter og hindres replay?
3. **Hendelsesgarantien:** Hvilke eksakte hendelser finnes for ny/endret deltaker, endret e-post, betaling venter/betalt/feilet, faktura, avmelding, refusjon og chargeback; hva er retry-, timeout-, rekkefølge- og oppbevaringsgarantien; er `payloadId` globalt unik og kan hendelser spilles av på nytt?
4. **Data- og skrivegrensene:** Hvilke ID-er er stabile for arrangement, ordre, deltaker og CRM; hvordan håndteres bestiller som ikke er deltaker og Checkins egen CRM-sammenslåing; finnes støttede API-er eller sikre adminlenker for å opprette, endre, avmelde og refundere, eller er integrasjonen kun lesende?
5. **Kommunikasjon, betaling og exit:** Kan NGF slå av bestemte bekreftelser/påminnelser for å unngå duplikater; kan leveringslogg og betalings-/refusjonsstatus leses via API; hvilke data kan eksporteres ved opphør, i hvilket format og hvor raskt slettes Checkins kopi?

### Påkrevd leverandørbevis

Et muntlig «dette støtter vi» er ikke nok. Be om API-dokumentasjon eller kontraktsvedlegg som kan brukes som akseptansekriterium, og kjør testen mot NGFs egen Checkin-konto.

---

## 9. Implementeringsklar V1-plan

1. **Leverandørgate – 2–5 arbeidsdager:** Få skriftlige svar på de fem spørsmålene, API-/sandbox-tilgang og en faktisk NGF-prisliste. Stopp integrasjonen dersom signerte webhooks eller sikker avstemming ikke kan etableres.
2. **Vertikal prototype – 5 arbeidsdager:** Koble ett Trener 1-kurs til ett Checkin-arrangement, bygg inn skjemaet og ta imot en testpåmelding uten å sende ekte studentvarsler.
3. **Robust synk – 5–8 arbeidsdager:** Implementer webhook-innboks, idempotens, identitetskø, Checkin-ID-koblinger, statusmapping og planlagt avstemming.
4. **Kommunikasjonsdeling – 3–5 arbeidsdager:** Aktiver portalinvitasjon og læringspåminnelser; dokumenter hvilke Checkin-meldinger som forblir aktive; test at én hendelse gir én melding.
5. **Pilotgate – 5 arbeidsdager:** Kjør testmatrisen under, gjennomfør personvern-/tilgjengelighetskontroll og pilotér med ett lite kull før flere kurssteder kobles på.

### Fem obligatoriske akseptansetester

1. Én kort-/Vipps-påmelding oppretter nøyaktig én kursplass og én portalinvitasjon, også når samme webhook leveres flere ganger.
2. Fakturapåmelding får korrekt «betaling venter»-status og følger den avtalte tilgangsregelen uten å bli duplisert.
3. Endret deltaker-e-post kobles til samme person eller går til administrativ kontroll; den oppretter aldri automatisk en ny historikkbærende student.
4. Avmelding/refusjon i Checkin speiles korrekt, mens «trukket» og «gjenåpnet» i portalen fortsatt er separate, reversible læringshandlinger.
5. En utelatt webhook oppdages og repareres av avstemmingsjobben; administrator ser feilen og hva systemet korrigerte.

---

## 10. Beslutning for produktintervjuet

**V1-beslutning som kan brukes videre:**

> Checkin beholdes for påmelding og betaling. Påmeldingsskjemaet kan bygges inn i Trenerutdanningsportalen, og Checkin synkroniserer deltakere og kommersiell status til portalen via API/webhooks. Portalen sender læringsrelaterte påminnelser og eier all progresjon. Ingen betaling, refusjon eller økonomisk ordreendring utføres fra portalen i V1.

**Neste handling:** Send de fem leverandørspørsmålene i kapittel 8 til Checkin og be om et 45-minutters teknisk møte med en som kan API/webhooks, ikke bare produktdemo.
