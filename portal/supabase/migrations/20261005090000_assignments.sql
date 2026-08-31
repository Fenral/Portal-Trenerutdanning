create type public.assignment_submission_status as enum (
  'draft',
  'submitted',
  'revision_required',
  'approved',
  'graded'
);

create type public.assignment_assessment_scale as enum (
  'pass_fail',
  'letter'
);

create type public.assignment_review_action as enum (
  'request_revision',
  'approve',
  'grade',
  'reopen'
);

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'learning-resources',
  'learning-resources',
  false,
  524288000,
  array[
    'application/pdf',
    'application/msword',
    'application/vnd.ms-excel',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ]::text[]
)
on conflict (id) do update set
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create table public.assignment_definitions (
  activity_id uuid primary key references public.activities(id) on delete restrict,
  assessment_scale public.assignment_assessment_scale not null default 'pass_fail',
  default_deadline timestamptz not null,
  instructions text not null
    constraint assignment_definitions_instructions_length
    check (char_length(btrim(instructions)) between 2 and 4000),
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now()
);

create table public.assignment_submissions (
  id uuid primary key default gen_random_uuid(),
  enrollment_id uuid not null,
  course_run_id uuid not null,
  learning_path_id uuid not null,
  activity_id uuid not null,
  status public.assignment_submission_status not null default 'draft',
  current_version_number integer not null default 0
    constraint assignment_submissions_version_nonnegative
    check (current_version_number >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint assignment_submissions_enrollment_course_fk
    foreign key (enrollment_id, course_run_id)
    references public.enrollments (id, course_run_id)
    on delete restrict,
  constraint assignment_submissions_path_course_fk
    foreign key (learning_path_id, course_run_id)
    references public.learning_paths (id, course_run_id)
    on delete restrict,
  constraint assignment_submissions_activity_path_fk
    foreign key (activity_id, learning_path_id)
    references public.activities (id, learning_path_id)
    on delete restrict,
  constraint assignment_submissions_enrollment_activity_unique
    unique (enrollment_id, activity_id),
  constraint assignment_submissions_id_activity_unique unique (id, activity_id)
);

create index assignment_submissions_course_status_idx
  on public.assignment_submissions (course_run_id, status, updated_at desc);

create table public.assignment_submission_versions (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references public.assignment_submissions(id) on delete restrict,
  version_number integer not null
    constraint assignment_submission_versions_number_positive
    check (version_number > 0),
  note text not null default ''
    constraint assignment_submission_versions_note_length
    check (char_length(note) <= 2000),
  submitted_by uuid not null references public.profiles(id) on delete restrict,
  submitted_at timestamptz not null default now(),
  constraint assignment_submission_versions_submission_number_unique
    unique (submission_id, version_number),
  constraint assignment_submission_versions_id_submission_unique
    unique (id, submission_id)
);

create table public.assignment_attachments (
  submission_version_id uuid not null references public.assignment_submission_versions(id) on delete restrict,
  media_asset_id uuid not null references public.media_assets(id) on delete restrict,
  primary key (submission_version_id, media_asset_id),
  constraint assignment_attachments_media_asset_unique unique (media_asset_id)
);

create table public.assignment_deadline_overrides (
  id uuid primary key default gen_random_uuid(),
  enrollment_id uuid not null,
  course_run_id uuid not null,
  learning_path_id uuid not null,
  activity_id uuid not null,
  deadline timestamptz not null,
  reason text not null
    constraint assignment_deadline_overrides_reason_length
    check (char_length(btrim(reason)) between 3 and 1000),
  granted_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  constraint assignment_deadline_overrides_enrollment_course_fk
    foreign key (enrollment_id, course_run_id)
    references public.enrollments (id, course_run_id)
    on delete restrict,
  constraint assignment_deadline_overrides_path_course_fk
    foreign key (learning_path_id, course_run_id)
    references public.learning_paths (id, course_run_id)
    on delete restrict,
  constraint assignment_deadline_overrides_activity_path_fk
    foreign key (activity_id, learning_path_id)
    references public.activities (id, learning_path_id)
    on delete restrict
);

create index assignment_deadline_overrides_effective_idx
  on public.assignment_deadline_overrides (
    enrollment_id,
    activity_id,
    created_at desc
  );

create table public.assignment_reviews (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references public.assignment_submissions(id) on delete restrict,
  submission_version_id uuid not null,
  action public.assignment_review_action not null,
  scale public.assignment_assessment_scale,
  result_value text,
  comment text not null
    constraint assignment_reviews_comment_length
    check (char_length(btrim(comment)) between 2 and 4000),
  deadline_override_id uuid references public.assignment_deadline_overrides(id) on delete restrict,
  reviewed_by uuid not null references public.profiles(id) on delete restrict,
  reviewed_at timestamptz not null default now(),
  constraint assignment_reviews_version_submission_fk
    foreign key (submission_version_id, submission_id)
    references public.assignment_submission_versions (id, submission_id)
    on delete restrict,
  constraint assignment_reviews_result_consistent check (
    (
      action = 'request_revision'
      and scale is null
      and result_value is null
    )
    or (
      action = 'approve'
      and scale = 'pass_fail'
      and result_value = 'approved'
    )
    or (
      action = 'grade'
      and scale = 'letter'
      and result_value in ('A', 'B', 'C', 'D', 'E', 'F')
    )
    or (
      action = 'reopen'
      and scale is null
      and result_value is null
    )
  )
);

create index assignment_reviews_submission_idx
  on public.assignment_reviews (submission_id, reviewed_at desc);

create table public.activity_completion_states (
  completion_id uuid primary key references public.activity_completions(id) on delete restrict,
  is_active boolean not null default true,
  updated_by uuid not null references public.profiles(id) on delete restrict,
  reason text,
  updated_at timestamptz not null default now(),
  constraint activity_completion_states_reason_when_inactive check (
    is_active or char_length(btrim(reason)) >= 3
  )
);

insert into public.activity_completion_states (
  completion_id,
  is_active,
  updated_by,
  updated_at
)
select
  completion.id,
  true,
  completion.completed_by,
  completion.completed_at
from public.activity_completions as completion;

create function private.initialize_activity_completion_state()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.activity_completion_states (
    completion_id,
    is_active,
    updated_by,
    updated_at
  )
  values (
    new.id,
    true,
    new.completed_by,
    new.completed_at
  )
  on conflict (completion_id) do update set
    is_active = true,
    updated_by = excluded.updated_by,
    reason = null,
    updated_at = excluded.updated_at;

  return new;
end;
$$;

create trigger activity_completions_create_state
after insert on public.activity_completions
for each row execute function private.initialize_activity_completion_state();

create or replace function private.refresh_enrollment_progress(
  target_enrollment_id uuid,
  target_learning_path_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_course_run_id uuid;
  calculated_completed_weight integer;
  calculated_total_weight integer;
  calculated_completed_count integer;
  calculated_total_count integer;
  calculated_percentage smallint;
begin
  select enrollment.course_run_id
  into target_course_run_id
  from public.enrollments as enrollment
  join public.learning_paths as path
    on path.id = target_learning_path_id
    and path.course_run_id = enrollment.course_run_id
  where enrollment.id = target_enrollment_id;

  if target_course_run_id is null then
    raise exception using
      errcode = '23503',
      message = 'ENROLLMENT_LEARNING_PATH_MISMATCH';
  end if;

  select
    coalesce(sum(activity.weight), 0)::integer,
    count(*)::integer
  into calculated_total_weight, calculated_total_count
  from public.activities as activity
  where activity.learning_path_id = target_learning_path_id
    and activity.required;

  select
    coalesce(sum(activity.weight), 0)::integer,
    count(*)::integer
  into calculated_completed_weight, calculated_completed_count
  from public.activities as activity
  join public.activity_completions as completion
    on completion.activity_id = activity.id
    and completion.enrollment_id = target_enrollment_id
  join public.activity_completion_states as completion_state
    on completion_state.completion_id = completion.id
    and completion_state.is_active
  where activity.learning_path_id = target_learning_path_id
    and activity.required;

  calculated_percentage := case
    when calculated_total_weight = 0 then 0
    else round(
      calculated_completed_weight::numeric * 100 / calculated_total_weight
    )::smallint
  end;

  insert into public.enrollment_progress (
    enrollment_id,
    course_run_id,
    learning_path_id,
    completed_weight,
    total_weight,
    completed_required_count,
    total_required_count,
    percentage,
    updated_at
  )
  values (
    target_enrollment_id,
    target_course_run_id,
    target_learning_path_id,
    calculated_completed_weight,
    calculated_total_weight,
    calculated_completed_count,
    calculated_total_count,
    calculated_percentage,
    now()
  )
  on conflict (enrollment_id, learning_path_id)
  do update set
    completed_weight = excluded.completed_weight,
    total_weight = excluded.total_weight,
    completed_required_count = excluded.completed_required_count,
    total_required_count = excluded.total_required_count,
    percentage = excluded.percentage,
    updated_at = excluded.updated_at;
end;
$$;

create function private.validate_assignment_definition()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if not exists (
    select 1
    from public.activities as activity
    where activity.id = new.activity_id
      and activity.activity_type = 'assignment'
      and activity.completion_mode = 'submission_approved'
  ) then
    raise exception using
      errcode = '22023',
      message = 'ASSIGNMENT_ACTIVITY_INVALID';
  end if;

  return new;
end;
$$;

create trigger assignment_definitions_validate
before insert on public.assignment_definitions
for each row execute function private.validate_assignment_definition();

create function private.require_clean_assignment_attachment()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if not exists (
    select 1
    from public.media_assets as asset
    where asset.id = new.media_asset_id
      and asset.scan_status = 'clean'
  ) then
    raise exception using
      errcode = '55000',
      message = 'ASSIGNMENT_ATTACHMENT_NOT_CLEAN';
  end if;

  return new;
end;
$$;

create trigger assignment_attachments_require_clean_asset
before insert on public.assignment_attachments
for each row execute function private.require_clean_assignment_attachment();

create function private.reject_assignment_history_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception using
    errcode = '55000',
    message = 'ASSIGNMENT_HISTORY_IS_IMMUTABLE';
end;
$$;

create trigger assignment_submission_versions_reject_mutation
before update or delete on public.assignment_submission_versions
for each row execute function private.reject_assignment_history_mutation();

create trigger assignment_attachments_reject_mutation
before update or delete on public.assignment_attachments
for each row execute function private.reject_assignment_history_mutation();

create trigger assignment_deadline_overrides_reject_mutation
before update or delete on public.assignment_deadline_overrides
for each row execute function private.reject_assignment_history_mutation();

create trigger assignment_reviews_reject_mutation
before update or delete on public.assignment_reviews
for each row execute function private.reject_assignment_history_mutation();

create function private.effective_assignment_deadline(
  target_enrollment_id uuid,
  target_activity_id uuid
)
returns timestamptz
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (
      select deadline_override.deadline
      from public.assignment_deadline_overrides as deadline_override
      where deadline_override.enrollment_id = target_enrollment_id
        and deadline_override.activity_id = target_activity_id
      order by deadline_override.created_at desc, deadline_override.id desc
      limit 1
    ),
    (
      select definition.default_deadline
      from public.assignment_definitions as definition
      where definition.activity_id = target_activity_id
    )
  )
$$;

create function private.activity_completion_is_active(
  target_completion_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (
      select completion_state.is_active
      from public.activity_completion_states as completion_state
      where completion_state.completion_id = target_completion_id
    ),
    false
  )
$$;

create function public.get_assignment_for_student(target_activity_id uuid)
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
  definition_record public.assignment_definitions%rowtype;
  submission_record public.assignment_submissions%rowtype;
  effective_deadline timestamptz;
begin
  actor_profile_id := private.current_profile_id();

  select activity.*
  into activity_record
  from public.activities as activity
  join public.learning_paths as path
    on path.id = activity.learning_path_id
    and path.status = 'published'
  where activity.id = target_activity_id
    and activity.activity_type = 'assignment'
    and activity.completion_mode = 'submission_approved';

  select enrollment.*
  into enrollment_record
  from public.enrollments as enrollment
  join public.learning_paths as path
    on path.course_run_id = enrollment.course_run_id
    and path.id = activity_record.learning_path_id
  where enrollment.profile_id = actor_profile_id
    and enrollment.status = 'active'
  limit 1;

  select definition.*
  into definition_record
  from public.assignment_definitions as definition
  where definition.activity_id = target_activity_id;

  if actor_profile_id is null
    or activity_record.id is null
    or enrollment_record.id is null
    or definition_record.activity_id is null
  then
    raise exception using
      errcode = '42501',
      message = 'ASSIGNMENT_ACCESS_FORBIDDEN';
  end if;

  if exists (
    select 1
    from public.activity_prerequisites as prerequisite
    where prerequisite.activity_id = target_activity_id
      and not exists (
        select 1
        from public.activity_completions as completion
        join public.activity_completion_states as completion_state
          on completion_state.completion_id = completion.id
          and completion_state.is_active
        where completion.enrollment_id = enrollment_record.id
          and completion.activity_id = prerequisite.prerequisite_activity_id
      )
  ) then
    raise exception using
      errcode = '55000',
      message = 'ACTIVITY_PREREQUISITES_MISSING';
  end if;

  select submission.*
  into submission_record
  from public.assignment_submissions as submission
  where submission.enrollment_id = enrollment_record.id
    and submission.activity_id = target_activity_id;

  effective_deadline := private.effective_assignment_deadline(
    enrollment_record.id,
    target_activity_id
  );

  return jsonb_build_object(
    'activityId', activity_record.id,
    'courseRunId', enrollment_record.course_run_id,
    'enrollmentId', enrollment_record.id,
    'title', activity_record.title,
    'instructions', definition_record.instructions,
    'assessmentScale', definition_record.assessment_scale,
    'effectiveDeadline', effective_deadline,
    'status', submission_record.status,
    'submissionId', submission_record.id,
    'versions', coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'id', version.id,
            'versionNumber', version.version_number,
            'note', version.note,
            'submittedAt', version.submitted_at,
            'attachments', coalesce(
              (
                select jsonb_agg(
                  jsonb_build_object(
                    'id', asset.id,
                    'filename', asset.original_filename,
                    'mimeType', asset.mime_type,
                    'byteSize', asset.byte_size
                  )
                  order by asset.original_filename
                )
                from public.assignment_attachments as attachment
                join public.media_assets as asset
                  on asset.id = attachment.media_asset_id
                where attachment.submission_version_id = version.id
                  and asset.scan_status = 'clean'
              ),
              '[]'::jsonb
            )
          )
          order by version.version_number
        )
        from public.assignment_submission_versions as version
        where version.submission_id = submission_record.id
      ),
      '[]'::jsonb
    ),
    'reviews', coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'id', review.id,
            'action', review.action,
            'scale', review.scale,
            'resultValue', review.result_value,
            'comment', review.comment,
            'reviewedAt', review.reviewed_at
          )
          order by review.reviewed_at desc
        )
        from public.assignment_reviews as review
        where review.submission_id = submission_record.id
      ),
      '[]'::jsonb
    )
  );
end;
$$;

create function public.submit_assignment_version(
  target_enrollment_id uuid,
  target_activity_id uuid,
  target_media_asset_id uuid,
  target_note text default ''
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_profile_id uuid;
  enrollment_record public.enrollments%rowtype;
  activity_record public.activities%rowtype;
  path_record public.learning_paths%rowtype;
  submission_record public.assignment_submissions%rowtype;
  next_version_number integer;
  version_id uuid;
  effective_deadline timestamptz;
begin
  actor_profile_id := private.current_profile_id();

  select enrollment.*
  into enrollment_record
  from public.enrollments as enrollment
  where enrollment.id = target_enrollment_id
  for update;

  if actor_profile_id is null
    or enrollment_record.id is null
    or enrollment_record.profile_id <> actor_profile_id
    or enrollment_record.status <> 'active'
  then
    raise exception using
      errcode = '42501',
      message = 'ASSIGNMENT_SUBMISSION_FORBIDDEN';
  end if;

  select activity.*
  into activity_record
  from public.activities as activity
  where activity.id = target_activity_id;

  select path.*
  into path_record
  from public.learning_paths as path
  where path.id = activity_record.learning_path_id;

  if activity_record.id is null
    or activity_record.activity_type <> 'assignment'
    or activity_record.completion_mode <> 'submission_approved'
    or path_record.status <> 'published'
    or path_record.course_run_id <> enrollment_record.course_run_id
    or not exists (
      select 1
      from public.assignment_definitions as definition
      where definition.activity_id = target_activity_id
    )
  then
    raise exception using
      errcode = '42501',
      message = 'ASSIGNMENT_SUBMISSION_FORBIDDEN';
  end if;

  if exists (
    select 1
    from public.activity_prerequisites as prerequisite
    where prerequisite.activity_id = target_activity_id
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
      message = 'ACTIVITY_PREREQUISITES_MISSING';
  end if;

  effective_deadline := private.effective_assignment_deadline(
    target_enrollment_id,
    target_activity_id
  );

  if effective_deadline is null or clock_timestamp() > effective_deadline then
    raise exception using
      errcode = '55000',
      message = 'assignment_deadline_passed';
  end if;

  if not exists (
    select 1
    from public.media_assets as asset
    where asset.id = target_media_asset_id
      and asset.uploaded_by = actor_profile_id
      and asset.scan_status = 'clean'
  ) then
    raise exception using
      errcode = '55000',
      message = 'ASSIGNMENT_ATTACHMENT_NOT_CLEAN';
  end if;

  select submission.*
  into submission_record
  from public.assignment_submissions as submission
  where submission.enrollment_id = target_enrollment_id
    and submission.activity_id = target_activity_id
  for update;

  if submission_record.id is null then
    insert into public.assignment_submissions (
      enrollment_id,
      course_run_id,
      learning_path_id,
      activity_id,
      status
    )
    values (
      target_enrollment_id,
      enrollment_record.course_run_id,
      activity_record.learning_path_id,
      target_activity_id,
      'draft'
    )
    returning * into submission_record;
  end if;

  if submission_record.status not in ('draft', 'revision_required') then
    raise exception using
      errcode = '55000',
      message = 'ASSIGNMENT_SUBMISSION_STATE_INVALID';
  end if;

  next_version_number := submission_record.current_version_number + 1;

  insert into public.assignment_submission_versions (
    submission_id,
    version_number,
    note,
    submitted_by
  )
  values (
    submission_record.id,
    next_version_number,
    coalesce(target_note, ''),
    actor_profile_id
  )
  returning id into version_id;

  insert into public.assignment_attachments (
    submission_version_id,
    media_asset_id
  )
  values (version_id, target_media_asset_id);

  update public.assignment_submissions
  set
    status = 'submitted',
    current_version_number = next_version_number,
    updated_at = now()
  where id = submission_record.id;

  insert into public.audit_events (
    actor_profile_id,
    action,
    entity_type,
    entity_id,
    after_data
  )
  values (
    actor_profile_id,
    'assignment.submitted',
    'assignment_submission',
    submission_record.id::text,
    jsonb_build_object(
      'activityId', target_activity_id,
      'versionId', version_id,
      'versionNumber', next_version_number
    )
  );

  return jsonb_build_object(
    'submissionId', submission_record.id,
    'versionId', version_id,
    'versionNumber', next_version_number,
    'status', 'submitted'
  );
end;
$$;

create function public.review_assignment_submission(
  target_submission_id uuid,
  target_action text,
  target_result_value text,
  target_comment text,
  target_new_deadline timestamptz default null,
  target_deadline_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_profile_id uuid;
  submission_record public.assignment_submissions%rowtype;
  definition_record public.assignment_definitions%rowtype;
  latest_version_id uuid;
  review_action public.assignment_review_action;
  review_scale public.assignment_assessment_scale;
  review_result text;
  next_status public.assignment_submission_status;
  deadline_override_id uuid;
  assignment_completion_id uuid;
begin
  actor_profile_id := private.current_profile_id();

  select submission.*
  into submission_record
  from public.assignment_submissions as submission
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
      message = 'ASSIGNMENT_REVIEW_FORBIDDEN';
  end if;

  if nullif(btrim(target_comment), '') is null then
    raise exception using
      errcode = '22023',
      message = 'ASSIGNMENT_REVIEW_COMMENT_REQUIRED';
  end if;

  select definition.*
  into definition_record
  from public.assignment_definitions as definition
  where definition.activity_id = submission_record.activity_id;

  select version.id
  into latest_version_id
  from public.assignment_submission_versions as version
  where version.submission_id = target_submission_id
  order by version.version_number desc
  limit 1;

  if target_action = 'request_revision'
    and submission_record.status = 'submitted'
  then
    review_action := 'request_revision';
    review_scale := null;
    review_result := null;
    next_status := 'revision_required';
  elsif target_action = 'approve'
    and submission_record.status = 'submitted'
    and definition_record.assessment_scale = 'pass_fail'
    and target_result_value = 'approved'
  then
    review_action := 'approve';
    review_scale := 'pass_fail';
    review_result := 'approved';
    next_status := 'approved';
  elsif target_action = 'grade'
    and submission_record.status = 'submitted'
    and definition_record.assessment_scale = 'letter'
    and target_result_value in ('A', 'B', 'C', 'D', 'E', 'F')
  then
    review_action := 'grade';
    review_scale := 'letter';
    review_result := target_result_value;
    next_status := 'graded';
  elsif target_action = 'reopen'
    and submission_record.status in ('approved', 'graded')
  then
    review_action := 'reopen';
    review_scale := null;
    review_result := null;
    next_status := 'revision_required';
  else
    raise exception using
      errcode = '55000',
      message = 'ASSIGNMENT_REVIEW_STATE_INVALID';
  end if;

  if target_new_deadline is not null then
    if target_new_deadline <= clock_timestamp()
      or nullif(btrim(target_deadline_reason), '') is null
    then
      raise exception using
        errcode = '22023',
        message = 'ASSIGNMENT_DEADLINE_OVERRIDE_INVALID';
    end if;

    insert into public.assignment_deadline_overrides (
      enrollment_id,
      course_run_id,
      learning_path_id,
      activity_id,
      deadline,
      reason,
      granted_by
    )
    values (
      submission_record.enrollment_id,
      submission_record.course_run_id,
      submission_record.learning_path_id,
      submission_record.activity_id,
      target_new_deadline,
      target_deadline_reason,
      actor_profile_id
    )
    returning id into deadline_override_id;

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
      'assignment.deadline_extended',
      'assignment_deadline_override',
      deadline_override_id::text,
      target_deadline_reason,
      jsonb_build_object(
        'submissionId', target_submission_id,
        'deadline', target_new_deadline
      )
    );
  end if;

  insert into public.assignment_reviews (
    submission_id,
    submission_version_id,
    action,
    scale,
    result_value,
    comment,
    deadline_override_id,
    reviewed_by
  )
  values (
    target_submission_id,
    latest_version_id,
    review_action,
    review_scale,
    review_result,
    target_comment,
    deadline_override_id,
    actor_profile_id
  );

  update public.assignment_submissions
  set status = next_status, updated_at = now()
  where id = target_submission_id;

  if review_action in ('approve', 'grade')
    and (review_action = 'approve' or review_result <> 'F')
  then
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
      'teacher',
      actor_profile_id
    )
    on conflict (enrollment_id, activity_id) do nothing
    returning id into assignment_completion_id;

    if assignment_completion_id is null then
      select completion.id
      into assignment_completion_id
      from public.activity_completions as completion
      where completion.enrollment_id = submission_record.enrollment_id
        and completion.activity_id = submission_record.activity_id;

      update public.activity_completion_states
      set
        is_active = true,
        updated_by = actor_profile_id,
        reason = null,
        updated_at = now()
      where activity_completion_states.completion_id = assignment_completion_id;

      perform private.refresh_enrollment_progress(
        submission_record.enrollment_id,
        submission_record.learning_path_id
      );
    end if;
  elsif review_action = 'reopen' then
    select completion.id
    into assignment_completion_id
    from public.activity_completions as completion
    where completion.enrollment_id = submission_record.enrollment_id
      and completion.activity_id = submission_record.activity_id;

    if assignment_completion_id is not null then
      update public.activity_completion_states
      set
        is_active = false,
        updated_by = actor_profile_id,
        reason = target_comment,
        updated_at = now()
      where activity_completion_states.completion_id = assignment_completion_id;

      perform private.refresh_enrollment_progress(
        submission_record.enrollment_id,
        submission_record.learning_path_id
      );
    end if;
  end if;

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
    'assignment.reviewed',
    'assignment_submission',
    target_submission_id::text,
    target_comment,
    jsonb_build_object(
      'action', review_action,
      'status', next_status,
      'resultValue', review_result,
      'deadlineOverrideId', deadline_override_id
    )
  );

  return jsonb_build_object(
    'submissionId', target_submission_id,
    'status', next_status,
    'resultValue', review_result,
    'deadlineOverrideId', deadline_override_id
  );
end;
$$;

revoke all on function private.initialize_activity_completion_state() from public, anon, authenticated;
revoke all on function private.validate_assignment_definition() from public, anon, authenticated;
revoke all on function private.require_clean_assignment_attachment() from public, anon, authenticated;
revoke all on function private.reject_assignment_history_mutation() from public, anon, authenticated;
revoke all on function private.effective_assignment_deadline(uuid, uuid) from public, anon, authenticated;
revoke all on function private.activity_completion_is_active(uuid) from public, anon, authenticated;
revoke all on function public.get_assignment_for_student(uuid) from public, anon;
revoke all on function public.submit_assignment_version(uuid, uuid, uuid, text) from public, anon;
revoke all on function public.review_assignment_submission(uuid, text, text, text, timestamptz, text) from public, anon;

grant execute on function private.activity_completion_is_active(uuid) to authenticated;
grant execute on function public.get_assignment_for_student(uuid) to authenticated;
grant execute on function public.submit_assignment_version(uuid, uuid, uuid, text) to authenticated;
grant execute on function public.review_assignment_submission(uuid, text, text, text, timestamptz, text) to authenticated;

alter table public.assignment_definitions enable row level security;
alter table public.assignment_submissions enable row level security;
alter table public.assignment_submission_versions enable row level security;
alter table public.assignment_attachments enable row level security;
alter table public.assignment_deadline_overrides enable row level security;
alter table public.assignment_reviews enable row level security;
alter table public.activity_completion_states enable row level security;

revoke all on table public.assignment_definitions from anon, authenticated;
revoke all on table public.assignment_submissions from anon, authenticated;
revoke all on table public.assignment_submission_versions from anon, authenticated;
revoke all on table public.assignment_attachments from anon, authenticated;
revoke all on table public.assignment_deadline_overrides from anon, authenticated;
revoke all on table public.assignment_reviews from anon, authenticated;
revoke all on table public.activity_completion_states from anon, authenticated;

grant select on table public.assignment_definitions to authenticated;
grant select on table public.assignment_submissions to authenticated;
grant select on table public.assignment_submission_versions to authenticated;
grant select on table public.assignment_attachments to authenticated;
grant select on table public.assignment_deadline_overrides to authenticated;
grant select on table public.assignment_reviews to authenticated;

create policy assignment_definitions_scoped_select
on public.assignment_definitions
for select
to authenticated
using (
  exists (
    select 1
    from public.activities as activity
    join public.learning_paths as path
      on path.id = activity.learning_path_id
    where activity.id = assignment_definitions.activity_id
      and (
        (select private.is_administrator())
        or (select private.has_global_role('editor'::public.portal_role))
        or private.is_enrolled(path.course_run_id)
        or private.has_course_role(
          path.course_run_id,
          array['course_teacher', 'course_lead']::public.portal_role[]
        )
      )
  )
);

create policy assignment_submissions_self_or_staff_select
on public.assignment_submissions
for select
to authenticated
using (
  (select private.is_administrator())
  or exists (
    select 1
    from public.enrollments as enrollment
    where enrollment.id = assignment_submissions.enrollment_id
      and (
        enrollment.profile_id = (select private.current_profile_id())
        or private.has_course_role(
          enrollment.course_run_id,
          array['course_teacher', 'course_lead']::public.portal_role[]
        )
      )
  )
);

create policy assignment_submission_versions_scoped_select
on public.assignment_submission_versions
for select
to authenticated
using (
  exists (
    select 1
    from public.assignment_submissions as submission
    where submission.id = assignment_submission_versions.submission_id
  )
);

create policy assignment_attachments_scoped_select
on public.assignment_attachments
for select
to authenticated
using (
  exists (
    select 1
    from public.assignment_submission_versions as version
    where version.id = assignment_attachments.submission_version_id
  )
);

create policy assignment_deadline_overrides_self_or_staff_select
on public.assignment_deadline_overrides
for select
to authenticated
using (
  (select private.is_administrator())
  or exists (
    select 1
    from public.enrollments as enrollment
    where enrollment.id = assignment_deadline_overrides.enrollment_id
      and (
        enrollment.profile_id = (select private.current_profile_id())
        or private.has_course_role(
          enrollment.course_run_id,
          array['course_teacher', 'course_lead']::public.portal_role[]
        )
      )
  )
);

create policy assignment_reviews_scoped_select
on public.assignment_reviews
for select
to authenticated
using (
  exists (
    select 1
    from public.assignment_submissions as submission
    where submission.id = assignment_reviews.submission_id
  )
);

create policy activity_completions_active_or_staff_select
on public.activity_completions
as restrictive
for select
to authenticated
using (
  private.activity_completion_is_active(id)
  or (select private.is_administrator())
  or private.has_course_role(
    course_run_id,
    array['course_teacher', 'course_lead']::public.portal_role[]
  )
);

create policy media_assets_assignment_scoped_select
on public.media_assets
for select
to authenticated
using (
  scan_status = 'clean'
  and exists (
    select 1
    from public.assignment_attachments as attachment
    join public.assignment_submission_versions as version
      on version.id = attachment.submission_version_id
    join public.assignment_submissions as submission
      on submission.id = version.submission_id
    join public.enrollments as enrollment
      on enrollment.id = submission.enrollment_id
    where attachment.media_asset_id = media_assets.id
      and (
        enrollment.profile_id = (select private.current_profile_id())
        or (select private.is_administrator())
        or private.has_course_role(
          submission.course_run_id,
          array['course_teacher', 'course_lead']::public.portal_role[]
        )
      )
  )
);

create policy assignment_attachments_storage_select
on storage.objects
for select
to authenticated
using (
  bucket_id = 'learning-resources'
  and exists (
    select 1
    from public.media_assets as asset
    join public.assignment_attachments as attachment
      on attachment.media_asset_id = asset.id
    join public.assignment_submission_versions as version
      on version.id = attachment.submission_version_id
    join public.assignment_submissions as submission
      on submission.id = version.submission_id
    join public.enrollments as enrollment
      on enrollment.id = submission.enrollment_id
    where asset.storage_path = storage.objects.name
      and asset.scan_status = 'clean'
      and (
        enrollment.profile_id = (select private.current_profile_id())
        or (select private.is_administrator())
        or private.has_course_role(
          submission.course_run_id,
          array['course_teacher', 'course_lead']::public.portal_role[]
        )
      )
  )
);
