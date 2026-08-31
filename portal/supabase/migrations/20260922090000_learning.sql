create type public.learning_path_status as enum (
  'draft',
  'published',
  'archived'
);

create type public.learning_activity_type as enum (
  'lesson',
  'quiz',
  'knowledge_test',
  'assignment',
  'practice',
  'attendance'
);

create type public.activity_completion_mode as enum (
  'manual',
  'reach_end',
  'quiz_pass',
  'submission_approved',
  'practice_approved',
  'attendance_met'
);

create type public.activity_completion_source as enum (
  'student',
  'assessment',
  'teacher',
  'system'
);

alter table public.enrollments
add constraint enrollments_id_course_run_unique unique (id, course_run_id);

create table public.learning_paths (
  id uuid primary key default gen_random_uuid(),
  course_run_id uuid not null references public.course_runs(id) on delete cascade,
  title text not null
    constraint learning_paths_title_length
    check (char_length(btrim(title)) between 2 and 180),
  status public.learning_path_status not null default 'draft',
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  published_by uuid references public.profiles(id) on delete restrict,
  published_at timestamptz,
  constraint learning_paths_id_course_run_unique unique (id, course_run_id),
  constraint learning_paths_publication_consistent check (
    (
      status = 'draft'
      and published_by is null
      and published_at is null
    )
    or (
      status in ('published', 'archived')
      and published_by is not null
      and published_at is not null
    )
  )
);

create unique index one_published_learning_path_per_course_run
  on public.learning_paths (course_run_id)
  where status = 'published';

create index learning_paths_course_run_id_idx
  on public.learning_paths (course_run_id);

create table public.modules (
  id uuid primary key default gen_random_uuid(),
  learning_path_id uuid not null references public.learning_paths(id) on delete cascade,
  title text not null
    constraint modules_title_length
    check (char_length(btrim(title)) between 2 and 180),
  description text
    constraint modules_description_length
    check (description is null or char_length(btrim(description)) between 1 and 2000),
  sort_order smallint not null
    constraint modules_sort_order_positive
    check (sort_order > 0),
  constraint modules_path_sort_unique unique (learning_path_id, sort_order),
  constraint modules_id_path_unique unique (id, learning_path_id)
);

create index modules_learning_path_id_idx
  on public.modules (learning_path_id);

create table public.activities (
  id uuid primary key default gen_random_uuid(),
  learning_path_id uuid not null references public.learning_paths(id) on delete cascade,
  module_id uuid not null,
  title text not null
    constraint activities_title_length
    check (char_length(btrim(title)) between 2 and 180),
  description text
    constraint activities_description_length
    check (description is null or char_length(btrim(description)) between 1 and 2000),
  activity_type public.learning_activity_type not null,
  completion_mode public.activity_completion_mode not null,
  content_item_id uuid references public.content_items(id) on delete restrict,
  required boolean not null default true,
  weight integer not null default 1
    constraint activities_weight_positive
    check (weight > 0),
  sort_order smallint not null
    constraint activities_sort_order_positive
    check (sort_order > 0),
  constraint activities_module_path_fk
    foreign key (module_id, learning_path_id)
    references public.modules (id, learning_path_id)
    on delete cascade,
  constraint activities_module_sort_unique unique (module_id, sort_order),
  constraint activities_id_path_unique unique (id, learning_path_id),
  constraint activities_content_mode_consistent check (
    (
      activity_type = 'lesson'
      and content_item_id is not null
      and completion_mode in ('manual', 'reach_end')
    )
    or (
      activity_type = 'quiz'
      and completion_mode = 'quiz_pass'
    )
    or (
      activity_type = 'knowledge_test'
      and completion_mode = 'quiz_pass'
    )
    or (
      activity_type = 'assignment'
      and completion_mode = 'submission_approved'
    )
    or (
      activity_type = 'practice'
      and completion_mode = 'practice_approved'
    )
    or (
      activity_type = 'attendance'
      and completion_mode = 'attendance_met'
    )
  )
);

create index activities_learning_path_id_idx
  on public.activities (learning_path_id);

create index activities_content_item_id_idx
  on public.activities (content_item_id)
  where content_item_id is not null;

create table public.activity_prerequisites (
  learning_path_id uuid not null references public.learning_paths(id) on delete cascade,
  activity_id uuid not null,
  prerequisite_activity_id uuid not null,
  primary key (activity_id, prerequisite_activity_id),
  constraint activity_prerequisites_activity_path_fk
    foreign key (activity_id, learning_path_id)
    references public.activities (id, learning_path_id)
    on delete cascade,
  constraint activity_prerequisites_prerequisite_path_fk
    foreign key (prerequisite_activity_id, learning_path_id)
    references public.activities (id, learning_path_id)
    on delete cascade,
  constraint activity_prerequisites_not_self
    check (activity_id <> prerequisite_activity_id)
);

create index activity_prerequisites_path_idx
  on public.activity_prerequisites (learning_path_id);

create index activity_prerequisites_required_idx
  on public.activity_prerequisites (prerequisite_activity_id);

create table public.activity_completions (
  id uuid primary key default gen_random_uuid(),
  enrollment_id uuid not null,
  course_run_id uuid not null,
  learning_path_id uuid not null,
  activity_id uuid not null,
  content_item_id uuid,
  content_revision_id uuid,
  source public.activity_completion_source not null,
  completed_by uuid not null references public.profiles(id) on delete restrict,
  completed_at timestamptz not null default now(),
  constraint activity_completions_enrollment_course_fk
    foreign key (enrollment_id, course_run_id)
    references public.enrollments (id, course_run_id)
    on delete restrict,
  constraint activity_completions_path_course_fk
    foreign key (learning_path_id, course_run_id)
    references public.learning_paths (id, course_run_id)
    on delete restrict,
  constraint activity_completions_activity_path_fk
    foreign key (activity_id, learning_path_id)
    references public.activities (id, learning_path_id)
    on delete restrict,
  constraint activity_completions_revision_item_fk
    foreign key (content_revision_id, content_item_id)
    references public.content_revisions (id, content_item_id)
    on delete restrict,
  constraint activity_completions_content_consistent check (
    num_nonnulls(content_item_id, content_revision_id) in (0, 2)
  ),
  constraint activity_completions_enrollment_activity_unique
    unique (enrollment_id, activity_id)
);

create index activity_completions_learning_path_idx
  on public.activity_completions (learning_path_id, enrollment_id);

create index activity_completions_revision_idx
  on public.activity_completions (content_revision_id)
  where content_revision_id is not null;

create table public.enrollment_progress (
  enrollment_id uuid not null,
  course_run_id uuid not null,
  learning_path_id uuid not null,
  completed_weight integer not null default 0
    constraint enrollment_progress_completed_weight_nonnegative
    check (completed_weight >= 0),
  total_weight integer not null default 0
    constraint enrollment_progress_total_weight_nonnegative
    check (total_weight >= 0),
  completed_required_count integer not null default 0
    constraint enrollment_progress_completed_count_nonnegative
    check (completed_required_count >= 0),
  total_required_count integer not null default 0
    constraint enrollment_progress_total_count_nonnegative
    check (total_required_count >= 0),
  percentage smallint not null default 0
    constraint enrollment_progress_percentage_range
    check (percentage between 0 and 100),
  updated_at timestamptz not null default now(),
  primary key (enrollment_id, learning_path_id),
  constraint enrollment_progress_enrollment_course_fk
    foreign key (enrollment_id, course_run_id)
    references public.enrollments (id, course_run_id)
    on delete cascade,
  constraint enrollment_progress_path_course_fk
    foreign key (learning_path_id, course_run_id)
    references public.learning_paths (id, course_run_id)
    on delete cascade,
  constraint enrollment_progress_weights_ordered
    check (completed_weight <= total_weight),
  constraint enrollment_progress_counts_ordered
    check (completed_required_count <= total_required_count)
);

create index enrollment_progress_course_run_idx
  on public.enrollment_progress (course_run_id, percentage);

create function private.learning_path_has_cycle(target_learning_path_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  with recursive edges as (
    select
      prerequisite.activity_id,
      prerequisite.prerequisite_activity_id
    from public.activity_prerequisites as prerequisite
    where prerequisite.learning_path_id = target_learning_path_id
  ),
  walk (current_activity_id, visited, has_cycle) as (
    select
      edge.prerequisite_activity_id,
      array[edge.activity_id, edge.prerequisite_activity_id]::uuid[],
      edge.activity_id = edge.prerequisite_activity_id
    from edges as edge

    union all

    select
      edge.prerequisite_activity_id,
      walk.visited || edge.prerequisite_activity_id,
      edge.prerequisite_activity_id = any(walk.visited)
    from walk
    join edges as edge
      on edge.activity_id = walk.current_activity_id
    where not walk.has_cycle
  )
  select exists (
    select 1
    from walk
    where walk.has_cycle
  )
$$;

create function private.require_draft_learning_structure()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  old_path_id uuid;
  new_path_id uuid;
begin
  if tg_op <> 'INSERT' then
    old_path_id := old.learning_path_id;
  end if;

  if tg_op <> 'DELETE' then
    new_path_id := new.learning_path_id;
  end if;

  if old_path_id is not null and exists (
    select 1
    from public.learning_paths as path
    where path.id = old_path_id
      and path.status <> 'draft'
  ) then
    raise exception using
      errcode = '55000',
      message = 'PUBLISHED_LEARNING_PATH_IS_IMMUTABLE';
  end if;

  if new_path_id is not null and exists (
    select 1
    from public.learning_paths as path
    where path.id = new_path_id
      and path.status <> 'draft'
  ) then
    raise exception using
      errcode = '55000',
      message = 'PUBLISHED_LEARNING_PATH_IS_IMMUTABLE';
  end if;

  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

create trigger modules_require_draft_path
before insert or update or delete on public.modules
for each row execute function private.require_draft_learning_structure();

create trigger activities_require_draft_path
before insert or update or delete on public.activities
for each row execute function private.require_draft_learning_structure();

create trigger activity_prerequisites_require_draft_path
before insert or update or delete on public.activity_prerequisites
for each row execute function private.require_draft_learning_structure();

create function private.protect_activity_completion()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception using
    errcode = '55000',
    message = 'ACTIVITY_COMPLETION_IS_IMMUTABLE';
end;
$$;

create trigger activity_completions_reject_mutation
before update or delete on public.activity_completions
for each row execute function private.protect_activity_completion();

create function private.refresh_enrollment_progress(
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

create function private.refresh_progress_after_completion()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.refresh_enrollment_progress(
    new.enrollment_id,
    new.learning_path_id
  );
  return new;
end;
$$;

create trigger activity_completions_refresh_progress
after insert on public.activity_completions
for each row execute function private.refresh_progress_after_completion();

create function private.initialize_enrollment_progress()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  path_record record;
begin
  if new.status in ('active', 'completed') then
    for path_record in
      select path.id
      from public.learning_paths as path
      where path.course_run_id = new.course_run_id
        and path.status = 'published'
    loop
      perform private.refresh_enrollment_progress(new.id, path_record.id);
    end loop;
  end if;

  return new;
end;
$$;

create trigger enrollments_initialize_progress
after insert or update of status on public.enrollments
for each row execute function private.initialize_enrollment_progress();

create function public.publish_learning_path(
  target_learning_path_id uuid,
  actor_profile_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  path_record public.learning_paths%rowtype;
  enrollment_record record;
begin
  if actor_profile_id is distinct from private.current_profile_id()
    or not (
      private.is_administrator()
      or private.has_global_role('editor'::public.portal_role)
    )
  then
    raise exception using
      errcode = '42501',
      message = 'LEARNING_PATH_PUBLISH_FORBIDDEN';
  end if;

  select path.*
  into path_record
  from public.learning_paths as path
  where path.id = target_learning_path_id
  for update;

  if path_record.id is null then
    raise exception using
      errcode = 'P0002',
      message = 'LEARNING_PATH_NOT_FOUND';
  end if;

  if path_record.status <> 'draft' then
    raise exception using
      errcode = '55000',
      message = 'LEARNING_PATH_DRAFT_REQUIRED';
  end if;

  if not exists (
    select 1
    from public.activities as activity
    where activity.learning_path_id = target_learning_path_id
      and activity.required
  ) then
    raise exception using
      errcode = '22023',
      message = 'LEARNING_PATH_REQUIRED_ACTIVITY_MISSING';
  end if;

  if exists (
    select 1
    from public.activities as activity
    where activity.learning_path_id = target_learning_path_id
      and activity.content_item_id is not null
      and not exists (
        select 1
        from public.course_content_bindings as binding
        where binding.course_run_id = path_record.course_run_id
          and binding.content_item_id = activity.content_item_id
      )
  ) then
    raise exception using
      errcode = '22023',
      message = 'LEARNING_PATH_CONTENT_NOT_BOUND';
  end if;

  if private.learning_path_has_cycle(target_learning_path_id) then
    raise exception using
      errcode = '22023',
      message = 'LEARNING_PATH_CIRCULAR_PREREQUISITE';
  end if;

  update public.learning_paths
  set
    status = 'published',
    published_by = actor_profile_id,
    published_at = now()
  where id = target_learning_path_id;

  for enrollment_record in
    select enrollment.id
    from public.enrollments as enrollment
    where enrollment.course_run_id = path_record.course_run_id
      and enrollment.status in ('active', 'completed')
  loop
    perform private.refresh_enrollment_progress(
      enrollment_record.id,
      target_learning_path_id
    );
  end loop;

  insert into public.audit_events (
    actor_profile_id,
    action,
    entity_type,
    entity_id,
    after_data
  )
  values (
    actor_profile_id,
    'learning_path.published',
    'learning_path',
    target_learning_path_id::text,
    jsonb_build_object('courseRunId', path_record.course_run_id)
  );

  return target_learning_path_id;
end;
$$;

create function public.record_activity_completion(
  target_enrollment_id uuid,
  target_activity_id uuid,
  target_content_revision_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_profile_id uuid;
  enrollment_record public.enrollments%rowtype;
  activity_record public.activities%rowtype;
  path_record public.learning_paths%rowtype;
  bound_revision_id uuid;
  completion_id uuid;
begin
  actor_profile_id := private.current_profile_id();

  select enrollment.*
  into enrollment_record
  from public.enrollments as enrollment
  where enrollment.id = target_enrollment_id
  for share;

  if actor_profile_id is null
    or enrollment_record.id is null
    or enrollment_record.profile_id <> actor_profile_id
    or enrollment_record.status <> 'active'
  then
    raise exception using
      errcode = '42501',
      message = 'ACTIVITY_COMPLETION_FORBIDDEN';
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
    or path_record.status <> 'published'
    or path_record.course_run_id <> enrollment_record.course_run_id
  then
    raise exception using
      errcode = '42501',
      message = 'ACTIVITY_COMPLETION_FORBIDDEN';
  end if;

  if activity_record.completion_mode not in ('manual', 'reach_end') then
    raise exception using
      errcode = '42501',
      message = 'ACTIVITY_REQUIRES_VERIFIED_COMPLETION';
  end if;

  select completion.id
  into completion_id
  from public.activity_completions as completion
  where completion.enrollment_id = target_enrollment_id
    and completion.activity_id = target_activity_id;

  if completion_id is not null then
    return completion_id;
  end if;

  if exists (
    select 1
    from public.activity_prerequisites as prerequisite
    where prerequisite.activity_id = target_activity_id
      and not exists (
        select 1
        from public.activity_completions as completion
        where completion.enrollment_id = target_enrollment_id
          and completion.activity_id = prerequisite.prerequisite_activity_id
      )
  ) then
    raise exception using
      errcode = '55000',
      message = 'ACTIVITY_PREREQUISITES_MISSING';
  end if;

  if activity_record.content_item_id is null then
    if target_content_revision_id is not null then
      raise exception using
        errcode = '22023',
        message = 'ACTIVITY_CONTENT_REVISION_UNEXPECTED';
    end if;
  else
    select binding.content_revision_id
    into bound_revision_id
    from public.course_content_bindings as binding
    where binding.course_run_id = enrollment_record.course_run_id
      and binding.content_item_id = activity_record.content_item_id;

    if bound_revision_id is null
      or bound_revision_id is distinct from target_content_revision_id
    then
      raise exception using
        errcode = '22023',
        message = 'ACTIVITY_BOUND_CONTENT_REVISION_REQUIRED';
    end if;
  end if;

  insert into public.activity_completions (
    enrollment_id,
    course_run_id,
    learning_path_id,
    activity_id,
    content_item_id,
    content_revision_id,
    source,
    completed_by
  )
  values (
    target_enrollment_id,
    enrollment_record.course_run_id,
    activity_record.learning_path_id,
    target_activity_id,
    activity_record.content_item_id,
    target_content_revision_id,
    'student',
    actor_profile_id
  )
  on conflict (enrollment_id, activity_id) do nothing
  returning id into completion_id;

  if completion_id is null then
    select completion.id
    into completion_id
    from public.activity_completions as completion
    where completion.enrollment_id = target_enrollment_id
      and completion.activity_id = target_activity_id;
  else
    insert into public.audit_events (
      actor_profile_id,
      action,
      entity_type,
      entity_id,
      after_data
    )
    values (
      actor_profile_id,
      'activity.completed',
      'activity_completion',
      completion_id::text,
      jsonb_build_object(
        'enrollmentId', target_enrollment_id,
        'activityId', target_activity_id,
        'contentRevisionId', target_content_revision_id
      )
    );
  end if;

  return completion_id;
end;
$$;

revoke all on function private.learning_path_has_cycle(uuid) from public, anon, authenticated;
revoke all on function private.require_draft_learning_structure() from public, anon, authenticated;
revoke all on function private.protect_activity_completion() from public, anon, authenticated;
revoke all on function private.refresh_enrollment_progress(uuid, uuid) from public, anon, authenticated;
revoke all on function private.refresh_progress_after_completion() from public, anon, authenticated;
revoke all on function private.initialize_enrollment_progress() from public, anon, authenticated;
revoke all on function public.publish_learning_path(uuid, uuid) from public, anon;
revoke all on function public.record_activity_completion(uuid, uuid, uuid) from public, anon;

grant execute on function public.publish_learning_path(uuid, uuid) to authenticated;
grant execute on function public.record_activity_completion(uuid, uuid, uuid) to authenticated;

alter table public.learning_paths enable row level security;
alter table public.modules enable row level security;
alter table public.activities enable row level security;
alter table public.activity_prerequisites enable row level security;
alter table public.activity_completions enable row level security;
alter table public.enrollment_progress enable row level security;

revoke all on table public.learning_paths from anon, authenticated;
revoke all on table public.modules from anon, authenticated;
revoke all on table public.activities from anon, authenticated;
revoke all on table public.activity_prerequisites from anon, authenticated;
revoke all on table public.activity_completions from anon, authenticated;
revoke all on table public.enrollment_progress from anon, authenticated;

grant select on table public.learning_paths to authenticated;
grant select on table public.modules to authenticated;
grant select on table public.activities to authenticated;
grant select on table public.activity_prerequisites to authenticated;
grant select on table public.activity_completions to authenticated;
grant select on table public.enrollment_progress to authenticated;

create policy learning_paths_scoped_select
on public.learning_paths
for select
to authenticated
using (
  (select private.is_administrator())
  or (select private.has_global_role('editor'::public.portal_role))
  or (
    status = 'published'
    and private.is_enrolled(course_run_id)
  )
  or private.has_course_role(
    course_run_id,
    array['course_teacher', 'course_lead']::public.portal_role[]
  )
);

create policy modules_scoped_select
on public.modules
for select
to authenticated
using (
  exists (
    select 1
    from public.learning_paths as path
    where path.id = modules.learning_path_id
  )
);

create policy activities_scoped_select
on public.activities
for select
to authenticated
using (
  exists (
    select 1
    from public.learning_paths as path
    where path.id = activities.learning_path_id
  )
);

create policy activity_prerequisites_scoped_select
on public.activity_prerequisites
for select
to authenticated
using (
  exists (
    select 1
    from public.learning_paths as path
    where path.id = activity_prerequisites.learning_path_id
  )
);

create policy activity_completions_self_or_course_staff_select
on public.activity_completions
for select
to authenticated
using (
  (select private.is_administrator())
  or exists (
    select 1
    from public.enrollments as enrollment
    where enrollment.id = activity_completions.enrollment_id
      and (
        enrollment.profile_id = (select private.current_profile_id())
        or private.has_course_role(
          enrollment.course_run_id,
          array['course_teacher', 'course_lead']::public.portal_role[]
        )
      )
  )
);

create policy enrollment_progress_self_or_course_staff_select
on public.enrollment_progress
for select
to authenticated
using (
  (select private.is_administrator())
  or exists (
    select 1
    from public.enrollments as enrollment
    where enrollment.id = enrollment_progress.enrollment_id
      and (
        enrollment.profile_id = (select private.current_profile_id())
        or private.has_course_role(
          enrollment.course_run_id,
          array['course_teacher', 'course_lead']::public.portal_role[]
        )
      )
  )
);
