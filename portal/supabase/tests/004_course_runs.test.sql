begin;

select plan(15);

select has_column(
  'public',
  'course_sessions',
  'session_type',
  'course sessions identify regular and optional youth gatherings'
);
select has_column(
  'public',
  'course_sessions',
  'is_required',
  'course sessions store whether attendance is required'
);
select ok(
  to_regprocedure(
    'public.create_course_run_with_sessions(uuid,text,smallint,text,date,date,jsonb,uuid,uuid)'
  ) is not null,
  'transactional course creator exists'
);
select ok(
  has_function_privilege(
    'authenticated',
    'public.create_course_run_with_sessions(uuid,text,smallint,text,date,date,jsonb,uuid,uuid)',
    'EXECUTE'
  ),
  'authenticated caller can invoke the authorization-bound creator'
);
select ok(
  not has_function_privilege(
    'anon',
    'public.create_course_run_with_sessions(uuid,text,smallint,text,date,date,jsonb,uuid,uuid)',
    'EXECUTE'
  ),
  'anonymous caller cannot create a course run'
);

insert into auth.users (id, email, email_confirmed_at)
values
  (
    '22000000-0000-0000-0000-000000000001',
    'course-admin@example.invalid',
    now()
  ),
  (
    '22000000-0000-0000-0000-000000000002',
    'course-editor@example.invalid',
    now()
  );

insert into public.profiles (id, display_name, normalized_email)
values
  (
    '12000000-0000-0000-0000-000000000001',
    'Kurs Admin',
    'course-admin@example.invalid'
  ),
  (
    '12000000-0000-0000-0000-000000000002',
    'Kurs Redaktør',
    'course-editor@example.invalid'
  ),
  (
    '12000000-0000-0000-0000-000000000003',
    'Kursleder Demo',
    'course-lead@example.invalid'
  );

insert into public.user_accounts (user_id, profile_id, normalized_email)
values
  (
    '22000000-0000-0000-0000-000000000001',
    '12000000-0000-0000-0000-000000000001',
    'course-admin@example.invalid'
  ),
  (
    '22000000-0000-0000-0000-000000000002',
    '12000000-0000-0000-0000-000000000002',
    'course-editor@example.invalid'
  );

insert into public.role_assignments (profile_id, role, granted_by)
values
  (
    '12000000-0000-0000-0000-000000000001',
    'administrator',
    '12000000-0000-0000-0000-000000000001'
  ),
  (
    '12000000-0000-0000-0000-000000000002',
    'editor',
    '12000000-0000-0000-0000-000000000001'
  );

insert into public.course_templates (id, code, title, level)
values (
  '32000000-0000-0000-0000-000000000003',
  'COURSE_T3',
  'Course creation T3',
  3
);

set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '22000000-0000-0000-0000-000000000002',
  true
);

select throws_ok(
  $$
    select public.create_course_run_with_sessions(
      '32000000-0000-0000-0000-000000000003',
      'Blocked course run',
      2026::smallint,
      null,
      '2026-02-15',
      '2027-03-21',
      '[{"title":"Samling 1","startsAt":"2026-02-15T09:00:00+01:00","endsAt":"2026-02-15T16:00:00+01:00"}]'::jsonb,
      '12000000-0000-0000-0000-000000000003',
      '62000000-0000-0000-0000-000000000001'
    )
  $$,
  '42501',
  'COURSE_CREATE_FORBIDDEN',
  'editor cannot create a course run'
);

select set_config(
  'request.jwt.claim.sub',
  '22000000-0000-0000-0000-000000000001',
  true
);

select throws_ok(
  $$
    select public.create_course_run_with_sessions(
      '32000000-0000-0000-0000-000000000003',
      'Course that must roll back',
      2026::smallint,
      null,
      '2026-02-15',
      '2027-03-21',
      '[
        {"title":"Samling 1","startsAt":"2026-02-15T09:00:00+01:00","endsAt":"2026-02-15T16:00:00+01:00"},
        {"title":"Samling 2","startsAt":"2026-03-13T09:00:00+01:00","endsAt":"2026-03-15T16:00:00+01:00"},
        {"title":"Samling 3","startsAt":"2026-05-10T16:00:00+02:00","endsAt":"2026-05-08T09:00:00+02:00"}
      ]'::jsonb,
      '12000000-0000-0000-0000-000000000003',
      '62000000-0000-0000-0000-000000000002'
    )
  $$,
  '22023',
  'COURSE_SESSION_DATE_INVALID',
  'invalid third session rejects the transaction'
);

reset role;

select is(
  (
    select count(*)::integer
    from public.course_runs
    where title = 'Course that must roll back'
  ),
  0,
  'failed third session leaves no course run'
);

set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '22000000-0000-0000-0000-000000000001',
  true
);

select lives_ok(
  $$
    select public.create_course_run_with_sessions(
      '32000000-0000-0000-0000-000000000003',
      'Trener 3 2026–2027',
      2026::smallint,
      null,
      '2026-02-15',
      '2027-03-21',
      '[
        {"title":"Samling 1","startsAt":"2026-02-15T09:00:00+01:00","endsAt":"2026-02-15T16:00:00+01:00","locationText":"Oslo"},
        {"title":"Ungdomsdriven","startsAt":"2026-07-01T09:00:00+02:00","endsAt":"2026-07-03T16:00:00+02:00","locationText":"Hafjell GK","sessionType":"youth_drive","isRequired":false},
        {"title":"Samling 3","startsAt":"2027-03-19T09:00:00+01:00","endsAt":"2027-03-21T16:00:00+01:00","locationText":"Oslo"}
      ]'::jsonb,
      '12000000-0000-0000-0000-000000000003',
      '62000000-0000-0000-0000-000000000003'
    )
  $$,
  'administrator creates a course run with ordered sessions'
);

reset role;

select is(
  (
    select count(*)::integer
    from public.course_runs
    where title = 'Trener 3 2026–2027'
  ),
  1,
  'successful transaction creates one run'
);
select is(
  (
    select count(*)::integer
    from public.course_sessions
    where course_run_id = (
      select id from public.course_runs where title = 'Trener 3 2026–2027'
    )
  ),
  3,
  'successful transaction creates every session'
);
select results_eq(
  $$
    select sort_order
    from public.course_sessions
    where course_run_id = (
      select id from public.course_runs where title = 'Trener 3 2026–2027'
    )
    order by sort_order
  $$,
  $$values (1::smallint), (2::smallint), (3::smallint)$$,
  'session order follows the JSON array'
);
select ok(
  exists (
    select 1
    from public.course_sessions
    where course_run_id = (
      select id from public.course_runs where title = 'Trener 3 2026–2027'
    )
      and session_type = 'youth_drive'
      and not is_required
  ),
  'optional Youth Drive is represented without becoming a separate course'
);
select ok(
  exists (
    select 1
    from public.role_assignments
    where course_run_id = (
      select id from public.course_runs where title = 'Trener 3 2026–2027'
    )
      and profile_id = '12000000-0000-0000-0000-000000000003'
      and role = 'course_lead'
      and revoked_at is null
  ),
  'transaction assigns the initial course lead'
);
select ok(
  exists (
    select 1
    from public.audit_events
    where correlation_id = '62000000-0000-0000-0000-000000000003'
      and action = 'course.created'
  ),
  'transaction writes a correlated course creation audit event'
);

select * from finish();

rollback;
