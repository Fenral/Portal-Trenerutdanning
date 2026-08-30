# ADR-001: Egen modulær portal for V1

- Status: Accepted
- Dato: 30. august 2026

## Beslutning

Trenerutdanningsportalen bygges som en modulær monolitt i Next.js med Supabase PostgreSQL, Auth og Storage i EU. Checkin forblir autoritativ kilde for påmelding og betaling.

## Konsekvenser

- NGF eier produkt- og applikasjonslivsløpet.
- NIF/Idrettens ID ligger utenfor V1 og skjermes bak en fremtidig identitetsadapter.
- Domenemoduler kommuniserer gjennom typede tjenester og databasehendelser, ikke direkte UI-spørringer.
- Arbeidet stopper før produksjonsdata dersom hosting- og personverngodkjenningen ikke oppnås.
