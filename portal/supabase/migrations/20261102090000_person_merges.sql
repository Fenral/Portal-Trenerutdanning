-- Reversibel kontosammenslåing og administratorstyrt anonymisering.
--
-- person_merges lagrer eksakt radmapping (affected) og kildesnapshot slik at
-- reverse_merge kan gjenopprette nøyaktige rader — men KUN når de berørte
-- radene er uendret siden sammenslåingen. Anonymisering er en separat,
-- irreversibel juridisk flyt som krever to ulike administratorer.

create table public.person_merges (
  id uuid primary key default gen_random_uuid(),
  source_profile_id uuid not null references public.profiles(id) on delete restrict,
  target_profile_id uuid not null references public.profiles(id) on delete restrict,
  actor_profile_id uuid not null references public.profiles(id) on delete restrict,
  reason text not null
    constraint person_merges_reason_not_blank
    check (char_length(btrim(reason)) > 0),
  affected jsonb not null,
  source_snapshot jsonb not null,
  merged_at timestamptz not null default now(),
  reversed_at timestamptz,
  reversed_by uuid references public.profiles(id) on delete restrict,
  constraint person_merges_distinct_profiles
    check (source_profile_id <> target_profile_id),
  constraint person_merges_reversal_consistent check (
    (reversed_at is null and reversed_by is null)
    or (reversed_at is not null and reversed_by is not null)
  )
);

create index person_merges_source_idx
  on public.person_merges (source_profile_id)
  where reversed_at is null;

alter table public.person_merges enable row level security;
revoke all on table public.person_merges from anon, authenticated;

-- Stabil, tidssoneuavhengig jsonb-representasjon av tidsstempler, slik at
-- sammenligning ved reversering ikke avhenger av sesjonens TimeZone.
create function private.ts_jsonb(value timestamptz)
returns jsonb
language sql
immutable
set search_path = ''
as $$
  select coalesce(
    to_jsonb(to_char(value at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"')),
    'null'::jsonb
  );
$$;

revoke all on function private.ts_jsonb(timestamptz) from public, anon, authenticated;

-- Rangerer en enrollment for samme-kurs-konflikter: status veier tyngst,
-- deretter høyeste registrerte progresjon.
create function private.enrollment_merge_rank(target_enrollment public.enrollments)
returns integer
language sql
stable
set search_path = ''
as $$
  select case target_enrollment.status
      when 'completed' then 3000
      when 'active' then 2000
      when 'invited' then 1000
      else 0
    end
    + coalesce(
        (
          select max(progress.percentage)::integer
          from public.enrollment_progress as progress
          where progress.enrollment_id = target_enrollment.id
        ),
        0
      );
$$;

revoke all on function private.enrollment_merge_rank(public.enrollments)
  from public, anon, authenticated;

-- Har en enrollment registrert arbeid (fullføringer, innleveringer, bevis)?
create function private.enrollment_has_activity(target_enrollment_id uuid)
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
    );
$$;

revoke all on function private.enrollment_has_activity(uuid)
  from public, anon, authenticated;

-- Fingeravtrykk av barneradene til en enrollment. Lagres i affected ved
-- sammenslåing og sammenlignes ved reversering, slik at NY aktivitet på en
-- flyttet enrollment gir manual_reversal_required i stedet for feilattribuering.
create function private.enrollment_activity_fingerprint(target_enrollment_id uuid)
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
    )
  );
$$;

revoke all on function private.enrollment_activity_fingerprint(uuid)
  from public, anon, authenticated;

create function public.merge_people(
  source_id uuid,
  target_id uuid,
  target_reason text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_profile_id uuid;
  source_profile public.profiles%rowtype;
  target_profile public.profiles%rowtype;
  affected_rows jsonb := '[]'::jsonb;
  parking_profile_id uuid;
  merge_id uuid;
  account record;
  assignment record;
  conflict record;
  enrollment record;
  losing_enrollment public.enrollments%rowtype;
  zero_uuid constant uuid := '00000000-0000-0000-0000-000000000000';
begin
  actor_profile_id := private.current_profile_id();

  if actor_profile_id is null or not private.is_administrator() then
    raise exception using errcode = '42501', message = 'MERGE_FORBIDDEN';
  end if;

  if source_id is null or target_id is null or source_id = target_id then
    raise exception using errcode = '22023', message = 'MERGE_SAME_PROFILE';
  end if;

  if coalesce(char_length(btrim(target_reason)), 0) = 0 then
    raise exception using errcode = '22023', message = 'MERGE_REASON_REQUIRED';
  end if;

  -- Lås begge profilene i stabil rekkefølge.
  perform 1 from public.profiles
  where id in (source_id, target_id)
  order by id
  for update;

  select * into source_profile from public.profiles where id = source_id;
  if not found then
    raise exception using errcode = '22023', message = 'MERGE_SOURCE_NOT_FOUND';
  end if;

  select * into target_profile from public.profiles where id = target_id;
  if not found then
    raise exception using errcode = '22023', message = 'MERGE_TARGET_NOT_FOUND';
  end if;

  -- Anonymiserte profiler er juridisk isolert og kan aldri inngå i en
  -- sammenslåing — verken som kilde eller mål.
  if source_profile.normalized_email like '%@anonymisert.invalid'
    or target_profile.normalized_email like '%@anonymisert.invalid' then
    raise exception using errcode = '22023', message = 'MERGE_ANONYMIZED_PROFILE';
  end if;

  -- Sammenslåing flytter roller og innlogginger — profiler med global
  -- administrator- eller redaktørrolle håndteres aldri her.
  if exists (
    select 1 from public.role_assignments
    where profile_id in (source_id, target_id)
      and role in ('administrator', 'editor')
      and course_template_id is null
      and course_run_id is null
      and revoked_at is null
  ) then
    raise exception using errcode = '42501', message = 'MERGE_PRIVILEGED_PROFILE';
  end if;

  if exists (
    select 1 from public.person_merges
    where source_profile_id = source_id and reversed_at is null
  ) then
    raise exception using errcode = '22023', message = 'MERGE_ALREADY_MERGED';
  end if;

  if exists (
    select 1 from public.person_merges
    where source_profile_id = target_id and reversed_at is null
  ) then
    raise exception using errcode = '22023', message = 'MERGE_TARGET_MERGED';
  end if;

  -- 1) Auth-kontoer: alle kildekontoer peker på målpersonen etterpå.
  for account in
    select * from public.user_accounts where profile_id = source_id
  loop
    affected_rows := affected_rows || jsonb_build_object(
      'table', 'user_accounts',
      'id', account.user_id,
      'before', jsonb_build_object('profileId', source_id),
      'after', jsonb_build_object('profileId', target_id)
    );
  end loop;

  update public.user_accounts
  set profile_id = target_id
  where profile_id = source_id;

  -- 2) Roller: flytt, men reverser duplikat-aktive tildelinger i stedet for
  --    å bryte unikhetsindeksen.
  for assignment in
    select * from public.role_assignments where profile_id = source_id
  loop
    if assignment.revoked_at is null and exists (
      select 1
      from public.role_assignments as existing
      where existing.profile_id = target_id
        and existing.role = assignment.role
        and existing.revoked_at is null
        and coalesce(existing.course_template_id, zero_uuid)
          = coalesce(assignment.course_template_id, zero_uuid)
        and coalesce(existing.course_run_id, zero_uuid)
          = coalesce(assignment.course_run_id, zero_uuid)
    ) then
      update public.role_assignments
      set revoked_at = now()
      where id = assignment.id;

      affected_rows := affected_rows || jsonb_build_object(
        'table', 'role_assignments',
        'id', assignment.id,
        'before', jsonb_build_object(
          'profileId', source_id,
          'revokedAt', private.ts_jsonb(null)
        ),
        'after', jsonb_build_object(
          'profileId', source_id,
          'revokedAt', private.ts_jsonb(now())
        )
      );
    else
      update public.role_assignments
      set profile_id = target_id
      where id = assignment.id;

      affected_rows := affected_rows || jsonb_build_object(
        'table', 'role_assignments',
        'id', assignment.id,
        'before', jsonb_build_object(
          'profileId', source_id,
          'revokedAt', private.ts_jsonb(assignment.revoked_at)
        ),
        'after', jsonb_build_object(
          'profileId', target_id,
          'revokedAt', private.ts_jsonb(assignment.revoked_at)
        )
      );

      -- Rollehistorikk: en flyttet aktiv rolle er i praksis en tildeling.
      if assignment.revoked_at is null then
        insert into public.audit_events (
          actor_profile_id, action, entity_type, entity_id, reason,
          before_data, after_data
        )
        values (
          actor_profile_id,
          'role.granted',
          'role_assignment',
          assignment.id::text,
          btrim(target_reason),
          jsonb_build_object('profileId', source_id),
          jsonb_build_object(
            'profileId', target_id,
            'role', assignment.role,
            'courseTemplateId', assignment.course_template_id,
            'courseRunId', assignment.course_run_id,
            'via', 'person.merged'
          )
        );
      end if;
    end if;
  end loop;

  -- 3) Enrollments. Samme-kurs-konflikt: behold den mest avanserte, marker
  --    den andre som trukket, og lagre begge ID-ene i affected.
  --    Fordi unique (course_run_id, profile_id) ikke er deferrable, brukes en
  --    midlertidig parkeringsprofil for å bytte plass uten transient brudd.
  if exists (
    select 1
    from public.enrollments as source_enrollment
    join public.enrollments as target_enrollment
      on target_enrollment.course_run_id = source_enrollment.course_run_id
      and target_enrollment.profile_id = target_id
    where source_enrollment.profile_id = source_id
  ) then
    insert into public.profiles (display_name, normalized_email)
    values (
      'Sammenslåing pågår',
      'parkering-' || gen_random_uuid()::text || '@flytt.invalid'
    )
    returning id into parking_profile_id;
  end if;

  for conflict in
    select
      source_enrollment.id as source_enrollment_id,
      target_enrollment.id as target_enrollment_id,
      source_enrollment.course_run_id,
      private.enrollment_has_activity(source_enrollment.id)
        as source_has_activity,
      private.enrollment_has_activity(target_enrollment.id)
        as target_has_activity,
      case
        -- Registrert arbeid veier tyngre enn statusrang: den beholdte
        -- personens eget arbeid skal aldri strande på duplikatet.
        when private.enrollment_has_activity(source_enrollment.id)
          <> private.enrollment_has_activity(target_enrollment.id)
        then private.enrollment_has_activity(source_enrollment.id)
        else private.enrollment_merge_rank(source_enrollment)
          > private.enrollment_merge_rank(target_enrollment)
      end as source_wins
    from public.enrollments as source_enrollment
    join public.enrollments as target_enrollment
      on target_enrollment.course_run_id = source_enrollment.course_run_id
      and target_enrollment.profile_id = target_id
    where source_enrollment.profile_id = source_id
  loop
    -- Har begge sider arbeid i samme kurs, kan ingen automatisk regel slå dem
    -- sammen uten å strande noens arbeid. Stopp uten endringer.
    if conflict.source_has_activity and conflict.target_has_activity then
      raise exception using
        errcode = '22023', message = 'MERGE_COURSE_CONFLICT';
    end if;

    affected_rows := affected_rows || jsonb_build_object(
      'table', 'enrollment_conflicts',
      'courseRunId', conflict.course_run_id,
      'keptEnrollmentId',
        case when conflict.source_wins
          then conflict.source_enrollment_id
          else conflict.target_enrollment_id end,
      'supersededEnrollmentId',
        case when conflict.source_wins
          then conflict.target_enrollment_id
          else conflict.source_enrollment_id end
    );

    if conflict.source_wins then
      -- Parkér målets enrollment, flytt kildens til mål, og legg taperen
      -- (målets) tilbake på kildeprofilen som trukket.
      select * into losing_enrollment
      from public.enrollments where id = conflict.target_enrollment_id;

      update public.enrollments
      set profile_id = parking_profile_id
      where id = conflict.target_enrollment_id;

      select * into enrollment
      from public.enrollments where id = conflict.source_enrollment_id;

      update public.enrollments
      set profile_id = target_id
      where id = conflict.source_enrollment_id;

      affected_rows := affected_rows || jsonb_build_object(
        'table', 'enrollments',
        'id', conflict.source_enrollment_id,
        'before', jsonb_build_object(
          'profileId', source_id,
          'status', enrollment.status,
          'statusReason', enrollment.status_reason,
          'statusChangedAt', private.ts_jsonb(enrollment.status_changed_at)
        ),
        'after', jsonb_build_object(
          'profileId', target_id,
          'status', enrollment.status,
          'statusReason', enrollment.status_reason,
          'statusChangedAt', private.ts_jsonb(enrollment.status_changed_at),
          'activity',
            private.enrollment_activity_fingerprint(conflict.source_enrollment_id)
        )
      );

      update public.enrollments
      set
        profile_id = source_id,
        status = 'withdrawn',
        status_reason = 'Erstattet ved sammenslåing',
        status_changed_at = now()
      where id = conflict.target_enrollment_id;

      affected_rows := affected_rows || jsonb_build_object(
        'table', 'enrollments',
        'id', conflict.target_enrollment_id,
        'before', jsonb_build_object(
          'profileId', target_id,
          'status', losing_enrollment.status,
          'statusReason', losing_enrollment.status_reason,
          'statusChangedAt', private.ts_jsonb(losing_enrollment.status_changed_at)
        ),
        'after', jsonb_build_object(
          'profileId', source_id,
          'status', 'withdrawn',
          'statusReason', 'Erstattet ved sammenslåing',
          'statusChangedAt', private.ts_jsonb(now()),
          'activity',
            private.enrollment_activity_fingerprint(conflict.target_enrollment_id)
        )
      );
    else
      -- Målets enrollment vinner: kildens blir stående på kildeprofilen som
      -- trukket, slik at rapporter teller én person.
      select * into losing_enrollment
      from public.enrollments where id = conflict.source_enrollment_id;

      if losing_enrollment.status <> 'withdrawn' then
        update public.enrollments
        set
          status = 'withdrawn',
          status_reason = 'Erstattet ved sammenslåing',
          status_changed_at = now()
        where id = conflict.source_enrollment_id;

        affected_rows := affected_rows || jsonb_build_object(
          'table', 'enrollments',
          'id', conflict.source_enrollment_id,
          'before', jsonb_build_object(
            'profileId', source_id,
            'status', losing_enrollment.status,
            'statusReason', losing_enrollment.status_reason,
            'statusChangedAt', private.ts_jsonb(losing_enrollment.status_changed_at)
          ),
          'after', jsonb_build_object(
            'profileId', source_id,
            'status', 'withdrawn',
            'statusReason', 'Erstattet ved sammenslåing',
            'statusChangedAt', private.ts_jsonb(now()),
            'activity',
              private.enrollment_activity_fingerprint(conflict.source_enrollment_id)
          )
        );
      end if;
    end if;
  end loop;

  -- Flytt kildens gjenværende enrollments (uten konflikt) til målet.
  for enrollment in
    select * from public.enrollments
    where profile_id = source_id
      and not exists (
        select 1 from public.enrollments as existing
        where existing.course_run_id = public.enrollments.course_run_id
          and existing.profile_id = target_id
      )
  loop
    update public.enrollments
    set profile_id = target_id
    where id = enrollment.id;

    affected_rows := affected_rows || jsonb_build_object(
      'table', 'enrollments',
      'id', enrollment.id,
      'before', jsonb_build_object(
        'profileId', source_id,
        'status', enrollment.status,
        'statusReason', enrollment.status_reason,
        'statusChangedAt', private.ts_jsonb(enrollment.status_changed_at)
      ),
      'after', jsonb_build_object(
        'profileId', target_id,
        'status', enrollment.status,
        'statusReason', enrollment.status_reason,
        'statusChangedAt', private.ts_jsonb(enrollment.status_changed_at),
        'activity', private.enrollment_activity_fingerprint(enrollment.id)
      )
    );
  end loop;

  if parking_profile_id is not null then
    delete from public.profiles where id = parking_profile_id;
  end if;

  -- 4) Invitasjoner som kilden har innløst.
  for enrollment in
    select id from public.invitations where claimed_by = source_id
  loop
    affected_rows := affected_rows || jsonb_build_object(
      'table', 'invitations',
      'id', enrollment.id,
      'before', jsonb_build_object('claimedBy', source_id),
      'after', jsonb_build_object('claimedBy', target_id)
    );
  end loop;

  update public.invitations
  set claimed_by = target_id
  where claimed_by = source_id;

  insert into public.person_merges (
    source_profile_id,
    target_profile_id,
    actor_profile_id,
    reason,
    affected,
    source_snapshot
  )
  values (
    source_id,
    target_id,
    actor_profile_id,
    btrim(target_reason),
    affected_rows,
    to_jsonb(source_profile)
  )
  returning id into merge_id;

  insert into public.audit_events (
    actor_profile_id, action, entity_type, entity_id, reason,
    before_data, after_data
  )
  values (
    actor_profile_id,
    'person.merged',
    'profile',
    source_id::text,
    btrim(target_reason),
    jsonb_build_object('sourceProfileId', source_id, 'targetProfileId', target_id),
    jsonb_build_object(
      'mergeId', merge_id,
      'affectedRowCount', jsonb_array_length(affected_rows)
    )
  );

  return merge_id;
end;
$$;

create function public.reverse_merge(merge_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  acting_profile_id uuid;
  merge_record public.person_merges%rowtype;
  entry jsonb;
  mismatches jsonb := '[]'::jsonb;
  current_state jsonb;
  parking_profile_id uuid;
  account public.user_accounts%rowtype;
  assignment public.role_assignments%rowtype;
  enrollment public.enrollments%rowtype;
  invitation public.invitations%rowtype;
  pass integer;
begin
  acting_profile_id := private.current_profile_id();

  if acting_profile_id is null or not private.is_administrator() then
    raise exception using errcode = '42501', message = 'MERGE_FORBIDDEN';
  end if;

  select * into merge_record
  from public.person_merges
  where id = merge_id
  for update;

  if not found then
    raise exception using errcode = '22023', message = 'MERGE_NOT_FOUND';
  end if;

  if merge_record.reversed_at is not null then
    raise exception using errcode = '22023', message = 'MERGE_ALREADY_REVERSED';
  end if;

  -- Fase 1: verifiser at ALLE berørte rader er uendret siden sammenslåingen.
  -- Sammenligningen dekker nøyaktig kolonnene sammenslåingen endret.
  for entry in select * from jsonb_array_elements(merge_record.affected)
  loop
    current_state := null;

    if entry ->> 'table' = 'user_accounts' then
      select * into account
      from public.user_accounts
      where user_id = (entry ->> 'id')::uuid;
      if found then
        current_state := jsonb_build_object('profileId', account.profile_id);
      end if;
    elsif entry ->> 'table' = 'role_assignments' then
      select * into assignment
      from public.role_assignments
      where id = (entry ->> 'id')::uuid;
      if found then
        current_state := jsonb_build_object(
          'profileId', assignment.profile_id,
          'revokedAt', private.ts_jsonb(assignment.revoked_at)
        );
      end if;
    elsif entry ->> 'table' = 'enrollments' then
      select * into enrollment
      from public.enrollments
      where id = (entry ->> 'id')::uuid;
      if found then
        current_state := jsonb_build_object(
          'profileId', enrollment.profile_id,
          'status', enrollment.status,
          'statusReason', enrollment.status_reason,
          'statusChangedAt', private.ts_jsonb(enrollment.status_changed_at),
          'activity', private.enrollment_activity_fingerprint(enrollment.id)
        );
      end if;
    elsif entry ->> 'table' = 'invitations' then
      select * into invitation
      from public.invitations
      where id = (entry ->> 'id')::uuid;
      if found then
        current_state := jsonb_build_object('claimedBy', invitation.claimed_by);
      end if;
    else
      continue; -- informasjonsoppføringer (enrollment_conflicts)
    end if;

    if current_state is null or current_state <> (entry -> 'after') then
      mismatches := mismatches || jsonb_build_object(
        'table', entry ->> 'table',
        'id', entry ->> 'id',
        'expected', entry -> 'after',
        'found', coalesce(current_state, 'null'::jsonb)
      );
    end if;
  end loop;

  if jsonb_array_length(mismatches) > 0 then
    return jsonb_build_object(
      'status', 'manual_reversal_required',
      'mismatches', mismatches
    );
  end if;

  -- Fase 2: gjenopprett eksakte rader. Enrollments på målprofilen parkeres
  -- først slik at par kan bytte plass uten transient unikhetsbrudd.
  begin
    if exists (
      select 1 from jsonb_array_elements(merge_record.affected) as element
      where element ->> 'table' = 'enrollments'
    ) then
      insert into public.profiles (display_name, normalized_email)
      values (
        'Reversering pågår',
        'parkering-' || gen_random_uuid()::text || '@flytt.invalid'
      )
      returning id into parking_profile_id;

      update public.enrollments
      set profile_id = parking_profile_id
      where profile_id = merge_record.target_profile_id
        and id in (
          select (element ->> 'id')::uuid
          from jsonb_array_elements(merge_record.affected) as element
          where element ->> 'table' = 'enrollments'
        );
    end if;

    for pass in 1..2 loop
      for entry in select * from jsonb_array_elements(merge_record.affected)
      loop
        if entry ->> 'table' <> 'enrollments' then
          continue;
        end if;

        select * into enrollment
        from public.enrollments
        where id = (entry ->> 'id')::uuid;

        -- Pass 1: rader som ikke er parkert. Pass 2: de parkerte.
        if (pass = 1) = (enrollment.profile_id = parking_profile_id) then
          continue;
        end if;

        update public.enrollments
        set
          profile_id = (entry #>> '{before,profileId}')::uuid,
          status = (entry #>> '{before,status}')::public.enrollment_status,
          status_reason = entry #>> '{before,statusReason}',
          status_changed_at = (entry #>> '{before,statusChangedAt}')::timestamptz
        where id = (entry ->> 'id')::uuid;
      end loop;
    end loop;

    if parking_profile_id is not null then
      delete from public.profiles where id = parking_profile_id;
    end if;

    for entry in select * from jsonb_array_elements(merge_record.affected)
    loop
      if entry ->> 'table' = 'user_accounts' then
        update public.user_accounts
        set profile_id = (entry #>> '{before,profileId}')::uuid
        where user_id = (entry ->> 'id')::uuid;
      elsif entry ->> 'table' = 'role_assignments' then
        update public.role_assignments
        set
          profile_id = (entry #>> '{before,profileId}')::uuid,
          revoked_at = (entry #>> '{before,revokedAt}')::timestamptz
        where id = (entry ->> 'id')::uuid;
      elsif entry ->> 'table' = 'invitations' then
        update public.invitations
        set claimed_by = (entry #>> '{before,claimedBy}')::uuid
        where id = (entry ->> 'id')::uuid;
      end if;
    end loop;
  exception
    when unique_violation then
      -- Omgivelsene har endret seg (f.eks. ny enrollment i samme kurs):
      -- ingen delvise endringer, krev manuell reversering.
      return jsonb_build_object(
        'status', 'manual_reversal_required',
        'mismatches', jsonb_build_array(
          jsonb_build_object('table', 'enrollments', 'reason', 'unique_violation')
        )
      );
  end;

  update public.person_merges
  set reversed_at = now(), reversed_by = acting_profile_id
  where id = merge_id;

  insert into public.audit_events (
    actor_profile_id, action, entity_type, entity_id, reason,
    before_data, after_data
  )
  values (
    acting_profile_id,
    'person.merge_reversed',
    'profile',
    merge_record.source_profile_id::text,
    'Reversert sammenslåing',
    jsonb_build_object('mergeId', merge_id),
    jsonb_build_object(
      'sourceProfileId', merge_record.source_profile_id,
      'targetProfileId', merge_record.target_profile_id
    )
  );

  return jsonb_build_object('status', 'reversed');
end;
$$;

create function public.anonymize_person(
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
begin
  actor_profile_id := private.current_profile_id();

  if actor_profile_id is null or not private.is_administrator() then
    raise exception using errcode = '42501', message = 'ANONYMIZE_FORBIDDEN';
  end if;

  if coalesce(char_length(btrim(case_reference)), 0) = 0 then
    raise exception using
      errcode = '22023', message = 'ANONYMIZE_CASE_REFERENCE_REQUIRED';
  end if;

  if approver_profile_id is null or approver_profile_id = actor_profile_id then
    raise exception using
      errcode = '22023', message = 'ANONYMIZE_APPROVER_MUST_DIFFER';
  end if;

  if not exists (
    select 1 from public.role_assignments
    where profile_id = approver_profile_id
      and role = 'administrator'
      and revoked_at is null
  ) then
    raise exception using
      errcode = '22023', message = 'ANONYMIZE_APPROVER_NOT_ADMINISTRATOR';
  end if;

  select * into profile_record
  from public.profiles
  where id = target_profile_id
  for update;

  if not found then
    raise exception using
      errcode = '22023', message = 'ANONYMIZE_PROFILE_NOT_FOUND';
  end if;

  -- Kontoer som peker på profilen nå, pluss kontoer en tidligere sammenslåing
  -- har flyttet bort fra profilen: sletteforespørselen gjelder personen,
  -- ikke bare profilraden.
  select coalesce(array_agg(distinct account_user_id), '{}'::uuid[])
  into anonymized_account_ids
  from (
    select user_id as account_user_id
    from public.user_accounts
    where profile_id = anonymize_person.target_profile_id
    union
    select (element ->> 'id')::uuid
    from public.person_merges as merge_row
    cross join lateral jsonb_array_elements(merge_row.affected) as element
    where merge_row.source_profile_id = anonymize_person.target_profile_id
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

  -- Invitasjoner personen har innløst (også via en tidligere sammenslåing)
  -- og invitasjoner sendt til personens e-postadresse.
  update public.invitations
  set normalized_email = 'anonymisert-' || id::text || '@anonymisert.invalid'
  where claimed_by = anonymize_person.target_profile_id
    or normalized_email = profile_record.normalized_email
    or id in (
      select (element ->> 'id')::uuid
      from public.person_merges as merge_row
      cross join lateral jsonb_array_elements(merge_row.affected) as element
      where merge_row.source_profile_id = anonymize_person.target_profile_id
        and merge_row.reversed_at is null
        and element ->> 'table' = 'invitations'
    );

  -- Kursbevis viser navnet i klartekst.
  update public.certificates
  set display_name = 'Anonymisert deltaker'
  where enrollment_id in (
    select enrollment.id
    from public.enrollments as enrollment
    where enrollment.profile_id = anonymize_person.target_profile_id
  );

  -- Sammenslåingssnapshots bærer fullt navn, e-post, telefon og klubb —
  -- skrubb dem uansett hvilken side av sammenslåingen personen sto på.
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
  where merge_row.source_profile_id = anonymize_person.target_profile_id
    or merge_row.target_profile_id = anonymize_person.target_profile_id;

  -- Profiler som tidligere ble slått sammen inn i denne personen bærer
  -- fortsatt identifikatorer i egen rad — skrubb dem også.
  update public.profiles
  set
    display_name = 'Anonymisert deltaker',
    normalized_email = 'anonymisert-' || id::text || '@anonymisert.invalid',
    phone = null,
    club_name = null,
    birth_year = null,
    updated_at = now()
  where id in (
    select merge_row.source_profile_id
    from public.person_merges as merge_row
    where merge_row.target_profile_id = anonymize_person.target_profile_id
      and merge_row.reversed_at is null
  );

  -- Irreversible plassholdere; pseudonyme kursaggregater (enrollments,
  -- progresjon, oppmøte) beholdes urørt.
  update public.profiles
  set
    display_name = 'Anonymisert deltaker',
    normalized_email =
      'anonymisert-' || target_profile_id::text || '@anonymisert.invalid',
    phone = null,
    club_name = null,
    birth_year = null,
    updated_at = now()
  where id = target_profile_id;

  -- Ingen before_data: revisjonssporet skal ikke bevare identifikatorene.
  insert into public.audit_events (
    actor_profile_id, action, entity_type, entity_id, reason, after_data
  )
  values (
    actor_profile_id,
    'person.anonymized',
    'profile',
    target_profile_id::text,
    btrim(case_reference),
    jsonb_build_object('approverProfileId', approver_profile_id)
  );
end;
$$;

revoke all on function public.merge_people(uuid, uuid, text)
  from public, anon, authenticated;
revoke all on function public.reverse_merge(uuid)
  from public, anon, authenticated;
revoke all on function public.anonymize_person(uuid, text, uuid)
  from public, anon, authenticated;

grant execute on function public.merge_people(uuid, uuid, text) to authenticated;
grant execute on function public.reverse_merge(uuid) to authenticated;
grant execute on function public.anonymize_person(uuid, text, uuid) to authenticated;
