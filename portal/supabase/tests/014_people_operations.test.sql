begin;

select plan(16);

select has_function(
  'public', 'withdraw_enrollment', array['uuid', 'text'],
  'withdraw_enrollment function exists'
);
select has_function(
  'public', 'reopen_enrollment', array['uuid', 'text'],
  'reopen_enrollment function exists'
);

insert into auth.users (id, email, email_confirmed_at)
values
  ('25000000-0000-0000-0000-000000000001', 'life-admin@example.invalid', now()),
  ('25000000-0000-0000-0000-000000000002', 'life-lead@example.invalid', now()),
  ('25000000-0000-0000-0000-000000000003', 'life-teacher@example.invalid', now()),
  ('25000000-0000-0000-0000-000000000004', 'life-otherlead@example.invalid', now()),
  ('25000000-0000-0000-0000-000000000005', 'life-student@example.invalid', now());

insert into public.profiles (id, display_name, normalized_email)
values
  ('15000000-0000-0000-0000-000000000001', 'Livssyklus Admin', 'life-admin@example.invalid'),
  ('15000000-0000-0000-0000-000000000002', 'Livssyklus Kursleder', 'life-lead@example.invalid'),
  ('15000000-0000-0000-0000-000000000003', 'Livssyklus Lærer', 'life-teacher@example.invalid'),
  ('15000000-0000-0000-0000-000000000004', 'Livssyklus Annen Leder', 'life-otherlead@example.invalid'),
  ('15000000-0000-0000-0000-000000000005', 'Livssyklus Student', 'life-student@example.invalid');

insert into public.user_accounts (user_id, profile_id, normalized_email)
values
  ('25000000-0000-0000-0000-000000000001', '15000000-0000-0000-0000-000000000001', 'life-admin@example.invalid'),
  ('25000000-0000-0000-0000-000000000002', '15000000-0000-0000-0000-000000000002', 'life-lead@example.invalid'),
  ('25000000-0000-0000-0000-000000000003', '15000000-0000-0000-0000-000000000003', 'life-teacher@example.invalid'),
  ('25000000-0000-0000-0000-000000000004', '15000000-0000-0000-0000-000000000004', 'life-otherlead@example.invalid'),
  ('25000000-0000-0000-0000-000000000005', '15000000-0000-0000-0000-000000000005', 'life-student@example.invalid');

insert into public.course_templates (id, code, title, level)
values ('35000000-0000-0000-0000-000000000001', 'LIFE_T2', 'Livssyklustest Trener 2', 2);

insert into public.course_runs (id, template_id, title, start_year, starts_on, ends_on, status)
values
  (
    '45000000-0000-0000-0000-000000000001',
    '35000000-0000-0000-0000-000000000001',
    'Livssyklustest A', 2027, '2027-02-01', '2027-10-31', 'active'
  ),
  (
    '45000000-0000-0000-0000-000000000002',
    '35000000-0000-0000-0000-000000000001',
    'Livssyklustest B', 2027, '2027-02-01', '2027-10-31', 'active'
  );

insert into public.role_assignments (profile_id, role, course_template_id, course_run_id, granted_by)
values
  ('15000000-0000-0000-0000-000000000001', 'administrator', null, null, '15000000-0000-0000-0000-000000000001'),
  ('15000000-0000-0000-0000-000000000002', 'course_lead', null, '45000000-0000-0000-0000-000000000001', '15000000-0000-0000-0000-000000000001'),
  ('15000000-0000-0000-0000-000000000003', 'course_teacher', null, '45000000-0000-0000-0000-000000000001', '15000000-0000-0000-0000-000000000001'),
  ('15000000-0000-0000-0000-000000000004', 'course_lead', null, '45000000-0000-0000-0000-000000000002', '15000000-0000-0000-0000-000000000001');

insert into public.enrollments (id, course_run_id, profile_id, status, status_reason)
values (
  '65000000-0000-0000-0000-000000000001',
  '45000000-0000-0000-0000-000000000001',
  '15000000-0000-0000-0000-000000000005',
  'active',
  null
);

set local role authenticated;

-- Student cannot withdraw anyone.
select set_config('request.jwt.claim.sub', '25000000-0000-0000-0000-000000000005', true);
select throws_ok(
  $$select public.withdraw_enrollment('65000000-0000-0000-0000-000000000001', 'Forsøk fra student')$$,
  '42501',
  'ENROLLMENT_STATUS_FORBIDDEN',
  'student cannot withdraw an enrollment'
);

-- Course teacher without the lead role cannot withdraw.
select set_config('request.jwt.claim.sub', '25000000-0000-0000-0000-000000000003', true);
select throws_ok(
  $$select public.withdraw_enrollment('65000000-0000-0000-0000-000000000001', 'Forsøk fra lærer')$$,
  '42501',
  'ENROLLMENT_STATUS_FORBIDDEN',
  'course teacher without lead role cannot withdraw'
);

-- Lead of another course cannot withdraw across courses.
select set_config('request.jwt.claim.sub', '25000000-0000-0000-0000-000000000004', true);
select throws_ok(
  $$select public.withdraw_enrollment('65000000-0000-0000-0000-000000000001', 'Forsøk fra annen kursleder')$$,
  '42501',
  'ENROLLMENT_STATUS_FORBIDDEN',
  'lead of another course cannot withdraw'
);

-- Reason is mandatory for the course lead too.
select set_config('request.jwt.claim.sub', '25000000-0000-0000-0000-000000000002', true);
select throws_ok(
  $$select public.withdraw_enrollment('65000000-0000-0000-0000-000000000001', '   ')$$,
  '22023',
  'ENROLLMENT_REASON_REQUIRED',
  'blank reason is rejected'
);

-- Course lead withdraws with a reason.
select lives_ok(
  $$select public.withdraw_enrollment('65000000-0000-0000-0000-000000000001', 'Sluttet i klubben')$$,
  'course lead withdraws an active enrollment'
);

-- Withdrawing again is an invalid transition.
select throws_ok(
  $$select public.withdraw_enrollment('65000000-0000-0000-0000-000000000001', 'Dobbel trekk')$$,
  '22023',
  'ENROLLMENT_INVALID_TRANSITION',
  'withdrawing an already withdrawn enrollment fails'
);

-- Student cannot reopen either.
select set_config('request.jwt.claim.sub', '25000000-0000-0000-0000-000000000005', true);
select throws_ok(
  $$select public.reopen_enrollment('65000000-0000-0000-0000-000000000001', 'Forsøk fra student')$$,
  '42501',
  'ENROLLMENT_STATUS_FORBIDDEN',
  'student cannot reopen an enrollment'
);

reset role;

select results_eq(
  $$select status::text, status_reason from public.enrollments
    where id = '65000000-0000-0000-0000-000000000001'$$,
  $$values ('withdrawn', 'Sluttet i klubben')$$,
  'withdrawal stores status and reason'
);

select results_eq(
  $$select (before_data ->> 'status'), (after_data ->> 'status'), reason
    from public.audit_events
    where action = 'enrollment.withdrawn'
      and entity_id = '65000000-0000-0000-0000-000000000001'$$,
  $$values ('active', 'withdrawn', 'Sluttet i klubben')$$,
  'withdrawal writes an audit event with before and after data'
);

set local role authenticated;

-- Administrator reopens with a reason.
select set_config('request.jwt.claim.sub', '25000000-0000-0000-0000-000000000001', true);
select lives_ok(
  $$select public.reopen_enrollment('65000000-0000-0000-0000-000000000001', 'Tilbake etter avklaring')$$,
  'administrator reopens a withdrawn enrollment'
);

-- Reopening an active enrollment is an invalid transition.
select throws_ok(
  $$select public.reopen_enrollment('65000000-0000-0000-0000-000000000001', 'Dobbel gjenåpning')$$,
  '22023',
  'ENROLLMENT_INVALID_TRANSITION',
  'reopening an active enrollment fails'
);

reset role;

select results_eq(
  $$select status::text, status_reason from public.enrollments
    where id = '65000000-0000-0000-0000-000000000001'$$,
  $$values ('active', 'Tilbake etter avklaring')$$,
  'reopening restores active status'
);

select results_eq(
  $$select (before_data ->> 'status'), (after_data ->> 'status'), reason
    from public.audit_events
    where action = 'enrollment.reopened'
      and entity_id = '65000000-0000-0000-0000-000000000001'$$,
  $$values ('withdrawn', 'active', 'Tilbake etter avklaring')$$,
  'reopening writes an audit event with before and after data'
);

-- Reopening never touches deadlines: no override rows were created.
select is(
  (select count(*) from public.assignment_deadline_overrides
    where enrollment_id = '65000000-0000-0000-0000-000000000001'),
  0::bigint,
  'lifecycle changes never create or change deadline overrides'
);

select * from finish();

rollback;
