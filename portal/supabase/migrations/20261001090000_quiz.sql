create table public.question_versions (
  id uuid primary key default gen_random_uuid(),
  question_key text not null
    constraint question_versions_key_format
    check (question_key = lower(btrim(question_key)) and question_key ~ '^[a-z0-9_-]{2,80}$'),
  version_number integer not null
    constraint question_versions_version_positive
    check (version_number > 0),
  prompt text not null
    constraint question_versions_prompt_length
    check (char_length(btrim(prompt)) between 2 and 2000),
  options jsonb not null,
  correct_option_id text not null
    constraint question_versions_correct_option_length
    check (char_length(btrim(correct_option_id)) between 1 and 80),
  points integer not null default 1
    constraint question_versions_points_positive
    check (points > 0),
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  published_at timestamptz,
  constraint question_versions_key_version_unique unique (question_key, version_number)
);

create table public.quiz_definitions (
  id uuid primary key default gen_random_uuid(),
  activity_id uuid not null references public.activities(id) on delete restrict,
  revision_number integer not null
    constraint quiz_definitions_revision_positive
    check (revision_number > 0),
  title text not null
    constraint quiz_definitions_title_length
    check (char_length(btrim(title)) between 2 and 180),
  pass_percent smallint not null
    constraint quiz_definitions_pass_percent_range
    check (pass_percent between 1 and 100),
  max_attempts integer
    constraint quiz_definitions_max_attempts_positive
    check (max_attempts is null or max_attempts > 0),
  retry_delay_hours integer not null default 0
    constraint quiz_definitions_retry_delay_nonnegative
    check (retry_delay_hours >= 0),
  is_published boolean not null default false,
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  published_at timestamptz,
  constraint quiz_definitions_activity_revision_unique unique (activity_id, revision_number),
  constraint quiz_definitions_id_activity_unique unique (id, activity_id),
  constraint quiz_definitions_publication_consistent check (
    (not is_published and published_at is null)
    or (is_published and published_at is not null)
  )
);

create index quiz_definitions_activity_published_idx
  on public.quiz_definitions (activity_id, revision_number desc)
  where is_published;

create table public.quiz_question_links (
  quiz_definition_id uuid not null references public.quiz_definitions(id) on delete restrict,
  question_version_id uuid not null references public.question_versions(id) on delete restrict,
  sort_order smallint not null
    constraint quiz_question_links_sort_positive
    check (sort_order > 0),
  primary key (quiz_definition_id, question_version_id),
  constraint quiz_question_links_definition_sort_unique
    unique (quiz_definition_id, sort_order)
);

create table public.quiz_attempts (
  id uuid primary key default gen_random_uuid(),
  enrollment_id uuid not null,
  course_run_id uuid not null,
  learning_path_id uuid not null,
  activity_id uuid not null,
  quiz_definition_id uuid not null,
  idempotency_key uuid not null,
  question_version_ids uuid[] not null
    constraint quiz_attempts_questions_present
    check (cardinality(question_version_ids) > 0),
  earned_points integer not null
    constraint quiz_attempts_earned_nonnegative
    check (earned_points >= 0),
  possible_points integer not null
    constraint quiz_attempts_possible_positive
    check (possible_points > 0),
  percent smallint not null
    constraint quiz_attempts_percent_range
    check (percent between 0 and 100),
  passed boolean not null,
  started_at timestamptz not null default now(),
  submitted_at timestamptz not null default now(),
  next_attempt_at timestamptz,
  constraint quiz_attempts_enrollment_course_fk
    foreign key (enrollment_id, course_run_id)
    references public.enrollments (id, course_run_id)
    on delete restrict,
  constraint quiz_attempts_path_course_fk
    foreign key (learning_path_id, course_run_id)
    references public.learning_paths (id, course_run_id)
    on delete restrict,
  constraint quiz_attempts_activity_path_fk
    foreign key (activity_id, learning_path_id)
    references public.activities (id, learning_path_id)
    on delete restrict,
  constraint quiz_attempts_definition_activity_fk
    foreign key (quiz_definition_id, activity_id)
    references public.quiz_definitions (id, activity_id)
    on delete restrict,
  constraint quiz_attempts_score_ordered check (earned_points <= possible_points),
  constraint quiz_attempts_time_ordered check (submitted_at >= started_at),
  constraint quiz_attempts_retry_time_ordered check (
    next_attempt_at is null or next_attempt_at >= submitted_at
  ),
  constraint quiz_attempts_idempotency_unique
    unique (enrollment_id, activity_id, idempotency_key)
);

create index quiz_attempts_enrollment_activity_idx
  on public.quiz_attempts (enrollment_id, activity_id, submitted_at desc);

create table public.quiz_answers (
  attempt_id uuid not null references public.quiz_attempts(id) on delete restrict,
  question_version_id uuid not null references public.question_versions(id) on delete restrict,
  selected_option_id text not null
    constraint quiz_answers_option_length
    check (char_length(btrim(selected_option_id)) between 1 and 80),
  primary key (attempt_id, question_version_id)
);

create function private.validate_question_version()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  option_count integer;
  distinct_option_count integer;
begin
  if jsonb_typeof(new.options) <> 'array'
    or jsonb_array_length(new.options) < 2
    or jsonb_array_length(new.options) > 8
  then
    raise exception using
      errcode = '22023',
      message = 'QUESTION_OPTIONS_INVALID';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(new.options) as option(value)
    where jsonb_typeof(option.value) <> 'object'
      or nullif(btrim(option.value ->> 'id'), '') is null
      or nullif(btrim(option.value ->> 'label'), '') is null
  ) then
    raise exception using
      errcode = '22023',
      message = 'QUESTION_OPTION_INVALID';
  end if;

  select
    count(*)::integer,
    count(distinct option.value ->> 'id')::integer
  into option_count, distinct_option_count
  from jsonb_array_elements(new.options) as option(value);

  if option_count <> distinct_option_count
    or not exists (
      select 1
      from jsonb_array_elements(new.options) as option(value)
      where option.value ->> 'id' = new.correct_option_id
    )
  then
    raise exception using
      errcode = '22023',
      message = 'QUESTION_CORRECT_OPTION_INVALID';
  end if;

  return new;
end;
$$;

create trigger question_versions_validate
before insert on public.question_versions
for each row execute function private.validate_question_version();

create function private.reject_quiz_record_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception using
    errcode = '55000',
    message = 'QUIZ_RECORD_IS_IMMUTABLE';
end;
$$;

create trigger question_versions_reject_mutation
before update or delete on public.question_versions
for each row execute function private.reject_quiz_record_mutation();

create trigger quiz_definitions_reject_mutation
before update or delete on public.quiz_definitions
for each row execute function private.reject_quiz_record_mutation();

create trigger quiz_question_links_reject_mutation
before update or delete on public.quiz_question_links
for each row execute function private.reject_quiz_record_mutation();

create trigger quiz_attempts_reject_mutation
before update or delete on public.quiz_attempts
for each row execute function private.reject_quiz_record_mutation();

create trigger quiz_answers_reject_mutation
before update or delete on public.quiz_answers
for each row execute function private.reject_quiz_record_mutation();

create function public.get_quiz_for_student(target_activity_id uuid)
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
  quiz_record public.quiz_definitions%rowtype;
  attempts_used integer;
  latest_next_attempt_at timestamptz;
begin
  actor_profile_id := private.current_profile_id();

  select activity.*
  into activity_record
  from public.activities as activity
  join public.learning_paths as path
    on path.id = activity.learning_path_id
    and path.status = 'published'
  where activity.id = target_activity_id
    and activity.activity_type in ('quiz', 'knowledge_test')
    and activity.completion_mode = 'quiz_pass';

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
  into quiz_record
  from public.quiz_definitions as definition
  where definition.activity_id = target_activity_id
    and definition.is_published
  order by definition.revision_number desc
  limit 1;

  if actor_profile_id is null
    or activity_record.id is null
    or enrollment_record.id is null
    or quiz_record.id is null
  then
    raise exception using
      errcode = '42501',
      message = 'QUIZ_ACCESS_FORBIDDEN';
  end if;

  if exists (
    select 1
    from public.activity_prerequisites as prerequisite
    where prerequisite.activity_id = target_activity_id
      and not exists (
        select 1
        from public.activity_completions as completion
        where completion.enrollment_id = enrollment_record.id
          and completion.activity_id = prerequisite.prerequisite_activity_id
      )
  ) then
    raise exception using
      errcode = '55000',
      message = 'ACTIVITY_PREREQUISITES_MISSING';
  end if;

  select count(*)::integer
  into attempts_used
  from public.quiz_attempts as attempt
  where attempt.enrollment_id = enrollment_record.id
    and attempt.quiz_definition_id = quiz_record.id;

  select attempt.next_attempt_at
  into latest_next_attempt_at
  from public.quiz_attempts as attempt
  where attempt.enrollment_id = enrollment_record.id
    and attempt.quiz_definition_id = quiz_record.id
  order by attempt.submitted_at desc
  limit 1;

  return jsonb_build_object(
    'activityId', activity_record.id,
    'courseRunId', enrollment_record.course_run_id,
    'enrollmentId', enrollment_record.id,
    'quizDefinitionId', quiz_record.id,
    'title', quiz_record.title,
    'passPercent', quiz_record.pass_percent,
    'maxAttempts', quiz_record.max_attempts,
    'retryDelayHours', quiz_record.retry_delay_hours,
    'attemptsUsed', attempts_used,
    'nextAttemptAt', latest_next_attempt_at,
    'questions', coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'id', question.id,
            'prompt', question.prompt,
            'points', question.points,
            'options', question.options
          )
          order by link.sort_order
        )
        from public.quiz_question_links as link
        join public.question_versions as question
          on question.id = link.question_version_id
        where link.quiz_definition_id = quiz_record.id
          and question.published_at is not null
      ),
      '[]'::jsonb
    )
  );
end;
$$;

create function public.submit_quiz_attempt(
  target_enrollment_id uuid,
  target_activity_id uuid,
  target_idempotency_key uuid,
  target_answers jsonb
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
  quiz_record public.quiz_definitions%rowtype;
  existing_attempt public.quiz_attempts%rowtype;
  question_record record;
  selected_option_id text;
  submitted_answer_count integer;
  expected_answer_count integer;
  attempts_used integer;
  latest_next_attempt_at timestamptz;
  earned_points integer := 0;
  possible_points integer := 0;
  result_percent smallint;
  result_passed boolean;
  result_next_attempt_at timestamptz;
  attempt_id uuid;
  question_version_ids uuid[];
  submitted_at timestamptz := clock_timestamp();
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
      message = 'QUIZ_ATTEMPT_FORBIDDEN';
  end if;

  select activity.*
  into activity_record
  from public.activities as activity
  where activity.id = target_activity_id;

  select path.*
  into path_record
  from public.learning_paths as path
  where path.id = activity_record.learning_path_id;

  select definition.*
  into quiz_record
  from public.quiz_definitions as definition
  where definition.activity_id = target_activity_id
    and definition.is_published
  order by definition.revision_number desc
  limit 1;

  if activity_record.id is null
    or activity_record.activity_type not in ('quiz', 'knowledge_test')
    or activity_record.completion_mode <> 'quiz_pass'
    or path_record.status <> 'published'
    or path_record.course_run_id <> enrollment_record.course_run_id
    or quiz_record.id is null
  then
    raise exception using
      errcode = '42501',
      message = 'QUIZ_ATTEMPT_FORBIDDEN';
  end if;

  select attempt.*
  into existing_attempt
  from public.quiz_attempts as attempt
  where attempt.enrollment_id = target_enrollment_id
    and attempt.activity_id = target_activity_id
    and attempt.idempotency_key = target_idempotency_key;

  if existing_attempt.id is not null then
    return jsonb_build_object(
      'attemptId', existing_attempt.id,
      'earned', existing_attempt.earned_points,
      'possible', existing_attempt.possible_points,
      'percent', existing_attempt.percent,
      'passed', existing_attempt.passed,
      'nextAttemptAt', existing_attempt.next_attempt_at
    );
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

  select count(*)::integer
  into attempts_used
  from public.quiz_attempts as attempt
  where attempt.enrollment_id = target_enrollment_id
    and attempt.quiz_definition_id = quiz_record.id;

  if quiz_record.max_attempts is not null
    and attempts_used >= quiz_record.max_attempts
  then
    raise exception using
      errcode = '55000',
      message = 'max_attempts_reached';
  end if;

  select attempt.next_attempt_at
  into latest_next_attempt_at
  from public.quiz_attempts as attempt
  where attempt.enrollment_id = target_enrollment_id
    and attempt.quiz_definition_id = quiz_record.id
  order by attempt.submitted_at desc
  limit 1;

  if latest_next_attempt_at is not null
    and latest_next_attempt_at > submitted_at
  then
    raise exception using
      errcode = '55000',
      message = 'retry_delayed';
  end if;

  if jsonb_typeof(target_answers) <> 'array' then
    raise exception using
      errcode = '22023',
      message = 'QUIZ_ANSWERS_INVALID';
  end if;

  select
    count(*)::integer,
    array_agg(question.id order by link.sort_order)
  into expected_answer_count, question_version_ids
  from public.quiz_question_links as link
  join public.question_versions as question
    on question.id = link.question_version_id
  where link.quiz_definition_id = quiz_record.id
    and question.published_at is not null;

  if expected_answer_count = 0
    or jsonb_array_length(target_answers) <> expected_answer_count
  then
    raise exception using
      errcode = '22023',
      message = 'QUIZ_ANSWERS_INCOMPLETE';
  end if;

  for question_record in
    select question.*
    from public.quiz_question_links as link
    join public.question_versions as question
      on question.id = link.question_version_id
    where link.quiz_definition_id = quiz_record.id
      and question.published_at is not null
    order by link.sort_order
  loop
    select
      count(*)::integer,
      max(answer.value ->> 'optionId')
    into submitted_answer_count, selected_option_id
    from jsonb_array_elements(target_answers) as answer(value)
    where answer.value ->> 'questionId' = question_record.id::text;

    if submitted_answer_count <> 1
      or selected_option_id is null
      or not exists (
        select 1
        from jsonb_array_elements(question_record.options) as option(value)
        where option.value ->> 'id' = selected_option_id
      )
    then
      raise exception using
        errcode = '22023',
        message = 'QUIZ_ANSWER_INVALID';
    end if;

    possible_points := possible_points + question_record.points;

    if selected_option_id = question_record.correct_option_id then
      earned_points := earned_points + question_record.points;
    end if;
  end loop;

  result_percent := round(
    earned_points::numeric * 100 / possible_points
  )::smallint;
  result_passed := result_percent >= quiz_record.pass_percent;
  result_next_attempt_at := case
    when result_passed or quiz_record.retry_delay_hours = 0 then null
    else submitted_at + make_interval(hours => quiz_record.retry_delay_hours)
  end;
  attempt_id := gen_random_uuid();

  insert into public.quiz_attempts (
    id,
    enrollment_id,
    course_run_id,
    learning_path_id,
    activity_id,
    quiz_definition_id,
    idempotency_key,
    question_version_ids,
    earned_points,
    possible_points,
    percent,
    passed,
    started_at,
    submitted_at,
    next_attempt_at
  )
  values (
    attempt_id,
    target_enrollment_id,
    enrollment_record.course_run_id,
    activity_record.learning_path_id,
    target_activity_id,
    quiz_record.id,
    target_idempotency_key,
    question_version_ids,
    earned_points,
    possible_points,
    result_percent,
    result_passed,
    submitted_at,
    submitted_at,
    result_next_attempt_at
  );

  insert into public.quiz_answers (
    attempt_id,
    question_version_id,
    selected_option_id
  )
  select
    attempt_id,
    question.id,
    answer.value ->> 'optionId'
  from public.quiz_question_links as link
  join public.question_versions as question
    on question.id = link.question_version_id
  join jsonb_array_elements(target_answers) as answer(value)
    on answer.value ->> 'questionId' = question.id::text
  where link.quiz_definition_id = quiz_record.id;

  if result_passed then
    insert into public.activity_completions (
      enrollment_id,
      course_run_id,
      learning_path_id,
      activity_id,
      source,
      completed_by,
      completed_at
    )
    values (
      target_enrollment_id,
      enrollment_record.course_run_id,
      activity_record.learning_path_id,
      target_activity_id,
      'assessment',
      actor_profile_id,
      submitted_at
    )
    on conflict (enrollment_id, activity_id) do nothing;
  end if;

  insert into public.audit_events (
    actor_profile_id,
    action,
    entity_type,
    entity_id,
    after_data
  )
  values (
    actor_profile_id,
    'quiz.attempt_submitted',
    'quiz_attempt',
    attempt_id::text,
    jsonb_build_object(
      'activityId', target_activity_id,
      'enrollmentId', target_enrollment_id,
      'percent', result_percent,
      'passed', result_passed
    )
  );

  return jsonb_build_object(
    'attemptId', attempt_id,
    'earned', earned_points,
    'possible', possible_points,
    'percent', result_percent,
    'passed', result_passed,
    'nextAttemptAt', result_next_attempt_at
  );
end;
$$;

revoke all on function private.validate_question_version() from public, anon, authenticated;
revoke all on function private.reject_quiz_record_mutation() from public, anon, authenticated;
revoke all on function public.get_quiz_for_student(uuid) from public, anon;
revoke all on function public.submit_quiz_attempt(uuid, uuid, uuid, jsonb) from public, anon;

grant execute on function public.get_quiz_for_student(uuid) to authenticated;
grant execute on function public.submit_quiz_attempt(uuid, uuid, uuid, jsonb) to authenticated;

alter table public.question_versions enable row level security;
alter table public.quiz_definitions enable row level security;
alter table public.quiz_question_links enable row level security;
alter table public.quiz_attempts enable row level security;
alter table public.quiz_answers enable row level security;

revoke all on table public.question_versions from anon, authenticated;
revoke all on table public.quiz_definitions from anon, authenticated;
revoke all on table public.quiz_question_links from anon, authenticated;
revoke all on table public.quiz_attempts from anon, authenticated;
revoke all on table public.quiz_answers from anon, authenticated;

grant select on table public.question_versions to authenticated;
grant select on table public.quiz_definitions to authenticated;
grant select on table public.quiz_question_links to authenticated;
grant select on table public.quiz_attempts to authenticated;
grant select on table public.quiz_answers to authenticated;

create policy question_versions_staff_select
on public.question_versions
for select
to authenticated
using (
  (select private.is_administrator())
  or (select private.has_global_role('editor'::public.portal_role))
  or exists (
    select 1
    from public.quiz_question_links as link
    join public.quiz_definitions as definition
      on definition.id = link.quiz_definition_id
    join public.activities as activity
      on activity.id = definition.activity_id
    join public.learning_paths as path
      on path.id = activity.learning_path_id
    where link.question_version_id = question_versions.id
      and private.has_course_role(
        path.course_run_id,
        array['course_teacher', 'course_lead']::public.portal_role[]
      )
  )
);

create policy quiz_definitions_scoped_select
on public.quiz_definitions
for select
to authenticated
using (
  exists (
    select 1
    from public.activities as activity
    join public.learning_paths as path
      on path.id = activity.learning_path_id
    where activity.id = quiz_definitions.activity_id
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

create policy quiz_question_links_scoped_select
on public.quiz_question_links
for select
to authenticated
using (
  exists (
    select 1
    from public.quiz_definitions as definition
    where definition.id = quiz_question_links.quiz_definition_id
  )
);

create policy quiz_attempts_self_or_course_staff_select
on public.quiz_attempts
for select
to authenticated
using (
  (select private.is_administrator())
  or exists (
    select 1
    from public.enrollments as enrollment
    where enrollment.id = quiz_attempts.enrollment_id
      and (
        enrollment.profile_id = (select private.current_profile_id())
        or private.has_course_role(
          enrollment.course_run_id,
          array['course_teacher', 'course_lead']::public.portal_role[]
        )
      )
  )
);

create policy quiz_answers_self_or_course_staff_select
on public.quiz_answers
for select
to authenticated
using (
  exists (
    select 1
    from public.quiz_attempts as attempt
    where attempt.id = quiz_answers.attempt_id
  )
);
