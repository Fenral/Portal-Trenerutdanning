from __future__ import annotations

import html
import os
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import (
    BaseDocTemplate,
    Frame,
    KeepTogether,
    PageBreak,
    PageTemplate,
    Paragraph,
    Spacer,
    Table,
    TableStyle,
)


ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "output" / "pdf" / "trenerutdanningsportalen-sporsmal-og-beslutninger.pdf"

USER = "Valgt av bruker"
RECOMMENDED = "Anbefalt valgt 31.08.2026"
UPDATED = "Senere presisert av bruker"
GATE = "Anbefalt standard - kontrollpunkt gjenstår"


@dataclass(frozen=True)
class Decision:
    section: str
    question: str
    alternatives: tuple[str, ...]
    answer: str
    status: str = USER
    note: str = ""


def D(
    section: str,
    question: str,
    alternatives: Iterable[str],
    answer: str,
    status: str = USER,
    note: str = "",
) -> Decision:
    return Decision(section, question, tuple(alternatives), answer, status, note)


decisions: list[Decision] = [
    # 1. Retning og omfang
    D("1. Retning og omfang", "Hvordan skal prosjektet deles opp?",
      ["A. Ett samlet prosjekt med portal og innholdsspor for Trener 1, 2 og 3.",
       "B. Separate, ukoordinerte prosjekter for teknikk og hvert trenernivå."],
      "A. Ett samlet prosjekt, med tydelige arbeidsspor for portal, pensum og nivåene."),
    D("1. Retning og omfang", "Skal vi gjøre research før vi låser løsning og design?",
      ["A. Ja, undersøk gode læringsportaler, verktøy og mønstre først.",
       "B. Nei, start bygging uten en sammenligningsfase."],
      "A. Research først, inkludert eksempler fra andre bransjer."),
    D("1. Retning og omfang", "Hva er hovedmålet med versjon 1?",
      ["A. En komplett portal for læring, oppfølging og administrasjon, med prioritert pilotinnhold.",
       "B. Bare et innholdsbibliotek uten operativ kursoppfølging."],
      "A. Portal og pilotinnhold skal fungere som ett sammenhengende produkt."),
    D("1. Retning og omfang", "Hvilket trenernivå er pilot ved oppstart 3. februar 2027?",
      ["A. Trener 1.", "B. Trener 2.", "C. Trener 3."],
      "C. Trener 3."),
    D("1. Retning og omfang", "Når må portalen være klar?",
      ["A. 90 prosent før juleferien 2026 og pilotklar senest 11. desember 2026.",
       "B. Først ved kursstart 3. februar 2027."],
      "A. 90 prosent før juleferien, med desember som reell ferdigfrist."),
    D("1. Retning og omfang", "Skal demonstrasjonen vise realistisk aktivitet midt i et læringsløp?",
      ["A. Ja, med fiktive studenter og rollebytte mellom student, lærer og administrator.",
       "B. Nei, bare tomme standardsider."],
      "A. En tydelig merket demomodus med fiktive data."),
    D("1. Retning og omfang", "Hvilket språk skal brukes i versjon 1?",
      ["A. Norsk bokmål, med struktur som kan oversettes senere.",
       "B. Norsk og engelsk fullt ut fra første versjon."],
      "A. Norsk bokmål i V1; engelsk vurderes i V2."),

    # 2. Roller, identitet og innlogging
    D("2. Roller, identitet og innlogging", "Hvordan får en ny student tilgang?",
      ["A. Studenten registrerer seg selv.", "B. Studenten får en invitasjon etter opptak/påmelding."],
      "B. Invitasjon er inngangen i første versjon."),
    D("2. Roller, identitet og innlogging", "Hvilke e-postadresser skal støttes?",
      ["A. Bare NGF/interne adresser.", "B. Både private og interne adresser."],
      "B. Både private og interne e-postadresser."),
    D("2. Roller, identitet og innlogging", "Skal Idrettens ID være innlogging i V1?",
      ["A. Ja, gjør løsningen avhengig av Idrettens ID.",
       "B. Nei, bruk en selvstendig e-postbasert løsning og vurder Idrettens ID senere."],
      "B. Idrettens ID er ikke en V1-avhengighet."),
    D("2. Roller, identitet og innlogging", "Hvem kan invitere og endre tilganger?",
      ["A. Bare sentrale administratorer.",
       "B. Administratorer, med mulighet til å delegere avgrenset tilgang."],
      "B. Administrator kan delegere."),
    D("2. Roller, identitet og innlogging", "Hvor bred tilgang får en delegert lærer?",
      ["A. Alle brukere i portalen.", "B. Bare egne tildelte kurs."],
      "B. Bare egne kurs."),
    D("2. Roller, identitet og innlogging", "Skal flere personer kunne være administrator?",
      ["A. Ja.", "B. Nei, én systemeier."],
      "A. Flere kan ha administratorrollen."),
    D("2. Roller, identitet og innlogging", "Kan ett kurs ha flere kursansvarlige?",
      ["A. Ja, én eller flere.", "B. Nei, nøyaktig én."],
      "A. Ett kurs kan ha flere kursansvarlige."),
    D("2. Roller, identitet og innlogging", "Skal kurstilgang og oppfølgingsansvar være samme rolle?",
      ["A. Ja, alle lærere får alle persondata og varsler.",
       "B. Nei, skill kursansvarlig, faglærer og gjestelærer."],
      "B. Rollene skilles for å begrense tilgang og varsler.", RECOMMENDED),
    D("2. Roller, identitet og innlogging", "Hvordan logger vanlige studenter inn?",
      ["A. E-post og passord etter invitasjon, med valgfri passkey senere.",
       "B. SMS-kode ved hver innlogging."],
      "A. E-postbasert innlogging uten SMS-kostnad."),
    D("2. Roller, identitet og innlogging", "Hvilken ekstra sikkerhet kreves for administratorer?",
      ["A. Passkey som hovedvalg, autentiseringsapp som reserve og gjenopprettingskoder.",
       "B. Bare passord."],
      "A. Phishing-resistent flerfaktor uten kostnad per innlogging."),
    D("2. Roller, identitet og innlogging", "Hvordan håndteres duplikatbrukere?",
      ["A. Systemet slår sammen automatisk ved likt navn.",
       "B. Systemet foreslår mulige treff; administrator vurderer og slår sammen."],
      "B. Forslag vises bare til administrator, og navn alene er aldri nok."),
    D("2. Roller, identitet og innlogging", "Skal en kontosammenslåing kunne reverseres?",
      ["A. Ja.", "B. Nei."],
      "A. Sammenslåing må være reverserbar."),

    # 3. Kursstruktur og kull
    D("3. Kursstruktur og kull", "Hvordan organiseres Trener 1?",
      ["A. Ett fast kurssted.",
       "B. Flere parallelle kursgjennomføringer per sted og dato."],
      "B. Normalt 5-10 steder, med vår- og høstsamling."),
    D("3. Kursstruktur og kull", "Hvordan vises de mange Trener 1-kursene?",
      ["A. Alle alltid åpne.", "B. Trener 1 kan ekspanderes og kollapses."],
      "B. Trener 1 skal kunne kollapses."),
    D("3. Kursstruktur og kull", "Hvordan organiseres Trener 2?",
      ["A. Flere lokale løp.", "B. Ett samlet kull over tre helger."],
      "B. Ett samlet kull over tre helger."),
    D("3. Kursstruktur og kull", "Hvordan organiseres Trener 3?",
      ["A. Ett år og tre samlinger.", "B. Seks samlinger over to år."],
      "B. Seks samlinger over to år."),
    D("3. Kursstruktur og kull", "Hvilket år tilskrives et toårig Trener 3-kull?",
      ["A. Året det avsluttes.", "B. Året det starter."],
      "B. Startåret."),
    D("3. Kursstruktur og kull", "Skal datamodellen støtte etterutdanninger?",
      ["A. Ja, nye kursmaler kan legges til senere.",
       "B. Nei, modellen låses til Trener 1-3."],
      "A. Etterutdanninger skal kunne legges til uten ny grunnmodell.", RECOMMENDED),
    D("3. Kursstruktur og kull", "Hvordan brukes demodatoene?",
      ["A. Som tydelig merkede demonstrasjonsdata.",
       "B. Som produksjonsdatoer som ikke kan endres."],
      "A. Demodatoene er redigerbare og holdes adskilt fra produksjon."),
    D("3. Kursstruktur og kull", "Hvem skal kunne opprette nye kursgjennomføringer?",
      ["A. Administrator.", "B. Alle lærere."],
      "A. Administrator, med mulighet for senere delegasjon."),

    # 4. Studentreise og progresjon
    D("4. Studentreise og progresjon", "Hva må studenten alltid forstå på startsiden?",
      ["A. Hva som skal gjøres, hvor det gjøres og når det bør/må være ferdig.",
       "B. Bare en generell katalog over alt innhold."],
      "A. Startsiden prioriterer neste konkrete handling."),
    D("4. Studentreise og progresjon", "Hva er viktigst i lærerens kursoversikt?",
      ["A. Operativ oppfølging av progresjon, frister og vurderinger.",
       "B. Store dekorative nøkkeltall uten handlinger."],
      "A. En handlingskø og en oversiktlig deltakerliste."),
    D("4. Studentreise og progresjon", "Hvordan går læreren fra helhet til detalj?",
      ["A. Trinn og kurs -> deltakerliste -> studentprofil.",
       "B. Søk etter hver student uten kurskontekst."],
      "A. Tydelig hierarki fra kursoversikt til individ."),
    D("4. Studentreise og progresjon", "Hvordan vises total progresjon?",
      ["A. Som en tydelig prosent for hele læringsløpet.",
       "B. Bare som antall åpnete sider."],
      "A. Total progresjon vises i prosent."),
    D("4. Studentreise og progresjon", "Hvordan vises progresjon i enkeltmoduler?",
      ["A. Prosent på alle nivåer.",
       "B. Konkret telling, for eksempel 7 av 11 aktiviteter."],
      "B. Moduler bruker konkret telling; totalen bruker prosent."),
    D("4. Studentreise og progresjon", "Hvordan beregnes totalprosenten?",
      ["A. Hver modul teller likt uansett størrelse.",
       "B. Alle obligatoriske aktiviteter teller, slik at større moduler naturlig veier mer."],
      "B. Fra fullførte obligatoriske aktiviteter/progresjonspoeng."),
    D("4. Studentreise og progresjon", "Skal moduler i progresjonslinjen være klikkbare?",
      ["A. Ja, åpne detaljvisning av gjort og gjenstående.", "B. Nei, bare vis status."],
      "A. Hver modul åpner konkret detalj."),
    D("4. Studentreise og progresjon", "Hvordan vises om studenten ligger i rute?",
      ["A. Bare en farge.",
       "B. Rød, gul eller grønn med tekst/symbol og lærerdefinert anbefalt plan."],
      "B. Trafikklys må aldri stå alene uten forklaring."),
    D("4. Studentreise og progresjon", "Hvem bestemmer den anbefalte progresjonen?",
      ["A. Systemet gjetter selv.",
       "B. Lærer/kursleder setter milepæler på forhånd og kan justere dem."],
      "B. Kursstaben setter og justerer milepælene."),
    D("4. Studentreise og progresjon", "Skal studenten se anbefalt progresjon mot egen progresjon?",
      ["A. Ja, som tidslinje eller kurver merket 'Anbefalt' og 'Din'.",
       "B. Nei, fargen vises bare til læreren."],
      "A. Studenten får en tydelig, ikke-dømmende sammenligning."),
    D("4. Studentreise og progresjon", "Er digitalt pensum et hardt krav før hver samling?",
      ["A. Alltid obligatorisk før samling.",
       "B. Normalt anbefalt før relevant samling; sluttkravene gjelder innen kursårets frister."],
      "B. Læringsløp og samlinger kobles, uten unødvendig hard låsing."),
    D("4. Studentreise og progresjon", "Hvordan defineres kullsnitt?",
      ["A. Snittet av individuell progresjon for aktive deltakere.",
       "B. Andelen som har åpnet minst én modul."],
      "A. Trukne deltakere ekskluderes fra snittet."),
    D("4. Studentreise og progresjon", "Skal Trener 1 kunne sammenlignes per kurssted?",
      ["A. Ja, med samme definerte progresjonsmål per sted.", "B. Nei."],
      "A. Administrator kan se fordeling og gjennomsnitt per kurssted."),

    # 5. CMS, publisering og versjoner
    D("5. CMS, publisering og versjoner", "Hvem kan opprette og redigere pensum?",
      ["A. Administrator/redaktør, med delegasjon til avgrensede områder.",
       "B. Alle kursdeltakere."],
      "A. Delegasjon kan begrenses til trinn eller moduler."),
    D("5. CMS, publisering og versjoner", "Når blir en innholdsendring synlig?",
      ["A. Med én gang den lagres.", "B. Først når redaktøren velger 'Publiser'."],
      "B. Redigering skjer i kladd; publisering er en egen handling.", UPDATED),
    D("5. CMS, publisering og versjoner", "Kan redaktøren publisere egne endringer?",
      ["A. Ja.", "B. Administrator må godkjenne hver publisering."],
      "A. Redaktøren kan publisere direkte innen sitt område."),
    D("5. CMS, publisering og versjoner", "Skal publisert innhold ha versjonshistorikk?",
      ["A. Ja, med forfatter, tidspunkt, endringsnotat og tilbakeføring.", "B. Nei."],
      "A. Historikken beholdes og kan tilbakeføres."),
    D("5. CMS, publisering og versjoner", "Hvordan gjenbrukes samme modul i flere kull?",
      ["A. Én mastermodul; nye kull får siste versjon og aktive kull beholder sin.",
       "B. En separat kopi per kurs."],
      "A. Én master med versjonsbinding."),
    D("5. CMS, publisering og versjoner", "Når låses et kull til modulversjonen?",
      ["A. Når læringsløpet publiseres til kullet.",
       "B. Når første student åpner modulen."],
      "A. Ved publisering til kullet."),
    D("5. CMS, publisering og versjoner", "Kan et aktivt kull oppdateres ved en viktig feil?",
      ["A. Ja, manuelt med forhåndsvisning og historikk.",
       "B. Nei, aktive kull kan aldri oppdateres."],
      "A. Oppdatering er en tydelig administrativ handling."),
    D("5. CMS, publisering og versjoner", "Hva skjer med allerede fullførte studenter ved versjonsoppdatering?",
      ["A. Redaktøren kan kreve ny gjennomføring.",
       "B. Fullføringen beholdes alltid."],
      "B. Allerede oppnådd fullføring beholdes alltid."),
    D("5. CMS, publisering og versjoner", "Kan et tema ha nivåspesifikke tillegg?",
      ["A. Ja, felles master med tillegg for Trener 1, 2 eller 3.",
       "B. Nei, alt må være identisk."],
      "A. Felles master kombineres med nivåtillegg."),
    D("5. CMS, publisering og versjoner", "Hva skjer når masterinnhold er fullført på et tidligere nivå?",
      ["A. Masterdelen godskrives; nivåtillegget må gjennomføres.",
       "B. Hele modulen må tas på nytt."],
      "A. Tidligere fullført masterinnhold godskrives."),
    D("5. CMS, publisering og versjoner", "Hvilket leseformat støttes i V1?",
      ["A. Bare korte sider.",
       "B. Både korte sider og interaktive scrollmoduler."],
      "B. Begge formater bygges i V1."),
    D("5. CMS, publisering og versjoner", "Hvordan fungerer scrollmoduler på mobil?",
      ["A. Samme innhold som en enkel, stablet og tilgjengelig side.",
       "B. Full desktop-animasjon tvinges inn på mobil."],
      "A. Mobil får en stabil visning; desktop anbefales for beste opplevelse."),
    D("5. CMS, publisering og versjoner", "Hvordan registreres en scrollmodul som fullført?",
      ["A. Fri scrolling, sluttspørsmål og knappen 'Fullfør og gå videre'.",
       "B. Automatisk når bunnen nås."],
      "A. En tydelig sluttaktivitet, ikke passiv scrolldeteksjon."),
    D("5. CMS, publisering og versjoner", "Hvordan lages avanserte animasjoner uten at lærere må kode?",
      ["A. Gjenbrukbare, sikre blokker som kan konfigureres av AI og redigeres kodefritt.",
       "B. En fri mini-PowerPoint med ubegrenset plassering og kode."],
      "A. A+-modellen: blokkbibliotek, AI-assistert oppsett og kodefri redigering."),
    D("5. CMS, publisering og versjoner", "Kan AI publisere pensum direkte?",
      ["A. Nei, AI lager bare kladd som menneskelig redaktør forhåndsviser og publiserer.",
       "B. Ja, AI kan publisere uten kontroll."],
      "A. Menneskelig publisering er alltid nødvendig."),
    D("5. CMS, publisering og versjoner", "Hvor mye Claude-integrasjon inngår i V1?",
      ["A. Innhold lages eksternt og importeres som validert kladd.",
       "B. Direkte Claude-API og 'Lag med Claude'-knapp i portalen."],
      "A. Ingen Claude-nøkkel eller API-kostnad i V1."),

    # 6. Læringsaktiviteter, quiz og avhengigheter
    D("6. Læringsaktiviteter, quiz og avhengigheter", "Hva teller som gjennomført i vanlige pensummoduler?",
      ["A. Bare at siden er åpnet.",
       "B. Lest innhold, eventuelle kontrollspørsmål og eksplisitt fullføring."],
      "B. En kombinasjon tilpasset aktiviteten."),
    D("6. Læringsaktiviteter, quiz og avhengigheter", "Skal det være en avsluttende kunnskapsprøve?",
      ["A. Ja, den oppsummerer obligatorisk pensum.", "B. Nei."],
      "A. Sluttprøven inngår i læringsløpet."),
    D("6. Læringsaktiviteter, quiz og avhengigheter", "Hvordan rettes kunnskapsprøven?",
      ["A. Automatisk.", "B. Alltid manuelt av lærer."],
      "A. Automatisk retting."),
    D("6. Læringsaktiviteter, quiz og avhengigheter", "Hvor mange forsøk får studenten?",
      ["A. Ubegrenset som standard.", "B. Ett forsøk."],
      "A. Ubegrenset antall forsøk."),
    D("6. Læringsaktiviteter, quiz og avhengigheter", "Skal ventetid etter feil svar være obligatorisk?",
      ["A. Alltid 24 timer.",
       "B. Valgfri og konfigurerbar, inkludert 24 timer."],
      "B. Administrator velger per prøve."),
    D("6. Læringsaktiviteter, quiz og avhengigheter", "Kan beståttgrensen settes per prøve?",
      ["A. Ja.", "B. Nei, én global grense."],
      "A. Grensen kan konfigureres, selv om små prøver ofte ikke trenger prosent."),
    D("6. Læringsaktiviteter, quiz og avhengigheter", "Må alle sluttspørsmål i en modul være riktige?",
      ["A. Ja, med nytt forsøk og valgfri ventetid.",
       "B. Nei, det holder å svare."],
      "A. Riktig svar kreves før modulfullføring."),
    D("6. Læringsaktiviteter, quiz og avhengigheter", "Skal spørsmålsbank og tilfeldig uttrekk støttes?",
      ["A. Ja, som valgfri funksjon.", "B. Nei."],
      "A. Muligheten finnes, men brukes bare når spørsmålsmengden forsvarer det."),
    D("6. Læringsaktiviteter, quiz og avhengigheter", "Kan én aktivitet låse opp en annen?",
      ["A. Ja, med forklaring på hva som mangler.", "B. Nei, alt er alltid åpent."],
      "A. Avhengigheter kan settes mellom steg, moduler og sluttprøve."),
    D("6. Læringsaktiviteter, quiz og avhengigheter", "Hvem kan overstyre en avhengighet for én student?",
      ["A. Administrator, med begrunnelse og logg.", "B. Studenten selv."],
      "A. Administrator må oppgi en kort begrunnelse."),
    D("6. Læringsaktiviteter, quiz og avhengigheter", "Hvordan behandles obligatoriske engelske Trackman-videoer?",
      ["A. De kan embeddes med norsk tekstalternativ/faglig oppsummering.",
       "B. De fjernes fordi talen er engelsk."],
      "A. Videoene beholdes når tillatelse foreligger og tilgjengeligheten ivaretas."),
    D("6. Læringsaktiviteter, quiz og avhengigheter", "Skal portalen forsøke å hindre all 'juksescrolling'?",
      ["A. Ja, lås hvert sekund og hvert skjermbilde.",
       "B. Nei, bruk meningsfulle spørsmål og tydelige fullføringshandlinger."],
      "B. Læringskontroll prioriteres fremfor kunstig tidslås."),

    # 7. Presentasjoner, filer og medier
    D("7. Presentasjoner, filer og medier", "Er pensum og undervisningspresentasjon samme publiseringsenhet?",
      ["A. Ja, alltid identiske.", "B. Nei, de er separate."],
      "B. Pensum og presentasjoner er separate."),
    D("7. Presentasjoner, filer og medier", "Må alle pensummoduler ha en presentasjon?",
      ["A. Ja.", "B. Nei."],
      "B. Mange moduler trenger ingen presentasjon."),
    D("7. Presentasjoner, filer og medier", "Hvordan håndteres presentasjoner i V1?",
      ["A. Full presentasjonseditor bygges i portalen.",
       "B. Ferdige PDF-, PowerPoint-, Excel- og andre filer lastes opp."],
      "B. V1 bruker filopplasting; portalbasert editor er en senere mulighet.", UPDATED,
      "Dette erstatter den tidligere ideen om at alle presentasjoner skulle produseres som strukturerte slides i CMS-et."),
    D("7. Presentasjoner, filer og medier", "Hvor mange presentasjoner/filer kan knyttes til en modul?",
      ["A. Ingen, én eller flere.", "B. Maksimalt én."],
      "A. En modul kan ha mange ressurser."),
    D("7. Presentasjoner, filer og medier", "Skal presentasjonsfiler publiseres før studentene ser dem?",
      ["A. Ja.", "B. Nei, opplasting er automatisk publisering."],
      "A. Opplasting lager kladd; publisering gjør filen synlig."),
    D("7. Presentasjoner, filer og medier", "Hvem kan se en publisert ressurs?",
      ["A. Redaktøren velger 'kun lærere' eller 'lærere og studenter'.",
       "B. Alt er automatisk synlig for alle."],
      "A. Publikum settes per fil."),
    D("7. Presentasjoner, filer og medier", "Hvordan åpnes PDF-filer?",
      ["A. Forhåndsvisning i portalen og mulighet for nedlasting.",
       "B. Bare nedlasting."],
      "A. PDF kan både leses og lastes ned."),
    D("7. Presentasjoner, filer og medier", "Hvordan åpnes PowerPoint, Excel og andre dokumenter?",
      ["A. De kan lastes ned.", "B. De blokkeres."],
      "A. Originalfilen skal kunne lastes ned."),
    D("7. Presentasjoner, filer og medier", "Hvor deles en kullspesifikk fil?",
      ["A. I det valgte kullets læringsløp.", "B. Automatisk til alle kull."],
      "A. Bare studenter og lærere i det aktuelle kullet får tilgang."),
    D("7. Presentasjoner, filer og medier", "Hvor finner studenten ressursene?",
      ["A. Under relevant modul og samlet i 'Filer og ressurser'.",
       "B. Bare i en global filmappe."],
      "A. Begge innganger brukes."),
    D("7. Presentasjoner, filer og medier", "Hvem kan laste opp og publisere filer til et kull?",
      ["A. Kursleder kan laste opp og publisere; andre lærere kan laste opp kladd.",
       "B. Bare sentral administrator."],
      "A. Kursleder publiserer i eget kull; master styres av redaktør.", RECOMMENDED),
    D("7. Presentasjoner, filer og medier", "Hvordan organiseres felles bilder, video og dokumenter?",
      ["A. I et søkbart mediebibliotek med rettighetsinformasjon og gjenbruk.",
       "B. Separate, umerkede opplastinger i hver modul."],
      "A. Ett felles mediebibliotek."),
    D("7. Presentasjoner, filer og medier", "Hva skjer når en mediefil erstattes?",
      ["A. Ny versjon; publisert innhold beholder gammel fil til eksplisitt oppdatering.",
       "B. Erstatt overalt med én gang."],
      "A. Versjoner hindrer uventede endringer i aktive kull."),
    D("7. Presentasjoner, filer og medier", "Hvordan håndteres lærernotater når presentasjonen er en ekstern fil?",
      ["A. Som filmetadata eller eget lærer-only vedlegg/notat.",
       "B. Notater kan ikke finnes."],
      "A. Lærernotater holdes separat fra studentfilen.", RECOMMENDED,
      "Tidligere slide-notater i en intern editor er erstattet av denne filbaserte løsningen."),
    D("7. Presentasjoner, filer og medier", "Skal Claude Design kunne brukes til presentasjoner?",
      ["A. Ja, eksternt; eksportert resultat lastes opp som fil.",
       "B. Nei."],
      "A. Claude kan brukes som produksjonsverktøy, men portalen eier publisering og tilgang.", UPDATED),
    D("7. Presentasjoner, filer og medier", "Skal 3D-modellen av golfkøllen inngå i V1?",
      ["A. Ja, som lanseringskrav.", "B. Nei, behold som senere mulighet."],
      "B. 3D er utsatt; filformatet vurderes senere."),

    # 8. Innleveringer og praksis
    D("8. Innleveringer og praksis", "Hvilke innleveringsformer skal støttes?",
      ["A. Tekst, dokument, video og ekstern lenke etter oppgavens oppsett.",
       "B. Bare Word-fil."],
      "A. Flere leveringstyper støttes."),
    D("8. Innleveringer og praksis", "Hvordan vurderes en innlevering?",
      ["A. A-F eller godkjent/ikke godkjent, med kommentar.",
       "B. Bare automatisk prosent."],
      "A. Vurderingsform velges per oppgave."),
    D("8. Innleveringer og praksis", "Når er lærerkommentar obligatorisk?",
      ["A. Ved F eller ikke godkjent; ellers valgfritt.",
       "B. Aldri."],
      "A. Negativ vurdering må forklares."),
    D("8. Innleveringer og praksis", "Kan læreren gi en ny individuell frist?",
      ["A. Ja.", "B. Nei."],
      "A. Ny frist settes på det konkrete arbeidskravet."),
    D("8. Innleveringer og praksis", "Hva skjer når en levering må utbedres?",
      ["A. Studenten forbedrer samme levering og sender inn på nytt.",
       "B. Den gamle slettes og studenten starter uten historikk."],
      "A. Alle versjoner og kommentarer beholdes."),
    D("8. Innleveringer og praksis", "Hvor mange praksistimer kreves?",
      ["A. 45 timer.", "B. 30 timer."],
      "A. 45 timer."),
    D("8. Innleveringer og praksis", "Hvor mye kan være planlegging?",
      ["A. Maks 20 prosent, altså 9 av 45 timer.", "B. Ubegrenset."],
      "A. Maks 9 timer planlegging."),
    D("8. Innleveringer og praksis", "Når kan praksis sendes inn?",
      ["A. Først når minst 45 timer er registrert.", "B. Når som helst."],
      "A. 'Send inn' låses frem til timekravet er nådd."),
    D("8. Innleveringer og praksis", "Hvem godkjenner praksis?",
      ["A. Kurslærer.", "B. Studenten selv."],
      "A. Kurslærer er ansvarlig vurderer."),
    D("8. Innleveringer og praksis", "Hvordan kan praksis godkjennes?",
      ["A. Individuelt eller automatisk for alle, valgt i kursoppsettet.",
       "B. Bare én global metode."],
      "A. Begge metoder støttes."),
    D("8. Innleveringer og praksis", "Kan automatisk praksisgodkjenning forsinkes?",
      ["A. Ja, for eksempel 24 timer.", "B. Nei."],
      "A. Forsinkelsen kan konfigureres."),
    D("8. Innleveringer og praksis", "Kan en godkjenning trekkes tilbake etter stikkprøve?",
      ["A. Ja, med begrunnelse og ny innsending.", "B. Nei."],
      "A. Studenten kan utbedre og sende inn på nytt."),
    D("8. Innleveringer og praksis", "Hva registreres per praksisøkt?",
      ["A. Dato, timer, planlegging/gjennomføring, målgruppe, aktivitet og refleksjon.",
       "B. Bare en totalsum."],
      "A. Detaljert, men enkelt elektronisk skjema."),

    # 9. Oppmøte, sluttkrav og diplom
    D("9. Oppmøte, sluttkrav og diplom", "Skal fysisk oppmøte være et fullføringskrav?",
      ["A. Ja.", "B. Nei."],
      "A. Oppmøte registreres etter hver samling."),
    D("9. Oppmøte, sluttkrav og diplom", "Kan fravær registreres i enkelttimer?",
      ["A. Ja.", "B. Nei, bare hel samling."],
      "A. Læreren kan føre timebasert fravær."),
    D("9. Oppmøte, sluttkrav og diplom", "Hva er standard oppmøtekrav?",
      ["A. Minst 80 prosent.", "B. 100 prosent på alt."],
      "A. Minst 80 prosent totalt."),
    D("9. Oppmøte, sluttkrav og diplom", "Kan enkelte samlinger være obligatoriske i tillegg?",
      ["A. Ja.", "B. Nei."],
      "A. En samling kan få eget krav, normalt 100 prosent."),
    D("9. Oppmøte, sluttkrav og diplom", "Hvem kan gi unntak ved for lavt oppmøte?",
      ["A. Administrator, med begrunnelse og uendret faktisk prosent.",
       "B. Systemet setter automatisk 80 prosent."],
      "A. Manuell administrativ overstyring."),
    D("9. Oppmøte, sluttkrav og diplom", "Hvilket ekstra krav gjelder Trener 2 og 3?",
      ["A. Universitetsdelen må være fullført.", "B. Ingen ekstra kontroll."],
      "A. Universitetsdelen må være registrert fullført."),
    D("9. Oppmøte, sluttkrav og diplom", "Hvordan registreres universitetsdelen?",
      ["A. Manuell hake satt av administrator, med dato og aktør.",
       "B. Studentens egen avkrysning."],
      "A. Bare administrator kan sette eller fjerne haken."),
    D("9. Oppmøte, sluttkrav og diplom", "Hva skjer når alle sluttkrav er oppfylt?",
      ["A. Kurset godkjennes automatisk.", "B. Alltid en ekstra manuell sluttgodkjenning."],
      "A. Status endres automatisk til fullført."),
    D("9. Oppmøte, sluttkrav og diplom", "Hvordan markeres fullføringen for studenten?",
      ["A. Gratulasjon, konfetti og haptikk der det støttes, med redusert-bevegelse-alternativ.",
       "B. Bare en liten statusetikett."],
      "A. En tydelig feiring uten å bryte tilgjengelighetsvalg."),
    D("9. Oppmøte, sluttkrav og diplom", "Hvordan håndteres diplomet?",
      ["A. Personlig PDF fra NGF-mal, lagret på studentens diplomvegg.",
       "B. Bare en midlertidig nettvisning."],
      "A. Diplomet kan lastes ned igjen senere."),
    D("9. Oppmøte, sluttkrav og diplom", "Hvordan påvirker Ungdomsdriven godkjenningen?",
      ["A. Fravær blokkerer alltid Trener 1.",
       "B. Oppmøte registreres, men fravær kan gi økonomioppgave om mellomlegg uten å blokkere faglig godkjenning."],
      "B. Portalen varsler hvem og hvilken klubb som skal faktureres."),

    # 10. Varsler, meldinger og kursrom
    D("10. Varsler, meldinger og kursrom", "Hvordan planlegges påminnelser?",
      ["A. Faste datoer per kurs/aktivitet og manuelle utsendelser ved behov.",
       "B. Bare spontane manuelle meldinger."],
      "A. Begge deler."),
    D("10. Varsler, meldinger og kursrom", "Hvilke kanaler brukes for læringspåminnelser?",
      ["A. E-post og varsel i portalen.", "B. Bare inne i portalen."],
      "A. Begge kanaler."),
    D("10. Varsler, meldinger og kursrom", "Kan læreren sende en påminnelse fra studentprofilen?",
      ["A. Ja.", "B. Nei."],
      "A. Manuell oppfølging skal være lett tilgjengelig."),
    D("10. Varsler, meldinger og kursrom", "Kan studenten svare på lærerens melding i portalen?",
      ["A. Ja, toveis samtale.", "B. Nei, e-post er enveiskanal."],
      "A. Historikken beholdes i portalen."),
    D("10. Varsler, meldinger og kursrom", "Hvem eier en studentsamtale?",
      ["A. Kurset, slik at autorisert kursstab kan videreføre den.",
       "B. Den ene læreren privat."],
      "A. Samtalen følger kurset og den autoriserte oppfølgingen."),
    D("10. Varsler, meldinger og kursrom", "Hvem varsles når studenten svarer?",
      ["A. Kursansvarlige alltid; involverte faglærere eller de som følger samtalen; gjestelærere ikke.",
       "B. Alle med enhver form for kurstilgang."],
      "A. Varsler styres av oppfølgingsansvar, ikke bare tilstedeværelse.", RECOMMENDED),
    D("10. Varsler, meldinger og kursrom", "Kan kursansvarlig sende melding til hele kurset eller et utvalg?",
      ["A. Begge deler.", "B. Bare én student om gangen."],
      "A. Hele kurset og valgt gruppe støttes."),
    D("10. Varsler, meldinger og kursrom", "Skal kursrom kunne aktiveres?",
      ["A. Ja, valgfritt, med studentens eksplisitte opt-in.",
       "B. Nei, aldri."],
      "A. Funksjonen planlegges bak funksjonsflagg; eksplisitt go/no-go kreves før bygging."),
    D("10. Varsler, meldinger og kursrom", "Kan studenter opprette egne innlegg i kursrommet?",
      ["A. Ja.", "B. Nei, bare svare."],
      "A. Hvis kursrommet aktiveres, kan medlemmer opprette og svare."),
    D("10. Varsler, meldinger og kursrom", "Skal private meldinger mellom studenter være med i V1?",
      ["A. Ja.", "B. Nei, vurder senere etter egen beslutning."],
      "B. Ikke V1; må godkjennes eksplisitt før utvikling."),

    # 11. Rapporter og objektiv AI
    D("11. Rapporter og objektiv AI", "Hvilke eksportformater skal operative rapporter ha?",
      ["A. PDF og Excel.", "B. Bare skjermvisning."],
      "A. Begge formater."),
    D("11. Rapporter og objektiv AI", "Hvilke rapporter ser kursansvarlige?",
      ["A. Egne kurs.", "B. Alle kurs og all historikk."],
      "A. Bare egne tildelte kurs."),
    D("11. Rapporter og objektiv AI", "Hvilken historikk ser faglærere?",
      ["A. Løpende data i egne aktive kurs.",
       "B. Alle tidligere år og sammenligninger."],
      "A. Aktivt kurs, også når Trener 3 går over to år."),
    D("11. Rapporter og objektiv AI", "Hvem får AI-tilgang i V1?",
      ["A. Bare administrator.", "B. Alle lærere og studenter."],
      "A. Kun administrator."),
    D("11. Rapporter og objektiv AI", "Hva kan AI-en gjøre?",
      ["A. Lese strukturerte data og svare på tillatte objektive spørsmål.",
       "B. Endre data, tilganger og vurderinger."],
      "A. AI er skrivebeskyttet."),
    D("11. Rapporter og objektiv AI", "Skal AI-en tolke eller risikovurdere studentene?",
      ["A. Ja, lag egen risikoscore.",
       "B. Nei, returner objektive tall, statuser og definisjoner."],
      "B. Ingen prediksjon eller fri vurdering."),
    D("11. Rapporter og objektiv AI", "Kan administratorens AI-svar bruke navn?",
      ["A. Ja, innen autorisert visning og eksport.", "B. Bare anonymiserte tall."],
      "A. Navn kan brukes."),
    D("11. Rapporter og objektiv AI", "Hva betyr 'hvor mange har fullført'?",
      ["A. Bare deltakere med 100 prosent og formell fullførtstatus.",
       "B. Alle som har startet."],
      "A. Kun faktisk fullførte."),
    D("11. Rapporter og objektiv AI", "Hva betyr 'fullføringsprosent på et kull'?",
      ["A. Gjennomsnitt av individuell progresjon for aktive deltakere.",
       "B. Andel inviterte som har logget inn."],
      "A. Snittet vises, og trukne deltakere holdes utenfor."),
    D("11. Rapporter og objektiv AI", "Skal hele AI-spørsmålet og svaret lagres som sensitiv historikk?",
      ["A. Nei, ikke som full innholdshistorikk; behold bare nødvendig teknisk/audit-metadata.",
       "B. Ja, lagre alt permanent."],
      "A. Full prompt/resultatlogg er ikke et produktkrav.", UPDATED,
      "Eksporter og administrative sikkerhetshendelser kan fortsatt logges uten å lagre hele AI-samtalen."),
    D("11. Rapporter og objektiv AI", "Hvilke minimumsspørsmål skal AI-en støtte?",
      ["A. Individuell progresjon, kullsnitt, fullførte, kurssted, mangler, fravær og praksis.",
       "B. Fri SQL og vilkårlige analyser."],
      "A. En kontrollert liste med dokumenterte beregninger.", RECOMMENDED),

    # 12. Checkin, import og historikk
    D("12. Checkin, import og historikk", "Hvor håndteres påmelding og betaling i V1?",
      ["A. Checkin.", "B. Bygg en ny betalings- og påmeldingsmotor i portalen."],
      "A. Checkin beholdes som systemeier."),
    D("12. Checkin, import og historikk", "Hvordan kommer påmeldte inn i portalen?",
      ["A. Original Excel-eksport fra Checkin lastes opp.",
       "B. Manuell registrering av hver deltaker."],
      "A. Ett-klikk filvalg med forhåndsvisning før bekreftelse."),
    D("12. Checkin, import og historikk", "Hvem er kvalifisert for portalinvitasjon?",
      ["A. Alle som er påmeldt i Checkin.",
       "B. Bare de som har en bestemt betalingsstatus."],
      "A. Betalingsstatus blokkerer ikke invitasjonen."),
    D("12. Checkin, import og historikk", "Hvordan håndteres privat betaling og klubbfaktura?",
      ["A. Checkin håndterer betalingsmåte; portalen krever ikke et ekstra steg.",
       "B. Portalen kopierer økonomilogikken."],
      "A. Økonomi forblir i Checkin."),
    D("12. Checkin, import og historikk", "Hva skjer hvis en deltaker mangler i en nyere fil?",
      ["A. Tilgangen fjernes automatisk.",
       "B. Ingen automatisk fjerning; raden flagges eventuelt for kontroll."],
      "B. Manglende rad betyr ikke sikkert avmelding."),
    D("12. Checkin, import og historikk", "Hvordan gjenkjennes filstrukturen?",
      ["A. Fast NGF-rapportmal og kolonnenavn, ikke kolonnerekkefølge.",
       "B. Anta at alle eksporter alltid er identiske."],
      "A. Importen validerer og viser forståelige feil."),
    D("12. Checkin, import og historikk", "Hvem sender hvilke påminnelser?",
      ["A. Checkin sender ordre/betaling; portalen sender læring, frister og vurdering.",
       "B. Begge systemer sender alt."],
      "A. Én tydelig eier per meldingstype.", RECOMMENDED),
    D("12. Checkin, import og historikk", "Kan tidligere år importeres?",
      ["A. Ja, fra Excel.", "B. Nei."],
      "A. Historisk import støttes."),
    D("12. Checkin, import og historikk", "Hvilke minimumsfelt brukes i historisk import?",
      ["A. Navn, klubb, e-post, år/kurs og kolonnen 'bestått'.",
       "B. Bare navn."],
      "A. Horisontale kolonner med beståttstatus."),
    D("12. Checkin, import og historikk", "Skal historiske importdata vises på studentens profil/diplomvegg?",
      ["A. Ja.", "B. Nei, de brukes i administratorrapportering."],
      "B. Studenten ser bare aktivt kursår."),
    D("12. Checkin, import og historikk", "Hva må skje før Checkin-importen låses for produksjon?",
      ["A. Test med en redigert originaleksport som dekker privat, klubbfaktura og Ungdomsdriven.",
       "B. Bygg importen uten eksempeldata."],
      "A. Faktisk filformat er en hard port.", GATE),

    # 13. Deltakerstatus, personvern og sikkerhet
    D("13. Deltakerstatus, personvern og sikkerhet", "Hvem kan markere en student som trukket?",
      ["A. Kursleder eller administrator.", "B. Alle lærere."],
      "A. Handlingen heter 'Marker som trukket', ikke slett."),
    D("13. Deltakerstatus, personvern og sikkerhet", "Hva skjer når studenten markeres som trukket?",
      ["A. Tilgang stenges, data beholdes, og status kan reverseres med ett tastetrykk.",
       "B. Alt slettes permanent."],
      "A. Trukket er en reverserbar læringsstatus."),
    D("13. Deltakerstatus, personvern og sikkerhet", "Hva skjer med frister etter gjenåpning?",
      ["A. Opprinnelige frister beholdes; utløpte frister må forlenges manuelt per krav.",
       "B. Alle frister flyttes automatisk."],
      "A. Ingen automatisk omskriving av historikken."),
    D("13. Deltakerstatus, personvern og sikkerhet", "Hva er alderskravet?",
      ["A. Deltakeren kan starte i kalenderåret vedkommende fyller 15.",
       "B. Deltakeren må være 18."],
      "A. Kalenderåret studenten fyller 15."),
    D("13. Deltakerstatus, personvern og sikkerhet", "Kreves foresattes godkjenning i dagens prosess?",
      ["A. Ja.", "B. Nei, ikke i dag; personvernansvarlig må kontrollere produksjonsgrunnlaget."],
      "B. Ingen etablert godkjenningsflyt i dag."),
    D("13. Deltakerstatus, personvern og sikkerhet", "Hvor mye fødselsdata lagres?",
      ["A. Fødselsår eller kontrollert alder-verifisert-status.",
       "B. Full fødselsdato uten dokumentert behov."],
      "A. Minimer data."),
    D("13. Deltakerstatus, personvern og sikkerhet", "Hvor lenge beholdes gamle innleveringer og kommentarer?",
      ["A. En dokumentert sletteregel fastsettes av NGFs personvernansvarlige før produksjon; minimumsbevis for bestått beholdes separat.",
       "B. Alt beholdes for alltid uten vurdering."],
      "A. Bygg teknisk støtte for sletting/anonymisering og lås fristen i personvernporten.", GATE,
      "Bruker ønsker særlig at data for ikke-bestått kan finnes så lenge det er lovlig, men endelig frist krever behandlingsgrunnlag."),
    D("13. Deltakerstatus, personvern og sikkerhet", "Hvor skal produksjonsdata lagres?",
      ["A. EU/EØS-region med databehandleravtaler.", "B. Vilkårlig region."],
      "A. EU/EØS er krav før produksjon.", RECOMMENDED),
    D("13. Deltakerstatus, personvern og sikkerhet", "Hvordan håndheves tilganger?",
      ["A. Server-side autorisasjon og radnivåsikkerhet i databasen.",
       "B. Bare skjule knapper i grensesnittet."],
      "A. Sikkerhetsgrensen ligger på server og i database.", RECOMMENDED),
    D("13. Deltakerstatus, personvern og sikkerhet", "Hva må verifiseres før pilot?",
      ["A. Tilgjengelighet, backup/gjenoppretting, tilgang, logging og personvernporter.",
       "B. Bare at startsiden åpner."],
      "A. Risikobasert kontroll med dokumenterte bevis.", RECOMMENDED),
    D("13. Deltakerstatus, personvern og sikkerhet", "Hvordan behandles opplastede filer?",
      ["A. Type-/størrelseskontroll, skadevareskann, privat lagring og tilgangsstyrt nedlasting.",
       "B. Offentlig, ukontrollert fil-URL."],
      "A. Sikker filbehandling er standard.", RECOMMENDED),

    # 14. Design, teknikk og gjennomføring
    D("14. Design, teknikk og gjennomføring", "Hvilket designsystem gjelder?",
      ["A. Det godkjente moderne NGF-systemet i DESIGN.md.",
       "B. Den avviste mørke mocken."],
      "A. Godkjent designsystem er styrende."),
    D("14. Design, teknikk og gjennomføring", "Hvor ligger hovednavigasjonen på desktop?",
      ["A. Fast venstremeny.", "B. Bare toppmeny."],
      "A. Menyen ligger til venstre."),
    D("14. Design, teknikk og gjennomføring", "Skal løsningen fungere på mobil?",
      ["A. Ja, responsivt; desktop kan anbefales for avansert innhold og administrasjon.",
       "B. Nei, mobil blokkeres."],
      "A. Mobil støttes, men desktop anbefales der det gir bedre opplevelse."),
    D("14. Design, teknikk og gjennomføring", "Hvordan styres modell og innsats?",
      ["A. High/XHigh for trygg UI, Max for komplekse flyter og Ultra for høy risiko.",
       "B. Ultra på alt."],
      "A. Selektiv innsats gir kvalitet uten å stoppe fremdriften."),
    D("14. Design, teknikk og gjennomføring", "Når brukes Sol Ultra?",
      ["A. RLS, innlogging, persondata, import, sammenslåing og administrator-AI.",
       "B. Hver enkel tekst- og stilendring."],
      "A. Bare på sikkerhets- og datakritiske endringer."),
    D("14. Design, teknikk og gjennomføring", "Hvordan gjennomføres kodekontroll?",
      ["A. Hurtig port på vanlige endringer og full kontroll ved risikorelevante fasegater.",
       "B. Full revisjon av alt ved hvert tastetrykk."],
      "A. Risikobasert kontroll skal bevare progresjon."),
    D("14. Design, teknikk og gjennomføring", "Hvordan utføres planen i denne oppgaven?",
      ["A. Inline i samme oppgave, med avgrensede spesialistkontroller ved behov.",
       "B. Flytt all bygging til separate oppgaver uten konteksten."],
      "A. Samme oppgave beholder beslutningskonteksten."),
    D("14. Design, teknikk og gjennomføring", "Er Docker/lokal Supabase en del av utviklingsgrunnlaget?",
      ["A. Ja, for database-, RLS- og integrasjonstester.",
       "B. Nei, hopp over lokal databasetest."],
      "A. Lokal Supabase brukes når Docker fungerer."),
    D("14. Design, teknikk og gjennomføring", "Hvilke leveranser er harde porter før produksjon?",
      ["A. Checkin-format, EU-hosting/personvern, diplommal, innholdsinventar og driftsansvar.",
       "B. Ingen eksterne bevis er nødvendig."],
      "A. Fem navngitte porter må lukkes.", GATE),
    D("14. Design, teknikk og gjennomføring", "Hva er V1-regelen når en funksjon er ønskelig, men ikke nødvendig for pilot?",
      ["A. Legg den bak funksjonsflagg eller i senere versjon med eksplisitt go/no-go.",
       "B. Utvid V1 automatisk."],
      "A. Beskytt desemberfristen med styrt omfang.", RECOMMENDED),
]


def sanitized(value: str) -> str:
    # PDF production rule: use ASCII hyphens, never en/em dashes.
    return (
        value.replace("–", "-")
        .replace("—", "-")
        .replace("‑", "-")
        .replace("\u00a0", " ")
    )


for d in decisions:
    fields = [d.section, d.question, *d.alternatives, d.answer, d.status, d.note]
    if any(any(mark in field for mark in ("–", "—", "‑")) for field in fields):
        # Values are sanitized during rendering; this assertion documents the rule.
        pass


PAGE_W, PAGE_H = A4
MARGIN_X = 17 * mm
MARGIN_TOP = 19 * mm
MARGIN_BOTTOM = 17 * mm

INK = colors.HexColor("#10251A")
GREEN = colors.HexColor("#187A45")
DARK_GREEN = colors.HexColor("#0B2B1E")
PALE_GREEN = colors.HexColor("#E6F2E9")
MINT = colors.HexColor("#F2F7F3")
LINE = colors.HexColor("#CFD9D2")
MUTED = colors.HexColor("#607067")
AMBER = colors.HexColor("#9B5B00")
PALE_AMBER = colors.HexColor("#FFF2D8")
PALE_BLUE = colors.HexColor("#EEF2FF")
BLUE = colors.HexColor("#3153B8")
WHITE = colors.white


def register_fonts() -> None:
    fonts = Path("C:/Windows/Fonts")
    pdfmetrics.registerFont(TTFont("Arial", str(fonts / "arial.ttf")))
    pdfmetrics.registerFont(TTFont("Arial-Bold", str(fonts / "arialbd.ttf")))
    pdfmetrics.registerFont(TTFont("Arial-Italic", str(fonts / "ariali.ttf")))
    pdfmetrics.registerFontFamily(
        "Arial", normal="Arial", bold="Arial-Bold", italic="Arial-Italic", boldItalic="Arial-Bold"
    )


register_fonts()

styles = getSampleStyleSheet()
styles.add(ParagraphStyle(
    name="CoverKicker", fontName="Arial-Bold", fontSize=9, leading=11,
    textColor=GREEN, spaceAfter=8, uppercase=True,
))
styles.add(ParagraphStyle(
    name="CoverTitle", fontName="Arial-Bold", fontSize=30, leading=33,
    textColor=DARK_GREEN, spaceAfter=12,
))
styles.add(ParagraphStyle(
    name="CoverSubtitle", fontName="Arial", fontSize=13, leading=19,
    textColor=MUTED, spaceAfter=22,
))
styles.add(ParagraphStyle(
    name="H1x", fontName="Arial-Bold", fontSize=21, leading=25,
    textColor=DARK_GREEN, spaceAfter=8, keepWithNext=True,
))
styles.add(ParagraphStyle(
    name="Lead", fontName="Arial", fontSize=10.5, leading=15.5,
    textColor=MUTED, spaceAfter=10,
))
styles.add(ParagraphStyle(
    name="QMeta", fontName="Arial-Bold", fontSize=7.4, leading=9,
    textColor=GREEN, spaceAfter=5,
))
styles.add(ParagraphStyle(
    name="Question", fontName="Arial-Bold", fontSize=11.4, leading=15,
    textColor=INK, spaceAfter=7,
))
styles.add(ParagraphStyle(
    name="Option", fontName="Arial", fontSize=9.1, leading=12.6,
    textColor=INK,
))
styles.add(ParagraphStyle(
    name="Answer", fontName="Arial-Bold", fontSize=9.5, leading=13,
    textColor=DARK_GREEN,
))
styles.add(ParagraphStyle(
    name="Note", fontName="Arial-Italic", fontSize=8.2, leading=11.5,
    textColor=MUTED,
))
styles.add(ParagraphStyle(
    name="Small", fontName="Arial", fontSize=8.5, leading=12,
    textColor=MUTED,
))
styles.add(ParagraphStyle(
    name="SummaryNumber", fontName="Arial-Bold", fontSize=21, leading=22,
    textColor=DARK_GREEN, alignment=TA_CENTER,
))
styles.add(ParagraphStyle(
    name="SummaryLabel", fontName="Arial", fontSize=8.2, leading=10,
    textColor=MUTED, alignment=TA_CENTER,
))
styles.add(ParagraphStyle(
    name="TOC", fontName="Arial", fontSize=9.5, leading=13,
    textColor=INK,
))


class DecisionDoc(BaseDocTemplate):
    def __init__(self, filename: str):
        super().__init__(
            filename,
            pagesize=A4,
            rightMargin=MARGIN_X,
            leftMargin=MARGIN_X,
            topMargin=MARGIN_TOP,
            bottomMargin=MARGIN_BOTTOM,
            title="Trenerutdanningsportalen - sporsmal, alternativer og beslutninger",
            author="Norges Golfforbund / prosjektintervju",
            subject="Komplett beslutningslogg for Trenerutdanningsportalen",
        )
        frame = Frame(
            self.leftMargin,
            self.bottomMargin,
            self.width,
            self.height,
            id="normal",
            leftPadding=0,
            rightPadding=0,
            topPadding=0,
            bottomPadding=0,
        )
        self.addPageTemplates([PageTemplate(id="all", frames=[frame], onPage=self._draw_page)])

    def _draw_page(self, canvas, doc) -> None:
        canvas.saveState()
        if doc.page > 1:
            canvas.setStrokeColor(LINE)
            canvas.setLineWidth(0.5)
            canvas.line(MARGIN_X, PAGE_H - 11.5 * mm, PAGE_W - MARGIN_X, PAGE_H - 11.5 * mm)
            canvas.setFont("Arial-Bold", 7.5)
            canvas.setFillColor(DARK_GREEN)
            canvas.drawString(MARGIN_X, PAGE_H - 9 * mm, "TRENERUTDANNINGSPORTALEN")
            canvas.setFont("Arial", 7.5)
            canvas.setFillColor(MUTED)
            canvas.drawRightString(PAGE_W - MARGIN_X, PAGE_H - 9 * mm, "Beslutningslogg - 31.08.2026")
        canvas.setFont("Arial", 7.5)
        canvas.setFillColor(MUTED)
        canvas.drawString(MARGIN_X, 9 * mm, "Konfidensielt arbeidsdokument - brukerbeslutninger og anbefalte standardvalg")
        canvas.drawRightString(PAGE_W - MARGIN_X, 9 * mm, f"Side {doc.page}")
        canvas.restoreState()


def P(text: str, style: str) -> Paragraph:
    return Paragraph(html.escape(sanitized(text)), styles[style])


def rich(text: str, style: str) -> Paragraph:
    return Paragraph(sanitized(text), styles[style])


def status_colors(status: str):
    if status == USER:
        return PALE_GREEN, GREEN
    if status == UPDATED:
        return PALE_BLUE, BLUE
    if status == GATE:
        return PALE_AMBER, AMBER
    return colors.HexColor("#F1F3F2"), MUTED


def question_card(number: int, decision: Decision):
    background, accent = status_colors(decision.status)
    option_rows = []
    answer_key = decision.answer[:1]
    for option in decision.alternatives:
        selected = option.startswith(answer_key + ".")
        marker = "VALGT" if selected else ""
        option_rows.append([
            P(marker, "QMeta"),
            P(option, "Option"),
        ])
    alternatives = Table(option_rows, colWidths=[15 * mm, 145 * mm], hAlign="LEFT")
    alternatives.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 0),
        ("RIGHTPADDING", (0, 0), (-1, -1), 4),
        ("TOPPADDING", (0, 0), (-1, -1), 2.5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
        ("TEXTCOLOR", (0, 0), (0, -1), GREEN),
    ]))

    answer_table = Table(
        [[P("GJELDENDE SVAR", "QMeta"), P(decision.answer, "Answer")]],
        colWidths=[32 * mm, 128 * mm],
        hAlign="LEFT",
    )
    answer_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), background),
        ("BOX", (0, 0), (-1, -1), 0.7, accent),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 6),
        ("RIGHTPADDING", (0, 0), (-1, -1), 6),
        ("TOPPADDING", (0, 0), (-1, -1), 6),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
    ]))

    body = [
        P(f"Q{number:03d}  |  {decision.status}", "QMeta"),
        P(decision.question, "Question"),
        alternatives,
        Spacer(1, 4),
        answer_table,
    ]
    if decision.note:
        body.extend([Spacer(1, 5), P("Merknad: " + decision.note, "Note")])

    card = Table([[body]], colWidths=[166 * mm], hAlign="LEFT")
    card.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), colors.white),
        ("BOX", (0, 0), (-1, -1), 0.55, LINE),
        ("LEFTPADDING", (0, 0), (-1, -1), 8),
        ("RIGHTPADDING", (0, 0), (-1, -1), 8),
        ("TOPPADDING", (0, 0), (-1, -1), 8),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
    ]))
    return KeepTogether([card, Spacer(1, 7)])


def build_story():
    story = []
    counts = {
        USER: sum(d.status == USER for d in decisions),
        UPDATED: sum(d.status == UPDATED for d in decisions),
        RECOMMENDED: sum(d.status == RECOMMENDED for d in decisions),
        GATE: sum(d.status == GATE for d in decisions),
    }
    sections = []
    for d in decisions:
        if d.section not in sections:
            sections.append(d.section)

    # Cover
    story.extend([
        Spacer(1, 16 * mm),
        P("NORGES GOLFFORBUND / TRENERUTDANNING", "CoverKicker"),
        P("Spørsmål, alternativer og beslutninger", "CoverTitle"),
        P(
            "Komplett og konsolidert beslutningslogg for Trenerutdanningsportalen, "
            "basert på prosjektintervjuet, kravbasen og de seneste presiseringene.",
            "CoverSubtitle",
        ),
    ])
    stat_data = [
        [rich(str(len(decisions)), "SummaryNumber"), rich(str(len(sections)), "SummaryNumber"),
         rich(str(counts[RECOMMENDED]), "SummaryNumber"), rich(str(counts[GATE]), "SummaryNumber")],
        [P("unike beslutningsspørsmål", "SummaryLabel"), P("temaer", "SummaryLabel"),
         P("anbefalte standardvalg", "SummaryLabel"), P("kontrollpunkter", "SummaryLabel")],
    ]
    stats = Table(stat_data, colWidths=[41.5 * mm] * 4)
    stats.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), MINT),
        ("BOX", (0, 0), (-1, -1), 0.6, LINE),
        ("INNERGRID", (0, 0), (-1, -1), 0.4, LINE),
        ("TOPPADDING", (0, 0), (-1, 0), 10),
        ("BOTTOMPADDING", (0, 0), (-1, 0), 2),
        ("TOPPADDING", (0, 1), (-1, 1), 2),
        ("BOTTOMPADDING", (0, 1), (-1, 1), 10),
    ]))
    story.extend([stats, Spacer(1, 16 * mm)])

    legend = Table([
        [P(USER, "Answer"), P("Direkte valgt eller formulert av brukeren.", "Small")],
        [P(UPDATED, "Answer"), P("Nyere presisering erstatter et tidligere valg.", "Small")],
        [P(RECOMMENDED, "Answer"), P("Valgt på brukerens fullmakt til å bruke anbefalt alternativ på resten.", "Small")],
        [P(GATE, "Answer"), P("Sikker standard er valgt, men eksternt bevis må foreligge før produksjon.", "Small")],
    ], colWidths=[56 * mm, 110 * mm])
    legend.setStyle(TableStyle([
        ("BOX", (0, 0), (-1, -1), 0.6, LINE),
        ("INNERGRID", (0, 0), (-1, -1), 0.35, LINE),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 7),
        ("RIGHTPADDING", (0, 0), (-1, -1), 7),
        ("TOPPADDING", (0, 0), (-1, -1), 6),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
    ]))
    story.extend([
        P("Slik leses dokumentet", "Question"),
        legend,
        Spacer(1, 8 * mm),
        P(
            "Rene statusspørsmål, feilsøkingsdialog og forespørsler om å laste opp en fil er ikke "
            "behandlet som produktbeslutninger. Gjentatte spørsmål er slått sammen. Alle reelle valg, "
            "ombestemmelser og gjenstående produksjonsporter er med.",
            "Small",
        ),
        Spacer(1, 8 * mm),
        P("Datert 31. august 2026", "QMeta"),
        PageBreak(),
    ])

    # Table of contents
    story.extend([
        P("Innhold", "H1x"),
        P("Beslutningene er sortert etter den delen av produktet de styrer.", "Lead"),
    ])
    for section in sections:
        count = sum(d.section == section for d in decisions)
        toc_row = Table([[P(section, "TOC"), P(f"{count} spørsmål", "QMeta")]], colWidths=[137 * mm, 29 * mm])
        toc_row.setStyle(TableStyle([
            ("LINEBELOW", (0, 0), (-1, -1), 0.4, LINE),
            ("LEFTPADDING", (0, 0), (-1, -1), 0),
            ("RIGHTPADDING", (0, 0), (-1, -1), 0),
            ("TOPPADDING", (0, 0), (-1, -1), 6),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ]))
        story.append(toc_row)
    story.extend([PageBreak()])

    # Decision sections
    number = 1
    for section_index, section in enumerate(sections):
        if section_index:
            story.append(PageBreak())
        section_decisions = [d for d in decisions if d.section == section]
        story.extend([
            P(section, "H1x"),
            P(f"{len(section_decisions)} konsoliderte beslutningsspørsmål.", "Lead"),
            Spacer(1, 2),
        ])
        for d in section_decisions:
            story.append(question_card(number, d))
            number += 1

    # Source and usage notes
    story.extend([
        PageBreak(),
        P("Kilder og bruk", "H1x"),
        P(
            "Dokumentet er konsolidert fra den aktive prosjektoppgaven 'Læringsløp Trenerutdannign', "
            "kravbasen datert 30. august 2026, implementeringsplanene, DESIGN.md og de seneste "
            "presiseringene om filbaserte presentasjoner.",
            "Lead",
        ),
        P("Kilde 1", "QMeta"),
        P("Aktiv prosjektoppgave: 01a04db5-7982-7830-a4fe-91d69b9b14cc.", "Small"),
        Spacer(1, 5),
        P("Kilde 2", "QMeta"),
        P("docs/specs/2026-08-30-trenerutdanningsportalen-v1.md.", "Small"),
        Spacer(1, 5),
        P("Kilde 3", "QMeta"),
        P("docs/superpowers/plans/2026-08-30-trenerutdanningsportalen-v1-master.md og delplanene.", "Small"),
        Spacer(1, 5),
        P("Kilde 4", "QMeta"),
        P("DESIGN.md og implementert portal i branch codex/portal-v1.", "Small"),
        Spacer(1, 10),
        P(
            "Ved motstrid gjelder den nyeste presiseringen i dette dokumentet. Punkter merket som "
            "kontrollpunkt skal ikke gjøres om til produksjonsantakelser uten det navngitte beviset.",
            "Answer",
        ),
    ])
    return story


def main() -> None:
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    doc = DecisionDoc(str(OUTPUT))
    doc.build(build_story())
    print(f"Wrote {OUTPUT}")
    print(f"Questions: {len(decisions)}")


if __name__ == "__main__":
    main()
