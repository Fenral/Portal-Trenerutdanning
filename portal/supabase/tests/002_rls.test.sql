begin;

select plan(36);

select ok(
  to_regprocedure('private.current_profile_id()') is not null,
  'current_profile_id helper exists in private schema'
);
select ok(
  to_regprocedure('private.is_administrator()') is not null,
  'is_administrator helper exists in private schema'
);
select ok(
  to_regprocedure('private.has_course_role(uuid,public.portal_role[])') is not null,
  'has_course_role helper exists in private schema'
);
select ok(
  to_regprocedure('private.is_enrolled(uuid)') is not null,
  'is_enrolled helper exists in private schema'
);
select ok(
  to_regprocedure('private.has_global_role(public.portal_role)') is not null,
  'has_global_role helper exists in private schema'
);

select ok(
  has_schema_privilege('authenticated', 'private', 'USAGE'),
  'authenticated can use private authorization helpers'
);
select ok(
  case
    when to_regprocedure('private.current_profile_id()') is null then false
    else has_function_privilege(
      'authenticated',
      'private.current_profile_id()',
      'EXECUTE'
    )
  end,
  'authenticated can execute the caller-bound profile helper'
);

select ok(
  has_table_privilege('authenticated', 'public.profiles', 'SELECT'),
  'authenticated has SELECT on profiles'
);
select ok(
  has_table_privilege('authenticated', 'public.course_templates', 'SELECT'),
  'authenticated has SELECT on course_templates'
);
select ok(
  has_table_privilege('authenticated', 'public.course_runs', 'SELECT'),
  'authenticated has SELECT on course_runs'
);
select ok(
  has_table_privilege('authenticated', 'public.course_sessions', 'SELECT'),
  'authenticated has SELECT on course_sessions'
);
select ok(
  has_table_privilege('authenticated', 'public.role_assignments', 'SELECT'),
  'authenticated has SELECT on role_assignments'
);
select ok(
  has_table_privilege('authenticated', 'public.enrollments', 'SELECT'),
  'authenticated has SELECT on enrollments'
);

select ok(
  not has_table_privilege('authenticated', 'public.invitations', 'SELECT'),
  'authenticated cannot read invitations directly'
);
select ok(
  not has_table_privilege('authenticated', 'public.audit_events', 'SELECT'),
  'authenticated cannot read audit events directly'
);
select ok(
  not has_table_privilege('authenticated', 'public.outbox_events', 'SELECT'),
  'authenticated cannot read outbox events directly'
);
select ok(
  not has_table_privilege('authenticated', 'public.enrollments', 'INSERT')
    and not has_table_privilege('authenticated', 'public.enrollments', 'UPDATE')
    and not has_table_privilege('authenticated', 'public.enrollments', 'DELETE'),
  'authenticated cannot write enrollments directly'
);
select ok(
  not has_table_privilege('authenticated', 'public.role_assignments', 'INSERT')
    and not has_table_privilege('authenticated', 'public.role_assignments', 'UPDATE')
    and not has_table_privilege('authenticated', 'public.role_assignments', 'DELETE'),
  'authenticated cannot write role assignments directly'
);
select ok(
  not has_table_privilege('anon', 'public.profiles', 'SELECT'),
  'anon cannot read profiles'
);

select ok(
  not has_function_privilege(
    'anon',
    'private.current_profile_id()',
    'EXECUTE'
  ),
  'anon cannot execute private authorization helpers'
);

insert into auth.users (id, email)
values
  ('20000000-0000-0000-0000-000000000001', 'admin@example.invalid'),
  ('20000000-0000-0000-0000-000000000002', 'student-a@example.invalid'),
  ('20000000-0000-0000-0000-000000000003', 'student-b@example.invalid'),
  ('20000000-0000-0000-0000-000000000004', 'teacher-a@example.invalid'),
  ('20000000-0000-0000-0000-000000000005', 'editor@example.invalid');

insert into public.profiles (id, display_name, normalized_email)
values
  ('10000000-0000-0000-0000-000000000001', 'Ada Admin', 'admin@example.invalid'),
  ('10000000-0000-0000-0000-000000000002', 'Siri Student A', 'student-a@example.invalid'),
  ('10000000-0000-0000-0000-000000000003', 'Stine Student B', 'student-b@example.invalid'),
  ('10000000-0000-0000-0000-000000000004', 'Terje Teacher A', 'teacher-a@example.invalid'),
  ('10000000-0000-0000-0000-000000000005', 'Eli Editor', 'editor@example.invalid');

insert into public.user_accounts (user_id, profile_id, normalized_email)
values
  ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'admin@example.invalid'),
  ('20000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000002', 'student-a@example.invalid'),
  ('20000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000003', 'student-b@example.invalid'),
  ('20000000-0000-0000-0000-000000000004', '10000000-0000-0000-0000-000000000004', 'teacher-a@example.invalid'),
  ('20000000-0000-0000-0000-000000000005', '10000000-0000-0000-0000-000000000005', 'editor@example.invalid');

insert into public.course_templates (id, code, title, level)
values
  ('30000000-0000-0000-0000-000000000001', 'TEST_A', 'Test course A', 1),
  ('30000000-0000-0000-0000-000000000002', 'TEST_B', 'Test course B', 1);

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
    '40000000-0000-0000-0000-000000000001',
    '30000000-0000-0000-0000-000000000001',
    'Test run A',
    2026,
    '2026-01-01',
    '2026-12-31',
    'active'
  ),
  (
    '40000000-0000-0000-0000-000000000002',
    '30000000-0000-0000-0000-000000000002',
    'Test run B',
    2026,
    '2026-01-01',
    '2026-12-31',
    'active'
  );

insert into public.course_sessions (
  id,
  course_run_id,
  title,
  starts_at,
  ends_at,
  sort_order
)
values
  (
    '41000000-0000-0000-0000-000000000001',
    '40000000-0000-0000-0000-000000000001',
    'Session A',
    '2026-02-01T08:00:00Z',
    '2026-02-01T16:00:00Z',
    1
  ),
  (
    '41000000-0000-0000-0000-000000000002',
    '40000000-0000-0000-0000-000000000002',
    'Session B',
    '2026-02-01T08:00:00Z',
    '2026-02-01T16:00:00Z',
    1
  );

insert into public.enrollments (id, course_run_id, profile_id, status)
values
  (
    '60000000-0000-0000-0000-000000000001',
    '40000000-0000-0000-0000-000000000001',
    '10000000-0000-0000-0000-000000000002',
    'active'
  ),
  (
    '60000000-0000-0000-0000-000000000002',
    '40000000-0000-0000-0000-000000000002',
    '10000000-0000-0000-0000-000000000003',
    'withdrawn'
  );

insert into public.role_assignments (
  id,
  profile_id,
  role,
  course_run_id,
  granted_by
)
values
  (
    '50000000-0000-0000-0000-000000000001',
    '10000000-0000-0000-0000-000000000001',
    'administrator',
    null,
    '10000000-0000-0000-0000-000000000001'
  ),
  (
    '50000000-0000-0000-0000-000000000002',
    '10000000-0000-0000-0000-000000000004',
    'course_teacher',
    '40000000-0000-0000-0000-000000000001',
    '10000000-0000-0000-0000-000000000001'
  ),
  (
    '50000000-0000-0000-0000-000000000003',
    '10000000-0000-0000-0000-000000000005',
    'editor',
    null,
    '10000000-0000-0000-0000-000000000001'
  );

set local role authenticated;

select set_config(
  'request.jwt.claim.sub',
  '20000000-0000-0000-0000-000000000002',
  true
);

select results_eq(
  $$select private.current_profile_id()$$,
  $$values ('10000000-0000-0000-0000-000000000002'::uuid)$$,
  'student helper resolves only the linked profile'
);
select results_eq(
  $$select id from public.profiles order by id$$,
  $$values ('10000000-0000-0000-0000-000000000002'::uuid)$$,
  'student sees only own profile'
);
select results_eq(
  $$select id from public.enrollments order by id$$,
  $$values ('60000000-0000-0000-0000-000000000001'::uuid)$$,
  'student sees only own enrollment'
);
select results_eq(
  $$select id from public.course_runs order by id$$,
  $$values ('40000000-0000-0000-0000-000000000001'::uuid)$$,
  'active student sees only own course run'
);
select results_eq(
  $$select id from public.course_sessions order by id$$,
  $$values ('41000000-0000-0000-0000-000000000001'::uuid)$$,
  'active student sees only own course sessions'
);
select results_eq(
  $$select id from public.course_templates order by id$$,
  $$values ('30000000-0000-0000-0000-000000000001'::uuid)$$,
  'active student sees only own course template'
);

select set_config(
  'request.jwt.claim.sub',
  '20000000-0000-0000-0000-000000000004',
  true
);

select results_eq(
  $$
    select id
    from public.profiles
    where id in (
      '10000000-0000-0000-0000-000000000002',
      '10000000-0000-0000-0000-000000000003'
    )
    order by id
  $$,
  $$values ('10000000-0000-0000-0000-000000000002'::uuid)$$,
  'course teacher sees participants in course A but not course B'
);
select results_eq(
  $$select id from public.enrollments order by id$$,
  $$values ('60000000-0000-0000-0000-000000000001'::uuid)$$,
  'course teacher sees enrollment in course A but not course B'
);
select results_eq(
  $$select id from public.course_runs order by id$$,
  $$values ('40000000-0000-0000-0000-000000000001'::uuid)$$,
  'course teacher sees course A but not course B'
);

select set_config(
  'request.jwt.claim.sub',
  '20000000-0000-0000-0000-000000000005',
  true
);

select is_empty(
  $$
    select id
    from public.profiles
    where id in (
      '10000000-0000-0000-0000-000000000002',
      '10000000-0000-0000-0000-000000000003'
    )
  $$,
  'editor cannot read participant profiles without a course role'
);
select is_empty(
  $$select id from public.enrollments$$,
  'editor cannot read participant enrollments without a course role'
);
select results_eq(
  $$select id from public.course_runs order by id$$,
  $$
    values
      ('40000000-0000-0000-0000-000000000001'::uuid),
      ('40000000-0000-0000-0000-000000000002'::uuid)
  $$,
  'editor can read both course runs'
);

select set_config(
  'request.jwt.claim.sub',
  '20000000-0000-0000-0000-000000000001',
  true
);

select results_eq(
  $$
    select id
    from public.profiles
    where id in (
      '10000000-0000-0000-0000-000000000002',
      '10000000-0000-0000-0000-000000000003'
    )
    order by id
  $$,
  $$
    values
      ('10000000-0000-0000-0000-000000000002'::uuid),
      ('10000000-0000-0000-0000-000000000003'::uuid)
  $$,
  'administrator can read participants across courses'
);
select results_eq(
  $$select id from public.enrollments order by id$$,
  $$
    values
      ('60000000-0000-0000-0000-000000000001'::uuid),
      ('60000000-0000-0000-0000-000000000002'::uuid)
  $$,
  'administrator can read enrollments across courses'
);

select set_config(
  'request.jwt.claim.sub',
  '20000000-0000-0000-0000-000000000003',
  true
);

select is_empty(
  $$select id from public.course_runs$$,
  'withdrawn student has no course access'
);
select is_empty(
  $$select id from public.course_sessions$$,
  'withdrawn student has no session access'
);

select * from finish();

rollback;
