alter table public.course_sessions
add constraint course_sessions_id_course_run_unique unique (id, course_run_id);

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'certificates',
  'certificates',
  false,
  10485760,
  array['application/pdf']::text[]
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create table public.attendance_records (
  id uuid primary key default gen_random_uuid(),
  enrollment_id uuid not null,
  course_run_id uuid not null,
  session_id uuid not null,
  planned_minutes integer not null
    constraint attendance_records_planned_positive check (planned_minutes > 0),
  present_minutes integer not null
    constraint attendance_records_present_valid
    check (present_minutes >= 0 and present_minutes <= planned_minutes),
  reason text not null
    constraint attendance_records_reason_not_blank
    check (char_length(btrim(reason)) > 0),
  recorded_by uuid not null references public.profiles(id) on delete restrict,
  recorded_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint attendance_records_enrollment_course_fk
    foreign key (enrollment_id, course_run_id)
    references public.enrollments(id, course_run_id)
    on delete restrict,
  constraint attendance_records_session_course_fk
    foreign key (session_id, course_run_id)
    references public.course_sessions(id, course_run_id)
    on delete restrict,
  constraint attendance_records_enrollment_session_unique
    unique (enrollment_id, session_id)
);

create index attendance_records_course_session_idx
  on public.attendance_records (course_run_id, session_id, enrollment_id);

create table public.university_requirements (
  enrollment_id uuid primary key,
  course_run_id uuid not null,
  completed boolean not null default false,
  note text,
  verified_by uuid references public.profiles(id) on delete restrict,
  verified_at timestamptz,
  updated_at timestamptz not null default now(),
  constraint university_requirements_enrollment_course_fk
    foreign key (enrollment_id, course_run_id)
    references public.enrollments(id, course_run_id)
    on delete restrict,
  constraint university_requirements_verification_consistent check (
    (completed and verified_by is not null and verified_at is not null)
    or (not completed and verified_by is null and verified_at is null)
  )
);

create table public.completion_overrides (
  id uuid primary key default gen_random_uuid(),
  enrollment_id uuid not null,
  course_run_id uuid not null,
  gate_code text not null
    constraint completion_overrides_gate_allowed check (gate_code = 'attendance'),
  reason text not null
    constraint completion_overrides_reason_not_blank
    check (char_length(btrim(reason)) > 0),
  approved_by uuid not null references public.profiles(id) on delete restrict,
  approved_at timestamptz not null default now(),
  constraint completion_overrides_enrollment_course_fk
    foreign key (enrollment_id, course_run_id)
    references public.enrollments(id, course_run_id)
    on delete restrict,
  constraint completion_overrides_enrollment_gate_unique
    unique (enrollment_id, gate_code)
);

create table public.course_session_selections (
  enrollment_id uuid not null,
  course_run_id uuid not null,
  session_id uuid not null,
  source text not null default 'checkin'
    constraint course_session_selections_source_not_blank
    check (char_length(btrim(source)) > 0),
  selected_at timestamptz not null default now(),
  recorded_by uuid references public.profiles(id) on delete restrict,
  primary key (enrollment_id, session_id),
  constraint course_session_selections_enrollment_course_fk
    foreign key (enrollment_id, course_run_id)
    references public.enrollments(id, course_run_id)
    on delete restrict,
  constraint course_session_selections_session_course_fk
    foreign key (session_id, course_run_id)
    references public.course_sessions(id, course_run_id)
    on delete restrict
);

create table public.certificates (
  id uuid primary key default gen_random_uuid(),
  enrollment_id uuid not null unique,
  course_run_id uuid not null,
  certificate_number text not null unique
    constraint certificates_number_not_blank
    check (char_length(btrim(certificate_number)) > 0),
  template_version text not null
    constraint certificates_template_not_blank
    check (char_length(btrim(template_version)) > 0),
  display_name text not null
    constraint certificates_name_not_blank
    check (char_length(btrim(display_name)) > 0),
  course_title text not null
    constraint certificates_course_not_blank
    check (char_length(btrim(course_title)) > 0),
  completed_on date not null,
  storage_path text unique,
  sha256 text
    constraint certificates_sha256_format
    check (sha256 is null or sha256 ~ '^[0-9a-f]{64}$'),
  generated_at timestamptz,
  created_at timestamptz not null default now(),
  constraint certificates_enrollment_course_fk
    foreign key (enrollment_id, course_run_id)
    references public.enrollments(id, course_run_id)
    on delete restrict,
  constraint certificates_file_consistent check (
    (storage_path is null and sha256 is null and generated_at is null)
    or (storage_path is not null and sha256 is not null and generated_at is not null)
  )
);

create index certificates_course_completed_idx
  on public.certificates (course_run_id, completed_on, display_name);

create table public.completion_admin_tasks (
  id uuid primary key default gen_random_uuid(),
  enrollment_id uuid not null,
  course_run_id uuid not null,
  task_code text not null
    constraint completion_admin_tasks_code_allowed
    check (task_code = 'invoice_youth_drive_difference'),
  status text not null default 'pending'
    constraint completion_admin_tasks_status_allowed
    check (status in ('pending', 'completed')),
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  completed_by uuid references public.profiles(id) on delete restrict,
  constraint completion_admin_tasks_enrollment_course_fk
    foreign key (enrollment_id, course_run_id)
    references public.enrollments(id, course_run_id)
    on delete restrict,
  constraint completion_admin_tasks_unique unique (enrollment_id, task_code),
  constraint completion_admin_tasks_completion_consistent check (
    (status = 'pending' and completed_at is null and completed_by is null)
    or (status = 'completed' and completed_at is not null and completed_by is not null)
  )
);

create function private.course_completion_evaluation(target_enrollment_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  enrollment_record public.enrollments%rowtype;
  course_level smallint;
  published_path_count integer;
  progress_percentage smallint;
  progress_met boolean;
  required_session_count integer;
  recorded_session_count integer;
  planned_minutes integer;
  present_minutes integer;
  attendance_ratio numeric;
  attendance_display_percentage integer;
  attendance_override boolean;
  attendance_met boolean;
  required_practice_count integer;
  completed_practice_count integer;
  practice_met boolean;
  university_met boolean;
  youth_drive_selected boolean;
  youth_drive_attended boolean;
  missing text[] := array[]::text[];
  admin_tasks text[] := array[]::text[];
  existing_certificate_id uuid;
begin
  select enrollment.*
  into enrollment_record
  from public.enrollments as enrollment
  where enrollment.id = target_enrollment_id;

  if enrollment_record.id is null then
    raise exception using
      errcode = '22023',
      message = 'COMPLETION_ENROLLMENT_NOT_FOUND';
  end if;

  select template.level
  into course_level
  from public.course_runs as course_run
  join public.course_templates as template
    on template.id = course_run.template_id
  where course_run.id = enrollment_record.course_run_id;

  select
    count(*)::integer,
    coalesce(min(progress.percentage), 0)::smallint
  into published_path_count, progress_percentage
  from public.learning_paths as learning_path
  left join public.enrollment_progress as progress
    on progress.learning_path_id = learning_path.id
    and progress.enrollment_id = target_enrollment_id
  where learning_path.course_run_id = enrollment_record.course_run_id
    and learning_path.status = 'published';

  progress_met := published_path_count > 0 and progress_percentage = 100;

  select count(*)::integer
  into required_session_count
  from public.course_sessions as session
  where session.course_run_id = enrollment_record.course_run_id
    and session.is_required
    and session.session_type = 'regular';

  select
    count(*)::integer,
    coalesce(sum(attendance.planned_minutes), 0)::integer,
    coalesce(sum(attendance.present_minutes), 0)::integer
  into recorded_session_count, planned_minutes, present_minutes
  from public.attendance_records as attendance
  join public.course_sessions as session
    on session.id = attendance.session_id
    and session.course_run_id = attendance.course_run_id
    and session.is_required
    and session.session_type = 'regular'
  where attendance.enrollment_id = target_enrollment_id;

  attendance_ratio := case
    when planned_minutes = 0 then 0
    else present_minutes::numeric / planned_minutes::numeric
  end;
  attendance_display_percentage := round(attendance_ratio * 100)::integer;

  select exists (
    select 1
    from public.completion_overrides as completion_override
    where completion_override.enrollment_id = target_enrollment_id
      and completion_override.gate_code = 'attendance'
  )
  into attendance_override;

  attendance_met := attendance_override or (
    required_session_count > 0
    and recorded_session_count = required_session_count
    and attendance_ratio >= 0.8
  );

  select count(*)::integer
  into required_practice_count
  from public.activities as activity
  join public.learning_paths as learning_path
    on learning_path.id = activity.learning_path_id
    and learning_path.course_run_id = enrollment_record.course_run_id
    and learning_path.status = 'published'
  where activity.required
    and activity.activity_type = 'practice';

  select count(*)::integer
  into completed_practice_count
  from public.activities as activity
  join public.learning_paths as learning_path
    on learning_path.id = activity.learning_path_id
    and learning_path.course_run_id = enrollment_record.course_run_id
    and learning_path.status = 'published'
  join public.activity_completions as completion
    on completion.activity_id = activity.id
    and completion.enrollment_id = target_enrollment_id
  join public.activity_completion_states as completion_state
    on completion_state.completion_id = completion.id
    and completion_state.is_active
  where activity.required
    and activity.activity_type = 'practice';

  practice_met := required_practice_count > 0
    and completed_practice_count = required_practice_count;

  if course_level = 1 then
    university_met := true;
  else
    select coalesce(requirement.completed, false)
    into university_met
    from public.university_requirements as requirement
    where requirement.enrollment_id = target_enrollment_id;
    university_met := coalesce(university_met, false);
  end if;

  select exists (
    select 1
    from public.course_session_selections as selection
    join public.course_sessions as session
      on session.id = selection.session_id
      and session.session_type = 'youth_drive'
    where selection.enrollment_id = target_enrollment_id
  )
  into youth_drive_selected;

  select exists (
    select 1
    from public.course_session_selections as selection
    join public.course_sessions as session
      on session.id = selection.session_id
      and session.session_type = 'youth_drive'
    join public.attendance_records as attendance
      on attendance.enrollment_id = selection.enrollment_id
      and attendance.session_id = selection.session_id
      and attendance.present_minutes > 0
    where selection.enrollment_id = target_enrollment_id
  )
  into youth_drive_attended;

  if not progress_met then missing := array_append(missing, 'progress'); end if;
  if not attendance_met then missing := array_append(missing, 'attendance'); end if;
  if not practice_met then missing := array_append(missing, 'practice'); end if;
  if not university_met then missing := array_append(missing, 'university'); end if;

  if youth_drive_selected and not youth_drive_attended then
    admin_tasks := array_append(admin_tasks, 'invoice_youth_drive_difference');
  end if;

  select certificate.id
  into existing_certificate_id
  from public.certificates as certificate
  where certificate.enrollment_id = target_enrollment_id;

  return jsonb_build_object(
    'complete', cardinality(missing) = 0,
    'missing', to_jsonb(missing),
    'adminTasks', to_jsonb(admin_tasks),
    'progressPercentage', progress_percentage,
    'attendanceRawRatio', attendance_ratio,
    'attendanceDisplayPercentage', attendance_display_percentage,
    'attendanceOverride', attendance_override,
    'practiceApproved', practice_met,
    'universityCompleted', university_met,
    'certificateId', existing_certificate_id
  );
end;
$$;

create function private.try_complete_enrollment(target_enrollment_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  evaluation jsonb;
  enrollment_record public.enrollments%rowtype;
  profile_name text;
  course_title text;
  course_start_year smallint;
  certificate_id uuid;
  certificate_number text;
  transitioned boolean := false;
  admin_task text;
begin
  select enrollment.*
  into enrollment_record
  from public.enrollments as enrollment
  where enrollment.id = target_enrollment_id
  for update;

  if enrollment_record.id is null then
    raise exception using
      errcode = '22023',
      message = 'COMPLETION_ENROLLMENT_NOT_FOUND';
  end if;

  evaluation := private.course_completion_evaluation(target_enrollment_id);

  if not coalesce((evaluation ->> 'complete')::boolean, false)
    or enrollment_record.status = 'withdrawn'
  then
    return evaluation;
  end if;

  select profile.display_name, course_run.title, course_run.start_year
  into profile_name, course_title, course_start_year
  from public.profiles as profile
  join public.course_runs as course_run
    on course_run.id = enrollment_record.course_run_id
  where profile.id = enrollment_record.profile_id;

  select certificate.id, certificate.certificate_number
  into certificate_id, certificate_number
  from public.certificates as certificate
  where certificate.enrollment_id = target_enrollment_id;

  if certificate_id is null then
    certificate_id := gen_random_uuid();
    certificate_number :=
      'NGF-' || course_start_year::text || '-' ||
      upper(substr(replace(certificate_id::text, '-', ''), 1, 10));

    insert into public.certificates (
      id,
      enrollment_id,
      course_run_id,
      certificate_number,
      template_version,
      display_name,
      course_title,
      completed_on
    )
    values (
      certificate_id,
      target_enrollment_id,
      enrollment_record.course_run_id,
      certificate_number,
      'digital-v1',
      profile_name,
      course_title,
      current_date
    );
  end if;

  if enrollment_record.status <> 'completed' then
    update public.enrollments
    set
      status = 'completed',
      status_changed_at = now(),
      status_reason = 'Alle sluttkrav er oppfylt'
    where id = target_enrollment_id;
    transitioned := true;
  end if;

  insert into public.outbox_events (
    event_type,
    idempotency_key,
    payload
  )
  values (
    'certificate.issue_requested',
    'certificate:' || certificate_id::text,
    jsonb_build_object(
      'certificateId', certificate_id,
      'enrollmentId', target_enrollment_id,
      'certificateNumber', certificate_number
    )
  )
  on conflict (idempotency_key) do nothing;

  for admin_task in
    select value
    from jsonb_array_elements_text(evaluation -> 'adminTasks') as task(value)
  loop
    insert into public.completion_admin_tasks (
      enrollment_id,
      course_run_id,
      task_code
    )
    values (
      target_enrollment_id,
      enrollment_record.course_run_id,
      admin_task
    )
    on conflict (enrollment_id, task_code) do nothing;
  end loop;

  if transitioned then
    insert into public.audit_events (
      actor_profile_id,
      action,
      entity_type,
      entity_id,
      after_data
    )
    values (
      null,
      'course.completed',
      'enrollment',
      target_enrollment_id::text,
      jsonb_build_object(
        'certificateId', certificate_id,
        'certificateNumber', certificate_number,
        'evaluation', evaluation
      )
    );
  end if;

  return evaluation || jsonb_build_object('certificateId', certificate_id);
end;
$$;

create function private.try_complete_from_progress()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.try_complete_enrollment(new.enrollment_id);
  return new;
end;
$$;

create trigger enrollment_progress_try_course_completion
after insert or update on public.enrollment_progress
for each row execute function private.try_complete_from_progress();

create function public.record_attendance(
  target_enrollment_id uuid,
  target_session_id uuid,
  target_planned_minutes integer,
  target_present_minutes integer,
  target_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_profile_id uuid;
  enrollment_record public.enrollments%rowtype;
  session_record public.course_sessions%rowtype;
  attendance_id uuid;
begin
  actor_profile_id := private.current_profile_id();

  select enrollment.*
  into enrollment_record
  from public.enrollments as enrollment
  where enrollment.id = target_enrollment_id;

  select session.*
  into session_record
  from public.course_sessions as session
  where session.id = target_session_id;

  if actor_profile_id is null
    or enrollment_record.id is null
    or session_record.id is null
    or enrollment_record.course_run_id <> session_record.course_run_id
    or not (
      private.is_administrator()
      or private.has_course_role(
        enrollment_record.course_run_id,
        array['course_teacher', 'course_lead']::public.portal_role[]
      )
    )
  then
    raise exception using
      errcode = '42501',
      message = 'ATTENDANCE_RECORD_FORBIDDEN';
  end if;

  if target_planned_minutes is null
    or target_planned_minutes <= 0
    or target_present_minutes is null
    or target_present_minutes < 0
    or target_present_minutes > target_planned_minutes
    or nullif(btrim(target_reason), '') is null
  then
    raise exception using
      errcode = '22023',
      message = 'ATTENDANCE_RECORD_INVALID';
  end if;

  insert into public.attendance_records (
    enrollment_id,
    course_run_id,
    session_id,
    planned_minutes,
    present_minutes,
    reason,
    recorded_by
  )
  values (
    target_enrollment_id,
    enrollment_record.course_run_id,
    target_session_id,
    target_planned_minutes,
    target_present_minutes,
    btrim(target_reason),
    actor_profile_id
  )
  on conflict (enrollment_id, session_id) do update
  set
    planned_minutes = excluded.planned_minutes,
    present_minutes = excluded.present_minutes,
    reason = excluded.reason,
    recorded_by = excluded.recorded_by,
    updated_at = now()
  returning id into attendance_id;

  insert into public.audit_events (
    actor_profile_id,
    action,
    entity_type,
    entity_id,
    reason,
    after_data
  )
  values (
    actor_profile_id,
    'attendance.recorded',
    'attendance_record',
    attendance_id::text,
    btrim(target_reason),
    jsonb_build_object(
      'enrollmentId', target_enrollment_id,
      'sessionId', target_session_id,
      'plannedMinutes', target_planned_minutes,
      'presentMinutes', target_present_minutes
    )
  );

  return private.try_complete_enrollment(target_enrollment_id);
end;
$$;

create function public.set_attendance_completion_override(
  target_enrollment_id uuid,
  target_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_profile_id uuid;
  enrollment_record public.enrollments%rowtype;
  override_id uuid;
begin
  actor_profile_id := private.current_profile_id();

  if actor_profile_id is null or not private.is_administrator() then
    raise exception using
      errcode = '42501',
      message = 'COMPLETION_OVERRIDE_ADMIN_ONLY';
  end if;

  if nullif(btrim(target_reason), '') is null then
    raise exception using
      errcode = '22023',
      message = 'COMPLETION_OVERRIDE_REASON_REQUIRED';
  end if;

  select enrollment.*
  into enrollment_record
  from public.enrollments as enrollment
  where enrollment.id = target_enrollment_id;

  if enrollment_record.id is null then
    raise exception using
      errcode = '22023',
      message = 'COMPLETION_ENROLLMENT_NOT_FOUND';
  end if;

  insert into public.completion_overrides (
    enrollment_id,
    course_run_id,
    gate_code,
    reason,
    approved_by
  )
  values (
    target_enrollment_id,
    enrollment_record.course_run_id,
    'attendance',
    btrim(target_reason),
    actor_profile_id
  )
  on conflict (enrollment_id, gate_code) do update
  set
    reason = excluded.reason,
    approved_by = excluded.approved_by,
    approved_at = now()
  returning id into override_id;

  insert into public.audit_events (
    actor_profile_id,
    action,
    entity_type,
    entity_id,
    reason,
    after_data
  )
  values (
    actor_profile_id,
    'completion.attendance_overridden',
    'completion_override',
    override_id::text,
    btrim(target_reason),
    jsonb_build_object('enrollmentId', target_enrollment_id)
  );

  return private.try_complete_enrollment(target_enrollment_id);
end;
$$;

create function public.set_university_completion(
  target_enrollment_id uuid,
  target_completed boolean,
  target_note text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_profile_id uuid;
  enrollment_record public.enrollments%rowtype;
begin
  actor_profile_id := private.current_profile_id();

  if actor_profile_id is null or not private.is_administrator() then
    raise exception using
      errcode = '42501',
      message = 'UNIVERSITY_REQUIREMENT_ADMIN_ONLY';
  end if;

  select enrollment.*
  into enrollment_record
  from public.enrollments as enrollment
  where enrollment.id = target_enrollment_id;

  if enrollment_record.id is null then
    raise exception using
      errcode = '22023',
      message = 'COMPLETION_ENROLLMENT_NOT_FOUND';
  end if;

  insert into public.university_requirements (
    enrollment_id,
    course_run_id,
    completed,
    note,
    verified_by,
    verified_at
  )
  values (
    target_enrollment_id,
    enrollment_record.course_run_id,
    target_completed,
    nullif(btrim(target_note), ''),
    case when target_completed then actor_profile_id else null end,
    case when target_completed then now() else null end
  )
  on conflict (enrollment_id) do update
  set
    completed = excluded.completed,
    note = excluded.note,
    verified_by = excluded.verified_by,
    verified_at = excluded.verified_at,
    updated_at = now();

  insert into public.audit_events (
    actor_profile_id,
    action,
    entity_type,
    entity_id,
    reason,
    after_data
  )
  values (
    actor_profile_id,
    'completion.university_requirement_set',
    'enrollment',
    target_enrollment_id::text,
    nullif(btrim(target_note), ''),
    jsonb_build_object('completed', target_completed)
  );

  return private.try_complete_enrollment(target_enrollment_id);
end;
$$;

create function public.evaluate_course_completion(target_enrollment_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_profile_id uuid;
  enrollment_record public.enrollments%rowtype;
begin
  actor_profile_id := private.current_profile_id();

  select enrollment.*
  into enrollment_record
  from public.enrollments as enrollment
  where enrollment.id = target_enrollment_id;

  if actor_profile_id is null
    or enrollment_record.id is null
    or not (
      enrollment_record.profile_id = actor_profile_id
      or private.is_administrator()
      or private.has_course_role(
        enrollment_record.course_run_id,
        array['course_teacher', 'course_lead']::public.portal_role[]
      )
    )
  then
    raise exception using
      errcode = '42501',
      message = 'COMPLETION_EVALUATION_FORBIDDEN';
  end if;

  return private.try_complete_enrollment(target_enrollment_id);
end;
$$;

revoke all on function private.course_completion_evaluation(uuid) from public, anon, authenticated;
revoke all on function private.try_complete_enrollment(uuid) from public, anon, authenticated;
revoke all on function private.try_complete_from_progress() from public, anon, authenticated;
revoke all on function public.record_attendance(uuid, uuid, integer, integer, text) from public, anon;
revoke all on function public.set_attendance_completion_override(uuid, text) from public, anon;
revoke all on function public.set_university_completion(uuid, boolean, text) from public, anon;
revoke all on function public.evaluate_course_completion(uuid) from public, anon;

grant execute on function public.record_attendance(uuid, uuid, integer, integer, text) to authenticated;
grant execute on function public.set_attendance_completion_override(uuid, text) to authenticated;
grant execute on function public.set_university_completion(uuid, boolean, text) to authenticated;
grant execute on function public.evaluate_course_completion(uuid) to authenticated;

alter table public.attendance_records enable row level security;
alter table public.university_requirements enable row level security;
alter table public.completion_overrides enable row level security;
alter table public.course_session_selections enable row level security;
alter table public.certificates enable row level security;
alter table public.completion_admin_tasks enable row level security;

revoke all on table public.attendance_records from anon, authenticated;
revoke all on table public.university_requirements from anon, authenticated;
revoke all on table public.completion_overrides from anon, authenticated;
revoke all on table public.course_session_selections from anon, authenticated;
revoke all on table public.certificates from anon, authenticated;
revoke all on table public.completion_admin_tasks from anon, authenticated;

grant select on table public.attendance_records to authenticated;
grant select on table public.university_requirements to authenticated;
grant select on table public.completion_overrides to authenticated;
grant select on table public.course_session_selections to authenticated;
grant select on table public.certificates to authenticated;
grant select on table public.completion_admin_tasks to authenticated;

create policy attendance_records_self_or_staff_select
on public.attendance_records
for select
to authenticated
using (
  exists (
    select 1
    from public.enrollments as enrollment
    where enrollment.id = attendance_records.enrollment_id
      and (
        enrollment.profile_id = (select private.current_profile_id())
        or (select private.is_administrator())
        or private.has_course_role(
          attendance_records.course_run_id,
          array['course_teacher', 'course_lead']::public.portal_role[]
        )
      )
  )
);

create policy university_requirements_self_or_staff_select
on public.university_requirements
for select
to authenticated
using (
  exists (
    select 1
    from public.enrollments as enrollment
    where enrollment.id = university_requirements.enrollment_id
      and (
        enrollment.profile_id = (select private.current_profile_id())
        or (select private.is_administrator())
        or private.has_course_role(
          university_requirements.course_run_id,
          array['course_teacher', 'course_lead']::public.portal_role[]
        )
      )
  )
);

create policy completion_overrides_self_or_staff_select
on public.completion_overrides
for select
to authenticated
using (
  exists (
    select 1
    from public.enrollments as enrollment
    where enrollment.id = completion_overrides.enrollment_id
      and (
        enrollment.profile_id = (select private.current_profile_id())
        or (select private.is_administrator())
        or private.has_course_role(
          completion_overrides.course_run_id,
          array['course_teacher', 'course_lead']::public.portal_role[]
        )
      )
  )
);

create policy course_session_selections_self_or_staff_select
on public.course_session_selections
for select
to authenticated
using (
  exists (
    select 1
    from public.enrollments as enrollment
    where enrollment.id = course_session_selections.enrollment_id
      and (
        enrollment.profile_id = (select private.current_profile_id())
        or (select private.is_administrator())
        or private.has_course_role(
          course_session_selections.course_run_id,
          array['course_teacher', 'course_lead']::public.portal_role[]
        )
      )
  )
);

create policy certificates_self_or_staff_select
on public.certificates
for select
to authenticated
using (
  exists (
    select 1
    from public.enrollments as enrollment
    where enrollment.id = certificates.enrollment_id
      and (
        enrollment.profile_id = (select private.current_profile_id())
        or (select private.is_administrator())
        or private.has_course_role(
          certificates.course_run_id,
          array['course_teacher', 'course_lead']::public.portal_role[]
        )
      )
  )
);

create policy completion_admin_tasks_admin_select
on public.completion_admin_tasks
for select
to authenticated
using ((select private.is_administrator()));

create policy certificate_files_storage_select
on storage.objects
for select
to authenticated
using (
  bucket_id = 'certificates'
  and exists (
    select 1
    from public.certificates as certificate
    join public.enrollments as enrollment
      on enrollment.id = certificate.enrollment_id
    where certificate.storage_path = storage.objects.name
      and (
        enrollment.profile_id = (select private.current_profile_id())
        or (select private.is_administrator())
        or private.has_course_role(
          certificate.course_run_id,
          array['course_teacher', 'course_lead']::public.portal_role[]
        )
      )
  )
);
