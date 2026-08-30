alter table public.course_sessions
add column session_type text not null default 'regular'
constraint course_sessions_type_allowed
check (session_type in ('regular', 'youth_drive'));

alter table public.course_sessions
add column is_required boolean not null default true;

create function public.create_course_run_with_sessions(
  target_template_id uuid,
  target_title text,
  target_start_year smallint,
  target_location_name text,
  target_starts_on date,
  target_ends_on date,
  target_sessions jsonb,
  target_lead_profile_id uuid,
  target_correlation_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_profile_id uuid;
  new_course_run_id uuid := gen_random_uuid();
  session_payload jsonb;
  session_order bigint;
  session_starts_at timestamptz;
  session_ends_at timestamptz;
  session_type_value text;
  session_is_required boolean;
begin
  actor_profile_id := private.current_profile_id();

  if actor_profile_id is null or not private.is_administrator() then
    raise exception using
      errcode = '42501',
      message = 'COURSE_CREATE_FORBIDDEN';
  end if;

  if jsonb_typeof(target_sessions) <> 'array'
    or jsonb_array_length(target_sessions) = 0
    or jsonb_array_length(target_sessions) > 24
  then
    raise exception using
      errcode = '22023',
      message = 'COURSE_SESSIONS_INVALID';
  end if;

  if target_ends_on < target_starts_on then
    raise exception using
      errcode = '22023',
      message = 'COURSE_DATE_INVALID';
  end if;

  insert into public.course_runs (
    id,
    template_id,
    title,
    start_year,
    location_name,
    starts_on,
    ends_on,
    status
  )
  values (
    new_course_run_id,
    target_template_id,
    btrim(target_title),
    target_start_year,
    nullif(btrim(target_location_name), ''),
    target_starts_on,
    target_ends_on,
    'draft'
  );

  for session_payload, session_order in
    select item.value, item.ordinality
    from jsonb_array_elements(target_sessions) with ordinality as item(value, ordinality)
  loop
    if session_payload ->> 'title' is null
      or session_payload ->> 'startsAt' is null
      or session_payload ->> 'endsAt' is null
    then
      raise exception using
        errcode = '22023',
        message = 'COURSE_SESSION_FIELDS_REQUIRED';
    end if;

    session_starts_at := (session_payload ->> 'startsAt')::timestamptz;
    session_ends_at := (session_payload ->> 'endsAt')::timestamptz;
    session_type_value := coalesce(
      session_payload ->> 'sessionType',
      'regular'
    );
    session_is_required := coalesce(
      (session_payload ->> 'isRequired')::boolean,
      true
    );

    if session_ends_at <= session_starts_at then
      raise exception using
        errcode = '22023',
        message = 'COURSE_SESSION_DATE_INVALID';
    end if;

    if session_type_value not in ('regular', 'youth_drive') then
      raise exception using
        errcode = '22023',
        message = 'COURSE_SESSION_TYPE_INVALID';
    end if;

    insert into public.course_sessions (
      course_run_id,
      title,
      starts_at,
      ends_at,
      location_text,
      sort_order,
      session_type,
      is_required
    )
    values (
      new_course_run_id,
      btrim(session_payload ->> 'title'),
      session_starts_at,
      session_ends_at,
      nullif(btrim(session_payload ->> 'locationText'), ''),
      session_order::smallint,
      session_type_value,
      session_is_required
    );
  end loop;

  insert into public.role_assignments (
    profile_id,
    role,
    course_run_id,
    granted_by
  )
  values (
    target_lead_profile_id,
    'course_lead',
    new_course_run_id,
    actor_profile_id
  );

  insert into public.audit_events (
    actor_profile_id,
    action,
    entity_type,
    entity_id,
    correlation_id,
    after_data
  )
  values (
    actor_profile_id,
    'course.created',
    'course_run',
    new_course_run_id::text,
    target_correlation_id,
    jsonb_build_object(
      'templateId', target_template_id,
      'startYear', target_start_year,
      'sessionCount', jsonb_array_length(target_sessions)
    )
  );

  return new_course_run_id;
end;
$$;

revoke all on function public.create_course_run_with_sessions(
  uuid,
  text,
  smallint,
  text,
  date,
  date,
  jsonb,
  uuid,
  uuid
) from public, anon, authenticated;

grant execute on function public.create_course_run_with_sessions(
  uuid,
  text,
  smallint,
  text,
  date,
  date,
  jsonb,
  uuid,
  uuid
) to authenticated;
