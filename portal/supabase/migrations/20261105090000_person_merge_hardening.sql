-- Herding av person-merge og anonymisering. Lukker fire beviste funn fra
-- uavhengig review. 20261102090000_person_merges.sql er kjørt i produksjon og
-- endres ikke; alle fikser skjer med create or replace her.
--
--   Funn 1: aktivitetsdeteksjonen så bare 4 av 10 aktivitetsbærende tabeller —
--           oppmøte, quizforsøk, universitetskrav, progresjon, fullførings-
--           unntak og praksisføringer kunne gå tapt i en sammenslåing.
--   Funn 2: reverseringsfingeravtrykket hadde samme blindsone, så ny aktivitet
--           av disse typene ble flyttet tilbake til forkastet profil.
--   Funn 3: anonymisering fulgte merge-grafen kun ett hopp og skrubbet ikke
--           uinnløste invitasjoner til duplikatenes e-postadresser.
--   Funn 4: anonymize_person manglet privilegert-mål-vern, selvanonymiserings-
--           vern og robust godkjennerkontroll, og revokerte ikke målets roller.
--   Funn 5: anonymisering av et merge-skall (aktiv kilde i en ureversert
--           sammenslåing) lot kursbevis og roller flyttet nedstrøms stå igjen
--           i klartekst/aktive; slike mål avvises nå.

-- Funn 1: registrert arbeid = en rad i en hvilken som helst aktivitetsbærende
-- tabell. enrollment_progress auto-initialiseres ved påmelding, så der teller
-- kun faktisk registrert fullført vekt/antall som aktivitet.
create or replace function private.enrollment_has_activity(target_enrollment_id uuid)
returns boolean
language sql
stable
set search_path = ''
as $$
  select exists (
      select 1 from public.activity_completions
      where enrollment_id = target_enrollment_id
    )
    or exists (
      select 1 from public.assignment_submissions
      where enrollment_id = target_enrollment_id
    )
    or exists (
      select 1 from public.practice_submissions
      where enrollment_id = target_enrollment_id
    )
    or exists (
      select 1 from public.certificates
      where enrollment_id = target_enrollment_id
    )
    or exists (
      select 1 from public.attendance_records
      where enrollment_id = target_enrollment_id
    )
    or exists (
      select 1 from public.quiz_attempts
      where enrollment_id = target_enrollment_id
    )
    or exists (
      select 1 from public.university_requirements
      where enrollment_id = target_enrollment_id
    )
    or exists (
      select 1 from public.completion_overrides
      where enrollment_id = target_enrollment_id
    )
    or exists (
      select 1 from public.practice_entries
      where enrollment_id = target_enrollment_id
    )
    or exists (
      select 1 from public.enrollment_progress
      where enrollment_id = target_enrollment_id
        and (completed_weight > 0 or completed_required_count > 0)
    );
$$;

-- Funn 2: fingeravtrykket dekker samme fulle tabellsett som deteksjonen, slik
-- at ny aktivitet av enhver type gir manual_reversal_required.
--
-- Bevisst konsekvens: sammenslåinger gjort FØR denne migrasjonen fikk lagret
-- det gamle, smalere fingeravtrykket og vil nå alltid gi
-- manual_reversal_required — de seks tidligere usynlige tabellene kan ikke
-- etterverifiseres, så automatisk reversering av dem ville vært utrygg.
create or replace function private.enrollment_activity_fingerprint(target_enrollment_id uuid)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select jsonb_build_object(
    'activityCompletions', (
      select count(*) from public.activity_completions
      where enrollment_id = target_enrollment_id
    ),
    'assignmentSubmissions', (
      select count(*) from public.assignment_submissions
      where enrollment_id = target_enrollment_id
    ),
    'assignmentSubmissionsUpdatedAt', private.ts_jsonb((
      select max(updated_at) from public.assignment_submissions
      where enrollment_id = target_enrollment_id
    )),
    'practiceSubmissions', (
      select count(*) from public.practice_submissions
      where enrollment_id = target_enrollment_id
    ),
    'practiceSubmissionsUpdatedAt', private.ts_jsonb((
      select max(updated_at) from public.practice_submissions
      where enrollment_id = target_enrollment_id
    )),
    'enrollmentProgressUpdatedAt', private.ts_jsonb((
      select max(updated_at) from public.enrollment_progress
      where enrollment_id = target_enrollment_id
    )),
    'certificates', (
      select count(*) from public.certificates
      where enrollment_id = target_enrollment_id
    ),
    'attendanceRecords', (
      select count(*) from public.attendance_records
      where enrollment_id = target_enrollment_id
    ),
    'attendanceRecordsUpdatedAt', private.ts_jsonb((
      select max(updated_at) from public.attendance_records
      where enrollment_id = target_enrollment_id
    )),
    'quizAttempts', (
      select count(*) from public.quiz_attempts
      where enrollment_id = target_enrollment_id
    ),
    'quizAttemptsSubmittedAt', private.ts_jsonb((
      select max(submitted_at) from public.quiz_attempts
      where enrollment_id = target_enrollment_id
    )),
    'universityRequirements', (
      select count(*) from public.university_requirements
      where enrollment_id = target_enrollment_id
    ),
    'universityRequirementsUpdatedAt', private.ts_jsonb((
      select max(updated_at) from public.university_requirements
      where enrollment_id = target_enrollment_id
    )),
    'completionOverrides', (
      select count(*) from public.completion_overrides
      where enrollment_id = target_enrollment_id
    ),
    'completionOverridesApprovedAt', private.ts_jsonb((
      select max(approved_at) from public.completion_overrides
      where enrollment_id = target_enrollment_id
    )),
    'practiceEntries', (
      select count(*) from public.practice_entries
      where enrollment_id = target_enrollment_id
    ),
    'practiceEntriesCreatedAt', private.ts_jsonb((
      select max(created_at) from public.practice_entries
      where enrollment_id = target_enrollment_id
    )),
    'enrollmentProgressRows', (
      select count(*) from public.enrollment_progress
      where enrollment_id = target_enrollment_id
    )
  );
$$;

-- Funn 3 + 4: anonymisering følger hele merge-kjeden rekursivt, skrubber alle
-- uinnløste invitasjoner til kjedens e-postadresser, avviser privilegerte og
-- egne profiler som mål, autentiserer godkjenneren strengere og revokerer
-- målets roller i samme transaksjon.
create or replace function public.anonymize_person(
  target_profile_id uuid,
  case_reference text,
  approver_profile_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_profile_id uuid;
  profile_record public.profiles%rowtype;
  anonymized_account_ids uuid[];
  chain_profile_ids uuid[];
  chain_emails text[];
begin
  actor_profile_id := private.current_profile_id();

  if actor_profile_id is null or not private.is_administrator() then
    raise exception using errcode = '42501', message = 'ANONYMIZE_FORBIDDEN';
  end if;

  if coalesce(char_length(btrim(case_reference)), 0) = 0 then
    raise exception using
      errcode = '22023', message = 'ANONYMIZE_CASE_REFERENCE_REQUIRED';
  end if;

  -- Funn 4d: ingen anonymiserer seg selv.
  if anonymize_person.target_profile_id = actor_profile_id then
    raise exception using
      errcode = '42501', message = 'ANONYMIZE_SELF_FORBIDDEN';
  end if;

  -- Funn 4b: godkjenneren må være forskjellig fra både utfører og mål …
  if approver_profile_id is null
    or approver_profile_id = actor_profile_id
    or approver_profile_id = anonymize_person.target_profile_id then
    raise exception using
      errcode = '22023', message = 'ANONYMIZE_APPROVER_MUST_DIFFER';
  end if;

  -- … ha en aktiv administratorrolle …
  if not exists (
    select 1 from public.role_assignments
    where profile_id = approver_profile_id
      and role = 'administrator'
      and revoked_at is null
  ) then
    raise exception using
      errcode = '22023', message = 'ANONYMIZE_APPROVER_NOT_ADMINISTRATOR';
  end if;

  -- … og ikke selv være et anonymisert skall.
  if exists (
    select 1 from public.profiles
    where id = approver_profile_id
      and normalized_email like '%@anonymisert.invalid'
  ) then
    raise exception using
      errcode = '22023', message = 'ANONYMIZE_APPROVER_ANONYMIZED';
  end if;

  select * into profile_record
  from public.profiles
  where id = anonymize_person.target_profile_id
  for update;

  if not found then
    raise exception using
      errcode = '22023', message = 'ANONYMIZE_PROFILE_NOT_FOUND';
  end if;

  -- Funn 5: et duplikat-skall som selv er slått sammen inn i en annen profil
  -- kan ikke anonymiseres — merge-kjeden traverseres kun oppstrøms, så
  -- enrollments (og dermed kursbevis) og roller mergen flyttet NEDSTRØMS
  -- ligger utenfor kjeden og ville beholdt klartekstnavn og aktive roller.
  -- Sletteforespørselen må rettes mot den overlevende profilen (som dekker
  -- hele kjeden), eller sammenslåingen må reverseres først.
  if exists (
    select 1 from public.person_merges
    where source_profile_id = anonymize_person.target_profile_id
      and reversed_at is null
  ) then
    raise exception using
      errcode = '22023', message = 'ANONYMIZE_MERGED_SOURCE';
  end if;

  -- Funn 4a: privilegerte mål avvises — administrator-/redaktørroller må
  -- revokeres eksplisitt før personen kan anonymiseres.
  if exists (
    select 1 from public.role_assignments
    where profile_id = anonymize_person.target_profile_id
      and role in ('administrator', 'editor')
      and revoked_at is null
  ) then
    raise exception using
      errcode = '42501', message = 'ANONYMIZE_TARGET_PRIVILEGED';
  end if;

  -- Funn 3: sletteforespørselen gjelder personen — hele kjeden av profiler som
  -- (transitivt) er slått sammen inn i målet, ikke bare ett hopp.
  with recursive merge_chain as (
    select anonymize_person.target_profile_id as profile_id
    union
    select merge_row.source_profile_id
    from public.person_merges as merge_row
    join merge_chain on merge_chain.profile_id = merge_row.target_profile_id
    where merge_row.reversed_at is null
  )
  select array_agg(profile_id) into chain_profile_ids from merge_chain;

  -- Kjedens e-postadresser (profilrader + merge-snapshots) samles FØR
  -- profilene skrubbes.
  select coalesce(array_agg(distinct candidate.email), '{}'::text[])
  into chain_emails
  from (
    select profiles.normalized_email as email
    from public.profiles
    where profiles.id = any(chain_profile_ids)
    union
    select merge_row.source_snapshot ->> 'normalized_email'
    from public.person_merges as merge_row
    where merge_row.source_profile_id = any(chain_profile_ids)
      and merge_row.reversed_at is null
  ) as candidate
  where candidate.email is not null;

  -- Kontoer som peker på kjeden nå, pluss kontoer en sammenslåing i kjeden
  -- har flyttet (fanget via user_id selv om de senere er flyttet videre).
  select coalesce(array_agg(distinct account_user_id), '{}'::uuid[])
  into anonymized_account_ids
  from (
    select user_id as account_user_id
    from public.user_accounts
    where profile_id = any(chain_profile_ids)
    union
    select (element ->> 'id')::uuid
    from public.person_merges as merge_row
    cross join lateral jsonb_array_elements(merge_row.affected) as element
    where merge_row.source_profile_id = any(chain_profile_ids)
      and merge_row.reversed_at is null
      and element ->> 'table' = 'user_accounts'
  ) as accounts;

  update public.user_accounts
  set
    is_active = false,
    normalized_email = 'anonymisert-' || user_id::text || '@anonymisert.invalid'
  where user_id = any(anonymized_account_ids);

  -- Auth-laget bærer også identifikatorer i klartekst.
  update auth.users
  set
    email = 'anonymisert-' || id::text || '@anonymisert.invalid',
    raw_user_meta_data = '{}'::jsonb,
    phone = null
  where id = any(anonymized_account_ids);

  update auth.identities
  set identity_data = jsonb_build_object(
    'sub', user_id::text,
    'email', 'anonymisert-' || user_id::text || '@anonymisert.invalid'
  )
  where user_id = any(anonymized_account_ids);

  -- Invitasjoner innløst av kjeden, adressert til en e-post i kjeden (også
  -- uinnløste), eller flyttet av en sammenslåing i kjeden.
  update public.invitations
  set normalized_email = 'anonymisert-' || id::text || '@anonymisert.invalid'
  where claimed_by = any(chain_profile_ids)
    or normalized_email = any(chain_emails)
    or id in (
      select (element ->> 'id')::uuid
      from public.person_merges as merge_row
      cross join lateral jsonb_array_elements(merge_row.affected) as element
      where merge_row.source_profile_id = any(chain_profile_ids)
        and merge_row.reversed_at is null
        and element ->> 'table' = 'invitations'
    );

  -- Kursbevis viser navnet i klartekst — også på trukne enrollments som en
  -- sammenslåing lot stå igjen på en kildeprofil i kjeden.
  update public.certificates
  set display_name = 'Anonymisert deltaker'
  where enrollment_id in (
    select enrollment.id
    from public.enrollments as enrollment
    where enrollment.profile_id = any(chain_profile_ids)
  );

  -- Sammenslåingssnapshots bærer fullt navn, e-post, telefon og klubb — skrubb
  -- alle snapshots av kjedens profiler, pluss (som før) begge sider av
  -- sammenslåinger målet selv sto i.
  update public.person_merges as merge_row
  set source_snapshot = merge_row.source_snapshot || jsonb_build_object(
    'display_name', 'Anonymisert deltaker',
    'normalized_email',
      'anonymisert-' || (merge_row.source_snapshot ->> 'id')
        || '@anonymisert.invalid',
    'phone', null,
    'club_name', null,
    'birth_year', null
  )
  where merge_row.source_profile_id = any(chain_profile_ids)
    or merge_row.target_profile_id = anonymize_person.target_profile_id;

  -- Funn 4c: alle roller i kjeden revokeres i samme transaksjon, slik at et
  -- anonymisert skall aldri beholder tilganger.
  update public.role_assignments
  set revoked_at = now()
  where profile_id = any(chain_profile_ids)
    and revoked_at is null;

  -- Irreversible plassholdere for hele kjeden; pseudonyme kursaggregater
  -- (enrollments, progresjon, oppmøte) beholdes urørt.
  update public.profiles
  set
    display_name = 'Anonymisert deltaker',
    normalized_email = 'anonymisert-' || id::text || '@anonymisert.invalid',
    phone = null,
    club_name = null,
    birth_year = null,
    updated_at = now()
  where id = any(chain_profile_ids);

  -- Ingen before_data: revisjonssporet skal ikke bevare identifikatorene.
  insert into public.audit_events (
    actor_profile_id, action, entity_type, entity_id, reason, after_data
  )
  values (
    actor_profile_id,
    'person.anonymized',
    'profile',
    anonymize_person.target_profile_id::text,
    btrim(case_reference),
    jsonb_build_object(
      'approverProfileId', approver_profile_id,
      'chainProfileCount', coalesce(array_length(chain_profile_ids, 1), 1)
    )
  );
end;
$$;

-- create or replace bevarer eksisterende rettigheter; gjenta dem likevel
-- eksplisitt slik at avvik i et miljø ikke overlever migrasjonen.
revoke all on function private.enrollment_has_activity(uuid)
  from public, anon, authenticated;
revoke all on function private.enrollment_activity_fingerprint(uuid)
  from public, anon, authenticated;
revoke all on function public.anonymize_person(uuid, text, uuid)
  from public, anon, authenticated;
grant execute on function public.anonymize_person(uuid, text, uuid) to authenticated;
