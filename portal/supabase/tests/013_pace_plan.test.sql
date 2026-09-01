begin;

select plan(19);

select has_table('public', 'pace_plans', 'pace plans table exists');
select has_table('public', 'pace_milestones', 'pace milestones table exists');
select col_default_is(
  'public', 'pace_plans', 'green_lag', '5',
  'green lag defaults to 5'
);
select col_default_is(
  'public', 'pace_plans', 'red_lag', '15',
  'red lag defaults to 15'
);

select ok(
  has_table_privilege('authenticated', 'public.pace_plans', 'SELECT'),
  'authenticated can read pace plans through RLS'
);
select ok(
  has_table_privilege('authenticated', 'public.pace_plans', 'INSERT'),
  'authenticated can insert pace plans through RLS'
);
select ok(
  not has_table_privilege('authenticated', 'public.pace_plans', 'UPDATE'),
  'pace plan versions are immutable for authenticated'
);
select ok(
  not has_table_privilege('authenticated', 'public.pace_plans', 'DELETE'),
  'pace plan versions cannot be deleted by authenticated'
);
select ok(
  not has_table_privilege('anon', 'public.pace_plans', 'SELECT'),
  'anonymous callers cannot read pace plans'
);
select ok(
  has_table_privilege('authenticated', 'public.pace_milestones', 'INSERT'),
  'authenticated can insert pace milestones through RLS'
);
select ok(
  not has_table_privilege('authenticated', 'public.pace_milestones', 'UPDATE'),
  'pace milestones are immutable for authenticated'
);

insert into auth.users (id, email, email_confirmed_at)
values
  ('24000000-0000-0000-0000-000000000001', 'pace-lead@example.invalid', now()),
  ('24000000-0000-0000-0000-000000000002', 'pace-teacher@example.invalid', now()),
  ('24000000-0000-0000-0000-000000000003', 'pace-student@example.invalid', now());

insert into public.profiles (id, display_name, normalized_email)
values
  ('14000000-0000-0000-0000-000000000001', 'Pace Kursleder', 'pace-lead@example.invalid'),
  ('14000000-0000-0000-0000-000000000002', 'Pace Lærer', 'pace-teacher@example.invalid'),
  ('14000000-0000-0000-0000-000000000003', 'Pace Student', 'pace-student@example.invalid');

insert into public.user_accounts (user_id, profile_id, normalized_email)
values
  ('24000000-0000-0000-0000-000000000001', '14000000-0000-0000-0000-000000000001', 'pace-lead@example.invalid'),
  ('24000000-0000-0000-0000-000000000002', '14000000-0000-0000-0000-000000000002', 'pace-teacher@example.invalid'),
  ('24000000-0000-0000-0000-000000000003', '14000000-0000-0000-0000-000000000003', 'pace-student@example.invalid');

insert into public.course_templates (id, code, title, level)
values ('34000000-0000-0000-0000-000000000001', 'PACE_T1', 'Pacetest Trener 1', 1);

insert into public.course_runs (id, template_id, title, start_year, starts_on, ends_on, status)
values
  (
    '44000000-0000-0000-0000-000000000001',
    '34000000-0000-0000-0000-000000000001',
    'Pacetest A', 2027, '2027-02-01', '2027-10-31', 'active'
  ),
  (
    '44000000-0000-0000-0000-000000000002',
    '34000000-0000-0000-0000-000000000001',
    'Pacetest B', 2027, '2027-02-01', '2027-10-31', 'active'
  );

insert into public.role_assignments (profile_id, role, course_run_id, granted_by)
values
  (
    '14000000-0000-0000-0000-000000000001',
    'course_lead',
    '44000000-0000-0000-0000-000000000001',
    '14000000-0000-0000-0000-000000000001'
  ),
  (
    '14000000-0000-0000-0000-000000000002',
    'course_teacher',
    '44000000-0000-0000-0000-000000000001',
    '14000000-0000-0000-0000-000000000001'
  );

insert into public.enrollments (id, course_run_id, profile_id, status)
values (
  '64000000-0000-0000-0000-000000000001',
  '44000000-0000-0000-0000-000000000001',
  '14000000-0000-0000-0000-000000000003',
  'active'
);

insert into public.pace_plans (id, course_run_id, version, created_by)
values
  (
    '54000000-0000-0000-0000-000000000001',
    '44000000-0000-0000-0000-000000000001',
    1,
    '14000000-0000-0000-0000-000000000001'
  ),
  (
    '54000000-0000-0000-0000-000000000002',
    '44000000-0000-0000-0000-000000000002',
    1,
    '14000000-0000-0000-0000-000000000001'
  );

insert into public.pace_milestones (plan_id, at, percent)
values
  ('54000000-0000-0000-0000-000000000001', '2027-03-01T00:00:00Z', 20),
  ('54000000-0000-0000-0000-000000000001', '2027-09-01T00:00:00Z', 80),
  ('54000000-0000-0000-0000-000000000002', '2027-03-01T00:00:00Z', 25);

select throws_ok(
  $$
    insert into public.pace_milestones (plan_id, at, percent)
    values ('54000000-0000-0000-0000-000000000001', '2027-06-01T00:00:00Z', 10)
  $$,
  '22023',
  'PACE_MILESTONES_NOT_STRICTLY_INCREASING',
  'milestones must be strictly increasing in time and percent'
);

set local role authenticated;

select set_config(
  'request.jwt.claim.sub',
  '24000000-0000-0000-0000-000000000002',
  true
);

select results_eq(
  $$select id from public.pace_plans order by id$$,
  $$values ('54000000-0000-0000-0000-000000000001'::uuid)$$,
  'course teacher reads the pace plan for own course only'
);
select results_eq(
  $$select distinct plan_id from public.pace_milestones$$,
  $$values ('54000000-0000-0000-0000-000000000001'::uuid)$$,
  'course teacher reads milestones for own course only'
);
select throws_ok(
  $$
    insert into public.pace_plans (course_run_id, version, created_by)
    values (
      '44000000-0000-0000-0000-000000000001',
      2,
      '14000000-0000-0000-0000-000000000002'
    )
  $$,
  '42501',
  null,
  'course teacher cannot write pace plans'
);
select throws_ok(
  $$
    insert into public.pace_milestones (plan_id, at, percent)
    values ('54000000-0000-0000-0000-000000000001', '2027-10-01T00:00:00Z', 90)
  $$,
  '42501',
  null,
  'course teacher cannot write pace milestones'
);

select set_config(
  'request.jwt.claim.sub',
  '24000000-0000-0000-0000-000000000003',
  true
);

select is_empty(
  $$select id from public.pace_plans$$,
  'student cannot read pace plans'
);

select set_config(
  'request.jwt.claim.sub',
  '24000000-0000-0000-0000-000000000001',
  true
);

select lives_ok(
  $$
    insert into public.pace_plans (id, course_run_id, green_lag, red_lag, version, created_by)
    values (
      '54000000-0000-0000-0000-000000000003',
      '44000000-0000-0000-0000-000000000001',
      3,
      10,
      2,
      '14000000-0000-0000-0000-000000000001'
    )
  $$,
  'course lead creates a new pace plan version'
);
select lives_ok(
  $$
    insert into public.pace_milestones (plan_id, at, percent)
    values ('54000000-0000-0000-0000-000000000003', '2027-03-01T00:00:00Z', 30)
  $$,
  'course lead adds milestones to own plan'
);

select * from finish();

rollback;
