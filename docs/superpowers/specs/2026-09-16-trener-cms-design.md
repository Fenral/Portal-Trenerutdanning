# Trener-CMS – vedtatt retning

Brukeren godkjente 16. september full autonom implementering av B-skissen og anbefalte valg. Videre godkjenningsstopp er derfor ikke nødvendige. Progresjon prioriteres; kontroll består av typesjekk, målrettede tester og en kort gjennomgang av kjerneflyten.

## Produkt

Ett innholdssystem i den eksisterende Next.js/Supabase-portalen. Administratorer og redaktører lager globale pensummoduler. Kursutgaver beholder kobling til global kilde og oppgraderes eksplisitt. Bruk eksisterende autentisering og publiseringshistorikk.

Arbeidsbenken har Bygg (AI-samtale, forhåndsvisning og kode ved behov), Rediger (vanlige felt, blokker og vedlegg), og Publiser (kort selvsjekk, endringsnotat og valg av kurs). Biblioteket har søk, nivåfilter og oppretting fra mal.

## Innholdsmodell

Eksisterende ContentDocument utvides bakoverkompatibelt med code_module-blokker og attachmentIds. En kodemodul inneholder HTML, CSS, JavaScript, eksplisitte redigeringsfelt, designnavn og designversjon. Kode kjøres kun i nettleserens isolerte iframe uten samme origin, nettverk eller top-navigering. Koden og designstilene lagres sammen med versjonen.

Standardblokker for overskrift, avsnitt, fremheving, lenke, bilde, video og interaktiv sekvens beholdes. Samme dokument gir lesing og nettbasert undervisning med lysbilder, tastaturstyring og notater. En selvstendig HTML-fil kan lastes ned for undervisning uten nett; eksterne videoer krever nett.

Eksterne foreleseres originalfiler lagres privat som vedlegg og lastes ned som filer. De konverteres ikke til redigerbart innhold. Metadata og dokumentets vedleggsreferanser inngår i publiseringshistorikken.

## Lagring og tilgang

Behold content_items/content_revisions og eksisterende kursbindinger. Utvid med CMS-metadata for nivå, lokal kursutgave og kildeversjon, samt private vedlegg. Endringer bruker konfliktkontroll med expectedUpdatedAt. Publisering fryser kladden og oppretter ny kladd; eksisterende kurs beholdes til de eksplisitt velges. Gjenoppretting kopierer en tidligere publisert versjon til kladd.

Serveren validerer alle dokumenter og kontrollerer innlogging/rolle før datatilgang. Nye databaseoperasjoner skal være atomiske. Det skal ikke finnes offentlig administratoromgåelse i produksjon.

## AI og selvsjekk

AI bruker en serverkonfigurert modell og nøkkel, foreslår endringer i dokumentformatet og får designsystem, nåværende kladd og administratorens kildegrunnlag som kontekst. Forslaget må brukes aktivt før det lagres. Ingen påstått AI-generering når leverandør ikke er konfigurert. Feil viser konkret neste handling, og vanlig redigering/kode virker uavhengig.

Selvsjekken varsler om manglende tittel, korte tekster, manglende kilder og kodefeil; strukturelt ugyldig innhold kan ikke publiseres. Den er kort og handlingsrettet, og skal ikke skape unødvendige godkjenningsrunder.

## Leveranse

Kjørbar implementering i egen Git-gren, additive migreringer, kort driftsveiledning og tilgjengelig nettadresse når eksisterende vertsoppsett tillater dette. Faktisk verifisering og eventuelle eksterne konfigurasjonsmangler dokumenteres konkret.
