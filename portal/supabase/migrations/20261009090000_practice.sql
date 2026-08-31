create extension if not exists pg_cron;

create type public.practice_category as enum (
  'delivery',
  'planning'
);

create type public.practice_approval_mode as enum (
  'manual_review',
  'auto_approve'
);

create type public.practice_submission_status as enum (
  'submitted',
  'approved_manual',
  'approved_auto',
  'revision_required'
);

create type public.practice_event_type as enum (
  'submitted',
  'approved_manual',
  'approved_auto',
  'revision_required',
  'spot_check_revoked'
);

create table public.practice_definitions (
  activity_id uuid primary key references public.activities(id) on delete cascade,
  required_minutes integer not null default 2700
    constraint practice_definitions_required_minutes_positive
    check (required_minutes > 0),
  max_planning_minutes integer not null default 540
    constraint practice_definitions_planning_minutes_valid
    check (max_planning_minutes >= 0 and max_planning_minutes <= required_minutes),
  approval_mode public.practice_approval_mode not null default 'manual_review',
  auto_delay_hours integer
    constraint practice_definitions_auto_delay_valid
    check (auto_delay_hours is null or auto_delay_hours between 0 and 720),
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint practice_definitions_mode_delay_consistent check (
    (approval_mode = 'manual_review' and auto_delay_hours is null)
    or (approval_mode = 'auto_approve' and auto_delay_hours is not null)
  )
);

create table public.practice_entries (
  id uuid primary key default gen_random_uuid(),
  enrollment_id uuid not null,
  course_run_id uuid not null,
  learning_path_id uuid not null,
  activity_id uuid not null,
  occurred_on date not null,
  minutes integer not null
    constraint practice_entries_minutes_positive check (minutes > 0),
  category public.practice_category not null,
  description text not null
    constraint practice_entries_description_not_blank
    check (char_length(btrim(description)) > 0),
  idempotency_key uuid not null,
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  constraint practice_entries_enrollment_course_fk
    foreign key (enrollment_id, course_run_id)
    references public.enrollments(id, course_run_id)
    on delete restrict,
  constraint practice_entries_path_course_fk
    foreign key (learning_path_id, course_run_id)
    references public.learning_paths(id, course_run_id)
    on delete restrict,
  constraint practice_entries_activity_path_fk
    foreign key (activity_id, learning_path_id)
    references public.activities(id, learning_path_id)
    on delete restrict,
  constraint practice_entries_idempotency_unique
    unique (enrollment_id, activity_id, idempotency_key)
);

create index practice_entries_student_activity_idx
  on public.practice_entries (enrollment_id, activity_id, occurred_on, created_at);

create table public.practice_submissions (
  id uuid primary key default gen_random_uuid(),
  enrollment_id uuid not null,
  course_run_id uuid not null,
  learning_path_id uuid not null,
  activity_id uuid not null,
  version_number integer not null
    constraint practice_submissions_version_positive check (version_number > 0),
  status public.practice_submission_status not null default 'submitted',
  included_entry_ids uuid[] not null
    constraint practice_submissions_entries_not_empty
    check (cardinality(included_entry_ids) > 0),
  total_minutes integer not null
    constraint practice_submissions_total_positive check (total_minutes > 0),
  planning_minutes integer not null
    constraint practice_submissions_planning_nonnegative check (planning_minutes >= 0),
  delivery_minutes integer not null
    constraint practice_submissions_delivery_nonnegative check (delivery_minutes >= 0),
  approval_mode public.practice_approval_mode not null,
  auto_approve_at timestamptz,
  submitted_by uuid not null references public.profiles(id) on delete restrict,
  submitted_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint practice_submissions_enrollment_course_fk
    foreign key (enrollment_id, course_run_id)
    references public.enrollments(id, course_run_id)
    on delete restrict,
  constraint practice_submissions_path_course_fk
    foreign key (learning_path_id, course_run_id)
    references public.learning_paths(id, course_run_id)
    on delete restrict,
  constraint practice_submissions_activity_path_fk
    foreign key (activity_id, learning_path_id)
    references public.activities(id, learning_path_id)
    on delete restrict,
  constraint practice_submissions_version_unique
    unique (enrollment_id, activity_id, version_number),
  constraint practice_submissions_totals_consistent check (
    total_minutes = planning_minutes + delivery_minutes
  ),
  constraint practice_submissions_mode_delay_consistent check (
    (approval_mode = 'manual_review' and auto_approve_at is null)
    or (approval_mode = 'auto_approve' and auto_approve_at is not null)
  )
);

create index practice_submissions_review_queue_idx
  on public.practice_submissions (course_run_id, status, submitted_at);

create index practice_submissions_auto_due_idx
  on public.practice_submissions (auto_approve_at)
  where status = 'submitted' and approval_mode = 'auto_approve';

create table public.practice_submission_events (
  id bigint generated always as identity primary key,
  submission_id uuid not null references public.practice_submissions(id) on delete restrict,
  event_type public.practice_event_type not null,
  from_status public.practice_submission_status,
  to_status public.practice_submission_status not null,
  reason text,
  actor_profile_id uuid references public.profiles(id) on delete restrict,
  occurred_at timestamptz not null default now()
);

create index practice_submission_events_submission_idx
  on public.practice_submission_events (submission_id, occurred_at, id);

create function private.validate_practice_definition()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  target_activity public.activities%rowtype;
begin
  select activity.*
  into target_activity
  from public.activities as activity
  where activity.id = new.activity_id;

  if target_activity.id is null
    or target_activity.activity_type <> 'practice'
    or target_activity.completion_mode <> 'practice_approved'
  then
    raise exception using
      errcode = '22023',
      message = 'PRACTICE_DEFINITION_ACTIVITY_INVALID';
  end if;

  new.updated_at := now();
  return new;
end;
$$;

create trigger practice_definitions_validate
before insert or update on public.practice_definitions
for each row execute function private.validate_practice_definition();

create function private.reject_practice_entry_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception using
    errcode = '55000',
    message = 'PRACTICE_ENTRY_IS_IMMUTABLE';
end;
$$;

create trigger practice_entries_reject_mutation
before update or delete on public.practice_entries
for each row execute function private.reject_practice_entry_mutation();

create function private.protect_practice_submission_snapshot()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    raise exception using
      errcode = '55000',
      message = 'PRACTICE_SUBMISSION_IS_IMMUTABLE';
  end if;

  if (to_jsonb(new) - 'status' - 'updated_at')
    is distinct from (to_jsonb(old) - 'status' - 'updated_at')
  then
    raise exception using
      errcode = '55000',
      message = 'PRACTICE_SUBMISSION_SNAPSHOT_IS_IMMUTABLE';
  end if;

  new.updated_at := now();
  return new;
end;
$$;

create trigger practice_submissions_protect_snapshot
before update or delete on public.practice_submissions
for each row execute function private.protect_practice_submission_snapshot();

create function private.reject_practice_event_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception using
    errcode = '55000',
    message = 'PRACTICE_SUBMISSION_EVENT_IS_IMMUTABLE';
end;
$$;

create trigger practice_submission_events_reject_mutation
before update or delete on public.practice_submission_events
for each row execute function private.reject_practice_event_mutation();

create function private.practice_totals(
  target_enrollment_id uuid,
  target_activity_id uuid
)
returns table (
  total_minutes integer,
  planning_minutes integer,
  delivery_minutes integer,
  entry_ids uuid[]
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    coalesce(sum(entry.minutes), 0)::integer,
    coalesce(sum(entry.minutes) filter (where entry.category = 'planning'), 0)::integer,
    coalesce(sum(entry.minutes) filter (where entry.category = 'delivery'), 0)::integer,
    coalesce(
      array_agg(entry.id order by entry.occurred_on, entry.created_at, entry.id)
        filter (where entry.id is not null),
      array[]::uuid[]
    )
  from public.practice_entries as entry
  where entry.enrollment_id = target_enrollment_id
    and entry.activity_id = target_activity_id
$$;

create function private.require_student_practice_access(
  target_enrollment_id uuid,
  target_activity_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  actor_profile_id uuid;
  enrollment_record public.enrollments%rowtype;
  activity_record public.activities%rowtype;
begin
  actor_profile_id := private.current_profile_id();

  select enrollment.*
  into enrollment_record
  from public.enrollments as enrollment
  where enrollment.id = target_enrollment_id;

  if actor_profile_id is null
    or enrollment_record.id is null
    or enrollment_record.profile_id <> actor_profile_id
    or enrollment_record.status <> 'active'
  then
    raise exception using
      errcode = '42501',
      message = 'PRACTICE_ACCESS_FORBIDDEN';
  end if;

  select activity.*
  into activity_record
  from public.activities as activity
  join public.learning_paths as learning_path
    on learning_path.id = activity.learning_path_id
    and learning_path.course_run_id = enrollment_record.course_run_id
    and learning_path.status = 'published'
  where activity.id = target_activity_id
    and activity.activity_type = 'practice'
    and activity.completion_mode = 'practice_approved';

  if activity_record.id is null then
    raise exception using
      errcode = '22023',
      message = 'PRACTICE_ACTIVITY_INVALID';
  end if;

  if exists (
    select 1
    from public.activity_prerequisites as prerequisite
    where prerequisite.learning_path_id = activity_record.learning_path_id
      and prerequisite.activity_id = target_activity_id
      and not exists (
        select 1
        from public.activity_completions as completion
        join public.activity_completion_states as completion_state
          on completion_state.completion_id = completion.id
          and completion_state.is_active
        where completion.enrollment_id = target_enrollment_id
          and completion.activity_id = prerequisite.prerequisite_activity_id
      )
  ) then
    raise exception using
      errcode = '55000',
      message = 'PRACTICE_PREREQUISITE_INCOMPLETE';
  end if;

  return jsonb_build_object(
    'profileId', actor_profile_id,
    'courseRunId', enrollment_record.course_run_id,
    'learningPathId', activity_record.learning_path_id,
    'title', activity_record.title
  );
end;
$$;

create function private.set_practice_completion(
  target_submission_id uuid,
  target_active boolean,
  target_actor_profile_id uuid,
  target_source public.activity_completion_source,
  target_reason text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  submission_record public.practice_submissions%rowtype;
  practice_completion_id uuid;
begin
  select submission.*
  into submission_record
  from public.practice_submissions as submission
  where submission.id = target_submission_id;

  if submission_record.id is null then
    raise exception using
      errcode = '22023',
      message = 'PRACTICE_SUBMISSION_NOT_FOUND';
  end if;

  if target_active then
    insert into public.activity_completions (
      enrollment_id,
      course_run_id,
      learning_path_id,
      activity_id,
      source,
      completed_by
    )
    values (
      submission_record.enrollment_id,
      submission_record.course_run_id,
      submission_record.learning_path_id,
      submission_record.activity_id,
      target_source,
      target_actor_profile_id
    )
    on conflict (enrollment_id, activity_id) do nothing
    returning id into practice_completion_id;

    if practice_completion_id is null then
      select completion.id
      into practice_completion_id
      from public.activity_completions as completion
      where completion.enrollment_id = submission_record.enrollment_id
        and completion.activity_id = submission_record.activity_id;

      update public.activity_completion_states
      set
        is_active = true,
        updated_by = target_actor_profile_id,
        reason = null,
        updated_at = now()
      where activity_completion_states.completion_id = practice_completion_id;

      perform private.refresh_enrollment_progress(
        submission_record.enrollment_id,
        submission_record.learning_path_id
      );
    end if;
  else
    select completion.id
    into practice_completion_id
    from public.activity_completions as completion
    where completion.enrollment_id = submission_record.enrollment_id
      and completion.activity_id = submission_record.activity_id;

    if practice_completion_id is not null then
      update public.activity_completion_states
      set
        is_active = false,
        updated_by = target_actor_profile_id,
        reason = target_reason,
        updated_at = now()
      where activity_completion_states.completion_id = practice_completion_id;

      perform private.refresh_enrollment_progress(
        submission_record.enrollment_id,
        submission_record.learning_path_id
      );
    end if;
  end if;
end;
$$;

create function public.add_practice_entry(
  target_enrollment_id uuid,
  target_activity_id uuid,
  target_occurred_on date,
  target_minutes integer,
  target_category text,
  target_description text,
  target_idempotency_key uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  access_record jsonb;
  definition_record public.practice_definitions%rowtype;
  existing_entry public.practice_entries%rowtype;
  totals record;
  entry_id uuid;
  parsed_category public.practice_category;
begin
  access_record := private.require_student_practice_access(
    target_enrollment_id,
    target_activity_id
  );

  if target_minutes is null or target_minutes <= 0 then
    raise exception using
      errcode = '22023',
      message = 'PRACTICE_ENTRY_MINUTES_INVALID';
  end if;

  if target_occurred_on is null or target_occurred_on > current_date then
    raise exception using
      errcode = '22023',
      message = 'PRACTICE_ENTRY_DATE_INVALID';
  end if;

  if nullif(btrim(target_description), '') is null then
    raise exception using
      errcode = '22023',
      message = 'PRACTICE_ENTRY_DESCRIPTION_REQUIRED';
  end if;

  begin
    parsed_category := target_category::public.practice_category;
  exception when invalid_text_representation then
    raise exception using
      errcode = '22023',
      message = 'PRACTICE_ENTRY_CATEGORY_INVALID';
  end;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      target_enrollment_id::text || ':' || target_activity_id::text,
      0
    )
  );

  select entry.*
  into existing_entry
  from public.practice_entries as entry
  where entry.enrollment_id = target_enrollment_id
    and entry.activity_id = target_activity_id
    and entry.idempotency_key = target_idempotency_key;

  if existing_entry.id is not null then
    if existing_entry.occurred_on is distinct from target_occurred_on
      or existing_entry.minutes is distinct from target_minutes
      or existing_entry.category is distinct from parsed_category
      or existing_entry.description is distinct from btrim(target_description)
    then
      raise exception using
        errcode = '23505',
        message = 'PRACTICE_IDEMPOTENCY_CONFLICT';
    end if;

    select * into totals
    from private.practice_totals(target_enrollment_id, target_activity_id);

    return jsonb_build_object(
      'entryId', existing_entry.id,
      'totalMinutes', totals.total_minutes,
      'planningMinutes', totals.planning_minutes,
      'deliveryMinutes', totals.delivery_minutes
    );
  end if;

  select definition.*
  into definition_record
  from public.practice_definitions as definition
  where definition.activity_id = target_activity_id;

  if definition_record.activity_id is null then
    raise exception using
      errcode = '22023',
      message = 'PRACTICE_DEFINITION_MISSING';
  end if;

  select * into totals
  from private.practice_totals(target_enrollment_id, target_activity_id);

  if parsed_category = 'planning'
    and totals.planning_minutes + target_minutes > definition_record.max_planning_minutes
  then
    raise exception using
      errcode = '22023',
      message = 'PRACTICE_PLANNING_LIMIT_EXCEEDED:' ||
        (
          totals.planning_minutes + target_minutes -
          definition_record.max_planning_minutes
        )::text;
  end if;

  insert into public.practice_entries (
    enrollment_id,
    course_run_id,
    learning_path_id,
    activity_id,
    occurred_on,
    minutes,
    category,
    description,
    idempotency_key,
    created_by
  )
  values (
    target_enrollment_id,
    (access_record ->> 'courseRunId')::uuid,
    (access_record ->> 'learningPathId')::uuid,
    target_activity_id,
    target_occurred_on,
    target_minutes,
    parsed_category,
    btrim(target_description),
    target_idempotency_key,
    (access_record ->> 'profileId')::uuid
  )
  returning id into entry_id;

  insert into public.audit_events (
    actor_profile_id,
    action,
    entity_type,
    entity_id,
    after_data
  )
  values (
    (access_record ->> 'profileId')::uuid,
    'practice.entry_added',
    'practice_entry',
    entry_id::text,
    jsonb_build_object(
      'enrollmentId', target_enrollment_id,
      'activityId', target_activity_id,
      'minutes', target_minutes,
      'category', parsed_category
    )
  );

  select * into totals
  from private.practice_totals(target_enrollment_id, target_activity_id);

  return jsonb_build_object(
    'entryId', entry_id,
    'totalMinutes', totals.total_minutes,
    'planningMinutes', totals.planning_minutes,
    'deliveryMinutes', totals.delivery_minutes
  );
end;
$$;

create function public.submit_practice(
  target_enrollment_id uuid,
  target_activity_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  access_record jsonb;
  definition_record public.practice_definitions%rowtype;
  latest_submission public.practice_submissions%rowtype;
  totals record;
  next_version integer;
  submission_id uuid;
  auto_approve_at timestamptz;
begin
  access_record := private.require_student_practice_access(
    target_enrollment_id,
    target_activity_id
  );

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      target_enrollment_id::text || ':' || target_activity_id::text,
      0
    )
  );

  select definition.*
  into definition_record
  from public.practice_definitions as definition
  where definition.activity_id = target_activity_id;

  if definition_record.activity_id is null then
    raise exception using
      errcode = '22023',
      message = 'PRACTICE_DEFINITION_MISSING';
  end if;

  select submission.*
  into latest_submission
  from public.practice_submissions as submission
  where submission.enrollment_id = target_enrollment_id
    and submission.activity_id = target_activity_id
  order by submission.version_number desc
  limit 1
  for update;

  if latest_submission.id is not null
    and latest_submission.status <> 'revision_required'
  then
    raise exception using
      errcode = '55000',
      message = 'PRACTICE_SUBMISSION_STATE_INVALID';
  end if;

  select * into totals
  from private.practice_totals(target_enrollment_id, target_activity_id);

  if totals.planning_minutes > definition_record.max_planning_minutes then
    raise exception using
      errcode = '22023',
      message = 'PRACTICE_PLANNING_LIMIT_EXCEEDED:' ||
        (totals.planning_minutes - definition_record.max_planning_minutes)::text;
  end if;

  if totals.total_minutes < definition_record.required_minutes then
    raise exception using
      errcode = '22023',
      message = 'PRACTICE_MINUTES_MISSING:' ||
        (definition_record.required_minutes - totals.total_minutes)::text;
  end if;

  next_version := coalesce(latest_submission.version_number, 0) + 1;
  auto_approve_at := case
    when definition_record.approval_mode = 'auto_approve'
      then clock_timestamp() +
        pg_catalog.make_interval(hours => definition_record.auto_delay_hours)
    else null
  end;

  insert into public.practice_submissions (
    enrollment_id,
    course_run_id,
    learning_path_id,
    activity_id,
    version_number,
    status,
    included_entry_ids,
    total_minutes,
    planning_minutes,
    delivery_minutes,
    approval_mode,
    auto_approve_at,
    submitted_by
  )
  values (
    target_enrollment_id,
    (access_record ->> 'courseRunId')::uuid,
    (access_record ->> 'learningPathId')::uuid,
    target_activity_id,
    next_version,
    'submitted',
    totals.entry_ids,
    totals.total_minutes,
    totals.planning_minutes,
    totals.delivery_minutes,
    definition_record.approval_mode,
    auto_approve_at,
    (access_record ->> 'profileId')::uuid
  )
  returning id into submission_id;

  insert into public.practice_submission_events (
    submission_id,
    event_type,
    from_status,
    to_status,
    actor_profile_id
  )
  values (
    submission_id,
    'submitted',
    case when latest_submission.id is null then null
      else latest_submission.status end,
    'submitted',
    (access_record ->> 'profileId')::uuid
  );

  insert into public.audit_events (
    actor_profile_id,
    action,
    entity_type,
    entity_id,
    after_data
  )
  values (
    (access_record ->> 'profileId')::uuid,
    'practice.submitted',
    'practice_submission',
    submission_id::text,
    jsonb_build_object(
      'activityId', target_activity_id,
      'versionNumber', next_version,
      'totalMinutes', totals.total_minutes,
      'planningMinutes', totals.planning_minutes,
      'approvalMode', definition_record.approval_mode,
      'autoApproveAt', auto_approve_at
    )
  );

  return jsonb_build_object(
    'submissionId', submission_id,
    'versionNumber', next_version,
    'status', 'submitted',
    'autoApproveAt', auto_approve_at
  );
end;
$$;

create function public.review_practice_submission(
  target_submission_id uuid,
  target_action text,
  target_comment text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_profile_id uuid;
  submission_record public.practice_submissions%rowtype;
  next_status public.practice_submission_status;
  event_type public.practice_event_type;
begin
  actor_profile_id := private.current_profile_id();

  select submission.*
  into submission_record
  from public.practice_submissions as submission
  where submission.id = target_submission_id
  for update;

  if actor_profile_id is null
    or submission_record.id is null
    or not (
      private.is_administrator()
      or private.has_course_role(
        submission_record.course_run_id,
        array['course_teacher', 'course_lead']::public.portal_role[]
      )
    )
  then
    raise exception using
      errcode = '42501',
      message = 'PRACTICE_REVIEW_FORBIDDEN';
  end if;

  if nullif(btrim(target_comment), '') is null then
    raise exception using
      errcode = '22023',
      message = 'PRACTICE_REVIEW_COMMENT_REQUIRED';
  end if;

  if target_action = 'approve'
    and submission_record.status = 'submitted'
    and submission_record.approval_mode = 'manual_review'
  then
    next_status := 'approved_manual';
    event_type := 'approved_manual';
  elsif target_action = 'request_revision'
    and submission_record.status = 'submitted'
  then
    next_status := 'revision_required';
    event_type := 'revision_required';
  elsif target_action = 'spot_check_revoke'
    and submission_record.status in ('approved_manual', 'approved_auto')
  then
    next_status := 'revision_required';
    event_type := 'spot_check_revoked';
  else
    raise exception using
      errcode = '55000',
      message = 'PRACTICE_REVIEW_STATE_INVALID';
  end if;

  update public.practice_submissions
  set status = next_status, updated_at = now()
  where id = target_submission_id;

  insert into public.practice_submission_events (
    submission_id,
    event_type,
    from_status,
    to_status,
    reason,
    actor_profile_id
  )
  values (
    target_submission_id,
    event_type,
    submission_record.status,
    next_status,
    btrim(target_comment),
    actor_profile_id
  );

  if next_status = 'approved_manual' then
    perform private.set_practice_completion(
      target_submission_id,
      true,
      actor_profile_id,
      'teacher',
      null
    );
  elsif next_status = 'revision_required' then
    perform private.set_practice_completion(
      target_submission_id,
      false,
      actor_profile_id,
      'teacher',
      btrim(target_comment)
    );
  end if;

  insert into public.audit_events (
    actor_profile_id,
    action,
    entity_type,
    entity_id,
    reason,
    before_data,
    after_data
  )
  values (
    actor_profile_id,
    case when target_action = 'spot_check_revoke'
      then 'practice.spot_check_revoked'
      else 'practice.reviewed' end,
    'practice_submission',
    target_submission_id::text,
    btrim(target_comment),
    jsonb_build_object('status', submission_record.status),
    jsonb_build_object('status', next_status)
  );

  return jsonb_build_object(
    'submissionId', target_submission_id,
    'status', next_status
  );
end;
$$;

create function public.process_due_practice_submissions(
  process_at timestamptz default clock_timestamp()
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  submission_record public.practice_submissions%rowtype;
  processed_count integer := 0;
begin
  for submission_record in
    select submission.*
    from public.practice_submissions as submission
    where submission.status = 'submitted'
      and submission.approval_mode = 'auto_approve'
      and submission.auto_approve_at <= process_at
    order by submission.auto_approve_at, submission.id
    for update skip locked
  loop
    update public.practice_submissions
    set status = 'approved_auto', updated_at = process_at
    where id = submission_record.id;

    insert into public.practice_submission_events (
      submission_id,
      event_type,
      from_status,
      to_status,
      actor_profile_id,
      occurred_at
    )
    values (
      submission_record.id,
      'approved_auto',
      'submitted',
      'approved_auto',
      null,
      process_at
    );

    perform private.set_practice_completion(
      submission_record.id,
      true,
      submission_record.submitted_by,
      'system',
      null
    );

    insert into public.audit_events (
      actor_profile_id,
      action,
      entity_type,
      entity_id,
      before_data,
      after_data,
      occurred_at
    )
    values (
      null,
      'practice.approved_auto',
      'practice_submission',
      submission_record.id::text,
      jsonb_build_object('status', 'submitted'),
      jsonb_build_object('status', 'approved_auto'),
      process_at
    );

    processed_count := processed_count + 1;
  end loop;

  return processed_count;
end;
$$;

create function public.get_practice_for_student(target_activity_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  actor_profile_id uuid;
  enrollment_record public.enrollments%rowtype;
  activity_record public.activities%rowtype;
  definition_record public.practice_definitions%rowtype;
  totals record;
  latest_submission public.practice_submissions%rowtype;
begin
  actor_profile_id := private.current_profile_id();

  select enrollment.*
  into enrollment_record
  from public.enrollments as enrollment
  join public.learning_paths as learning_path
    on learning_path.course_run_id = enrollment.course_run_id
    and learning_path.status = 'published'
  join public.activities as activity
    on activity.learning_path_id = learning_path.id
    and activity.id = target_activity_id
    and activity.activity_type = 'practice'
  where enrollment.profile_id = actor_profile_id
    and enrollment.status = 'active'
  limit 1;

  if enrollment_record.id is null then
    raise exception using
      errcode = '42501',
      message = 'PRACTICE_ACCESS_FORBIDDEN';
  end if;

  select activity.*
  into activity_record
  from public.activities as activity
  where activity.id = target_activity_id;

  select definition.*
  into definition_record
  from public.practice_definitions as definition
  where definition.activity_id = target_activity_id;

  if definition_record.activity_id is null then
    raise exception using
      errcode = '22023',
      message = 'PRACTICE_DEFINITION_MISSING';
  end if;

  select * into totals
  from private.practice_totals(enrollment_record.id, target_activity_id);

  select submission.*
  into latest_submission
  from public.practice_submissions as submission
  where submission.enrollment_id = enrollment_record.id
    and submission.activity_id = target_activity_id
  order by submission.version_number desc
  limit 1;

  return jsonb_build_object(
    'activityId', target_activity_id,
    'enrollmentId', enrollment_record.id,
    'courseRunId', enrollment_record.course_run_id,
    'title', activity_record.title,
    'requiredMinutes', definition_record.required_minutes,
    'maxPlanningMinutes', definition_record.max_planning_minutes,
    'totalMinutes', totals.total_minutes,
    'planningMinutes', totals.planning_minutes,
    'deliveryMinutes', totals.delivery_minutes,
    'status', latest_submission.status,
    'latestVersionNumber', latest_submission.version_number,
    'canSubmit',
      totals.total_minutes >= definition_record.required_minutes
      and totals.planning_minutes <= definition_record.max_planning_minutes
      and (
        latest_submission.id is null
        or latest_submission.status = 'revision_required'
      ),
    'entries', coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'id', entry.id,
            'occurredOn', entry.occurred_on,
            'minutes', entry.minutes,
            'category', entry.category,
            'description', entry.description,
            'createdAt', entry.created_at
          )
          order by entry.occurred_on desc, entry.created_at desc
        )
        from public.practice_entries as entry
        where entry.enrollment_id = enrollment_record.id
          and entry.activity_id = target_activity_id
      ),
      '[]'::jsonb
    ),
    'submissions', coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'id', submission.id,
            'versionNumber', submission.version_number,
            'status', submission.status,
            'totalMinutes', submission.total_minutes,
            'planningMinutes', submission.planning_minutes,
            'deliveryMinutes', submission.delivery_minutes,
            'submittedAt', submission.submitted_at,
            'events', coalesce(
              (
                select jsonb_agg(
                  jsonb_build_object(
                    'id', event.id,
                    'type', event.event_type,
                    'reason', event.reason,
                    'occurredAt', event.occurred_at
                  )
                  order by event.occurred_at, event.id
                )
                from public.practice_submission_events as event
                where event.submission_id = submission.id
              ),
              '[]'::jsonb
            )
          )
          order by submission.version_number desc
        )
        from public.practice_submissions as submission
        where submission.enrollment_id = enrollment_record.id
          and submission.activity_id = target_activity_id
      ),
      '[]'::jsonb
    )
  );
end;
$$;

revoke all on function private.validate_practice_definition() from public, anon, authenticated;
revoke all on function private.reject_practice_entry_mutation() from public, anon, authenticated;
revoke all on function private.protect_practice_submission_snapshot() from public, anon, authenticated;
revoke all on function private.reject_practice_event_mutation() from public, anon, authenticated;
revoke all on function private.practice_totals(uuid, uuid) from public, anon, authenticated;
revoke all on function private.require_student_practice_access(uuid, uuid) from public, anon, authenticated;
revoke all on function private.set_practice_completion(uuid, boolean, uuid, public.activity_completion_source, text) from public, anon, authenticated;
revoke all on function public.add_practice_entry(uuid, uuid, date, integer, text, text, uuid) from public, anon;
revoke all on function public.submit_practice(uuid, uuid) from public, anon;
revoke all on function public.review_practice_submission(uuid, text, text) from public, anon;
revoke all on function public.process_due_practice_submissions(timestamptz) from public, anon, authenticated;
revoke all on function public.get_practice_for_student(uuid) from public, anon;

grant execute on function public.add_practice_entry(uuid, uuid, date, integer, text, text, uuid) to authenticated;
grant execute on function public.submit_practice(uuid, uuid) to authenticated;
grant execute on function public.review_practice_submission(uuid, text, text) to authenticated;
grant execute on function public.process_due_practice_submissions(timestamptz) to service_role;
grant execute on function public.get_practice_for_student(uuid) to authenticated;

alter table public.practice_definitions enable row level security;
alter table public.practice_entries enable row level security;
alter table public.practice_submissions enable row level security;
alter table public.practice_submission_events enable row level security;

revoke all on table public.practice_definitions from anon, authenticated;
revoke all on table public.practice_entries from anon, authenticated;
revoke all on table public.practice_submissions from anon, authenticated;
revoke all on table public.practice_submission_events from anon, authenticated;
revoke all on sequence public.practice_submission_events_id_seq from anon, authenticated;

grant select on table public.practice_definitions to authenticated;
grant select on table public.practice_entries to authenticated;
grant select on table public.practice_submissions to authenticated;
grant select on table public.practice_submission_events to authenticated;

create policy practice_definitions_course_access_select
on public.practice_definitions
for select
to authenticated
using (
  (select private.is_administrator())
  or exists (
    select 1
    from public.activities as activity
    join public.learning_paths as learning_path
      on learning_path.id = activity.learning_path_id
    where activity.id = practice_definitions.activity_id
      and (
        private.has_course_role(
          learning_path.course_run_id,
          array['course_teacher', 'course_lead']::public.portal_role[]
        )
        or exists (
          select 1
          from public.enrollments as enrollment
          where enrollment.course_run_id = learning_path.course_run_id
            and enrollment.profile_id = (select private.current_profile_id())
            and enrollment.status = 'active'
        )
      )
  )
);

create policy practice_entries_self_or_staff_select
on public.practice_entries
for select
to authenticated
using (
  created_by = (select private.current_profile_id())
  or (select private.is_administrator())
  or private.has_course_role(
    course_run_id,
    array['course_teacher', 'course_lead']::public.portal_role[]
  )
);

create policy practice_submissions_self_or_staff_select
on public.practice_submissions
for select
to authenticated
using (
  submitted_by = (select private.current_profile_id())
  or (select private.is_administrator())
  or private.has_course_role(
    course_run_id,
    array['course_teacher', 'course_lead']::public.portal_role[]
  )
);

create policy practice_submission_events_self_or_staff_select
on public.practice_submission_events
for select
to authenticated
using (
  exists (
    select 1
    from public.practice_submissions as submission
    where submission.id = practice_submission_events.submission_id
      and (
        submission.submitted_by = (select private.current_profile_id())
        or (select private.is_administrator())
        or private.has_course_role(
          submission.course_run_id,
          array['course_teacher', 'course_lead']::public.portal_role[]
        )
      )
  )
);

do $$
begin
  if exists (
    select 1 from pg_catalog.pg_extension where extname = 'pg_cron'
  ) then
    execute $schedule$
      select cron.schedule(
        'process-due-practice-submissions',
        '*/5 * * * *',
        'select public.process_due_practice_submissions(clock_timestamp());'
      )
    $schedule$;
  end if;
end;
$$;
