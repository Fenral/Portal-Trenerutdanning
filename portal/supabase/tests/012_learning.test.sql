begin;

select plan(34);

select has_table('public', 'learning_paths', 'learning paths table exists');
select has_table('public', 'modules', 'modules table exists');
select has_table('public', 'activities', 'activities table exists');
select has_table('public', 'activity_prerequisites', 'prerequisites table exists');
select has_table('public', 'activity_completions', 'completions table exists');
select has_table('public', 'enrollment_progress', 'progress table exists');
select ok(
  to_regprocedure('public.publish_learning_path(uuid,uuid)') is not null,
  'transactional learning path publisher exists'
);
select ok(
  to_regprocedure('public.record_activity_completion(uuid,uuid,uuid)') is not null,
  'student completion function exists'
);
select ok(
  not has_table_privilege('authenticated', 'public.activity_completions', 'INSERT'),
  'authenticated callers cannot insert completions directly'
);
select ok(
  not has_function_privilege(
    'anon',
    'public.record_activity_completion(uuid,uuid,uuid)',
    'EXECUTE'
  ),
  'anonymous callers cannot record completions'
);
select ok(
  has_function_privilege(
    'authenticated',
    'public.record_activity_completion(uuid,uuid,uuid)',
    'EXECUTE'
  ),
  'authenticated callers can use the guarded completion function'
);

insert into auth.users (id, email, email_confirmed_at)
values
  ('23000000-0000-0000-0000-000000000001', 'learning-admin@example.invalid', now()),
  ('23000000-0000-0000-0000-000000000002', 'learning-student-a@example.invalid', now()),
  ('23000000-0000-0000-0000-000000000003', 'learning-student-b@example.invalid', now()),
  ('23000000-0000-0000-0000-000000000004', 'learning-teacher@example.invalid', now());

insert into public.profiles (id, display_name, normalized_email)
values
  ('13000000-0000-0000-0000-000000000001', 'Læring Admin', 'learning-admin@example.invalid'),
  ('13000000-0000-0000-0000-000000000002', 'Læring Student A', 'learning-student-a@example.invalid'),
  ('13000000-0000-0000-0000-000000000003', 'Læring Student B', 'learning-student-b@example.invalid'),
  ('13000000-0000-0000-0000-000000000004', 'Læring Lærer', 'learning-teacher@example.invalid');

insert into public.user_accounts (user_id, profile_id, normalized_email)
values
  ('23000000-0000-0000-0000-000000000001', '13000000-0000-0000-0000-000000000001', 'learning-admin@example.invalid'),
  ('23000000-0000-0000-0000-000000000002', '13000000-0000-0000-0000-000000000002', 'learning-student-a@example.invalid'),
  ('23000000-0000-0000-0000-000000000003', '13000000-0000-0000-0000-000000000003', 'learning-student-b@example.invalid'),
  ('23000000-0000-0000-0000-000000000004', '13000000-0000-0000-0000-000000000004', 'learning-teacher@example.invalid');

insert into public.role_assignments (
  profile_id,
  role,
  course_run_id,
  granted_by
)
values
  (
    '13000000-0000-0000-0000-000000000001',
    'administrator',
    null,
    '13000000-0000-0000-0000-000000000001'
  );

insert into public.course_templates (id, code, title, level)
values (
  '33000000-0000-0000-0000-000000000001',
  'LEARNING_T1',
  'Læringstest Trener 1',
  1
);

insert into public.course_runs (
  id,
  template_id,
  title,
  start_year,
  starts_on,
  ends_on,
  status
)
values
  (
    '43000000-0000-0000-0000-000000000001',
    '33000000-0000-0000-0000-000000000001',
    'Læringstest A',
    2027,
    '2027-02-03',
    '2027-10-31',
    'active'
  ),
  (
    '43000000-0000-0000-0000-000000000002',
    '33000000-0000-0000-0000-000000000001',
    'Læringstest B',
    2027,
    '2027-02-03',
    '2027-10-31',
    'active'
  );

insert into public.role_assignments (
  profile_id,
  role,
  course_run_id,
  granted_by
)
values (
  '13000000-0000-0000-0000-000000000004',
  'course_teacher',
  '43000000-0000-0000-0000-000000000001',
  '13000000-0000-0000-0000-000000000001'
);

insert into public.enrollments (id, course_run_id, profile_id, status)
values
  (
    '63000000-0000-0000-0000-000000000001',
    '43000000-0000-0000-0000-000000000001',
    '13000000-0000-0000-0000-000000000002',
    'active'
  ),
  (
    '63000000-0000-0000-0000-000000000002',
    '43000000-0000-0000-0000-000000000002',
    '13000000-0000-0000-0000-000000000003',
    'active'
  );

insert into public.content_items (id, kind, slug, title, created_by)
values (
  '53000000-0000-0000-0000-000000000001',
  'lesson',
  'learning-test-lesson',
  'Testleksjon',
  '13000000-0000-0000-0000-000000000001'
);

insert into public.content_revisions (
  id,
  content_item_id,
  revision_number,
  status,
  document,
  change_note,
  created_by,
  published_by,
  published_at
)
values (
  '73000000-0000-0000-0000-000000000001',
  '53000000-0000-0000-0000-000000000001',
  1,
  'published',
  '{"locale":"nb-NO","format":"short_page","blocks":[]}'::jsonb,
  'Publisert testleksjon',
  '13000000-0000-0000-0000-000000000001',
  '13000000-0000-0000-0000-000000000001',
  now()
);

insert into public.course_content_bindings (
  course_run_id,
  content_item_id,
  content_revision_id,
  bound_by
)
values (
  '43000000-0000-0000-0000-000000000001',
  '53000000-0000-0000-0000-000000000001',
  '73000000-0000-0000-0000-000000000001',
  '13000000-0000-0000-0000-000000000001'
);

insert into public.learning_paths (
  id,
  course_run_id,
  title,
  created_by
)
values
  (
    '83000000-0000-0000-0000-000000000001',
    '43000000-0000-0000-0000-000000000001',
    'Læringsløp A',
    '13000000-0000-0000-0000-000000000001'
  ),
  (
    '83000000-0000-0000-0000-000000000002',
    '43000000-0000-0000-0000-000000000002',
    'Læringsløp med sirkel',
    '13000000-0000-0000-0000-000000000001'
  );

insert into public.modules (id, learning_path_id, title, sort_order)
values
  (
    '84000000-0000-0000-0000-000000000001',
    '83000000-0000-0000-0000-000000000001',
    'Grunnmodul',
    1
  ),
  (
    '84000000-0000-0000-0000-000000000002',
    '83000000-0000-0000-0000-000000000002',
    'Sirkelmodul',
    1
  );

insert into public.activities (
  id,
  learning_path_id,
  module_id,
  title,
  activity_type,
  completion_mode,
  content_item_id,
  required,
  weight,
  sort_order
)
values
  (
    '85000000-0000-0000-0000-000000000001',
    '83000000-0000-0000-0000-000000000001',
    '84000000-0000-0000-0000-000000000001',
    'Steg 1',
    'lesson',
    'manual',
    '53000000-0000-0000-0000-000000000001',
    true,
    1,
    1
  ),
  (
    '85000000-0000-0000-0000-000000000002',
    '83000000-0000-0000-0000-000000000001',
    '84000000-0000-0000-0000-000000000001',
    'Steg 2',
    'lesson',
    'reach_end',
    '53000000-0000-0000-0000-000000000001',
    true,
    2,
    2
  ),
  (
    '85000000-0000-0000-0000-000000000003',
    '83000000-0000-0000-0000-000000000001',
    '84000000-0000-0000-0000-000000000001',
    'Kunnskapsprøve',
    'knowledge_test',
    'quiz_pass',
    null,
    true,
    1,
    3
  ),
  (
    '85000000-0000-0000-0000-000000000004',
    '83000000-0000-0000-0000-000000000001',
    '84000000-0000-0000-0000-000000000001',
    'Valgfri fordypning',
    'lesson',
    'manual',
    '53000000-0000-0000-0000-000000000001',
    false,
    10,
    4
  ),
  (
    '85000000-0000-0000-0000-000000000005',
    '83000000-0000-0000-0000-000000000002',
    '84000000-0000-0000-0000-000000000002',
    'Sirkel A',
    'quiz',
    'quiz_pass',
    null,
    true,
    1,
    1
  ),
  (
    '85000000-0000-0000-0000-000000000006',
    '83000000-0000-0000-0000-000000000002',
    '84000000-0000-0000-0000-000000000002',
    'Sirkel B',
    'quiz',
    'quiz_pass',
    null,
    true,
    1,
    2
  );

insert into public.activity_prerequisites (
  learning_path_id,
  activity_id,
  prerequisite_activity_id
)
values
  (
    '83000000-0000-0000-0000-000000000001',
    '85000000-0000-0000-0000-000000000002',
    '85000000-0000-0000-0000-000000000001'
  ),
  (
    '83000000-0000-0000-0000-000000000001',
    '85000000-0000-0000-0000-000000000003',
    '85000000-0000-0000-0000-000000000001'
  ),
  (
    '83000000-0000-0000-0000-000000000001',
    '85000000-0000-0000-0000-000000000003',
    '85000000-0000-0000-0000-000000000002'
  ),
  (
    '83000000-0000-0000-0000-000000000002',
    '85000000-0000-0000-0000-000000000005',
    '85000000-0000-0000-0000-000000000006'
  ),
  (
    '83000000-0000-0000-0000-000000000002',
    '85000000-0000-0000-0000-000000000006',
    '85000000-0000-0000-0000-000000000005'
  );

set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '23000000-0000-0000-0000-000000000001',
  true
);

select throws_ok(
  $$
    select public.publish_learning_path(
      '83000000-0000-0000-0000-000000000002',
      '13000000-0000-0000-0000-000000000001'
    )
  $$,
  '22023',
  'LEARNING_PATH_CIRCULAR_PREREQUISITE',
  'publication rejects circular prerequisites'
);
select is(
  (
    select status::text
    from public.learning_paths
    where id = '83000000-0000-0000-0000-000000000002'
  ),
  'draft',
  'a rejected path remains a draft'
);
select lives_ok(
  $$
    select public.publish_learning_path(
      '83000000-0000-0000-0000-000000000001',
      '13000000-0000-0000-0000-000000000001'
    )
  $$,
  'an acyclic path publishes'
);
select is(
  (
    select status::text
    from public.learning_paths
    where id = '83000000-0000-0000-0000-000000000001'
  ),
  'published',
  'valid path becomes published'
);
select results_eq(
  $$
    select completed_weight, total_weight, percentage::integer
    from public.enrollment_progress
    where enrollment_id = '63000000-0000-0000-0000-000000000001'
  $$,
  $$values (0, 4, 0)$$,
  'publication initializes zero progress from required weights'
);

select set_config(
  'request.jwt.claim.sub',
  '23000000-0000-0000-0000-000000000002',
  true
);

select results_eq(
  $$select title from public.learning_paths order by title$$,
  $$values ('Læringsløp A'::text)$$,
  'student sees own published path but no draft path'
);
select throws_ok(
  $$
    select public.record_activity_completion(
      '63000000-0000-0000-0000-000000000001',
      '85000000-0000-0000-0000-000000000002',
      '73000000-0000-0000-0000-000000000001'
    )
  $$,
  '55000',
  'ACTIVITY_PREREQUISITES_MISSING',
  'step 2 stays locked until step 1 is complete'
);
select throws_ok(
  $$
    select public.record_activity_completion(
      '63000000-0000-0000-0000-000000000001',
      '85000000-0000-0000-0000-000000000001',
      null
    )
  $$,
  '22023',
  'ACTIVITY_BOUND_CONTENT_REVISION_REQUIRED',
  'a content activity requires the revision bound to the course'
);
select lives_ok(
  $$
    select public.record_activity_completion(
      '63000000-0000-0000-0000-000000000001',
      '85000000-0000-0000-0000-000000000001',
      '73000000-0000-0000-0000-000000000001'
    )
  $$,
  'student completes the first open activity'
);
select results_eq(
  $$
    select content_revision_id
    from public.activity_completions
    where activity_id = '85000000-0000-0000-0000-000000000001'
  $$,
  $$values ('73000000-0000-0000-0000-000000000001'::uuid)$$,
  'completion preserves the exact bound content revision'
);
select is(
  (
    select percentage::integer
    from public.enrollment_progress
    where enrollment_id = '63000000-0000-0000-0000-000000000001'
  ),
  25,
  'first weighted activity produces 25 percent progress'
);
select lives_ok(
  $$
    select public.record_activity_completion(
      '63000000-0000-0000-0000-000000000001',
      '85000000-0000-0000-0000-000000000001',
      '73000000-0000-0000-0000-000000000001'
    )
  $$,
  'repeating a completion request is idempotent'
);
select is(
  (
    select count(*)::integer
    from public.activity_completions
    where activity_id = '85000000-0000-0000-0000-000000000001'
  ),
  1,
  'idempotent completion creates one row'
);
select lives_ok(
  $$
    select public.record_activity_completion(
      '63000000-0000-0000-0000-000000000001',
      '85000000-0000-0000-0000-000000000002',
      '73000000-0000-0000-0000-000000000001'
    )
  $$,
  'step 2 opens after its prerequisite'
);
select is(
  (
    select percentage::integer
    from public.enrollment_progress
    where enrollment_id = '63000000-0000-0000-0000-000000000001'
  ),
  75,
  'weighted required progress reaches 75 percent'
);
select throws_ok(
  $$
    select public.record_activity_completion(
      '63000000-0000-0000-0000-000000000001',
      '85000000-0000-0000-0000-000000000003',
      null
    )
  $$,
  '42501',
  'ACTIVITY_REQUIRES_VERIFIED_COMPLETION',
  'student cannot self-complete a knowledge test'
);
select lives_ok(
  $$
    select public.record_activity_completion(
      '63000000-0000-0000-0000-000000000001',
      '85000000-0000-0000-0000-000000000004',
      '73000000-0000-0000-0000-000000000001'
    )
  $$,
  'student may complete an optional activity'
);
select is(
  (
    select percentage::integer
    from public.enrollment_progress
    where enrollment_id = '63000000-0000-0000-0000-000000000001'
  ),
  75,
  'optional activity does not change required progress'
);

select set_config(
  'request.jwt.claim.sub',
  '23000000-0000-0000-0000-000000000003',
  true
);

select is_empty(
  $$select id from public.activity_completions$$,
  'a student cannot see another course completion'
);
select throws_ok(
  $$
    select public.record_activity_completion(
      '63000000-0000-0000-0000-000000000001',
      '85000000-0000-0000-0000-000000000001',
      '73000000-0000-0000-0000-000000000001'
    )
  $$,
  '42501',
  'ACTIVITY_COMPLETION_FORBIDDEN',
  'a student cannot complete an activity for another enrollment'
);

select set_config(
  'request.jwt.claim.sub',
  '23000000-0000-0000-0000-000000000004',
  true
);

select is(
  (select count(*)::integer from public.activity_completions),
  3,
  'course teacher sees participant completions in their course'
);

reset role;

select throws_ok(
  $$
    update public.activity_completions
    set source = 'teacher'
    where id = (
      select id
      from public.activity_completions
      order by completed_at
      limit 1
    )
  $$,
  '55000',
  'ACTIVITY_COMPLETION_IS_IMMUTABLE',
  'a completion cannot be rewritten'
);
select throws_ok(
  $$
    update public.modules
    set title = 'Endret etter publisering'
    where id = '84000000-0000-0000-0000-000000000001'
  $$,
  '55000',
  'PUBLISHED_LEARNING_PATH_IS_IMMUTABLE',
  'published learning structure cannot be edited in place'
);

select * from finish();

rollback;
